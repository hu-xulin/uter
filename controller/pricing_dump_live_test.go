//go:build dreamrouter_live

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

// 把真实的 /api/pricing 载荷落成前端测试用的固定数据（不随常规 go test 运行）。
//
// 前端「卡片上有没有折扣徽标」这类结论只能拿真实载荷回答：手写的 fixture
// 一旦和线上结构脱节，测试就会在错误的前提下通过。这个用例按 GetPricing 的
// 同一套组装逻辑（同样的 official_prices 合并、同样的 pricing_source）导出
// JSON，供 web/src/features/pricing/__tests__ 下的渲染用例消费。
//
// 用法（在仓库根目录）：
//
//	SQLITE_PATH=$PWD/one-api.db \
//	go test -tags dreamrouter_live ./controller -run TestDumpPricingPayload -v
package controller

import (
	"os"
	"testing"

	"github.com/joho/godotenv"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/setting/ratio_setting"
)

// pricingDumpDefaultPath 是前端渲染用例读取的固定数据路径。
const pricingDumpDefaultPath = "../web/src/features/pricing/__tests__/zz-pricing-api.json"

func TestDumpPricingPayload(t *testing.T) {
	_ = godotenv.Load("../.env")
	common.InitEnv()
	if os.Getenv("SQLITE_PATH") == "" {
		abs, err := os.Getwd()
		require.NoError(t, err)
		require.NoError(t, os.Setenv("SQLITE_PATH", abs+"/../one-api.db"))
	}
	ratio_setting.InitRatioSettings()
	require.NoError(t, model.InitDB(), "初始化数据库失败")
	model.InitOptionMap()

	pricingSource := normalizePricingSource(common.OptionMap["PricingSource"])
	payload := map[string]any{
		"success":            true,
		"data":               model.GetPricing(),
		"vendors":            model.GetVendors(),
		"group_ratio":        ratio_setting.GetGroupRatioCopy(),
		"usable_group":       service.GetUserUsableGroups(""),
		"supported_endpoint": model.GetSupportedEndpointMap(),
		"auto_groups":        service.GetUserAutoGroup(""),
		"pricing_source":     pricingSource,
		"official_prices":    resolveOfficialPrices(pricingSource),
		"pricing_version":    "dump",
	}
	raw, err := common.Marshal(payload)
	require.NoError(t, err)

	path := os.Getenv("PRICING_DUMP_PATH")
	if path == "" {
		path = pricingDumpDefaultPath
	}
	require.NoError(t, os.WriteFile(path, raw, 0o644))

	withExpr := 0
	for _, item := range model.GetPricing() {
		if item.BillingExpr != "" {
			withExpr++
		}
	}
	t.Logf("已导出 %s：%d 个模型，其中 %d 个带 billing_expr", path, len(model.GetPricing()), withExpr)
}
