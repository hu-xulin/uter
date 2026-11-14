package controller

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sort"
	"strings"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/middleware"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/service/authz"
	"github.com/uter-ai/uter/setting/operation_setting"
	"gorm.io/gorm"
)

/*
 * Phase-2 P2-07/P2-08 的业务安全负向测试（handler 级）。
 *
 * 既有套件各自覆盖一个切面（回调验签、访问令牌、审计……），这里把它们拼成
 * 一张完整的负向矩阵：对 N1–N19 每一类攻击面各跑一次**真实请求**，断言
 * 「攻击被拒绝 / 资金分毫未动 / 不泄露内部细节」。所有数据库均为进程内
 * :memory: SQLite，绝不触碰生产配置、真实支付网关或 one-api.db。
 *
 * 每个子测试在真实断言之后输出一行机器可读结果：
 *
 *	NEG <id> <PASS|FAIL|BLOCKED|NOT_RUN> <detail>
 *
 * `.uap/tests/phase2-security-negative.test.mjs` 会解析这些行，任何类别
 * 缺失或非 PASS 都会让整条流水线失败——不允许静默降级。
 */

const secNegEpayKey = "epay-EXAMPLE-TEST-KEY-NOT-A-REAL-CREDENTIAL"

var (
	secNegResultsMu sync.Mutex
	secNegResults   = map[string]string{}
	secNegDetails   = map[string]string{}
)

// secNegOrder 是 N1–N19 的固定输出顺序，供汇总子测试使用。
var secNegOrder = []string{
	"n01", "n02", "n03", "n04", "n05", "n06", "n07", "n08", "n09", "n10",
	"n11", "n12", "n13", "n14", "n15", "n16", "n17", "n18", "n19",
}

func secNegRecord(t *testing.T, id, status, detail string) {
	t.Helper()
	t.Logf("NEG %s %s %s", id, status, detail)
	secNegResultsMu.Lock()
	defer secNegResultsMu.Unlock()
	secNegResults[id] = status
	secNegDetails[id] = detail
}

func secNegPassOrFail(t *testing.T, id, detail string) {
	t.Helper()
	status := "PASS"
	if t.Failed() {
		status = "FAIL"
	}
	secNegRecord(t, id, status, detail)
}

func setupSecurityNegativeDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	prevDB, prevLog := model.DB, model.LOG_DB
	prevMain, prevLogType := common.MainDatabaseType(), common.LogDatabaseType()
	prevRedis := common.RedisEnabled
	prevMaster := common.IsMasterNode
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	// 单连接：既避免 :memory: 多连接库分裂，也把并发写入串行化，
	// 让 N14 的「并发只入账一次」断言由真实事务路径而非运气保证。
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, i18n.Init())
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.TopUp{}, &model.Log{}, &model.Option{},
		&model.UserSession{}, &model.AuditLog{}, &model.CasbinRule{}, &model.AuthzRole{},
		&model.UserAccessToken{}, &model.AuthFlow{}, &model.TwoFA{}, &model.TwoFABackupCode{},
		&model.PasskeyCredential{}, &model.UserOAuthBinding{},
		&model.RefundIntent{}, &model.SubscriptionPreConsumeRecord{}, &model.UserSubscription{},
	))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.IsMasterNode = true
	model.InitColumnNames()
	require.NoError(t, authz.Init(db))
	t.Cleanup(func() {
		model.DB, model.LOG_DB = prevDB, prevLog
		common.SetDatabaseTypes(prevMain, prevLogType)
		common.RedisEnabled = prevRedis
		common.IsMasterNode = prevMaster
		model.InitColumnNames()
	})
	return db
}

// secNegUser 建一个唯一 username/aff_code 的启用用户（aff_code 有唯一索引）。
func secNegUser(t *testing.T, db *gorm.DB, name string) *model.User {
	t.Helper()
	user := &model.User{
		Username: "secneg_" + name,
		AffCode:  "secneg" + name,
		Status:   common.UserStatusEnabled,
		Quota:    0,
	}
	require.NoError(t, db.Create(user).Error)
	return user
}

// secNegEpayOrder 为用户建一笔待支付的易支付订单：amount=2（入账额度）、money=10（应付金额）。
func secNegEpayOrder(t *testing.T, db *gorm.DB, user *model.User, tradeNo string) *model.TopUp {
	t.Helper()
	order := &model.TopUp{
		UserId:          user.Id,
		Amount:          2,
		Money:           10,
		TradeNo:         tradeNo,
		PaymentMethod:   "alipay",
		PaymentProvider: model.PaymentProviderEpay,
		CreateTime:      common.GetTimestamp(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(order).Error)
	return order
}

// secNegEpaySign 复刻 go-epay 的 MD5 签名：过滤 sign/sign_type/空值，按键排序
// 拼 k=v&，末尾拼接商户密钥后取 MD5。测试用密钥是显式的 EXAMPLE 占位符。
func secNegEpaySign(params map[string]string, key string) string {
	filtered := make(map[string]string, len(params))
	for k, v := range params {
		if k == "sign" || k == "sign_type" || v == "" {
			continue
		}
		filtered[k] = v
	}
	keys := make([]string, 0, len(filtered))
	for k := range filtered {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	for _, k := range keys {
		b.WriteString(k + "=" + filtered[k] + "&")
	}
	sum := md5.Sum([]byte(strings.TrimSuffix(b.String(), "&") + key))
	return hex.EncodeToString(sum[:])
}

// secNegEpayParams 构造回调参数表（不含签名）。
func secNegEpayParams(tradeNo, paidMoney, providerTradeNo string) map[string]string {
	return map[string]string{
		"out_trade_no": tradeNo,
		"trade_no":     providerTradeNo,
		"type":         "alipay",
		"money":        paidMoney,
		"trade_status": "TRADE_SUCCESS",
	}
}

// secNegEpayForm 把参数表（含 sign/sign_type，如存在）编码成回调 POST 请求。
// 空字符串值也会按原样写出，用于构造「签名为空」变体。
func secNegEpayForm(params map[string]string) *http.Request {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	form := ""
	for _, k := range keys {
		form += url.QueryEscape(k) + "=" + url.QueryEscape(params[k]) + "&"
	}
	req := httptest.NewRequest(http.MethodPost, "/api/user/epay/notify", strings.NewReader(strings.TrimSuffix(form, "&")))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return req
}

// secNegEpayRequest 构造一笔带指定签名的回调请求（sign 为空串表示完全缺失签名）。
func secNegEpayRequest(tradeNo, paidMoney, providerTradeNo, sign string) *http.Request {
	params := secNegEpayParams(tradeNo, paidMoney, providerTradeNo)
	if sign != "" {
		params["sign"] = sign
		params["sign_type"] = "MD5"
	}
	return secNegEpayForm(params)
}

// secNegSignedEpayRequest 返回一笔签名合法的回调请求。
func secNegSignedEpayRequest(tradeNo, paidMoney, providerTradeNo string) *http.Request {
	return secNegSignedEpayRequestWithKey(tradeNo, paidMoney, providerTradeNo, secNegEpayKey)
}

func secNegEpayRouter() *gin.Engine {
	router := gin.New()
	router.POST("/api/user/epay/notify", EpayNotify)
	return router
}

// secNegDashboardRouter 是 N1/N2/N3/N4/N9/N10/N15/N18 的最小真实路由：
// 与 router/api-router.go 相同的中间件挂法（UserAuth/AdminAuth/RootAuth）。
func secNegDashboardRouter() *gin.Engine {
	router := gin.New()
	api := router.Group("/api")
	api.POST("/user/login", Login)
	userRoute := api.Group("/user")
	selfRoute := userRoute.Group("/", middleware.UserAuth())
	selfRoute.GET("/self", GetSelf)
	selfRoute.PUT("/self", UpdateSelf)
	userRoute.GET("/", middleware.AdminAuth(), GetAllUsers)
	api.GET("/audit/self", middleware.UserAuth(), GetAuditLogs)
	api.GET("/option", middleware.RootAuth(), GetOptions)
	return router
}

func secNegSetupEpay(t *testing.T) {
	t.Helper()
	prevAddress := operation_setting.PayAddress
	prevEpayId := operation_setting.EpayId
	prevEpayKey := operation_setting.EpayKey
	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "10001"
	operation_setting.EpayKey = secNegEpayKey
	t.Cleanup(func() {
		operation_setting.PayAddress = prevAddress
		operation_setting.EpayId = prevEpayId
		operation_setting.EpayKey = prevEpayKey
	})
}

// secNegReloadQuota/Status 直接读库，做资金安全断言（不信任 HTTP 应答）。
func secNegReloadQuota(t *testing.T, db *gorm.DB, userId int) int {
	t.Helper()
	var refreshed model.User
	require.NoError(t, db.Select("quota").Where("id = ?", userId).First(&refreshed).Error)
	return refreshed.Quota
}

func secNegReloadOrderStatus(t *testing.T, db *gorm.DB, tradeNo string) string {
	t.Helper()
	reloaded := model.GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, reloaded)
	return reloaded.Status
}

// secNegTamperedJWT 翻转 JWT 最后一个字符，构造签名被篡改的会话令牌。
func secNegTamperedJWT(jwt string) string {
	last := string(jwt[len(jwt)-1])
	replacement := "A"
	if last == "A" {
		replacement = "B"
	}
	return jwt[:len(jwt)-1] + replacement
}

func TestPhase2SecurityNegative(t *testing.T) {
	db := setupSecurityNegativeDB(t)
	secNegSetupEpay(t)

	// 贯穿多个子测试的普通用户 + 浏览器会话。
	normalUser := secNegUser(t, db, "normal")
	_, normalJWT := createAccessTokenTestSession(t, normalUser.Id, "secneg-normal-session")

	router := secNegDashboardRouter()
	epayRouter := secNegEpayRouter()

	doJSON := func(method, path, credential, body string) *httptest.ResponseRecorder {
		request := httptest.NewRequest(method, path, strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		if credential != "" {
			request.Header.Set("Authorization", "Bearer "+credential)
		}
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, request)
		return recorder
	}

	t.Run("n01_unauthorized_access", func(t *testing.T) {
		// 完全不带凭据访问受保护接口必须 401，且不得泄露任何内部细节。
		recorder := doJSON(http.MethodGet, "/api/user/self", "", "")
		assert.Equal(t, http.StatusUnauthorized, recorder.Code, recorder.Body.String())
		assert.Contains(t, recorder.Body.String(), `"success":false`)
		secNegPassOrFail(t, "n01", "no credentials -> 401 on GET /api/user/self")
	})

	t.Run("n02_privilege_escalation", func(t *testing.T) {
		// 普通用户访问管理员接口必须 403，响应体绝不带出用户列表。
		recorder := doJSON(http.MethodGet, "/api/user/", normalJWT, "")
		assert.Equal(t, http.StatusForbidden, recorder.Code, recorder.Body.String())
		assert.Contains(t, recorder.Body.String(), "AUTH_INSUFFICIENT_PRIVILEGE")
		assert.NotContains(t, recorder.Body.String(), `"secneg_`)
		secNegPassOrFail(t, "n02", "common user -> admin GET /api/user/ -> 403")
	})

	t.Run("n03_api_key_scope", func(t *testing.T) {
		// 只有 usage:read 作用域的 PAT 访问 profile:read 接口必须被拒。
		scoped, _ := createScopedAccessToken(t, normalUser.Id, 0, "usage:read")
		recorder := doJSON(http.MethodGet, "/api/user/self", scoped, "")
		assert.Equal(t, http.StatusForbidden, recorder.Code, recorder.Body.String())
		assert.Contains(t, recorder.Body.String(), `"code":"ACCESS_TOKEN_SCOPE_DENIED"`)
		// 同一令牌访问其作用域内的接口应当放行，证明拒绝源于作用域而非令牌失效。
		allowed := doJSON(http.MethodGet, "/api/audit/self", scoped, "")
		assert.Equal(t, http.StatusOK, allowed.Code, allowed.Body.String())
		secNegPassOrFail(t, "n03", "PAT scope enforcement: usage:read token denied on profile route")
	})

	t.Run("n04_authentication", func(t *testing.T) {
		// 错误密码必须被拒（响应为通用文案），且不产生任何新会话。
		hashed, err := common.Password2Hash("secneg-correct-password")
		require.NoError(t, err)
		loginUser := &model.User{
			Username: "secneg_login", Password: hashed, AffCode: "secneglogin",
			Status: common.UserStatusEnabled, Role: common.RoleCommonUser, AuthVersion: 1,
		}
		require.NoError(t, db.Create(loginUser).Error)
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/user/login",
			strings.NewReader(`{"username":"secneg_login","password":"secneg-WRONG-password"}`))
		Login(c)
		var loginResponse struct {
			Success bool   `json:"success"`
			Message string `json:"message"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &loginResponse))
		assert.False(t, loginResponse.Success)
		assert.Equal(t, "Username or password is incorrect, or user has been banned", loginResponse.Message)
		activeCount, err := model.CountActiveUserSessions(loginUser.Id, common.GetTimestamp())
		require.NoError(t, err)
		assert.Zero(t, activeCount, "wrong password must not create a session")

		// 篡改签名的会话 JWT 必须被中间件拒绝。
		tampered := secNegTamperedJWT(normalJWT)
		assert.NotEqual(t, normalJWT, tampered)
		_, err = service.ParseAccessToken(tampered)
		assert.Error(t, err, "tampered JWT must fail parsing")
		recorder = doJSON(http.MethodGet, "/api/user/self", tampered, "")
		assert.Equal(t, http.StatusUnauthorized, recorder.Code, recorder.Body.String())
		secNegPassOrFail(t, "n04", "wrong password rejected; tampered session JWT -> 401")
	})

	t.Run("n05_forged_payment_callback", func(t *testing.T) {
		// 伪造签名（随机 32 位 hex）的回调必须被验签拒绝，订单与余额分毫未动。
		user := secNegUser(t, db, "forged")
		order := secNegEpayOrder(t, db, user, "SECNEG-N05-FORGED")
		recorder := httptest.NewRecorder()
		epayRouter.ServeHTTP(recorder, secNegEpayRequest(order.TradeNo, "10.00", "PROV-N05", strings.Repeat("a", 32)))
		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, "fail", recorder.Body.String(), "forged signature must be rejected with fail")
		assert.Equal(t, common.TopUpStatusPending, secNegReloadOrderStatus(t, db, order.TradeNo))
		assert.Equal(t, 0, secNegReloadQuota(t, db, user.Id), "forged callback must not credit quota")
		secNegPassOrFail(t, "n05", "forged epay signature -> fail; order pending; quota 0")
	})

	t.Run("n06_signature_variants", func(t *testing.T) {
		// 缺失签名、空签名、用错密钥计算的三种变体都必须拒绝。
		user := secNegUser(t, db, "variants")
		order := secNegEpayOrder(t, db, user, "SECNEG-N06-VARIANTS")
		variants := []struct {
			name    string
			request *http.Request
		}{
			{"missing sign param", secNegEpayRequest(order.TradeNo, "10.00", "PROV-N06", "")},
			{"empty sign param", secNegEpayForm(map[string]string{
				"out_trade_no": order.TradeNo, "trade_no": "PROV-N06", "type": "alipay",
				"money": "10.00", "trade_status": "TRADE_SUCCESS", "sign": "", "sign_type": "MD5",
			})},
			{"sign computed with wrong key", secNegSignedEpayRequestWithKey(order.TradeNo, "10.00", "PROV-N06", secNegEpayKey+"-attacker")},
		}
		for _, variant := range variants {
			recorder := httptest.NewRecorder()
			epayRouter.ServeHTTP(recorder, variant.request)
			assert.Equal(t, "fail", recorder.Body.String(), variant.name+": bad signature must be rejected")
		}
		assert.Equal(t, common.TopUpStatusPending, secNegReloadOrderStatus(t, db, order.TradeNo))
		assert.Equal(t, 0, secNegReloadQuota(t, db, user.Id), "no signature variant may credit quota")
		secNegPassOrFail(t, "n06", "missing/empty/wrong-key signatures all rejected")
	})

	t.Run("n07_replay_attack", func(t *testing.T) {
		// 同一笔回调原文重放：首次入账后，重放绝不二次入账。
		user := secNegUser(t, db, "replay")
		order := secNegEpayOrder(t, db, user, "SECNEG-N07-REPLAY")
		request := secNegSignedEpayRequest(order.TradeNo, "10.00", "PROV-N07")
		first := httptest.NewRecorder()
		epayRouter.ServeHTTP(first, request)
		require.Equal(t, "success", first.Body.String(), first.Body.String())
		expectedQuota := int(2 * common.QuotaPerUnit)
		require.Equal(t, expectedQuota, secNegReloadQuota(t, db, user.Id), "first callback must credit exactly once")

		replay := httptest.NewRecorder()
		epayRouter.ServeHTTP(replay, request)
		assert.Equal(t, "success", replay.Body.String(), "replay must be idempotently acknowledged")
		assert.Equal(t, expectedQuota, secNegReloadQuota(t, db, user.Id), "replay must not double-credit")
		assert.Equal(t, common.TopUpStatusSuccess, secNegReloadOrderStatus(t, db, order.TradeNo))
		secNegPassOrFail(t, "n07", "replayed notification acknowledged but credited exactly once (DB balance asserted)")
	})

	t.Run("n08_duplicate_notification", func(t *testing.T) {
		// 同一订单、不同网关流水号的重复通知同样只入账一次。
		user := secNegUser(t, db, "dup")
		order := secNegEpayOrder(t, db, user, "SECNEG-N08-DUP")
		first := httptest.NewRecorder()
		epayRouter.ServeHTTP(first, secNegSignedEpayRequest(order.TradeNo, "10.00", "PROV-N08-A"))
		require.Equal(t, "success", first.Body.String())
		expectedQuota := int(2 * common.QuotaPerUnit)
		require.Equal(t, expectedQuota, secNegReloadQuota(t, db, user.Id))

		second := httptest.NewRecorder()
		epayRouter.ServeHTTP(second, secNegSignedEpayRequest(order.TradeNo, "10.00", "PROV-N08-B-DIFFERENT-PROVIDER-ID"))
		assert.Equal(t, "success", second.Body.String())
		assert.Equal(t, expectedQuota, secNegReloadQuota(t, db, user.Id), "duplicate notification must not double-credit")
		secNegPassOrFail(t, "n08", "duplicate notification with different provider trade_no -> still one credit")
	})

	t.Run("n09_sql_injection", func(t *testing.T) {
		// 注入 payload 打进审计过滤参数：不得多读他人行、不得泄露 SQL 错误。
		viewer := secNegUser(t, db, "injection")
		other := secNegUser(t, db, "injection-victim")
		for i, owner := range []*model.User{viewer, viewer, other} {
			model.RecordAuditLog(nil, model.AuditLog{
				UserId: owner.Id, Username: owner.Username, ActorRole: common.RoleCommonUser,
				Category: model.AuditCategoryOperation, RequestId: fmt.Sprintf("secneg-clean-%d", i),
			})
		}
		_, viewerJWT := createAccessTokenTestSession(t, viewer.Id, "secneg-injection-session")
		clean := doJSON(http.MethodGet, "/api/audit/self?category=operation", viewerJWT, "")
		require.Equal(t, http.StatusOK, clean.Code, clean.Body.String())
		var cleanResult struct {
			Data struct {
				Total int `json:"total"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(clean.Body.Bytes(), &cleanResult))
		require.Equal(t, 2, cleanResult.Data.Total, "viewer must see exactly their two rows")

		for _, payload := range []string{
			"%' OR '1'='1",
			"secneg-clean-1%' OR '1'='1' --",
			"'; DROP TABLE audit_logs; --",
		} {
			recorder := doJSON(http.MethodGet, "/api/audit/self?category=operation&request_id="+url.QueryEscape(payload), viewerJWT, "")
			require.Equal(t, http.StatusOK, recorder.Code, "payload %q: %s", payload, recorder.Body.String())
			var result struct {
				Success bool `json:"success"`
				Data    struct {
					Total int `json:"total"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
			assert.True(t, result.Success, "payload %q must not error", payload)
			assert.Zero(t, result.Data.Total, "payload %q must not read extra rows", payload)
			assert.NotContains(t, recorder.Body.String(), "sqlite", "payload %q must not leak the database", payload)
		}
		// 注入之后审计表必须完好，干净过滤仍能查到自己的两行。
		after := doJSON(http.MethodGet, "/api/audit/self?category=operation", viewerJWT, "")
		var afterResult struct {
			Data struct {
				Total int `json:"total"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(after.Body.Bytes(), &afterResult))
		assert.Equal(t, 2, afterResult.Data.Total, "audit table must survive injection payloads")
		secNegPassOrFail(t, "n09", "SQL injection payloads in request_id filter read no extra rows, leak nothing")
	})

	t.Run("n10_xss_reflection", func(t *testing.T) {
		// 存储型 payload 经 API 读出必须被 JSON 转义，不得以原始 <script> 反射。
		xssUser := secNegUser(t, db, "xss")
		require.NoError(t, db.Model(xssUser).Update("display_name", `<script>alert(1)</script>`).Error)
		_, xssJWT := createAccessTokenTestSession(t, xssUser.Id, "secneg-xss-session")
		recorder := doJSON(http.MethodGet, "/api/user/self", xssJWT, "")
		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		assert.NotContains(t, recorder.Body.String(), "<script>", "raw script tag must never be reflected")
		assert.Contains(t, recorder.Body.String(), `\u003cscript\u003e`, "payload must be JSON-escaped")
		secNegPassOrFail(t, "n10", "stored XSS payload JSON-escaped, never reflected raw")
	})

	t.Run("n11_sensitive_info_leak", func(t *testing.T) {
		// 各类失败响应都不得携带堆栈、密钥、数据库路径等敏感信息。
		recorder := doJSON(http.MethodGet, "/api/user/self", "", "")
		body := recorder.Body.String()
		assert.Equal(t, http.StatusUnauthorized, recorder.Code)
		recorder = doJSON(http.MethodPost, "/api/user/login", "", "{invalid-json")
		body += recorder.Body.String()
		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Contains(t, body, `"success":false`)
		for _, leak := range []string{"goroutine", "panic:", ".go:", ":memory:", "sqlite", "gorm.io", "whsec_", "AIza", "argon"} {
			assert.NotContains(t, body, leak, "error responses must not leak %q", leak)
		}
		secNegPassOrFail(t, "n11", "401 and malformed-JSON responses leak no stack traces, keys or DB details")
	})

	t.Run("n12_generic_error_messages", func(t *testing.T) {
		// 失败响应只允许通用文案：不得暴露查询、表名或内部实现细节。
		recorder := doJSON(http.MethodGet, "/api/user/", normalJWT, "")
		assert.Equal(t, http.StatusForbidden, recorder.Code)
		message := recorder.Body.String()
		assert.Contains(t, message, "Unauthorized, insufficient privileges")
		for _, detail := range []string{"SELECT", "INSERT", "users", "audit_logs", "constraint", "SQL", "session_id"} {
			assert.NotContains(t, message, detail, "403 response must not leak %q", detail)
		}
		secNegPassOrFail(t, "n12", "403 response is generic, no internal query/table/constraint details")
	})

	t.Run("n13_rate_limit", func(t *testing.T) {
		// CriticalRateLimit 在进程内可达：超过配额的第 4 个请求必须 429。
		prevEnable := common.CriticalRateLimitEnable
		prevNum := common.CriticalRateLimitNum
		prevDuration := common.CriticalRateLimitDuration
		common.CriticalRateLimitEnable = true
		common.CriticalRateLimitNum = 3
		common.CriticalRateLimitDuration = 60
		t.Cleanup(func() {
			common.CriticalRateLimitEnable = prevEnable
			common.CriticalRateLimitNum = prevNum
			common.CriticalRateLimitDuration = prevDuration
		})
		limited := gin.New()
		limited.GET("/neg/rate-limited", middleware.CriticalRateLimit(), middleware.UserAuth(), GetSelf)
		hitLimited := func() *httptest.ResponseRecorder {
			request := httptest.NewRequest(http.MethodGet, "/neg/rate-limited", nil)
			request.Header.Set("Authorization", "Bearer "+normalJWT)
			request.RemoteAddr = "203.0.113.99:45678" // 独占 IP，避免与其他测试共用计数桶
			recorder := httptest.NewRecorder()
			limited.ServeHTTP(recorder, request)
			return recorder
		}
		for i := 0; i < 3; i++ {
			recorder := hitLimited()
			assert.Equal(t, http.StatusOK, recorder.Code, "request %d within quota must pass", i+1)
		}
		exceeded := hitLimited()
		assert.Equal(t, http.StatusTooManyRequests, exceeded.Code, "request beyond quota must be 429")
		assert.NotEqual(t, "", exceeded.Header().Get("Retry-After"), "429 must carry a Retry-After hint")
		secNegPassOrFail(t, "n13", "CriticalRateLimit: 3 allowed then 429 with Retry-After")
	})

	t.Run("n14_concurrent_duplicate_requests", func(t *testing.T) {
		// 并发重复回调（网关重试风暴的模型）必须恰好入账一次。
		user := secNegUser(t, db, "concurrent")
		order := secNegEpayOrder(t, db, user, "SECNEG-N14-CONCURRENT")
		// 注意：http.Request 的表单体只能被 ParseForm 消费一次，因此每个并发
		// 请求都要各自构造全新的 Request，重放才是真实的网关重试语义。
		requestFor := func() *http.Request { return secNegSignedEpayRequest(order.TradeNo, "10.00", "PROV-N14") }
		const concurrency = 8
		start := make(chan struct{})
		recorders := make(chan *httptest.ResponseRecorder, concurrency)
		for range concurrency {
			go func() {
				<-start
				recorder := httptest.NewRecorder()
				epayRouter.ServeHTTP(recorder, requestFor())
				recorders <- recorder
			}()
		}
		close(start)
		successCount := 0
		for range concurrency {
			recorder := <-recorders
			if recorder.Body.String() == "success" {
				successCount++
			}
		}
		expectedQuota := int(2 * common.QuotaPerUnit)
		assert.Equal(t, expectedQuota, secNegReloadQuota(t, db, user.Id),
			"concurrent duplicate callbacks must credit exactly once (got %d, want %d)", secNegReloadQuota(t, db, user.Id), expectedQuota)
		assert.Equal(t, common.TopUpStatusSuccess, secNegReloadOrderStatus(t, db, order.TradeNo))
		assert.Positive(t, successCount, "at least one concurrent callback must be acknowledged")
		secNegPassOrFail(t, "n14", "8 concurrent duplicate callbacks -> exactly one credit (DB balance asserted)")
	})

	t.Run("n15_balance_tampering", func(t *testing.T) {
		// 客户端提交的 quota 字段绝不能改库：余额字段在自助更新里被 Omit。
		require.NoError(t, db.Model(normalUser).Update("quota", 1234).Error)
		recorder := doJSON(http.MethodPut, "/api/user/self", normalJWT, `{"quota":999999,"display_name":"tamper-check"}`)
		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		assert.Contains(t, recorder.Body.String(), `"success":true`)
		assert.Equal(t, 1234, secNegReloadQuota(t, db, normalUser.Id), "client-supplied quota must not alter stored balance")
		var refreshed model.User
		require.NoError(t, db.Where("id = ?", normalUser.Id).First(&refreshed).Error)
		assert.Equal(t, "tamper-check", refreshed.DisplayName, "the request itself must have been applied (proves the update path ran)")
		secNegPassOrFail(t, "n15", "PUT /api/user/self with quota=999999 leaves stored quota untouched")
	})

	t.Run("n16_order_amount_tampering", func(t *testing.T) {
		// 签名合法但金额与本地订单不符（经典 0.01 攻付）必须拒绝入账。
		user := secNegUser(t, db, "amount")
		order := secNegEpayOrder(t, db, user, "SECNEG-N16-AMOUNT")
		recorder := httptest.NewRecorder()
		epayRouter.ServeHTTP(recorder, secNegSignedEpayRequest(order.TradeNo, "0.01", "PROV-N16"))
		assert.Equal(t, "fail", recorder.Body.String(), "paid amount 0.01 vs order 10.00 must be rejected")
		assert.Equal(t, common.TopUpStatusPending, secNegReloadOrderStatus(t, db, order.TradeNo))
		assert.Equal(t, 0, secNegReloadQuota(t, db, user.Id), "amount-mismatched callback must not credit quota")
		// 多付同样拒绝，防止「多付多充」绕过金额口径。
		overpaid := httptest.NewRecorder()
		epayRouter.ServeHTTP(overpaid, secNegSignedEpayRequest(order.TradeNo, "100.00", "PROV-N16"))
		assert.Equal(t, "fail", overpaid.Body.String(), "overpaid amount must also be rejected")
		assert.Equal(t, 0, secNegReloadQuota(t, db, user.Id))
		secNegPassOrFail(t, "n16", "valid signature + ProviderAmount 0.01/100.00 vs order 10.00 -> rejected, no credit")
	})

	t.Run("n17_refund_permission", func(t *testing.T) {
		// 本代码库没有面向用户的退款 HTTP 端点；退款全部经 model.RefundIntent
		// 由系统内部执行，且意图的 UserId 就是退款归属的硬约束：
		// refundSubscriptionPreConsumeForUserTx 拒绝把别人的预扣记录退给本意图。
		// 这里对真实退款执行器做「退别人」负向攻击：
		owner := secNegUser(t, db, "refund-owner")
		require.NoError(t, db.Create(&model.UserSubscription{
			UserId: owner.Id, PlanId: 1, AmountTotal: 1000, AmountUsed: 500,
			Status: "active", StartTime: common.GetTimestamp(), EndTime: common.GetTimestamp() + 86400,
		}).Error)
		var ownerSubscription model.UserSubscription
		require.NoError(t, db.Where("user_id = ?", owner.Id).First(&ownerSubscription).Error)
		requestId := "secneg-refund-req-owner"
		require.NoError(t, db.Create(&model.SubscriptionPreConsumeRecord{
			RequestId: requestId, UserId: owner.Id, UserSubscriptionId: ownerSubscription.Id,
			PreConsumed: 500, Status: "consumed",
		}).Error)

		attacker := secNegUser(t, db, "refund-attacker")
		// 攻击：把指向 owner 预扣记录的退款意图挂在 attacker 名下。
		hostile := &model.RefundIntent{
			IdempotencyKey: "secneg-refund-hostile", UserId: attacker.Id,
			FundingSource: model.RefundSourceSubscription, SubRequestId: requestId, SubId: ownerSubscription.Id,
		}
		require.NoError(t, model.CreateRefundIntent(hostile))
		err := model.ExecuteRefundIntent(hostile.Id)
		assert.Error(t, err, "a refund intent owned by another user must not refund someone else's pre-consume")
		assert.Contains(t, err.Error(), "belongs to user", "rejection must name the ownership mismatch")
		var hostileIntent model.RefundIntent
		require.NoError(t, db.Where("id = ?", hostile.Id).First(&hostileIntent).Error)
		assert.Equal(t, model.RefundIntentPending, hostileIntent.Status, "rejected intent must stay pending")
		var untouched model.UserSubscription
		require.NoError(t, db.Where("id = ?", ownerSubscription.Id).First(&untouched).Error)
		assert.Equal(t, int64(500), untouched.AmountUsed, "owner's pre-consumed quota must be untouched")

		// 对照组：把同一笔预扣退回它真正的主人必须成功，证明拒绝来自归属校验
		// 而非退款通道损坏。
		legit := &model.RefundIntent{
			IdempotencyKey: "secneg-refund-legit", UserId: owner.Id,
			FundingSource: model.RefundSourceSubscription, SubRequestId: requestId, SubId: ownerSubscription.Id,
		}
		require.NoError(t, model.CreateRefundIntent(legit))
		require.NoError(t, model.ExecuteRefundIntent(legit.Id))
		var refunded model.UserSubscription
		require.NoError(t, db.Where("id = ?", ownerSubscription.Id).First(&refunded).Error)
		assert.Equal(t, int64(0), refunded.AmountUsed, "the owner's own refund must go through")
		secNegPassOrFail(t, "n17", "refund intent bound to its owner: cross-user refund rejected, owner refund succeeds")
	})

	t.Run("n18_admin_boundary", func(t *testing.T) {
		// 管理员访问仅超管的路由（RootAuth 守卫的 /api/option）必须 403。
		adminUser := &model.User{
			Username: "secneg_admin", AffCode: "secnegadmin", Role: common.RoleAdminUser,
			Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
		}
		require.NoError(t, db.Create(adminUser).Error)
		_, adminJWT := createAccessTokenTestSession(t, adminUser.Id, "secneg-admin-session")
		recorder := doJSON(http.MethodGet, "/api/option", adminJWT, "")
		assert.Equal(t, http.StatusForbidden, recorder.Code, recorder.Body.String())
		assert.Contains(t, recorder.Body.String(), "AUTH_INSUFFICIENT_PRIVILEGE")
		assert.NotContains(t, recorder.Body.String(), "EpayKey", "option values must never leak to a non-root caller")
		secNegPassOrFail(t, "n18", "admin -> RootAuth-guarded GET /api/option -> 403")
	})

	t.Run("n19_csrf", func(t *testing.T) {
		// 应用同时使用两层 CSRF 防线：SessionCookieOriginGuard 校验跨站 Origin，
		// 刷新 Cookie 为 SameSite=Strict + HttpOnly。两者都可以在进程内断言。
		csrf := gin.New()
		csrf.Use(middleware.SessionCookieOriginGuard())
		csrf.GET("/api/user/self", middleware.UserAuth(), GetSelf)
		requestWithOrigin := func(origin string) *httptest.ResponseRecorder {
			request := httptest.NewRequest(http.MethodGet, "/api/user/self", nil)
			request.Header.Set("Authorization", "Bearer "+normalJWT)
			if origin != "" {
				request.Header.Set("Origin", origin)
			}
			recorder := httptest.NewRecorder()
			csrf.ServeHTTP(recorder, request)
			return recorder
		}
		crossSite := requestWithOrigin("https://evil.attacker.example")
		assert.Equal(t, http.StatusForbidden, crossSite.Code, crossSite.Body.String())
		assert.Contains(t, crossSite.Body.String(), "AUTH_ORIGIN_FORBIDDEN")
		sameSite := requestWithOrigin("http://example.com") // httptest 默认 Host
		assert.Equal(t, http.StatusOK, sameSite.Code, sameSite.Body.String())
		programmatic := requestWithOrigin("")
		assert.Equal(t, http.StatusOK, programmatic.Code, programmatic.Body.String())

		cookie := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(cookie)
		service.ClearRefreshCookie(c)
		setCookie := cookie.Header().Get("Set-Cookie")
		assert.Contains(t, setCookie, "HttpOnly")
		assert.Contains(t, setCookie, "SameSite=Strict")
		assert.Contains(t, setCookie, "Path=/api/user/auth")
		secNegPassOrFail(t, "n19", "cross-site Origin -> 403 AUTH_ORIGIN_FORBIDDEN; refresh cookie is HttpOnly SameSite=Strict")
	})

	t.Run("summary", func(t *testing.T) {
		secNegResultsMu.Lock()
		defer secNegResultsMu.Unlock()
		for _, id := range secNegOrder {
			status, ok := secNegResults[id]
			if !ok {
				status = "NOT_RUN"
				secNegResults[id] = status
				secNegDetails[id] = "subtest did not record a result"
			}
			t.Logf("NEG %s %s %s", id, status, secNegDetails[id])
		}
	})
}

// secNegSignedEpayRequestWithKey 用指定密钥签一笔回调（供「用错密钥」变体使用）。
func secNegSignedEpayRequestWithKey(tradeNo, paidMoney, providerTradeNo, key string) *http.Request {
	params := secNegEpayParams(tradeNo, paidMoney, providerTradeNo)
	params["sign"] = secNegEpaySign(params, key)
	params["sign_type"] = "MD5"
	return secNegEpayForm(params)
}
