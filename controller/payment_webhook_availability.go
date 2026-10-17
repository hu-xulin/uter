package controller

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/uter-ai/uter/setting"

	"github.com/uter-ai/uter/setting/operation_setting"
)

func isPaymentComplianceConfirmed() bool {
	return operation_setting.IsPaymentComplianceConfirmed()
}

func isStripeAPIConfigured() bool {
	secret := strings.TrimSpace(setting.StripeApiSecret)
	return strings.HasPrefix(secret, "sk_") || strings.HasPrefix(secret, "rk_")
}

func isStripeTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	return isStripeAPIConfigured() &&
		isStripeWebhookConfigured() &&
		strings.TrimSpace(setting.StripePriceId) != ""
}

func isStripeWebhookConfigured() bool {
	return strings.TrimSpace(setting.StripeWebhookSecret) != ""
}

// Webhook handling must not depend on the wallet top-up Price ID, because the
// same signed endpoint also settles subscription orders priced by each plan.
// A checkout toggle, missing wallet catalog, or compliance UI state must not
// strand already-paid orders; the signed callback and local order checks remain
// the settlement authority.
func isStripeWebhookEnabled() bool {
	return isStripeWebhookConfigured()
}

func isCreemTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	products := strings.TrimSpace(setting.CreemProducts)
	return strings.TrimSpace(setting.CreemApiKey) != "" &&
		products != "" &&
		products != "[]" &&
		isCreemWebhookConfigured()
}

func isCreemWebhookConfigured() bool {
	return strings.TrimSpace(setting.CreemWebhookSecret) != ""
}

func isCreemWebhookEnabled() bool {
	// The webhook secret verifies provider authenticity. New checkout availability
	// is controlled separately; existing paid orders must still settle when the
	// wallet catalog, API key, or compliance UI gate is changed.
	return isCreemWebhookConfigured()
}

func isWaffoTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	if !setting.WaffoEnabled {
		return false
	}

	return isWaffoWebhookConfigured()
}

func isWaffoWebhookConfigured() bool {
	if setting.WaffoSandbox {
		return strings.TrimSpace(setting.WaffoSandboxApiKey) != "" &&
			strings.TrimSpace(setting.WaffoSandboxPrivateKey) != "" &&
			strings.TrimSpace(setting.WaffoSandboxPublicCert) != ""
	}

	return strings.TrimSpace(setting.WaffoApiKey) != "" &&
		strings.TrimSpace(setting.WaffoPrivateKey) != "" &&
		strings.TrimSpace(setting.WaffoPublicCert) != ""
}

func isWaffoWebhookEnabled() bool {
	// Do not stop confirmed callback processing just because new Waffo checkouts
	// are disabled; verification credentials, rather than the checkout toggle,
	// are the prerequisite for settling existing orders.
	return isWaffoWebhookConfigured()
}

func isWaffoPancakeTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	// Webhook 验签公钥随 SDK 内置且为**全局共享**（所有商户同一把），无法据此
	// 分辨事件归属。StoreID 是唯一能把「发给本店的真实事件」与「攻击者用自己商户
	// 伪造的事件」分开的绑定，因此必须配置，否则 webhook 无法安全启用。
	return strings.TrimSpace(setting.WaffoPancakeMerchantID) != "" &&
		strings.TrimSpace(setting.WaffoPancakePrivateKey) != "" &&
		strings.TrimSpace(setting.WaffoPancakeStoreID) != "" &&
		strings.TrimSpace(setting.WaffoPancakeProductID) != ""
}

func isWaffoPancakeWebhookConfigured() bool {
	return strings.TrimSpace(setting.WaffoPancakeMerchantID) != "" &&
		strings.TrimSpace(setting.WaffoPancakePrivateKey) != "" &&
		strings.TrimSpace(setting.WaffoPancakeStoreID) != ""
}

func isWaffoPancakeWebhookEnabled() bool {
	// One endpoint receives both wallet top-ups and subscription callbacks.
	// Keep existing order settlement available when new checkout creation is
	// disabled; webhook verification and StoreID binding remain mandatory.
	return isWaffoPancakeWebhookConfigured()
}

func isEpayTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	return isEpayWebhookConfigured() && len(operation_setting.PayMethods) > 0
}

func isEpayWebhookConfigured() bool {
	return strings.TrimSpace(operation_setting.PayAddress) != "" &&
		strings.TrimSpace(operation_setting.EpayId) != "" &&
		strings.TrimSpace(operation_setting.EpayKey) != ""
}

func isEpayWebhookEnabled() bool {
	// PayMethods and payment-compliance confirmation control new checkout options,
	// not the verification of a signed callback for an already-created order.
	return isEpayWebhookConfigured()
}


// Payment provider callbacks are unauthenticated until their signatures are
// verified. Bound their raw bodies before buffering them for signature checks,
// so invalid or hostile payloads cannot force unbounded memory allocation.
const maxPaymentWebhookBodyBytes int64 = 2 << 20

var errPaymentWebhookBodyTooLarge = errors.New("payment webhook request body exceeds size limit")

func readPaymentWebhookBody(body io.Reader) ([]byte, error) {
	if body == nil {
		return nil, errors.New("payment webhook request body is nil")
	}
	payload, err := io.ReadAll(io.LimitReader(body, maxPaymentWebhookBodyBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(payload)) > maxPaymentWebhookBodyBytes {
		return nil, errPaymentWebhookBodyTooLarge
	}
	return payload, nil
}


// limitPaymentWebhookFormBody caps URL-encoded payment callback bodies before
// ParseForm reads them. This complements readPaymentWebhookBody for JSON/raw
// providers while preserving the standard library's form parsing behavior.
func limitPaymentWebhookFormBody(w http.ResponseWriter, r *http.Request) {
	if r != nil && r.Body != nil {
		r.Body = http.MaxBytesReader(w, r.Body, maxPaymentWebhookBodyBytes)
	}
}


const maxPaymentProviderAPIResponseBodyBytes int64 = 1 << 20

// readPaymentProviderAPIResponseBody bounds network response buffering from
// payment gateways before their JSON responses are decoded.
func readPaymentProviderAPIResponseBody(body io.Reader) ([]byte, error) {
	if body == nil {
		return nil, errors.New("payment provider API response body is nil")
	}
	data, err := io.ReadAll(io.LimitReader(body, maxPaymentProviderAPIResponseBodyBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > maxPaymentProviderAPIResponseBodyBytes {
		return nil, fmt.Errorf("payment provider API response exceeds %d bytes", maxPaymentProviderAPIResponseBodyBytes)
	}
	return data, nil
}
