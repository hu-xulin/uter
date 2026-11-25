package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// BailianCatalogSnapshotKey stores the last successfully fetched official
// Alibaba Bailian model catalog. It is a reference snapshot, not a billing
// configuration: pulling the catalog never changes a model's price.
const BailianCatalogSnapshotKey = "BailianCatalogSnapshot"

const (
	bailianModelsPath      = "/api/v1/models"
	bailianCatalogPageSize = 100
	bailianCatalogMaxPages = 20
	bailianRequestTimeout  = 30 * time.Second
)

// BailianPrice is one billable item inside a price range.
type BailianPrice struct {
	Type      string `json:"type"`
	Price     string `json:"price"`
	PriceUnit string `json:"price_unit"`
	PriceName string `json:"price_name"`
	TimeBand  string `json:"time_band,omitempty"`
}

// BailianPriceRange groups the price items that share one range (for example
// Default, or a token length band).
type BailianPriceRange struct {
	Prices    []BailianPrice `json:"prices"`
	RangeName string         `json:"range_name"`
}

// BailianModel is one model record returned by GET /api/v1/models.
type BailianModel struct {
	Model              string              `json:"model"`
	ModelAlias         string              `json:"model_alias,omitempty"`
	Name               string              `json:"name"`
	Description        string              `json:"description"`
	Provider           string              `json:"provider"`
	Capabilities       []string            `json:"capabilities"`
	InferenceProvider  string              `json:"inference_provider"`
	Features           []string            `json:"features"`
	Prices             []BailianPriceRange `json:"prices"`
	PublishedTime      string              `json:"published_time"`
	EquivalentSnapshot string              `json:"equivalent_snapshot"`
	InferenceMetadata  map[string]any      `json:"inference_metadata"`
	ModelInfo          map[string]any      `json:"model_info"`
	InferenceOffline   any                 `json:"inference_offline_info"`
}

// BailianCatalog is the persisted snapshot of the official catalog.
type BailianCatalog struct {
	FetchedAt      time.Time               `json:"fetched_at"`
	ChannelID      int                     `json:"channel_id"`
	BaseURL        string                  `json:"base_url"`
	Region         BailianRegion           `json:"region,omitempty"`
	Total          int                     `json:"total"`
	Models         []BailianModel          `json:"models"`
	ReferencePrice []BailianReferencePrice `json:"reference_prices,omitempty"`
}

type bailianModelsResponse struct {
	Code    any    `json:"code"`
	Message string `json:"message"`
	Success bool   `json:"success"`
	Output  struct {
		Total    int            `json:"total"`
		PageNo   int            `json:"page_no"`
		PageSize int            `json:"page_size"`
		Models   []BailianModel `json:"models"`
	} `json:"output"`
}

// FetchBailianCatalog pulls every page of the official catalog. The channel's
// existing API key is used; it is never included in an error or log line.
//
// The workspace host can answer 429 while the regional DashScope host accepts
// the same key. Both point at the same catalog, so the regional host is used as
// a fallback instead of failing the whole pull on a transient throttle.
func FetchBailianCatalog(ctx context.Context, baseURL, apiKey string) (*BailianCatalog, error) {
	baseURL = normalizeBailianBaseURL(baseURL)
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return nil, errors.New("bailian API key is empty")
	}
	if baseURL == "" || bareAliyunHost(baseURL) {
		// A bare `https://aliyuncs.com` (or an empty base) is not a Model Studio
		// endpoint. The DashScope host serves the same catalog with the same
		// key, so recover to it instead of failing the whole pull.
		baseURL = "https://dashscope.aliyuncs.com"
	}

	candidates := []string{baseURL}
	for _, fallback := range bailianFallbackHosts(baseURL) {
		if fallback != baseURL {
			candidates = append(candidates, fallback)
		}
	}

	var lastErr error
	for _, base := range candidates {
		catalog, err := fetchBailianCatalogFromBase(ctx, base, apiKey)
		if err == nil {
			catalog.BaseURL = base
			sort.Slice(catalog.Models, func(i, j int) bool {
				return catalog.Models[i].Model < catalog.Models[j].Model
			})
			return catalog, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

func fetchBailianCatalogFromBase(ctx context.Context, baseURL, apiKey string) (*BailianCatalog, error) {
	endpoint := strings.TrimRight(baseURL, "/") + bailianModelsPath
	if _, err := validateUpstreamEndpoint(endpoint); err != nil {
		return nil, err
	}
	client := newUpstreamHTTPClient(bailianRequestTimeout)
	catalog := &BailianCatalog{FetchedAt: time.Now().UTC()}
	seen := make(map[string]struct{})

	for page := 1; page <= bailianCatalogMaxPages; page++ {
		query := url.Values{}
		query.Set("page_no", fmt.Sprintf("%d", page))
		query.Set("page_size", fmt.Sprintf("%d", bailianCatalogPageSize))
		// Official Model Studio catalog scope: only models this channel can
		// actually serve. The response remains authoritative; pagination and
		// all price ranges are preserved.
		query.Set("language", "zh-CN")
		query.Set("inference_providers", "aliyun-bailian")
		query.Set("supports", "inference")

		body, err := bailianGETWithRetry(ctx, client, endpoint+"?"+query.Encode(), apiKey)
		if err != nil {
			return nil, err
		}
		var payload bailianModelsResponse
		if err := common.Unmarshal(body, &payload); err != nil {
			return nil, fmt.Errorf("decode bailian catalog: %w", err)
		}
		if !payload.Success {
			message := strings.TrimSpace(payload.Message)
			if message == "" {
				message = "bailian catalog returned success=false"
			}
			return nil, errors.New(message)
		}
		catalog.Total = payload.Output.Total
		if len(payload.Output.Models) == 0 {
			break
		}
		for _, item := range payload.Output.Models {
			if item.Model == "" {
				continue
			}
			if _, exists := seen[item.Model]; exists {
				continue
			}
			seen[item.Model] = struct{}{}
			catalog.Models = append(catalog.Models, item)
		}
		if catalog.Total > 0 && len(catalog.Models) >= catalog.Total {
			break
		}
	}
	if len(catalog.Models) == 0 {
		return nil, errors.New("bailian catalog returned no models")
	}
	// A partial page set must never be published as the complete catalog.
	// total is the upstream's authoritative count for this scoped query.
	if catalog.Total > 0 && len(catalog.Models) < catalog.Total {
		return nil, fmt.Errorf(
			"bailian catalog incomplete: fetched %d of %d models",
			len(catalog.Models), catalog.Total,
		)
	}
	return catalog, nil
}

func bailianGETWithRetry(ctx context.Context, client *http.Client, endpoint, apiKey string) ([]byte, error) {
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(time.Duration(attempt) * time.Second):
			}
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, err := client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("request bailian catalog: %w", err)
			continue
		}
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
		resp.Body.Close()
		if readErr != nil {
			lastErr = readErr
			continue
		}
		if resp.StatusCode == http.StatusOK {
			return body, nil
		}
		lastErr = fmt.Errorf("bailian catalog returned HTTP %d: %s", resp.StatusCode, truncateBailianBody(sanitizeBailianError(body, apiKey)))
		if resp.StatusCode != http.StatusTooManyRequests && resp.StatusCode < 500 {
			return nil, lastErr
		}
	}
	return nil, lastErr
}

// sanitizeBailianError removes the API key from an upstream error body before
// it can reach a log line or the admin API response.
func sanitizeBailianError(body []byte, apiKey string) []byte {
	key := strings.TrimSpace(apiKey)
	if key == "" {
		return body
	}
	return []byte(strings.ReplaceAll(string(body), key, "***"))
}

func truncateBailianBody(body []byte) string {
	text := strings.TrimSpace(string(body))
	if len(text) > 300 {
		text = text[:300]
	}
	return text
}

func normalizeBailianBaseURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	raw = strings.TrimRight(raw, "/")
	// A channel may store the OpenAI-compatible base
	// (https://host/compatible-mode/v1). The official catalog lives at
	// https://host/api/v1/models, so the compatible suffix must not be part of
	// the catalog host.
	raw = strings.TrimSuffix(raw, "/compatible-mode/v1")
	return strings.TrimRight(raw, "/")
}

// bailianFallbackHosts returns the regional DashScope host that serves the same
// catalog. Only hosts derived from the configured channel are returned; this
// is not an arbitrary redirect.
func bailianFallbackHosts(baseURL string) []string {
	host := strings.ToLower(baseURL)
	switch {
	case strings.Contains(host, "cn-beijing.maas.aliyuncs.com"),
		strings.Contains(host, "cn-hongkong.maas.aliyuncs.com"),
		strings.Contains(host, "ap-northeast-1.maas.aliyuncs.com"),
		strings.Contains(host, "eu-central-1.maas.aliyuncs.com"),
		strings.Contains(host, "dashscope.aliyuncs.com"):
		return []string{"https://dashscope.aliyuncs.com"}
	case strings.Contains(host, "ap-southeast-1.maas.aliyuncs.com"),
		strings.Contains(host, "dashscope-intl.aliyuncs.com"),
		strings.Contains(host, "us-east-1.maas.aliyuncs.com"):
		return []string{"https://dashscope-intl.aliyuncs.com"}
	case bareAliyunHost(baseURL):
		return []string{"https://dashscope.aliyuncs.com"}
	default:
		return nil
	}
}

// SaveBailianCatalogSnapshot persists the catalog as a reference-only option.
// A channel-scoped copy keeps concurrent Alibaba channels from overwriting each
// other's catalog, while the global key still serves the default summary.
func SaveBailianCatalogSnapshot(catalog *BailianCatalog) error {
	if catalog == nil {
		return errors.New("bailian catalog is nil")
	}
	raw, err := common.Marshal(catalog)
	if err != nil {
		return err
	}
	if err := model.UpdateOption(BailianCatalogSnapshotKey, string(raw)); err != nil {
		return err
	}
	if catalog.ChannelID > 0 {
		return model.UpdateOption(bailianChannelSnapshotKey(catalog.ChannelID), string(raw))
	}
	return nil
}

func bailianChannelSnapshotKey(channelID int) string {
	return BailianCatalogSnapshotKey + ":" + strconv.Itoa(channelID)
}

// LoadBailianCatalogSnapshotForChannel prefers the channel-scoped snapshot and
// falls back to the global one for channels that have not synced yet.
func LoadBailianCatalogSnapshotForChannel(channelID int) *BailianCatalog {
	if channelID > 0 {
		if raw := strings.TrimSpace(common.GetOption(bailianChannelSnapshotKey(channelID))); raw != "" {
			var catalog BailianCatalog
			if err := common.Unmarshal([]byte(raw), &catalog); err == nil {
				return &catalog
			}
		}
	}
	return LoadBailianCatalogSnapshot()
}

// LoadBailianCatalogSnapshot returns the last saved catalog, or nil when the
// catalog has never been pulled.
func LoadBailianCatalogSnapshot() *BailianCatalog {
	raw := strings.TrimSpace(common.GetOption(BailianCatalogSnapshotKey))
	if raw == "" {
		return nil
	}
	var catalog BailianCatalog
	if err := common.Unmarshal([]byte(raw), &catalog); err != nil {
		return nil
	}
	return &catalog
}

// bareAliyunHost reports whether the configured base is the generic Aliyun
// landing host rather than a Model Studio endpoint.
func bareAliyunHost(raw string) bool {
	parsed, err := url.Parse(normalizeBailianBaseURL(raw))
	if err != nil {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	return host == "aliyuncs.com" || host == "www.aliyuncs.com"
}

type BailianCoverageModel struct {
	ModelName       string `json:"model_name"`
	InCatalog       bool   `json:"in_catalog"`
	LifecycleStatus string `json:"lifecycle_status,omitempty"`
	PricingStatus   string `json:"pricing_status,omitempty"`
	HasManualPrice  bool   `json:"has_manual_price"`
	Action          string `json:"action"`
}

type BailianCatalogCoverage struct {
	ChannelID     int                    `json:"channel_id"`
	CatalogModels int                    `json:"catalog_models"`
	ChannelModels int                    `json:"channel_models"`
	Matched       int                    `json:"matched"`
	Unmatched     int                    `json:"unmatched"`
	Models        []BailianCoverageModel `json:"models"`
}

// BuildBailianCatalogCoverage compares the channel's served models with the
// latest public catalog snapshot. Unmatched models are never removed here; the
// operator decides whether to keep a manual/contract price or stop selling.
func BuildBailianCatalogCoverage(channelID int) (*BailianCatalogCoverage, error) {
	channel, err := model.GetChannelById(channelID, true)
	if err != nil || channel == nil {
		return nil, errors.New("channel not found")
	}
	catalog := LoadBailianCatalogSnapshotForChannel(channelID)
	if catalog == nil {
		return nil, errors.New("bailian catalog snapshot is not available")
	}
	channelModels := channel.GetModels()
	matchedNames := BailianSeenChannelModels(catalog, channelModels)
	matched := make(map[string]bool, len(matchedNames))
	for _, name := range matchedNames {
		matched[name] = true
	}
	rows, _ := model.ListChannelModelPricing(channelID)
	rowByName := make(map[string]model.ChannelModelPricing, len(rows))
	for _, row := range rows {
		rowByName[row.ModelName] = row
	}
	report := &BailianCatalogCoverage{
		ChannelID: channelID, CatalogModels: len(catalog.Models), ChannelModels: len(channelModels),
		Models: make([]BailianCoverageModel, 0, len(channelModels)),
	}
	for _, name := range channelModels {
		item := BailianCoverageModel{ModelName: name, InCatalog: matched[name]}
		if row, ok := rowByName[name]; ok {
			item.LifecycleStatus = row.LifecycleStatus
			item.PricingStatus = row.PricingStatus
			if strings.TrimSpace(row.InternalPricing) != "" {
				var internal model.ChannelInternalPricing
				if err := common.UnmarshalJsonStr(row.InternalPricing, &internal); err == nil {
					item.HasManualPrice = strings.TrimSpace(internal.Source) == "manual"
				}
			}
		}
		if item.InCatalog {
			item.Action = "IN_CATALOG"
			report.Matched++
		} else if item.HasManualPrice {
			item.Action = "KEEP_MANUAL"
		} else {
			item.Action = "REVIEW_REQUIRED"
		}
		report.Models = append(report.Models, item)
	}
	report.Unmatched = report.ChannelModels - report.Matched
	sort.Slice(report.Models, func(i, j int) bool { return report.Models[i].ModelName < report.Models[j].ModelName })
	return report, nil
}
