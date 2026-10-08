package costopt

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
)

// ApplyContextWindow 在派发前裁剪/压缩对话历史，降低输入 token。
//
// 策略（轻资产，无重资产）：
//   - 始终保留所有 system 消息（避免丢失系统指令）。
//   - 其余消息保留最近 N 条（ContextWindowMaxMessages 配额）。
//   - 若溢出部分存在且开启摘要，用便宜模型把溢出前缀压成一条摘要 system 消息插回；
//     摘要失败则退化为直接裁掉（不阻塞请求）。
//
// 返回是否发生了修改（便于调用方决定是否重算 token 估算）。
func ApplyContextWindow(req *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.ContextWindowEnabled || len(req.Messages) == 0 {
		return false
	}
	maxMsgs := cfg.ContextWindowMaxMessages
	if maxMsgs <= 0 {
		maxMsgs = 20
	}

	var system []dto.Message
	var others []dto.Message
	for _, m := range req.Messages {
		if m.Role == "system" {
			system = append(system, m)
		} else {
			others = append(others, m)
		}
	}

	keepOthers := maxMsgs - len(system)
	if keepOthers < 0 {
		keepOthers = 0
	}
	if len(others) <= keepOthers {
		return false // 无需裁剪
	}

	overflow := others[:len(others)-keepOthers]
	kept := others[len(others)-keepOthers:]

	if cfg.ContextWindowSummaryEnabled && len(overflow) > 0 {
		if summary := summarizeOverflow(context.Background(), cfg, overflow); summary != "" {
			system = append(system, dto.Message{
				Role:    "system",
				Content: "以下是被压缩的早期对话摘要（可能省略图片等多模态内容）：\n" + summary,
			})
		}
	}

	req.Messages = append(system, kept...)
	return true
}

// summarizeOverflow 用配置里的便宜模型把溢出对话压成中文摘要。best-effort：
// 任何错误都返回空串，调用方退化为直接裁掉。
func summarizeOverflow(ctx context.Context, cfg *costoptcfg.CostOptSetting, overflow []dto.Message) string {
	base := cfg.SummaryAPIBaseURL
	key := cfg.SummaryAPIKey
	model := cfg.ContextWindowSummaryModel
	if base == "" || key == "" || model == "" {
		return ""
	}

	var b bytes.Buffer
	b.WriteString("请把以下对话（用户与助手的早期轮次）压缩成一段简洁的中文摘要，保留关键事实、结论与待办，不要解释，直接输出摘要：\n\n")
	for _, m := range overflow {
		b.WriteString("[" + m.Role + "]: " + m.StringContent() + "\n")
	}

	payload, err := json.Marshal(map[string]any{
		"model":    model,
		"messages": []map[string]any{{"role": "user", "content": b.String()}},
		"max_tokens": 512,
	})
	if err != nil {
		return ""
	}

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, normalizeBaseURL(base)+"/v1/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return ""
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}

	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &out); err != nil || len(out.Choices) == 0 {
		return ""
	}
	return out.Choices[0].Message.Content
}
