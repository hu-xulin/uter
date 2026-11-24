package service

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
)

func TestTwoFAEnrollmentEnabledHonorsAdministratorSetting(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	previous := common.OptionMap
	common.OptionMap = map[string]string{}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previous
		common.OptionMapRWMutex.Unlock()
	})

	require.True(t, TwoFAEnrollmentEnabled(), "missing option keeps enrollment enabled")

	common.OptionMapRWMutex.Lock()
	common.OptionMap["TwoFAEnabled"] = "false"
	common.OptionMapRWMutex.Unlock()
	require.False(t, TwoFAEnrollmentEnabled())

	common.OptionMapRWMutex.Lock()
	common.OptionMap["TwoFAEnabled"] = "TRUE"
	common.OptionMapRWMutex.Unlock()
	require.True(t, TwoFAEnrollmentEnabled())
}
