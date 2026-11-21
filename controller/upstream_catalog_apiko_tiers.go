package controller

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// apikoImageTierRule maps one catalogue tier name (1k / 1.5k / 2k / 4k) to the
// request values that select it. This table is the product-owned mapping the
// billing expression cannot infer from the catalogue: Apiko publishes tier
// names and prices, not which size or resolution string belongs to a tier.
type apikoImageTierRule struct {
	Tier        string
	Sizes       []string
	Resolutions []string
}

// apikoImageTierRules is the product-defined mapping. Unknown or absent
// parameters fall through to the highest tier, so a request can never be
// undercharged by a missing mapping.
var apikoImageTierRules = []apikoImageTierRule{
	{
		Tier:        "1k",
		Sizes:       []string{"1024x1024", "1536x1024", "1024x1536", "1280x720", "720x1280", "1024x768", "768x1024"},
		Resolutions: []string{"1k", "1K"},
	},
	{
		Tier:        "1.5k",
		Sizes:       []string{"1536x1536"},
		Resolutions: []string{"1.5k", "1.5K"},
	},
	{
		Tier:        "2k",
		Sizes:       []string{"2048x2048", "2048x1152", "1152x2048", "1792x1024", "1024x1792"},
		Resolutions: []string{"2k", "2K"},
	},
	{
		Tier:        "4k",
		Sizes:       []string{"4096x4096", "3840x2160", "2160x3840"},
		Resolutions: []string{"4k", "4K"},
	},
}

type apikoResolvedTier struct {
	tier  string
	rank  float64
	price float64
	rule  apikoImageTierRule
}

// apikoImageTierExpression compiles a resolution-tiered image model into a
// billing expression that selects the tier from the request's size/resolution.
// It returns false when the catalogue exposes a tier the product mapping does
// not cover, so the model is skipped instead of guessed.
func apikoImageTierExpression(model apikoModel) (string, bool) {
	rules := make(map[string]apikoImageTierRule, len(apikoImageTierRules))
	for _, rule := range apikoImageTierRules {
		rules[strings.ToLower(rule.Tier)] = rule
	}

	tiers := make([]apikoResolvedTier, 0, len(model.Pricing.Tiers))
	for _, tier := range model.Pricing.Tiers {
		name := strings.TrimSpace(tier.Name)
		if name == "" || tier.PerCall == nil || *tier.PerCall <= 0 {
			return "", false
		}
		rank, ok := apikoTierRank(name)
		if !ok {
			return "", false
		}
		rule, ok := rules[strings.ToLower(name)]
		if !ok {
			return "", false
		}
		tiers = append(tiers, apikoResolvedTier{tier: name, rank: rank, price: *tier.PerCall, rule: rule})
	}
	if len(tiers) == 0 {
		return "", false
	}
	sort.Slice(tiers, func(i, j int) bool { return tiers[i].rank < tiers[j].rank })

	highest := tiers[len(tiers)-1]
	expression := apikoImageTierArm(highest)
	for index := len(tiers) - 2; index >= 0; index-- {
		condition := apikoImageTierCondition(tiers[index].rule)
		if condition == "" {
			return "", false
		}
		expression = fmt.Sprintf("%s ? %s : %s", condition, apikoImageTierArm(tiers[index]), expression)
	}
	return expression, true
}

func apikoImageTierArm(tier apikoResolvedTier) string {
	return fmt.Sprintf(`tier("%s", fixed(%s)) * image_count`, tier.tier, apikoNumber(tier.price))
}

func apikoImageTierCondition(rule apikoImageTierRule) string {
	parts := make([]string, 0, len(rule.Sizes)*2+len(rule.Resolutions)*2)
	for _, size := range rule.Sizes {
		parts = append(parts, fmt.Sprintf(`param("size") == "%s"`, size))
		parts = append(parts, fmt.Sprintf(`param("size") == "%s"`, strings.ToUpper(size)))
	}
	for _, resolution := range rule.Resolutions {
		parts = append(parts, fmt.Sprintf(`param("resolution") == "%s"`, resolution))
		parts = append(parts, fmt.Sprintf(`param("parameters.resolution") == "%s"`, resolution))
	}
	return strings.Join(parts, " || ")
}

func apikoTierRank(name string) (float64, bool) {
	normalized := strings.ToLower(strings.TrimSpace(name))
	normalized = strings.TrimSuffix(normalized, "k")
	value, err := strconv.ParseFloat(normalized, 64)
	if err != nil || value <= 0 {
		return 0, false
	}
	return value, true
}
