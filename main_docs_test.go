package main

import (
	"io"
	"io/fs"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// isPlaceholderFrontend 判断嵌入的前端是否为 CI 用的占位产物。
//
// CI 的 backend job 只 `touch web/dist/index.html`（空文件）就能让
// //go:embed web/dist 编译通过，并不真的构建前端。此时文档产物当然也不存在，
// 测试不能因此判失败——否则每次 CI 都红。
func isPlaceholderFrontend(t *testing.T) bool {
	t.Helper()
	f, err := buildFS.Open("web/dist/index.html")
	require.NoError(t, err, "web/dist/index.html must always be embedded")
	defer f.Close()
	content, err := io.ReadAll(f)
	require.NoError(t, err)
	return len(content) == 0
}

// TestEmbeddedBinaryCarriesTheDocsSite 守住「二进制里必须带文档」这条线。
//
// 背景：文档站（docs-web）是独立的 Next.js 工程，postbuild 才把静态导出拷进
// web/dist/docs-content。只构建 web 就 go build 时，go:embed 不会报错，只会
// 嵌入一个空目录——编译通过、服务能起，/docs 全空白。
//
// 这个测试把那种情况变成一次失败；发布链路上另有
// scripts/verify-docs-artifacts.sh 在构建阶段拦截。
func TestEmbeddedBinaryCarriesTheDocsSite(t *testing.T) {
	if isPlaceholderFrontend(t) {
		t.Skip("frontend is the CI placeholder; docs artifacts are not expected")
	}

	missing := missingEmbeddedDocs()
	assert.Empty(t, missing,
		"web/dist is missing the docs static export. "+
			"Build docs-web before go build: cd docs-web && bun install && bun run build. "+
			"Or check the current tree with scripts/verify-docs-artifacts.sh")

	// 文档落地页不能是个空壳：Next 静态导出的页面远大于 1KB。
	f, err := buildFS.Open("web/dist/docs-content/docs/zh/index.html")
	require.NoError(t, err)
	defer f.Close()
	content, err := io.ReadAll(f)
	require.NoError(t, err)
	assert.Greater(t, len(content), 1024,
		"docs landing page looks truncated (%d bytes)", len(content))
}

// TestEmbeddedDocsCarryNextStaticAssets 守住 Next.js 静态资源真的进了二进制。
//
// 这是一个真实发生过的缺陷：//go:embed 对目录模式的默认规则是「跳过名字以
// `.` 或 `_` 开头的文件与目录」，而 Next.js 静态导出把全部 CSS/JS 放在
// `_next/` 下。于是 `//go:embed web/dist` 静默丢掉了整个 `_next`——HTML 都在、
// 页面能打开，但没有样式和脚本，文档站是散的。main.go 里因此额外写了
// `all:web/dist/docs-content/_next` 这个 pattern。
//
// 这个测试直接数嵌入树里的 .css/.js：将来谁要是把那个 pattern 删了，这里会红。
func TestEmbeddedDocsCarryNextStaticAssets(t *testing.T) {
	if isPlaceholderFrontend(t) {
		t.Skip("frontend is the CI placeholder; docs assets are not expected")
	}

	var css, js int
	err := fs.WalkDir(buildFS, "web/dist/docs-content/_next", func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		switch {
		case strings.HasSuffix(p, ".css"):
			css++
		case strings.HasSuffix(p, ".js"):
			js++
		}
		return nil
	})
	require.NoError(t, err, "walking the embedded docs assets must not fail")
	assert.Positive(t, css, "no .css embedded under docs-content/_next: the docs pages would render unstyled")
	assert.Positive(t, js, "no .js embedded under docs-content/_next: the docs pages would not hydrate")

	// 嵌入的 CSS 不能是空文件：随便挑一个 .css 检查长度。
	var cssPath string
	var cssSize int64
	err = fs.WalkDir(buildFS, "web/dist/docs-content/_next/static", func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || !strings.HasSuffix(p, ".css") {
			return nil
		}
		info, ierr := d.Info()
		if ierr != nil {
			return ierr
		}
		if info.Size() > cssSize {
			cssSize = info.Size()
			cssPath = p
		}
		return nil
	})
	require.NoError(t, err)
	assert.Greater(t, cssSize, int64(1024),
		"the largest embedded docs stylesheet (%s) is only %d bytes (truncated export?)", cssPath, cssSize)
}

// TestEmbeddedDocsWarningNamesTheMissingPaths 验证告警路径能真的报出缺什么。
//
// 用一个必然不存在的路径单独调用判定逻辑，确认缺失会被逐条列出而不是被
// 悄悄吞掉——静默缺失正是这个缺陷最难排查的原因。
func TestEmbeddedDocsWarningNamesTheMissingPaths(t *testing.T) {
	original := embeddedDocsPaths
	t.Cleanup(func() { embeddedDocsPaths = original })

	embeddedDocsPaths = []string{"web/dist/index.html", "web/dist/definitely-missing-probe"}
	missing := missingEmbeddedDocs()
	require.Equal(t, []string{"web/dist/definitely-missing-probe"}, missing,
		"the real index.html must not be reported missing")

	embeddedDocsPaths = []string{"web/dist/definitely-missing-probe"}
	assert.Equal(t, []string{"web/dist/definitely-missing-probe"}, missingEmbeddedDocs())

	// 一条都不缺时不能告警。
	embeddedDocsPaths = []string{"web/dist/index.html"}
	assert.Empty(t, missingEmbeddedDocs())
}
