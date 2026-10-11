package openai

import (
	"fmt"
	"strings"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/logger"
	relaycommon "github.com/uter-ai/uter/relay/common"
	relayconstant "github.com/uter-ai/uter/relay/constant"
	"github.com/uter-ai/uter/relay/helper"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/relaykit/relayconvert"
	"github.com/uter-ai/uter/relaykit/types"
	"github.com/uter-ai/uter/service"

	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
)

// 辅助函数
func HandleStreamFormat(c *gin.Context, info *relaycommon.RelayInfo, data string, forceFormat bool, thinkToContent bool) error {
	switch info.RelayFormat {
	case types.RelayFormatOpenAI:
		info.SendResponseCount++
		return sendStreamData(c, info, data, forceFormat, thinkToContent)
	case types.RelayFormatClaude:
		info.SendResponseCount++
		return handleClaudeFormat(c, data, info)
	case types.RelayFormatGemini:
		// The stateful relaykit path owns its chunk counter so multi-hop and
		// direct conversions observe the same stream state semantics.
		return handleGeminiFormat(c, data, info)
	}
	return nil
}

func handleClaudeFormat(c *gin.Context, data string, info *relaycommon.RelayInfo) error {
	var streamResponse dto.ChatCompletionsStreamResponse
	if err := common.Unmarshal(common.StringToByteSlice(data), &streamResponse); err != nil {
		return err
	}

	if streamResponse.Usage != nil {
		info.EnsureClaudeConvertInfo().Usage = streamResponse.Usage
	}
	result, err := service.ConvertStreamResponse(c, info, types.RelayFormatClaude, &streamResponse)
	if err != nil {
		return err
	}
	claudeResponses, ok := result.Value.([]*dto.ClaudeResponse)
	if !ok {
		return fmt.Errorf("expected Claude stream responses, got %T", result.Value)
	}
	for _, resp := range claudeResponses {
		helper.ClaudeData(c, *resp)
	}
	return nil
}

func handleGeminiFormat(c *gin.Context, data string, info *relaycommon.RelayInfo) error {
	var streamResponse dto.ChatCompletionsStreamResponse
	if err := common.Unmarshal(common.StringToByteSlice(data), &streamResponse); err != nil {
		logger.LogError(c, "failed to unmarshal stream response: "+err.Error())
		return err
	}

	state, err := chatToGeminiStreamState(info, &streamResponse)
	if err != nil {
		return err
	}
	results, err := service.ConvertStreamResponseChunk(c, info, state, &streamResponse)
	if err != nil {
		return err
	}
	return sendGeminiStreamResults(c, results)
}

func chatToGeminiStreamState(info *relaycommon.RelayInfo, streamResponse *dto.ChatCompletionsStreamResponse) (*relayconvert.ResponseStreamState, error) {
	if info != nil && info.ChatToGeminiStreamState != nil {
		state, ok := info.ChatToGeminiStreamState.(*relayconvert.ResponseStreamState)
		if !ok || state == nil {
			return nil, fmt.Errorf("invalid Chat-to-Gemini stream state %T", info.ChatToGeminiStreamState)
		}
		return state, nil
	}

	state, err := relayconvert.NewResponseStreamState(types.RelayFormatOpenAI, types.RelayFormatGemini, relayconvert.ResponseStreamOptions{
		ID:      streamResponse.Id,
		Model:   streamResponse.Model,
		Created: streamResponse.Created,
	})
	if err != nil {
		return nil, err
	}
	if info != nil {
		info.ChatToGeminiStreamState = state
	}
	return state, nil
}

func sendGeminiStreamResults(c *gin.Context, results []relayconvert.ResponseResult) error {
	for _, result := range results {
		geminiResponse, ok := result.Value.(*dto.GeminiChatResponse)
		if !ok {
			return fmt.Errorf("expected Gemini stream response, got %T", result.Value)
		}
		if geminiResponse == nil {
			continue
		}
		data, err := common.Marshal(geminiResponse)
		if err != nil {
			logger.LogError(c, "failed to marshal gemini response: "+err.Error())
			return err
		}
		c.Render(-1, common.CustomEvent{Data: "data: " + string(data)})
		_ = helper.FlushWriter(c)
	}
	return nil
}

func ProcessStreamResponse(streamResponse dto.ChatCompletionsStreamResponse, responseTextBuilder *strings.Builder, toolCount *int) error {
	for _, choice := range streamResponse.Choices {
		responseTextBuilder.WriteString(choice.Delta.GetContentString())
		responseTextBuilder.WriteString(choice.Delta.GetReasoningContent())
		if choice.Delta.ToolCalls != nil {
			if len(choice.Delta.ToolCalls) > *toolCount {
				*toolCount = len(choice.Delta.ToolCalls)
			}
			for _, tool := range choice.Delta.ToolCalls {
				responseTextBuilder.WriteString(tool.Function.Name)
				responseTextBuilder.WriteString(tool.Function.Arguments)
			}
		}
	}
	return nil
}

func collectStreamFunctionCallNames(data string, seen map[string]struct{}, names *[]string) {
	var streamResponse dto.ChatCompletionsStreamResponse
	if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
		return
	}
	collectStreamFunctionCallNamesFrom(&streamResponse, seen, names)
}

// collectStreamFunctionCallNamesFrom 是 collectStreamFunctionCallNames 的解析后版本。
//
// 同一个 chunk 此前要被 collectStreamFunctionCallNames 与 processTokenData 各
// Unmarshal 一次（chat completions 模式下两者目标类型完全相同，是同一份解析结果
// 算两遍），2000 chunk 的请求因此白白多花约 2000 次编解码。热路径改为解析一次后
// 复用本函数。
func collectStreamFunctionCallNamesFrom(streamResponse *dto.ChatCompletionsStreamResponse, seen map[string]struct{}, names *[]string) {
	if streamResponse == nil {
		return
	}
	for _, choice := range streamResponse.Choices {
		for i, tc := range choice.Delta.ToolCalls {
			name := strings.TrimSpace(tc.Function.Name)
			if name == "" {
				continue
			}
			toolIdx := i
			if tc.Index != nil {
				toolIdx = *tc.Index
			}
			fallbackKey := fmt.Sprintf("index\x00%d\x00%d\x00%s", choice.Index, toolIdx, name)
			activeKey := fmt.Sprintf("active\x00%d\x00%d\x00%s", choice.Index, toolIdx, name)
			callID := strings.TrimSpace(tc.ID)
			if callID != "" {
				idKey := fmt.Sprintf("id\x00%d\x00%s", choice.Index, callID)
				if _, ok := seen[idKey]; ok {
					continue
				}
				seen[idKey] = struct{}{}
				seen[activeKey] = struct{}{}
				if _, delayedID := seen[fallbackKey]; delayedID {
					delete(seen, fallbackKey)
					continue
				}
			} else {
				if _, ok := seen[fallbackKey]; ok {
					continue
				}
				if _, ok := seen[activeKey]; ok {
					continue
				}
				seen[fallbackKey] = struct{}{}
				seen[activeKey] = struct{}{}
			}
			*names = append(*names, name)
		}
	}
}

// processStreamChunk 处理单个 SSE chunk：解析一次，同时喂给 tool_call 名称收集
// 与正文/工具参数累计两条路径。
//
// 此前这两条路径各自对同一段 data 做一次完整 Unmarshal（chat completions 模式下
// 连目标类型都完全相同），一个 2000 chunk 的流式响应因此多做约 2000 次编解码。
// 合并为一次解析后复用，两条路径拿到的仍是同一份解析结果，行为不变。
func processStreamChunk(
	relayMode int,
	data string,
	seenToolCalls map[string]struct{},
	streamFunctionCallNames *[]string,
	responseTextBuilder *strings.Builder,
	toolCount *int,
) error {
	switch relayMode {
	case relayconstant.RelayModeChatCompletions:
		var streamResponse dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			return err
		}
		collectStreamFunctionCallNamesFrom(&streamResponse, seenToolCalls, streamFunctionCallNames)
		return ProcessStreamResponse(streamResponse, responseTextBuilder, toolCount)
	case relayconstant.RelayModeCompletions:
		// 旧路径同样会跑 collectStreamFunctionCallNames（它无条件按
		// ChatCompletionsStreamResponse 解析），这里保留以免改变行为。
		// 合并解析只用于 chat completions 这条热路径。
		collectStreamFunctionCallNames(data, seenToolCalls, streamFunctionCallNames)
		var streamResponse dto.CompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			return err
		}
		processCompletionsStreamResponse(streamResponse, responseTextBuilder)
	}
	return nil
}

func processCompletionsStreamResponse(streamResponse dto.CompletionsStreamResponse, responseTextBuilder *strings.Builder) {
	for _, choice := range streamResponse.Choices {
		responseTextBuilder.WriteString(choice.Text)
	}
}

func handleLastResponse(lastStreamData string, responseId *string, createAt *int64,
	systemFingerprint *string, model *string, usage **dto.Usage,
	containStreamUsage *bool, info *relaycommon.RelayInfo,
	shouldSendLastResp *bool) error {

	var lastStreamResponse dto.ChatCompletionsStreamResponse
	if err := common.Unmarshal(common.StringToByteSlice(lastStreamData), &lastStreamResponse); err != nil {
		return err
	}

	*responseId = lastStreamResponse.Id
	*createAt = lastStreamResponse.Created
	*systemFingerprint = lastStreamResponse.GetSystemFingerprint()
	*model = lastStreamResponse.Model

	if service.ValidUsage(lastStreamResponse.Usage) {
		*containStreamUsage = true
		*usage = dto.MergeUsageNonZero(*usage, lastStreamResponse.Usage)
		if !info.ShouldIncludeUsage {
			*shouldSendLastResp = lo.SomeBy(lastStreamResponse.Choices, func(choice dto.ChatCompletionsStreamResponseChoice) bool {
				return choice.Delta.GetContentString() != "" || choice.Delta.GetReasoningContent() != ""
			})
		}
	}

	return nil
}

func HandleFinalResponse(c *gin.Context, info *relaycommon.RelayInfo, lastStreamData string,
	responseId string, createAt int64, model string, systemFingerprint string,
	usage *dto.Usage, containStreamUsage bool) {

	switch info.RelayFormat {
	case types.RelayFormatOpenAI:
		if info.ShouldIncludeUsage && !containStreamUsage {
			response := helper.GenerateFinalUsageResponse(responseId, createAt, model, *usage)
			response.SetSystemFingerprint(systemFingerprint)
			helper.ObjectData(c, response)
		}
		helper.Done(c)

	case types.RelayFormatClaude:
		var streamResponse dto.ChatCompletionsStreamResponse
		if err := common.Unmarshal(common.StringToByteSlice(lastStreamData), &streamResponse); err != nil {
			common.SysLog("error unmarshalling stream response: " + err.Error())
			return
		}

		info.ClaudeConvertInfo.Usage = usage

		result, err := service.ConvertStreamResponse(c, info, types.RelayFormatClaude, &streamResponse)
		if err != nil {
			common.SysLog("error converting Claude stream response: " + err.Error())
			return
		}
		claudeResponses, ok := result.Value.([]*dto.ClaudeResponse)
		if !ok {
			common.SysLog(fmt.Sprintf("expected Claude stream responses, got %T", result.Value))
			return
		}
		for _, resp := range claudeResponses {
			_ = helper.ClaudeData(c, *resp)
		}
		info.ClaudeConvertInfo.Done = true

	case types.RelayFormatGemini:
		var streamResponse dto.ChatCompletionsStreamResponse
		if err := common.Unmarshal(common.StringToByteSlice(lastStreamData), &streamResponse); err != nil {
			common.SysLog("error unmarshalling stream response: " + err.Error())
			return
		}

		state, err := chatToGeminiStreamState(info, &streamResponse)
		if err != nil {
			common.SysLog("error creating Gemini stream state: " + err.Error())
			return
		}
		state.SetUsage(usage)

		results, err := service.ConvertStreamResponseChunk(c, info, state, &streamResponse)
		if err != nil {
			common.SysLog("error converting final Gemini stream response: " + err.Error())
			return
		}
		if err := sendGeminiStreamResults(c, results); err != nil {
			common.SysLog("error sending final Gemini stream response: " + err.Error())
			return
		}

		results, err = service.FinalizeStreamResponse(c, info, state)
		if err != nil {
			common.SysLog("error finalizing Gemini stream response: " + err.Error())
			return
		}
		if err := sendGeminiStreamResults(c, results); err != nil {
			common.SysLog("error sending finalized Gemini stream response: " + err.Error())
		}
	}
}

func sendResponsesStreamData(c *gin.Context, streamResponse dto.ResponsesStreamResponse, data string) {
	if data == "" {
		return
	}
	_ = helper.ResponseChunkData(c, streamResponse, data)
}
