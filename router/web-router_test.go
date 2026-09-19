package router

import "testing"

// These tests pin the docs-site routing decision without booting Gin,
// so the Next.js `output: 'export'` path layout keeps matching the Go
// router after future refactors. The classifier functions are pure and
// have no dependencies on the embedded FS, so they can run in-process.

func TestIsDocsPath(t *testing.T) {
	cases := []struct {
		path string
		want bool
	}{
		// Shipped locales: match.
		{"/docs/zh", true},
		{"/docs/zh/", true},
		{"/docs/zh/installation/docker-compose/", true},
		{"/docs/zh/api/overview/", true},
		{"/docs/en", true},
		{"/docs/en/", true},
		{"/docs/en/api/overview/", true},

		// Bare `/docs` does NOT count as a locale docs path — the locale
		// segment must come after `docs`. Bare paths are handled separately by
		// `isBareDocsPath`.
		{"/docs", false},
		{"/docs/", false},
		// Legacy `/<lang>/docs/...` paths are NOT matched here — they are
		// not valid docs paths under the new `/docs/<lang>/` scheme.
		{"/zh/docs", false},
		{"/zh/docs/", false},
		{"/zh/docs/installation/docker-compose/", false},

		// Other top-level segments aren't a docs SPA path either.
		{"/dashboard", false},
		{"/pricing", false},

		// Empty / non-leading-slash inputs bail out.
		{"", false},
		{"docs/zh/", false},

		// Locales we don't ship are not docs paths.
		{"/docs/ja/", false},
		{"/docs/fr/", false},
	}
	for _, tc := range cases {
		t.Run(tc.path, func(t *testing.T) {
			if got := isDocsPath(tc.path); got != tc.want {
				t.Fatalf("isDocsPath(%q) = %v, want %v", tc.path, got, tc.want)
			}
		})
	}
}

func TestIsBareDocsPath(t *testing.T) {
	cases := []struct {
		path string
		want bool
	}{
		// Exact `/docs` and `/docs/` are owned by the SPA's `/docs`
		// route, which performs the locale-aware redirect. They must
		// NOT be caught here or the SPA shell never gets a chance to
		// render its redirect component.
		{"/docs", false},
		{"/docs/", false},

		// Anything deeper under `/docs/` that isn't a valid locale
		// (legacy / stale admin links) still bounces to the canonical landing.
		{"/docs/whatever/deep", true},

		// Valid locale paths under `/docs/` are handled by `isDocsPath`,
		// NOT bare-docs redirects.
		{"/docs/zh/quickstart/", false},
		{"/docs/zh/", false},
		{"/docs/en/", false},

		// Legacy `/<lang>/docs/...` paths are not bare-docs paths —
		// they don't start with `/docs/` at all.
		{"/zh/docs", false},
		{"/zh/docs/", false},
		{"/zh/docs/installation/docker-compose/", false},
		{"/dashboard", false},
		{"/", false},
		{"", false},
		{"docs", false},
	}
	for _, tc := range cases {
		t.Run(tc.path, func(t *testing.T) {
			if got := isBareDocsPath(tc.path); got != tc.want {
				t.Fatalf("isBareDocsPath(%q) = %v, want %v", tc.path, got, tc.want)
			}
		})
	}
}

func TestDocsLanding(t *testing.T) {
	// We ship `zh` and `en` today. Legacy bare-docs redirects land on
	// the first locale in the ordered list (`docsLocales`), which is
	// pinned to `zh`. The SPA's `/docs` route picks the landing per the
	// user's UI language via `web/src/lib/docs-link.ts` instead. Pin
	// this value so a reorder is intentional.
	if got := docsLanding(); got != "/docs/zh/" {
		t.Fatalf("docsLanding() = %q, want %q", got, "/docs/zh/")
	}
}