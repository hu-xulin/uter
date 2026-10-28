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
package model

import (
	"testing"

	"github.com/uter-ai/uter/common"
)

// TestUpdateOptionMapSyncsCustomerServiceToken 锁定「保存令牌 → 代理生效」这条链路。
//
// 回归背景：`CustomerServiceAdminToken` 曾经只写进 common.OptionMap，而
// `common.CustomerServiceAdminToken` 从声明起没有任何赋值点（启动加载与运行时更新
// 都没有），于是运营在「站点与品牌 → 智能客服」里保存多少次令牌，代理侧读到的仍是
// 空串，恒定返回 400「未配置智能客服管理员令牌」——保存成功、页面永远不可用。
//
// 这个用例直接调用 updateOptionMap（loadOptionsFromDatabase 与 UpdateOption 的公共
// 出口），因此同时覆盖「启动回填」与「运行时更新」两条路径。
func TestUpdateOptionMapSyncsCustomerServiceToken(t *testing.T) {
	origToken := common.CustomerServiceAdminToken
	origCache := common.CustomerServiceLLMConfig
	t.Cleanup(func() {
		common.CustomerServiceAdminToken = origToken
		common.CustomerServiceLLMConfig = origCache
	})

	const token = "header.payload.signature"
	if err := updateOptionMap("CustomerServiceAdminToken", token); err != nil {
		t.Fatalf("updateOptionMap: %v", err)
	}
	if common.CustomerServiceAdminToken != token {
		t.Fatalf("CustomerServiceAdminToken = %q, want %q（选项必须回填全局变量）",
			common.CustomerServiceAdminToken, token)
	}

	const cached = `{"provider":"api","model":"m"}`
	if err := updateOptionMap("CustomerServiceLLMConfig", cached); err != nil {
		t.Fatalf("updateOptionMap: %v", err)
	}
	if common.CustomerServiceLLMConfig != cached {
		t.Fatalf("CustomerServiceLLMConfig = %q, want %q（缓存需随 options 恢复）",
			common.CustomerServiceLLMConfig, cached)
	}
}
