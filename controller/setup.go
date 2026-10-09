package controller

import (
	"github.com/uter-ai/uter/i18n"
	"time"

	"github.com/uter-ai/uter/common"

	"github.com/gin-gonic/gin"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"
)

type Setup struct {
	Status       bool   `json:"status"`
	RootInit     bool   `json:"root_init"`
	DatabaseType string `json:"database_type"`
}

type SetupRequest struct {
	Username           string `json:"username"`
	Password           string `json:"password"`
	ConfirmPassword    string `json:"confirmPassword"`
	SelfUseModeEnabled bool   `json:"SelfUseModeEnabled"`
	DemoSiteEnabled    bool   `json:"DemoSiteEnabled"`
}

func GetSetup(c *gin.Context) {
	setup := Setup{
		Status: constant.Setup,
	}
	if constant.Setup {
		c.JSON(200, gin.H{
			"success": true,
			"data":    setup,
		})
		return
	}
	setup.RootInit = model.RootUserExists()
	setup.DatabaseType = string(common.MainDatabaseType())
	c.JSON(200, gin.H{
		"success": true,
		"data":    setup,
	})
}

func PostSetup(c *gin.Context) {
	// Check if setup is already completed
	if constant.Setup {
		c.JSON(200, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgCommonAlready_initialized),
		})
		return
	}

	// Check if root user already exists
	rootExists := model.RootUserExists()

	// 安全加固（对应审计项 P2-5）：若 root 账号已存在但系统未标记初始化，说明是
	// 「只迁移了 users 表 / setups 表缺失」之类的异常部署态。此时任意匿名请求仍可
	// 经本接口改写「自用模式 / 演示站模式」并把系统标记为已初始化，属于未授权写。
	// 直接拒绝，要求使用已有管理员账号正常登录。
	if rootExists {
		c.JSON(200, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgCommonAlready_initialized),
		})
		return
	}

	var req SetupRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgCommonInvalid_param),
		})
		return
	}

	// If root doesn't exist, validate and create admin account
	if !rootExists {
		// Validate username length: max 12 characters to align with model.User validation
		if len(req.Username) > 12 {
			c.JSON(200, gin.H{
				"success": false,
				"message": i18n.T(c, i18n.MsgCommonUsername_too_long),
			})
			return
		}
		// Validate password
		if req.Password != req.ConfirmPassword {
			c.JSON(200, gin.H{
				"success": false,
				"message": i18n.T(c, i18n.MsgCommonPassword_mismatch),
			})
			return
		}

		if err := common.ValidateNewAccountPassword(req.Password); err != nil {
			c.JSON(200, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}

		// Create root user
		hashedPassword, err := common.HashAccountPassword(req.Password)
		if err != nil {
			c.JSON(200, gin.H{
				"success": false,
				"message": i18n.T(c, i18n.MsgCommonSystem_error),
			})
			return
		}
		rootUser := model.User{
			Username:    req.Username,
			Password:    hashedPassword,
			Role:        common.RoleRootUser,
			Status:      common.UserStatusEnabled,
			DisplayName: "Root User",
			AccessToken: nil,
			Quota:       100000000,
		}
		err = model.DB.Create(&rootUser).Error
		if err != nil {
			c.JSON(200, gin.H{
				"success": false,
				"message": i18n.T(c, i18n.MsgCommonCreate_admin_failed),
			})
			return
		}
	}

	// Set operation modes
	operation_setting.SelfUseModeEnabled = req.SelfUseModeEnabled
	operation_setting.DemoSiteEnabled = req.DemoSiteEnabled

	// Save operation modes to database for persistence
	err = model.UpdateOption("SelfUseModeEnabled", boolToString(req.SelfUseModeEnabled))
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgCommonSave_self_use_mode_failed),
		})
		return
	}

	err = model.UpdateOption("DemoSiteEnabled", boolToString(req.DemoSiteEnabled))
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgCommonSave_demo_mode_failed),
		})
		return
	}

	// Update setup status
	constant.Setup = true

	setup := model.Setup{
		Version:       common.Version,
		InitializedAt: time.Now().Unix(),
	}
	err = model.DB.Create(&setup).Error
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgCommonInit_failed),
		})
		return
	}

	c.JSON(200, gin.H{
		"success": true,
		"message": i18n.T(c, i18n.MsgCommonInit_success),
	})
}

func boolToString(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
