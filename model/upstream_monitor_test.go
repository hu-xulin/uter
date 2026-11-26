package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestUpstreamMonitorTaskMonitorModels(t *testing.T) {
	task := &UpstreamMonitorTask{
		Model:  "legacy-model",
		Models: `["alpha","beta","alpha"," gamma "]`,
	}
	assert.Equal(t, []string{"alpha", "beta", "gamma"}, task.MonitorModels())

	legacy := &UpstreamMonitorTask{Model: "legacy-model"}
	assert.Equal(t, []string{"legacy-model"}, legacy.MonitorModels())

	empty := &UpstreamMonitorTask{Models: `["", "  "]`}
	assert.Empty(t, empty.MonitorModels())
}
