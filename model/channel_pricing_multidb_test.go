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
	"os"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// TestChannelPricingTablesAcrossDatabases proves the channel pricing tables
// migrate and round-trip on every supported primary database. MySQL/PostgreSQL
// run only when their DSN env vars are set; the docker-compose.multidb stack
// provides both.
func TestChannelPricingTablesAcrossDatabases(t *testing.T) {
	cases := []struct {
		name string
		dsn  string
		open func(string) gorm.Dialector
	}{
		{"sqlite", ":memory:", func(dsn string) gorm.Dialector { return sqlite.Open(dsn) }},
		{"mysql", os.Getenv("UTER_TEST_MYSQL_DSN"), func(dsn string) gorm.Dialector { return mysql.Open(dsn) }},
		{"postgres", os.Getenv("UTER_TEST_POSTGRES_DSN"), func(dsn string) gorm.Dialector {
			return postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.name != "sqlite" && tc.dsn == "" {
				t.Skipf("%s DSN is not configured", tc.name)
			}
			db, err := gorm.Open(tc.open(tc.dsn), &gorm.Config{})
			require.NoError(t, err)
			require.NoError(t, db.AutoMigrate(&ChannelModelPricing{}, &ChannelPricingHistory{}))
			require.NoError(t, db.AutoMigrate(&ChannelModelPricing{}, &ChannelPricingHistory{}), "migration must be idempotent")

			row := ChannelModelPricing{
				ChannelId: 7, Provider: "test", ModelName: "gpt-a",
				PricingStatus:   ChannelPricingStatusOfficialOnly,
				InternalPricing: `{"mode":"per_second","per_second_usd":0.08}`,
			}
			require.NoError(t, db.Create(&row).Error)
			duplicate := ChannelModelPricing{
				ChannelId: 7, Provider: "test", ModelName: "gpt-a",
				PricingStatus: ChannelPricingStatusOfficialOnly,
			}
			require.Error(t, db.Create(&duplicate).Error, "the full upstream identity must stay unique")
			require.NoError(t, db.Create(&ChannelModelPricing{
				ChannelId: 7, Provider: "test", Region: "eu-central-1", ModelName: "gpt-a",
				PricingStatus: ChannelPricingStatusOfficialOnly,
			}).Error, "the same model in another region is a separate identity")

			require.NoError(t, db.Create(&ChannelPricingHistory{
				ChannelID: 7, ModelName: "gpt-a", Source: "test",
				OldPricing: `{}`, NewPricing: `{}`, ChangedAt: 100,
			}).Error)
			var history []ChannelPricingHistory
			require.NoError(t, db.Where("channel_id = ?", 7).Find(&history).Error)
			require.Len(t, history, 1)

			require.NoError(t, db.Migrator().DropTable(&ChannelModelPricing{}, &ChannelPricingHistory{}))
		})
	}
}

// TestChannelPricingIdentityMigrationAcrossDatabases reproduces a
// pre-migration table (no identity index, duplicate identities) and proves the
// merge plus index swap works on every supported primary database.
func TestChannelPricingIdentityMigrationAcrossDatabases(t *testing.T) {
	cases := []struct {
		name string
		dsn  string
		open func(string) gorm.Dialector
	}{
		{"sqlite", ":memory:", func(dsn string) gorm.Dialector { return sqlite.Open(dsn) }},
		{"mysql", os.Getenv("UTER_TEST_MYSQL_DSN"), func(dsn string) gorm.Dialector { return mysql.Open(dsn) }},
		{"postgres", os.Getenv("UTER_TEST_POSTGRES_DSN"), func(dsn string) gorm.Dialector {
			return postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.name != "sqlite" && tc.dsn == "" {
				t.Skipf("%s DSN is not configured", tc.name)
			}
			db, err := gorm.Open(tc.open(tc.dsn), &gorm.Config{})
			require.NoError(t, err)
			require.NoError(t, db.AutoMigrate(&ChannelModelPricing{}))
			require.NoError(t, db.Migrator().DropIndex(&ChannelModelPricing{}, "idx_channel_model_pricing_identity"))

			first := ChannelModelPricing{ChannelId: 9, Provider: "test", ModelName: "gpt-a", UpdatedAt: 10}
			second := ChannelModelPricing{
				ChannelId: 9, Provider: "test", ModelName: "gpt-a", UpdatedAt: 20,
				PricingStatus: ChannelPricingStatusConfigured, InternalPricing: `{"mode":"per_1m_token"}`,
			}
			require.NoError(t, db.Create(&first).Error)
			require.NoError(t, db.Create(&second).Error)

			require.NoError(t, PrepareChannelModelPricingIdentity(db))
			require.NoError(t, db.AutoMigrate(&ChannelModelPricing{}))

			var rows []ChannelModelPricing
			require.NoError(t, db.Where("channel_id = ?", 9).Find(&rows).Error)
			require.Len(t, rows, 1)
			require.Equal(t, ChannelPricingStatusConfigured, rows[0].PricingStatus)
			require.True(t, db.Migrator().HasIndex(&ChannelModelPricing{}, "idx_channel_model_pricing_identity"))
			require.False(t, db.Migrator().HasIndex(&ChannelModelPricing{}, legacyChannelPricingIndex))

			require.NoError(t, db.Create(&ChannelModelPricing{
				ChannelId: 9, Provider: "test", Region: "eu-central-1", ModelName: "gpt-a",
			}).Error)

			require.NoError(t, db.Migrator().DropTable(&ChannelModelPricing{}))
		})
	}
}
