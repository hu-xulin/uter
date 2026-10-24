package controller

import (
	"crypto/subtle"
	"errors"
	"net"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/uter-ai/uter/common"
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
	// 三个字段在两个状态下都有意义，统一填充后单一返回路径：
	// status——是否已完成初始化（constant.Setup == true 即「初始化已完成」）；
	// root_init——根用户是否已存在（初始化流程的另一半状态）；
	// database_type——未初始化时前端据此展示即将使用的库，已初始化时运维
	// 据此确认当前库型。此前已初始化分支提前返回，database_type 停留在零值，
	// 前端据此渲染会出现空值。
	setup := Setup{
		Status:       constant.Setup,
		RootInit:     model.RootUserExists(),
		DatabaseType: string(common.MainDatabaseType()),
	}
	c.JSON(200, gin.H{
		"success": true,
		"data":    setup,
	})
}

// setupLoopbackRequired 报告初始化接口是否只接受本机回环请求。
//
// 桌面模式恒为真：内嵌后端带着 Root 权限与匿名初始化入口，一旦监听到局域网，
// 同网段任何设备都能在首次初始化时抢先创建 Root。服务端部署可通过
// SETUP_REQUIRE_LOOPBACK=true 显式开启同样的限制（例如把初始化留给运维
// 在本机完成），默认关闭以不改变容器首启体验。
func setupLoopbackRequired() bool {
	if common.IsDesktopMode() {
		return true
	}
	switch strings.ToLower(strings.TrimSpace(os.Getenv("SETUP_REQUIRE_LOOPBACK"))) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

// requestFromLoopback 判断请求是否来自本机回环。
//
// 必须读 RemoteAddr 而不是 c.ClientIP()：后者默认信任 X-Forwarded-For，
// 局域网攻击者只需伪造一个 `X-Forwarded-For: 127.0.0.1` 头就能把任意来源
// 伪装成本机。RemoteAddr 是内核对端地址，无法伪造。
func requestFromLoopback(c *gin.Context) bool {
	if c.Request == nil {
		return false
	}
	host, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		host = c.Request.RemoteAddr
	}
	host = strings.Trim(host, "[]")
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func PostSetup(c *gin.Context) {
	// ---- 1) 已完成的初始化永久拒绝 ----------------------------------------
	//
	// 这里同时查内存态与数据库态：constant.Setup 在进程启动时由 CheckSetup 填充，
	// 但它是内存值，任何「绕过进程直接写库」或「并发抢建」的情况都要靠数据库
	// 的初始化标记行来兜底。两个都不许再创建/替换 Root。
	if constant.Setup || model.GetSetup() != nil {
		common.ApiErrorT(c, "The system is already initialized")
		return
	}

	// ---- 2) 本机回环限制（桌面模式强制）----------------------------------
	if setupLoopbackRequired() && !requestFromLoopback(c) {
		common.ApiErrorT(c, "Initialization is only allowed from this computer")
		return
	}

	// ---- 3) 可选的一次性初始化令牌 ---------------------------------------
	//
	// 服务端部署（容器/云主机）需要远程完成首次初始化，此时禁止把 Root 创建
	// 权开放给整个局域网：设置 SETUP_TOKEN 后，请求必须带上同样的令牌。
	//
	// 注意取反的位置：缺少令牌、或令牌不相等，都要拒绝。早期版本把条件写成
	// `provided == "" || subtleEqual(...)`，等于「令牌正确才拒绝」——正好反了，
	// 而它仍然会让「缺少令牌」被拒绝，所以肉眼审查很容易漏过去。
	if expected := strings.TrimSpace(os.Getenv("SETUP_TOKEN")); expected != "" {
		provided := strings.TrimSpace(c.GetHeader("X-Setup-Token"))
		if provided == "" || !subtleEqual(provided, expected) {
			common.ApiErrorT(c, "Invalid setup token")
			return
		}
	}

	var req SetupRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	// 若 Root 已存在，本次只补齐初始化标记与运行模式（备份恢复场景）。
	// 绝不覆盖、替换或改动既有 Root 账户。
	rootExists := model.RootUserExists()
	var rootUser *model.User
	if !rootExists {
		// Validate username length: max 12 characters to align with model.User validation
		if len(req.Username) > 12 {
			common.ApiErrorT(c, "Username must be {{max}} characters or fewer", map[string]any{"max": 12})
			return
		}
		// Validate password
		if req.Password != req.ConfirmPassword {
			common.ApiErrorT(c, "Passwords do not match")
			return
		}

		if err := common.ValidateNewAccountPasswordStrength(req.Password, req.Username, ""); err != nil {
			c.JSON(200, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}

		// Create root user
		hashedPassword, err := common.HashAccountPassword(req.Password)
		if err != nil {
			common.ApiErrorT(c, "System error: {{error}}", map[string]any{"error": err.Error()})
			return
		}
		rootUser = &model.User{
			Username:    req.Username,
			Password:    hashedPassword,
			Role:        common.RoleRootUser,
			Status:      common.UserStatusEnabled,
			DisplayName: "Root User",
			AccessToken: nil,
			Quota:       100000000,
		}
	}

	// ---- 4) 单事务原子初始化 ------------------------------------------------
	//
	// 三个写入（初始化标记、Root、运行模式）在同一个事务里，且标记行的主键唯一
	// 约束是「只能初始化一次」的数据库级闸门：两个并发请求只有一个能提交，
	// 另一个收到 ErrSetupAlreadyInitialized。
	if initErr := model.InitializeSystem(model.SetupInitParams{
		Version:            common.Version,
		RootUser:           rootUser,
		SelfUseModeEnabled: req.SelfUseModeEnabled,
		DemoSiteEnabled:    req.DemoSiteEnabled,
	}); initErr != nil {
		if errors.Is(initErr, model.ErrSetupAlreadyInitialized) {
			// 明确的拒绝：并发抢建失败，或初始化已完成。不重试、不建第二个 Root。
			common.ApiErrorT(c, "The system is already initialized")
			return
		}
		common.ApiErrorT(c, "Failed to initialize the system: {{error}}", map[string]any{"error": initErr.Error()})
		return
	}

	// Set operation modes（内存态，与事务内的选项写入保持同一份输入）
	operation_setting.SelfUseModeEnabled = req.SelfUseModeEnabled
	operation_setting.DemoSiteEnabled = req.DemoSiteEnabled

	// Update setup status
	constant.Setup = true

	common.ApiSuccessT(c, "System initialized successfully", nil)
}

// subtleEqual 用常量时间比较令牌，避免按前缀逐字节泄露匹配长度。
func subtleEqual(provided, expected string) bool {
	if len(provided) != len(expected) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) == 1
}
