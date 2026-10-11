package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"

	"golang.org/x/sync/singleflight"
)

const (
	codexLatestReleaseURL      = "https://api.github.com/repos/openai/codex/releases/latest"
	codexClientVersionCacheTTL = time.Hour
)

type codexClientVersionCache struct {
	mu sync.Mutex
	// inflight 合并并发的外网请求：缓存过期瞬间可能有大量渠道发现请求同时到达，
	// 只放一个出去打 api.github.com，其余等待它把结果写进缓存。
	inflight singleflight.Group

	version   string
	expiresAt time.Time
}

var latestCodexClientVersion codexClientVersionCache

func GetLatestCodexClientVersion(ctx context.Context, client *http.Client) (string, error) {
	return latestCodexClientVersion.get(ctx, client, codexLatestReleaseURL, time.Now())
}

// get 读取缓存并在过期时回源。
//
// 锁只保护缓存字段的读写：原先整个函数（含最长 20s 的外网请求）都在 cache.Lock()
// 里，而这是包级全局锁，所有并发的渠道发现请求会串行排队并叠加各自的超时。
// 现在改成「锁内查缓存 → 锁外做 IO → 锁内写缓存」，并用 singleflight 合并并发回源。
func (cache *codexClientVersionCache) get(ctx context.Context, client *http.Client, releaseURL string, now time.Time) (string, error) {
	if version, ok := cache.cached(now); ok {
		return version, nil
	}

	version, err, _ := cache.inflight.Do(releaseURL, func() (any, error) {
		// 等锁期间可能已有别的请求刷新过缓存，再查一次避免重复回源。
		if version, ok := cache.cached(time.Now()); ok {
			return version, nil
		}
		// IO 在锁外进行：包级锁不能被一次外网往返占住。
		fetched, fetchErr := fetchLatestCodexClientVersion(ctx, client, releaseURL)
		if fetchErr != nil {
			// 回源失败时若有旧值则续期复用（stale-while-error），保持原行为。
			stale, staleErr := cache.stale(fetchErr, time.Now())
			if staleErr != nil {
				return "", staleErr
			}
			return stale, nil
		}
		cache.store(fetched, time.Now())
		return fetched, nil
	})
	if err != nil {
		return "", err
	}
	return version.(string), nil
}

// cached 在锁内读取未过期的缓存值。
func (cache *codexClientVersionCache) cached(now time.Time) (string, bool) {
	cache.mu.Lock()
	defer cache.mu.Unlock()
	if cache.version != "" && now.Before(cache.expiresAt) {
		return cache.version, true
	}
	return "", false
}

// stale 在回源失败时续期已有值，避免上游抖动导致每次请求都去打一次外网。
// 没有旧值时把原始回源错误原样返回。
func (cache *codexClientVersionCache) stale(fetchErr error, now time.Time) (string, error) {
	cache.mu.Lock()
	defer cache.mu.Unlock()
	if cache.version == "" {
		return "", fetchErr
	}
	cache.expiresAt = now.Add(codexClientVersionCacheTTL)
	return cache.version, nil
}

// store 在锁内写入新鲜值。
func (cache *codexClientVersionCache) store(version string, now time.Time) {
	cache.mu.Lock()
	defer cache.mu.Unlock()
	cache.version = version
	cache.expiresAt = now.Add(codexClientVersionCacheTTL)
}

func fetchLatestCodexClientVersion(ctx context.Context, client *http.Client, releaseURL string) (string, error) {
	if client == nil {
		return "", fmt.Errorf("nil http client")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, releaseURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "uter")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("codex release lookup failed: status=%d", resp.StatusCode)
	}

	var release struct {
		Name       string `json:"name"`
		Draft      bool   `json:"draft"`
		Prerelease bool   `json:"prerelease"`
	}
	if err := common.DecodeJson(resp.Body, &release); err != nil {
		return "", err
	}
	if release.Draft || release.Prerelease {
		return "", fmt.Errorf("latest codex release is not stable")
	}
	version := strings.TrimSpace(release.Name)
	if version == "" {
		return "", fmt.Errorf("latest codex release has no version name")
	}
	return version, nil
}

func FetchCodexModels(
	ctx context.Context,
	client *http.Client,
	baseURL string,
	oauthKey *CodexOAuthKey,
	clientVersion string,
) (statusCode int, models []string, err error) {
	if client == nil {
		return 0, nil, fmt.Errorf("nil http client")
	}
	if oauthKey == nil {
		return 0, nil, fmt.Errorf("nil oauth key")
	}

	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	accessToken := strings.TrimSpace(oauthKey.AccessToken)
	accountID := strings.TrimSpace(oauthKey.AccountID)
	clientVersion = strings.TrimSpace(clientVersion)
	if baseURL == "" {
		return 0, nil, fmt.Errorf("empty baseURL")
	}
	if accessToken == "" {
		return 0, nil, fmt.Errorf("codex channel: access_token is required")
	}
	if accountID == "" {
		return 0, nil, fmt.Errorf("codex channel: account_id is required")
	}
	if clientVersion == "" {
		return 0, nil, fmt.Errorf("codex channel: client_version is required")
	}

	modelsURL, err := url.Parse(baseURL + "/backend-api/codex/models")
	if err != nil {
		return 0, nil, err
	}
	query := modelsURL.Query()
	query.Set("client_version", clientVersion)
	modelsURL.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, modelsURL.String(), nil)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("ChatGPT-Account-Id", accountID)
	req.Header.Set("User-Agent", "codex-cli/"+clientVersion)
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return resp.StatusCode, nil, nil
	}

	var result struct {
		Models []struct {
			Slug string `json:"slug"`
		} `json:"models"`
	}
	if err := common.Unmarshal(body, &result); err != nil {
		return resp.StatusCode, nil, err
	}

	seen := make(map[string]struct{}, len(result.Models))
	models = make([]string, 0, len(result.Models))
	for _, item := range result.Models {
		slug := strings.TrimSpace(item.Slug)
		if slug == "" {
			continue
		}
		if _, ok := seen[slug]; ok {
			continue
		}
		seen[slug] = struct{}{}
		models = append(models, slug)
	}
	return resp.StatusCode, models, nil
}
