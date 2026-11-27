package service

import (
	"strings"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/setting/system_setting"
)

const (
	// UterBillingProbeTokenOption is the encrypted system option holding a
	// dedicated Uter API token used only for the "through Uter" leg of billing
	// reconciliation. It must be a low-privilege, small-quota token because a
	// probe triggers a real (small) deduction on each run.
	UterBillingProbeTokenOption = "monitor_setting.billing_probe_token"
	// UterBillingProbeEnabledOption gates the full-chain leg explicitly.
	UterBillingProbeEnabledOption = "monitor_setting.billing_probe_enabled"
)

// UpstreamBillingProbeCredentials returns the decrypted probe token and the
// platform base URL for the through-Uter leg. Both empty means the full-chain
// leg is disabled and reconciliation falls back to static-only mode.
func UpstreamBillingProbeCredentials() (baseURL, token string) {
	if !billingProbeEnabled() {
		return "", ""
	}
	raw := strings.TrimSpace(common.GetOption(UterBillingProbeTokenOption))
	if raw == "" {
		return "", ""
	}
	decrypted, err := common.DecryptSecret(raw)
	if err != nil {
		// fail-closed: never use an undecryptable credential.
		return "", ""
	}
	token = strings.TrimSpace(decrypted)
	if token == "" {
		return "", ""
	}
	baseURL = strings.TrimRight(strings.TrimSpace(system_setting.ServerAddress), "/")
	return baseURL, token
}

func billingProbeEnabled() bool {
	raw := strings.TrimSpace(common.GetOption(UterBillingProbeEnabledOption))
	return raw == "true" || raw == "1"
}

// BillingProbeConfigured reports whether the operator has configured a usable
// probe token (used by the UI to explain why reconciliation is static-only).
func BillingProbeConfigured() bool {
	base, token := UpstreamBillingProbeCredentials()
	return base != "" && token != ""
}
