package e2e

import (
	"net/http"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/Uter-AI/Uter/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// 组织 + 用户计费端到端
// ---------------------------------------------------------------------------
//
// 一次 relay 的固定代价（上游返回 10000 prompt / 5000 completion，倍率 1、
// 完成倍率 4）：预扣 500，实际结算 30000。
//
// 覆盖的不变量：
//  1. 谁出钱：组织成员走组织共享钱包，个人钱包不动；平台直管用户走个人钱包。
//  2. 账本一致：组织 used_quota 增量 == 日志 quota 汇总（不许多扣也不许少扣）。
//  3. 预算硬上限：组织预算耗尽后拒绝，且 used_quota 不得被推过 quota。
//  4. 成员子额度上限：设了上限的成员，实际消耗不得突破上限。
//  5. 停用组织：停用后成员一律不得消耗组织预算。
//  6. 失败退款：上游报错时组织账本必须回到调用前。
//  7. 并发安全：并发调用后账本增量仍等于日志汇总，且不超预算。

// newBillingEnv 装配一个带上游与渠道的计费测试环境。
func newBillingEnv(t *testing.T) *orgPlatformEnv {
	t.Helper()
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)
	server := env.upstreamServer(t)
	env.seedChannel(t, server.URL)
	return env
}

// TestOrgBillingMemberConsumesSharedWallet 组织成员消耗组织共享钱包，个人钱包不动。
func TestOrgBillingMemberConsumesSharedWallet(t *testing.T) {
	env := newBillingEnv(t)
	key := env.createToken(t, "m1", "m1-key")

	before := env.orgUsed(t, env.orgId())
	recorder := env.relay(t, key)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())

	after := env.orgUsed(t, env.orgId())
	delta := after - before
	assert.Equal(t, int64(30000), delta, "组织账本应记一整笔实际消耗")
	assert.Equal(t, int64(delta), int64(env.sumLogQuota(t, env.uid("m1"))),
		"组织账本增量必须等于日志汇总")

	// 个人钱包：属于组织时出资方是组织，个人余额与已用都不应被扣。
	m1 := env.reloadUser(t, "m1")
	assert.Equal(t, 0, m1.Quota, "组织成员的个人钱包不应被扣")
	assert.Equal(t, 30000, m1.UsedQuota, "成员用量应记账以便子额度/统计生效")
}

// TestOrgBillingPlatformUserConsumesOwnWallet 平台直管用户消耗自己的钱包。
func TestOrgBillingPlatformUserConsumesOwnWallet(t *testing.T) {
	env := newBillingEnv(t)
	env.setUserQuota(t, "outsider", 100000)
	key := env.createToken(t, "outsider", "out-key")

	recorder := env.relay(t, key)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())

	out := env.reloadUser(t, "outsider")
	assert.Equal(t, 70000, out.Quota, "平台直管用户应从个人钱包扣 30000")
	assert.Equal(t, int64(0), env.orgUsed(t, env.orgId()), "不应动到任何组织预算")
}

// TestOrgBillingBudgetExhausted 组织预算耗尽后必须拒绝，且账本与日志始终对账一致。
//
// 预算 40000、单笔实耗 30000：前两笔会被准入放行（预扣额远小于实耗，这是既有
// 定价行为），第二笔把账本推到 60000 形成一次有界的超支；此后 used_quota 已越过
// 预算，准入闸门必须一律拒绝——绝不能出现「账本不动却持续放行」的白嫖。
func TestOrgBillingBudgetExhausted(t *testing.T) {
	env := newBillingEnv(t)
	env.setOrgQuota(t, env.orgId(), 40000)
	key := env.createToken(t, "m1", "m1-key")

	for i := 0; i < 2; i++ {
		recorder := env.relay(t, key)
		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		// 每一笔之后，账本都必须等于日志汇总（不许多扣也不许少扣）
		require.Equal(t, env.orgUsed(t, env.orgId()),
			int64(env.sumLogQuota(t, env.uid("m1"))), "第 %d 笔后账本与日志脱节", i+1)
	}

	blocked := env.relay(t, key)
	require.NotEqual(t, http.StatusOK, blocked.Code, "预算耗尽后必须拒绝：%s", blocked.Body.String())

	assert.Equal(t, int64(60000), env.orgUsed(t, env.orgId()), "被拒的请求不得改变账本")
	assert.Equal(t, int64(60000), int64(env.sumLogQuota(t, env.uid("m1"))), "被拒的请求不得记消费日志")
}

// TestOrgBillingMemberSubQuotaLimit 成员子额度上限必须真正拦住后续消耗。
//
// 上限 20000、单笔实耗 30000：第一笔会被放行（预扣额只有 500），结算后
// used_quota=30000 越过上限；第二笔必须被拒。若子额度上限形同虚设，成员即可
// 无视上限无限消耗组织预算。
func TestOrgBillingMemberSubQuotaLimit(t *testing.T) {
	env := newBillingEnv(t)
	env.setSubQuota(t, "m1", 20000)
	key := env.createToken(t, "m1", "m1-key")

	first := env.relay(t, key)
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())

	blocked := env.relay(t, key)
	require.NotEqual(t, http.StatusOK, blocked.Code, "子额度用尽后必须拒绝：%s", blocked.Body.String())
	assert.Equal(t, 30000, env.reloadUser(t, "m1").UsedQuota, "被拒的请求不得再记账")
}

// TestOrgBillingSubQuotaBlocksNextCall 子额度用尽后，该成员被拒而其他成员不受影响。
func TestOrgBillingSubQuotaBlocksNextCall(t *testing.T) {
	env := newBillingEnv(t)
	// 上限 60000 容纳两次完整调用（30000×2），第三次必被卡住。
	env.setSubQuota(t, "m1", 60000)
	keyM1 := env.createToken(t, "m1", "m1-key")
	keyM2 := env.createToken(t, "m2", "m2-key")

	for i := 0; i < 2; i++ {
		recorder := env.relay(t, keyM1)
		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	}
	require.Equal(t, 60000, env.reloadUser(t, "m1").UsedQuota)

	blocked := env.relay(t, keyM1)
	require.NotEqual(t, http.StatusOK, blocked.Code, "子额度用尽后必须拒绝：%s", blocked.Body.String())
	assert.Equal(t, 60000, env.reloadUser(t, "m1").UsedQuota, "被拒的请求不得记账")

	// 同组织另一名未设上限的成员不受影响
	ok := env.relay(t, keyM2)
	require.Equal(t, http.StatusOK, ok.Code, ok.Body.String())
	assert.Equal(t, 30000, env.reloadUser(t, "m2").UsedQuota)
}

// TestOrgBillingSuspendedOrg 组织停用后成员一律不得消耗组织预算。
func TestOrgBillingSuspendedOrg(t *testing.T) {
	env := newBillingEnv(t)
	key := env.createToken(t, "m1", "m1-key")
	require.Equal(t, http.StatusOK, env.relay(t, key).Code)

	env.setOrgStatus(t, env.orgId(), model.OrgStatusDisabled)
	recorder := env.relay(t, key)
	require.NotEqual(t, http.StatusOK, recorder.Code, "停用组织必须拒绝消耗：%s", recorder.Body.String())
	assert.Equal(t, int64(30000), env.orgUsed(t, env.orgId()), "停用后不得产生新的账本写入")
}

// TestOrgBillingUpstreamFailureRefunds 上游失败时组织账本必须回到调用前。
//
// 退款由 BillingSession.Refund 异步执行（gopool），因此断言需等待收敛。
func TestOrgBillingUpstreamFailureRefunds(t *testing.T) {
	env := newBillingEnv(t)
	key := env.createToken(t, "m1", "m1-key")

	env.setFailure(true)
	recorder := env.relay(t, key)
	require.NotEqual(t, http.StatusOK, recorder.Code, recorder.Body.String())

	require.Eventually(t, func() bool {
		return env.orgUsed(t, env.orgId()) == 0 && env.reloadUser(t, "m1").UsedQuota == 0
	}, 5*time.Second, 100*time.Millisecond, "失败请求必须完整退还预扣")

	assert.Equal(t, int64(0), int64(env.sumLogQuota(t, env.uid("m1"))), "失败不得记消费日志")
}

// TestOrgBillingConcurrentMembers 并发调用下账本增量仍等于日志汇总，且不超预算。
func TestOrgBillingConcurrentMembers(t *testing.T) {
	env := newBillingEnv(t)
	// 预算 150000 只够 5 笔（30000×5），10 笔并发下必然有一部分被拒。
	env.setOrgQuota(t, env.orgId(), 150000)
	env.setSubQuota(t, "m1", 150000)

	key := env.createToken(t, "m1", "m1-key")
	const concurrency = 10

	var wg sync.WaitGroup
	var mu sync.Mutex
	succeeded := 0
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			recorder := env.relay(t, key)
			mu.Lock()
			if recorder.Code == http.StatusOK {
				succeeded++
			}
			mu.Unlock()
		}()
	}
	wg.Wait()

	// 并发下账本必须与日志逐笔对齐：每笔成功调用记且只记一次实际消耗。
	// 修复前组织账本会把突破预算的补扣整笔丢弃——10 笔日志记 300000，账本只收 123000。
	used := env.orgUsed(t, env.orgId())
	assert.Equal(t, succeeded*30000, int(used), "每笔成功调用记且只记一次")
	assert.Equal(t, used, int64(env.sumLogQuota(t, env.uid("m1"))),
		"并发后组织账本增量必须等于日志汇总（成功 %d 笔）", succeeded)
}

// TestOrgBillingExMemberUsesOwnWallet 成员退出组织后改由个人钱包出资。
func TestOrgBillingExMemberUsesOwnWallet(t *testing.T) {
	env := newBillingEnv(t)
	key := env.createToken(t, "m1", "m1-key")

	// 退出组织
	recorder := env.call(t, http.MethodDelete,
		"/api/organization/"+strconv.Itoa(env.orgId())+"/members/"+strconv.Itoa(env.uid("m1")), "root", "")
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.True(t, decodeSuccess(recorder.Body.Bytes()), recorder.Body.String())

	// 个人钱包没钱：应被拒，而不是偷偷走组织预算
	denied := env.relay(t, key)
	require.NotEqual(t, http.StatusOK, denied.Code, "退出组织且个人余额为 0 时必须拒绝：%s", denied.Body.String())
	assert.Equal(t, int64(0), env.orgUsed(t, env.orgId()), "退出后不得再消耗组织预算")

	// 充值后走个人钱包
	env.setUserQuota(t, "m1", 100000)
	ok := env.relay(t, key)
	require.Equal(t, http.StatusOK, ok.Code, ok.Body.String())
	assert.Equal(t, 70000, env.reloadUser(t, "m1").Quota, "应从个人钱包扣 30000")
	assert.Equal(t, int64(0), env.orgUsed(t, env.orgId()), "仍不应动到组织预算")
}
