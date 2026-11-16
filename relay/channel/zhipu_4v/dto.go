package zhipu_4v

import (
	"time"
)

//	type ZhipuMessage struct {
//		Role       string `json:"role,omitempty"`
//		Content    string `json:"content,omitempty"`
//		ToolCalls  any    `json:"tool_calls,omitempty"`
//		ToolCallId any    `json:"tool_call_id,omitempty"`
//	}
//
//	type ZhipuRequest struct {
//		Model       string         `json:"model"`
//		Stream      bool           `json:"stream,omitempty"`
//		Messages    []ZhipuMessage `json:"messages"`
//		Temperature float64        `json:"temperature,omitempty"`
//		TopP        float64        `json:"top_p,omitempty"`
//		MaxTokens   int            `json:"max_tokens,omitempty"`
//		Stop        []string       `json:"stop,omitempty"`
//		RequestId   string         `json:"request_id,omitempty"`
//		Tools       any            `json:"tools,omitempty"`
//		ToolChoice  any            `json:"tool_choice,omitempty"`
//	}
//
//	type ZhipuV4TextResponseChoice struct {
//		Index        int `json:"index"`
//		ZhipuMessage `json:"message"`
//		FinishReason string `json:"finish_reason"`
//	}
//
//type ZhipuV4StreamResponseChoice struct {
//	Index        int          `json:"index,omitempty"`
//	Delta        ZhipuMessage `json:"delta"`
//	FinishReason *string      `json:"finish_reason,omitempty"`
//}

type tokenData struct {
	Token      string
	ExpiryTime time.Time
}
