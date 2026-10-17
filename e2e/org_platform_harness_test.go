package e2e

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/router"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/setting/ratio_setting"
	"github.com/uter-ai/uter/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// 测试夹具：模拟一家公司（组织）+ 组织内各角色 + 一个平台直管的外部用户
// ---------------------------------------------------------------------------
//
// 角色矩阵见下。系统角色（common.Role*）与组织内角色（org_role）正交：
// 除 root 外所有人都是普通用户（role=1），组织管理员不得因此获得平台级权限。
//
//	root      role=100  org=0                     平台超管
//	owner     role=1    org=A  org_role=owner     公司负责人
//	admin     role=1    org=A  org_role=admin     组织管理员
//	deptadmin role=1    org=A  org_role=department_admin  部门管理员（销售部）
//	m1        role=1    org=A  org_role=member    销售部成员
//	m2        role=1    org=A  org_role=member    研发部成员
//	outsider  role=1    org=0                     平台直管普通用户

const (
	orgE2EPassword = "Test1234!"
	orgE2EModel    = "gpt-4o-org-e2e"
)

type orgPlatformEnv struct {
	engine    *gin.Engine
	db        *gorm.DB
	upstream  *httptest.Server
	org       *model.Organization
	orgB      *model.Organization
	users     map[string]*model.User
	dashToken map[string]string
	apiKey    map[string]string
	// setUpstreamFailure 由 upstreamServer 注入，用于切换上游成功/失败。
	setUpstreamFailure func(bool)
}

// newOrgPlatformEnv 启动一个完整的网关（真实 api + relay 路由）与内存数据库。
func newOrgPlatformEnv(t *testing.T) *orgPlatformEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)
	require.NoError(t, i18n.Init())
	service.InitHttpClient()

	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedis := common.RedisEnabled
	previousPasswordLogin := common.PasswordLoginEnabled
	previousSSRF := *system_setting.GetFetchSetting()

	database, err := gorm.Open(sqlite.Open("file:orge2e?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(
		&model.Channel{}, &model.Token{}, &model.User{}, &model.UserSession{},
		&model.AuthFlow{}, &model.ExternalIdentityClaim{}, &model.PasskeyCredential{},
		&model.Option{}, &model.LoginEncryptionKey{}, &model.Redemption{},
		&model.Ability{}, &model.Log{}, &model.AuditLog{}, &model.Midjourney{},
		&model.TopUp{}, &model.QuotaData{}, &model.Task{}, &model.TaskPlugin{},
		&model.Model{}, &model.Vendor{}, &model.PrefillGroup{}, &model.Setup{},
		&model.Organization{}, &model.TwoFA{}, &model.TwoFABackupCode{},
		&model.Checkin{}, &model.SubscriptionOrder{}, &model.UserSubscription{},
		&model.SubscriptionPreConsumeRecord{}, &model.CustomOAuthProvider{},
		&model.UserOAuthBinding{}, &model.PerfMetric{}, &model.SystemInstance{},
		&model.SystemTask{}, &model.SystemTaskLock{}, &model.CasbinRule{},
		&model.AuthzRole{}, &model.SubscriptionPlan{},
	))
	model.DB, model.LOG_DB = database, database
	// 直接赋值 DB 时方言列名（"`key`" 等）尚未初始化，不调用会把所有
	// GetTokenByKey 变成 `WHERE  = ?` 的语法错误。见 model.InitColumnNames。
	model.InitColumnNames()
	common.RedisEnabled = false
	common.PasswordLoginEnabled = true
	// 上游是 httptest 本地服务，必须放开 SSRF 防护，否则 relay 一律被拦。
	fetch := system_setting.GetFetchSetting()
	fetch.EnableSSRFProtection = false
	fetch.AllowPrivateIp = true

	engine := gin.New()
	router.SetApiRouter(engine)
	router.SetRelayRouter(engine)

	env := &orgPlatformEnv{
		engine:    engine,
		db:        database,
		users:     map[string]*model.User{},
		dashToken: map[string]string{},
		apiKey:    map[string]string{},
	}
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedis
		common.PasswordLoginEnabled = previousPasswordLogin
		*system_setting.GetFetchSetting() = previousSSRF
		if env.upstream != nil {
			env.upstream.Close()
		}
		if sqlDB, err := database.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return env
}

// upstreamServer 起一个假的 OpenAI 上游，返回固定 usage 的成功响应（或按开关返回 500）。
func (env *orgPlatformEnv) upstreamServer(t *testing.T) *httptest.Server {
	t.Helper()
	var mu sync.Mutex
	fail := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		shouldFail := fail
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		if shouldFail {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = io.WriteString(w, `{"error":{"message":"upstream boom","type":"server_error"}}`)
			return
		}
		_, _ = io.WriteString(w, `{
			"id":"chatcmpl-orge2e",
			"object":"chat.completion",
			"created":1700000000,
			"model":"`+orgE2EModel+`",
			"choices":[{"index":0,"message":{"role":"assistant","content":"hello"},"finish_reason":"stop"}],
			"usage":{"prompt_tokens":10000,"completion_tokens":5000,"total_tokens":15000}
		}`)
	}))
	env.upstream = server
	env.setUpstreamFailure = func(v bool) {
		mu.Lock()
		fail = v
		mu.Unlock()
	}
	return server
}

// setUpstreamFailure 切换上游的成功/失败状态（用于验证失败退款）。
func (env *orgPlatformEnv) setFailure(v bool) {
	if env.setUpstreamFailure != nil {
		env.setUpstreamFailure(v)
	}
}

// ---------------------------------------------------------------------------
// 基础操作
// ---------------------------------------------------------------------------

func (env *orgPlatformEnv) createUser(t *testing.T, username string, role int) *model.User {
	t.Helper()
	hash, err := common.Password2Hash(orgE2EPassword)
	require.NoError(t, err)
	user := &model.User{
		Username: username,
		Password: hash,
		Role:     role,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		AffCode:  username + "-aff",
	}
	require.NoError(t, model.DB.Create(user).Error)
	env.users[username] = user
	return user
}

// login 走真实登录接口，取回会话 access token。
func (env *orgPlatformEnv) login(t *testing.T, username string) string {
	t.Helper()
	body, err := common.Marshal(map[string]string{"username": username, "password": orgE2EPassword})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/user/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	env.engine.ServeHTTP(recorder, req)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())

	var result struct {
		Success bool `json:"success"`
		Data    struct {
			AccessToken string `json:"access_token"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
	require.True(t, result.Success, recorder.Body.String())
	require.NotEmpty(t, result.Data.AccessToken, recorder.Body.String())
	env.dashToken[username] = result.Data.AccessToken
	return result.Data.AccessToken
}

// call 以某个角色的身份调用平台 API。actor 为空表示匿名。
func (env *orgPlatformEnv) call(t *testing.T, method, path, actor, body string) *httptest.ResponseRecorder {
	t.Helper()
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	if actor != "" {
		req.Header.Set("Authorization", "Bearer "+env.dashToken[actor])
	}
	recorder := httptest.NewRecorder()
	env.engine.ServeHTTP(recorder, req)
	return recorder
}

func (env *orgPlatformEnv) uid(actor string) int { return env.users[actor].Id }

func (env *orgPlatformEnv) orgId() int { return env.org.Id }

// reloadUser 从数据库重新读取用户行。
func (env *orgPlatformEnv) reloadUser(t *testing.T, actor string) *model.User {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.First(&user, env.users[actor].Id).Error)
	return &user
}

func (env *orgPlatformEnv) reloadOrg(t *testing.T, id int) *model.Organization {
	t.Helper()
	org, err := model.GetOrganizationById(id)
	require.NoError(t, err)
	return org
}

// ---------------------------------------------------------------------------
// 夹具装配：建组织 + 各角色 + 上游渠道
// ---------------------------------------------------------------------------

// seedOrganization 走真实 API 建组织（超管开通租户），随后把负责人转移给普通用户 owner，
// 超管退出组织。

func (env *orgPlatformEnv) seedOrganization(t *testing.T) {
	t.Helper()
	env.createUser(t, "root", common.RoleRootUser)
	// CreateOrganization requires an existing enabled, unassigned ordinary owner.
	env.createUser(t, "owner", common.RoleCommonUser)
	env.login(t, "root")

	recorder := env.call(t, http.MethodPost, "/api/organizations", "root",
		`{"name":"Acme 科技","owner_username":"owner","quota":100000000,"member_limit":0}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	var created struct {
		Success bool `json:"success"`
		Data struct {
			Id int `json:"id"`
			Name string `json:"name"`
			Quota int64 `json:"quota"`
			OwnerUserId int `json:"owner_user_id"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &created))
	require.True(t, created.Success, recorder.Body.String())
	env.org = env.reloadOrg(t, created.Data.Id)
	require.Equal(t, "Acme 科技", env.org.Name)
	require.Equal(t, env.uid("owner"), env.org.OwnerUserId)

	// Root remains platform-only; the named ordinary user owns this organization.
	rootAfterCreate := env.reloadUser(t, "root")
	require.Equal(t, 0, rootAfterCreate.OrganizationId)
	require.Empty(t, rootAfterCreate.OrgRole)

	for _, name := range []string{"admin", "deptadmin", "m1", "m2", "outsider"} {
		env.createUser(t, name, common.RoleCommonUser)
	}

	members := []struct {
		actor string
		dept string
		role string
		subQta int64
	}{
		{"admin", "总办", model.OrgRoleAdmin, 0},
		{"deptadmin", "销售部", model.OrgRoleDepartmentAdmin, 0},
		{"m1", "销售部", model.OrgRoleMember, 0},
		{"m2", "研发部", model.OrgRoleMember, 0},
	}
	for _, m := range members {
		recorder = env.call(t, http.MethodPost, "/api/organization/"+strconv.Itoa(env.org.Id)+"/members", "root",
			`{"members":[{"user_id":`+strconv.Itoa(env.uid(m.actor))+`,"department_name":"`+m.dept+`"}]}`)
		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		if m.role != model.OrgRoleMember {
			recorder = env.call(t, http.MethodPut, "/api/organization/"+strconv.Itoa(env.org.Id)+"/members/"+strconv.Itoa(env.uid(m.actor)), "root",
				`{"org_role":"`+m.role+`"}`)
			require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		}
	}

	// A second tenant gets a dedicated owner. Keep outsider unassigned so cross-tenant
	// authorization tests continue to exercise a genuinely external account.
	env.createUser(t, "otherowner", common.RoleCommonUser)
	recorder = env.call(t, http.MethodPost, "/api/organizations", "root",
		`{"name":"Other 公司","owner_username":"otherowner","quota":100000000}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	var second struct {
		Data struct {
			Id int `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &second))
	env.orgB = env.reloadOrg(t, second.Data.Id)
	require.Equal(t, env.uid("otherowner"), env.orgB.OwnerUserId)

	// Refresh credentials only after all membership/role changes have committed.
	for _, name := range []string{"root", "owner", "admin", "deptadmin", "m1", "m2", "outsider"} {
		env.login(t, name)
	}
}

func (env *orgPlatformEnv) seedChannel(t *testing.T, upstreamURL string) {
	t.Helper()
	url := upstreamURL
	channel := model.Channel{
		Type:    constant.ChannelTypeOpenAI,
		Name:    "e2e-upstream",
		Key:     "sk-e2e-upstream",
		BaseURL: &url,
		Status:  common.ChannelStatusEnabled,
		Models:  orgE2EModel,
		Group:   "default",
	}
	require.NoError(t, model.DB.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(model.DB))
	// 测试模型不在内置价目表里，必须显式定价，否则 relay 会以
	// model_price_error 拒绝，计费链路根本走不到。
	ratio_setting.InitRatioSettings()
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(
		`{"`+orgE2EModel+`":1}`))
}

// createToken 以某角色身份通过 API 创建 API 令牌，返回令牌 key。
//
// 平台创建接口出于安全只回 success，不回 key（明文只此一次、存放在库里），
// 因此这里按「用户名 + 令牌名」回读拿到 key。
func (env *orgPlatformEnv) createToken(t *testing.T, actor, name string) string {
	t.Helper()
	body := `{"name":"` + name + `","unlimited_quota":true,"expired_time":-1,"model_limits_enabled":false}`
	recorder := env.call(t, http.MethodPost, "/api/token/", actor, body)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.True(t, decodeSuccess(recorder.Body.Bytes()), recorder.Body.String())

	var token model.Token
	err := model.DB.Where("user_id = ? AND name = ?", env.uid(actor), name).First(&token).Error
	require.NoError(t, err, "令牌未落库，创建可能被拒绝")
	require.NotEmpty(t, token.Key)
	env.apiKey[actor] = token.Key
	return token.Key
}

// relay 用 API 令牌打一次真实的 /v1/chat/completions。
func (env *orgPlatformEnv) relay(t *testing.T, apiKey string) *httptest.ResponseRecorder {
	t.Helper()
	body := `{"model":"` + orgE2EModel + `","messages":[{"role":"user","content":"hello"}]}`
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	recorder := httptest.NewRecorder()
	env.engine.ServeHTTP(recorder, req)
	return recorder
}

func (env *orgPlatformEnv) sumLogQuota(t *testing.T, userId int) int {
	t.Helper()
	var total int
	err := model.LOG_DB.Model(&model.Log{}).Where("user_id = ?", userId).
		Select("COALESCE(SUM(quota),0)").Scan(&total).Error
	require.NoError(t, err)
	return total
}

// ---------------------------------------------------------------------------
// 账本操作辅助
// ---------------------------------------------------------------------------

// setOrgQuota 由超管改组织共享预算。
func (env *orgPlatformEnv) setOrgQuota(t *testing.T, orgId int, quota int64) {
	t.Helper()
	recorder := env.call(t, http.MethodPut, "/api/organization/"+strconv.Itoa(orgId), "root",
		`{"quota":`+strconv.FormatInt(quota, 10)+`}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.True(t, decodeSuccess(recorder.Body.Bytes()), recorder.Body.String())
}

// setOrgStatus 由超管改组织状态（1=启用，2=停用）。
func (env *orgPlatformEnv) setOrgStatus(t *testing.T, orgId int, status int) {
	t.Helper()
	recorder := env.call(t, http.MethodPut, "/api/organization/"+strconv.Itoa(orgId), "root",
		`{"status":`+strconv.Itoa(status)+`}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.True(t, decodeSuccess(recorder.Body.Bytes()), recorder.Body.String())
}

// setSubQuota 由超管给成员设子额度上限（0=不限）。
func (env *orgPlatformEnv) setSubQuota(t *testing.T, actor string, limit int64) {
	t.Helper()
	recorder := env.call(t, http.MethodPut,
		"/api/organization/"+strconv.Itoa(env.orgId())+"/members/"+strconv.Itoa(env.uid(actor)),
		"root", `{"sub_quota_limit":`+strconv.FormatInt(limit, 10)+`}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.True(t, decodeSuccess(recorder.Body.Bytes()), recorder.Body.String())
	// 改成员属性会 bump auth_version，调用方与被改成员的旧会话都立即失效。
	env.login(t, "root")
	env.login(t, actor)
}

// setUserQuota 直接给个人钱包充值（绕过充值审批流，只关心计费结果）。
func (env *orgPlatformEnv) setUserQuota(t *testing.T, actor string, quota int) {
	t.Helper()
	require.NoError(t, model.DB.Model(&model.User{}).
		Where("id = ?", env.uid(actor)).Update("quota", quota).Error)
}

// orgUsed 读组织账本的已用额度。
func (env *orgPlatformEnv) orgUsed(t *testing.T, orgId int) int64 {
	t.Helper()
	return env.reloadOrg(t, orgId).UsedQuota
}

// decodeJSON 解析响应体。
func decodeJSON(body []byte, target any) error { return json.Unmarshal(body, target) }

// decodeSuccess 读取响应里的 success 标记。
func decodeSuccess(body []byte) bool {
	var result struct {
		Success bool `json:"success"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return false
	}
	return result.Success
}

// requireDenied 断言请求被拒绝。
//
// 本平台有两种拒绝形态，都算「没放行」：
//   - 中间件角色闸门（OrgAdminAuth / AdminAuth / RootAuth）→ 401 / 403；
//   - 业务层鉴权失败（handler 内判定越权）→ 200 + {"success":false}。
//
// 只断言状态码会漏掉第二种，因此两者都必须视为拒绝。
func requireDenied(t *testing.T, recorder *httptest.ResponseRecorder, context ...string) {
	t.Helper()
	body := recorder.Body.String()
	if recorder.Code == http.StatusOK && decodeSuccess([]byte(body)) {
		detail := ""
		if len(context) > 0 {
			detail = context[0] + ": "
		}
		t.Fatalf("%srequest was allowed but must be denied (code=%d, body=%s)", detail, recorder.Code, body)
	}
}

// requireOK 断言请求成功（200 + success:true）。
func requireOK(t *testing.T, recorder *httptest.ResponseRecorder, context ...string) {
	t.Helper()
	body := recorder.Body.String()
	detail := ""
	if len(context) > 0 {
		detail = context[0] + ": "
	}
	if recorder.Code != http.StatusOK {
		t.Fatalf("%sexpected 200, got %d (body=%s)", detail, recorder.Code, body)
	}
	if !decodeSuccess([]byte(body)) {
		t.Fatalf("%sexpected success, body=%s", detail, body)
	}
}
