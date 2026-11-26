package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFetchBailianCatalogPaginatesAndParsesPrices(t *testing.T) {
	const key = "test-key"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "Bearer "+key, r.Header.Get("Authorization"))
		require.Equal(t, bailianModelsPath, r.URL.Path)
		page := r.URL.Query().Get("page_no")
		w.Header().Set("Content-Type", "application/json")
		switch page {
		case "1":
			_, _ = w.Write([]byte(`{
				"success": true,
				"output": {
					"total": 2,
					"page_no": 1,
					"page_size": 100,
					"models": [
						{
							"model": "qwen-image-2.0-pro",
							"name": "Qwen-Image-2.0-Pro",
							"capabilities": ["IG"],
							"prices": [{"range_name":"Default","prices":[
								{"type":"image_number","price":"0.5","price_unit":"每张","price_name":"图片生成"}
							]}]
						}
					]
				}
			}`))
		case "2":
			_, _ = w.Write([]byte(`{
				"success": true,
				"output": {
					"total": 2,
					"page_no": 2,
					"page_size": 100,
					"models": [
						{
							"model": "wan3.0-video",
							"name": "Wan3.0-Video",
							"capabilities": ["VG"],
							"prices": [{"range_name":"Default","prices":[
								{"type":"video_ratio_720p","price":"0.6","price_unit":"每秒","price_name":"视频生成（720P）"}
							]}]
						}
					]
				}
			}`))
		default:
			_, _ = w.Write([]byte(`{"success":true,"output":{"total":2,"models":[]}}`))
		}
	}))
	defer server.Close()

	catalog, err := FetchBailianCatalog(context.Background(), server.URL, key)
	require.NoError(t, err)
	require.Equal(t, 2, catalog.Total)
	require.Len(t, catalog.Models, 2)
	// Results are sorted by model name, not by page order.
	require.Equal(t, "qwen-image-2.0-pro", catalog.Models[0].Model)
	require.Equal(t, "wan3.0-video", catalog.Models[1].Model)

	require.Len(t, catalog.Models[0].Prices, 1)
	require.Len(t, catalog.Models[0].Prices[0].Prices, 1)
	require.Equal(t, "image_number", catalog.Models[0].Prices[0].Prices[0].Type)
	require.Equal(t, "0.5", catalog.Models[0].Prices[0].Prices[0].Price)
	require.Equal(t, "每张", catalog.Models[0].Prices[0].Prices[0].PriceUnit)

	require.Equal(t, "video_ratio_720p", catalog.Models[1].Prices[0].Prices[0].Type)
	require.Equal(t, "每秒", catalog.Models[1].Prices[0].Prices[0].PriceUnit)
}

func TestFetchBailianCatalogRejectsNonSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"success":false,"message":"invalid key"}`))
	}))
	defer server.Close()

	_, err := FetchBailianCatalog(context.Background(), server.URL, "bad")
	require.ErrorContains(t, err, "invalid key")
}

func TestFetchBailianCatalogFallbackHost(t *testing.T) {
	// A workspace endpoint is business-space scoped. Falling back to the public
	// DashScope catalog would reintroduce the full ~294 model directory.
	require.Nil(t, bailianFallbackHosts("https://ws-ssc8bd9i0yuj89n4.cn-beijing.maas.aliyuncs.com"))
	require.Equal(t, []string{"https://dashscope.aliyuncs.com"},
		bailianFallbackHosts("https://dashscope.aliyuncs.com"))
	require.Equal(t, []string{"https://dashscope-intl.aliyuncs.com"},
		bailianFallbackHosts("https://dashscope-intl.aliyuncs.com"))
	require.Nil(t, bailianFallbackHosts("https://example.com"))
}

func TestNormalizeBailianBaseURLMapsConsoleToCatalogAPI(t *testing.T) {
	// Operators often paste the Model Studio console URL into the channel base
	// URL. The console serves the SPA HTML for /api/v1/models; it must be
	// normalized to the DashScope catalog host so a catalog sync can succeed.
	cases := map[string]string{
		"https://bailian.console.aliyun.com":                         "https://dashscope.aliyuncs.com",
		"https://bailian.console.aliyun.com/":                        "https://dashscope.aliyuncs.com",
		"https://bailian.console.aliyun.com/cn-beijing/model/market": "https://dashscope.aliyuncs.com",
		"https://ws-ssc8bd9i0yuj89n4.cn-beijing.maas.aliyuncs.com":   "https://ws-ssc8bd9i0yuj89n4.cn-beijing.maas.aliyuncs.com",
		"https://dashscope-intl.aliyuncs.com":                        "https://dashscope-intl.aliyuncs.com",
	}
	for input, expected := range cases {
		require.Equal(t, expected, normalizeBailianBaseURL(input), input)
	}
}

func TestFetchBailianCatalogRejectsHTMLWithActionableError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=UTF-8")
		_, _ = w.Write([]byte("<!DOCTYPE html><html><body>Model Studio console</body></html>"))
	}))
	defer server.Close()

	_, err := FetchBailianCatalog(context.Background(), server.URL, "test-key")
	require.Error(t, err)
	require.ErrorContains(t, err, "returned HTML instead of JSON")
	require.NotContains(t, err.Error(), "invalid character '<'")
}

func TestFetchBailianCatalogRejectsEmptyCatalog(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"success":true,"output":{"total":0,"models":[]}}`))
	}))
	defer server.Close()
	_, err := FetchBailianCatalog(context.Background(), server.URL, "test-key")
	require.Error(t, err)
	require.Contains(t, err.Error(), "no models")
}

func TestFetchBailianCatalogRetriesServerErrors(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 3 {
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte("upstream unavailable"))
			return
		}
		_, _ = w.Write([]byte(`{"success":true,"output":{"total":1,"models":[{"model":"qwen4-max"}]}}`))
	}))
	defer server.Close()
	catalog, err := FetchBailianCatalog(context.Background(), server.URL, "test-key")
	require.NoError(t, err)
	require.Len(t, catalog.Models, 1)
	require.Equal(t, 3, attempts)
}

func TestFetchBailianCatalogMasksAPIKeyInErrors(t *testing.T) {
	const key = "sk-super-secret-value"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"message":"invalid api key ` + key + `"}`))
	}))
	defer server.Close()
	_, err := FetchBailianCatalog(context.Background(), server.URL, key)
	require.Error(t, err)
	require.NotContains(t, err.Error(), key)
	require.Contains(t, err.Error(), "***")
}
