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

// 智能客服（uter-cs）管理端代理。
//
// Uter 并不直接管理智能客服的模型配置，而是把「站点与品牌 → 智能客服」页面作为
// 编辑入口，经本代理把请求转发给 uter-cs 的 /api/deploy/* 管理接口：
//
//   GET  /api/customer-service/deploy/llm      ->  uter-cs GET  /api/deploy/config  (取 llm 段)
//   PUT  /api/customer-service/deploy/llm      ->  uter-cs PUT  /api/deploy/section/llm
//                                            +  POST /api/deploy/apply (让新配置生效/重载引擎)
//   GET  /api/customer-service/admin-token     ->  仅回显当前存储的 uter-cs 管理员令牌（供前端掩码展示）
//
// 为什么是代理而不是前端直连：uter-cs 的管理接口需要 admin Bearer 令牌，这个凭证
// 存在 Uter 的 options 表里（common.CustomerServiceAdminToken），前端不持有、也不
// 应回显明文。由 Uter 后端统一带令牌转发，前端只跟 Uter 自己的 admin 会话打交道。
//
// 两个前置条件缺任一都直接 400，不带着空值去打 uter-cs（那会稳定 401，反而难排查）：
//   - common.GetCustomerServiceURL()     （智能客服地址，环境变量 CUSTOMER_SERVICE_URL）
//   - common.CustomerServiceAdminToken    （运营粘贴的 uter-cs admin 令牌）
//
// 容错设计（修复「输入令牌后页面报错」）：
//   - csDo 在 wire 上 TrimSpace 令牌，避免粘贴时带入首尾空白/换行导致 uter-cs 鉴权
//     返回 400/401（实测尾部换行会让 Fastify 直接回 400）。
//   - 读取配置时若实时拉取失败，但有上一次成功缓存（common.CustomerServiceLLMConfig），
//     则回退展示缓存并附 stale 提示，而不是把上游错误直接砸到页面上。
//   - 未配置令牌时若已有缓存，也直接展示缓存（满足「已配置好的参数无需再输入令牌即可看到」）。
//
// 响应统一走 Uter 的 {success, message, data} 约定，前端沿用现有拦截器与 requireServerSuccess。

const customerServiceDeployTimeout = 15 * time.Second

// csBaseURL 把 CUSTOMER_SERVICE_URL 规整成无尾部斜杠的基础地址。
func csBaseURL() string {
	return strings.TrimRight(common.GetCustomerServiceURL(), "/")
}

// proxyErrorMsg 把 uter-cs 的响应翻译成 Uter 侧的友好错误文本。
func proxyErrorMsg(action string, status int, body string) string {
	msg := fmt.Sprintf("智能客服返回错误（%s）：HTTP %d", action, status)
	if body != "" && len(body) <= 500 {
		msg += " —— " + strings.TrimSpace(body)
	}
	return msg
}

// csTokenRejected 判断 uter-cs 是否**明确拒绝了我们的令牌**，而不是服务不可用。
//
// 401 = 令牌不是它的登录令牌 / 已过期；403 = 令牌有效但角色不是 admin。
// 这两种情况运营要做的动作是「换令牌」，继续按 502「上游错误」呈现会把人引到
// 排查网络和端口上——实测真实误配（把管理员密码填进令牌框）时，页面只显示
// 「智能客服返回错误（读取配置）：HTTP 401 —— {"error":"unauthorized"}」，
// 完全看不出该去补什么。
func csTokenRejected(status int) bool {
	return status == http.StatusUnauthorized || status == http.StatusForbidden
}

// csTokenHint 是令牌被拒时的可操作提示。
//
// 令牌是 uter-cs **登录接口返回的 token**（`header.payload.signature` 三段式，
// 由 server/auth.js 的 signToken 用 HMAC 签发，默认 7 天过期），**不是管理员密码**。
// 密码只在 POST /api/auth/login 里换一次令牌，之后所有管理请求都带令牌。
const csTokenHint = "智能客服管理员令牌无效或已过期。" +
	"请用 uter-cs 管理员账号登录其后台，从浏览器开发者工具 → Application → Local Storage 复制 scs_token，" +
	"或用 POST /api/auth/login 取响应里的 token；这里要填的是登录令牌，不是管理员密码。"

// csTokenRejectedJSON 是令牌被拒时的统一响应体。
// needToken 让前端复用「先去上面填令牌」的提示位，tokenInvalid 区分「没填」与「填错了」。
func csTokenRejectedJSON(action string, status int) gin.H {
	return gin.H{
		"success":      false,
		"needToken":    true,
		"tokenInvalid": true,
		"message":      fmt.Sprintf("%s（%s HTTP %d）", csTokenHint, action, status),
	}
}

// csProxyError 把 uter-cs 的响应翻译成 Uter 侧的友好错误。
func csProxyError(c *gin.Context, action string, status int, body string) {
	c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": proxyErrorMsg(action, status, body)})
}

// csDo 执行一次带 admin 令牌的 uter-cs 请求。method 为 GET/PUT/POST，body 为 nil
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
	// 关键：令牌在 wire 上做 TrimSpace，剔除粘贴时带入的首尾空白/换行。
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(common.CustomerServiceAdminToken))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: customerServiceDeployTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	respBody, _ := common.ReadUpstreamBody(resp.Body)
	return respBody, resp.StatusCode, nil
}

// cacheLLMConfig 把最近一次成功读取/保存的 llm 段缓存到内存，供「无令牌时直接展示」
// 以及「上游临时不可达时回退展示」使用。仅内存镜像（含 api_key 等敏感字段），不写
// 任何对外接口；落地持久化由 CustomerServiceAdminToken 同在 options 表托管即可（重启后
// 令牌仍在，GET 会重新实时拉取）。
func cacheLLMConfig(llm map[string]any) {
	if llm == nil {
		return
	}
	b, err := json.Marshal(llm)
	if err != nil {
		return
	}
	s := string(b)
	common.OptionMapRWMutex.Lock()
	common.CustomerServiceLLMConfig = s
	// OptionMap 在单测等未初始化的场景可能为 nil，此时仅更新内存镜像变量即可。
	if common.OptionMap != nil {
		common.OptionMap["CustomerServiceLLMConfig"] = s
	}
	common.OptionMapRWMutex.Unlock()
}

// readCachedLLMConfig 读出内存缓存的 llm 段；无缓存返回 nil。
func readCachedLLMConfig() map[string]any {
	raw := strings.TrimSpace(common.CustomerServiceLLMConfig)
	if raw == "" {
		return nil
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		return nil
	}
	return m
}

// GetCustomerServiceLLMConfig 拉取 uter-cs 当前的大模型配置（llm 段）下发前端。
//
// 只回传 llm 段本身（provider/base/model/.../api_key 等），不回传整份 deploy 配置，
// 前端也不需要其它段。api_key 等敏感字段原样下发——本接口本身受 AdminAuth 保护，
// 调用者已是 Uter 管理员，与在 uter-cs 后台看配置同级。
//
// 容错优先级：
//  1. 令牌已配置且实时拉取成功 → 返回实时配置（fromCache:false），并刷新缓存；
//  2. 令牌已配置但实时拉取失败 → 有缓存则回退缓存（fromCache:true, stale:true + 原因），
//     无缓存才报 502；
//  3. 令牌未配置 → 有缓存则直接返回缓存（fromCache:true），否则 400 提示先填令牌。
func GetCustomerServiceLLMConfig(c *gin.Context) {
	if common.GetCustomerServiceURL() == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "未配置智能客服地址（CUSTOMER_SERVICE_URL），无法拉取配置",
		})
		return
	}

	if strings.TrimSpace(common.CustomerServiceAdminToken) != "" {
		raw, status, err := csDo(c, http.MethodGet, "/api/deploy/config", nil)
		if err != nil {
			if cached := readCachedLLMConfig(); cached != nil {
				c.JSON(http.StatusOK, gin.H{
					"success": true,
					"data": gin.H{
						"llm":       cached,
						"fromCache": true,
						"stale":     true,
						"message":   "无法连接智能客服，展示上次缓存的配置：" + err.Error(),
					},
				})
				return
			}
			c.JSON(http.StatusBadGateway, gin.H{
				"success": false,
				"message": "无法连接智能客服：" + err.Error(),
			})
			return
		}
		if status != http.StatusOK {
			if cached := readCachedLLMConfig(); cached != nil {
				c.JSON(http.StatusOK, gin.H{
					"success": true,
					"data": gin.H{
						"llm":       cached,
						"fromCache": true,
						"stale":     true,
						"message":   proxyErrorMsg("读取配置", status, string(raw)),
					},
				})
				return
			}
			// 令牌被拒（401/403）与上游故障（5xx/超时）是两类问题：前者要运营换令牌，
			// 必须给出 400 + tokenInvalid，而不是 502 让人去查网络。
			if csTokenRejected(status) {
				c.JSON(http.StatusBadRequest, csTokenRejectedJSON("读取配置", status))
				return
			}
			csProxyError(c, "读取配置", status, string(raw))
			return
		}

		var parsed struct {
			Config struct {
				LLM map[string]any `json:"llm"`
			} `json:"config"`
		}
		if err := json.Unmarshal(raw, &parsed); err != nil {
			if cached := readCachedLLMConfig(); cached != nil {
				c.JSON(http.StatusOK, gin.H{
					"success": true,
					"data": gin.H{
						"llm":       cached,
						"fromCache": true,
						"stale":     true,
						"message":   "智能客服返回的配置无法解析，展示上次缓存：" + err.Error(),
					},
				})
				return
			}
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
		cacheLLMConfig(parsed.Config.LLM)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    gin.H{"llm": parsed.Config.LLM, "fromCache": false},
		})
		return
	}

	// 未配置令牌：尽力回放已缓存的配置，让「已配置好的参数」可直接展示。
	if cached := readCachedLLMConfig(); cached != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    gin.H{"llm": cached, "fromCache": true},
		})
		return
	}
	c.JSON(http.StatusBadRequest, gin.H{
		"success":   false,
		"message":   "未配置智能客服管理员令牌（这里要填 uter-cs 登录后返回的 token，不是管理员密码）",
		"needToken": true,
	})
}

// GetCustomerServiceAdminToken 仅回显当前存储的 uter-cs 管理员令牌，供前端以「与密钥
// 一致的掩码规则」展示在输入框里。接口本身受 AdminAuth 保护，仅管理员可见。
//
// 安全边界：令牌只返回给已登录的 Uter 管理员（与同页 API Key 的展示等级一致），绝不
// 出现在 /api/status 等对外接口；GET /api/option/ 也已将其排除在批量选项之外。
func GetCustomerServiceAdminToken(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"token": common.CustomerServiceAdminToken},
	})
}

// UpdateCustomerServiceLLMConfig 把前端编辑后的 llm 段写回 uter-cs，并触发引擎重载。
//
// 转发到 PUT /api/deploy/section/llm（uter-cs 负责落盘），随后 POST /api/deploy/apply
// 让新模型/密钥立即生效（否则只改文件不重载，回答仍走旧引擎）。apply 失败不阻塞写回
// 成功——落盘是主目标，重载失败给出提示让运营手动点「应用生效」即可。
func UpdateCustomerServiceLLMConfig(c *gin.Context) {
	if common.GetCustomerServiceURL() == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "未配置智能客服地址（CUSTOMER_SERVICE_URL），无法保存配置",
		})
		return
	}
	if strings.TrimSpace(common.CustomerServiceAdminToken) == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":   false,
			"message":   "未配置智能客服管理员令牌（这里要填 uter-cs 登录后返回的 token，不是管理员密码）",
			"needToken": true,
		})
		return
	}

	// 校验请求体是合法 JSON 对象（uter-cs 的 llm 段是扁平对象）。
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
		if csTokenRejected(status) {
			c.JSON(http.StatusBadRequest, csTokenRejectedJSON("保存配置", status))
			return
		}
		csProxyError(c, "保存配置", status, string(raw))
		return
	}

	// 落盘成功，尝试重载引擎。失败降级为提示，不算写回失败。
	// 必须带 `{}` 作为请求体：uter-cs 是 Fastify，对「Content-Type: application/json
	// 但 body 为空」会直接 400（FST_ERR_CTP_EMPTY_JSON_BODY）。此前传 nil 导致每次
	// 保存都提示「重载引擎返回 HTTP 400，请手动点应用生效」——配置写了文件却没进引擎，
	// 运营以为保存没生效。
	applyNote := ""
	applyRaw, applyStatus, applyErr := csDo(c, http.MethodPost, "/api/deploy/apply", []byte("{}"))
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

	// 缓存本次写回的 llm 配置，供无令牌时直接展示。
	cacheLLMConfig(payload)

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
