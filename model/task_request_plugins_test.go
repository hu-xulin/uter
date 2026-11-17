package model

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// legacyTaskShim is the task row shape before request plugins existed.
type legacyTaskShim struct {
	ID     int64  `gorm:"primary_key"`
	TaskID string `gorm:"type:varchar(191);index"`
}

func (legacyTaskShim) TableName() string { return "tasks" }

// TestTaskRequestPluginsSchemaDatabaseMatrix verifies the request-plugin
// column on SQLite, MySQL and PostgreSQL: fresh creation and upgrade from a
// row written before the column existed, both idempotent, data preserved.
func TestTaskRequestPluginsSchemaDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(":memory:")
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN is not configured")
				}
				driver = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN is not configured")
				}
				driver = postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
			}
			db, err := gorm.Open(driver, &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			t.Cleanup(func() { assert.NoError(t, sqlDB.Close()) })
			require.NoError(t, db.Migrator().DropTable(&Task{}))
			t.Cleanup(func() { assert.NoError(t, db.Migrator().DropTable(&Task{})) })
			legacyDB := db
			require.NoError(t, legacyDB.AutoMigrate(&legacyTaskShim{}))
			require.NoError(t, legacyDB.Create(&legacyTaskShim{ID: 1, TaskID: "old-row"}).Error)
			for range 2 {
				require.NoError(t, legacyDB.AutoMigrate(&Task{}))
			}
			require.True(t, legacyDB.Migrator().HasColumn(&Task{}, "RequestPlugins"))
			var old Task
			require.NoError(t, legacyDB.Where("task_id = ?", "old-row").First(&old).Error)
			require.Equal(t, int64(1), old.ID)
			require.Nil(t, old.RequestPlugins)

			require.NoError(t, db.Migrator().DropTable(&Task{}))
			for range 2 {
				require.NoError(t, db.AutoMigrate(&Task{}))
			}
			require.True(t, db.Migrator().HasColumn(&Task{}, "RequestPlugins"))
			row := Task{
				TaskID:   "rp-row",
				Platform: "test",
				Status:   TaskStatusSuccess,
				RequestPlugins: &TaskRequestPlugins{
					Instances: []string{"inst-1"},
					Format:    "openai",
					StartedAt: 1700000000000,
					Request:   json.RawMessage(`{"model":"gpt-4o"}`),
				},
			}
			require.NoError(t, db.Create(&row).Error)
			for range 2 {
				require.NoError(t, db.AutoMigrate(&Task{}))
			}
			var loaded Task
			require.NoError(t, db.Where("task_id = ?", "rp-row").First(&loaded).Error)
			require.NotNil(t, loaded.RequestPlugins)
			require.Equal(t, []string{"inst-1"}, loaded.RequestPlugins.Instances)
			require.Equal(t, "openai", loaded.RequestPlugins.Format)
			require.JSONEq(t, `{"model":"gpt-4o"}`, string(loaded.RequestPlugins.Request))
			t.Logf("%s: fresh + upgrade migrations idempotent", dialect)
		})
	}
}
