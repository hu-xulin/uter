package service

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/model"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	relaytypes "github.com/uter-ai/uter/relaykit/types"
	hosttypes "github.com/uter-ai/uter/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Settlement deducts a wallet without a lower bound — a failed request still
// consumed upstream tokens, and the consume log has to match the balance — so
// admission is the only place the overdraw can be bounded. It used to read the
// balance straight from the cache, which a burst of concurrent requests all
// read before any of them had settled; the floor was therefore evaluated
// against a number nobody had subtracted from yet.
func TestWalletAdmissionHonorsTheDebtFloor(t *testing.T) {
	const preConsume = 1_000

	cases := []struct {
		name        string
		userID      int
		balance     int
		floorEnv    string
		wantRefused bool
	}{
		{
			name:        "a zero balance is refused",
			userID:      720,
			balance:     0,
			wantRefused: true,
		},
		{
			name:        "a negative balance is refused",
			userID:      721,
			balance:     -5_000,
			wantRefused: true,
		},
		{
			name:    "a healthy balance that covers the pre-charge is admitted",
			userID:  722,
			balance: 10_000,
		},
		{
			name:        "a configured floor refuses a balance sitting on it",
			userID:      723,
			balance:     5_000,
			floorEnv:    "5000",
			wantRefused: true,
		},
		{
			name:     "a configured floor still admits a balance above it",
			userID:   724,
			balance:  5_001,
			floorEnv: "5000",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			truncate(t)
			gin.SetMode(gin.TestMode)
			if tc.floorEnv != "" {
				t.Setenv("WALLET_DEBT_FLOOR_QUOTA", tc.floorEnv)
			}
			seedUser(t, tc.userID, tc.balance)
			seedToken(t, tc.userID, tc.userID, fmt.Sprintf("floor%d", tc.userID), 1_000_000)
			seedChannel(t, 903)

			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			ctx.Set("token_quota", 1_000_000)

			relayInfo := &relaycommon.RelayInfo{
				UserId:          tc.userID,
				TokenId:         tc.userID,
				TokenKey:        fmt.Sprintf("floor%d", tc.userID),
				ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 903},
				UsingGroup:      "default",
				UserGroup:       "default",
				OriginModelName: "gpt-4o",
				UserSetting:     dto.UserSetting{BillingPreference: "wallet_only"},
				StartTime:       time.Now(),
				PriceData: hosttypes.PriceData{
					ModelRatio:      1,
					CompletionRatio: 1,
					GroupRatioInfo:  hosttypes.GroupRatioInfo{GroupRatio: 1},
				},
			}

			apiErr := PreConsumeBilling(ctx, preConsume, relayInfo)

			if tc.wantRefused {
				require.NotNil(t, apiErr, "admission must be refused")
				assert.Equal(t, relaytypes.ErrorCodeInsufficientUserQuota, apiErr.GetErrorCode())
				balance, err := model.GetUserQuota(tc.userID, true)
				require.NoError(t, err)
				assert.Equal(t, tc.balance, balance, "a refused request must not move the balance")
				return
			}

			require.Nil(t, apiErr)
			require.NotNil(t, relayInfo.Billing)
			balance, err := model.GetUserQuota(tc.userID, true)
			require.NoError(t, err)
			assert.Equal(t, tc.balance-preConsume, balance)
		})
	}
}

// The floor is read from the environment on every call so an operator can raise
// it without a rebuild; a negative value would permit unbounded debt and is
// normalised away.
func TestWalletDebtFloorNormalisesNegativeValues(t *testing.T) {
	t.Setenv("WALLET_DEBT_FLOOR_QUOTA", "-1")
	assert.Zero(t, common.GetWalletDebtFloorQuota())
}
