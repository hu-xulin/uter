package model

import (
	"errors"
	"time"

	"github.com/uter-ai/uter/common"

	"gorm.io/gorm"
)

type Setup struct {
	ID            uint   `json:"id" gorm:"primaryKey"`
	Version       string `json:"version" gorm:"type:varchar(50);not null"`
	InitializedAt int64  `json:"initialized_at" gorm:"type:bigint;not null"`
}

// SetupSingletonID 是初始化标记行的固定主键。
//
// 用它把「只能初始化一次」变成数据库级约束：两个并发请求都尝试插入这一行时，
// 只有一个能成功，另一个必然撞主键冲突并随事务整体回滚——不依赖
// 「先读 constant.Setup 再创建 Root」这种内存态判断，那种判断在并发下一律失效。
const SetupSingletonID uint = 1

// ErrSetupAlreadyInitialized 系统已完成初始化（含并发抢建失败）。
//
// 调用方必须把它映射成明确的拒绝，而不是「再试一次」：初始化完成后重复请求
// 不得创建、替换或修改 Root 账户。
var ErrSetupAlreadyInitialized = errors.New("system is already initialized")

// SetupInitParams 是一次初始化所需的全部输入。
//
// RootUser 为 nil 表示「Root 已存在，本次只补齐初始化标记与运行模式」——
// 恢复备份、或初始化到一半进程被杀的场景会走到这里。
type SetupInitParams struct {
	Version            string
	RootUser           *User
	SelfUseModeEnabled bool
	DemoSiteEnabled    bool
}

func GetSetup() *Setup {
	var setup Setup
	err := DB.First(&setup).Error
	if err != nil {
		return nil
	}
	return &setup
}

// InitializeSystem 在**单个数据库事务**内完成初始化：
//
//  1. 插入固定主键的初始化标记行（原子占位，唯一性由主键约束保证）；
//  2. 若尚无 Root，则创建初始管理员；
//  3. 写入 SelfUseMode / DemoSite 运行模式选项。
//
// 任一步失败整体回滚：不会出现「Root 建了但标记没写」的半成品状态，
// 也不会出现「标记写了但 Root 没建」导致再也无法初始化的死局。
//
// 并发安全性：两个请求同时进入时只有一个能插入标记行，另一个事务回滚并返回
// ErrSetupAlreadyInitialized。判定方式是「事务失败后再查一次标记行是否已存在」，
// 而不是按数据库方言匹配错误码（SQLite / MySQL / Postgres 的唯一键错误文本
// 各不相同，字符串匹配不可移植）。
func InitializeSystem(params SetupInitParams) error {
	err := DB.Transaction(func(tx *gorm.DB) error {
		// 1) 原子占位。先确认没有别的初始化行（老库可能是别的自增 id），
		// 再用固定主键插入——两者合起来才是「无论新旧库都只允许一次」。
		var existing int64
		if countErr := tx.Model(&Setup{}).Count(&existing).Error; countErr != nil {
			return countErr
		}
		if existing > 0 {
			return ErrSetupAlreadyInitialized
		}
		mark := Setup{
			ID:            SetupSingletonID,
			Version:       params.Version,
			InitializedAt: time.Now().Unix(),
		}
		if insertErr := tx.Create(&mark).Error; insertErr != nil {
			return insertErr
		}

		// 2) Root：事务内再查一次，避免「外部查过、事务内被并发建出」。
		if params.RootUser != nil {
			var rootCount int64
			if countErr := tx.Model(&User{}).
				Where("role = ?", common.RoleRootUser).Count(&rootCount).Error; countErr != nil {
				return countErr
			}
			if rootCount == 0 {
				if createErr := tx.Create(params.RootUser).Error; createErr != nil {
					return createErr
				}
			}
		}

		// 3) 运行模式。
		options := map[string]string{
			"SelfUseModeEnabled": setupBoolToString(params.SelfUseModeEnabled),
			"DemoSiteEnabled":    setupBoolToString(params.DemoSiteEnabled),
		}
		for key, value := range options {
			if optErr := upsertOptionTx(tx, key, value); optErr != nil {
				return optErr
			}
		}
		return nil
	})
	if err == nil {
		// 事务已提交，此刻才刷新内存态（失败时内存必须保持原样）。
		_ = updateOptionMap("SelfUseModeEnabled", setupBoolToString(params.SelfUseModeEnabled))
		_ = updateOptionMap("DemoSiteEnabled", setupBoolToString(params.DemoSiteEnabled))
		return nil
	}
	// 事务失败后标记行存在 → 是被另一个并发请求抢先初始化，而不是本地错误。
	if errors.Is(err, ErrSetupAlreadyInitialized) || GetSetup() != nil {
		return ErrSetupAlreadyInitialized
	}
	return err
}

// upsertOptionTx 在事务内写入选项。
//
// 不能直接用 UpdateOption：它走 DB（而不是 tx），会把写入留到事务外，
// 于是「标记回滚了、选项却生效了」，运行模式变成半成品。
func upsertOptionTx(tx *gorm.DB, key string, value string) error {
	option := Option{Key: key}
	// FirstOrCreate 的 SELECT/INSERT 同样在事务内执行。
	if err := tx.FirstOrCreate(&option, Option{Key: key}).Error; err != nil {
		return err
	}
	option.Value = value
	return tx.Save(&option).Error
}

// setupBoolToString 把布尔选项写成 Option 表里的字符串。
func setupBoolToString(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
