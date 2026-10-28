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

You should have received a copy of the GNU Affero General License
along with this program. Not found? See <https://www.gnu.org/licenses/>.
*/

package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestBuildWechatH5SceneInfoUsesAPIV3FieldNames 锁死 H5 下单 scene_info 的字段名。
//
// 微信支付 APIv3 `/v3/pay/transactions/h5` 的 scene_info.h5_info 只有
// type / app_name / app_url（+ 可选的 bundle_id / package_name）。
// wap_url / wap_name 是 APIv2 统一订单的字段，在 APIv3 里不存在：
// 按旧名字传 = 既没给 app_name/app_url，又塞了两个未定义字段，
// H5 下单可能直接被判 PARAM_ERROR（用户点「微信支付」直接失败）。
func TestBuildWechatH5SceneInfoUsesAPIV3FieldNames(t *testing.T) {
	sceneInfo := buildWechatH5SceneInfo("203.0.113.7", "https://uter.cc/wallet")

	require.Contains(t, sceneInfo, "payer_client_ip")
	assert.Equal(t, "203.0.113.7", sceneInfo["payer_client_ip"])

	h5Info, ok := sceneInfo["h5_info"].(map[string]any)
	require.True(t, ok, "h5_info must be an object")

	assert.Equal(t, "Wap", h5Info["type"], "h5_info.type is required by APIv3")
	assert.Equal(t, "Uter", h5Info["app_name"])
	assert.Equal(t, "https://uter.cc/wallet", h5Info["app_url"])

	// APIv2 的字段名不得回退，否则等于把未定义字段发给网关。
	assert.NotContains(t, h5Info, "wap_url")
	assert.NotContains(t, h5Info, "wap_name")

	// 只允许 APIv3 定义的键，防止后续随手加字段。
	for key := range h5Info {
		assert.Contains(t, []string{"type", "app_name", "app_url", "bundle_id", "package_name"}, key,
			"unexpected h5_info field %q", key)
	}
}
