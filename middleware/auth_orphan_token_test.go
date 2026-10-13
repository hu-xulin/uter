package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupOrphanTokenTest 建一个内存库，只含 tokens 表而【不含】对应用户 —— 复现
// 「用户被硬删除、token 成为孤儿」的真实状态。
func setupOrphanTokenTest(t *testing.T, tokenKey string, userId int) {
	t.Helper()
	previousDB := model.DB
	previousType := common.MainDatabaseType()
	previousRedis := common.RedisEnabled

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	// users 表要建出来但是【空的】：真实场景是用户行已被硬删除，查询能正常执行、
	// 只是查不到记录（gorm.ErrRecordNotFound）。若连表都不建，报的是
	// "no such table"，那是另一种故障，会让测试失去意义。
	require.NoError(t, db.AutoMigrate(&model.Token{}, &model.User{}))
	var userCount int64
	require.NoError(t, db.Model(&model.User{}).Count(&userCount).Error)
	require.Zero(t, userCount, "users 表必须是空的，才能复现「用户被硬删除」")
	// 故意不建users 行：token.user_id 指向一个不存在的用户。
	// Key 必须与请求头里的 sk-<key> 一致，否则会先在token 查找阶段就404，
	// 走不到「token 有效但用户已删除」这条目标路径。
	require.NoError(t, db.Create(&model.Token{
		UserId:         userId,
		Key:            tokenKey,
		Name:           "orphan-token",
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    -1,
		UnlimitedQuota: true, // 否则 RemainQuota<=0 会在 ValidateUserToken 里先被判 invalid
		CreatedTime:    1700000000,
		AccessedTime:   0,
	}).Error)

	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	// commonKeyCol 等方言引用的列名由 InitColumnNames 初始化；测试直接赋值 DB 时
	// 不会走 InitDB，不调用会让 GetTokenByKey 拼出 `WHERE  = ?` 的残缺 SQL。
	model.InitColumnNames()
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousType)
		common.RedisEnabled = previousRedis
	})

	// 确认 token 本身可被查到（失败点必须只在它的用户上，否则测的是另一条路径）。
	found, err := model.ValidateUserToken(tokenKey)
	require.NoError(t, err, "token 本身必须有效，才能证明失败点在用户缺失")
	require.Equal(t, userId, found.UserId)
}

func runTokenAuthRequest(t *testing.T, tokenKey string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/v1/chat/completions", TokenAuth(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	req.Header.Set("Authorization", "Bearer sk-"+tokenKey)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	return recorder
}

// TestTokenAuthOrphanedTokenReturnsUnauthorized 锁定「孤儿 token」的状态码。
//
// 用户被硬删除后 token 仍在库里（无外键级联删除），GetUserCache 会返回
// gorm.ErrRecordNotFound。这不是数据库故障，而是「这条 token 永远不可能通过认证」，
// 必须回401 Invalid token。
//
// 修复前返回 500 "We hit a database problem"，后果有三：
//   - 客户端按 5xx 策略无谓重试，永远失败；
//   - 监控里出现假的数据库故障告警，掩盖真实问题；
//   - 500 与 401 的差异会让调用方误以为该联系管理员。
func TestTokenAuthOrphanedTokenReturnsUnauthorized(t *testing.T) {
	// key 里不能带 "-"：TokenAuth 解析 Authorization 时会按 "-" 切分并只取第一段
	// （见 auth.go 里 parts := strings.Split(key, "-"); key = parts[0]），
	// 带横线会导致查的根本不是我们种下的那条 token，测试就会假通过。
	setupOrphanTokenTest(t, "orphantokenkeykey", 4242)

	recorder := runTokenAuthRequest(t, "orphantokenkeykey")

	assert.Equal(t, http.StatusUnauthorized, recorder.Code,
		"孤儿 token（用户已被硬删除）必须回 401，而不是 500 数据库错误")
	assert.NotContains(t, recorder.Body.String(), "database problem",
		"响应文案不得把孤儿 token 描述成数据库故障")
}
