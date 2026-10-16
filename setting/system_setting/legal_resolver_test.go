package system_setting

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveLegalRefEmptyReturnsFallback(t *testing.T) {
	if got := resolveLegalRef("", "FALLBACK"); got != "FALLBACK" {
		t.Fatalf("empty ref should return fallback, got %q", got)
	}
}

func TestResolveLegalRefHTTPURLPassthrough(t *testing.T) {
	const url = "https://legal.uter.ai/user-agreement"
	if got := resolveLegalRef(url, "FALLBACK"); got != url {
		t.Fatalf("http url should pass through, got %q", got)
	}
	if got := resolveLegalRef("http://example.com/p.md", "FALLBACK"); got != "http://example.com/p.md" {
		t.Fatalf("http url should pass through, got %q", got)
	}
}

func TestIsLocalDocPath(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"docs-web/content/legal/zh/user-agreement.md", true},
		{"privacy-policy.markdown", true},
		{"foo/bar", true},
		{"http://x.md", false},
		{"plain pasted markdown content", false},
		{"../escape.md", false},
		{"a/../../b.md", false},
		{"..", false},
	}
	for _, c := range cases {
		if got := isLocalDocPath(c.in); got != c.want {
			t.Errorf("isLocalDocPath(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestReadLegalDocFile(t *testing.T) {
	root := t.TempDir()
	doc := filepath.Join(root, "docs", "agreement.md")
	if err := os.MkdirAll(filepath.Dir(doc), 0o755); err != nil {
		t.Fatal(err)
	}
	const content = "# agreement\nbody"
	if err := os.WriteFile(doc, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	t.Setenv("UTER_LEGAL_DOCS_ROOT", root)

	// 1. 正常相对路径读取
	got, err := readLegalDocFile("docs/agreement.md")
	if err != nil {
		t.Fatalf("readLegalDocFile normal: unexpected error %v", err)
	}
	if got != content {
		t.Fatalf("readLegalDocFile normal: got %q, want %q", got, content)
	}

	// 2. 路径穿越被拒绝
	if _, err := readLegalDocFile("../agreement.md"); err == nil {
		t.Fatalf("readLegalDocFile traversal: expected error, got nil")
	}

	// 3. 绝对路径在根目录外被拒绝
	if _, err := readLegalDocFile("/etc/passwd"); err == nil {
		t.Fatalf("readLegalDocFile absolute outside root: expected error, got nil")
	}
}
