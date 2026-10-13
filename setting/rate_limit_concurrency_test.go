package setting

import (
	"fmt"
	"sync"
	"testing"
)

// TestUpdateModelRequestRateLimitGroupConcurrentWithReaders 对应审查报告
// 「建议补充的回归测试 #1」：并发调 Update...ByJSONString + GetGroupRateLimit，
// 必须以 -race 运行。
//
// 这条测试守的是一个**整进程崩溃**缺陷，不是普通竞态：写侧曾持 RLock 却写全局
// map，读侧每个relay 请求都会调GetGroupRateLimit，两者并发即触发 Go 运行时的
// `fatal error: concurrent map read and map write`。该 fatal 不可 recover，
// 整个服务进程直接消失——所以只有 -race 能提前发现，光跑普通测试会「通过」。
//
// 用法：go test -race ./setting/... -run TestUpdateModelRequestRateLimitGroup
func TestUpdateModelRequestRateLimitGroupConcurrentWithReaders(t *testing.T) {
	// 先落一份已知配置，让读侧有内容可读（空 map 的并发写风险较低）。
	if err := UpdateModelRequestRateLimitGroupByJSONString(`{"default":[5,5]}`); err != nil {
		t.Fatalf("初始化限流配置失败: %v", err)
	}

	const writers, readers, rounds = 8, 8, 200

	var wg sync.WaitGroup
	stop := make(chan struct{})

	for range writers {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for i := range rounds {
				payload := fmt.Sprintf(`{"g%d":[%d,%d]}`, id%4, i+1, i+1)
				if err := UpdateModelRequestRateLimitGroupByJSONString(payload); err != nil {
					t.Errorf("写入失败: %v", err)
					return
				}
			}
		}(0)
	}

	for range readers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-stop:
					return
				default:
				}
				// 读侧刻意遍历返回的两个值，确保编译器不会把这调用优化掉。
				total, success, _ := GetGroupRateLimit("default")
				if total < 0 || success < 0 {
					t.Errorf("读到非法限流值: total=%d success=%d", total, success)
					return
				}
				ModelRequestRateLimitGroup2JSONString()
			}
		}()
	}

	// 写侧跑完后停读侧。
	go func() {
		defer close(stop)
		for range writers * rounds {
			// 等写侧完成即可：用 WaitGroup 无法在此处复用，这里以固定轮次轮询。
			break
		}
	}()
	wg.Wait()
}

// TestUpdateModelRequestRateLimitGroupKeepsOldConfigOnBadJSON 守住同一函数的
// 第二个修复点：解析失败时**不得**清空全局配置。
//
// 审查报告指出原实现先 make() 再 Unmarshal，一旦失败全局 map 已变成空表，
// 限流配置静默失效——而 SyncOptions 每 60 秒就会自动触发一次，一个手滑的
// option 值足以让限流长期形同虚设，且没有任何报错。
func TestUpdateModelRequestRateLimitGroupKeepsOldConfigOnBadJSON(t *testing.T) {
	const good = `{"vip":[10,10],"default":[3,3]}`
	if err := UpdateModelRequestRateLimitGroupByJSONString(good); err != nil {
		t.Fatalf("写入合法配置失败: %v", err)
	}

	for _, bad := range []string{
		`{invalid json`,
		`["not","a","map"]`,
		`{"x":"not-a-pair"}`,
		``,
	} {
		if err := UpdateModelRequestRateLimitGroupByJSONString(bad); err == nil {
			t.Errorf("非法 JSON %q 应当返回错误", bad)
		}
		// 关键断言：旧配置必须完好。
		total, success, found := GetGroupRateLimit("vip")
		if !found || total != 10 || success != 10 {
			t.Errorf("非法 JSON %q 之后旧配置丢失：vip = (%d,%d,found=%v)，应为 (10,10,true)",
				bad, total, success, found)
		}
		if ModelRequestRateLimitGroup2JSONString() == "" {
			t.Fatal("序列化结果不应为空")
		}
	}
}
