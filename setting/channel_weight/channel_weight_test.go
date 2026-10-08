package channel_weight

import (
	"testing"

	"github.com/uter-ai/uter/common"
)

func setOption(t *testing.T, raw string) {
	t.Helper()
	common.OptionMap = map[string]string{ChannelModelWeightOptionKey: raw}
}

func TestGetChannelModelWeight(t *testing.T) {
	setOption(t, `{"enabled":true,"channels":{"7":{"gpt-4o":{"weight":5},"gpt-4o-mini":{"weight":2}}}}`)
	if w, ok := GetChannelModelWeight(7, "gpt-4o"); !ok || w != 5 {
		t.Fatalf("gpt-4o weight = %v,%v want 5,true", w, ok)
	}
	if w, ok := GetChannelModelWeight(7, "gpt-4o-mini"); !ok || w != 2 {
		t.Fatalf("gpt-4o-mini weight = %v,%v want 2,true", w, ok)
	}
	// unset model falls back
	if _, ok := GetChannelModelWeight(7, "gpt-5"); ok {
		t.Fatal("gpt-5 should not have an override")
	}
	// unset channel falls back
	if _, ok := GetChannelModelWeight(99, "gpt-4o"); ok {
		t.Fatal("channel 99 should not have overrides")
	}
}

func TestGetChannelModelPriority(t *testing.T) {
	setOption(t, `{"enabled":true,"channels":{"7":{"gpt-4o":{"priority":10}}}}`)
	if p, ok := GetChannelModelPriority(7, "gpt-4o"); !ok || p != 10 {
		t.Fatalf("gpt-4o priority = %v,%v want 10,true", p, ok)
	}
	if _, ok := GetChannelModelPriority(7, "gpt-4o-mini"); ok {
		t.Fatal("gpt-4o-mini should not have a priority override")
	}
}

func TestDisabledDoesNotApply(t *testing.T) {
	setOption(t, `{"enabled":false,"channels":{"7":{"gpt-4o":{"weight":5}}}}`)
	if _, ok := GetChannelModelWeight(7, "gpt-4o"); ok {
		t.Fatal("disabled setting should not apply")
	}
	if Enabled() {
		t.Fatal("Enabled() should be false when disabled")
	}
}

func TestEmptyOption(t *testing.T) {
	common.OptionMap = map[string]string{}
	if _, ok := GetChannelModelWeight(7, "gpt-4o"); ok {
		t.Fatal("unset option should fall back")
	}
}
