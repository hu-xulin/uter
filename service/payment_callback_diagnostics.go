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
	"sync"
	"time"
)

// PaymentCallbackEvent is a process-local diagnostic record. It deliberately
// excludes the raw form body and signature: the callback payload contains
// buyer identifiers and the signed form is not needed to debug routing.
type PaymentCallbackEvent struct {
	Time     int64  `json:"time"`
	Provider string `json:"provider"`
	TradeNo  string `json:"trade_no,omitempty"`
	Result   string `json:"result"`
	Reason   string `json:"reason,omitempty"`
	RemoteIP string `json:"remote_ip,omitempty"`
}

const paymentCallbackEventLimit = 200

var paymentCallbackEvents struct {
	mu     sync.Mutex
	events []PaymentCallbackEvent
}

// RecordPaymentCallback appends one callback outcome to the process-local ring
// buffer. A restart clears it; durable callback outcome remains in the normal
// application logs and top-up records.
func RecordPaymentCallback(provider, tradeNo, result, reason, remoteIP string) {
	event := PaymentCallbackEvent{
		Time:     time.Now().Unix(),
		Provider: provider,
		TradeNo:  tradeNo,
		Result:   result,
		Reason:   reason,
		RemoteIP: remoteIP,
	}
	paymentCallbackEvents.mu.Lock()
	defer paymentCallbackEvents.mu.Unlock()
	events := append(paymentCallbackEvents.events, event)
	if len(events) > paymentCallbackEventLimit {
		events = events[len(events)-paymentCallbackEventLimit:]
	}
	paymentCallbackEvents.events = events
}

// RecentPaymentCallbacks returns the newest events first. An empty provider
// returns every provider.
func RecentPaymentCallbacks(provider string, limit int) []PaymentCallbackEvent {
	if limit <= 0 || limit > paymentCallbackEventLimit {
		limit = 50
	}
	paymentCallbackEvents.mu.Lock()
	defer paymentCallbackEvents.mu.Unlock()
	out := make([]PaymentCallbackEvent, 0, limit)
	for i := len(paymentCallbackEvents.events) - 1; i >= 0 && len(out) < limit; i-- {
		event := paymentCallbackEvents.events[i]
		if provider != "" && event.Provider != provider {
			continue
		}
		out = append(out, event)
	}
	return out
}
