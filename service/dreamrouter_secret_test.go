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
package service

import (
	"context"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
)

// TestDreamRouterSyncSourceHasNoPlaintextPassword 守住「上游渠道口令不得进源码」。
//
// 起因（2026-10-25）：DreamRouter 上游账号口令曾以常量形式硬编码在
// service/dreamrouter_sync.go，任何拿到源码/镜像的人都能用它登录上游渠道账号。
// 现在口令只从 option `DreamRouterSyncPassword` 读（该键已登记为 secret，
// 见 common/secret_option_keys.go）。
//
// 本测试扫描本仓库的 Go 源码（排除 _test.go 与 vendor），一旦出现形如
// 「以 Uter/uter 开头的口令字面量」就失败。它是回归防线：防止后来者又把
// 密钥写回常量。
func TestDreamRouterSyncSourceHasNoPlaintextPassword(t *testing.T) {
	// 匹配形如 "Uter.ai#2026." / "uter#2026" 这类带年份后缀的账号口令字面量。
	pattern := regexp.MustCompile(`(?i)"(uter[.\w-]*#\d{4}[^"]*)"`)

	root := ".."
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			switch info.Name() {
			case ".git", "node_modules", "web", "docs-web", "electron", "vendor":
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		data, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		for _, m := range pattern.FindAllStringSubmatch(string(data), -1) {
			t.Errorf("源码里出现疑似明文口令字面量 %q（%s）。上游渠道口令只能通过 option 配置，"+
				"且该 option 须登记为 secret。", m[1], path)
		}
		return nil
	})
	require.NoError(t, err)
}

// TestLoadDreamRouterSyncConfigHasNoPasswordFallback 锁定「口令没有明文兜底」。
//
// 口径：LoadDreamRouterSyncConfig 在 option 未配置口令时必须返回空串，
// 由 SyncDreamRouterPricing 显式报错。绝不允许内置一个默认口令——那等于
// 把密钥写回源码（等价于上一条测试要防的事，只是换了个地方）。
func TestLoadDreamRouterSyncConfigHasNoPasswordFallback(t *testing.T) {
	previous := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = previous })

	// 未配置口令 → 空串（而非任何默认口令）。
	cfg := LoadDreamRouterSyncConfig()
	assert.Empty(t, cfg.Password, "option 未配置口令时不得回退到任何内置默认口令")

	// option 配置了口令 → 原样读出（这是唯一的来源）。
	common.OptionMap[dreamRouterSyncPasswordKey] = "  s3cret-from-option  "
	cfg = LoadDreamRouterSyncConfig()
	assert.Equal(t, "s3cret-from-option", cfg.Password, "口令应从 option 原样读出（首尾空白被裁掉）")

	// 口令键必须是 secret，否则 GET /api/option/ 会明文下发。
	assert.True(t, common.IsSecretOptionKey(dreamRouterSyncPasswordKey),
		"%s 必须登记为 secret option，否则会明文下发给前端", dreamRouterSyncPasswordKey)
}

// TestSyncDreamRouterPricingRequiresConfiguredPassword 锁定「未配置口令时
// 明确报错」，而不是拿空口令去打上游登录接口。
func TestSyncDreamRouterPricingRequiresConfiguredPassword(t *testing.T) {
	previous := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = previous })

	_, err := SyncDreamRouterPricing(context.Background(), DreamRouterSyncOptions{DryRun: true})
	require.Error(t, err)
	assert.Contains(t, err.Error(), dreamRouterSyncPasswordKey,
		"未配置口令时的错误应指明是哪个 option 缺失，避免排查方向被带偏")
}
