package router

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// TestGzipMiddlewareSingleCompression 验证单一引擎级 GzipMiddleware：
//   - web / api / dashboard 路径：客户端支持 gzip 即压缩一层；
//   - relay 路径：仅当 costopt.GzipEnabled() 为真时压缩一层；
//   - 任何路径都恰好压缩一层（无双重压缩），客户端不支持时一律不压。
func TestGzipMiddlewareSingleCompression(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// 1) web / api 路径始终压缩一层（即便 GzipEnabled 关闭，因为它们不是 relay 路径）。
	t.Run("web_always_compressed_once", func(t *testing.T) {
		costoptcfg.GetCostOptSetting().GzipEnabled = false
		r := gin.New()
		r.Use(GzipMiddleware())
		r.GET("/dashboard", func(c *gin.Context) {
			c.Data(http.StatusOK, "text/html; charset=utf-8", []byte("<html>你好</html>"))
		})
		r.GET("/api/user/self", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		cases := []struct {
			path string
			sub  string
		}{
			{"/dashboard", "<html>"},
			{"/api/user/self", `"ok"`},
		}
		for _, cs := range cases {
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, cs.path, nil)
			req.Header.Set("Accept-Encoding", "gzip")
			r.ServeHTTP(w, req)
			assertSingleGzip(t, w, cs.path, cs.sub)
		}
	})

	// 2) relay 路径：GzipEnabled=false 时不压缩。
	t.Run("relay_disabled_not_compressed", func(t *testing.T) {
		costoptcfg.GetCostOptSetting().GzipEnabled = false
		r := gin.New()
		r.Use(GzipMiddleware())
		r.GET("/v1/models", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/v1/models", nil)
		req.Header.Set("Accept-Encoding", "gzip")
		r.ServeHTTP(w, req)

		if ce := w.Header().Get("Content-Encoding"); ce != "" {
			t.Fatalf("relay 且 GzipEnabled=false 应不压缩，但得到 Content-Encoding=%q", ce)
		}
	})

	// 3) relay 路径：GzipEnabled=true 时压缩恰好一层。覆盖 /v1、/pg、/mj 前缀。
	t.Run("relay_enabled_single_compression", func(t *testing.T) {
		costoptcfg.GetCostOptSetting().GzipEnabled = true
		t.Cleanup(func() { costoptcfg.GetCostOptSetting().GzipEnabled = false })
		r := gin.New()
		r.Use(GzipMiddleware())
		r.GET("/v1/models", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})
		r.GET("/pg/chat/completions", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})
		r.GET("/mj/submit/imagine", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		for _, path := range []string{"/v1/models", "/pg/chat/completions", "/mj/submit/imagine"} {
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, path, nil)
			req.Header.Set("Accept-Encoding", "gzip")
			r.ServeHTTP(w, req)
			assertSingleGzip(t, w, path, `"ok"`)
		}
	})

	// 4) 客户端不支持 gzip 时，任何路径都不压缩（web 与 relay 一致）。
	t.Run("no_accept_encoding_no_compress", func(t *testing.T) {
		costoptcfg.GetCostOptSetting().GzipEnabled = true
		t.Cleanup(func() { costoptcfg.GetCostOptSetting().GzipEnabled = false })
		r := gin.New()
		r.Use(GzipMiddleware())
		r.GET("/dashboard", func(c *gin.Context) {
			c.Data(http.StatusOK, "text/html", []byte("hello"))
		})
		r.GET("/v1/models", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		for _, path := range []string{"/dashboard", "/v1/models"} {
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, path, nil)
			// 不设置 Accept-Encoding
			r.ServeHTTP(w, req)
			if ce := w.Header().Get("Content-Encoding"); ce != "" {
				t.Fatalf("客户端不支持 gzip 时不该压缩，但 %s 得到 %q", path, ce)
			}
		}
	})
}

// assertSingleGzip 断言响应被 gzip 压缩恰好一层：解一层得到含 wantSub 的合法内容，
// 再解一层必须失败（证明无双重压缩）。
func assertSingleGzip(t *testing.T, w *httptest.ResponseRecorder, path, wantSub string) {
	t.Helper()
	if ce := w.Header().Get("Content-Encoding"); ce != "gzip" {
		t.Fatalf("%s 应压缩一层，但 Content-Encoding=%q | code=%d bodyLen=%d", path, ce, w.Code, w.Body.Len())
	}
	once, err := gzip.NewReader(bytes.NewReader(w.Body.Bytes()))
	if err != nil {
		t.Fatalf("%s 解第一层失败（说明没压或压了多层）: %v", path, err)
	}
	dec1, err := io.ReadAll(once)
	once.Close()
	if err != nil {
		t.Fatalf("%s 读第一层失败: %v", path, err)
	}
	if wantSub != "" && !bytes.Contains(dec1, []byte(wantSub)) {
		t.Fatalf("%s 解一层后内容异常: %q", path, dec1)
	}
	if _, err := gzip.NewReader(bytes.NewReader(dec1)); err == nil {
		t.Fatalf("%s 解第二层成功，说明被压了两层（双重压缩 bug 复发）", path)
	}
}
