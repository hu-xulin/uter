package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

func TestFetchAuthorizedUterAPIUpdateModelIDsUsesGroupAuthorization(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/pricing":
			_, _ = w.Write([]byte(`{"success":true,"data":[
				{"model_name":"model-a","enable_groups":["Group A"],"billing_mode":"tiered_expr","billing_expr":"p"},
				{"model_name":"model-b","enable_groups":["Group B"],"billing_mode":"tiered_expr","billing_expr":"p"}
			],"group_ratio":{"Group A":1,"Group B":1}}`))
		case "/v1/models":
			_, _ = w.Write([]byte(`{"data":[{"id":"model-a"},{"id":"model-b"}]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)

	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{
		service.GenericUpstreamBillingGroupKey: `{"77":"Group A"}`,
	}
	t.Cleanup(func() { common.OptionMap = previousOptions })

	previousBase := uterapiBaseURLForTest
	uterapiBaseURLForTest = server.URL
	t.Cleanup(func() { uterapiBaseURLForTest = previousBase })

	base := server.URL
	channel := &model.Channel{
		Id: 77, Type: constant.ChannelTypeUterAPI, Name: "Uter.api",
		BaseURL: &base, Key: "sk-fix", Models: "model-a",
	}
	models, err := fetchAuthorizedUterAPIUpdateModelIDs(channel)
	require.NoError(t, err)
	assert.Equal(t, []string{"model-a"}, models)
}

func TestFetchAuthorizedUterAPIUpdateModelIDsFailsClosedWithoutGroup(t *testing.T) {
	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = previousOptions })

	base := "https://uterapi.test"
	channel := &model.Channel{
		Id: 78, Type: constant.ChannelTypeUterAPI, Name: "Uter.api",
		BaseURL: &base, Key: "sk-fix", Models: "model-a",
	}
	_, err := fetchAuthorizedUterAPIUpdateModelIDs(channel)
	require.Error(t, err)
	assert.True(t, strings.Contains(err.Error(), "billing group"))
}
