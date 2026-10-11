package model

import (
	"fmt"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"

	"github.com/bytedance/gopkg/util/gopool"
)

// 用量日志的批量写入（group commit）。
//
// 背景：createLog 是同步串行 INSERT，带 3 次重试 + 50ms/100ms 递增 sleep。DB 一抖动，
// 每个请求就被拖长最多 150ms，且这些重试是**各自独立**的——100 并发就是 100 轮
// 重试，把连接池和上游一起打满，形成级联。
//
// 这里改成「合并写」而非「纯异步写」：
//   - 后台 worker 持有唯一的写通道，把同一瞬间到期的请求合并成一次批量 INSERT
//     （CreateInBatches），重试与 sleep 由整组共享，而不是每个请求各付一遍。
//   - 每个请求仍然**等待自己那条记录落库**后才返回。这不是保守，而是必须：
//     扣费已经发生在主库、这条日志在 LOG_DB，两者无法共处一个事务，日志就是这次
//     扣费唯一的凭据。若投递后不等就返回，进程崩溃或 LOG_DB 故障时会出现
//     「钱扣了、账没了」的账实不符。
//   - 队列满时退回同步 createLog（不丢日志），并打错误日志提示队列已打满。
//
// 刷盘时机：攒满 logWriterBatchSize 条立即写；否则把此刻已排队的补齐后立即写，
// 低流量下退化为单条写（与改造前同延迟），高流量下自然合并成批。200ms 的定时器
// 只作为尾部队列的兜底——单纯「等到 100 条或 200ms」会让低流量请求平白多等 200ms，
// 那才是真的把延迟换成了吞吐。

const (
	// logWriterQueueSize 是有界队列容量。按「DB 完全停摆时仍能吸收的请求数」选取：
	// 队列满即退回同步写（见 submitLogWrite），不会丢日志，只是重新变慢。
	logWriterQueueSize = 4096
	// logWriterBatchSize 是单批最大条数，对齐 CreateInBatches 的批量参数。
	logWriterBatchSize = 100
	// logWriterFlushInterval 是兜底刷盘间隔，只用于收尾排队中的少量请求。
	logWriterFlushInterval = 200 * time.Millisecond
)

// logWriteTicket 是「一条日志 + 等它落库」的握手单元。
type logWriteTicket struct {
	log  *Log
	done chan error
}

var (
	logWriterOnce sync.Once
	logWriteQueue chan *logWriteTicket
)

// startLogWriter 启动唯一的批量写 worker（进程内只启动一次）。
func startLogWriter() chan *logWriteTicket {
	logWriterOnce.Do(func() {
		logWriteQueue = make(chan *logWriteTicket, logWriterQueueSize)
		gopool.Go(runLogWriter)
	})
	return logWriteQueue
}

func runLogWriter() {
	ticker := time.NewTicker(logWriterFlushInterval)
	defer ticker.Stop()

	batch := make([]*logWriteTicket, 0, logWriterBatchSize)
	flush := func() {
		if len(batch) == 0 {
			return
		}
		writeLogBatch(batch)
		for i := range batch {
			batch[i] = nil
		}
		batch = batch[:0]
	}

	for {
		select {
		case ticket := <-logWriteQueue:
			batch = append(batch, ticket)
			// 把此刻已经排队的请求一并吸收：它们反正也要等同一轮写完，
			// 合并成一次 INSERT 比各写一次快得多。
			for len(batch) < logWriterBatchSize {
				select {
				case next := <-logWriteQueue:
					batch = append(batch, next)
					continue
				default:
				}
				break
			}
			flush()
		case <-ticker.C:
			// 兜底：正常路径上队列不会积压（收到即 flush），
			// 这里只处理极端情况下堆积的尾部请求。
			for {
				select {
				case ticket := <-logWriteQueue:
					batch = append(batch, ticket)
					if len(batch) >= logWriterBatchSize {
						flush()
					}
					continue
				default:
				}
				break
			}
			flush()
		}
	}
}

// writeLogBatch 把一批日志一次性写入 LOG_DB，并逐条回执成功/失败。
//
// 批量写失败时逐条回退到 createLog：批量写无法判断「哪些行已落库」，而这张表
// 参与 SUM 对账，重复写入会让账翻倍。createLog 内有重试与 logAlreadyPersisted
// 幂等保护，能把「写成功但回执丢失」与「根本没写进去」区分开。
func writeLogBatch(batch []*logWriteTicket) {
	if LOG_DB == nil {
		err := fmt.Errorf("log database is not initialized")
		for _, ticket := range batch {
			ensureLogRequestId(ticket.log)
			reportLogWriteFailure(ticket.log, err)
			ticket.done <- err
		}
		return
	}

	logs := make([]*Log, len(batch))
	for i, ticket := range batch {
		ensureLogRequestId(ticket.log)
		logs[i] = ticket.log
	}

	if err := LOG_DB.CreateInBatches(logs, logWriterBatchSize).Error; err != nil {
		common.SysError(fmt.Sprintf("batch write consume logs failed (%d records), falling back to per-record write: %s",
			len(logs), err.Error()))
		for _, log := range logs {
			// 批量写可能已部分落库，createLog 内的 logAlreadyPersisted 会挡住重复行。
			log.Id = 0
			if singleErr := createLog(log); singleErr != nil {
				reportLogWriteFailure(log, singleErr)
			}
		}
	}

	for _, ticket := range batch {
		// 回执只表示「这一批已经处理完」；单条失败已由上面的回退路径单独上报。
		ticket.done <- nil
	}
}

// submitLogWrite 把日志交给批量写 worker，并等待本条落库后返回。
//
// 队列满时**不丢日志**：退回同步 createLog。这会把写入延迟算回该请求自己头上
// （即退化到改造前的行为），但用量日志是扣费凭据，丢失会造成账实不符，
// 因此宁可慢也不能丢；同时打错误日志，让运维知道队列已经打满。
func submitLogWrite(log *Log) error {
	queue := startLogWriter()

	ticket := &logWriteTicket{log: log, done: make(chan error, 1)}
	select {
	case queue <- ticket:
	default:
		common.SysError("consume log writer queue is full, writing synchronously; consider raising the queue size")
		ensureLogRequestId(log)
		return createLog(log)
	}
	return <-ticket.done
}

// FlushLogWrites 在进程退出前等待批量写 worker 把队列排空。
//
// 正常情况下 submitLogWrite 返回即代表本条已落库，这里是针对「已入队但尚未回执」
// 的极端窗口的兜底。带超时，避免 DB 卡死把关机流程一起挂住。
func FlushLogWrites(timeout time.Duration) {
	if logWriteQueue == nil {
		return
	}
	deadline := time.Now().Add(timeout)
	for {
		remaining := time.Until(deadline)
		if remaining <= 0 {
			common.SysError(fmt.Sprintf("flush consume log writer timed out after %s, %d records may be unwritten",
				timeout, len(logWriteQueue)))
			return
		}
		if len(logWriteQueue) == 0 {
			return
		}
		time.Sleep(min(remaining, 10*time.Millisecond))
	}
}
