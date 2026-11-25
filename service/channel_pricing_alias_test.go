/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func aliasTestBillableRow(t *testing.T, name string) model.ChannelModelPricing {
	t.Helper()
	perCall := 1.0
	encoded, err := common.Marshal(model.ChannelInternalPricing{
		Mode:       model.ChannelPricingModePerCall,
		PerCallUSD: model.MoneyFromFloatPtr(&perCall),
		Source:     "batch",
	})
	require.NoError(t, err)
	return model.ChannelModelPricing{
		ModelName:       name,
		PricingStatus:   model.ChannelPricingStatusConfigured,
		InternalPricing: string(encoded),
		PricingVersion:  "v1",
	}
}

func TestResolveAliasPricingInheritance(t *testing.T) {
	rows := []model.ChannelModelPricing{
		aliasTestBillableRow(t, "base"),
		{ModelName: "review", PricingStatus: model.ChannelPricingStatusNeedsReview},
		aliasTestBillableRow(t, "duplicate"),
		aliasTestBillableRow(t, "duplicate"),
	}
	mapping := `{"base-dr":"base","review-dr":"review","dup-dr":"duplicate","absent-dr":"absent"}`
	selected := []string{"base-dr", "review-dr", "dup-dr", "absent-dr", "base"}

	inherit, unresolved := resolveAliasPricingInheritance(selected, mapping, rows)

	require.Len(t, inherit, 1)
	assert.Equal(t, "base-dr", inherit[0].Alias)
	assert.Equal(t, "base", inherit[0].Target.ModelName)
	// review/non-billable, duplicate identity and missing target all stay unresolved.
	assert.ElementsMatch(t, []string{"review-dr", "dup-dr", "absent-dr"}, unresolved)
}

// Chained redirects (a-dr -> b-dr -> concrete) must inherit from the chain
// tail, matching the relay's rewrite. Cycles and self-maps have no concrete
// target and must stay unresolved so the publish gate fails closed.
func TestResolveAliasPricingInheritanceChainAndCycle(t *testing.T) {
	rows := []model.ChannelModelPricing{aliasTestBillableRow(t, "concrete")}
	mapping := `{"a-dr":"b-dr","b-dr":"concrete","self-dr":"self-dr","loop-a":"loop-b","loop-b":"loop-a"}`
	selected := []string{"a-dr", "b-dr", "self-dr", "loop-a", "loop-b"}

	inherit, unresolved := resolveAliasPricingInheritance(selected, mapping, rows)

	require.Len(t, inherit, 2)
	byAlias := map[string]string{}
	for _, item := range inherit {
		byAlias[item.Alias] = item.Target.ModelName
	}
	assert.Equal(t, "concrete", byAlias["a-dr"])
	assert.Equal(t, "concrete", byAlias["b-dr"])
	assert.ElementsMatch(t, []string{"self-dr", "loop-a", "loop-b"}, unresolved)
}

func TestResolveAliasPricingInheritanceNonBillableInternal(t *testing.T) {
	bad := aliasTestBillableRow(t, "bad-expr")
	bad.InternalPricing = `{"mode":"tiered_expr","billing_expr":"not-a-real-expression(("}`
	rows := []model.ChannelModelPricing{bad}
	mapping := `{"bad-dr":"bad-expr"}`

	inherit, unresolved := resolveAliasPricingInheritance([]string{"bad-dr"}, mapping, rows)

	assert.Empty(t, inherit)
	assert.Equal(t, []string{"bad-dr"}, unresolved)
}

func TestResolveAliasPricingInheritanceEmptyTargetValue(t *testing.T) {
	rows := []model.ChannelModelPricing{aliasTestBillableRow(t, "base")}
	mapping := `{"empty-dr":"","base-dr":"base"}`

	inherit, unresolved := resolveAliasPricingInheritance([]string{"empty-dr", "base-dr"}, mapping, rows)

	require.Len(t, inherit, 1)
	assert.Equal(t, "base-dr", inherit[0].Alias)
	assert.Empty(t, unresolved)
}

func TestResolveAliasPricingInheritanceKeepsExistingRow(t *testing.T) {
	rows := []model.ChannelModelPricing{
		aliasTestBillableRow(t, "base"),
		aliasTestBillableRow(t, "base-dr"),
	}
	mapping := `{"base-dr":"base"}`

	inherit, unresolved := resolveAliasPricingInheritance([]string{"base-dr"}, mapping, rows)

	assert.Empty(t, inherit)
	assert.Empty(t, unresolved)
}

func TestResolveAliasPricingInheritanceSkipsUnservedAlias(t *testing.T) {
	rows := []model.ChannelModelPricing{aliasTestBillableRow(t, "base")}
	mapping := `{"base-dr":"base"}`

	inherit, unresolved := resolveAliasPricingInheritance([]string{"base"}, mapping, rows)

	assert.Empty(t, inherit)
	assert.Empty(t, unresolved)
}

func TestResolveAliasPricingInheritanceEmptyMapping(t *testing.T) {
	rows := []model.ChannelModelPricing{aliasTestBillableRow(t, "base")}

	inherit, unresolved := resolveAliasPricingInheritance([]string{"base"}, "", rows)
	assert.Empty(t, inherit)
	assert.Empty(t, unresolved)

	inherit, unresolved = resolveAliasPricingInheritance([]string{"base"}, "{bad json", rows)
	assert.Empty(t, inherit)
	assert.Empty(t, unresolved)
}
