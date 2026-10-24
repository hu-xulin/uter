package model

import (
	"errors"
	"sync"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"gorm.io/gorm"
)

// createTokenLimitUser 返回一个仅用于令牌上限测试的用户。
func createTokenLimitUser(t *testing.T) User {
	t.Helper()
	user := User{
		Username:    "token-limit-" + common.GetRandomString(6),
		Password:    "unused-password-hash",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
		Quota:       1000,
		AffCode:     "token-limit-" + common.GetRandomString(8),
	}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

func newLimitProbeToken(userId int, suffix string) Token {
	return Token{
		UserId:      userId,
		Name:        "limit-probe-" + suffix,
		Key:         "limit-probe-" + suffix + "-" + common.GetRandomString(6),
		Status:      common.TokenStatusEnabled,
		ExpiredTime: -1,
		RemainQuota: 100,
	}
}

func TestInsertWithinLimitAllowsExactlyUpToCap(t *testing.T) {
	truncateTables(t)

	user := createTokenLimitUser(t)
	const cap = 3

	for i := 0; i < cap; i++ {
		token := newLimitProbeToken(user.Id, "ok")
		require.NoError(t, token.InsertWithinLimit(cap), "第 %d 个令牌应当创建成功", i)
		require.Positive(t, token.Id, "提交后应回填主键")
	}

	rejected := newLimitProbeToken(user.Id, "over")
	err := rejected.InsertWithinLimit(cap)
	require.ErrorIs(t, err, ErrTokenLimitExceeded, "超过上限必须被拒绝")

	// 关键断言：拒绝必须靠事务回滚实现，不能留下孤儿行。
	total, countErr := CountUserTokens(user.Id)
	require.NoError(t, countErr)
	assert.Equal(t, int64(cap), total, "被拒绝的创建不得在表中留下记录")

	var orphan Token
	rowErr := DB.Where("key = ?", rejected.Key).First(&orphan).Error
	assert.Error(t, rowErr, "被拒绝的令牌 key 不应存在于数据库中")
}

func TestInsertWithinLimitRejectsNonPositiveCap(t *testing.T) {
	truncateTables(t)

	user := createTokenLimitUser(t)
	for _, cap := range []int{0, -1, -1000} {
		token := newLimitProbeToken(user.Id, "nonpositive")
		err := token.InsertWithinLimit(cap)
		assert.ErrorIs(t, err, ErrTokenLimitExceeded, "上限 %d 时必须拒绝创建", cap)
	}

	total, countErr := CountUserTokens(user.Id)
	require.NoError(t, countErr)
	assert.Zero(t, total, "非正数上限下不得创建任何令牌")
}

func TestInsertWithinLimitCountsOnlyOwnTokens(t *testing.T) {
	truncateTables(t)

	owner := createTokenLimitUser(t)
	other := createTokenLimitUser(t)

	// 另一个用户已有 5 个令牌，不得占用 owner 的额度。
	for i := 0; i < 5; i++ {
		token := newLimitProbeToken(other.Id, "other")
		require.NoError(t, token.InsertWithinLimit(10))
	}

	const cap = 2
	for i := 0; i < cap; i++ {
		token := newLimitProbeToken(owner.Id, "own")
		require.NoError(t, token.InsertWithinLimit(cap), "他人令牌不得挤占本用户额度")
	}

	rejected := newLimitProbeToken(owner.Id, "own-over")
	assert.ErrorIs(t, rejected.InsertWithinLimit(cap), ErrTokenLimitExceeded)

	ownerTotal, err := CountUserTokens(owner.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(cap), ownerTotal)
}

func TestInsertWithinLimitFreesSlotAfterSoftDelete(t *testing.T) {
	truncateTables(t)

	user := createTokenLimitUser(t)
	const cap = 2

	for i := 0; i < cap; i++ {
		token := newLimitProbeToken(user.Id, "fill")
		require.NoError(t, token.InsertWithinLimit(cap))
	}
	blocked := newLimitProbeToken(user.Id, "blocked")
	require.ErrorIs(t, blocked.InsertWithinLimit(cap), ErrTokenLimitExceeded)

	// 删除一个后应当腾出位置——上限与列表计数必须使用同一套口径
	// （都不含软删除行），否则用户删了令牌却再也建不回来。
	var doomed Token
	require.NoError(t, DB.Where("user_id = ?", user.Id).First(&doomed).Error)
	require.NoError(t, doomed.Delete())

	replacement := newLimitProbeToken(user.Id, "replacement")
	require.NoError(t, replacement.InsertWithinLimit(cap), "删除后应能再次创建")

	total, err := CountUserTokens(user.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(cap), total)
}

func TestInsertWithinLimitConcurrentCreatesCannotExceedCap(t *testing.T) {
	truncateTables(t)

	user := createTokenLimitUser(t)
	const cap = 5
	const attempts = 20

	var (
		wg       sync.WaitGroup
		mu       sync.Mutex
		admitted int
	)
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			token := newLimitProbeToken(user.Id, "burst")
			err := token.InsertWithinLimit(cap)
			if err == nil {
				mu.Lock()
				admitted++
				mu.Unlock()
				return
			}
			// 拒绝必须是可识别的上限错误，不能是静默失败或其他错误。
			if !assert.ErrorIs(t, err, ErrTokenLimitExceeded) {
				return
			}
		}(i)
	}
	wg.Wait()

	assert.Equal(t, cap, admitted, "并发突发下放行数必须恰好等于上限")

	total, err := CountUserTokens(user.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(cap), total, "账本必须与放行数一致，不得留下孤儿行")
}

// TestInsertWithinLimitFailsClosedWhenCountingFails 覆盖清单第十章的
// 「二次检查查询异常时放行」：复核计数失败必须拒绝创建，而不是默认放行。
func TestInsertWithinLimitFailsClosedWhenCountingFails(t *testing.T) {
	truncateTables(t)

	user := createTokenLimitUser(t)

	originalDB := DB
	t.Cleanup(func() { DB = originalDB })

	// 构造一个"插入可用、计数必然失败"的库：在查询回调里注入错误，
	// 精确复现"Create 成功、随后的复核 COUNT 报错"这条路径。
	broken, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, broken.AutoMigrate(&Token{}))
	injected := errors.New("injected token count failure")
	require.NoError(t, broken.Callback().Query().Before("gorm:query").
		Register("token_limit_test:fail_count", func(db *gorm.DB) {
			db.AddError(injected)
		}))
	DB = broken

	token := newLimitProbeToken(user.Id, "broken")
	err = token.InsertWithinLimit(10)

	require.Error(t, err, "复核计数失败必须拒绝创建")
	assert.ErrorIs(t, err, injected, "拒绝原因必须是查询失败本身")
	assert.NotErrorIs(t, err, ErrTokenLimitExceeded, "这不是上限拒绝，而是基础设施故障")

	// 恢复后用正常连接确认没有半提交的行残留。
	DB = originalDB
	total, countErr := CountUserTokens(user.Id)
	require.NoError(t, countErr)
	assert.Zero(t, total, "创建失败不得留下任何记录")
}
