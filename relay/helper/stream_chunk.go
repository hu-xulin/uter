package helper

import "context"

// SendStreamChunk 把一个上游 chunk 投递给流式消费方。
//
// 为什么需要它：旧版渠道适配器（zhipu / cohere / palm / xunfei）用无缓冲 channel
// 在读取协程里直接 `ch <- chunk`。客户端一旦断开，gin 的 c.Stream 立即返回、消费方
// 消失，读取协程就永久阻塞在这个发送上——goroutine 泄漏，并且上游 resp.Body 或
// websocket 连接再也不会被关闭（审核规范 P2.1 / P2.2）。
//
// 返回 false 表示消费方已不可用，调用方应立即退出并释放上游连接。
func SendStreamChunk[T any](ctx context.Context, ch chan<- T, chunk T) bool {
	select {
	case ch <- chunk:
		return true
	case <-ctx.Done():
		return false
	}
}
