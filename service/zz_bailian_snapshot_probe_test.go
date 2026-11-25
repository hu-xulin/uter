package service

import (
	"encoding/json"
	"os"
	"sort"
	"strings"
	"testing"
)

type bailianProbeSnapshot struct {
	Models []struct {
		Items []struct {
			Model      string   `json:"model"`
			Name       string   `json:"name"`
			Provider   string   `json:"provider"`
			Features   []string `json:"features"`
			Prices     []struct {
				Type      string `json:"type"`
				Price     string `json:"price"`
				PriceUnit string `json:"priceUnit"`
				PriceName string `json:"priceName"`
				TimeBand  string `json:"timeBand"`
			} `json:"prices"`
		} `json:"items"`
	} `json:"models"`
}

type bailianProbeRow struct {
	model   string
	reasons []string
	priced  bool
}

func TestZZBailianSnapshotProbe(t *testing.T) {
	raw, err := os.ReadFile("../.workbuddy-ai/memory/bailian-model-market-snapshot-20261125.json")
	if err != nil {
		t.Fatal(err)
	}
	var snap bailianProbeSnapshot
	if err := json.Unmarshal(raw, &snap); err != nil {
		t.Fatal(err)
	}
	reasonCounts := map[string]int{}
	var rows []bailianProbeRow
	for _, group := range snap.Models {
		for _, item := range group.Items {
			bailian := BailianModel{Model: item.Model, Name: item.Name, Provider: item.Provider, Features: item.Features}
			for _, price := range item.Prices {
				bailian.Prices = append(bailian.Prices, BailianPriceRange{
					RangeName: "Default",
					Prices: []BailianPrice{{
						Type: price.Type, Price: price.Price, PriceUnit: price.PriceUnit,
						PriceName: price.PriceName, TimeBand: price.TimeBand,
					}},
				})
			}
			view := bailianOfficialPricing(bailian, BailianRegionBeijing, 7, 100)
			priced := bailianInternalPricing(view) != ""
			for _, reason := range view.ReviewReasons {
				reasonCounts[reason]++
			}
			rows = append(rows, bailianProbeRow{model: item.Model, reasons: view.ReviewReasons, priced: priced})
		}
	}
	keys := make([]string, 0, len(reasonCounts))
	for key := range reasonCounts {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	t.Logf("items=%d priced=%d unpriced=%d", len(rows), countPriced(rows), len(rows)-countPriced(rows))
	for _, key := range keys {
		t.Logf("reason %q: %d", key, reasonCounts[key])
	}
	for _, want := range []string{"qwen4-max", "qwen-audio-3.1-tts-flash", "qwen-audio-3.1-asr-flash", "sambert-zhiyue-v1", "qwen3-vl-embedding"} {
		for _, r := range rows {
			if r.model == want {
				t.Logf("sample %s priced=%v reasons=%s", want, r.priced, strings.Join(r.reasons, " | "))
				break
			}
		}
	}
}

func countPriced(rows []bailianProbeRow) int {
	total := 0
	for _, row := range rows {
		if row.priced {
			total++
		}
	}
	return total
}
