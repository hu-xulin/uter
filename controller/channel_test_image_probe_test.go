package controller

import (
	"testing"

	"github.com/Uter-AI/Uter/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

/*
 * Regression tests for the channel-test probe request.
 *
 * The bug these cover: `testChannel` routes an image-generation model to
 * `/v1/images/generations`, which makes `RelayInfo.RelayMode` become
 * `RelayModeImagesGenerations`. `buildTestRequest` had no image branch in its
 * auto-detection path, so it fell through and returned a
 * `GeneralOpenAIRequest`. The type assertion in `testChannel` then failed and
 * the model was reported as `invalid image request type` — a local failure
 * (`time: 0`) that never reached the upstream, even though the model was
 * healthy. Every image model on a branded-aggregate channel was affected.
 *
 * The invariant these assert is that the request type `buildTestRequest`
 * returns must match the relay mode `testChannel` selects for the same model,
 * because the two are switched on in different places.
 */

// TestBuildTestRequest_MatchesAutoDetectedRelayMode pins the agreement for
// every model family `testChannel` auto-detects. A mismatch here is what turns
// a healthy model into a local "invalid <kind> request type" failure.
func TestBuildTestRequest_MatchesAutoDetectedRelayMode(t *testing.T) {
	cases := []struct {
		model string
		want  any // one of *dto.ImageRequest, *dto.EmbeddingRequest, ...
	}{
		// Image models: routed to /v1/images/generations by
		// common.IsImageGenerationModel.
		{model: "gpt-image-2", want: &dto.ImageRequest{}},
		{model: "gpt-image-2.5-flare", want: &dto.ImageRequest{}},
		{model: "gpt-image-1.5", want: &dto.ImageRequest{}},
		{model: "qwen-image-2.0-pro", want: &dto.ImageRequest{}},
		{model: "wan2.7-image-pro", want: &dto.ImageRequest{}},
		{model: "doubao-seedream-4-5-251128", want: &dto.ImageRequest{}},
		// Chat-native image models (Gemini's "-image" variants) are NOT in
		// ImageGenerationModels on purpose — they answer on /v1/chat/completions
		// and return an image in the reply, so they must stay a chat request.
		{model: "gemini-3.1-flash-image-preview", want: &dto.GeneralOpenAIRequest{}},
		{model: "gemini-3-pro-image-preview", want: &dto.GeneralOpenAIRequest{}},
		// Embeddings / rerank keep their own request types.
		{model: "text-embedding-3-large", want: &dto.EmbeddingRequest{}},
		{model: "bge-reranker-v2", want: &dto.RerankRequest{}},
		// Ordinary chat.
		{model: "gpt-4o-mini", want: &dto.GeneralOpenAIRequest{}},
		{model: "claude-sonnet-4-6", want: &dto.GeneralOpenAIRequest{}},
	}

	for _, tc := range cases {
		t.Run(tc.model, func(t *testing.T) {
			got := buildTestRequest(tc.model, "", nil, false)
			require.NotNil(t, got, "buildTestRequest must not return nil")
			assert.IsType(t, tc.want, got,
				"request type must match the relay mode testChannel picks for %q", tc.model)
		})
	}
}

// TestBuildTestRequest_ImageProbeFields checks the probe itself is well formed:
// a real prompt, exactly one image, and the size the model actually accepts.
// Seedream rejects anything under 3686400 pixels, which is why it gets its own
// size rather than the 1024x1024 default.
func TestBuildTestRequest_ImageProbeFields(t *testing.T) {
	t.Run("default size", func(t *testing.T) {
		req, ok := buildTestRequest("gpt-image-2", "", nil, false).(*dto.ImageRequest)
		require.True(t, ok, "image model must yield an ImageRequest")
		assert.NotEmpty(t, req.Prompt, "an image probe needs a drawable prompt")
		require.NotNil(t, req.N)
		assert.Equal(t, uint(1), *req.N)
		assert.Equal(t, "1024x1024", req.Size)
	})

	t.Run("seedream size clears the upstream minimum", func(t *testing.T) {
		req, ok := buildTestRequest("doubao-seedream-4-5-251128", "", nil, false).(*dto.ImageRequest)
		require.True(t, ok)
		assert.Equal(t, "1920x1920", req.Size,
			"seedream rejects probes below 3686400 pixels")
	})
}

// TestChannelTestChatPrompt covers the prompt an image-capable chat model is
// probed with. A chat-native image model rejects a prompt that asks it to
// *describe* a picture rather than *make* one, so the wording matters: the
// upstream answers `prompt_not_image` otherwise, and a healthy model is
// recorded as a channel failure.
func TestChannelTestChatPrompt(t *testing.T) {
	assert.Equal(t, "hi", channelTestChatPrompt("gpt-4o-mini"),
		"plain text models keep the cheap probe")

	for _, model := range []string{
		"gemini-3.1-flash-image-preview",
		"gemini-3-pro-image-preview",
		"gpt-image-2",
		"doubao-seedream-4-5-251128",
	} {
		prompt := channelTestChatPrompt(model)
		assert.NotEqual(t, "hi", prompt,
			"%q is image-capable and must not be probed with a bare greeting", model)
		assert.Contains(t, prompt, "image",
			"%q needs a prompt naming an image to produce", model)
	}
}

// TestBuildTestRequest_ImageBranchAlsoUnderExplicitEndpoint covers the other
// entry point: when the caller passes endpoint_type=image_generation the
// request was already built correctly, so this pins that both paths agree.
func TestBuildTestRequest_ImageBranchAlsoUnderExplicitEndpoint(t *testing.T) {
	auto := buildTestRequest("gpt-image-2", "", nil, false)
	explicit := buildTestRequest("gpt-image-2", "image_generation", nil, false)

	autoReq, ok := auto.(*dto.ImageRequest)
	require.True(t, ok)
	explicitReq, ok := explicit.(*dto.ImageRequest)
	require.True(t, ok)

	assert.Equal(t, autoReq.Prompt, explicitReq.Prompt)
	assert.Equal(t, autoReq.Size, explicitReq.Size)
}