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
	"time"
)

// UpstreamBillingInvoice is one imported supplier invoice period. Rows holds
// the matched/unmatched detail as JSON so the audit trail stays complete
// without a second relational table.
type UpstreamBillingInvoice struct {
	Id        int64  `gorm:"primaryKey;autoIncrement"`
	ChannelId int    `gorm:"index"`
	Provider  string `gorm:"size:64"`
	Period    string `gorm:"size:64"`
	Currency  string `gorm:"size:16"`
	// FXRate converts OriginalTotal (supplier currency) into TotalUpstreamUSD.
	// FXSource/FXVersion record where the rate came from and its historical
	// entry, so the conversion can be reproduced later.
	FXRate    float64
	FXSource  string `gorm:"size:128"`
	FXVersion string `gorm:"size:64"`
	// OriginalTotal keeps the supplier's own amount so the conversion can be
	// re-audited.
	OriginalTotal    float64
	Source           string `gorm:"size:255"`
	Note             string `gorm:"size:255"`
	TotalUpstreamUSD float64
	TotalUterUSD     float64
	Matched          int
	Mismatched       int
	Unmatched        int
	Unsupported      int
	Rows             string `gorm:"type:text"`
	CreatedAt        int64  `gorm:"index"`
}

func (UpstreamBillingInvoice) TableName() string { return "upstream_billing_invoices" }

func SaveUpstreamBillingInvoice(invoice *UpstreamBillingInvoice) error {
	if invoice.CreatedAt == 0 {
		invoice.CreatedAt = time.Now().Unix()
	}
	return DB.Create(invoice).Error
}

func ListUpstreamBillingInvoices(channelId, limit int) ([]UpstreamBillingInvoice, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var rows []UpstreamBillingInvoice
	err := DB.Where("channel_id = ?", channelId).Order("id desc").Limit(limit).Find(&rows).Error
	return rows, err
}

func GetUpstreamBillingInvoice(channelId int, id int64) (*UpstreamBillingInvoice, error) {
	var invoice UpstreamBillingInvoice
	err := DB.Where("channel_id = ? AND id = ?", channelId, id).First(&invoice).Error
	if err != nil {
		return nil, err
	}
	return &invoice, nil
}
