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

// 上游创梦渠道的真实联调用例（不随常规 go test 运行）。
//
// 常规测试用固定 payload 验证公式，这个用例直接登录上游、拉取真实定价、
// 落库并复核，用来回答「线上价格到底跟上游对不对齐」——这类结论只能由
// 真实数据给出。
//
// 用法（在仓库根目录，库文件默认取当前目录的 one-api.db）：
//
//	SQLITE_PATH=$PWD/one-api.db \
//	DREAMROUTER_LIVE_APPLY=1 \
//	go test -tags dreamrouter_live ./controller -run TestDreamRouterLiveAlignment -v
//
// 环境变量：
//
//	SQLITE_PATH            指向要读写的 SQLite 库（默认 one-api.db）
//	DREAMROUTER_LIVE_APPLY 1 = 真正落库；缺省只做 dry run 并打印差异
//	DREAMROUTER_LIVE_DESC  1 = 同时补齐模型描述多语言（会调用翻译接口）
package controller

import (
	"context"
	"fmt"
	"os"
	"sort"
	"testing"

	"github.com/joho/godotenv"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/setting/ratio_setting"
)

func TestDreamRouterLiveAlignment(t *testing.T) {
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

	apply := os.Getenv("DREAMROUTER_LIVE_APPLY") == "1"
	result, err := service.SyncDreamRouterPricing(context.Background(), service.DreamRouterSyncOptions{DryRun: !apply})
	require.NoError(t, err, "同步失败")
	require.NotEmpty(t, result.Changes, "上游没有返回任何模型")

	fmt.Printf("\n=== 上游 %d 条记录，在售 %d 个模型（排除 %d 条孤儿记录），pricing_version=%s，applied=%v ===\n",
		result.UpstreamCount, result.OfferedCount, len(result.SkippedModels), result.PricingVer, result.Applied)
	for _, skipped := range result.SkippedModels {
		fmt.Printf("跳过：%-38s %s\n", skipped.Name, skipped.Reason)
	}
	fmt.Printf("%-38s %6s %10s %10s %10s %8s %8s\n",
		"模型", "r", "官方价/1M", "上游折后", "Uter 售价", "上游折扣", "Uter折扣")
	sort.Slice(result.Changes, func(i, j int) bool {
		return result.Changes[i].Name < result.Changes[j].Name
	})
	for _, change := range result.Changes {
		fmt.Printf("%-38s %6.2f %10.4f %10.4f %10.4f %7.1f%% %7.1f%%\n",
			change.Name, change.GroupRatio, change.Official.Input,
			change.Upstream.Input, effectiveUnitPrice(change),
			(1-change.GroupRatio)*100, (1-change.Factor)*100)
	}

	fmt.Printf("\n复核：verified=%d/%d，misaligned=%v\n",
		result.Verified, result.VerifiableCount, result.Misaligned)
	if apply {
		require.Equal(t, result.VerifiableCount, result.Verified, "落库后复核未通过")
		require.Empty(t, result.Misaligned)
		require.Equal(t, result.OfferedCount, result.UpstreamCount-len(result.SkippedModels),
			"在售模型数应等于上游记录数减去被排除的孤儿记录")
	}

	// 快照与定价页参照的校验只读本地快照，与本次是否落库无关：
	// dry run 也该能回答「库里的快照是否仍然全对齐」「定价页能不能拿到官方价」。
	// 放在 apply 分支里会让这两条结论在 dry run 下永远「未验证」。
	snapshot := service.LoadDreamRouterSnapshot()
	if snapshot == nil {
		t.Log("库里还没有同步快照，跳过快照与官方价参照校验")
		return
	}
	if apply {
		drifted := 0
		for _, row := range snapshot.Models {
			if !row.Aligned {
				drifted++
				t.Logf("未对齐：%s 官方 %.4f 规则系数 %.2f Uter %.4f（%s）",
					row.UpstreamName, row.Official.Input, 1-row.UterDiscountPercent/100,
					row.Uter.Input, row.Note)
			}
		}
		require.Zero(t, drifted, "快照里存在未对齐模型")
	}

	// 定价页参照：每个同步模型都必须能从快照取到官方价，否则卡片上没有
	// 划线原价、也没有折扣徽标（这就是「折扣没获取到」）。
	reference := resolveOfficialPrices("channel")
	missing := make([]string, 0)
	for _, row := range snapshot.Models {
		entry, ok := reference[row.LocalName]
		if !ok || (entry["model_ratio"] <= 0 && entry["model_price"] <= 0) {
			missing = append(missing, row.LocalName)
		}
	}
	require.Empty(t, missing, "定价页缺少官方价参照：%v", missing)
	fmt.Printf("官方价参照覆盖：%d/%d 个模型（快照 models=%d）\n",
		len(snapshot.Models)-len(missing), len(snapshot.Models), len(snapshot.Models))

	if os.Getenv("DREAMROUTER_LIVE_DESC") == "1" {
		names := model.GetEnabledModels()
		fmt.Printf("\n=== 补齐 %d 个上架模型的描述多语言 ===\n", len(names))
		syncLocalizedDescriptions(context.Background(), names)
		reportDescriptionCoverage(t, names)
	}

	// 元数据行覆盖：定价页按供应商分组，没有 models 行的模型拿不到 vendor_id，
	// 在任何供应商筛选下都不可见——运营看到的就是「这个模型漏了」。
	// 后置钩子是异步的，必须先等它结束再断言，否则结论取决于调度时序。
	service.WaitPricingPostSyncForTest()
	reportMetadataRowCoverage(t, snapshot.Models, apply)
}

// reportMetadataRowCoverage 打印上游模型在 models 表里的行覆盖情况。
//
// 只有 apply 时才断言「一个都不能缺」：dry run 不落库、也不触发后置钩子，
// 缺行是预期状态。
func reportMetadataRowCoverage(t *testing.T, rows []service.DreamRouterModelRow, apply bool) {
	t.Helper()
	names := make([]string, 0, len(rows))
	for _, row := range rows {
		names = append(names, row.LocalName)
	}
	if len(names) == 0 {
		return
	}
	var records []model.Model
	require.NoError(t, model.DB.Select("model_name", "vendor_id").
		Where("model_name IN ?", names).Find(&records).Error)
	present := make(map[string]int, len(records))
	for _, record := range records {
		present[record.ModelName] = record.VendorID
	}
	missing := make([]string, 0)
	noVendor := make([]string, 0)
	for _, name := range names {
		vendorID, ok := present[name]
		if !ok {
			missing = append(missing, name)
			continue
		}
		if vendorID == 0 {
			noVendor = append(noVendor, name)
		}
	}
	sort.Strings(missing)
	sort.Strings(noVendor)
	fmt.Printf("元数据行覆盖：%d/%d 个模型有 models 行；缺行 %v；无供应商 %v\n",
		len(names)-len(missing), len(names), missing, noVendor)
	if apply {
		require.Empty(t, missing, "以下上游模型没有 models 行，定价页按供应商筛选时不可见：%v", missing)
	}
}

// effectiveUnitPrice 返回该模型落库后的实际单价（美元 / 1M tokens 或 / 次）。
//
// 按次计费（per_call）模型的售价在 ModelPrice 里，ModelRatio 为 0——直接
// 打印 NewModelRatio*2 会把它们全显示成 0.0000，看起来像「没同步价格」。
func effectiveUnitPrice(change service.DreamRouterModelChange) float64 {
	if change.BillingClass == "per_call" {
		return change.NewModelPrice
	}
	return change.NewModelRatio * 2
}

// reportDescriptionCoverage 打印每个语种已覆盖的模型数，作为「卡片描述
// 已多语言」的运行时证据。
func reportDescriptionCoverage(t *testing.T, names []string) {
	t.Helper()
	var records []model.Model
	require.NoError(t, model.DB.Select("model_name", "description", "descriptions").
		Where("model_name IN ?", names).Find(&records).Error)

	coverage := map[string]int{}
	missing := 0
	for _, record := range records {
		if len(record.Descriptions) == 0 {
			missing++
		}
		for locale, text := range record.Descriptions {
			if text != "" {
				coverage[locale]++
			}
		}
	}
	locales := make([]string, 0, len(coverage))
	for locale := range coverage {
		locales = append(locales, locale)
	}
	sort.Strings(locales)
	fmt.Printf("共 %d 个模型，无多语副本 %d 个；各语种覆盖：", len(records), missing)
	for _, locale := range locales {
		fmt.Printf("%s=%d ", locale, coverage[locale])
	}
	fmt.Println()
}
