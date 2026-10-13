package model

import (
	"strings"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSecretOptionKeysStayInSyncWithOptionMap 是审查报告「建议补充的回归测试 #5」
// 的另一半：用 model 侧真实存在的 option 键（见 InitOptionMap 的 InitOptionMap
// 分发与各 updateOptionMap* 写入点）做一次「新增键是否会被漏掉」的演练。
//
// 为什么必须在 model 包做：common 不能 import model（循环依赖），而 option 键
// 的真源与默认值的组装都在 model 侧。只有在这里才能覆盖到 common 侧手工清单
// 可能遗漏的新键。
func TestSecretOptionKeysStayInSyncWithOptionMap(t *testing.T) {
	// 走一遍真实的选项初始化，让 common.OptionMap 拿到 model 侧登记的全部键。
	previous := common.OptionMap
	t.Cleanup(func() { common.OptionMap = previous })

	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	InitOptionMap()
	require.NotEmpty(t, common.OptionMap, "InitOptionMap 未能填充任何选项键")

	// 显式登记为公开值、且键名带密钥语义的键。这些不得被判为密钥。
	publicKeys := map[string]struct{}{
		"TurnstileSiteKey":     {}, // Cloudflare challenge 公钥
		"AlipayPublicKey":      {}, // 支付宝公钥（验签用，非机密）
		"StripePublishableKey": {},
	}

	sensitiveSuffixes := []string{
		"secret", "password", "privatekey", "apikey", "token", "key",
	}

	var unmasked []string
	for key := range common.OptionMap {
		if _, isPublic := publicKeys[key]; isPublic {
			continue
		}
		lower := strings.ToLower(key)
		sensitive := false
		for _, suffix := range sensitiveSuffixes {
			if strings.HasSuffix(lower, suffix) {
				sensitive = true
				break
			}
		}
		if sensitive && !common.IsSecretOptionKey(key) {
			unmasked = append(unmasked, key)
		}
	}

	assert.Empty(t, unmasked,
		"OptionMap 中这些带密钥语义的键未被掩码，会在 GET /api/option/ 明文下发：%v",
		unmasked)
}
