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
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/uter-ai/uter/model"
)

// ResolveExchangeRateToUSD returns the conversion to use for one bill.
//
// Precedence: an explicit rate from the importer, then the newest historical
// rate effective now. A missing rate is an error: silently treating the
// supplier's amount as USD corrupts both cost and profit.
func ResolveExchangeRateToUSD(currency string, explicit float64, source string) (rate float64, fxSource, fxVersion string, err error) {
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if currency == "" || currency == "USD" {
		return 1, "identity", "", nil
	}
	if math.IsNaN(explicit) || math.IsInf(explicit, 0) || explicit < 0 {
		return 0, "", "", errors.New("exchange rate must be a finite non-negative number")
	}
	if explicit > 0 {
		if strings.TrimSpace(source) == "" {
			source = "explicit"
		}
		return explicit, source, model.BillingExchangeRateVersion(currency, "USD", explicit), nil
	}
	hist, lookupErr := model.LatestBillingExchangeRate(currency, "USD", time.Now().Unix())
	if lookupErr != nil || hist == nil {
		return 0, "", "", fmt.Errorf("no USD exchange rate recorded for %s; provide fx_rate", currency)
	}
	return hist.Rate, hist.Source, hist.Version, nil
}
