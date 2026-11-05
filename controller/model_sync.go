package controller

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/model"

	"github.com/gin-gonic/gin"
)

// 上游地址
const (
	upstreamModelsURL  = "https://basellm.github.io/llm-metadata/api/newapi/models.json"
	upstreamVendorsURL = "https://basellm.github.io/llm-metadata/api/newapi/vendors.json"

	// models.dev 是第二个上游：basellm 只提供文案类字段（描述/图标/标签/
	// 供应商/端点），没有上下文窗口、最大输出、模态、知识截止、发布日期，
	// 而定价页的模型详情卡片需要这五项。它免费、无需鉴权、按 provider 分组。
	defaultModelsDevURL = "https://models.dev/api.json"
)

// getModelsDevURL 允许用环境变量替换 models.dev 地址（私有镜像或测试桩）。
func getModelsDevURL() string {
	return strings.TrimSpace(common.GetEnvOrDefaultString("SYNC_MODELSDEV_URL", defaultModelsDevURL))
}

func normalizeLocale(locale string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(locale)) {
	case "", "zh", "zh-cn":
		return "zh", true
	case "en":
		return "en", true
	case "ja":
		return "ja", true
	default:
		return "", false
	}
}

func getUpstreamBase() string {
	return common.GetEnvOrDefaultString("SYNC_UPSTREAM_BASE", "https://basellm.github.io/llm-metadata")
}

func getUpstreamURLs(locale string) (modelsURL, vendorsURL string) {
	base := strings.TrimRight(getUpstreamBase(), "/")
	if l, ok := normalizeLocale(locale); ok && l != "" {
		return fmt.Sprintf("%s/api/i18n/%s/newapi/models.json", base, l),
			fmt.Sprintf("%s/api/i18n/%s/newapi/vendors.json", base, l)
	}
	return fmt.Sprintf("%s/api/newapi/models.json", base), fmt.Sprintf("%s/api/newapi/vendors.json", base)
}

type upstreamEnvelope[T any] struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    []T    `json:"data"`
}

type upstreamModel struct {
	Description string          `json:"description"`
	Endpoints   json.RawMessage `json:"endpoints"`
	Icon        string          `json:"icon"`
	ModelName   string          `json:"model_name"`
	NameRule    int             `json:"name_rule"`
	Status      int             `json:"status"`
	Tags        string          `json:"tags"`
	VendorName  string          `json:"vendor_name"`
}

type upstreamVendor struct {
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Name        string `json:"name"`
	Status      int    `json:"status"`
}

var (
	etagCache  = make(map[string]string)
	bodyCache  = make(map[string][]byte)
	cacheMutex sync.RWMutex
)

func newHTTPClient() *http.Client {
	timeoutSec := common.GetEnvOrDefault("SYNC_HTTP_TIMEOUT_SECONDS", 10)
	dialer := &net.Dialer{Timeout: time.Duration(timeoutSec) * time.Second}
	transport := &http.Transport{
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   time.Duration(timeoutSec) * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		ResponseHeaderTimeout: time.Duration(timeoutSec) * time.Second,
	}
	if common.TLSInsecureSkipVerify {
		transport.TLSClientConfig = common.InsecureTLSConfig.Clone()
	}
	transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, _, err := net.SplitHostPort(addr)
		if err != nil {
			host = addr
		}
		if strings.HasSuffix(host, "github.io") {
			if conn, err := dialer.DialContext(ctx, "tcp4", addr); err == nil {
				return conn, nil
			}
			return dialer.DialContext(ctx, "tcp6", addr)
		}
		return dialer.DialContext(ctx, network, addr)
	}
	return &http.Client{Transport: transport}
}

var (
	httpClientOnce sync.Once
	httpClient     *http.Client
)

func getHTTPClient() *http.Client {
	httpClientOnce.Do(func() {
		httpClient = newHTTPClient()
	})
	return httpClient
}

func fetchJSON[T any](ctx context.Context, url string, out *upstreamEnvelope[T]) error {
	var lastErr error
	attempts := max(common.GetEnvOrDefault("SYNC_HTTP_RETRY", 3), 1)
	baseDelay := 200 * time.Millisecond
	maxMB := common.GetEnvOrDefault("SYNC_HTTP_MAX_MB", 10)
	maxBytes := int64(maxMB) << 20
	for attempt := 0; attempt < attempts; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		// ETag conditional request
		cacheMutex.RLock()
		if et := etagCache[url]; et != "" {
			req.Header.Set("If-None-Match", et)
		}
		cacheMutex.RUnlock()

		resp, err := getHTTPClient().Do(req)
		if err != nil {
			lastErr = err
			// backoff with jitter
			sleep := baseDelay * time.Duration(1<<attempt)
			jitter := time.Duration(rand.Intn(150)) * time.Millisecond
			time.Sleep(sleep + jitter)
			continue
		}
		func() {
			defer resp.Body.Close()
			switch resp.StatusCode {
			case http.StatusOK:
				// read body into buffer for caching and flexible decode
				limited := io.LimitReader(resp.Body, maxBytes+1)
				buf, err := io.ReadAll(limited)
				if err != nil {
					lastErr = err
					return
				}
				if int64(len(buf)) > maxBytes {
					lastErr = errors.New("upstream metadata exceeds size limit")
					return
				}

				// SY-001: parse and validate BEFORE caching. The previous order wrote
				// the raw body and ETag into the cache and only then attempted to
				// decode it, so a malformed payload would be stored and then re-served
				// verbatim on every subsequent 304 response — the bad cache could
				// never recover. Only cache once we know the payload decodes.
				if err := common.Unmarshal(buf, out); err != nil {
					// Try decode as pure array
					var arr []T
					if err2 := common.Unmarshal(buf, &arr); err2 != nil {
						lastErr = err
						return
					}
					out.Success = true
					out.Data = arr
					out.Message = ""
				} else {
					if !out.Success && len(out.Data) == 0 && out.Message == "" {
						out.Success = true
					}
				}

				// Cache only after a successful decode.
				cacheMutex.Lock()
				if et := resp.Header.Get("ETag"); et != "" {
					etagCache[url] = et
				}
				bodyCache[url] = buf
				cacheMutex.Unlock()
				lastErr = nil
			case http.StatusNotModified:
				// use cache
				cacheMutex.RLock()
				buf := bodyCache[url]
				cacheMutex.RUnlock()
				if len(buf) == 0 {
					lastErr = errors.New("cache miss for 304 response")
					return
				}
				if err := common.Unmarshal(buf, out); err != nil {
					var arr []T
					if err2 := common.Unmarshal(buf, &arr); err2 != nil {
						lastErr = err
						return
					}
					out.Success = true
					out.Data = arr
					out.Message = ""
				} else {
					if !out.Success && len(out.Data) == 0 && out.Message == "" {
						out.Success = true
					}
				}
				lastErr = nil
			default:
				lastErr = errors.New(resp.Status)
			}
		}()
		if lastErr == nil {
			return nil
		}
		sleep := baseDelay * time.Duration(1<<attempt)
		jitter := time.Duration(rand.Intn(150)) * time.Millisecond
		time.Sleep(sleep + jitter)
	}
	return lastErr
}

type metadataSyncSource struct {
	Locale     string `json:"locale"`
	ModelsURL  string `json:"models_url"`
	VendorsURL string `json:"vendors_url"`
	Version    string `json:"version"`

	// models.dev 侧的来源信息。两个源合并成一份目录后，运营需要知道规格字段
	// 从哪来、命中多少个模型，否则「同步了但详情页还是空」无从排查。
	ModelsDevURL   string `json:"models_dev_url,omitempty"`
	ModelsDevError string `json:"models_dev_error,omitempty"`
	SpecMatchCount int    `json:"spec_match_count"`
}

// fetchRawBytes 抓取一份原始响应体，带 ETag 条件请求与重试。
//
// 与 fetchJSON 分开是因为 models.dev 的载荷是「provider -> models」的 map，
// 既不是 envelope 也不是数组，套 upstreamEnvelope 解不出来。缓存一律在
// validate 通过之后才写入：否则一份畸形载荷会被 304 分支反复回放，永远
// 恢复不了（fetchJSON 里的 SY-001 修的是同一个洞）。
func fetchRawBytes(ctx context.Context, url string, maxMB int, validate func([]byte) error) ([]byte, error) {
	var lastErr error
	attempts := max(common.GetEnvOrDefault("SYNC_HTTP_RETRY", 3), 1)
	baseDelay := 200 * time.Millisecond
	maxBytes := int64(maxMB) << 20
	for attempt := 0; attempt < attempts; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, err
		}
		cacheMutex.RLock()
		if et := etagCache[url]; et != "" {
			req.Header.Set("If-None-Match", et)
		}
		cacheMutex.RUnlock()

		resp, err := getHTTPClient().Do(req)
		if err != nil {
			lastErr = err
			time.Sleep(baseDelay*time.Duration(1<<attempt) + time.Duration(rand.Intn(150))*time.Millisecond)
			continue
		}
		func() {
			defer resp.Body.Close()
			switch resp.StatusCode {
			case http.StatusOK:
				buf, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
				if err != nil {
					lastErr = err
					return
				}
				if int64(len(buf)) > maxBytes {
					lastErr = fmt.Errorf("%s: payload exceeds %d MB", url, maxMB)
					return
				}
				if validate != nil {
					if err := validate(buf); err != nil {
						lastErr = fmt.Errorf("%s: %w", url, err)
						return
					}
				}
				cacheMutex.Lock()
				if et := resp.Header.Get("ETag"); et != "" {
					etagCache[url] = et
				}
				bodyCache[url] = buf
				cacheMutex.Unlock()
				lastErr = nil
			case http.StatusNotModified:
				cacheMutex.RLock()
				buf := bodyCache[url]
				cacheMutex.RUnlock()
				if len(buf) == 0 {
					lastErr = fmt.Errorf("%s: cache miss for 304 response", url)
					return
				}
				lastErr = nil
			default:
				lastErr = errors.New(resp.Status)
			}
		}()
		if lastErr == nil {
			cacheMutex.RLock()
			buf := bodyCache[url]
			cacheMutex.RUnlock()
			if len(buf) == 0 {
				return nil, fmt.Errorf("%s: empty payload", url)
			}
			return buf, nil
		}
		time.Sleep(baseDelay*time.Duration(1<<attempt) + time.Duration(rand.Intn(150))*time.Millisecond)
	}
	return nil, lastErr
}

// loadModelsDevIndex 拉取并索引 models.dev 目录。
//
// 失败不阻断整轮同步：basellm 是必选的下游口径，models.dev 只补规格字段，
// 单独挂掉时仍应让运营同步文案；错误通过 source.ModelsDevError 回显，
// 让界面能说明「规格字段这次没拿到」而不是静默留空。
func loadModelsDevIndex(ctx context.Context, source *metadataSyncSource) (*model.ModelsDevCatalogIndex, int) {
	url := getModelsDevURL()
	source.ModelsDevURL = url
	if url == "" {
		source.ModelsDevError = "no models.dev endpoint configured"
		return nil, 0
	}
	raw, err := fetchRawBytes(ctx, url, common.GetEnvOrDefault("SYNC_MODELSDEV_MAX_MB", 32), func(buf []byte) error {
		// 只校验形状，不建索引：建索引的开销远大于一次 JSON 合法性检查，
		// 校验放在这里只是为了避免把畸形载荷写进缓存。
		var probe map[string]json.RawMessage
		return common.Unmarshal(buf, &probe)
	})
	if err != nil {
		source.ModelsDevError = err.Error()
		return nil, 0
	}
	index, err := model.NewModelsDevCatalogIndexFromJSON(raw)
	if err != nil {
		source.ModelsDevError = err.Error()
		return nil, 0
	}
	return index, index.Len()
}

type metadataSyncField struct {
	Field    string `json:"field"`
	Local    any    `json:"local"`
	Upstream any    `json:"upstream"`
}

type metadataSyncCandidate struct {
	ModelName      string                `json:"model_name"`
	Kind           string                `json:"kind"`
	Scope          string                `json:"scope"`
	RecordVersion  string                `json:"record_version"`
	Fields         []metadataSyncField   `json:"fields"`
	Upstream       *model.MetadataValues `json:"upstream,omitempty"`
	VendorToCreate string                `json:"vendor_to_create,omitempty"`
}

func fetchMetadataCatalog(c *gin.Context, locale string) (metadataSyncSource, map[string]model.MetadataValues, map[string]model.Vendor, error) {
	return fetchMetadataCatalogContext(c.Request.Context(), locale)
}

// fetchMetadataCatalogContext is the context-based form used by both the
// interactive sync endpoints and the unattended channel-sync fill, so the
// upstream fetch, its timeout and its payload validation stay identical.
func fetchMetadataCatalogContext(ctx context.Context, locale string) (metadataSyncSource, map[string]model.MetadataValues, map[string]model.Vendor, error) {
	resolved, valid := normalizeLocale(locale)
	if !valid {
		return metadataSyncSource{}, nil, nil, errors.New("unsupported metadata language")
	}
	modelsURL, vendorsURL := getUpstreamURLs(resolved)
	source := metadataSyncSource{Locale: resolved, ModelsURL: modelsURL, VendorsURL: vendorsURL}
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, time.Duration(common.GetEnvOrDefault("SYNC_HTTP_TIMEOUT_SECONDS", 15))*time.Second)
	defer cancel()
	var modelsEnv upstreamEnvelope[upstreamModel]
	var vendorsEnv upstreamEnvelope[upstreamVendor]
	var modelsErr, vendorsErr error
	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); modelsErr = fetchJSON(ctx, modelsURL, &modelsEnv) }()
	go func() { defer wg.Done(); vendorsErr = fetchJSON(ctx, vendorsURL, &vendorsEnv) }()
	wg.Wait()
	if modelsErr != nil {
		return source, nil, nil, fmt.Errorf("fetch models (%s, %s): %w", resolved, modelsURL, modelsErr)
	}
	if vendorsErr != nil {
		return source, nil, nil, fmt.Errorf("fetch vendors (%s, %s): %w", resolved, vendorsURL, vendorsErr)
	}
	if !modelsEnv.Success || !vendorsEnv.Success {
		return source, nil, nil, errors.New("upstream metadata source reported failure")
	}
	models := make(map[string]model.MetadataValues)
	vendors := make(map[string]model.Vendor)
	for _, vendor := range vendorsEnv.Data {
		vendor.Name = strings.TrimSpace(vendor.Name)
		if vendor.Name == "" {
			continue
		}
		vendors[vendor.Name] = model.Vendor{Name: vendor.Name, Description: vendor.Description, Icon: model.NormalizeVendorIconKey(vendor.Icon), Status: vendor.Status}
	}
	for _, item := range modelsEnv.Data {
		if strings.TrimSpace(item.ModelName) == "" {
			continue
		}
		endpoints := ""
		if len(item.Endpoints) > 0 && string(item.Endpoints) != "null" {
			if err := common.Unmarshal(item.Endpoints, &endpoints); err != nil {
				endpoints = string(item.Endpoints)
			}
		}
		values := model.MetadataValues{Description: item.Description, Icon: model.NormalizeColorIconKey(item.Icon), Tags: item.Tags, Vendor: strings.TrimSpace(item.VendorName), Endpoints: endpoints, NameRule: item.NameRule, Status: item.Status}
		if err := model.ValidateMetadataValues(values); err != nil {
			return source, nil, nil, fmt.Errorf("model %s: %w", item.ModelName, err)
		}
		if _, duplicate := models[item.ModelName]; duplicate {
			return source, nil, nil, fmt.Errorf("duplicate upstream model: %s", item.ModelName)
		}
		models[item.ModelName] = values
	}
	// 双源合并：basellm 管文案，models.dev 管规格。合并发生在建版本号之前，
	// 让版本号如实反映「最终会写进库的那份数据」——否则 models.dev 刷新后
	// 版本号不动，预览里显示的规格和实际写入的就会不一致。
	//
	// models.dev 拉取失败不阻断整轮同步，只在 source 上记下原因：basellm 仍是
	// 文案字段的唯一来源，让它因为第二个源抽风而整体失败没有收益。
	if index, indexed := loadModelsDevIndex(ctx, &source); indexed > 0 {
		if matched, mergeErr := model.MergeCatalogSpecsInto(models, index); mergeErr != nil {
			source.ModelsDevError = fmt.Sprintf("merge catalog specs: %v", mergeErr)
		} else {
			source.SpecMatchCount = matched
		}
	}
	encoded, err := common.Marshal([]any{source.Locale, models, vendors})
	if err != nil {
		return source, nil, nil, err
	}
	source.Version = fmt.Sprintf("%x", sha256.Sum256(encoded))
	return source, models, vendors, nil
}

func SyncUpstreamPreview(c *gin.Context) {
	source, upstream, upstreamVendors, err := fetchMetadataCatalog(c, c.Query("locale"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	locals, vendors, err := model.GetMetadataSyncState(model.DB)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	missing, err := model.GetMissingModels()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	siteNames := make(map[string]bool)
	allNames := make(map[string]bool)
	for name := range locals {
		siteNames[name] = true
		allNames[name] = true
	}
	for _, name := range missing {
		siteNames[name] = true
		allNames[name] = true
	}
	for name := range upstream {
		allNames[name] = true
	}
	names := make([]string, 0, len(allNames))
	for name := range allNames {
		names = append(names, name)
	}
	sort.Strings(names)
	vendorByID := make(map[int]*model.Vendor)
	for _, vendor := range vendors {
		vendorByID[vendor.Id] = vendor
	}
	candidates := make([]metadataSyncCandidate, 0, len(names))
	for _, name := range names {
		candidate := metadataSyncCandidate{ModelName: name, Scope: "catalog", Kind: "create", Fields: []metadataSyncField{}}
		if siteNames[name] {
			candidate.Scope = "site"
		}
		local := locals[name]
		up, found := upstream[name]
		if !found {
			candidate.Kind = "missing_upstream"
			candidates = append(candidates, candidate)
			continue
		}
		candidate.Upstream = &up
		var localVendor *model.Vendor
		if local != nil {
			localVendor = vendorByID[local.VendorID]
		}
		candidate.RecordVersion = model.MetadataRecordVersion(local, localVendor, model.FindMetadataVendor(vendors, up.Vendor))
		if local != nil && local.SyncOfficial == 0 {
			candidate.Kind = "blocked"
			candidates = append(candidates, candidate)
			continue
		}
		if up.Vendor != "" && model.FindMetadataVendor(vendors, up.Vendor) == nil {
			if _, exists := upstreamVendors[up.Vendor]; !exists {
				candidate.Kind = "missing_vendor"
				candidates = append(candidates, candidate)
				continue
			}
			candidate.VendorToCreate = up.Vendor
		}
		localValues := model.MetadataValues{}
		if local != nil {
			candidate.Kind = "update"
			// 本地侧必须把六个规格字段一并带上：预览是按整个 MetadataValues
			// 逐字段比对的，漏填会让「本地已有上下文窗口」显示成本地空值，
			// 运营一旦勾选就等于把已有事实清成 0。
			localValues = model.MetadataValues{
				Description:      local.Description,
				Icon:             local.Icon,
				Tags:             local.Tags,
				Endpoints:        local.Endpoints,
				NameRule:         local.NameRule,
				Status:           local.Status,
				ContextLength:    local.ContextLength,
				MaxOutputTokens:  local.MaxOutputTokens,
				KnowledgeCutoff:  local.KnowledgeCutoff,
				ReleaseDate:      local.ReleaseDate,
				InputModalities:  local.InputModalities,
				OutputModalities: local.OutputModalities,
			}
			if localVendor != nil {
				localValues.Vendor = localVendor.Name
			}
		}
		localRaw, _ := common.Marshal(localValues)
		upRaw, _ := common.Marshal(up)
		var localFields, upFields map[string]any
		_ = common.Unmarshal(localRaw, &localFields)
		_ = common.Unmarshal(upRaw, &upFields)
		for _, field := range model.MetadataSyncFields {
			if local == nil || localFields[field] != upFields[field] {
				candidate.Fields = append(candidate.Fields, metadataSyncField{Field: field, Local: localFields[field], Upstream: upFields[field]})
			}
		}
		if local != nil && len(candidate.Fields) == 0 {
			candidate.Kind = "unchanged"
		}
		candidates = append(candidates, candidate)
	}
	common.ApiSuccess(c, gin.H{"source": source, "candidates": candidates})
}

func SyncUpstreamModels(c *gin.Context) {
	var request struct {
		Locale        string                        `json:"locale"`
		SourceVersion string                        `json:"source_version"`
		Selections    []model.MetadataSyncSelection `json:"selections"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || len(request.Selections) == 0 || request.SourceVersion == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Preview and select metadata changes before applying"})
		return
	}
	source, upstream, vendors, err := fetchMetadataCatalog(c, request.Locale)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if source.Version != request.SourceVersion {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": "Upstream metadata changed; preview again"})
		return
	}
	updates := make([]model.MetadataSyncUpdate, 0, len(request.Selections))
	for _, selection := range request.Selections {
		values, exists := upstream[selection.ModelName]
		if !exists {
			c.JSON(http.StatusConflict, gin.H{"success": false, "message": "Selected upstream model is no longer available"})
			return
		}
		updates = append(updates, model.MetadataSyncUpdate{MetadataSyncSelection: selection, Values: values})
	}
	result, err := model.ApplyMetadataSync(updates, vendors)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, model.ErrMetadataSyncConflict) {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"success": false, "message": err.Error()})
		return
	}
	recordManageAudit(c, "model.metadata.sync", map[string]any{"created_models": result.CreatedModels, "updated_models": result.UpdatedModels, "created_vendors": result.CreatedVendors})
	common.ApiSuccess(c, result)
}
