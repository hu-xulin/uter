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
	"crypto/sha256"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// BillingExchangeRate is one historical conversion rate into USD. Bills must
// be reproducible, so a rate is never overwritten: a new value is a new
// effective timestamp.
type BillingExchangeRate struct {
	Id            int64  `gorm:"primaryKey;autoIncrement"`
	BaseCurrency  string `gorm:"size:16;uniqueIndex:idx_billing_fx_rate,priority:1"`
	QuoteCurrency string `gorm:"size:16;uniqueIndex:idx_billing_fx_rate,priority:2"`
	// EffectiveAt is when the rate applies; CreatedAt is when it was recorded.
	EffectiveAt int64 `gorm:"uniqueIndex:idx_billing_fx_rate,priority:3;index"`
	Rate        float64
	Source      string `gorm:"size:128"`
	Version     string `gorm:"size:64"`
	CreatedAt   int64  `gorm:"index"`
}

func (BillingExchangeRate) TableName() string { return "billing_exchange_rates" }

// BillingExchangeRateVersion derives a stable version for one rate value.
func BillingExchangeRateVersion(base, quote string, rate float64) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s>%s:%.10f", strings.ToUpper(base), strings.ToUpper(quote), rate)))
	return fmt.Sprintf("%x", sum[:16])
}

// SaveBillingExchangeRate records one rate. A duplicate (same currency pair and
// effective time) is ignored so the first record stays authoritative.
func SaveBillingExchangeRate(rate BillingExchangeRate) error {
	if DB == nil {
		return nil
	}
	rate.BaseCurrency = strings.ToUpper(strings.TrimSpace(rate.BaseCurrency))
	rate.QuoteCurrency = strings.ToUpper(strings.TrimSpace(rate.QuoteCurrency))
	if rate.BaseCurrency == "" || rate.QuoteCurrency == "" || rate.Rate <= 0 {
		return nil
	}
	if rate.Version == "" {
		rate.Version = BillingExchangeRateVersion(rate.BaseCurrency, rate.QuoteCurrency, rate.Rate)
	}
	if rate.CreatedAt == 0 {
		rate.CreatedAt = time.Now().Unix()
	}
	return DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&rate).Error
}

// LatestBillingExchangeRate returns the newest rate effective at or before
// asOf. asOf <= 0 means "latest recorded".
func LatestBillingExchangeRate(base, quote string, asOf int64) (*BillingExchangeRate, error) {
	if DB == nil {
		return nil, gorm.ErrRecordNotFound
	}
	query := DB.Where("base_currency = ? AND quote_currency = ?",
		strings.ToUpper(strings.TrimSpace(base)), strings.ToUpper(strings.TrimSpace(quote)))
	if asOf > 0 {
		query = query.Where("effective_at <= ?", asOf)
	}
	var rate BillingExchangeRate
	if err := query.Order("effective_at desc, id desc").First(&rate).Error; err != nil {
		return nil, err
	}
	return &rate, nil
}
