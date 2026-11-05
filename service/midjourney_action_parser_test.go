package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/dto"
)

func TestConvertSimpleChangeParamsRejectsMalformedInput(t *testing.T) {
	for _, input := range []string{
		"", "task", "task ", " task", "task u", "task v", "task u0",
		"task u5", "task v0", "task v5", "task u10", "task v11",
		"task r1", "task r extra", "task u1 extra",
	} {
		assert.Nil(t, ConvertSimpleChangeParams(input), "input=%q", input)
	}
	assert.Nil(t, ConvertSimpleChangeParams("task "))
	assert.Nil(t, ConvertSimpleChangeParams("task   "))
}

func TestConvertSimpleChangeParamsAcceptsSupportedActions(t *testing.T) {
	for _, test := range []struct {
		input  string
		action string
		index  int
	}{
		{"task u1", "UPSCALE", 1},
		{"task u4", "UPSCALE", 4},
		{"task v1", "VARIATION", 1},
		{"task v4", "VARIATION", 4},
		{"task r", "REROLL", 0},
	} {
		result := ConvertSimpleChangeParams(test.input)
		require.NotNil(t, result, "input=%q", test.input)
		assert.Equal(t, "task", result.TaskId)
		assert.Equal(t, test.action, result.Action)
		assert.Equal(t, test.index, result.Index)
	}
}

func TestCoverPlusActionToNormalActionRejectsMalformedCustomIDs(t *testing.T) {
	for _, customID := range []string{
		"", "MJ", "MJ::", "MJ::JOB", "MJ::JOB::", "MJ::JOB::upsample",
		"MJ::JOB::upsample::x", "MJ::JOB::upsample::0", "MJ::JOB::upsample::5",
		"MJ::JOB::variation", "MJ::JOB::variation::x", "MJ::JOB::variation::5",
	} {
		request := &dto.MidjourneyRequest{CustomId: customID}
		assert.NotNil(t, CoverPlusActionToNormalAction(request), "customID=%q", customID)
	}
	assert.NotNil(t, CoverPlusActionToNormalAction(nil))
}

func TestCoverPlusActionToNormalActionAcceptsSupportedActions(t *testing.T) {
	tests := []struct {
		customID string
		action   string
		index    int
	}{
		{"MJ::JOB::upsample::2::task", constant.MjActionUpscale, 2},
		{"MJ::JOB::variation::3::task", constant.MjActionVariation, 3},
		{"MJ::JOB::low_variation::task", constant.MjActionLowVariation, 1},
		{"MJ::JOB::high_variation::task", constant.MjActionHighVariation, 1},
		{"MJ::JOB::reroll::task", constant.MjActionReRoll, 1},
	}
	for _, test := range tests {
		request := &dto.MidjourneyRequest{CustomId: test.customID}
		require.Nil(t, CoverPlusActionToNormalAction(request), "customID=%q", test.customID)
		assert.Equal(t, test.action, request.Action)
		assert.Equal(t, test.index, request.Index)
	}
}
