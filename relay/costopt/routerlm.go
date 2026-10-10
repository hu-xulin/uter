package costopt

import (
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
)

// ApplyRouterLM 用小型 router 模型替用户选最优上游模型：**已停用（模型保真）**。
//
// 原实现会用一个小模型「替客户决定」用哪个上游模型并重写 req.Model。这直接违反
// 客户对模型的明确指定——客户点的是某个模型，服务方无权替他换一个。现整体停用：
// 恒定返回 false，绝不修改 req.Model，也不会发起 router 模型的额外调用
// （那本身也是一笔白花的开销）。
//
// 保留函数签名以维持既有调用方与配置项。
func ApplyRouterLM(req *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) bool {
	// 模型保真：不替客户选模型。
	return false
}
