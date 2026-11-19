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
	client := &http.Client{Timeout: bailianRequestTimeout}
	catalog := &BailianCatalog{FetchedAt: time.Now().UTC()}
	seen := make(map[string]struct{})

	for page := 1; page <= bailianCatalogMaxPages; page++ {
		query := url.Values{}
		query.Set("page_no", fmt.Sprintf("%d", page))
		query.Set("page_size", fmt.Sprintf("%d", bailianCatalogPageSize))

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
		if raw := strings.TrimSpace(common.OptionMap[bailianChannelSnapshotKey(channelID)]); raw != "" {
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
	raw := strings.TrimSpace(common.OptionMap[BailianCatalogSnapshotKey])
	if raw == "" {
		return nil
	}
	var catalog BailianCatalog
	if err := common.Unmarshal([]byte(raw), &catalog); err != nil {
		return nil
	}
	return &catalog
}

// BailianCatalogModelNames returns the model IDs in the snapshot.
func BailianCatalogModelNames(catalog *BailianCatalog) []string {
	if catalog == nil {
		return nil
	}
	names := make([]string, 0, len(catalog.Models))
	for _, item := range catalog.Models {
		names = append(names, item.Model)
	}
	sort.Strings(names)
	return names
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
