package controller

import (
	"testing"

	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Aggregate upstreams (a single branded URL fronting many providers) expose
// image and video models on dedicated endpoints only. Probing them through
// /v1/chat/completions made a healthy channel report dozens of false failures,
// so the probe has to follow the model's real endpoint.
func TestChannelTestRoutesImageModelsToImageEndpoint(t *testing.T) {
	imageModels := []string{
		"gpt-image-2",
		"gpt-image-1.5",
		"gpt-image-2.5-flare",
		"qwen-image-2.0-pro",
		"wan2.7-image-pro",
		"doubao-seedream-5-0-260128",
		"doubao-seedream-4-5-251128",
		"doubao-seedream-4-0-250828",
	}
	for _, name := range imageModels {
		t.Run(name, func(t *testing.T) {
			request := buildTestRequest(name, string(constant.EndpointTypeImageGeneration), nil, false)
			imageRequest, ok := request.(*dto.ImageRequest)
			require.True(t, ok, "image models must build an ImageRequest")
			assert.Equal(t, name, imageRequest.Model)
			assert.NotEmpty(t, imageRequest.Prompt)
			assert.NotEmpty(t, imageRequest.Size)
		})
	}
}

// Seedream rejects anything under 3686400 pixels, so the fixed 1024x1024 probe
// would keep reporting a false failure even after the endpoint was corrected.
func TestChannelTestImageSizeAccommodatesSeedreamMinimum(t *testing.T) {
	assert.Equal(t, "1920x1920", channelTestImageSize("doubao-seedream-5-0-260128"))
	assert.Equal(t, "1024x1024", channelTestImageSize("gpt-image-2"))
	assert.Equal(t, "1024x1024", channelTestImageSize("qwen-image-2.0-pro"))
}

// Video generation is asynchronous and cannot be verified by a synchronous
// probe, so these must be recognised instead of being sent to a chat endpoint.
func TestIsVideoGenerationModel(t *testing.T) {
	videoModels := []string{
		"doubao-seedance-2-0-260128",
		"doubao-seedance-2-0-fast-260128",
		"happyhorse-1.0-video-edit",
		"happyhorse-1.1-i2v",
		"happyhorse-1.1-r2v",
		"happyhorse-1.1-t2v",
		"sora-2",
		"veo-3.0-generate-001",
	}
	for _, name := range videoModels {
		assert.True(t, isVideoGenerationModel(name), name)
	}

	// Text and image models must not be mistaken for video, otherwise healthy
	// channels would stop being testable.
	for _, name := range []string{
		"claude-opus-5",
		"claude-fable-5",
		"gemini-3.1-pro-preview",
		"deepseek-v4-pro",
		"gpt-6-astra",
		"qwen3.7-max",
		"glm-5.2",
		"kimi-k2.5",
		"gpt-image-2",
		"qwen-image-2.0-pro",
		"doubao-seedream-5-0-260128",
	} {
		assert.False(t, isVideoGenerationModel(name), name)
	}
}

// Chat-native image models reject a prompt that describes nothing drawable, so
// the probe must describe something for them while staying harmless for text.
func TestChannelTestChatPromptDescribesImageModels(t *testing.T) {
	for _, name := range []string{"gemini-3-pro-image-preview", "gemini-2.5-flash-image"} {
		prompt := channelTestChatPrompt(name)
		assert.NotEqual(t, "hi", prompt, name)
		assert.Contains(t, prompt, "cat", name)
	}
	for _, name := range []string{"claude-opus-5", "gpt-6-astra", "deepseek-v4-pro"} {
		assert.Equal(t, "hi", channelTestChatPrompt(name), name)
	}
}
