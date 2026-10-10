package costopt

// 本文件原本还承载「零调用短路规则」(MatchShortCircuit)：按规则直接返回预设答案、
// 完全不调上游。该功能属于有损降本（客户拿到的不是模型生成的内容），已整体移除。
// 保留 BuildShortCircuitResponse / EstimateRequestUsage —— 它们被「循环检测」复用：
// 检测到重复循环请求时用它们构造收敛应答并记账，属于护栏而非省钱手段。
import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/relaykit/types"
)

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

// BuildShortCircuitResponse 构造「未调上游」的应答并计费后返回。
// 目前仅循环检测收敛路径使用：命中重复循环请求时直接返回说明文案，不再发往上游。
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
// 用于降本节省记账：负缓存 / 循环收敛这些未调上游的路径，
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
