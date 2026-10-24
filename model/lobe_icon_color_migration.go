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
