package dto

import (
	"testing"

	kitutil "github.com/uter-ai/uter/relaykit/relayconvert/kitutil"
)

func TestNormalizeCacheTokens_AnthropicNested(t *testing.T) {
	var u Usage
	if err := kitutil.Unmarshal([]byte(`{"prompt_tokens_details":{"cache_read_input_tokens":100,"cache_creation_input_tokens":50}}`), &u); err != nil {
		t.Fatal(err)
	}
	u.NormalizeCacheTokens()
	if u.PromptTokensDetails.CachedTokens != 100 {
		t.Fatalf("CachedTokens = %d, want 100", u.PromptTokensDetails.CachedTokens)
	}
	if u.PromptTokensDetails.CacheWriteTokens != 50 {
		t.Fatalf("CacheWriteTokens = %d, want 50", u.PromptTokensDetails.CacheWriteTokens)
	}
	if u.PromptTokensDetails.CacheCreationTokensTotal() != 50 {
		t.Fatalf("CacheCreationTokensTotal = %d, want 50", u.PromptTokensDetails.CacheCreationTokensTotal())
	}
}

func TestNormalizeCacheTokens_AnthropicTopLevel(t *testing.T) {
	var u Usage
	if err := kitutil.Unmarshal([]byte(`{"cache_read_input_tokens":200,"cache_creation_input_tokens":60}`), &u); err != nil {
		t.Fatal(err)
	}
	u.NormalizeCacheTokens()
	if u.PromptTokensDetails.CachedTokens != 200 {
		t.Fatalf("CachedTokens = %d, want 200", u.PromptTokensDetails.CachedTokens)
	}
	if u.PromptTokensDetails.CacheWriteTokens != 60 {
		t.Fatalf("CacheWriteTokens = %d, want 60", u.PromptTokensDetails.CacheWriteTokens)
	}
}

func TestNormalizeCacheTokens_DeepSeekPromptCacheHit(t *testing.T) {
	var u Usage
	if err := kitutil.Unmarshal([]byte(`{"prompt_cache_hit_tokens":300}`), &u); err != nil {
		t.Fatal(err)
	}
	u.NormalizeCacheTokens()
	if u.PromptTokensDetails.CachedTokens != 300 {
		t.Fatalf("CachedTokens = %d, want 300", u.PromptTokensDetails.CachedTokens)
	}
}

func TestNormalizeCacheTokens_CanonicalWins(t *testing.T) {
	var u Usage
	// 上游同时在规范键与 Anthropic 键上报，规范键必须胜出、不被覆盖。
	if err := kitutil.Unmarshal([]byte(`{"prompt_tokens_details":{"cached_tokens":10,"cache_read_input_tokens":999}}`), &u); err != nil {
		t.Fatal(err)
	}
	u.NormalizeCacheTokens()
	if u.PromptTokensDetails.CachedTokens != 10 {
		t.Fatalf("CachedTokens = %d, want 10 (canonical must win)", u.PromptTokensDetails.CachedTokens)
	}
}

func TestNormalizeCacheTokens_OpenAINativeUnchanged(t *testing.T) {
	var u Usage
	if err := kitutil.Unmarshal([]byte(`{"prompt_tokens_details":{"cached_tokens":5,"cache_write_tokens":7}}`), &u); err != nil {
		t.Fatal(err)
	}
	u.NormalizeCacheTokens()
	if u.PromptTokensDetails.CachedTokens != 5 || u.PromptTokensDetails.CacheWriteTokens != 7 {
		t.Fatalf("CachedTokens=%d CacheWriteTokens=%d, want 5/7", u.PromptTokensDetails.CachedTokens, u.PromptTokensDetails.CacheWriteTokens)
	}
}

// 转换链路（如 OAI→Responses→OAI）可能把 Anthropic 风格 cache 键搬进
// InputTokensDetails 兄弟字段，归一化仍须能折叠进规范字段。
func TestNormalizeCacheTokens_FromInputTokensDetails(t *testing.T) {
	u := Usage{
		InputTokensDetails: &InputTokenDetails{
			CacheReadInputTokens:     120,
			CacheCreationInputTokens: 45,
		},
	}
	u.NormalizeCacheTokens()
	if u.PromptTokensDetails.CachedTokens != 120 {
		t.Fatalf("CachedTokens = %d, want 120", u.PromptTokensDetails.CachedTokens)
	}
	if u.PromptTokensDetails.CacheWriteTokens != 45 {
		t.Fatalf("CacheWriteTokens = %d, want 45", u.PromptTokensDetails.CacheWriteTokens)
	}
}
