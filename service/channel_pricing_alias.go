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
	"strings"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// aliasPricingInheritSource marks a channel price row created by inheriting
// the billable price of the upstream name a redirect alias points at. It is a
// non-auto-derived source, so a later upstream re-sync never overwrites it.
const aliasPricingInheritSource = "redirect_alias"

// aliasPricingInheritance is the pure decision for one served request name.
// The name must have no row of its own, and the redirect chain must expose
// exactly one configured, billable row to inherit from. Relay bills against
// the served name, so the same rule works in both directions: an alias served
// by the channel can inherit the upstream row, and an upstream name still
// served after a partial redirect can inherit a row left under the alias.
// Anything ambiguous stays unresolved so the publish gate keeps failing closed.
type aliasPricingInheritance struct {
	Alias  string
	Target model.ChannelModelPricing
}

// resolveAliasPricingInheritance computes, without writing anything, which
// served names may inherit a billable price from the other end of a redirect.
// selectedModels is the channel's model list; rows is the channel price table.
func resolveAliasPricingInheritance(
	selectedModels []string,
	modelMapping string,
	rows []model.ChannelModelPricing,
) ([]aliasPricingInheritance, []string) {
	if strings.TrimSpace(modelMapping) == "" {
		return nil, nil
	}
	var mapping map[string]string
	if err := common.UnmarshalJsonStr(modelMapping, &mapping); err != nil || len(mapping) == 0 {
		return nil, nil
	}

	served := make(map[string]bool, len(selectedModels))
	for _, name := range selectedModels {
		if name = strings.TrimSpace(name); name != "" {
			served[name] = true
		}
	}
	byModel := make(map[string][]model.ChannelModelPricing, len(rows))
	for _, row := range rows {
		name := strings.TrimSpace(row.ModelName)
		if name != "" {
			byModel[name] = append(byModel[name], row)
		}
	}
	// A row keyed by any hop of the chain shares the billable identity of the
	// chain tail. Indexing by that tail makes a partial redirect resolvable in
	// either direction instead of depending on which name the row kept.
	byIdentity := make(map[string][]model.ChannelModelPricing, len(byModel))
	for name, nameRows := range byModel {
		identity, cyclic := followUterRouteModelMapping(mapping, name)
		if cyclic || identity == "" {
			identity = name
		}
		byIdentity[identity] = append(byIdentity[identity], nameRows...)
	}

	inherit := make([]aliasPricingInheritance, 0)
	unresolved := make([]string, 0)
	unresolvedSeen := make(map[string]bool, len(mapping))
	markUnresolved := func(name string) {
		name = strings.TrimSpace(name)
		if name == "" || unresolvedSeen[name] {
			return
		}
		unresolvedSeen[name] = true
		unresolved = append(unresolved, name)
	}
	scheduled := make(map[string]bool, len(mapping))
	for alias, direct := range mapping {
		alias, direct = strings.TrimSpace(alias), strings.TrimSpace(direct)
		if alias == "" || direct == "" {
			continue
		}
		// Walk the same chain the relay walks, so a name inherits from the
		// concrete upstream name its request is ultimately rewritten to. A
		// cycle (or an empty hop) has no authoritative target; skip it so the
		// publish gate still fails closed on that name.
		target, cyclic := followUterRouteModelMapping(mapping, alias)
		if cyclic || target == "" || target == alias {
			if served[alias] {
				markUnresolved(alias)
			}
			continue
		}
		// Alias is served but its row still sits under the upstream name.
		if served[alias] && !scheduled[alias] && len(byModel[alias]) == 0 {
			if row, ok := singleBillablePricingRow(byIdentity[target]); ok {
				inherit = append(inherit, aliasPricingInheritance{Alias: alias, Target: row})
				scheduled[alias] = true
			} else {
				markUnresolved(alias)
			}
		}
		// Upstream name is still served while the row was regenerated under the
		// alias. Materialize it under the name relay will bill against.
		if served[target] && !scheduled[target] && len(byModel[target]) == 0 {
			if row, ok := singleBillablePricingRow(byIdentity[target]); ok {
				inherit = append(inherit, aliasPricingInheritance{Alias: target, Target: row})
				scheduled[target] = true
			} else {
				markUnresolved(target)
			}
		}
	}
	return inherit, unresolved
}

func singleBillablePricingRow(rows []model.ChannelModelPricing) (model.ChannelModelPricing, bool) {
	if len(rows) != 1 {
		return model.ChannelModelPricing{}, false
	}
	row := rows[0]
	if row.PricingStatus != model.ChannelPricingStatusConfigured ||
		strings.TrimSpace(row.InternalPricing) == "" ||
		!billableInternalPricing(row.InternalPricing) {
		return model.ChannelModelPricing{}, false
	}
	return row, true
}

// billableInternalPricing reports whether the stored internal price normalizes
// into an executable billing mode. This mirrors the publish gate so an alias
// never inherits a price the gate would itself reject.
func billableInternalPricing(raw string) bool {
	var pricing model.ChannelInternalPricing
	if err := common.UnmarshalJsonStr(raw, &pricing); err != nil {
		return false
	}
	_, err := model.NormalizeChannelInternalPricing(&pricing)
	return err == nil
}

// EnsureRedirectAliasPricing materializes billable price rows for served names
// whose row still sits under the other end of a redirect mapping.
// Relay bills against the request alias, so a channel-scoped price must exist
// under that name; inheriting the upstream target's configured price keeps the
// alias consistent with the price the operator already approved.
//
// It is idempotent: rows that already exist are left untouched. A target that
// is missing, ambiguous or not billable is skipped and returned as unresolved
// so callers still fail closed at the publish gate.
func EnsureRedirectAliasPricing(channelID int) (created int, unresolved []string, err error) {
	channel, err := model.GetChannelById(channelID, true)
	if err != nil || channel == nil {
		return 0, nil, err
	}
	rows, err := model.ListChannelModelPricing(channelID)
	if err != nil {
		return 0, nil, err
	}
	inherit, unresolved := resolveAliasPricingInheritance(
		channel.GetModels(), channel.GetModelMapping(), rows,
	)
	if len(inherit) == 0 {
		return 0, unresolved, nil
	}
	records := make([]model.ChannelOfficialPricingRecord, 0, len(inherit))
	for _, item := range inherit {
		internal := model.ChannelInternalPricing{}
		if parseErr := common.UnmarshalJsonStr(item.Target.InternalPricing, &internal); parseErr != nil {
			unresolved = append(unresolved, item.Alias)
			continue
		}
		// Mark the new row's provenance explicitly. redirect_alias is a
		// non-auto-derived source, so a later upstream re-sync never rewrites
		// the operator-approved price the alias inherited.
		internal.Source = aliasPricingInheritSource
		encoded, marshalErr := common.Marshal(internal)
		if marshalErr != nil {
			unresolved = append(unresolved, item.Alias)
			continue
		}
		records = append(records, model.ChannelOfficialPricingRecord{
			ChannelId:         channelID,
			Provider:          item.Target.Provider,
			ModelProvider:     item.Target.ModelProvider,
			ModelName:         item.Alias,
			Currency:          item.Target.Currency,
			OfficialPricing:   item.Target.OfficialPricing,
			NormalizedPricing: item.Target.NormalizedPricing,
			InternalPricing:   string(encoded),
			Source:            aliasPricingInheritSource,
			FetchedAt:         item.Target.FetchedAt,
		})
	}
	if len(records) == 0 {
		return 0, unresolved, nil
	}
	written, err := model.UpsertChannelOfficialPricing(records)
	return written, unresolved, err
}
