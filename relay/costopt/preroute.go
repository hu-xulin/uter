package costopt

import (
	"github.com/uter-ai/uter/relaykit/dto"
)

// 选渠道阶段（middleware/distributor）的降本规划入口。
//
// # 🔴 模型保真：降本不得改变客户选择的模型（本文件为强制不变量）
//
// 客户选择某个大模型，服务方就**必须用那个模型**服务。把 claude-sonnet 的请求
// 悄悄改写成 groq-gpt-oss，即便「更便宜」，也违反客户明确的要求——他们买的是
// 特定模型的能力与行为，模型替换等于降级交付，且往往静默发生、客户无感。
//
// 因此**所有「改写模型名」的降本手段一律不再执行**：价值层路由、复杂度路由、
// Cascade 级联、RouterLM 选模全部停用。降本只能来自**语义等价的效率优化**：
//
//   - 输入侧：共享前缀置顶、上下文滑动窗口/摘要、提示压缩、RAG、工具定义精简、
//     工具结果去重、图像下采样（都在同一模型内减少 token）
//   - 输出侧：结构化输出约束、max_tokens 硬上限、Agent 预算/循环拦截、短路规则
//   - 计费侧：精确缓存 / 语义缓存（键含模型与租户，绝不跨模型复用）
//   - 批次侧：批处理（同一模型，只是异步执行换取折扣）
//
// 跨供应商比价（ApplyArbitrage）**不违反**保真：它在**同一模型**的多个渠道之间
// 选最便宜的（同一模型走 direct / Bedrock / Azure 价差很大），模型名不变，
// 这是真实成本节约，予以保留。
//
// # 为什么保留函数与开关而不是直接删代码
//
// 这些特性有后台配置项与既有测试；直接删除会让配置读写、Options 键、前端表单
// 与文档全部断裂。保留「恒为 no-op」的壳，既不破坏任何调用方契约，又让开关
// 失效这件事有显式的代码表达与回归测试兜底。
//
// 详见 ModelFidelityLocked 的说明与 costopt_fidelity_test.go 的不变量测试。

// ModelFidelityLocked 是「模型保真锁」。
//
// 置 true 时：任何只改模型名的钩子都不会被调用（PlanModelRewrite 不做任何改写）。
// 这是**唯一允许的取值**——本文件所有降本路径均遵守模型保真，代码里不存在
// 绕过它的开关。保留该常量与函数签名，是为了让约束有一个可被测试断言的名字。
const ModelFidelityLocked = true

// ModelRewriteDisabledReason 用于在后台与日志中解释「为什么这些开关无效」。
const ModelRewriteDisabledReason = "模型保真：降本不得替换客户选择的模型，已停用跨模型改写（价值层路由/复杂度路由/Cascade/RouterLM）。" +
	"降本请使用同模型内的输入输出精简、缓存与批处理。"

// PlanModelRewrite 在选渠道之前应用所有「仅改模型名」的降本钩子。
//
// 🔴 当前**恒定返回原模型名、不做任何改写**：跨模型改写违反客户对模型的明确要求，
// 已整体停用（见文件头「模型保真」）。保留此函数仅为维持 middleware 调用契约，
// 使其继续返回入参原模型（等价于 no-op），未来也不会被误用来换模型。
func PlanModelRewrite(req *dto.GeneralOpenAIRequest) string {
	if req == nil || req.Model == "" {
		return ""
	}
	// 模型保真：不变更 req.Model。
	return req.Model
}

// RewriteCostoptModelForRouting 便于 middleware 层复用：对请求体做规划并回写。
// 由于模型保真锁，恒定返回 original（不改写模型名）。
func RewriteCostoptModelForRouting(req *dto.GeneralOpenAIRequest, original string) string {
	// 模型保真：直接回传原模型名，不再调用任何改写钩子。
	_ = req
	_ = ModelFidelityLocked
	return original
}
