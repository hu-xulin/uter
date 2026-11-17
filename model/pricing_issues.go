package model

import (
	"slices"
	"sort"

	"github.com/uter-ai/uter/pkg/jsplugin"
	"github.com/uter-ai/uter/setting/billing_setting"
)

// Reasons a model served by a provider plugin cannot be charged with the saved
// prices.
const (
	ModelPricingIssueUnconfigured = "unconfigured"
	ModelPricingIssueIncompatible = "incompatible"
	ModelPricingIssueStale        = "stale"
)

// ModelPricingIssue is one pricing problem of a plugin-provided model, as the
// admin pricing page lists it.
type ModelPricingIssue struct {
	ModelName  string `json:"model_name"`
	PluginKey  string `json:"plugin_key"`
	PluginName string `json:"plugin_name"`
	Reason     string `json:"reason"`
}

// GetModelPricingIssues reports the plugin-provided models an enabled channel
// serves that have no usable price, and saved provider prices whose plugin is
// not installed or whose installed version no longer declares the model. An
// empty pluginKey covers every plugin.
func GetModelPricingIssues(pluginKey string) ([]ModelPricingIssue, error) {
	generation := jsplugin.DefaultRegistry.Generation()
	served := make(map[string]bool)
	for _, name := range GetEnabledModels() {
		if declared, ok := generation.CanonicalModel(name); ok {
			served[declared] = true
			continue
		}
		if target, ok := ResolveTaskModelAlias(generation, name); ok && target.Declared != "" {
			served[target.Declared] = true
		}
	}

	issues := make([]ModelPricingIssue, 0)
	seen := make(map[string]bool)
	add := func(modelName, key, name, reason string) {
		id := modelName + "\x00" + key + "\x00" + reason
		if seen[id] {
			return
		}
		seen[id] = true
		issues = append(issues, ModelPricingIssue{ModelName: modelName, PluginKey: key, PluginName: name, Reason: reason})
	}

	for _, plugin := range generation.Plugins() {
		if pluginKey != "" && plugin.Meta.Key != pluginKey {
			continue
		}
		for _, name := range plugin.Meta.Models {
			if !served[name] {
				continue
			}
			schema, _ := plugin.Meta.UsageForModel(name)
			expression, configured := billing_setting.ResolveTaskBillingExpr(plugin.Meta.Key, name, "")
			reason := modelPricingIssueReason(expression, configured, schema)
			if reason != "" {
				add(name, plugin.Meta.Key, plugin.Meta.Name, reason)
			}
		}
	}

	for key := range billing_setting.GetPluginBillingExprCopy() {
		keyPlugin, modelName, ok := billing_setting.SplitPluginBillingExprKey(key)
		if !ok || (pluginKey != "" && keyPlugin != pluginKey) {
			continue
		}
		live, found := generation.Get(keyPlugin)
		if !found {
			models, err := installedTaskPluginModels(keyPlugin)
			if err != nil {
				return nil, err
			}
			if !slices.Contains(models, modelName) {
				add(modelName, keyPlugin, "", ModelPricingIssueStale)
			}
			continue
		}
		if !slices.Contains(live.Meta.Models, modelName) {
			add(modelName, live.Meta.Key, live.Meta.Name, ModelPricingIssueStale)
		}
	}

	sort.Slice(issues, func(i, j int) bool {
		if issues[i].ModelName != issues[j].ModelName {
			return issues[i].ModelName < issues[j].ModelName
		}
		if issues[i].PluginKey != issues[j].PluginKey {
			return issues[i].PluginKey < issues[j].PluginKey
		}
		return issues[i].Reason < issues[j].Reason
	})
	return issues, nil
}

// modelPricingIssueReason classifies one provider price: "" when it can charge
// the model, unconfigured when no expression resolves and incompatible when
// the expression reads usage the provider's schema lacks.
func modelPricingIssueReason(expression string, configured bool, schema map[string]jsplugin.UsageFieldSchema) string {
	if !configured {
		return ModelPricingIssueUnconfigured
	}
	if !billing_setting.TaskExprCompatible(expression, schema) {
		return ModelPricingIssueIncompatible
	}
	return ""
}

// installedTaskPluginModels returns the models declared by the installed active
// version of a plugin; a plugin that is not installed declares none.
func installedTaskPluginModels(key string) ([]string, error) {
	row, err := GetTaskPluginVersion(key, "")
	if err != nil || row == nil {
		return nil, nil
	}
	loaded, compileErr := jsplugin.CompilePlugin(string(row.Source), jsplugin.Options{Key: row.Key, Version: row.Version})
	if compileErr != nil {
		return nil, nil
	}
	return append([]string(nil), loaded.Meta.Models...), nil
}
