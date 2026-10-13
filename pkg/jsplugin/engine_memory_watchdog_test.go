package jsplugin

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestEngineInterruptsAllocationBomb 验证内存看门狗能拦下「快速分配」型插件。
//
// 背景：Sobek 没有内存配额，插件原有的防线只有 5 秒超时。但一个不 sleep 的
// 分配炸弹（while 里反复拼接字符串）可以在超时窗口内分配数 GB——超时是协作式
// 中断，引擎要等到下一个可中断点才生效，而纯分配循环正好每次迭代都是可中断点，
// 真正致命的是 GC 追不上瞬时峰值，进程可能先被 OOM killer 带走。
//
// 这里用「比上限小一点的固定分配量 + 足够长的超时」构造：若没有看门狗，
// 插件会顺利跑完、测试拿到 nil 错误；有看门狗则必须被中断并报错。
func TestEngineInterruptsAllocationBomb(t *testing.T) {
	// 超时给到 30s，确保「不是靠超时兜住的」——只有内存看门狗能拦下它。
	engine, err := Compile(`
export function bomb(ctx) {
  const chunk = "x".repeat(1024 * 1024);
  let sink = "";
  for (let i = 0; i < 4000; i++) {
    sink = sink + chunk;
  }
  return sink.length;
}
`, Options{
		Key:         "mem-bomb",
		Version:     "1.0.0",
		Timeout:     30 * time.Second,
		Concurrency: 1,
	})
	require.NoError(t, err)

	start := time.Now()
	_, err = engine.Call(context.Background(), "bomb", map[string]any{})
	elapsed := time.Since(start)

	require.Error(t, err, "内存炸弹必须被中断而不是跑完")
	assert.Less(t, elapsed, 25*time.Second,
		"必须在超时之前就中断（实际耗时 %v），否则说明是靠超时兜底的", elapsed)
	assert.True(t,
		strings.Contains(err.Error(), "interrupt") ||
			strings.Contains(err.Error(), "heap") ||
			strings.Contains(err.Error(), "memory"),
		"错误信息应能区分「内存超限」与「普通 JS 异常」，实际得到: %v", err)
}

// TestEngineNormalPluginUnaffectedByHeapWatch 守住回归：正常插件不能被误杀。
//
// 看门狗盯的是「进程堆增量」，理论上会把插件之外的用量（测试进程自身的
// 分配、其他并行测试）也算进 baseline。如果实现有偏差，健康插件会被误中断，
// 所以这里显式验证一条正常逻辑能正常返回。
func TestEngineNormalPluginUnaffectedByHeapWatch(t *testing.T) {
	engine, err := Compile(`
export function work(ctx) {
  let total = 0;
  for (let i = 0; i < 200000; i++) { total += i; }
  return total;
}
`, Options{Key: "normal", Version: "1.0.0", Timeout: 10 * time.Second})
	require.NoError(t, err)

	result, err := engine.Call(context.Background(), "work", map[string]any{})
	require.NoError(t, err, "正常插件不得被内存看门狗误中断")
	assert.Equal(t, int64(19999900000), result)
}

// TestEngineRuntimeReusedAfterHeapWatchStops 确认看门狗停表后不残留 goroutine，
// 且 runtime 归还池后能继续服务下一次调用（stop 若泄漏 goroutine 会累积到
// DefaultConcurrency 倍并最终把池撑爆）。
func TestEngineRuntimeReusedAfterHeapWatchStops(t *testing.T) {
	engine, err := Compile(`
export function ping(ctx) { return "pong"; }
`, Options{Key: "reuse", Version: "1.0.0"})
	require.NoError(t, err)

	for range 5 {
		result, err := engine.Call(context.Background(), "ping", map[string]any{})
		require.NoError(t, err)
		assert.Equal(t, "pong", result)
	}
}

// TestEngineHeapWatchIgnoresGCShrink 锁定「GC 让堆下降时不误杀」这条不变量。
//
// 回归背景：堆增量原先写成 current.HeapAlloc - before.HeapAlloc，而两者都是
// uint64。GC 回收掉本调用自己产生的垃圾后 current 可能小于 before，无符号减法
// 直接回绕成接近 2^64 的值（约 1.8e19），被误判为堆爆炸并中断调用——
// TestEngineDurationAutoNormalizesWithoutInventing 曾因此间歇性变红，
// 且日志里出现 delta_bytes=18446744073447514656 这种一眼即知是下溢的数字。
//
// 这里构造「分配后主动丢弃引用」的插件：堆必然冲高又回落，中途必然触发 GC。
// 正确实现下该调用必须正常返回；一旦回绕，就会返回 heap limit exceeded。
func TestEngineHeapWatchIgnoresGCShrink(t *testing.T) {
	engine, err := Compile(`
export function churn(ctx) {
  // 分批分配并丢弃，每批之后引用即不可达，给 GC 回收机会。
  let last = 0;
  for (let round = 0; round < 40; round++) {
    let scratch = [];
    for (let i = 0; i < 20000; i++) {
      scratch.push("y".repeat(512));
    }
    last = scratch.length;
    scratch = null;
  }
  return last;
}
`, Options{Key: "gcshrink", Version: "1.0.0", Timeout: 30 * time.Second})
	require.NoError(t, err)

	result, err := engine.Call(context.Background(), "churn", map[string]any{})
	require.NoError(t, err, "GC 导致的堆回落不得被误判为堆爆炸")
	assert.Equal(t, int64(20000), result)
}
