package model

import (
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// newLocalizedDescriptionTestDB 建一个临时文件型 SQLite 库。
//
// 两个刻意的选择：
//   - 必须迁移 Option：Model.Insert / FillLocalizedDescriptions 都要经
//     metadataTransaction 取 metadata_sync_lock 行，缺表会在业务断言之前
//     就以 "no such table: options" 失败。
//   - 用文件库而非 :memory:：metadataTransaction 内含
//     lockForUpdate(...).First(...)，在内存库上 GORM 会走与文件库不同的
//     连接/事务路径，实测直接挂起；文件库与生产（SQLitePath 文件库）一致。
func newLocalizedDescriptionTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	path := filepath.Join(t.TempDir(), "desc-test.db")
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Model{}, &Option{}))
	return db
}

// TestE2ELocalizedDescriptionRoundTrip 端到端验证「上游三语同步写入 → 按访客
// 语言解析 → 幂等重跑」整条链路。
//
// 这是本功能最关键的不变量集合：多语描述必须真的以 JSON 文本落库（而非被
// GORM 静默丢弃），繁中/法语等缺失语种必须回退而不是变空，且重复同步不得
// 覆盖管理员已润色的译文。
func TestE2ELocalizedDescriptionRoundTrip(t *testing.T) {
	previous := DB
	db := newLocalizedDescriptionTestDB(t)
	DB = db
	t.Cleanup(func() { DB = previous })

	record := &Model{ModelName: "e2e-model", Description: "English desc", NameRule: NameRuleExact, Status: 1}
	require.NoError(t, record.Insert())

	// 上游同步写入三语（模拟 fetchUpstreamLocalizedDescriptions 的产物）。
	filled, err := FillLocalizedDescriptions(map[string]map[string]string{
		"e2e-model": {"en": "English desc", "zh": "中文描述", "ja": "日本語の説明"},
	})
	require.NoError(t, err)
	require.Equal(t, []string{"e2e-model"}, filled)

	// 必须真的以 JSON 文本落库，而不是被静默丢弃或写成 Go 字面量。
	var raw string
	require.NoError(t, db.Raw("SELECT descriptions FROM models WHERE model_name = ?", "e2e-model").Scan(&raw).Error)
	var decoded map[string]string
	require.NoError(t, json.Unmarshal([]byte(raw), &decoded), "落盘内容必须是合法 JSON: %s", raw)
	require.Equal(t, "中文描述", decoded["zh"])
	require.Equal(t, "日本語の説明", decoded["ja"])

	var reloaded Model
	require.NoError(t, db.First(&reloaded, "model_name = ?", "e2e-model").Error)
	require.Equal(t, "中文描述", reloaded.Descriptions.Resolve("zh"))
	require.Equal(t, "日本語の説明", reloaded.Descriptions.Resolve("ja"))
	require.Equal(t, "中文描述", reloaded.Descriptions.Resolve("zh-TW"), "繁中经简中回退")
	require.Equal(t, "English desc", reloaded.Descriptions.Resolve("fr"), "法语回退英文")

	// 幂等：重复同步只补新语种，已有译文不得被覆盖。
	filled2, err := FillLocalizedDescriptions(map[string]map[string]string{
		"e2e-model": {"zh": "被篡改的描述", "fr": "Description française"},
	})
	require.NoError(t, err)
	require.Equal(t, []string{"e2e-model"}, filled2)

	require.NoError(t, db.First(&reloaded, "model_name = ?", "e2e-model").Error)
	require.Equal(t, "中文描述", reloaded.Descriptions["zh"], "已有译文不得被上游覆盖")
	require.Equal(t, "Description française", reloaded.Descriptions["fr"], "新语种应被补齐")

	// 全部语种齐备后再跑一次，不应产生任何写入。
	filled3, err := FillLocalizedDescriptions(map[string]map[string]string{
		"e2e-model": {"zh": "再篡改", "fr": "Encore", "en": "nope", "ja": "だめ"},
	})
	require.NoError(t, err)
	require.Empty(t, filled3, "语种齐备后必须完全收敛，不再写库")
}

// TestE2ELocalizedDescriptionSingleFieldBackwardCompat 锁定单字段历史数据在
// 读取时也能享受多语渲染：只填了 description 的老行不应因为 Descriptions
// 为空而在非英文界面显示空白。
func TestE2ELocalizedDescriptionSingleFieldBackwardCompat(t *testing.T) {
	previous := DB
	db := newLocalizedDescriptionTestDB(t)
	DB = db
	t.Cleanup(func() { DB = previous })

	// 模拟历史数据：只有单字段，没有多语副本。
	require.NoError(t, db.Create(&Model{
		ModelName: "legacy", Description: "Legacy English", NameRule: NameRuleExact, Status: 1,
	}).Error)

	var reloaded Model
	require.NoError(t, db.First(&reloaded, "model_name = ?", "legacy").Error)
	// Descriptions 本身仍为空（原始数据就是这样），但对外的解析入口必须能
	// 兜住单字段，否则非英文界面会误判成「没有描述」。
	require.Empty(t, reloaded.Descriptions)
	require.Equal(t, "Legacy English",
		ResolveModelDescription(reloaded.Descriptions, reloaded.Description, "zh"),
		"单字段历史数据应能解析出任意语种，而不是空白")
	require.Equal(t, "Legacy English",
		ResolveModelDescription(reloaded.Descriptions, reloaded.Description, "fr"))

	// 走一遍 Update 后，单字段应被回填进多语的英文位。
	reloaded.Icon = "OpenAI"
	require.NoError(t, reloaded.Update())
	var afterUpdate Model
	require.NoError(t, db.First(&afterUpdate, "model_name = ?", "legacy").Error)
	require.Equal(t, "Legacy English", afterUpdate.Descriptions["en"])
}

// TestE2ELocalizedDescriptionSkipsUnknownModels 锁定只处理本轮关心的模型，
// 避免把整份上游目录写进内存再逐条查库。
func TestE2ELocalizedDescriptionSkipsUnknownModels(t *testing.T) {
	previous := DB
	db := newLocalizedDescriptionTestDB(t)
	DB = db
	t.Cleanup(func() { DB = previous })

	filled, err := FillLocalizedDescriptions(map[string]map[string]string{
		"never-existed": {"zh": "不该写入"},
	})
	require.NoError(t, err)
	require.Empty(t, filled)

	var count int64
	require.NoError(t, db.Model(&Model{}).Count(&count).Error)
	require.Zero(t, count, "未命中的模型不得凭空建行")
}
