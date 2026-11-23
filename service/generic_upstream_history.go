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
	"strings"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// GenericUpstreamHistoryKey stores the bounded price-change log for New API
// compatible channels. UterRoute/Bailian keep their own provider logs.
const GenericUpstreamHistoryKey = "GenericUpstreamPriceHistory"

func mergeUpstreamHistory(
	history *UpstreamPriceHistory,
	providerID string,
	changes []UpstreamPriceChange,
	limit int,
) *UpstreamPriceHistory {
	if history == nil {
		history = &UpstreamPriceHistory{ProviderID: providerID}
	}
	if strings.TrimSpace(history.ProviderID) == "" {
		history.ProviderID = providerID
	}
	history.Entries = append(history.Entries, changes...)
	if limit > 0 && len(history.Entries) > limit {
		history.Entries = history.Entries[len(history.Entries)-limit:]
	}
	return history
}

// AppendGenericUpstreamHistory merges detected price changes into the bounded
// generic-provider log.
func AppendGenericUpstreamHistory(changes []UpstreamPriceChange) error {
	if len(changes) == 0 {
		return nil
	}
	history := mergeUpstreamHistory(LoadGenericUpstreamHistory(), "newapi-compatible", changes, upstreamHistoryLimit)
	raw, err := common.Marshal(history)
	if err != nil {
		return err
	}
	return model.UpdateOption(GenericUpstreamHistoryKey, string(raw))
}

// LoadGenericUpstreamHistory returns the persisted generic change log.
func LoadGenericUpstreamHistory() *UpstreamPriceHistory {
	raw := strings.TrimSpace(common.GetOption(GenericUpstreamHistoryKey))
	if raw == "" {
		return nil
	}
	var history UpstreamPriceHistory
	if err := common.UnmarshalJsonStr(raw, &history); err != nil {
		return nil
	}
	return &history
}
