package controller

import (
	"context"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/pkg/billingexpr"
	"github.com/uter-ai/uter/setting/billing_setting"
)

// APIKO 的控制面与公开目录接口。
//
// APIKO 的中转域名 api.apiko.app 只暴露 OpenAI/Anthropic 兼容的 /v1/*
// 路径，没有 new-api 的 /api/pricing；模型目录与价格由控制面公开提供，
// 不需要 API Key：
//
//	GET https://apiko.app/api/public/models?billing=all
//
// 返回的 pricing 是 APIKO 的售价（USD/百万 token 或每次调用），正是本渠道
// 应同步给 Uter 的默认价。
const (
	apikoControlPlaneURL   = "https://apiko.app"
	apikoPublicModelsPath  = "/api/public/models?billing=all"
	apikoMaxCatalogBytes   = 8 << 20
	apikoCatalogTimeoutSec = 20
)

type apikoContextTier struct {
	UpTo        *float64 `json:"upTo"`
	InputPer1M  *float64 `json:"inputPer1M"`
	OutputPer1M *float64 `json:"outputPer1M"`
	CachePer1M  *float64 `json:"cachePer1M"`
}

type apikoPricing struct {
	InputPer1M     *float64           `json:"inputPer1M"`
	OutputPer1M    *float64           `json:"outputPer1M"`
	CachePer1M     *float64           `json:"cachePer1M"`
	PerCall        *float64           `json:"perCall"`
	Tiers          []jsonTier         `json:"tiers"`
	ContextTiers   []apikoContextTier `json:"contextTiers"`
	PerSecondTiers []jsonTier         `json:"perSecondTiers"`
	Currency       string             `json:"currency"`
}

type jsonTier struct {
	Name      string   `json:"name"`
	PerCall   *float64 `json:"perCall"`
	PerSecond *float64 `json:"perSecond"`
}

type apikoModel struct {
	ID           string       `json:"id"`
	Provider     string       `json:"provider"`
	Capabilities []string     `json:"capabilities"`
	Pricing      apikoPricing `json:"pricing"`
}

type apikoCatalog struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		Models []apikoModel `json:"models"`
		Total  int          `json:"total"`
	} `json:"data"`
}

// apikoControlPlaneFor reports the control-plane origin that serves the public
// catalogue for an upstream base URL, when the upstream is APIKO.
func apikoControlPlaneFor(rawBaseURL string) (string, bool) {
	raw := strings.TrimSpace(rawBaseURL)
	if raw == "" {
		return "", false
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		parsed, err = url.Parse("https://" + raw)
		if err != nil || parsed.Host == "" {
			return "", false
		}
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "apiko.app" || host == "api.apiko.app" || strings.HasSuffix(host, ".apiko.app") {
		return apikoControlPlaneURL, true
	}
	return "", false
}

// fetchApikoPricingData turns APIKO's public catalogue into the pricing-sync
// shape: a billing expression per model, in USD/1M tokens (or per request).
// Models whose pricing cannot be expressed faithfully are skipped.
func fetchApikoPricingData(ctx context.Context, controlPlane string) (map[string]any, int, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, controlPlane+apikoPublicModelsPath, nil)
	if err != nil {
		return nil, 0, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", "uter-price-sync")

	response, err := (&http.Client{Timeout: apikoCatalogTimeoutSec * time.Second}).Do(request)
	if err != nil {
		return nil, 0, fmt.Errorf("apiko catalogue request failed: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, 0, fmt.Errorf("apiko catalogue returned %s", response.Status)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, apikoMaxCatalogBytes))
	if err != nil {
		return nil, 0, err
	}
	var catalog apikoCatalog
	if err := common.Unmarshal(body, &catalog); err != nil {
		return nil, 0, fmt.Errorf("apiko catalogue is not valid JSON: %w", err)
	}
	if catalog.Code != 0 {
		return nil, 0, fmt.Errorf("apiko catalogue error: %s", catalog.Message)
	}
	return apikoModelsToPricingSyncData(catalog.Data.Models)
}

func apikoModelsToPricingSyncData(models []apikoModel) (map[string]any, int, error) {
	modes := make(map[string]any, len(models))
	expressions := make(map[string]any, len(models))
	skipped := 0
	for _, model := range models {
		if strings.TrimSpace(model.ID) == "" {
			continue
		}
		expr, ok := apikoPriceExpression(model)
		if !ok {
			skipped++
			continue
		}
		if _, err := billingexpr.CompileFromCache(expr); err != nil {
			skipped++
			continue
		}
		modes[model.ID] = billing_setting.BillingModeTieredExpr
		expressions[model.ID] = expr
	}
	if len(expressions) == 0 {
		return nil, skipped, fmt.Errorf("apiko catalogue has no pricing this sync can represent")
	}
	return map[string]any{
		billing_setting.BillingModeField: modes,
		billing_setting.BillingExprField: expressions,
	}, skipped, nil
}

// apikoPriceExpression compiles one catalogue row into a billing expression.
// Only token-priced models (chat/audio) and flat per-request prices are
// represented; resolution- or duration-tiered media prices need request
// parameters the expression cannot see, so they are skipped rather than
// guessed.
func apikoPriceExpression(model apikoModel) (string, bool) {
	pricing := model.Pricing
	if len(pricing.ContextTiers) > 0 {
		expr, ok := apikoContextTiersExpression(pricing.ContextTiers)
		return expr, ok
	}
	if pricing.InputPer1M != nil || pricing.OutputPer1M != nil {
		terms := apikoTokenTerms(
			apikoValue(pricing.InputPer1M),
			apikoValue(pricing.OutputPer1M),
			apikoValue(pricing.CachePer1M),
		)
		if terms == "" {
			return "", false
		}
		return `tier("base", ` + terms + `)`, true
	}
	if pricing.PerCall != nil && *pricing.PerCall > 0 &&
		len(pricing.Tiers) == 0 && len(pricing.PerSecondTiers) == 0 {
		return `tier("request", fixed(` + apikoNumber(*pricing.PerCall) + `))`, true
	}
	return "", false
}

func apikoContextTiersExpression(tiers []apikoContextTier) (string, bool) {
	if len(tiers) == 0 {
		return "", false
	}
	expr := ""
	for index := len(tiers) - 1; index >= 0; index-- {
		tier := tiers[index]
		terms := apikoTokenTerms(
			apikoValue(tier.InputPer1M),
			apikoValue(tier.OutputPer1M),
			apikoValue(tier.CachePer1M),
		)
		if terms == "" {
			return "", false
		}
		current := fmt.Sprintf(`tier("tier_%d", %s)`, index+1, terms)
		if tier.UpTo == nil {
			expr = current
			continue
		}
		if expr == "" {
			continue
		}
		expr = fmt.Sprintf("len <= %s ? %s : %s", apikoNumber(*tier.UpTo), current, expr)
	}
	return expr, expr != ""
}

func apikoTokenTerms(inputPer1M, outputPer1M, cachePer1M float64) string {
	terms := make([]string, 0, 3)
	if inputPer1M > 0 {
		terms = append(terms, "p * "+apikoNumber(inputPer1M))
	}
	if outputPer1M > 0 {
		terms = append(terms, "c * "+apikoNumber(outputPer1M))
	}
	if cachePer1M > 0 {
		terms = append(terms, "cr * "+apikoNumber(cachePer1M))
	}
	return strings.Join(terms, " + ")
}

func apikoValue(value *float64) float64 {
	if value == nil || math.IsNaN(*value) || math.IsInf(*value, 0) || *value < 0 {
		return 0
	}
	return *value
}

func apikoNumber(value float64) string {
	if value == math.Trunc(value) {
		return strconv.FormatInt(int64(value), 10)
	}
	return strconv.FormatFloat(value, 'f', -1, 64)
}
