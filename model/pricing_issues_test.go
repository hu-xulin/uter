package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/uter-ai/uter/pkg/jsplugin"
)

func TestModelPricingIssueReason(t *testing.T) {
	empty := map[string]jsplugin.UsageFieldSchema{}
	credits := map[string]jsplugin.UsageFieldSchema{"credits": {Type: "number"}}

	assert.Equal(t, ModelPricingIssueUnconfigured, modelPricingIssueReason("pricing-issue-unset", "", false, empty))
	assert.Equal(t, "", modelPricingIssueReason("pricing-issue-expr", `p * 2`, true, empty))
	assert.Equal(t, ModelPricingIssueIncompatible, modelPricingIssueReason("pricing-issue-credits", `u("credits") * 2`, true, empty))
	assert.Equal(t, "", modelPricingIssueReason("pricing-issue-credits", `u("credits") * 2`, true, credits))
}
