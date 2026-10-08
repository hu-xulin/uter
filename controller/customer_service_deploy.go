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
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
)

// 智能客服（smart-cs）管理端代理。
//
// Uter 并不直接管理智能客服的模型配置，而是把「站点与品牌 → 智能客服」页面作为
// 编辑入口，经本代理把请求转发给 smart-cs 的 /api/deploy/* 管理接口：
//
//   GET  /api/customer-service/deploy/llm  ->  smart-cs GET  /api/deploy/config  (取 llm 段)
//   PUT  /api/customer-service/deploy/llm  ->  smart-cs PUT  /api/deploy/section/llm
//                                         +  POST /api/deploy/apply (让新配置生效/重载引擎)
//
// 为什么是代理而不是前端直连：smart-cs 的管理接口需要 admin Bearer 令牌，这个凭证
// 存在 Uter 的 options 表里（common.CustomerServiceAdminToken），前端不持有、也不
// 应回显。由 Uter 后端统一带令牌转发，前端只跟 Uter 自己的 admin 会话打交道。
//
// 两个前置条件缺任一都直接 400，不带着空值去打 smart-cs（那会稳定 401，反而难排查）：
//   - common.CustomerServiceURL           （智能客服地址，环境变量 CUSTOMER_SERVICE_URL）
//   - common.CustomerServiceAdminToken    （运营粘贴的 smart-cs admin 令牌）
//
// 响应统一走 Uter 的 {success, message, data} 约定，前端沿用现有拦截器与 requireServerSuccess。

const customerServiceDeployTimeout = 15 * time.Second

// csBaseURL 把 CUSTOMER_SERVICE_URL 规整成无尾部斜杠的基础地址。
func csBaseURL() string {
	return strings.TrimRight(common.CustomerServiceURL, "/")
}

// csProxyError 把 smart-cs 的响应翻译成 Uter 侧的友好错误。
func csProxyError(c *gin.Context, action string, status int, body string) {
	msg := fmt.Sprintf("智能客服返回错误（%s）：HTTP %d", action, status)
	if body != "" && len(body) <= 500 {
		msg += " —— " + strings.TrimSpace(body)
	}
	c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": msg})
}

// csDo 执行一次带 admin 令牌的 smart-cs 请求。method 为 GET/PUT/POST，body 为 nil
// 表示无请求体（GET）。返回响应体与状态码；网络层错误直接写回 502。
func csDo(c *gin.Context, method, path string, body []byte) ([]byte, int, error) {
	full := csBaseURL() + path
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), method, full, reader)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+common.CustomerServiceAdminToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: customerServiceDeployTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	return respBody, resp.StatusCode, nil
}

// GetCustomerServiceLLMConfig 拉取 smart-cs 当前的大模型配置（llm 段）下发前端。
//
// 只回传 llm 段本身（provider/base/model/.../api_key 等），不回传整份 deploy 配置，
// 前端也不需要其它段。api_key 等敏感字段原样下发——本接口本身受 AdminAuth 保护，
// 调用者已是 Uter 管理员，与在 smart-cs 后台看配置同级。
func GetCustomerServiceLLMConfig(c *gin.Context) {
	if common.CustomerServiceURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "未配置智能客服地址（CUSTOMER_SERVICE_URL），无法拉取配置",
		})
		return
	}
	if common.CustomerServiceAdminToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":   false,
			"message":   "未配置智能客服管理员令牌",
			"needToken": true,
		})
		return
	}

	raw, status, err := csDo(c, http.MethodGet, "/api/deploy/config", nil)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "无法连接智能客服：" + err.Error(),
		})
		return
	}
	if status != http.StatusOK {
		csProxyError(c, "读取配置", status, string(raw))
		return
	}

	var parsed struct {
		Config struct {
			LLM map[string]any `json:"llm"`
		} `json:"config"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "智能客服返回的配置无法解析：" + err.Error(),
		})
		return
	}
	if parsed.Config.LLM == nil {
		// 容错：llm 段缺失时给空对象，前端据此显示「未配置模型」。
		parsed.Config.LLM = map[string]any{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"llm": parsed.Config.LLM}})
}

// UpdateCustomerServiceLLMConfig 把前端编辑后的 llm 段写回 smart-cs，并触发引擎重载。
//
// 转发到 PUT /api/deploy/section/llm（smart-cs 负责落盘），随后 POST /api/deploy/apply
// 让新模型/密钥立即生效（否则只改文件不重载，回答仍走旧引擎）。apply 失败不阻塞写回
// 成功——落盘是主目标，重载失败给出提示让运营手动点「应用生效」即可。
func UpdateCustomerServiceLLMConfig(c *gin.Context) {
	if common.CustomerServiceURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "未配置智能客服地址（CUSTOMER_SERVICE_URL），无法保存配置",
		})
		return
	}
	if common.CustomerServiceAdminToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":   false,
			"message":   "未配置智能客服管理员令牌",
			"needToken": true,
		})
		return
	}

	// 校验请求体是合法 JSON 对象（smart-cs 的 llm 段是扁平对象）。
	var payload map[string]any
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "请求体必须是 JSON 对象：" + err.Error(),
		})
		return
	}
	body, err := json.Marshal(payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "序列化请求体失败：" + err.Error(),
		})
		return
	}

	raw, status, err := csDo(c, http.MethodPut, "/api/deploy/section/llm", body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "无法连接智能客服：" + err.Error(),
		})
		return
	}
	if status != http.StatusOK {
		csProxyError(c, "保存配置", status, string(raw))
		return
	}

	// 落盘成功，尝试重载引擎。失败降级为提示，不算写回失败。
	applyNote := ""
	applyRaw, applyStatus, applyErr := csDo(c, http.MethodPost, "/api/deploy/apply", nil)
	if applyErr != nil {
		applyNote = "已保存，但重载引擎失败（" + applyErr.Error() + "），请到智能客服后台手动点「应用生效」"
	} else if applyStatus != http.StatusOK {
		applyNote = "已保存，但重载引擎返回 HTTP " + fmt.Sprintf("%d", applyStatus) + "，请到智能客服后台手动点「应用生效」"
	} else {
		var ar struct {
			Err string `json:"error"`
		}
		if json.Unmarshal(applyRaw, &ar) == nil && ar.Err != "" {
			applyNote = "已保存；重载引擎提示：" + ar.Err
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"message":    applyNoteSuffix(applyNote),
		"apply_note": applyNote,
	})
}

// applyNoteSuffix 把可选的提示拼成完整句子，便于前端直接展示。
func applyNoteSuffix(note string) string {
	if note == "" {
		return "智能客服模型配置已保存，并已重载引擎"
	}
	return "智能客服模型配置已保存（" + note + "）"
}
