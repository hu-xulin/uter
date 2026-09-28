package common

// GetTrustQuota is the balance above which a request is allowed to skip
// pre-charging entirely.
func GetTrustQuota() int {
	return int(10 * QuotaPerUnit)
}

// GetWalletDebtFloorQuota is the balance at which a wallet stops being admitted
// new requests. Settlement deducts unconditionally (a failed request still
// consumed upstream tokens, and the consume log has to match the balance), so a
// wallet can legitimately go negative; this is the point where the platform
// stops letting it go further.
//
// The default of 0 means "refuse once the balance is no longer positive",
// which is the historical behaviour — the defect it fixes is not the floor
// itself but that the floor was evaluated against a stale cache, letting a
// burst of concurrent requests through before any of them had settled. The
// floor is configurable so an operator can additionally require a buffer.
func GetWalletDebtFloorQuota() int {
	floor := GetEnvOrDefault("WALLET_DEBT_FLOOR_QUOTA", 0)
	if floor < 0 {
		floor = 0
	}
	return floor
}
