/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/

package controller

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/bytedance/gopkg/util/gopool"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

const (
	// alipayReconcileTickInterval 对账周期。
	// 1 分钟是「用户几乎无感」与「不把网关查单接口打满」之间的折中：配合下面的
	// 20 分钟窗口，单笔订单最多被查 20 次，代价可控。
	alipayReconcileTickInterval = 1 * time.Minute
	// alipayReconcileWindow 只对账这段时间内创建的订单。
	// 窗口是必需的：没有窗口就会对历史 pending 订单反复查单，既浪费网关配额，
	// 也会让早已放弃的订单永远被扫到。窗口外的订单仍可由用户在钱包页主动查单确认。
	alipayReconcileWindow = 20 * time.Minute
	// alipayReconcileBatchSize 单轮最多核对多少笔，防止一次 tick 打爆网关。
	// 配合 Order("id desc")：新订单优先被处理，历史堆积不会挤掉刚付款的订单。
	alipayReconcileBatchSize = 30
	// alipayReconcileCaller 对账入账时写进操作日志的调用方标识，
	// 便于把「用户主动查单入账」与「后台对账入账」区分开。
	alipayReconcileCaller = "reconcile"
	// readReconcileWindow 打开充值记录时，把这段时间内创建的待确认订单向网关核一遍。
	// 原本复用 alipayReconcileWindow（20 分钟），导致「异步回调丢失 + 未走回跳查单」
	// 的订单一旦超过 20 分钟就再也救不回来——后台任务与读时对账都不会再碰它。
	// 改成 1 天：用户在钱包页看到历史待确认订单时，系统仍会主动查单并补齐，
	// 不会让一笔已付款的订单永久停在「待确认」。后台周期任务仍用 20 分钟窗口，
	// 只负责「刚付款的热订单」，两者职责分离。
	readReconcileWindow = 24 * time.Hour
	// alipayReadReconcileLimit 打开充值记录时最多补查几笔，避免拖慢列表。
	// 随 readReconcileWindow 一起放大：1 天窗口内的待确认订单要能一次补齐，
	// 否则超出上限的订单要等用户再次打开记录才会被补查。
	alipayReadReconcileLimit = 10
	// alipayReadReconcileTimeout 读时对账的整体超时。网关抖动时必须让列表先返回，
	// 宁可这一次显示旧状态，也不能让钱包页一直转圈。
	alipayReadReconcileTimeout = 2500 * time.Millisecond
)

// reconcileUserPendingAlipayOrders 在返回充值记录前，把该用户近期仍待确认的
// 支付宝订单向网关核一遍。
//
// 为什么不只靠后台任务：后台任务最长要等一个 tick（1 分钟），而用户打开充值
// 记录就是为了看最新状态。读时补一次，用户看到的直接是网关的真实结果，而不是
// 「一分钟前的快照」。没有待确认订单时零开销；有的话最多 alipayReadReconcileLimit
// 笔、整体 alipayReadReconcileTimeout 封顶。窗口已放宽到 readReconcileWindow=1 天，
// 见上方常量说明——这样「已付款但本地仍待确认」的老订单在用户打开记录时也能被救回。
//
// 入账走与主动查单接口完全相同的 applyAlipayQueryResult，幂等由
// model.RechargeAlipay 的状态 CAS 保证，与后台任务、异步回调并存也安全。
func reconcileUserPendingAlipayOrders(ctx context.Context, userId int) {
	if userId <= 0 || !isAlipayTopUpEnabled() {
		return
	}
	createdAfter := time.Now().Add(-readReconcileWindow).Unix()
	topups, err := model.ListPendingTopUpsForReconcile(
		model.PaymentProviderAlipay, userId, createdAfter, alipayReadReconcileLimit)
	if err != nil || len(topups) == 0 {
		return
	}
	queryCtx, cancel := context.WithTimeout(ctx, alipayReadReconcileTimeout)
	defer cancel()
	for _, topUp := range topups {
		if queryCtx.Err() != nil {
			return
		}
		result, queryErr := service.AlipayQueryOrder(queryCtx, topUp.TradeNo)
		if queryErr != nil {
			// 查单失败不影响列表返回：这次先按本地状态展示，后台任务稍后会补。
			logger.LogWarn(ctx, fmt.Sprintf("支付宝读时对账：查单失败 trade_no=%s user_id=%d error=%q",
				topUp.TradeNo, userId, queryErr.Error()))
			continue
		}
		applyAlipayQueryResult(ctx, topUp, result, alipayReconcileCaller)
	}
}

var (
	alipayReconcileOnce    sync.Once
	alipayReconcileRunning atomic.Bool
)

// StartAlipayReconcileTask 启动支付宝订单对账任务。
//
// 解决的问题：订单「已支付但本地仍待确认」只在两种时机才会被纠正——异步回调
// 到达，或用户从收银台回跳后前端主动查单。可这两条路都会断：
//   - notify_url 在本地 / 内网环境不可达（本地指向 localhost，回调永远打不到）
//   - 用户付款后直接关掉页面、换设备、或在支付宝 APP 内完成付款，根本不会回跳
//
// 一旦同时断掉，订单就永久停在 pending。本任务按固定周期主动向网关查单，
// 把漏掉的状态补上，不再依赖浏览器是否回来。
func StartAlipayReconcileTask() {
	alipayReconcileOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			ctx := context.Background()
			logger.LogInfo(ctx, fmt.Sprintf("支付宝订单对账任务启动 tick=%s window=%s batch=%d",
				alipayReconcileTickInterval, alipayReconcileWindow, alipayReconcileBatchSize))
			ticker := time.NewTicker(alipayReconcileTickInterval)
			defer ticker.Stop()

			// 启动即补一轮：覆盖「付款发生在服务重启期间」的订单。
			RunAlipayReconcileOnce(ctx)
			for range ticker.C {
				RunAlipayReconcileOnce(ctx)
			}
		})
	})
}

// RunAlipayReconcileOnce 执行一轮支付宝订单对账，返回本轮成功入账的订单数。
//
// 单飞保护：上一轮还没跑完时直接跳过本轮，避免慢网关把 goroutine 堆积起来。
// 入账与主动查单接口走同一条 applyAlipayQueryResult 路径，幂等由
// model.RechargeAlipay 的状态 CAS 保证，重复执行不会重复加额度。
func RunAlipayReconcileOnce(ctx context.Context) int {
	if ctx == nil {
		ctx = context.Background()
	}
	if !alipayReconcileRunning.CompareAndSwap(false, true) {
		return 0
	}
	defer alipayReconcileRunning.Store(false)

	if !isAlipayTopUpEnabled() {
		return 0
	}

	createdAfter := time.Now().Add(-alipayReconcileWindow).Unix()
	topups, err := model.ListPendingTopUpsForReconcile(
		model.PaymentProviderAlipay, 0, createdAfter, alipayReconcileBatchSize)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("支付宝订单对账：读取待确认订单失败 error=%q", err.Error()))
		return 0
	}
	if len(topups) == 0 {
		return 0
	}

	credited := 0
	failed := 0
	for _, topUp := range topups {
		if ctx.Err() != nil {
			break
		}
		result, queryErr := service.AlipayQueryOrder(ctx, topUp.TradeNo)
		if queryErr != nil {
			failed++
			logger.LogWarn(ctx, fmt.Sprintf("支付宝订单对账：查单失败 trade_no=%s user_id=%d error=%q",
				topUp.TradeNo, topUp.UserId, queryErr.Error()))
			continue
		}
		// pending / unpaid / closed 都是正常结论，不记告警：用户没付款是常态，
		// 每轮都给未付款订单打日志只会把真正的故障淹掉。
		if applyAlipayQueryResult(ctx, topUp, result, alipayReconcileCaller) == AlipayReconcileSuccess {
			credited++
		}
	}
	if credited > 0 || failed > 0 {
		logger.LogInfo(ctx, fmt.Sprintf("支付宝订单对账完成 scanned=%d credited=%d query_failed=%d",
			len(topups), credited, failed))
	}
	return credited
}

// ============================================================================
// 微信支付订单对账（与支付宝对账同策略、同窗口、同入账路径）
// ============================================================================

var (
	wechatReconcileOnce    sync.Once
	wechatReconcileRunning atomic.Bool
)

// StartWechatReconcileTask 启动微信支付订单对账任务。
//
// 解决的问题与支付宝完全一致：订单「已支付但本地仍待确认」只在两种时机被纠正——
// 异步回调到达，或用户从收银台回跳后前端主动查单。两条路都会断（回调在本地/内网
// 不可达、用户付款后关页）时，订单永久停在 pending。本任务按固定周期主动向微信支付
// 查单，把漏掉的状态补上。
//
// 复用支付宝对账的节拍（1 分钟 tick / 20 分钟窗口 / 30 笔批量）与入账路径
// （applyWechatQueryResult → RechargeWechatPay 的 CAS 幂等），保证两渠道行为一致。
func StartWechatReconcileTask() {
	wechatReconcileOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			ctx := context.Background()
			logger.LogInfo(ctx, fmt.Sprintf("微信支付订单对账任务启动 tick=%s window=%s batch=%d",
				alipayReconcileTickInterval, alipayReconcileWindow, alipayReconcileBatchSize))
			ticker := time.NewTicker(alipayReconcileTickInterval)
			defer ticker.Stop()

			RunWechatReconcileOnce(ctx)
			for range ticker.C {
				RunWechatReconcileOnce(ctx)
			}
		})
	})
}

// RunWechatReconcileOnce 执行一轮微信支付订单对账，返回本轮成功入账的订单数。
//
// 单飞保护：上一轮还没跑完时直接跳过本轮，避免慢网关把 goroutine 堆积起来。
// 入账与主动查单接口走同一条 applyWechatQueryResult 路径，幂等由
// model.RechargeWechatPay 的状态 CAS 保证，重复执行不会重复加额度。
func RunWechatReconcileOnce(ctx context.Context) int {
	if ctx == nil {
		ctx = context.Background()
	}
	if !wechatReconcileRunning.CompareAndSwap(false, true) {
		return 0
	}
	defer wechatReconcileRunning.Store(false)

	if !isWechatPayTopUpEnabled() {
		return 0
	}

	createdAfter := time.Now().Add(-alipayReconcileWindow).Unix()
	topups, err := model.ListPendingTopUpsForReconcile(
		model.PaymentProviderWechatPay, 0, createdAfter, alipayReconcileBatchSize)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("微信支付订单对账：读取待确认订单失败 error=%q", err.Error()))
		return 0
	}
	if len(topups) == 0 {
		return 0
	}

	credited := 0
	failed := 0
	for _, topUp := range topups {
		if ctx.Err() != nil {
			break
		}
		result, queryErr := service.WechatQueryOrder(ctx, topUp.TradeNo)
		if queryErr != nil {
			failed++
			logger.LogWarn(ctx, fmt.Sprintf("微信支付订单对账：查单失败 trade_no=%s user_id=%d error=%q",
				topUp.TradeNo, topUp.UserId, queryErr.Error()))
			continue
		}
		// pending / unpaid / closed 都是正常结论，不记告警：用户没付款是常态。
		if applyWechatQueryResult(ctx, topUp, result, alipayReconcileCaller) == WechatReconcileSuccess {
			credited++
		}
	}
	if credited > 0 || failed > 0 {
		logger.LogInfo(ctx, fmt.Sprintf("微信支付订单对账完成 scanned=%d credited=%d query_failed=%d",
			len(topups), credited, failed))
	}
	return credited
}

// reconcileUserPendingWechatOrders 在返回充值记录前，把该用户近期仍待确认的
// 微信支付订单向网关核一遍（与支付宝读时对账对称）。
//
// 后台任务最长要等一个 tick（1 分钟），而用户打开充值记录就是为了看最新状态。
// 读时补一次，用户看到的直接是网关的真实结果。没有待确认订单时零开销；有的话
// 最多 alipayReadReconcileLimit 笔、整体 alipayReadReconcileTimeout 封顶
// （窗口已放宽到 readReconcileWindow=1 天，见上方常量说明）。
func reconcileUserPendingWechatOrders(ctx context.Context, userId int) {
	if userId <= 0 || !isWechatPayTopUpEnabled() {
		return
	}
	createdAfter := time.Now().Add(-readReconcileWindow).Unix()
	topups, err := model.ListPendingTopUpsForReconcile(
		model.PaymentProviderWechatPay, userId, createdAfter, alipayReadReconcileLimit)
	if err != nil || len(topups) == 0 {
		return
	}
	queryCtx, cancel := context.WithTimeout(ctx, alipayReadReconcileTimeout)
	defer cancel()
	for _, topUp := range topups {
		if queryCtx.Err() != nil {
			return
		}
		result, queryErr := service.WechatQueryOrder(queryCtx, topUp.TradeNo)
		if queryErr != nil {
			logger.LogWarn(ctx, fmt.Sprintf("微信支付读时对账：查单失败 trade_no=%s user_id=%d error=%q",
				topUp.TradeNo, userId, queryErr.Error()))
			continue
		}
		applyWechatQueryResult(ctx, topUp, result, alipayReconcileCaller)
	}
}
