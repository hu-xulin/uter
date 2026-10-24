package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// /api/setup 首次初始化：一次性约束与并发抢建防护
// ---------------------------------------------------------------------------
//
// 攻击面：该接口匿名可访问，且会创建 Root 账户。桌面形态下后端一旦监听到
// 局域网（旧实现固定 ":"+port），同网段任意设备都可以在首次初始化时抢先
// 创建 Root，接管整个实例。
//
// 这组用例锁死的约束：
//  1. 只能初始化一次——数据库级（初始化标记行主键唯一），不是内存态判断；
//  2. 两个并发请求最多只有一个成功，另一个被明确拒绝；
//  3. 初始化完成后再次请求不能创建、替换或改动 Root；
//  4. 桌面模式只接受本机回环来源的初始化请求。

// newSetupEnv 装配一个只带初始化所需表的内存库，并还原全局量。
func newSetupEnv(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	previousDB, previousLog := model.DB, model.LOG_DB
	previousSetup := constant.Setup
	previousSelfUse := operation_setting.SelfUseModeEnabled
	previousDemo := operation_setting.DemoSiteEnabled

	db, err := gorm.Open(sqlite.Open("file:setup-e2e?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Option{}, &model.Setup{}))
	model.DB, model.LOG_DB = db, db
	model.InitColumnNames()
	constant.Setup = false
	operation_setting.SelfUseModeEnabled = false
	operation_setting.DemoSiteEnabled = false

	t.Cleanup(func() {
		constant.Setup = previousSetup
		operation_setting.SelfUseModeEnabled = previousSelfUse
		operation_setting.DemoSiteEnabled = previousDemo
		model.DB, model.LOG_DB = previousDB, previousLog
		if sqlDB, closeErr := db.DB(); closeErr == nil {
			_ = sqlDB.Close()
		}
	})

	engine := gin.New()
	engine.POST("/api/setup", PostSetup)
	engine.GET("/api/setup", GetSetup)
	return engine
}

func postSetup(t *testing.T, engine *gin.Engine, remoteAddr string, username, password string) *httptest.ResponseRecorder {
	t.Helper()
	body := fmt.Sprintf(`{"username":%q,"password":%q,"confirmPassword":%q,"SelfUseModeEnabled":true,"DemoSiteEnabled":false}`,
		username, password, password)
	req := httptest.NewRequest(http.MethodPost, "/api/setup", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = remoteAddr
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, req)
	return recorder
}

// setupSucceeded 读取平台约定的响应语义：HTTP 200 + success:true。
//
// 平台 API 一律以 200 返回、用 success 字段表达成败（common.ApiErrorT 即如此），
// 因此「被拒绝」必须判 success:false，不能只判 HTTP 状态码。
func setupSucceeded(rec *httptest.ResponseRecorder) bool {
	var result struct {
		Success bool `json:"success"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		return false
	}
	return result.Success
}

func countRootUsers(t *testing.T) int64 {
	t.Helper()
	var count int64
	require.NoError(t, model.DB.Model(&model.User{}).
		Where("role = ?", common.RoleRootUser).Count(&count).Error)
	return count
}

// TestSetupConcurrentInitializationOnlyOneSucceeds 两个并发初始化最多只有一个成功。
//
// 旧实现的闸门是 `if constant.Setup` 这个内存布尔 + `RootUserExists()` 只读查询：
// 两个并发请求都在另一个写入之前读到 false，于是都去创建 Root、都去写 setup 行。
// 修复后初始化标记行的固定主键把「只能一次」变成数据库约束，第二个请求必然
// 收到 ErrSetupAlreadyInitialized。
func TestSetupConcurrentInitializationOnlyOneSucceeds(t *testing.T) {
	// 2 是文档要求的最小并发验证；8 用来确认「固定主键哨兵行」这道闸门
	// 在更高并发下同样只放行一个，而不是恰好靠时序蒙对。
	for _, concurrency := range []int{2, 8} {
		t.Run(fmt.Sprintf("concurrency=%d", concurrency), func(t *testing.T) {
			engine := newSetupEnv(t)
			t.Setenv("SETUP_TOKEN", "")

			var wg sync.WaitGroup
			var mu sync.Mutex
			statuses := make([]int, 0, concurrency)
			succeeded := 0

			for i := 0; i < concurrency; i++ {
				wg.Add(1)
				go func(i int) {
					defer wg.Done()
					rec := postSetup(t, engine, "127.0.0.1:50000",
						fmt.Sprintf("root%d", i), "Kx9$mQ2vLp7#Wt4z")
					mu.Lock()
					statuses = append(statuses, rec.Code)
					if setupSucceeded(rec) {
						succeeded++
					}
					mu.Unlock()
				}(i)
			}
			wg.Wait()

			require.Len(t, statuses, concurrency)
			require.Equal(t, 1, succeeded,
				"并发初始化必须恰好一个请求真正成功，实际成功 %d 个（%v）", succeeded, statuses)
			assert.Equal(t, countRootUsers(t), int64(1),
				"并发初始化必须只创建一个 Root，实际创建了 %d 个", countRootUsers(t))
			assert.NotNil(t, model.GetSetup(), "必须且只能有一条初始化标记")
			assert.Equal(t, model.SetupSingletonID, model.GetSetup().ID,
				"初始化标记必须是固定主键的哨兵行，否则无法用唯一约束守住一次性")

			// 所有请求都返回 HTTP 200（平台约定用 success 字段表达成败），
			// 但只有一个 success:true，其余是「已经初始化」的明确拒绝。
			assert.Equal(t, concurrency, countHTTPStatus(statuses, http.StatusOK),
				"平台约定一律 200 返回；被拒的请求用 success:false 表达")
		})
	}
}

func countHTTPStatus(statuses []int, want int) int {
	n := 0
	for _, s := range statuses {
		if s == want {
			n++
		}
	}
	return n
}

// TestSetupAfterInitializationRefusesAndKeepsRoot 初始化完成后重复请求必须被拒绝，
// 且不得创建、替换或改动 Root 账户。
func TestSetupAfterInitializationRefusesAndKeepsRoot(t *testing.T) {
	engine := newSetupEnv(t)
	t.Setenv("SETUP_TOKEN", "")

	first := postSetup(t, engine, "127.0.0.1:50001", "root", "Kx9$mQ2vLp7#Wt4z")
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	require.True(t, constant.Setup, "首次初始化后内存态必须置位")

	var rootAfterFirst model.User
	require.NoError(t, model.DB.Where("role = ?", common.RoleRootUser).First(&rootAfterFirst).Error)

	// 再来一次：即使带上不同的用户名/密码，也不得替换 Root。
	for i := 0; i < 3; i++ {
		rec := postSetup(t, engine, "127.0.0.1:50002", fmt.Sprintf("attacker%d", i), "An0ther-Passw0rd!")
		assert.False(t, setupSucceeded(rec),
			"第 %d 次重复初始化必须被拒绝：%s", i+1, rec.Body.String())
		assert.Contains(t, rec.Body.String(), "already initialized",
			"拒绝原因必须明确指向「已初始化」，而不是模糊的通用错误")
		assert.Equal(t, int64(1), countRootUsers(t), "重复初始化不得再创建 Root")
	}

	var rootAfterRepeat model.User
	require.NoError(t, model.DB.Where("role = ?", common.RoleRootUser).First(&rootAfterRepeat).Error)
	assert.Equal(t, rootAfterFirst.Id, rootAfterRepeat.Id, "Root 账户不得被替换")
	assert.Equal(t, "root", rootAfterRepeat.Username, "Root 用户名不得被改写")
	assert.Equal(t, rootAfterFirst.Password, rootAfterRepeat.Password, "Root 口令哈希不得被改写")
}

// TestSetupRejectsNonLoopbackInDesktopMode 桌面模式下只接受本机回环来源的初始化。
//
// 注意这里用 RemoteAddr 而不是请求头：实现必须读内核给出的对端地址，
// 不能被 X-Forwarded-For 之类的可伪造头绕过。
func TestSetupRejectsNonLoopbackInDesktopMode(t *testing.T) {
	engine := newSetupEnv(t)
	t.Setenv("SETUP_TOKEN", "")
	t.Setenv(common.DesktopModeEnv, "1")

	remote := postSetup(t, engine, "192.168.1.66:51000", "root", "Kx9$mQ2vLp7#Wt4z")
	assert.False(t, setupSucceeded(remote),
		"桌面模式下局域网来源不得初始化：%s", remote.Body.String())
	assert.Equal(t, int64(0), countRootUsers(t), "被拒的初始化不得创建 Root")
	assert.Nil(t, model.GetSetup(), "被拒的初始化不得留下初始化标记")

	// 伪造 X-Forwarded-For 也不能把非回环伪装成本机
	forged := postSetup(t, engine, "192.168.1.66:51001", "root", "Kx9$mQ2vLp7#Wt4z")
	assert.False(t, setupSucceeded(forged), "伪造转发头不得绕过回环限制")
	assert.Equal(t, int64(0), countRootUsers(t))

	// 本机回环来源正常放行
	local := postSetup(t, engine, "127.0.0.1:51002", "root", "Kx9$mQ2vLp7#Wt4z")
	require.True(t, setupSucceeded(local), local.Body.String())
	assert.Equal(t, int64(1), countRootUsers(t))
}

// TestSetupRejectsWhenTokenMismatch 设置了 SETUP_TOKEN 时必须提供同样的令牌。
func TestSetupRejectsWhenTokenMismatch(t *testing.T) {
	engine := newSetupEnv(t)
	t.Setenv(common.DesktopModeEnv, "")
	t.Setenv("SETUP_TOKEN", "one-time-token-abcdef")

	req := fmt.Sprintf(`{"username":"root","password":%q,"confirmPassword":%q}`, "Kx9$mQ2vLp7#Wt4z", "Kx9$mQ2vLp7#Wt4z")
	request := httptest.NewRequest(http.MethodPost, "/api/setup", bytes.NewReader([]byte(req)))
	request.Header.Set("Content-Type", "application/json")
	request.RemoteAddr = "127.0.0.1:52000"
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	assert.False(t, setupSucceeded(recorder), "缺少初始化令牌必须拒绝")
	assert.Equal(t, int64(0), countRootUsers(t))

	request = httptest.NewRequest(http.MethodPost, "/api/setup", bytes.NewReader([]byte(req)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Setup-Token", "wrong-token")
	request.RemoteAddr = "127.0.0.1:52001"
	recorder = httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	assert.False(t, setupSucceeded(recorder), "错误的初始化令牌必须拒绝")
	assert.Equal(t, int64(0), countRootUsers(t))

	request = httptest.NewRequest(http.MethodPost, "/api/setup", bytes.NewReader([]byte(req)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Setup-Token", "one-time-token-abcdef")
	request.RemoteAddr = "127.0.0.1:52002"
	recorder = httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	require.True(t, setupSucceeded(recorder), recorder.Body.String())
	assert.Equal(t, int64(1), countRootUsers(t))
}

// TestInitializeSystemRollsBackOnRootConflict Root 创建失败必须整体回滚，
// 不得留下「初始化标记已写、Root 却没建」的死局。
func TestInitializeSystemRollsBackOnRootConflict(t *testing.T) {
	engine := newSetupEnv(t)
	t.Setenv("SETUP_TOKEN", "")
	t.Setenv(common.DesktopModeEnv, "")

	// 先占掉目标用户名（不同角色），让 Root 创建撞唯一约束。
	require.NoError(t, model.DB.Create(&model.User{
		Username: "root", Role: common.RoleCommonUser, Status: common.UserStatusEnabled,
	}).Error)

	rec := postSetup(t, engine, "127.0.0.1:53000", "root", "Kx9$mQ2vLp7#Wt4z")
	assert.False(t, setupSucceeded(rec), "Root 创建失败必须拒绝：%s", rec.Body.String())

	assert.Nil(t, model.GetSetup(),
		"Root 创建失败时初始化标记必须一并回滚，否则系统再也无法初始化")
	assert.Equal(t, int64(0), countRootUsers(t))
	assert.False(t, constant.Setup, "初始化失败不得置位内存态")
}

// TestInitializeSystemIsIdempotentAfterCommit 提交成功后重复调用不得改写任何状态。
func TestInitializeSystemIsIdempotentAfterCommit(t *testing.T) {
	newSetupEnv(t)
	t.Setenv("SETUP_TOKEN", "")
	t.Setenv(common.DesktopModeEnv, "")

	params := model.SetupInitParams{
		Version:            common.Version,
		SelfUseModeEnabled: true,
		DemoSiteEnabled:    true,
	}
	require.NoError(t, model.InitializeSystem(params))
	first := model.GetSetup()
	require.NotNil(t, first)

	err := model.InitializeSystem(params)
	assert.ErrorIs(t, err, model.ErrSetupAlreadyInitialized,
		"重复初始化必须被明确拒绝")
	assert.Equal(t, first.InitializedAt, model.GetSetup().InitializedAt,
		"重复初始化不得改写初始化时间")
}
