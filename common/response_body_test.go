package common

import (
	"bytes"
	"strings"
	"testing"

	"github.com/uter-ai/uter/constant"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadUpstreamBodyEnforcesLimit(t *testing.T) {
	previous := constant.MaxUpstreamResponseMB
	constant.MaxUpstreamResponseMB = 1
	t.Cleanup(func() { constant.MaxUpstreamResponseMB = previous })

	exact := bytes.Repeat([]byte("a"), 1<<20)
	body, err := ReadUpstreamBody(bytes.NewReader(exact))
	require.NoError(t, err, "恰好等于上限的响应不应被判为超限")
	assert.Len(t, body, len(exact))

	over := bytes.Repeat([]byte("a"), (1<<20)+1)
	_, err = ReadUpstreamBody(bytes.NewReader(over))
	require.ErrorIs(t, err, ErrUpstreamResponseTooLarge)

	body, err = ReadUpstreamBody(nil)
	require.NoError(t, err)
	assert.Nil(t, body)
}

func TestReadUpstreamBodyPassesThroughSmallPayload(t *testing.T) {
	body, err := ReadUpstreamBody(strings.NewReader(`{"ok":true}`))
	require.NoError(t, err)
	assert.JSONEq(t, `{"ok":true}`, string(body))
}

func TestUpstreamResponseLimitFallsBackWhenUnset(t *testing.T) {
	previous := constant.MaxUpstreamResponseMB
	constant.MaxUpstreamResponseMB = 0
	t.Cleanup(func() { constant.MaxUpstreamResponseMB = previous })

	assert.Equal(t, int64(defaultMaxUpstreamResponseMB)<<20, UpstreamResponseLimit())
}
