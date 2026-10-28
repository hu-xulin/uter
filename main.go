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

// 注意这里的两个 pattern，缺一不可：
//
//   - `web/dist` 嵌入前端 SPA 与文档页面；
//   - `all:web/dist/docs-content/_next` 嵌入 Next.js 静态导出的 CSS/JS。
//
// 为什么必须显式写上 `_next`：//go:embed 对「目录」模式有一个默认规则——
// 递归嵌入时会跳过名字以 `.` 或 `_` 开头的文件与目录。Next.js 静态导出恰恰
// 把全部样式与脚本放在 `_next/` 下，所以只写 `//go:embed web/dist` 会静默
// 丢掉整个 `_next` 目录：编译通过、文档页能打开，但没有 CSS 和 JS，页面是
// 散的。`all:` 前缀就是用来关闭这个「跳过下划线开头」的默认行为的。
//
// 这里没有直接用 `all:web/dist`：那会连 macOS 的 `.DS_Store` 一起嵌进二进制，
// 而它是否存在于工作区取决于开发机，会让构建结果不确定。
//
//go:embed web/dist all:web/dist/docs-content/_next
var buildFS embed.FS

//go:embed web/dist/index.html
var indexPage []byte

// embeddedDocsPaths 是 go:embed web/dist 时必须存在的文档静态站关键路径。
//
// 文档站是独立的 Next.js 工程（docs-web），它的 postbuild 才把静态导出拷进
// web/dist/docs-content。只构建 web 而漏掉 docs-web 时，go:embed 不会报错——
// 嵌入的只是一个空目录，编译通过、服务能起，但 /docs 全是空白。
//
// 注意这里刻意包含 `_next`：//go:embed 默认跳过以 `_` 开头的目录，而
// Next.js 把 CSS/JS 全放在那里，只校验 HTML 会漏掉「页面能开但没有样式」。
//
// 发布链路（release.yml / Dockerfile / electron-build.yml）已经用
// scripts/verify-docs-artifacts.sh 把这种情况挡在构建阶段；这里再兜一层，
// 让任何绕过发布链路的本地构建也能在启动日志里看到明确告警，而不是让用户
// 先发现文档打不开。
var embeddedDocsPaths = []string{
	"web/dist/docs-content/docs/zh/index.html",
	"web/dist/docs-content/about/en/index.html",
	"web/dist/docs-content/_next",
	"web/dist/docs-content/_next/static/chunks",
}

// missingEmbeddedDocs 返回未随二进制嵌入的文档静态站关键路径。
func missingEmbeddedDocs() []string {
	var missing []string
	for _, p := range embeddedDocsPaths {
		if _, err := buildFS.Open(p); err != nil {
			missing = append(missing, p)
		}
	}
	return missing
}

// checkEmbeddedDocs 检查文档静态站产物是否随二进制一起嵌入。
//
// 不致命：历史版本或有意裁剪的构建可能确实不带文档。但缺失必须被响亮地
// 说出来——静默缺失正是这个缺陷最难排查的原因。
func checkEmbeddedDocs() {
	missing := missingEmbeddedDocs()
	if len(missing) == 0 {
		return
	}
	common.SysLog(common.LogText(
		"WARNING: the docs static site is missing from this binary (%v). "+
			"The /docs pages will not be served. Rebuild docs-web "+
			"(cd docs-web && bun install && bun run build) before go build, "+
			"or run scripts/verify-docs-artifacts.sh to check web/dist.",
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
	checkEmbeddedDocs()
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

	// 热更新配置
	go model.SyncOptions(common.SyncFrequency)
	go controller.SyncTaskPlugins()

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
	analyticsInjectBuilder.WriteString("<!--Umami QuantumNous-->\n")
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
	analyticsInjectBuilder.WriteString("<!--Google Analytics QuantumNous-->\n")
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
