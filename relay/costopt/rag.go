package costopt

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/uter-ai/uter/relaykit/dto"
)

// RAGEnabled 是否启用精准 RAG（需配置外部 RAG 端点）。
func RAGEnabled() bool {
	cfg := costoptcfg.GetCostOptSetting()
	return cfg.RAGEnabled && cfg.RAGEndpoint != ""
}

// ragSnippet 外部 RAG 服务返回的一条检索片段。
// 兼容两种常见返回形态：{"snippets":[...]} 与直接数组 [ ... ]。
type ragSnippet struct {
	Text     string  `json:"text"`
	Content  string  `json:"content"`
	Score    float64 `json:"score"`
	Distance float64 `json:"distance"`
}

func (s ragSnippet) body() string {
	if s.Text != "" {
		return s.Text
	}
	return s.Content
}

// 得分归一：有 score 直接用；只有 distance（越小越近）时折算成 1/(1+distance)。
func (s ragSnippet) normalized() float64 {
	if s.Score != 0 {
		return s.Score
	}
	if s.Distance != 0 {
		return 1 / (1 + s.Distance)
	}
	return 0
}

type ragResponse struct {
	Snippets []ragSnippet `json:"snippets"`
	Results  []ragSnippet `json:"results"`
	Data     []ragSnippet `json:"data"`
}

// buildRAGQuery 用最后 N 条消息拼检索 query（默认最后 2 条，兼顾上下文与时效）。
func buildRAGQuery(req *dto.GeneralOpenAIRequest, n int) string {
	if n <= 0 {
		n = 2
	}
	if len(req.Messages) == 0 {
		return ""
	}
	start := len(req.Messages) - n
	if start < 0 {
		start = 0
	}
	var b strings.Builder
	for _, m := range req.Messages[start:] {
		if m.Role == "system" {
			continue // 系统指令不参与检索，避免污染 query
		}
		if t := m.StringContent(); t != "" {
			if b.Len() > 0 {
				b.WriteString("\n")
			}
			b.WriteString(t)
		}
	}
	return b.String()
}

// queryRAG 调用外部 RAG 端点做检索（best-effort：任何错误都返回 error，由调用方降级）。
func queryRAG(ctx context.Context, cfg *costoptcfg.CostOptSetting, query string) ([]ragSnippet, error) {
	topK := cfg.RAGTopK
	if topK <= 0 {
		topK = 4
	}
	payload, err := json.Marshal(map[string]any{
		"query":           query,
		"top_k":           topK,
		"score_threshold": cfg.RAGScoreThreshold,
		"rerank":          cfg.RAGRerankEnabled,
		"rerank_model":    cfg.RAGRerankModel,
	})
	if err != nil {
		return nil, err
	}

	timeout := time.Duration(cfg.RAGTimeoutMS) * time.Millisecond
	if timeout <= 0 {
		timeout = 1500 * time.Millisecond
	}
	c, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(c, http.MethodPost, cfg.RAGEndpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if cfg.RAGAPIKey != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.RAGAPIKey)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, &simpleErr{"costopt: rag endpoint returned " + resp.Status}
	}

	var parsed ragResponse
	if err := json.Unmarshal(body, &parsed); err == nil {
		all := append(append(append([]ragSnippet{}, parsed.Snippets...), parsed.Results...), parsed.Data...)
		return filterAndSortSnippets(all, cfg, topK), nil
	}
	// 直接数组形态
	var arr []ragSnippet
	if err := json.Unmarshal(body, &arr); err != nil {
		return nil, err
	}
	return filterAndSortSnippets(arr, cfg, topK), nil
}

// filterAndSortSnippets 按 score 阈值过滤（紧 top-k 的关键）+ 排序 + 截断。
func filterAndSortSnippets(in []ragSnippet, cfg *costoptcfg.CostOptSetting, topK int) []ragSnippet {
	out := make([]ragSnippet, 0, len(in))
	for _, s := range in {
		if strings.TrimSpace(s.body()) == "" {
			continue
		}
		if cfg.RAGScoreThreshold > 0 && s.normalized() < cfg.RAGScoreThreshold {
			continue
		}
		out = append(out, s)
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].normalized() > out[j].normalized() })
	if len(out) > topK {
		out = out[:topK]
	}
	return out
}

// renderRAGBlock 把片段渲染成待注入的上下文块，并按 token 预算粗截断。
func renderRAGBlock(cfg *costoptcfg.CostOptSetting, snippets []ragSnippet) string {
	maxTokens := cfg.RAGMaxContextTokens
	if maxTokens <= 0 {
		maxTokens = 2048
	}
	// 粗估：1 token ≈ 3.5 字符（中文按 1 字符 1 token 更保守，这里取 3 折中）。
	maxChars := maxTokens * 3
	var b strings.Builder
	b.WriteString("以下是与本次问题高度相关的资料片段，请优先基于这些资料回答；资料未涵盖的部分再依据通用知识：\n\n")
	for i, s := range snippets {
		chunk := "[" + strconv.Itoa(i+1) + "] " + strings.TrimSpace(s.body())
		if b.Len()+len(chunk) > maxChars {
			remain := maxChars - b.Len()
			if remain > 32 {
				b.WriteString(chunk[:remain])
				b.WriteString(" …（已截断）")
			}
			break
		}
		b.WriteString(chunk)
		b.WriteString("\n")
	}
	if b.Len() == 0 {
		return ""
	}
	return strings.TrimRight(b.String(), "\n")
}

// injectRAG 把上下文块注入到 system（默认）或最后一条 user 消息前。
func injectRAG(req *dto.GeneralOpenAIRequest, cfg *costoptcfg.CostOptSetting, block string) {
	if cfg.RAGInjectPosition == "user" {
		for i := len(req.Messages) - 1; i >= 0; i-- {
			if req.Messages[i].Role == "user" {
				orig := req.Messages[i].StringContent()
				req.Messages[i].SetStringContent(block + "\n\n" + orig)
				return
			}
		}
	}
	// 默认注入 system：复用已有 system 则前插，否则新建一条置顶。
	for i := range req.Messages {
		if req.Messages[i].Role == "system" {
			orig := req.Messages[i].StringContent()
			req.Messages[i].SetStringContent(block + "\n\n" + orig)
			return
		}
	}
	req.Messages = append([]dto.Message{{Role: "system", Content: block}}, req.Messages...)
}

// RetrieveRAG 调用外部 RAG 系统检索上下文并注入请求（best-effort，失败不阻塞）。
// V2.2：由「仅钩子」升级为完整能力——真实发起检索、按阈值紧 top-k、可选重排、
// 按 token 预算截断，再注入 system 或 user。任一步失败均静默返回 false。
func RetrieveRAG(ctx context.Context, req *dto.GeneralOpenAIRequest) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !RAGEnabled() || req == nil {
		return false
	}
	IncRAGRequest()
	query := buildRAGQuery(req, cfg.RAGQueryFromLastN)
	if strings.TrimSpace(query) == "" {
		return false
	}
	snippets, err := queryRAG(ctx, cfg, query)
	if err != nil || len(snippets) == 0 {
		return false
	}
	block := renderRAGBlock(cfg, snippets)
	if block == "" {
		return false
	}
	// 净收益闸门：注入上下文会增加输入 token，若其相对原始 prompt 过大（或超绝对上限），
	// 视为净负（实测：注入 +200 token 却无任何可测节省 → 纯亏），自动跳过注入。
	if cfg.RAGNetBenefitEnabled && !ragNetBenefitPasses(cfg, block, req.Messages) {
		IncRAGSkipped()
		return false
	}
	injectRAG(req, cfg, block)
	IncRAGHit()
	return true
}

// estimateTokens 粗估字符串的 token 数（中文按约 1 token/字符、英文约 3 字符/token，取折中 3）。
func estimateTokens(s string) int {
	return len([]rune(s)) / 3
}

// ragNetBenefitPasses 净收益闸门判定：注入上下文是否值得（纯函数，便于单测）。
// 注入 token 相对原始 prompt 过大、或超过绝对上限时视为净负，返回 false（应跳过注入）。
func ragNetBenefitPasses(cfg *costoptcfg.CostOptSetting, block string, msgs []dto.Message) bool {
	injectedTokens := estimateTokens(block)
	if cfg.RAGMaxInjectedTokens > 0 && injectedTokens > cfg.RAGMaxInjectedTokens {
		return false
	}
	if cfg.RAGInjectedVsPromptTokensRatio > 0 {
		promptTokens := estimateMessagesTokens(msgs)
		if promptTokens > 0 && float64(injectedTokens) > cfg.RAGInjectedVsPromptTokensRatio*float64(promptTokens) {
			return false
		}
	}
	return true
}

// estimateMessagesTokens 粗估一组消息的总 token 数（仅用于 RAG 净收益闸门，近似即可）。
func estimateMessagesTokens(msgs []dto.Message) int {
	total := 0
	for i := range msgs {
		total += len([]rune(msgs[i].StringContent()))
	}
	return total / 3
}
