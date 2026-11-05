package router

import (
	"fmt"
	"os"
	"sort"
	"testing"

	"github.com/gin-gonic/gin"
)

// TestDumpApiRoutes is an audit aid: it registers the full API surface on a
// throwaway gin engine and prints every (method, path) so the real route table
// can be diffed against docs-dev/openapi/*.json. It intentionally performs no
// assertions and is skipped unless explicitly run.
func TestDumpApiRoutes(t *testing.T) {
	if os.Getenv("UTER_DUMP_ROUTES") != "1" {
		t.Skip("audit-only: run with UTER_DUMP_ROUTES=1 go test -run TestDumpApiRoutes")
	}
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)
	routes := engine.Routes()
	sort.Slice(routes, func(i, j int) bool {
		if routes[i].Path != routes[j].Path {
			return routes[i].Path < routes[j].Path
		}
		return routes[i].Method < routes[j].Method
	})
	for _, r := range routes {
		fmt.Printf("ROUTE\t%s\t%s\n", r.Method, r.Path)
	}
}
