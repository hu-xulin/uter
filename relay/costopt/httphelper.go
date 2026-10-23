package costopt

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// normalizeBaseURL 归一化 OpenAI 兼容 base 地址：去除首尾空白与结尾斜杠，
// 并剥掉结尾的版本段（/v1），使 base 再拼接 "/v1/..." 时不会拼出双 /v1。
//
// 管理员常按上游文档直接填「带版本段」的地址（如
// https://api.siliconflow.cn/v1），因此这里必须能消化它，而不是让调用方
// 各自判断。规则：
//   - 逐个剥掉结尾重复的版本段（/v1、/V1、/v1/），最多剥到不再以版本段结尾，
//     避免出现 /v1/v1 这类输入被拼成 /v1/v1/v1；
//   - 只认「路径最后一段恰为 vN（数字）」，不会误伤
//     https://api.groq.com/openai/v1beta 这类真实业务路径；
//   - 大小写不敏感（/V1 与 /v1 等价）。
//
// 仅用于「版本段由后端拼接」的端点（embedding / chat / batch）。
// 切勿用于 base 本身含版本段路径的情形（如 value_tier 的
// https://api.groq.com/openai/v1，其 v1 是路径的一部分，不能剥）。
func normalizeBaseURL(base string) string {
	b := strings.TrimSpace(base)
	// 先去掉结尾的所有斜杠，避免 "/v1/" 这种写法绕过下面的剥除。
	b = strings.TrimRight(b, "/")
	// 反复剥掉结尾的版本段。maxIterations 兜底防御异常输入导致死循环。
	for i := 0; i < 4; i++ {
		trimmed := trimTrailingVersionSegment(b)
		if trimmed == b {
			break
		}
		b = strings.TrimRight(trimmed, "/")
	}
	return b
}

// trimTrailingVersionSegment 若 base 的最后一段是 "v" + 数字（如 v1、v2），
// 就去掉该段并返回；否则原样返回。
func trimTrailingVersionSegment(base string) string {
	slash := strings.LastIndexByte(base, '/')
	if slash < 0 {
		return base
	}
	last := base[slash+1:]
	// 长度需为 2 且首字母为 v/V（v1）。刻意不匹配 v1beta 之类的复合版本段。
	if len(last) != 2 || (last[0] != 'v' && last[0] != 'V') {
		return base
	}
	if last[1] < '0' || last[1] > '9' {
		return base
	}
	return base[:slash]
}

// openAIChat 调用 OpenAI 兼容的 /v1/chat/completions，返回首个 choice 文本。
// best-effort：任何错误直接返回错误，由调用方决定降级策略。
func openAIChat(ctx context.Context, base, key, model, system, user string, maxTokens int) (string, error) {
	if base == "" || key == "" || model == "" {
		return "", errMissingEndpoint
	}
	if maxTokens <= 0 {
		maxTokens = 512
	}
	msgs := []map[string]any{{"role": "user", "content": user}}
	if system != "" {
		msgs = append([]map[string]any{{"role": "system", "content": system}}, msgs...)
	}
	payload, err := json.Marshal(map[string]any{
		"model":      model,
		"messages":   msgs,
		"max_tokens": maxTokens,
	})
	if err != nil {
		return "", err
	}
	c, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(c, http.MethodPost, normalizeBaseURL(base)+"/v1/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := common.ReadUpstreamBody(resp.Body)
	if err != nil {
		return "", err
	}
	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &out); err != nil || len(out.Choices) == 0 {
		return "", errMissingEndpoint
	}
	return out.Choices[0].Message.Content, nil
}

// openAIEmbed 调用 OpenAI 兼容的 embeddings 端点，返回每个文本的向量。
// endpoint 为完整请求路径（含前导斜杠），默认 /v1/embeddings；智谱(BigModel/GLM)
// 填 /api/paas/v4/embeddings（此时 base 仅到主机，如 https://open.bigmodel.cn，
// 由后端拼接出 /api/paas/v4/embeddings）。
func openAIEmbed(ctx context.Context, base, key, model, endpoint string, texts []string) ([][]float32, error) {
	if base == "" || key == "" || model == "" || len(texts) == 0 {
		return nil, errMissingEndpoint
	}
	if endpoint == "" {
		endpoint = "/v1/embeddings"
	}
	payload, err := json.Marshal(map[string]any{
		"model": model,
		"input": texts,
	})
	if err != nil {
		return nil, err
	}
	c, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(c, http.MethodPost, normalizeBaseURL(base)+endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := common.ReadUpstreamBody(resp.Body)
	if err != nil {
		return nil, err
	}
	var out struct {
		Data []struct {
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &out); err != nil || len(out.Data) != len(texts) {
		return nil, errMissingEndpoint
	}
	outVecs := make([][]float32, len(out.Data))
	for i, d := range out.Data {
		outVecs[i] = d.Embedding
	}
	return outVecs, nil
}

var errMissingEndpoint = &simpleErr{"costopt: embedding/chat endpoint not configured"}

type simpleErr struct{ msg string }

func (e *simpleErr) Error() string { return e.msg }

// cfgChat 用配置里的端点调用 chat（封装 openAIChat 的 endpoint 缺失判断）。
func cfgChat(ctx context.Context, cfg *costoptcfg.CostOptSetting, base, key, model, system, user string, maxTokens int) (string, error) {
	return openAIChat(ctx, base, key, model, system, user, maxTokens)
}
