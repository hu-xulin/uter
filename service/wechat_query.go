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

You should have received a copy of the GNU Affero General License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/uter-ai/uter/setting/operation_setting"
)

// WechatQueryResult 是微信支付查单接口（按商户订单号）的关键字段。
type WechatQueryResult struct {
	TradeState string
	OutTradeNo string
	MchId      string
	AppId      string
	Total      int64
	Currency   string
}

const (
	// WechatTradeStateSuccess 支付成功。
	WechatTradeStateSuccess = "SUCCESS"
	// WechatTradeStateNotExist 本地合成的状态：微信侧查无此交易（订单未创建或已失效）。
	//
	// 微信本身不会在成功查单里返回这个状态，仅用于把「用户从未进入付款流程」与
	// 「已付款但状态尚未同步」区分开——两者都表现为拿不到 SUCCESS，但前者永远等
	// 不到结果，后者等几秒就会变；前者应判为终态（unpaid），后者应继续等待（pending）。
	WechatTradeStateNotExist = "NOT_EXIST"
	// WechatTradeStateClosed 交易已关闭 / 已撤销 / 支付失败（终态）。
	// 这些状态不会再变为 SUCCESS，继续轮询无意义。
	WechatTradeStateClosed = "CLOSED"
)

// WechatQueryOrder 主动向微信支付查询一笔订单的真实状态。
//
// 用途：异步回调（notify_url）在本地 / 内网环境不可达时会缺失，订单会一直停在
// pending。用户付款后回到站内（或在钱包页打开充值记录）时，可调用本函数主动查单
// 并确认入账，与异步回调互为兜底；入账本身由 RechargeWechatPay 的幂等 CAS 保证只
// 发生一次。
//
// 与支付宝不同，微信查单接口（v3 按 out_trade_no）返回的是明文 JSON（仅 over TLS），
// 不经过 resource 加密，因此这里不重复做回调那套 AES-GCM 解密；但明文响应仍然
// 必须校验归属与一致性：mchid / appid 必须等于本地配置、out_trade_no 必须等于
// 请求值——否则（理论上）一个指向同网关的错误响应会被当作本订单的支付凭证。
// 校验失败一律按错误返回，调用方不得把未通过校验的响应推进订单状态。
func WechatQueryOrder(ctx context.Context, outTradeNo string) (*WechatQueryResult, error) {
	outTradeNo = strings.TrimSpace(outTradeNo)
	if outTradeNo == "" {
		return nil, fmt.Errorf("empty out_trade_no")
	}
	path := "/v3/pay/transactions/out-trade-no/" + outTradeNo
	auth, err := WechatPayBuildAuthHeader(
		"GET", path, "",
		operation_setting.WechatPayMchId, operation_setting.WechatPaySerialNo, operation_setting.WechatPayPrivateKey,
	)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, operation_setting.WechatPayGateway+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", auth)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Uter/1.0")

	client := GetHttpClient()
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}

	// 微信对不存在的订单返回 404（code 形如 ORDER_NOT_EXIST / RESOURCE_NOT_EXISTS）。
	// 这不是故障，按「未支付」返回让调用方走 unpaid 终态，否则用户会收到误导性结果。
	if resp.StatusCode == http.StatusNotFound {
		return &WechatQueryResult{TradeState: WechatTradeStateNotExist, OutTradeNo: outTradeNo}, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("wechat query http status %d", resp.StatusCode)
	}

	var node struct {
		TradeState string `json:"trade_state"`
		OutTradeNo string `json:"out_trade_no"`
		MchId      string `json:"mchid"`
		AppId      string `json:"appid"`
		Amount     struct {
			Total    int64  `json:"total"`
			Currency string `json:"currency"`
		} `json:"amount"`
	}
	if err := json.Unmarshal(body, &node); err != nil {
		return nil, fmt.Errorf("wechat query decode: %w", err)
	}
	// 归属校验（回调路径 WechatPayNotify 对解密后的 resource 做同一套校验）。
	if node.MchId != operation_setting.WechatPayMchId {
		return nil, fmt.Errorf("wechat query mchid mismatch: got %q want %q", node.MchId, operation_setting.WechatPayMchId)
	}
	if node.AppId != operation_setting.WechatPayAppId {
		return nil, fmt.Errorf("wechat query appid mismatch: got %q want %q", node.AppId, operation_setting.WechatPayAppId)
	}
	if node.OutTradeNo != outTradeNo {
		return nil, fmt.Errorf("wechat query out_trade_no mismatch: got %q want %q", node.OutTradeNo, outTradeNo)
	}
	return &WechatQueryResult{
		TradeState: node.TradeState,
		OutTradeNo: node.OutTradeNo,
		MchId:      node.MchId,
		AppId:      node.AppId,
		Total:      node.Amount.Total,
		Currency:   node.Amount.Currency,
	}, nil
}
