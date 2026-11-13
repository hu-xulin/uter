package jsplugin

// BalanceResult is a channel balance: the amount in currency, null when the
// vendor reports none, unlimited, and the quota windows of the account.
type BalanceResult struct {
	Amount    *float64        `json:"amount"`
	Currency  string          `json:"currency"`
	Unlimited bool            `json:"unlimited"`
	Windows   []BalanceWindow `json:"windows"`
}

// BalanceWindow is one quota window: what is used of the limit in unit, and
// when it resets in unix seconds, 0 when the vendor does not say.
type BalanceWindow struct {
	Name    LocalizedText `json:"name"`
	Used    float64       `json:"used"`
	Limit   float64       `json:"limit"`
	Unit    string        `json:"unit,omitempty"`
	ResetAt int64         `json:"resetAt,omitempty"`
}
