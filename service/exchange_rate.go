package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
)

// 美元汇率自动同步任务。
//
// 计价链路只有一条，全部由这里维护：
//
//	A = USDExchangeRate   外部行情（USD→CNY），每 10 分钟刷新一次
//	B = Price             A + PriceAdjustmentRate（当前 −0.2），随 A 重算
//	C                     = B，钱包展示与下单实扣都取 B
//
// A 与 B 都会落库（后台设置页可见、重启后不丢），同时经 model.UpdateOption
// 刷新内存变量与 common.OptionMap，因此 /api/status 与 getPayMoney 立刻拿到新值。
const (
	exchangeRateSyncInterval = 10 * time.Minute
	exchangeRateFetchTimeout = 10 * time.Second

	// 合理区间，用于拒绝上游异常返回（0、负数、量级明显不对的脏数据）。
	exchangeRateMinSane = 1.0
	exchangeRateMaxSane = 100.0
)

var (
	exchangeRateSyncOnce    sync.Once
	exchangeRateSyncRunning atomic.Bool
)

type exchangeRateProvider struct {
	name  string
	url   string
	parse func([]byte) (float64, error)
}

// 行情源按顺序尝试，任一成功即返回。都不需要 API Key。
var exchangeRateProviders = []exchangeRateProvider{
	{name: "open.er-api.com", url: "https://open.er-api.com/v6/latest/USD", parse: parseERAPIUSDCNY},
	{name: "frankfurter.dev", url: "https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY", parse: parseFrankfurterUSDCNY},
}

func parseERAPIUSDCNY(body []byte) (float64, error) {
	var resp struct {
		Result string             `json:"result"`
		Rates  map[string]float64 `json:"rates"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return 0, err
	}
	if resp.Result != "" && resp.Result != "success" {
		return 0, fmt.Errorf("provider returned result=%q", resp.Result)
	}
	rate, ok := resp.Rates["CNY"]
	if !ok {
		return 0, fmt.Errorf("response has no CNY rate")
	}
	return rate, nil
}

func parseFrankfurterUSDCNY(body []byte) (float64, error) {
	var resp struct {
		Rates map[string]float64 `json:"rates"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return 0, err
	}
	rate, ok := resp.Rates["CNY"]
	if !ok {
		return 0, fmt.Errorf("response has no CNY rate")
	}
	return rate, nil
}

func exchangeRateHTTPClient() *http.Client {
	if client := GetHttpClient(); client != nil {
		return client
	}
	return http.DefaultClient
}

// FetchUSDCNYRate 依次尝试各行情源，返回第一个落在合理区间内的 USD→CNY 汇率。
func FetchUSDCNYRate(ctx context.Context) (rate float64, source string, err error) {
	var lastErr error
	for _, provider := range exchangeRateProviders {
		requestCtx, cancel := context.WithTimeout(ctx, exchangeRateFetchTimeout)
		req, reqErr := http.NewRequestWithContext(requestCtx, http.MethodGet, provider.url, nil)
		if reqErr != nil {
			cancel()
			lastErr = reqErr
			continue
		}
		req.Header.Set("Accept", "application/json")
		resp, doErr := exchangeRateHTTPClient().Do(req)
		if doErr != nil {
			cancel()
			lastErr = fmt.Errorf("%s: %w", provider.name, doErr)
			continue
		}
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		closeErr := resp.Body.Close()
		cancel()
		if readErr != nil {
			lastErr = fmt.Errorf("%s: read body: %w", provider.name, readErr)
			continue
		}
		if closeErr != nil {
			lastErr = fmt.Errorf("%s: close body: %w", provider.name, closeErr)
			continue
		}
		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("%s: unexpected status %d", provider.name, resp.StatusCode)
			continue
		}
		parsed, parseErr := provider.parse(body)
		if parseErr != nil {
			lastErr = fmt.Errorf("%s: %w", provider.name, parseErr)
			continue
		}
		if parsed < exchangeRateMinSane || parsed > exchangeRateMaxSane {
			lastErr = fmt.Errorf("%s: implausible USD/CNY rate %v", provider.name, parsed)
			continue
		}
		return parsed, provider.name, nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("no exchange rate provider configured")
	}
	return 0, "", lastErr
}

func formatRate(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}

// SyncExchangeRateOnce 拉取一次行情并落地 A / B，返回写入后的两个值。
func SyncExchangeRateOnce(ctx context.Context) (exchangeRate float64, price float64, err error) {
	rate, source, err := FetchUSDCNYRate(ctx)
	if err != nil {
		return 0, 0, err
	}

	// A 保留 2 位小数：既是用户能看懂的展示汇率，也让 B = A + 0.2 可以心算核对。
	exchangeRate = math.Round(rate*100) / 100
	if exchangeRate < exchangeRateMinSane {
		return 0, 0, fmt.Errorf("USD/CNY rate %v is out of range after rounding", exchangeRate)
	}
	// B 由四舍五入后的 A 推导，保证 B 恒等于 A + PriceAdjustmentRate。
	price = operation_setting.DerivedPriceFromExchangeRate(exchangeRate)

	if current := operation_setting.USDExchangeRate; math.Abs(current-exchangeRate) > 1e-9 {
		if err := model.UpdateOption("USDExchangeRate", formatRate(exchangeRate)); err != nil {
			return 0, 0, fmt.Errorf("persist USDExchangeRate: %w", err)
		}
	}
	if current := operation_setting.Price; math.Abs(current-price) > 1e-9 {
		if err := model.UpdateOption("Price", formatRate(price)); err != nil {
			return 0, 0, fmt.Errorf("persist Price: %w", err)
		}
	}

	// 记录最近一次成功同步时间（设置页用来展示「自动同步」状态）。
	now := time.Now().Unix()
	if err := model.UpdateOption("USDExchangeRateUpdatedAt", strconv.FormatInt(now, 10)); err != nil {
		// 时间戳只是辅助信息，写失败不影响计价，降级为日志。
		logger.LogWarn(ctx, common.LogText("failed to persist USDExchangeRateUpdatedAt: %s", err.Error()))
	}
	operation_setting.USDExchangeRateUpdatedAt = now

	logger.LogInfo(ctx, common.LogText("exchange rate synced: source=%s A(USDExchangeRate)=%.2f B(Price)=%.2f", source, exchangeRate, price))
	return exchangeRate, price, nil
}

func runExchangeRateSyncOnce() {
	if !exchangeRateSyncRunning.CompareAndSwap(false, true) {
		return
	}
	defer exchangeRateSyncRunning.Store(false)

	ctx, cancel := context.WithTimeout(context.Background(), exchangeRateFetchTimeout*2)
	defer cancel()

	if _, _, err := SyncExchangeRateOnce(ctx); err != nil {
		logger.LogWarn(ctx, common.LogText("exchange rate sync failed, keeping previous rate: %s", err.Error()))
	}
}

// StartExchangeRateSync 启动每 10 分钟一次的行情同步任务（仅主节点写库）。
func StartExchangeRateSync() {
	exchangeRateSyncOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}

		gopool.Go(func() {
			logger.LogInfo(context.Background(), common.LogText("exchange rate sync task started: interval=%s adjustment=%.2f", exchangeRateSyncInterval, operation_setting.PriceAdjustmentRate))

			// 启动即同步一次，避免重启后最长 10 分钟仍用旧汇率。
			runExchangeRateSyncOnce()

			ticker := time.NewTicker(exchangeRateSyncInterval)
			defer ticker.Stop()
			for range ticker.C {
				runExchangeRateSyncOnce()
			}
		})
	})
}
