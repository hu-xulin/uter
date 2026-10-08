package costopt

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/gin-gonic/gin"
	"github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/relaykit/types"
)

// MatchShortCircuit 命中零调用短路规则时返回 (answer, true)；否则 ("", false)。
// 命中后由调用方直接返回预设答案，根本不调上游 LLM（该部分 100% 省去模型调用）。
func MatchShortCircuit(req *dto.GeneralOpenAIRequest, info *common.RelayInfo) (string, bool) {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.ShortCircuitEnabled || len(cfg.ShortCircuitRules) == 0 {
		return "", false
	}
	text := lastUserMessage(req)
	if text == "" {
		return "", false
	}
	// 按优先级降序，高优先级先匹配。
	rules := append([]costoptcfg.ShortCircuitRule(nil), cfg.ShortCircuitRules...)
	sort.SliceStable(rules, func(i, j int) bool {
		return rules[i].Priority > rules[j].Priority
	})
	for _, r := range rules {
		if !r.Enabled || r.Answer == "" || r.Pattern == "" {
			continue
		}
		if r.Scope != "" && r.Scope != info.UsingGroup && r.Scope != info.TokenGroup {
			continue
		}
		if r.Model != "" && r.Model != req.Model {
			continue
		}
		if matchRule(r, text) {
			return r.Answer, true
		}
	}
	return "", false
}

func matchRule(r costoptcfg.ShortCircuitRule, text string) bool {
	t := text
	p := r.Pattern
	if !r.CaseSensitive {
		t = strings.ToLower(t)
		p = strings.ToLower(p)
	}
	switch r.Match {
	case "exact":
		return t == p
	case "contains":
		return strings.Contains(t, p)
	case "regex":
		re, err := regexp.Compile(p)
		if err != nil {
			return false
		}
		return re.MatchString(t)
	default:
		return false
	}
}

// lastUserMessage 取消息列表中最后一条用户消息的文本内容（忽略 system/assistant/tool）。
func lastUserMessage(req *dto.GeneralOpenAIRequest) string {
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role != "user" {
			continue
		}
		if s := messageText(req.Messages[i]); s != "" {
			return s
		}
	}
	return ""
}

func messageText(m dto.Message) string {
	switch v := m.Content.(type) {
	case string:
		return v
	case []dto.MediaContent:
		var sb strings.Builder
		for _, part := range v {
			if part.Type == "text" {
				sb.WriteString(part.Text)
			}
		}
		return sb.String()
	default:
		return ""
	}
}

// BuildShortCircuitResponse 构造零调用短路应答并计费后返回。
// 非流式返回标准 chat.completion JSON；流式按 SSE 单块回放。
func BuildShortCircuitResponse(c *gin.Context, info *common.RelayInfo, req *dto.GeneralOpenAIRequest, answer string) *types.UterError {
	usage := estimateUsage(req, answer)
	// 短路未占用任何上游/渠道，置 0 避免渠道统计失真。
	info.ChannelId = 0
	billCached(c, info, usage)
	if req.Stream != nil && *req.Stream {
		return writeShortCircuitStream(c, req.Model, answer)
	}
	resp := dto.TextResponse{
		Id:      fmt.Sprintf("chatcmpl-uter-%d", time.Now().UnixNano()),
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   req.Model,
		Choices: []dto.OpenAITextResponseChoice{
			{
				Index:        0,
				Message:      dto.Message{Role: "assistant", Content: answer},
				FinishReason: "stop",
			},
		},
	}
	resp.Usage = *usage
	b, _ := json.Marshal(resp)
	c.Data(http.StatusOK, "application/json", b)
	return nil
}

// EstimateRequestUsage 对外暴露本次请求「若真的发给上游」的估算用量。
// 用于降本节省记账：短路 / 负缓存 / 循环收敛这些未调上游的路径，
// 以此口径把省下的 token 计入指标（与计费口径一致：字符数/4）。
func EstimateRequestUsage(req *dto.GeneralOpenAIRequest, answer string) *dto.Usage {
	return estimateUsage(req, answer)
}

// estimateUsage 以粗略经验值（token ≈ 字符数/4）估算短路应答用量，保证配额不漏扣。
func estimateUsage(req *dto.GeneralOpenAIRequest, answer string) *dto.Usage {
	prompt := 0
	for _, m := range req.Messages {
		prompt += len([]rune(messageText(m)))
	}
	completion := len([]rune(answer))
	promptTokens := prompt / 4
	completionTokens := completion / 4
	return &dto.Usage{
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		TotalTokens:      promptTokens + completionTokens,
	}
}

func writeShortCircuitStream(c *gin.Context, model, answer string) *types.UterError {
	h := c.Writer.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache")
	h.Set("Connection", "keep-alive")
	writeSSE(c, dto.ChatCompletionsStreamResponse{
		Id:      fmt.Sprintf("chatcmpl-uter-%d", time.Now().UnixNano()),
		Object:  "chat.completion.chunk",
		Created: time.Now().Unix(),
		Model:   model,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Role: "assistant"}},
		},
	})
	writeSSE(c, dto.ChatCompletionsStreamResponse{
		Id:      fmt.Sprintf("chatcmpl-uter-%d", time.Now().UnixNano()),
		Object:  "chat.completion.chunk",
		Created: time.Now().Unix(),
		Model:   model,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: &answer}},
		},
	})
	stop := "stop"
	writeSSE(c, dto.ChatCompletionsStreamResponse{
		Id:      fmt.Sprintf("chatcmpl-uter-%d", time.Now().UnixNano()),
		Object:  "chat.completion.chunk",
		Created: time.Now().Unix(),
		Model:   model,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{}, FinishReason: &stop},
		},
	})
	c.Writer.Write([]byte("data: [DONE]\n\n"))
	c.Status(http.StatusOK)
	return nil
}

func writeSSE(c *gin.Context, chunk dto.ChatCompletionsStreamResponse) {
	b, _ := json.Marshal(chunk)
	c.Writer.Write([]byte("data: " + string(b) + "\n\n"))
}
