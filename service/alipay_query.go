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

package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/uter-ai/uter/setting/operation_setting"
)

// AlipayQueryResult 是 alipay.trade.query 的关键字段。
type AlipayQueryResult struct {
	TradeStatus string
	TotalAmount string
	OutTradeNo  string
}

const (
	// alipaySubCodeTradeNotExist 支付宝「交易不存在」子错误码。
	alipaySubCodeTradeNotExist = "ACQ.TRADE_NOT_EXIST"
	// AlipayTradeStatusNotExist 本地合成的状态：支付宝侧查无此交易。
	//
	// 支付宝本身不会返回这个 trade_status，仅用于让调用方区分「用户从未进入
	// 付款流程」与「已付款但状态尚未同步」——两者都表现为查单拿不到
	// TRADE_SUCCESS，但前者永远等不到结果，后者等几秒就会变。
	AlipayTradeStatusNotExist = "TRADE_NOT_EXIST"
	// AlipayTradeStatusClosed 支付宝侧交易已关闭（超时未付款或用户主动关闭）。
	// 这个状态是终态，继续轮询不会有任何变化。
	AlipayTradeStatusClosed = "TRADE_CLOSED"
)

// AlipayQueryOrder 主动向支付宝查询一笔订单的真实状态。
//
// 用途：异步回调（notify_url）在本地 / 内网环境不可达时会缺失，订单会一直停在
// pending。用户付款后从收银台回到站内时，前端可调用本函数主动查单并确认入账，
// 与异步回调互为兜底；入账本身由 RechargeAlipay 的幂等 CAS 保证只发生一次。
func AlipayQueryOrder(ctx context.Context, outTradeNo string) (*AlipayQueryResult, error) {
	outTradeNo = strings.TrimSpace(outTradeNo)
	if outTradeNo == "" {
		return nil, fmt.Errorf("empty out_trade_no")
	}
	bizContent, err := json.Marshal(map[string]string{"out_trade_no": outTradeNo})
	if err != nil {
		return nil, err
	}
	params := map[string]string{
		"app_id":      operation_setting.AlipayAppId,
		"method":      "alipay.trade.query",
		"format":      "JSON",
		"charset":     "utf-8",
		"sign_type":   "RSA2",
		"timestamp":   time.Now().Format("2006-01-02 15:04:05"),
		"version":     "1.0",
		"biz_content": string(bizContent),
	}
	sign, err := AlipayBuildSign(params, operation_setting.AlipayPrivateKey)
	if err != nil {
		return nil, err
	}
	params["sign"] = sign

	form := url.Values{}
	for k, v := range params {
		form.Set(k, v)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, operation_setting.AlipayGateway, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded;charset=utf-8")

	client := GetHttpClient()
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("alipay query http status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}

	// 业务节点保留原始字节用于验签（支付宝对节点原文签名，不是重新序列化后的结果）。
	var envelope struct {
		Response json.RawMessage `json:"alipay_trade_query_response"`
		Sign     string          `json:"sign"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil, fmt.Errorf("alipay query response decode: %w", err)
	}
	if len(envelope.Response) == 0 {
		return nil, fmt.Errorf("alipay query response missing node")
	}
	if !AlipayVerifyResponse(string(envelope.Response), envelope.Sign, operation_setting.AlipayPublicKey) {
		return nil, fmt.Errorf("alipay query response signature invalid")
	}

	var node struct {
		Code        string `json:"code"`
		Msg         string `json:"msg"`
		SubCode     string `json:"sub_code"`
		SubMsg      string `json:"sub_msg"`
		TradeStatus string `json:"trade_status"`
		TotalAmount string `json:"total_amount"`
		OutTradeNo  string `json:"out_trade_no"`
	}
	if err := json.Unmarshal(envelope.Response, &node); err != nil {
		return nil, fmt.Errorf("alipay query node decode: %w", err)
	}
	// ACQ.TRADE_NOT_EXIST 表示支付宝侧还没有这笔交易（用户下单后未付款，
	// 或付款后状态尚未同步）。这不是故障，按「未支付」返回让调用方走 pending，
	// 否则用户从收银台返回未付款时会收到「查询订单失败」这种误导性结果。
	if node.Code != "10000" {
		if node.SubCode == alipaySubCodeTradeNotExist {
			return &AlipayQueryResult{TradeStatus: AlipayTradeStatusNotExist, OutTradeNo: outTradeNo}, nil
		}
		return nil, fmt.Errorf("alipay query failed: code=%s sub_code=%s msg=%s", node.Code, node.SubCode, node.Msg)
	}
	return &AlipayQueryResult{
		TradeStatus: node.TradeStatus,
		TotalAmount: node.TotalAmount,
		OutTradeNo:  node.OutTradeNo,
	}, nil
}
