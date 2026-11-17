package plugins

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/pkg/jsplugin"
)

// runBuiltInRequestPluginHook validates config against the plugin schema, as
// the host does when an instance is saved, then runs one stage hook.
func runBuiltInRequestPluginHook(t *testing.T, key, stage, config string, req jsplugin.TransformRequest) jsplugin.TransformResult {
	t.Helper()
	plugin, found := jsplugin.DefaultRegistry.Generation().Get(key)
	require.True(t, found, key)
	validated, err := plugin.ValidateConfig(json.RawMessage(config))
	require.NoError(t, err)
	result, err := plugin.CallTransform(t.Context(), jsplugin.TransformContext{
		Stage:         stage,
		Format:        "openai",
		Path:          "/v1/chat/completions",
		Model:         "gpt-test",
		UpstreamModel: "gpt-test",
		Group:         "default",
		Instance:      jsplugin.TransformInstance{ID: "rp_builtin0001", Name: "test"},
		Config:        validated,
	}, req)
	if err != nil {
		var te *jsplugin.TransformError
		if errors.As(err, &te) {
			t.Fatalf("plugin %s hook %s failed: class=%s thrown=%s", key, stage, te.Class, te.Thrown)
		}
		t.Fatalf("plugin %s hook %s failed: %v", key, stage, err)
	}
	return result
}

func runBuiltInRequestPlugin(t *testing.T, key, stage, config, body string) jsplugin.TransformResult {
	t.Helper()
	return runBuiltInRequestPluginHook(t, key, stage, config, jsplugin.TransformRequest{Body: json.RawMessage(body)})
}

func TestBuiltInRequestPluginsLoadWithValidConfig(t *testing.T) {
	cases := map[string]string{
		"auto-reasoning":     `{"rules":[{"minTools":1,"effort":"high"}]}`,
		"content-moderation": `{"url":"https://api.openai.com/v1/moderations"}`,
		"image-compress":     `{}`,
		"param-override":     `{"override":{"operations":[{"path":"temperature","mode":"set","value":0.7}]}}`,
		"request-filter":     `{"rules":[{"id":"k","pattern":"blocked"}]}`,
		"request-redact":     `{"categories":["email"]}`,
	}
	for key, config := range cases {
		t.Run(key, func(t *testing.T) {
			plugin, found := jsplugin.DefaultRegistry.Generation().Get(key)
			require.True(t, found, key)
			assert.True(t, plugin.Meta.HasTransformPart(), "request plugin must expose a transform part")
			_, err := plugin.ValidateConfig(json.RawMessage(config))
			require.NoError(t, err)
		})
	}
}

func TestRequestFilterRejectsBlockedText(t *testing.T) {
	result := runBuiltInRequestPlugin(t, "request-filter", "ingress",
		`{"rules":[{"id":"k","pattern":"blocked"}]}`,
		`{"model":"gpt-test","messages":[{"role":"user","content":"blocked words"}]}`)
	assert.Equal(t, "reject", result.Action)
	assert.Equal(t, "request_filtered", result.Code)
	assert.Equal(t, "k", result.RuleID)
}

func TestRequestRedactRedactsEmail(t *testing.T) {
	result := runBuiltInRequestPlugin(t, "request-redact", "ingress",
		`{"categories":["email"]}`,
		`{"model":"gpt-test","messages":[{"role":"user","content":"write to a@example.com"}]}`)
	assert.Equal(t, "continue", result.Action)
	assert.NotNil(t, result.Effects)
	require.NotEmpty(t, result.Findings)
	assert.Equal(t, "email", result.Findings[0].Category)
}

func TestParamOverrideAppliesOutboundPatch(t *testing.T) {
	result := runBuiltInRequestPlugin(t, "param-override", "outbound",
		`{"override":{"operations":[{"path":"temperature","mode":"set","value":0.7}]}}`,
		`{"model":"gpt-test","temperature":0.2}`)
	assert.Equal(t, "continue", result.Action)
	require.NotNil(t, result.Effects)
	assert.Contains(t, string(result.Effects), "json.patch")
}

func TestAutoReasoningSetsEffortFromSummary(t *testing.T) {
	result := runBuiltInRequestPluginHook(t, "auto-reasoning", "request",
		`{"rules":[{"minTools":1,"effort":"high"}]}`,
		jsplugin.TransformRequest{
			Body:    json.RawMessage(`{"model":"gpt-test","messages":[{"role":"user","content":"hi"}]}`),
			Summary: &jsplugin.TransformSummary{ToolCount: 2},
		})
	assert.Equal(t, "continue", result.Action)
	require.NotNil(t, result.Effects)
	assert.Contains(t, string(result.Effects), "reasoning.set")
}

func TestImageCompressReencodesLargeImage(t *testing.T) {
	result := runBuiltInRequestPluginHook(t, "image-compress", "outbound",
		`{"mode":"lossless","minBytes":1000}`,
		jsplugin.TransformRequest{
			Body:  json.RawMessage(`{"model":"gpt-test","messages":[{"role":"user","content":"[media:0]"}]}`),
			Media: []jsplugin.TransformMedia{{Index: 0, Path: "/messages/0/content", MimeType: "image/png", Bytes: 2000}},
		})
	assert.Equal(t, "continue", result.Action)
	require.NotNil(t, result.Effects)
	assert.Contains(t, string(result.Effects), "media.reencode")
}
