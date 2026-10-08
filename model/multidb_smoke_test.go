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

	"gorm.io/driver/clickhouse"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// multiDBSmokeRow is a minimal table used only to prove that a given SQL
// dialect can be opened, migrated, written to and read back. It deliberately
// avoids any Uter-specific column types so the check stays portable across
// SQLite, MySQL, PostgreSQL and ClickHouse.
type multiDBSmokeRow struct {
	ID   uint   `gorm:"primaryKey"`
	Name string
}

// openSmokeDialect maps a dialect name + DSN to a GORM dialector. The boolean
// return is false when the dialect needs an external DSN that was not provided,
// in which case the caller should skip the subtest (no Docker available).
func openSmokeDialect(name, dsn string) (gorm.Dialector, string) {
	switch name {
	case "sqlite":
		return sqlite.Open(dsn), "" // dsn defaults to ":memory:"
	case "mysql":
		if dsn == "" {
			return nil, "UTER_TEST_MYSQL_DSN"
		}
		return mysql.Open(dsn), ""
	case "postgres":
		if dsn == "" {
			return nil, "UTER_TEST_POSTGRES_DSN"
		}
		return postgres.New(postgres.Config{
			DSN:                  dsn,
			PreferSimpleProtocol: true, // PgBouncer/Neon/Supabase-safe
		}), ""
	case "clickhouse":
		if dsn == "" {
			return nil, "UTER_TEST_CLICKHOUSE_DSN"
		}
		return clickhouse.Open(dsn), ""
	default:
		return nil, ""
	}
}

// TestMultiDBDialectCompat is the cross-database smoke test for GAP-05. It
// proves Uter's supported dialects (SQLite default; MySQL/PostgreSQL as primary
// DB; ClickHouse as the log DB) can be opened and migrated.
//
// SQLite runs unconditionally (no Docker needed). The other three read their
// DSN from the UTER_TEST_<DIALECT>_DSN env vars and are skipped unless Docker
// is up. Bring them online with:
//
//	docker compose -f docker-compose.multidb.yml up -d
//	export UTER_TEST_MYSQL_DSN='root:uter@tcp(127.0.0.1:3306)/uter?parseTime=true&charset=utf8mb4'
//	export UTER_TEST_POSTGRES_DSN='postgres://uter:uter@127.0.0.1:5432/uter?sslmode=disable'
//	export UTER_TEST_CLICKHOUSE_DSN='clickhouse://default:uter@127.0.0.1:9000/uter'
//	GOWORK=off go test ./model/ -run TestMultiDBDialectCompat -v
func TestMultiDBDialectCompat(t *testing.T) {
	cases := []struct {
		name string
		dsn  string
	}{
		{"sqlite", ":memory:"},
		{"mysql", os.Getenv("UTER_TEST_MYSQL_DSN")},
		{"postgres", os.Getenv("UTER_TEST_POSTGRES_DSN")},
		{"clickhouse", os.Getenv("UTER_TEST_CLICKHOUSE_DSN")},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dialector, missingEnv := openSmokeDialect(c.name, c.dsn)
			if dialector == nil {
				t.Skipf("no DSN configured for %s; set %s to run this dialect check", c.name, missingEnv)
			}
			db, err := gorm.Open(dialector, &gorm.Config{})
			if err != nil {
				t.Fatalf("open %s: %v", c.name, err)
			}
			if err := db.AutoMigrate(&multiDBSmokeRow{}); err != nil {
				t.Fatalf("migrate %s: %v", c.name, err)
			}
			if err := db.Create(&multiDBSmokeRow{Name: "smoke"}).Error; err != nil {
				t.Fatalf("create %s: %v", c.name, err)
			}
			var row multiDBSmokeRow
			if err := db.First(&row, 1).Error; err != nil {
				t.Fatalf("select %s: %v", c.name, err)
			}
			if row.Name != "smoke" {
				t.Fatalf("unexpected row name %q for %s", row.Name, c.name)
			}
		})
	}
}
