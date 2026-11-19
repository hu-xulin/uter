package main

import (
	"encoding/json"
	"io"
	"io/fs"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// isPlaceholderFrontend 判断嵌入的前端是否为 CI 用的占位产物。
//
// CI 的 backend job 只 `touch web/dist/index.html`（空文件）就能让
// //go:embed web/dist 编译通过，并不真的构建前端。此时原生文档产物当然
// 也不存在，测试不能因此判失败——否则每次 CI 都红。
func isPlaceholderFrontend(t *testing.T) bool {
	t.Helper()
	f, err := buildFS.Open("web/dist/index.html")
	require.NoError(t, err, "web/dist/index.html must always be embedded")
	defer f.Close()
	content, err := io.ReadAll(f)
	require.NoError(t, err)
	return len(content) == 0
}

// TestEmbeddedBinaryCarriesNativeDocsAssets 守住「二进制里必须带原生文档
// 搜索索引」这条线。
//
// 文档收敛前，独立的 Next.js 静态站要单独构建再拷进 web/dist/docs-content；
// 现在 MDX 编译进 SPA chunk，但每个语言的搜索索引仍是 public/ 下的静态
// JSON。只编译 Go 而漏掉前端构建时 //go:embed 不会报错、服务能起，只是
// 搜索永远空——这个测试把那种情况变成一次失败。
func TestEmbeddedBinaryCarriesNativeDocsAssets(t *testing.T) {
	if isPlaceholderFrontend(t) {
		t.Skip("frontend is the CI placeholder; docs assets are not expected")
	}

	missing := missingNativeDocsAssets()
	assert.Empty(t, missing,
		"web/dist is missing native docs assets. "+
			"Run `cd web && bun run build` before go build. "+
			"Or check the current tree with scripts/verify-docs-artifacts.sh")

	// 索引不能是个空壳：当前英文语料为 65 篇，索引必须与语料同步。
	// 文档数量变化时同步更新这里，不能只让索引变少而测试继续通过。
	f, err := buildFS.Open("web/dist/docs-search/en.json")
	require.NoError(t, err)
	defer f.Close()
	content, err := io.ReadAll(f)
	require.NoError(t, err)
	assert.Greater(t, len(content), 1024,
		"english search index looks truncated (%d bytes)", len(content))
	var docs []map[string]any
	require.NoError(t, json.Unmarshal(content, &docs), "search index must be valid JSON")
	assert.Len(t, docs, 65, "the english search index must cover every docs page")
}

// TestEmbeddedDocsCarryScreenshotAssets 守住 user-guide 截图真的进了二进制。
//
// 收敛前这些图由 Next.js 静态站按语言/主题解析；收敛后它们在 MDX 里是
// 明确的 `/user-guide/<lang>/<slug>/<theme>/<name>` 绝对路径，必须由
// `cp -R public/. dist/` 随前端一起产出。少了它们，文档正文在、图全裂。
func TestEmbeddedDocsCarryScreenshotAssets(t *testing.T) {
	if isPlaceholderFrontend(t) {
		t.Skip("frontend is the CI placeholder; docs assets are not expected")
	}

	var shots int
	var largest int64
	err := fs.WalkDir(buildFS, "web/dist/user-guide", func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || !strings.HasSuffix(p, ".webp") {
			return nil
		}
		info, ierr := d.Info()
		if ierr != nil {
			return ierr
		}
		shots++
		if info.Size() > largest {
			largest = info.Size()
		}
		return nil
	})
	require.NoError(t, err, "walking the embedded user-guide screenshots must not fail")
	assert.Positive(t, shots, "no screenshots embedded under web/dist/user-guide: every guide image would 404")
	assert.Greater(t, largest, int64(1024),
		"the largest embedded screenshot is only %d bytes (truncated copy?)", largest)
}

// TestNativeDocsWarningNamesTheMissingPaths 验证告警路径能真的报出缺什么。
//
// 用一个必然不存在的路径单独调用判定逻辑，确认缺失会被逐条列出而不是被
// 悄悄吞掉——静默缺失正是这个缺陷最难排查的原因。
func TestNativeDocsWarningNamesTheMissingPaths(t *testing.T) {
	original := embeddedNativeDocsPaths
	t.Cleanup(func() { embeddedNativeDocsPaths = original })

	embeddedNativeDocsPaths = []string{"web/dist/index.html", "web/dist/definitely-missing-probe"}
	missing := missingNativeDocsAssets()
	require.Equal(t, []string{"web/dist/definitely-missing-probe"}, missing,
		"the real index.html must not be reported missing")

	embeddedNativeDocsPaths = []string{"web/dist/definitely-missing-probe"}
	assert.Equal(t, []string{"web/dist/definitely-missing-probe"}, missingNativeDocsAssets())

	// 一条都不缺时不能告警。
	embeddedNativeDocsPaths = []string{"web/dist/index.html"}
	assert.Empty(t, missingNativeDocsAssets())
}

// TestGoSourceHasNoStaticDocsSiteCoupling 防止有人把已退役的 Next.js
// 静态站挂载、`/docs-content` 前缀或 `_next` embed 特例加回来。
func TestGoSourceHasNoStaticDocsSiteCoupling(t *testing.T) {
	source, err := os.ReadFile("main.go")
	require.NoError(t, err)
	for _, retired := range []string{"web/dist/docs-content", "docs-web", "all:web/dist"} {
		assert.NotContains(t, string(source), retired,
			"main.go still references the retired static docs site: %q", retired)
	}
}
