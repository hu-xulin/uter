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
package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestNormalizeCustomerServicePages 锁定页面级开关的规整规则。
//
// 最关键的是第一条：空配置必须展开为**全部页面**。升级前只有总开关、默认全开，
// 若把「未配置」解释成「一个页面都不开」，升级瞬间所有页面的客服入口都会消失。
func TestNormalizeCustomerServicePages(t *testing.T) {
	all := CustomerServicePageKeys

	tests := []struct {
		name  string
		input string
		want  []string
	}{
		{
			name:  "empty means every page",
			input: "",
			want:  all,
		},
		{
			// 显式哨兵「全部关闭」：运营在界面关掉所有开关时写回 "none"，
			// 必须展开成空切片，让挂件在所有页面都不渲染。
			name:  "none sentinel means no page",
			input: CustomerServicePagesAllOff,
			want:  []string{},
		},
		{
			// 哨兵可带空白：前端写回的值不应因首尾空格改变语义。
			name:  "none with surrounding spaces still means no page",
			input: "  none  ",
			want:  []string{},
		},
		{
			name:  "blank separators also mean every page",
			input: " , ,",
			want:  all,
		},
		{
			name:  "single page",
			input: "home",
			want:  []string{CustomerServicePageHome},
		},
		{
			name:  "multiple pages are sorted by canonical order",
			input: "docs,home,pricing",
			want:  []string{CustomerServicePageHome, CustomerServicePagePricing, CustomerServicePageDocs},
		},
		{
			name:  "surrounding spaces and mixed case are tolerated",
			input: " Home , ABOUT ",
			want:  []string{CustomerServicePageHome, CustomerServicePageAbout},
		},
		{
			name:  "duplicates collapse",
			input: "home,home,home",
			want:  []string{CustomerServicePageHome},
		},
		{
			// 未知键必须被丢弃：运营手改 option 或旧版本残留脏数据时，
			// 不应让「配了个不存在的页面」看起来像开关已开。
			name:  "unknown keys are dropped",
			input: "home,bogus,contact",
			want:  []string{CustomerServicePageHome},
		},
		{
			// 全是未知键时不能返回空切片，否则等于「全部关闭」——
			// 那是「一个都没配」不该有的后果。
			name:  "only unknown keys still enables every page",
			input: "bogus,contact",
			want:  all,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeCustomerServicePages(tt.input)
			assert.Equal(t, tt.want, got)
		})
	}
}

// TestNormalizeCustomerServicePagesDoesNotMutateGlobalKeys 固化返回值必须是副本：
// 调用方（如下发逻辑）拿到切片后若能改动全局键列表，进程内的页面定义就可能被
// 单次请求悄悄改掉，且不会随请求结束恢复。
func TestNormalizeCustomerServicePagesDoesNotMutateGlobalKeys(t *testing.T) {
	before := append([]string(nil), CustomerServicePageKeys...)

	got := NormalizeCustomerServicePages("home")
	got[0] = "tampered"

	assert.Equal(t, before, CustomerServicePageKeys, "全局页面键列表不得被调用方改动")
}

// TestCustomerServicePageKeysCoverRequestedPages 固化六个页面键都在白名单里，
// 避免后续加页面时只改了一处（后端加了、前端契约没加）而没有测试报警。
func TestCustomerServicePageKeysCoverRequestedPages(t *testing.T) {
	want := []string{"home", "dashboard", "pricing", "rankings", "docs", "about"}
	assert.Equal(t, want, CustomerServicePageKeys)
}
