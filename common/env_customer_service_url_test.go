package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestGetCustomerServiceURLReadsEnvAtCallTime 锁定一个历史缺陷的修复。
//
// 背景：曾写成包级变量 `var CustomerServiceURL = os.Getenv("CUSTOMER_SERVICE_URL")`。
// 包级变量的初始化发生在 main() 之前，而 .env 是 main() 里用 godotenv.Load()
// 加载的——因此该变量永远读到空，且 godotenv 事后加载不会重新求值它。
// 对外表现是「未配置智能客服地址（CUSTOMER_SERVICE_URL），无法拉取配置」，
// 而 .env 里明明配了值（rebuild-all.sh 里的 export 只是恰好绕过了这个坑）。
//
// 改成函数后每次调用都实时读 env，本测试把这个行为钉死，防止被改回包级变量。
func TestGetCustomerServiceURLReadsEnvAtCallTime(t *testing.T) {
	// 未配置时为空字符串（= 不启用挂件）。
	t.Setenv("CUSTOMER_SERVICE_URL", "")
	assert.Equal(t, "", GetCustomerServiceURL(),
		"未配置时应返回空字符串，前端据此不渲染挂件")

	// 运行时设置后必须能读到——这正是包级变量做不到的那一步。
	t.Setenv("CUSTOMER_SERVICE_URL", "http://127.0.0.1:3200")
	assert.Equal(t, "http://127.0.0.1:3200", GetCustomerServiceURL(),
		"应在调用时实时读取，而不是进程启动时缓存")

	// 二次修改同样要生效（证明没有做任何一次性缓存）。
	t.Setenv("CUSTOMER_SERVICE_URL", "https://cs.uter.ai")
	assert.Equal(t, "https://cs.uter.ai", GetCustomerServiceURL())

	// 前后空白必须被裁掉（沿用原 strings.TrimSpace 语义）。
	t.Setenv("CUSTOMER_SERVICE_URL", "  https://cs.uter.ai \n")
	assert.Equal(t, "https://cs.uter.ai", GetCustomerServiceURL(),
		"应裁掉前后空白，避免把带空格的地址拼进下游 URL")
}