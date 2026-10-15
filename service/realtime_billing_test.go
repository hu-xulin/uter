package service

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/uter-ai/uter/model"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/setting/ratio_setting"
	hosttypes "github.com/uter-ai/uter/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A real-time (WSS) session is charged at three points: the session
// pre-consume taken before the socket opens (controller/relay.go), one
// incremental charge per upstream `response.done` event
// (relay/channel/openai/relay_realtime.go -> PreWssConsumeQuota), and the
// settlement of the session total once the socket closes
// (relay/websocket.go -> PostWssConsumeQuota).
//
// Three charge points must still move the wallet exactly once: the user owes
// the settled total, no more. That is the invariant every billing path in this
// package is built around — `BillingSession.reserveFunding` states it for the
// wallet branch: "保证日志记录的预扣额度与用户余额的实际变动始终对账一致".
//
// This test drives the three points in the order the relay does and asserts
// that invariant against the quota on the consume log.
func TestRealtimeSessionChargesSettledQuotaOnce(t *testing.T) {
	const (
		modelName      = "gpt-4o-realtime-preview"
		preConsumed    = 1_000
		balance        = 100_000
		tokenQuota     = 100_000
		trustedBalance = 100_000_000 // above common.GetTrustQuota()
	)

	cases := []struct {
		name       string
		userID     int
		channelID  int
		quota      int
		tokenQuota int
		trusted    bool
	}{
		{
			name:       "pre-consumed wallet",
			userID:     710,
			channelID:  901,
			quota:      balance,
			tokenQuota: tokenQuota,
		},
		{
			name:       "trusted wallet bypasses the pre-consume",
			userID:     711,
			channelID:  902,
			quota:      trustedBalance,
			tokenQuota: trustedBalance,
			trusted:    true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			truncate(t)
			gin.SetMode(gin.TestMode)
			// Production resolves the model ratio through the same map on both
			// charge points, so the pre-consume, the incremental charge and the
			// settlement only differ in how much usage they see.
			modelRatio, _, _ := ratio_setting.GetModelRatio(modelName)
			require.Greater(t, modelRatio, 0.0)
			seedUser(t, tc.userID, tc.quota)
			seedToken(t, tc.userID, tc.userID, fmt.Sprintf("realtime%d", tc.userID), tc.tokenQuota)
			seedChannel(t, tc.channelID)

			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/realtime", nil)
			ctx.Set("token_quota", tc.tokenQuota)

			relayInfo := &relaycommon.RelayInfo{
				UserId:          tc.userID,
				TokenId:         tc.userID,
				TokenKey:        fmt.Sprintf("realtime%d", tc.userID),
				ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: tc.channelID},
				UsingGroup:      "default",
				UserGroup:       "default",
				OriginModelName: modelName,
				UserQuota:       tc.quota,
				UserSetting:     dto.UserSetting{BillingPreference: "wallet_only"},
				StartTime:       time.Now(),
				PriceData: hosttypes.PriceData{
					ModelRatio:      modelRatio,
					CompletionRatio: 1,
					GroupRatioInfo:  hosttypes.GroupRatioInfo{GroupRatio: 1},
				},
			}

			// 1) Session pre-consume, before the socket opens.
			require.Nil(t, PreConsumeBilling(ctx, preConsumed, relayInfo))
			require.NotNil(t, relayInfo.Billing)
			if tc.trusted {
				assert.Equal(t, 0, relayInfo.Billing.GetPreConsumedQuota(),
					"a trusted balance must bypass the pre-consume")
			}

			// 2) One incremental charge per upstream response.done.
			events := realtimeSessionEvents()
			for _, usage := range events {
				require.NoError(t, PreWssConsumeQuota(ctx, relayInfo, usage))
			}

			// 3) Session settlement over the summed usage.
			PostWssConsumeQuota(ctx, relayInfo, modelName, sumRealtimeUsage(events), nil)

			logged := &model.Log{}
			require.NoError(t, model.LOG_DB.
				Where("user_id = ? AND type = ?", tc.userID, model.LogTypeConsume).
				First(logged).Error)
			require.Greater(t, logged.Quota, 0, "the session must be charged for its usage")

			after, err := model.GetUserQuota(tc.userID, false)
			require.NoError(t, err)
			charged := tc.quota - after

			assert.Equal(t, logged.Quota, charged,
				"the wallet must move by exactly the settled quota (charged %d, logged %d)",
				charged, logged.Quota)
		})
	}
}

// realtimeSessionEvents returns the per-`response.done` usage of a two-turn
// session, the shape relay_realtime.go charges incrementally.
func realtimeSessionEvents() []*dto.RealtimeUsage {
	return []*dto.RealtimeUsage{
		{
			TotalTokens:  1_000,
			InputTokens:  800,
			OutputTokens: 200,
			InputTokenDetails: dto.InputTokenDetails{
				TextTokens:  400,
				AudioTokens: 400,
			},
			OutputTokenDetails: dto.OutputTokenDetails{
				TextTokens:  100,
				AudioTokens: 100,
			},
		},
		{
			TotalTokens:  500,
			InputTokens:  300,
			OutputTokens: 200,
			InputTokenDetails: dto.InputTokenDetails{
				TextTokens:  100,
				AudioTokens: 200,
			},
			OutputTokenDetails: dto.OutputTokenDetails{
				TextTokens:  100,
				AudioTokens: 100,
			},
		},
	}
}

// sumRealtimeUsage mirrors what the relay accumulates into `sumUsage` and
// hands to the settlement.
func sumRealtimeUsage(events []*dto.RealtimeUsage) *dto.RealtimeUsage {
	total := &dto.RealtimeUsage{}
	for _, usage := range events {
		total.TotalTokens += usage.TotalTokens
		total.InputTokens += usage.InputTokens
		total.OutputTokens += usage.OutputTokens
		total.InputTokenDetails.TextTokens += usage.InputTokenDetails.TextTokens
		total.InputTokenDetails.AudioTokens += usage.InputTokenDetails.AudioTokens
		total.OutputTokenDetails.TextTokens += usage.OutputTokenDetails.TextTokens
		total.OutputTokenDetails.AudioTokens += usage.OutputTokenDetails.AudioTokens
	}
	return total
}
