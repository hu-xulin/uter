package costopt

import (
	"context"
	"fmt"
	"time"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
	"github.com/uter-ai/uter/common"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/go-redis/redis/v8"
)

// AgentStepBudgetResult 步数预算检查结果。
type AgentStepBudgetResult struct {
	Blocked bool
	Reason  string
}

// CheckAgentStepBudget 按会话步数/Token 预算拦截 Agent 失控。
// headers 提供 X-Uter-Agent-Step（当前步）与 X-Uter-Conversation-Id（会话标识）。
func CheckAgentStepBudget(ctx context.Context, info *relaycommon.RelayInfo, headers map[string]string) AgentStepBudgetResult {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.AgentStepBudgetEnabled {
		return AgentStepBudgetResult{}
	}
	hdr := cfg.AgentStepBudgetHeader
	if hdr == "" {
		hdr = "X-Uter-Agent-Step"
	}
	if stepStr, ok := headers[hdr]; ok && cfg.AgentStepBudgetMaxSteps > 0 {
		var step int
		fmt.Sscanf(stepStr, "%d", &step)
		if step >= cfg.AgentStepBudgetMaxSteps {
			return AgentStepBudgetResult{Blocked: true, Reason: "agent step budget exceeded"}
		}
	}
	convID := headers["X-Uter-Conversation-Id"]
	if convID != "" && cfg.AgentStepBudgetMaxTokens > 0 && common.RDB != nil {
		key := "uter:agent_budget:" + convID
		used, err := common.RDB.Get(ctx, key).Int64()
		if err == redis.Nil {
			used = 0
		} else if err != nil {
			return AgentStepBudgetResult{}
		}
		if used >= int64(cfg.AgentStepBudgetMaxTokens) {
			return AgentStepBudgetResult{Blocked: true, Reason: "agent token budget exceeded"}
		}
	}
	return AgentStepBudgetResult{}
}

// RecordAgentToken 计费后累加会话 Token 预算（供下次检查拦截）。
func RecordAgentToken(ctx context.Context, convID string, tokens int64) {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.AgentStepBudgetEnabled || convID == "" || tokens <= 0 || common.RDB == nil {
		return
	}
	key := "uter:agent_budget:" + convID
	common.RDB.IncrBy(ctx, key, tokens)
	common.RDB.Expire(ctx, key, 24*time.Hour)
}
