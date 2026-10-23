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

package controller

import (
	"context"
	"strconv"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/relaykit/dto"
)

// priceSyncAliasResolver renames an upstream-advertised model name back to the
// local model name the operator declared it under, so prices that an upstream
// gateway files under a short alias (e.g. DreamRouter serves `seedance-2.0`
// while the task plugin declares `doubao-seedance-2-0-260128`) still attach to
// the model uter actually routes.
//
// The source of truth is the channel's model_mapping, an operator-declared
// `local name -> upstream name` map. We never guess a name from a pattern: a
// mapping entry is the only thing that authorises `seedance-2.0` to be treated
// as `doubao-seedance-2-0-260128`. That keeps the billing path honest — the
// plugin's videoInputRatio still keys on the declared ID, and the renamed
// price lands on that same ID.
type priceSyncAliasResolver struct {
	// upstream name -> local name (chains already followed to the tail)
	byUpstream map[string]string
	// upstream names that two or more local names resolve to: ambiguous, so we
	// refuse to guess and leave them untouched.
	ambiguous map[string]struct{}
}

// buildPriceSyncAliasResolvers builds one resolver per channel that appears in
// the request. Channels without a model_mapping yield a resolver that does
// nothing, so callers may use the result unconditionally.
func buildPriceSyncAliasResolvers(upstreams []dto.UpstreamDTO) map[int]*priceSyncAliasResolver {
	out := make(map[int]*priceSyncAliasResolver)
	var ids []int
	seen := make(map[int]struct{})
	for _, u := range upstreams {
		if u.ID == 0 {
			continue
		}
		if _, ok := seen[u.ID]; ok {
			continue
		}
		seen[u.ID] = struct{}{}
		ids = append(ids, u.ID)
	}
	if len(ids) == 0 {
		return out
	}
	channels, err := model.GetChannelsByIds(ids)
	if err != nil {
		logger.LogWarn(context.Background(), "price alias resolver: failed to load channels: "+err.Error())
		return out
	}
	for _, ch := range channels {
		out[ch.Id] = buildPriceSyncAliasResolver(ch)
	}
	return out
}

// buildPriceSyncAliasResolver inverts a single channel's model_mapping.
func buildPriceSyncAliasResolver(ch *model.Channel) *priceSyncAliasResolver {
	r := &priceSyncAliasResolver{
		byUpstream: make(map[string]string),
		ambiguous:  make(map[string]struct{}),
	}
	if ch == nil {
		return r
	}
	mappingJSON := ch.GetModelMapping()
	if mappingJSON == "" || mappingJSON == "{}" {
		return r
	}
	modelMap := make(map[string]string)
	if err := common.UnmarshalJsonStr(mappingJSON, &modelMap); err != nil {
		logger.LogWarn(context.Background(), "price alias resolver: bad model_mapping on channel "+strconv.Itoa(ch.Id)+": "+err.Error())
		return r
	}
	exposed := make(map[string]struct{})
	for _, m := range ch.GetModels() {
		exposed[m] = struct{}{}
	}
	// For every exposed local name, follow the mapping chain to the upstream
	// name it ultimately resolves to, then record upstream -> local.
	for local := range modelMap {
		if _, ok := exposed[local]; !ok {
			continue
		}
		tail, cyclic := followAliasChain(modelMap, local)
		if cyclic || tail == "" || tail == local {
			continue
		}
		if _, dup := r.byUpstream[tail]; dup {
			r.ambiguous[tail] = struct{}{}
			continue
		}
		r.byUpstream[tail] = local
	}
	// Ambiguous tails must not be silently renamed.
	for a := range r.ambiguous {
		delete(r.byUpstream, a)
	}
	return r
}

// followAliasChain walks a model_mapping like ModelMappedHelper does: visited
// set cycle detection, a self loop stops at the current hop, a non-self cycle
// is reported to the caller. It returns the resolved tail upstream name.
func followAliasChain(modelMap map[string]string, start string) (string, bool) {
	current := start
	visited := map[string]bool{current: true}
	for {
		mapped, exists := modelMap[current]
		if !exists || mapped == "" {
			return current, false
		}
		if visited[mapped] {
			if mapped == current {
				return current, false
			}
			return "", true
		}
		visited[mapped] = true
		current = mapped
	}
}

// apply rewrites every pricing field so upstream alias names become local
// names. Exact local-name matches always win: if the upstream already
// advertises the declared name directly, the alias entry is dropped rather
// than merged into it, so no price is lost or duplicated.
func (r *priceSyncAliasResolver) apply(converted map[string]any) (map[string]any, []string) {
	if r == nil || len(r.byUpstream) == 0 {
		return converted, nil
	}
	out := make(map[string]any, len(converted))
	renamed := make([]string, 0)
	for field, raw := range converted {
		entries, ok := raw.(map[string]any)
		if !ok {
			out[field] = raw
			continue
		}
		newEntries := make(map[string]any, len(entries))
		for name, val := range entries {
			local, ok := r.byUpstream[name]
			if !ok || local == name {
				newEntries[name] = val
				continue
			}
			// The declared name is advertised directly too: that entry is
			// copied on its own iteration, so drop the alias here — otherwise
			// one model ends up with two keys carrying the same price.
			if _, direct := entries[local]; direct {
				continue
			}
			newEntries[local] = val
			renamed = append(renamed, name+"→"+local)
		}
		out[field] = newEntries
	}
	return out, renamed
}
