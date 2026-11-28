package plugins_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// HappyHorse shares the DashScope video-generation wire format with Wan but
// uses distinct media modalities. These tests pin the request mapping through
// the real openai_video protocol (/v1/videos), the billable usage facts, the
// protocol registration and the plugin meta model declarations.
func TestAlibabaHappyHorseContract(t *testing.T) {
	plugin := newAlibabaPlugin(t)
	for _, tc := range []struct {
		name      string
		model     string
		request   map[string]any
		wantInput map[string]any
		wantRatio string
		wantSecs  float64
		wantRes   string
		wantDur   any // nil means duration must be absent (video-edit)
	}{
		{
			name:  "t2v",
			model: "happyhorse-1.1-t2v",
			request: map[string]any{
				"model": "happyhorse-1.1-t2v", "prompt": "a cat",
				"resolution": "720P", "duration": 5, "ratio": "16:9",
			},
			wantInput: map[string]any{"prompt": "a cat"},
			wantRatio: "16:9", wantSecs: 5, wantRes: "720P", wantDur: float64(5),
		},
		{
			name:  "t2v 1.0",
			model: "happyhorse-1.0-t2v",
			request: map[string]any{
				"model": "happyhorse-1.0-t2v", "prompt": "a dog",
				"resolution": "1080P", "duration": 10,
			},
			wantInput: map[string]any{"prompt": "a dog"},
			wantRatio: "16:9", wantSecs: 10, wantRes: "1080P", wantDur: float64(10),
		},
		{
			name:  "i2v via input_reference",
			model: "happyhorse-1.1-i2v",
			request: map[string]any{
				"model": "happyhorse-1.1-i2v", "prompt": "make it move",
				"input_reference": "https://cdn.example/first.png",
				"resolution":      "720P", "duration": 5,
			},
			wantInput: map[string]any{"prompt": "make it move", "img_url": "https://cdn.example/first.png"},
			wantRatio: "", wantSecs: 5, wantRes: "720P", wantDur: float64(5),
		},
		{
			name:  "r2v reference images",
			model: "happyhorse-1.1-r2v",
			request: map[string]any{
				"model": "happyhorse-1.1-r2v", "prompt": "[Image 1] walks with [Image 2]",
				"media": []any{
					map[string]any{"type": "reference_image", "url": "https://cdn.example/1.png"},
					map[string]any{"type": "reference_image", "url": "https://cdn.example/2.png"},
				},
				"resolution": "720P", "duration": 5,
			},
			wantInput: map[string]any{
				"prompt": "[Image 1] walks with [Image 2]",
				"media": []any{
					map[string]any{"type": "reference_image", "url": "https://cdn.example/1.png"},
					map[string]any{"type": "reference_image", "url": "https://cdn.example/2.png"},
				},
			},
			wantRatio: "16:9", wantSecs: 5, wantRes: "720P", wantDur: float64(5),
		},
		{
			name:  "video-edit no duration",
			model: "happyhorse-1.0-video-edit",
			request: map[string]any{
				"model": "happyhorse-1.0-video-edit", "prompt": "change the style",
				"media":      []any{map[string]any{"type": "video", "url": "https://cdn.example/in.mp4"}},
				"resolution": "1080P", "duration": 99,
			},
			wantInput: map[string]any{
				"prompt": "change the style",
				"media":  []any{map[string]any{"type": "video", "url": "https://cdn.example/in.mp4"}},
			},
			wantRatio: "", wantSecs: 15, wantRes: "1080P", wantDur: nil,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body, facts, url := submitAlibabaRequest(t, plugin, tc.model, tc.request)
			assert.Equal(t, "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis", url)
			assert.Equal(t, tc.model, body["model"])
			assert.Equal(t, tc.wantInput, body["input"])

			params := body["parameters"].(map[string]any)
			assert.Equal(t, tc.wantRes, params["resolution"])
			if tc.wantRatio != "" {
				assert.Equal(t, tc.wantRatio, params["ratio"])
			} else {
				assert.NotContains(t, params, "ratio")
			}
			if tc.wantDur == nil {
				assert.NotContains(t, params, "duration")
			} else {
				assert.Equal(t, tc.wantDur, params["duration"])
			}
			assert.Equal(t, tc.wantSecs, facts["seconds"])
			assert.Equal(t, tc.wantRes, facts["resolution"])
		})
	}
}

func TestAlibabaHappyHorseDeclaredAndRouted(t *testing.T) {
	plugin := newAlibabaPlugin(t)
	models := []string{
		"happyhorse-1.0-t2v", "happyhorse-1.0-i2v", "happyhorse-1.0-r2v", "happyhorse-1.0-video-edit",
		"happyhorse-1.1-t2v", "happyhorse-1.1-i2v", "happyhorse-1.1-r2v",
	}
	for _, model := range models {
		assert.Contains(t, plugin.Meta.Models, model, "model must be declared in plugin meta")
		schema, _ := plugin.Meta.UsageForModel(model)
		resolution, ok := schema["resolution"]
		require.True(t, ok, "model must have a resolution usage fact: "+model)
		assert.Equal(t, []string{"720P", "1080P"}, resolution.Enum)
	}
}

func TestAlibabaHappyHorseValidation(t *testing.T) {
	plugin := newAlibabaPlugin(t)
	t.Run("r2v rejects missing reference images", func(t *testing.T) {
		_, err := plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
			"requestBody":   map[string]any{"model": "happyhorse-1.1-r2v", "prompt": "no images"},
			"upstreamModel": "happyhorse-1.1-r2v",
		})
		require.ErrorContains(t, err, "requires at least one reference_image")
	})
	t.Run("video-edit rejects missing video", func(t *testing.T) {
		_, err := plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
			"requestBody":   map[string]any{"model": "happyhorse-1.0-video-edit", "prompt": "no video"},
			"upstreamModel": "happyhorse-1.0-video-edit",
		})
		require.ErrorContains(t, err, "requires exactly one video")
	})
	t.Run("t2v rejects duration below 3", func(t *testing.T) {
		_, err := plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
			"requestBody":   map[string]any{"model": "happyhorse-1.1-t2v", "prompt": "a cat", "duration": 2},
			"upstreamModel": "happyhorse-1.1-t2v",
		})
		require.ErrorContains(t, err, "duration must be an integer between 3 and 15")
	})
	t.Run("r2v rejects 480P", func(t *testing.T) {
		_, err := plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
			"requestBody": map[string]any{
				"model": "happyhorse-1.1-r2v", "prompt": "x",
				"media":      []any{map[string]any{"type": "reference_image", "url": "https://cdn.example/1.png"}},
				"resolution": "480P",
			},
			"upstreamModel": "happyhorse-1.1-r2v",
		})
		require.ErrorContains(t, err, "resolution must be one of 720P, 1080P")
	})
}
