package model

import "strings"

// BaselineAliasCandidate is one operator pricing row that normalized to a
// contested baseline key. It carries the exact model ID and its derived price
// so an operator can decide which identity is authoritative.
type BaselineAliasCandidate struct {
	ModelName string  `json:"model_name"`
	Input     float64 `json:"input"`
	Output    float64 `json:"output"`
}

// BaselineAliasConflict is an exportable record of a normalized-name clash
// that was dropped from the synchronized-pricing baseline. The old code only
// logged the first ten names, which made the 296 dropped rows unauditable.
type BaselineAliasConflict struct {
	NormalizedName string                   `json:"normalized_name"`
	Candidates     []BaselineAliasCandidate `json:"candidates"`
}

// BaselineAliasRestoration records how one contested group was recovered.
// Resolution is one of "exact_id", "whitelist" or "skipped".
type BaselineAliasRestoration struct {
	NormalizedName string  `json:"normalized_name"`
	ModelName      string  `json:"model_name,omitempty"`
	Resolution     string  `json:"resolution"`
	Input          float64 `json:"input,omitempty"`
}

// BuildBaselineAliasConflicts returns every normalized-alias group whose
// members disagree on price. Identical duplicates are not conflicts.
func BuildBaselineAliasConflicts(entries []ModelPricingEntry) []BaselineAliasConflict {
	groups := groupBaselineCandidates(entries)
	out := make([]BaselineAliasConflict, 0)
	for key, candidates := range groups {
		if !baselineCandidatesDisagree(candidates) {
			continue
		}
		out = append(out, BaselineAliasConflict{NormalizedName: key, Candidates: candidates})
	}
	return sortedBaselineConflicts(out)
}

// BuildBaselineWithAliasResolution builds the cross-check baseline and
// recovers contested groups in a fixed, auditable order:
//
//  1. exact ID — a row whose literal name equals the normalized key needs no
//     alias guess and is authoritative;
//  2. whitelist — the operator explicitly mapped the normalized key to one
//     exact model name;
//  3. skip — no trustworthy identity, so the group stays out of the baseline.
//
// Uncontested entries are always kept. A whitelist that points at a name
// outside the conflicting group has no effect (fail-closed).
func BuildBaselineWithAliasResolution(
	entries []ModelPricingEntry,
	whitelist map[string]string,
) (map[string]synchronizedOfficialPrice, []BaselineAliasConflict, []BaselineAliasRestoration) {
	baseline := make(map[string]synchronizedOfficialPrice, len(entries))
	groups := groupBaselineCandidates(entries)
	conflicts := make([]BaselineAliasConflict, 0)
	restorations := make([]BaselineAliasRestoration, 0)

	for key, candidates := range groups {
		prices := make(map[string]synchronizedOfficialPrice, len(candidates))
		for _, candidate := range candidates {
			prices[candidate.ModelName] = officialFromSynchronizedEffective(
				baselineEntriesByEffectiveName(entries)[candidate.ModelName].Effective,
			)
		}
		if !baselineCandidatesDisagree(candidates) {
			// Identical aliases are safe: keep one representative.
			baseline[key] = prices[candidates[0].ModelName]
			continue
		}
		conflicts = append(conflicts, BaselineAliasConflict{NormalizedName: key, Candidates: candidates})

		if chosen, ok := chooseExactBaselineName(candidates, key); ok {
			baseline[key] = prices[chosen]
			restorations = append(restorations, BaselineAliasRestoration{
				NormalizedName: key, ModelName: chosen, Resolution: "exact_id", Input: prices[chosen].Input,
			})
			continue
		}
		if configured := strings.TrimSpace(whitelist[key]); configured != "" {
			matched := false
			for _, candidate := range candidates {
				if candidate.ModelName == configured {
					baseline[key] = prices[configured]
					restorations = append(restorations, BaselineAliasRestoration{
						NormalizedName: key, ModelName: configured, Resolution: "whitelist", Input: prices[configured].Input,
					})
					matched = true
					break
				}
			}
			if matched {
				continue
			}
			// A whitelist pointing at a name outside the conflict group is a
			// broken mapping: record the skip rather than silently losing it.
			restorations = append(restorations, BaselineAliasRestoration{NormalizedName: key, Resolution: "skipped"})
			continue
		}
		restorations = append(restorations, BaselineAliasRestoration{NormalizedName: key, Resolution: "skipped"})
	}
	return baseline, sortedBaselineConflicts(conflicts), restorations
}

// groupBaselineCandidates buckets priced entries by normalized name.
func groupBaselineCandidates(entries []ModelPricingEntry) map[string][]BaselineAliasCandidate {
	groups := make(map[string][]BaselineAliasCandidate)
	for _, entry := range entries {
		key := normalizeModelMatchName(entry.ModelName)
		if key == "" {
			continue
		}
		price := officialFromSynchronizedEffective(entry.Effective)
		if price.Input <= 0 && price.PerCall <= 0 {
			continue
		}
		groups[key] = append(groups[key], BaselineAliasCandidate{
			ModelName: entry.ModelName, Input: price.Input, Output: price.Output,
		})
	}
	return groups
}

func baselineEntriesByEffectiveName(entries []ModelPricingEntry) map[string]ModelPricingEntry {
	out := make(map[string]ModelPricingEntry, len(entries))
	for _, entry := range entries {
		out[entry.ModelName] = entry
	}
	return out
}

func baselineCandidatesDisagree(candidates []BaselineAliasCandidate) bool {
	if len(candidates) < 2 {
		return false
	}
	first := candidates[0]
	for _, candidate := range candidates[1:] {
		if !synchronizedOfficialPricesEqual(
			synchronizedOfficialPrice{Input: first.Input, Output: first.Output},
			synchronizedOfficialPrice{Input: candidate.Input, Output: candidate.Output},
		) {
			return true
		}
	}
	return false
}

func chooseExactBaselineName(candidates []BaselineAliasCandidate, normalized string) (string, bool) {
	for _, candidate := range candidates {
		// Only a literal match on the normalized key is an "exact ID"; a
		// differently-cased or differently-separated name still needs a
		// decision and must not win by sort order.
		if candidate.ModelName == normalized {
			return candidate.ModelName, true
		}
	}
	return "", false
}

func sortedBaselineConflicts(in []BaselineAliasConflict) []BaselineAliasConflict {
	out := append([]BaselineAliasConflict(nil), in...)
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j].NormalizedName < out[j-1].NormalizedName; j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out
}
