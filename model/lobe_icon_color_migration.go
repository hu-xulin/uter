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
	"errors"
)

// MigrateLobeIconColorKeys 把存量 vendors / models 的图标键统一升级到品牌
// 彩色变体（NormalizeColorIconKey）：同步链路此前把上游下发的彩色键
// （"Claude.Color" 等）收敛成了单色裸名，本迁移把新老数据一次性订正到
// 彩色键，与同步侧的新写入规则一致。
//
// 迁移幂等：彩色键再次归一化结果不变，重复执行不会产生写入。
func MigrateLobeIconColorKeys() error {
	if DB == nil {
		return errors.New("database is not initialized")
	}
	var migrationErrors []error
	if err := colorizeVendorIcons(); err != nil {
		migrationErrors = append(migrationErrors, errors.Join(errors.New("colorize vendor icons"), err))
	}
	if err := colorizeModelIcons(); err != nil {
		migrationErrors = append(migrationErrors, errors.Join(errors.New("colorize model icons"), err))
	}
	// 把已知品牌的供应商图标对齐回权威彩色映射（defaultVendorIcons）：
	// 同步链路曾盲目信任上游下发图标，导致 Google→Google.Color、
	// Anthropic→Anthropic.Avatar 这类漂移；定价页回退到厂商图标时会露出
	// 错误的品牌 logo（如 gemini 系列显示 Google、claude 系列显示 Anthropic）。
	// 本步骤放在最后，确保权威彩色键是最终落点。
	if err := alignVendorIconsToDefaults(); err != nil {
		migrationErrors = append(migrationErrors, errors.Join(errors.New("align vendor icons to defaults"), err))
	}
	return errors.Join(migrationErrors...)
}

// colorizeVendorIcons 订正 vendors.icon；仅处理未软删除的记录。
func colorizeVendorIcons() error {
	var vendors []Vendor
	if err := DB.Where("icon <> ''").Find(&vendors).Error; err != nil {
		return err
	}
	for i := range vendors {
		current := vendors[i].Icon
		colored := NormalizeColorIconKey(current)
		if colored == current {
			continue
		}
		if err := DB.Model(&Vendor{}).Where("id = ?", vendors[i].Id).
			Update("icon", colored).Error; err != nil {
			return err
		}
	}
	return nil
}

// colorizeModelIcons 订正 models.icon。
func colorizeModelIcons() error {
	var models []Model
	if err := DB.Where("icon <> ''").Find(&models).Error; err != nil {
		return err
	}
	for i := range models {
		current := models[i].Icon
		colored := NormalizeColorIconKey(current)
		if colored == current {
			continue
		}
		if err := DB.Model(&Model{}).Where("id = ?", models[i].Id).
			Update("icon", colored).Error; err != nil {
			return err
		}
	}
	return nil
}

// alignVendorIconsToDefaults 把已知品牌（已登记进 defaultVendorIcons）的供应
// 商图标对齐回权威彩色映射。同步链路此前盲目信任上游下发图标，导致
// Google→Google.Color、Anthropic→Anthropic.Avatar 这类漂移——定价页回退到
// 厂商图标时就会露出错误的品牌 logo（如 gemini 系列显示 Google、claude 系列
// 显示 Anthropic）。本步骤把漂移过的持久化供应商图标纠正为 defaultVendorIcons
// 定义的权威彩色键（Gemini.Color / Claude.Color 等），与展示侧的
// getDefaultVendorIcon 保持一致。
//
// 幂等：图标已符合权威映射则不产生写入，可重复执行。
func alignVendorIconsToDefaults() error {
	var vendors []Vendor
	if err := DB.Find(&vendors).Error; err != nil {
		return err
	}
	for i := range vendors {
		target := getDefaultVendorIcon(vendors[i].Name)
		if target == "" {
			// 未登记品牌：交由 colorize* 处理，这里不动。
			continue
		}
		if vendors[i].Icon == target {
			continue
		}
		if err := DB.Model(&Vendor{}).Where("id = ?", vendors[i].Id).
			Update("icon", target).Error; err != nil {
			return err
		}
	}
	return nil
}
