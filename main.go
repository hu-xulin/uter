package main

import (
	"bytes"
	"context"
	"embed"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/controller"
	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/middleware"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/oauth"
	"github.com/uter-ai/uter/pkg/jsplugin"
	perfmetrics "github.com/uter-ai/uter/pkg/perf_metrics"
	"github.com/uter-ai/uter/pkg/wsmanager"
	"github.com/uter-ai/uter/relay"
	kitutil "github.com/uter-ai/uter/relaykit/relayconvert/kitutil"
	"github.com/uter-ai/uter/router"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/service/authz"
	_ "github.com/uter-ai/uter/setting/performance_setting"
	"github.com/uter-ai/uter/setting/ratio_setting"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	_ "net/http/pprof"
)

// web/dist 是唯一的嵌入产物目录：SPA 的 bundle、原生文档编译出的异步
// chunk、7 份搜索索引与 user-guide 截图都由 `bun run build` 落在这里。
//
// 文档收敛后不再有独立静态站，也就不再需要为下划线目录加 `all:` 前缀的
// embed 特例：Next.js 曾把 CSS/JS 放在 `_next/`，而 //go:embed 的目录模式
// 默认跳过以 `.` 或 `_` 开头的名字。现在整棵产物树都是常规命名，一个
// `web/dist` 就够了。
//
//go:embed web/dist
var buildFS embed.FS

//go:embed web/dist/index.html
var indexPage []byte

// embeddedNativeDocsPaths 是原生文档能完整工作所必需的静态产物。
//
// MDX 正文编译进了 SPA 的异步 chunk，但搜索索引与 user-guide 截图仍是
// `public/` 下的静态文件，由 `cp -R public/. dist/` 拷进 web/dist。只编译
// Go 而漏掉前端构建时 //go:embed 不会报错（目录存在即可），服务能起，
// 但搜索空、截图 404。这里在启动时把缺失逐条说出来，而不是等用户发现。
//
// 发布链路另由 `scripts/verify-docs-artifacts.sh` 在构建阶段拦截。
var embeddedNativeDocsPaths = []string{
	"web/dist/docs-search/zh.json",
	"web/dist/docs-search/zh-TW.json",
	"web/dist/docs-search/en.json",
	"web/dist/docs-search/fr.json",
	"web/dist/docs-search/ja.json",
	"web/dist/docs-search/ru.json",
	"web/dist/docs-search/vi.json",
	"web/dist/user-guide/zh/auth/light/01-login.webp",
	"web/dist/user-guide/en/auth/light/01-login.webp",
}

// missingNativeDocsAssets 返回未随二进制嵌入的原生文档静态产物路径。
func missingNativeDocsAssets() []string {
	var missing []string
	for _, p := range embeddedNativeDocsPaths {
		if _, err := buildFS.Open(p); err != nil {
			missing = append(missing, p)
		}
	}
	return missing
}

// checkNativeDocsAssets 检查原生文档的静态产物是否随二进制一起嵌入。
//
// 不致命：CI 的占位前端与有意裁剪的构建确实不带这些文件。但缺失必须被
// 响亮地说出来——静默缺失正是这类缺陷最难排查的原因。
func checkNativeDocsAssets() {
	missing := missingNativeDocsAssets()
	if len(missing) == 0 {
		return
	}
	common.SysLog(common.LogText(
		"WARNING: native docs assets are missing from this binary (%v). "+
			"Docs search and user-guide screenshots will not load. "+
			"Run `cd web && bun run build` before go build, "+
			"or check the tree with scripts/verify-docs-artifacts.sh.",
		missing))
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "plugin" {
		os.Exit(jsplugin.RunCLI(os.Args[2:], os.Stdout, os.Stderr))
	}
	startTime := time.Now()
	kitutil.SetLogging(common.SysLog, func(message string) {
		logger.LogError(nil, message)
	})
	kitutil.SetSystemErrorLogging(common.SysError)

	err := InitResources()
	if err != nil {
		common.FatalLog(common.LogText("failed to initialize resources: %s", err.Error()))
		return
	}

	common.SysLog(common.LogText("New API %s started", common.Version))
	checkNativeDocsAssets()
	if os.Getenv("GIN_MODE") != "debug" {
		gin.SetMode(gin.ReleaseMode)
	}
	if common.DebugEnabled {
		common.SysLog(common.LogText("running in debug mode"))
	}

	kitutil.Debug.Store(common.DebugEnabled)

	defer func() {
		err := model.CloseDB()
		if err != nil {
			common.FatalLog(common.LogText("failed to close database: %s", err.Error()))
		}
	}()

	if common.RedisEnabled {
		// for compatibility with old versions
		common.MemoryCacheEnabled = true
	}
	if common.MemoryCacheEnabled {
		common.SysLog(common.LogText("memory cache enabled"))
		common.SysLog(common.LogText("sync frequency: %d seconds", common.SyncFrequency))

		// Add panic recovery and retry for InitChannelCache
		func() {
			defer func() {
				if r := recover(); r != nil {
					common.SysLog(common.LogText("InitChannelCache panic: %v, retrying once", r))
					// Retry once
					_, _, fixErr := model.FixAbility()
					if fixErr != nil {
						common.FatalLog(common.LogText("InitChannelCache failed: %s", fixErr.Error()))
					}
				}
			}()
			model.InitChannelCache()
		}()

		go model.SyncChannelCache(common.SyncFrequency)
	}
	wsmanager.StartSubscriber(context.Background())

	// Warm pricing after channel cache initialization so Advanced Custom
	// endpoint inference can read cached route settings on first request.
	model.GetPricing()

	// 主源 models.dev 与备用官方预设在启动时预热：冷缓存时 /api/pricing 的
	// 非阻塞路径会先返回空参考价，首个访客就看不到官方价划线与折扣角标。
	// WarmPresetRatios 内部异步执行，不阻塞启动。
	controller.WarmPresetRatios()

	// 热更新配置
	go model.SyncOptions(common.SyncFrequency)
	go controller.SyncTaskPlugins()

	// SMTP 多账号轮换：发信前按 SMTPAccounts 顺序选当日仍有配额的邮箱，
	// 成功提交后按账号累计当日用量（详见 service/smtp_accounts.go）。
	common.SMTPSenderProvider = service.SelectSMTPSender
	common.SMTPSentRecorder = service.RecordEmailSent

	// 创梦渠道（DreamRouter）每日价格同步：每天 0 点后首次 tick 触发，
	// 按「创梦默认组折扣价 +1 折」规则重算倍率并对齐渠道模型清单。
	go service.DreamRouterSyncTask()
	service.RunDreamRouterSyncOnStart()

	// 周期性重载授权策略，保证多节点/多 master 部署下权限变更能传播到每个实例
	go authz.StartPolicySync(common.SyncFrequency)

	// 数据看板
	go model.UpdateQuotaData()

	if os.Getenv("CHANNEL_UPDATE_FREQUENCY") != "" {
		frequency, err := strconv.Atoi(os.Getenv("CHANNEL_UPDATE_FREQUENCY"))
		if err != nil {
			common.FatalLog(common.LogText("failed to parse CHANNEL_UPDATE_FREQUENCY: %s", err.Error()))
		}
		go controller.AutomaticallyUpdateChannels(frequency)
	}

	// Codex credential auto-refresh check every 10 minutes, refresh when expires within 1 day
	service.StartCodexCredentialAutoRefreshTask()

	// 美元汇率自动同步：每 10 分钟拉取一次外部行情（A），并据此重算支付定价（B = A + 0.2）。
	// 钱包展示与下单计价都取 B，三者由这条任务统一维护，无需人工改配置。
	service.StartExchangeRateSync()

	// Subscription quota reset task (daily/weekly/monthly/custom)
	service.StartSubscriptionQuotaResetTask()

	// 支付宝订单对账：每 3 分钟主动查单一次，补齐「异步回调打不到 + 用户没回跳」
	// 时漏掉的支付状态，避免订单永久停在「待确认」。master-only，单飞保护。
	controller.StartAlipayReconcileTask()
	controller.StartWechatReconcileTask()

	// Report this process as a system instance so the System Info page can show
	// all currently alive nodes in multi-instance deployments.
	service.StartSystemInstanceReporter()

	// Wire task polling adaptor factory (breaks service -> relay import cycle).
	// Must run before the system task runner starts: the async_task_poll handler
	// calls service.RunTaskPollingOnce, which needs this factory set.
	service.GetTaskAdaptorFunc = func(platform constant.TaskPlatform) service.TaskPollingAdaptor {
		a := relay.GetTaskAdaptor(platform)
		if a == nil {
			return nil
		}
		return a
	}

	// Register the periodic channel test, upstream model update, and async task
	// polling (Midjourney / Suno / video) jobs as scheduled system tasks
	// (DB-lease dedup across masters + run history), then start the runner that
	// schedules and executes them. Master-only execution and the UpdateTask
	// switch are enforced inside the runner and each handler's Enabled().
	controller.RegisterScheduledSystemTasks()
	service.StartSystemTaskRunner()

	if os.Getenv("BATCH_UPDATE_ENABLED") == "true" {
		common.BatchUpdateEnabled = true
		common.SysLog(common.LogText("batch update enabled with interval %ss", strconv.Itoa(common.BatchUpdateInterval)))
		model.InitBatchUpdater()
	}

	if os.Getenv("ENABLE_PPROF") == "true" {
		// pprof exposes heap, goroutine and execution profiles that may contain
		// sensitive runtime data. Keep it loopback-only unless an operator
		// explicitly chooses a different bind address.
		pprofAddr := strings.TrimSpace(os.Getenv("PPROF_ADDR"))
		if pprofAddr == "" {
			pprofAddr = "127.0.0.1:8005"
		}
		gopool.Go(func() {
			if err := http.ListenAndServe(pprofAddr, nil); err != nil && !errors.Is(err, http.ErrServerClosed) {
				log.Printf("pprof server failed: %v", err)
			}
		})
		go common.Monitor()
		common.SysLog(common.LogText("pprof enabled addr=%s", pprofAddr))
	}

	err = common.StartPyroScope()
	if err != nil {
		common.SysError(common.LogText("start pyroscope error : %v", err))
	}

	// Initialize HTTP server
	server := gin.New()
	if err := middleware.ConfigureTrustedProxies(server); err != nil {
		common.FatalLog(common.LogText("failed to configure trusted proxies: %s", err.Error()))
		return
	}
	server.Use(gin.CustomRecovery(func(c *gin.Context, err any) {
		// Keep panic details in server logs only; panic values may include internal
		// paths, SQL details, provider payloads, or other sensitive data.
		common.SysError(common.LogText("panic detected: %v", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"message": "Internal server error",
				"type":    "new_api_panic",
			},
		})
	}))
	// This will cause SSE not to work!!!
	//server.Use(gzip.Gzip(gzip.DefaultCompression))
	server.Use(middleware.RequestId())
	server.Use(middleware.Version())
	server.Use(middleware.I18n())
	middleware.SetUpLogger(server)
	InjectUmamiAnalytics()
	InjectGoogleAnalytics()

	// 设置路由
	router.SetRouter(server, router.WebAssets{
		BuildFS:   buildFS,
		IndexPage: indexPage,
	})
	var port = os.Getenv("PORT")
	if port == "" {
		port = strconv.Itoa(*common.Port)
	}

	// 监听地址由部署形态决定（见 common/listen.go）：桌面模式恒绑定回环，
	// 服务端默认全部网卡并可用 HOST 显式覆盖。旧实现固定用 ":"+port，
	// 桌面形态下等于把带 Root 权限的后端暴露给整个局域网。
	listenAddr := common.ListenAddr(port)
	srv := &http.Server{
		Addr:              listenAddr,
		Handler:           server,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			common.FatalLog(common.LogText("failed to start HTTP server: %s", err.Error()))
		}
	}()

	time.Sleep(100 * time.Millisecond)

	common.LogStartupSuccess(startTime, listenAddr)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	common.SysLog(common.LogText("received signal: %v, shutting down...", sig))

	// SSE streams may run for minutes; give them time to finish before forced exit
	shutdownTimeout := time.Duration(common.GetEnvOrDefault("SHUTDOWN_TIMEOUT_SECONDS", 120)) * time.Second
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		common.SysError(common.LogText("server forced to shutdown: %v", err))
	}
	// 内存中的看板数据保存入库，避免重启丢失未落库数据 (issue #5679)
	if common.DataExportEnabled {
		model.SaveQuotaDataCache()
	}
	common.SysLog(common.LogText("server exited"))
}

func InjectUmamiAnalytics() {
	analyticsInjectBuilder := &strings.Builder{}
	if os.Getenv("UMAMI_WEBSITE_ID") != "" {
		umamiSiteID := os.Getenv("UMAMI_WEBSITE_ID")
		umamiScriptURL := os.Getenv("UMAMI_SCRIPT_URL")
		if umamiScriptURL == "" {
			umamiScriptURL = "https://analytics.umami.is/script.js"
		}
		analyticsInjectBuilder.WriteString("<script defer src=\"")
		analyticsInjectBuilder.WriteString(umamiScriptURL)
		analyticsInjectBuilder.WriteString("\" data-website-id=\"")
		analyticsInjectBuilder.WriteString(umamiSiteID)
		analyticsInjectBuilder.WriteString("\"></script>")
	}
	analyticsInjectBuilder.WriteString("<!--Umami Uter-->\n")
	analyticsInject := []byte(analyticsInjectBuilder.String())
	placeholder := []byte("<!--umami-->\n")
	indexPage = bytes.ReplaceAll(indexPage, placeholder, analyticsInject)
}

func InjectGoogleAnalytics() {
	analyticsInjectBuilder := &strings.Builder{}
	if os.Getenv("GOOGLE_ANALYTICS_ID") != "" {
		gaID := os.Getenv("GOOGLE_ANALYTICS_ID")
		// Google Analytics 4 (gtag.js)
		analyticsInjectBuilder.WriteString("<script async src=\"https://www.googletagmanager.com/gtag/js?id=")
		analyticsInjectBuilder.WriteString(gaID)
		analyticsInjectBuilder.WriteString("\"></script>")
		analyticsInjectBuilder.WriteString("<script>")
		analyticsInjectBuilder.WriteString("window.dataLayer = window.dataLayer || [];")
		analyticsInjectBuilder.WriteString("function gtag(){dataLayer.push(arguments);}")
		analyticsInjectBuilder.WriteString("gtag('js', new Date());")
		analyticsInjectBuilder.WriteString("gtag('config', '")
		analyticsInjectBuilder.WriteString(gaID)
		analyticsInjectBuilder.WriteString("');")
		analyticsInjectBuilder.WriteString("</script>")
	}
	analyticsInjectBuilder.WriteString("<!--Google Analytics Uter-->\n")
	analyticsInject := []byte(analyticsInjectBuilder.String())
	placeholder := []byte("<!--Google Analytics-->\n")
	indexPage = bytes.ReplaceAll(indexPage, placeholder, analyticsInject)
}

func InitResources() error {
	// Initialize resources here if needed
	// This is a placeholder function for future resource initialization
	err := godotenv.Load(".env")
	if err != nil {
		if common.DebugEnabled {
			common.SysLog(common.LogText("No .env file found, using default environment variables. If needed, please create a .env file and set the relevant variables."))
		}
	}

	// 加载环境变量
	common.InitEnv()

	logger.SetupLogger()

	// Initialize model settings
	ratio_setting.InitRatioSettings()

	service.InitHttpClient()

	// Initialize SQL Database
	err = model.InitDB()
	if err != nil {
		common.FatalLog(common.LogText("failed to initialize database: %s", err.Error()))
		return err
	}
	if err = authz.Init(model.DB); err != nil {
		common.FatalLog(common.LogText("failed to initialize authorization: %s", err.Error()))
		return err
	}
	if common.PasswordLoginEncryptionEnabled {
		if err = model.InitPasswordEncryption(); err != nil {
			common.FatalLog(common.LogText("failed to initialize password encryption: %s", err.Error()))
			return err
		}
	}

	model.CheckSetup()

	// Initialize options, should after model.InitDB()
	if common.IsMasterNode {
		if err := model.MigrateRetiredFrontendOptions(); err != nil {
			common.SysError(common.LogText("failed to migrate retired frontend options: %s", err.Error()))
		}
	}
	model.InitOptionMap()

	// 境内支付凭据体检：只判空不够，密钥格式不对时配置页仍显示「已启用」，
	// 用户点充值才在下单那一刻失败。这里把可解析性提前到启动期，问题直接进日志。
	// 不返回错误：支付是可选能力，未配置或配错不应阻断服务启动。
	for _, problem := range service.InspectCnPayCredentials() {
		common.SysError(common.LogText("cn payment credential invalid: %s", problem.String()))
	}

	// 清理旧的磁盘缓存文件
	common.CleanupOldCacheFiles()

	// Initialize SQL Database
	err = model.InitLogDB()
	if err != nil {
		return err
	}

	// Initialize Redis
	err = common.InitRedisClient()
	if err != nil {
		return err
	}

	perfmetrics.Init()

	// 启动系统监控
	common.StartSystemMonitor()

	// Initialize i18n
	err = i18n.Init()
	if err != nil {
		common.SysError(common.LogText("failed to initialize i18n: %s", err.Error()))
		// Don't return error, i18n is not critical
	} else {
		common.SysLog(common.LogText("i18n initialized with languages: %s", strings.Join(i18n.SupportedLanguages(), ", ")))
	}
	// Register user language loader for lazy loading
	i18n.SetUserLangLoader(model.GetUserLanguage)

	// Load custom OAuth providers from database
	err = oauth.LoadCustomProviders()
	if err != nil {
		common.SysError(common.LogText("failed to load custom OAuth providers: %s", err.Error()))
		// Don't return error, custom OAuth is not critical
	}

	service.StartAuthArtifactCleanup()

	return nil
}
