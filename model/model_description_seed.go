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
	"strings"
	"unicode"

	"gorm.io/gorm"
)

// 单语描述的语种回填。
//
// models 表在引入多语副本之前只有一个 description 列，历史上写入的既有英文
// 也有中文（上游 zh 目录、运营手填）。若一律把它当作英文塞进
// descriptions["en"]，会造成两种真实故障：
//
//  1. 中文界面之外的访客看到中文（英文位被中文占据，前端解析命中 "en"）；
//  2. 补译以「英文原文」为源，实际拿到中文，译文质量不可控。
//
// 因此回填前先判语种，写到对应语种位上。

// detectDescriptionLocale 按字符构成判断描述的自然语言。
//
// 只用于「单语存量回填」这一个场景，因此刻意保持简单可解释：
//   - 出现假名 → ja（日文里汉字占比也高，必须先判假名）；
//   - 汉字占「汉字 + 拉丁字母」的比例 ≥ 15% → zh；
//   - 其余 → en。
//
// 上游目录提供的 zh/en/ja 三语永远优先于这里的判断（只补空白语种），
// 所以误判只影响目录里没有的模型，且最坏结果是译文源语言选错一次。
func detectDescriptionLocale(text string) string {
	han, latin, kana := 0, 0, 0
	for _, r := range text {
		switch {
		case unicode.In(r, unicode.Hiragana, unicode.Katakana):
			kana++
		case unicode.Is(unicode.Han, r):
			han++
		case r < unicode.MaxASCII && unicode.IsLetter(r):
			latin++
		}
	}
	if kana > 0 {
		return "ja"
	}
	total := han + latin
	if total == 0 {
		return "en"
	}
	if float64(han)/float64(total) >= 0.15 {
		return "zh"
	}
	return "en"
}

// SeedLocalizedDescriptionsFromLegacy 为「还没有任何多语副本、但有单语
// description」的模型补上对应语种的副本。
//
// 幂等：已经有多语副本的行完全不动；重复调用不会产生写入。
// 与 FillLocalizedDescriptions 的「只补空白」语义一致，绝不覆盖已有译文。
func SeedLocalizedDescriptionsFromLegacy() (seeded []string, err error) {
	var records []Model
	// 只取真正需要的列：descriptions 为空且 description 非空的行。
	// updated_time 是下面乐观锁的版本依据，必须一并取出。
	if err := DB.Select("id", "model_name", "description", "updated_time").
		Where("(descriptions IS NULL OR descriptions = '') AND description IS NOT NULL AND description <> ''").
		Find(&records).Error; err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return nil, nil
	}

	type pending struct {
		id      int
		name    string
		encoded any
		version int64
	}
	updates := make([]pending, 0, len(records))
	for _, record := range records {
		text := strings.TrimSpace(record.Description)
		if text == "" {
			continue
		}
		descriptions := LocalizedDescription{detectDescriptionLocale(text): text}
		encoded, err := descriptions.Value()
		if err != nil {
			return nil, err
		}
		updates = append(updates, pending{
			id: record.Id, name: record.ModelName, encoded: encoded, version: record.UpdatedTime,
		})
	}
	if len(updates) == 0 {
		return nil, nil
	}

	err = metadataTransaction(func(tx *gorm.DB) error {
		for _, item := range updates {
			// id + updated_time 乐观锁：回填期间管理员改过这一行就跳过，
			// 不覆盖他的编辑。
			res := tx.Model(&Model{}).
				Where("id = ? AND updated_time = ?", item.id, item.version).
				UpdateColumn("descriptions", item.encoded)
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected > 0 {
				seeded = append(seeded, item.name)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return seeded, nil
}
