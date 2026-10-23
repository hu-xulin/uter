package common

import (
	"errors"
	"fmt"
	"io"

	"github.com/uter-ai/uter/constant"
)

const defaultMaxUpstreamResponseMB = 128

// ErrUpstreamResponseTooLarge 表示上游响应体超过 MAX_UPSTREAM_RESPONSE_MB。
var ErrUpstreamResponseTooLarge = errors.New("upstream response body too large")

// UpstreamResponseLimit 返回单个上游响应体的字节上限。
func UpstreamResponseLimit() int64 {
	mb := constant.MaxUpstreamResponseMB
	if mb <= 0 {
		mb = defaultMaxUpstreamResponseMB
	}
	return int64(mb) << 20
}

// ReadUpstreamBody 读取一个上游 HTTP 响应体，超过上限时返回 ErrUpstreamResponseTooLarge。
//
// 为什么不直接用 io.ReadAll：上游（或链路上的中间人）返回无界 body 时，读取会一路把
// 进程内存吃满；流式路径有 StreamScanner 的行上限兜底，非流式路径此前完全没有边界。
// 上限默认 128MB（MAX_UPSTREAM_RESPONSE_MB 可调），足够覆盖 base64 图片/音频等大响应。
//
// 调用方按原有的错误分支处理返回值即可——超限只是 err 的一种，语义与「读失败」一致。
func ReadUpstreamBody(reader io.Reader) ([]byte, error) {
	if reader == nil {
		return nil, nil
	}
	limit := UpstreamResponseLimit()
	// 多读 1 字节用于判断是否越界，避免把恰好等于上限的响应误判为超限。
	body, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > limit {
		return nil, fmt.Errorf("%w: exceeds %d MB", ErrUpstreamResponseTooLarge, limit>>20)
	}
	return body, nil
}
