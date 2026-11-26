/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/uter-ai/uter/common"
)

func setDeploymentRegistrySecretForTest(t *testing.T, deploymentID, value string) {
	t.Helper()
	key := common.DeploymentRegistrySecretOptionKey(deploymentID)
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	previous, existed := common.OptionMap[key]
	common.OptionMap[key] = value
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		if existed {
			common.OptionMap[key] = previous
		} else {
			delete(common.OptionMap, key)
		}
		common.OptionMapRWMutex.Unlock()
	})
}

func TestDeploymentRegistrySecretView(t *testing.T) {
	t.Run("未配置时返回空且不标记已配置", func(t *testing.T) {
		masked, configured := deploymentRegistrySecretView("dep-unconfigured")
		assert.False(t, configured)
		assert.Empty(t, masked)
	})

	t.Run("已配置时返回掩码而非明文", func(t *testing.T) {
		const plaintext = "registry-password-1234567890"
		setDeploymentRegistrySecretForTest(t, "dep-configured", plaintext)
		masked, configured := deploymentRegistrySecretView("dep-configured")
		assert.True(t, configured)
		assert.Equal(t, common.MaskSecretValue(plaintext), masked)
		assert.NotContains(t, masked, plaintext)
		assert.Contains(t, masked, "****")
	})

	t.Run("空白值视为未配置", func(t *testing.T) {
		setDeploymentRegistrySecretForTest(t, "dep-blank", "   ")
		masked, configured := deploymentRegistrySecretView("dep-blank")
		assert.False(t, configured)
		assert.Empty(t, masked)
	})

	t.Run("非法部署 ID 一律不返回", func(t *testing.T) {
		for _, id := range []string{"", "a/b", "a.b"} {
			masked, configured := deploymentRegistrySecretView(id)
			assert.False(t, configured, id)
			assert.Empty(t, masked, id)
		}
	})
}
