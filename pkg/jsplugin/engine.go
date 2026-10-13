package jsplugin

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	goruntime "runtime"
	"slices"
	"strings"
	"time"

	"github.com/uter-ai/uter/logger"

	"github.com/grafana/sobek"
	"github.com/grafana/sobek/parser"
)

const (
	DefaultCallTimeout = 5 * time.Second
	DefaultConcurrency = 8

	// DefaultHeapLimitBytes 是插件执行期间允许的进程堆增量上限。
	//
	// 为什么需要：Sobek 运行时没有内存配额，插件拿到的 utils.* 里虽有 jsonStateBudget
	// 一类的显式预算，但插件本身仍可在 5 秒超时窗口内自由分配——例如一个 while 循环里
	// 反复 push 一个不断变长的字符串，默认并发 8 意味着 8 个这样的插件可以同时把堆
	// 撑到 OOM。超时拦不住快速分配，GC 也追不上瞬时峰值。
	//
	// 这里盯的是【堆增量】而不是堆总量：进程自身的正常用量（渠道缓存、日志缓冲）
	// 不该被算到插件头上，否则正常负载波动会误杀健康插件。
	DefaultHeapLimitBytes = 512 << 20 // 512 MiB

	// memoryWatchInterval 是堆用量采样间隔。取值需权衡：间隔太短会让 runtime.ReadMemStats
	// 的 STW 停顿频繁落在插件热路径上（ReadMemStats 会短暂阻塞），太长则来不及在
	// 分配爆炸时及时中断。50ms 足以在秒级爆炸里抢到几次干预机会，又不至于显著影响吞吐。
	memoryWatchInterval = 50 * time.Millisecond
)

var ErrCallAdmissionTimeout = errors.New("plugin call admission timed out")

const hookErrorMessageLimit = 512

// HookError reports a JavaScript exception thrown by a plugin hook. Message
// is the sanitized JS error message with engine prefixes stripped; it is safe
// to surface to API callers.
type HookError struct {
	Hook    string
	Message string
	wrapped error
}

func (e *HookError) Error() string {
	if e == nil || e.wrapped == nil {
		return "plugin hook failed"
	}
	return e.wrapped.Error()
}

func (e *HookError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.wrapped
}

func newHookError(hook, rawMessage string, wrapped error) *HookError {
	var b strings.Builder
	b.Grow(len(rawMessage))
	count := 0
	for _, r := range rawMessage {
		if count >= hookErrorMessageLimit {
			break
		}
		if r < 0x20 || (r >= 0x80 && r <= 0x9F) {
			r = ' '
		}
		b.WriteRune(r)
		count++
	}
	message := b.String()
	if message == "" {
		message = "plugin hook failed"
	}
	return &HookError{Hook: hook, Message: message, wrapped: wrapped}
}

func hookErrorFromException(hook string, exc *sobek.Exception, wrapped error) (hookErr *HookError) {
	// Reading message/toString executes plugin getters, which can throw again
	// and panic sobek. By this point the caller's recover is already consumed,
	// so a second panic would crash the process; fall back to a blank message.
	defer func() {
		if recover() != nil {
			hookErr = newHookError(hook, "", wrapped)
		}
	}()
	raw := ""
	if exc != nil {
		if val := exc.Value(); val != nil && !sobek.IsUndefined(val) && !sobek.IsNull(val) {
			gotMessage := false
			if obj, ok := val.(*sobek.Object); ok {
				if msg := obj.Get("message"); msg != nil && !sobek.IsUndefined(msg) && !sobek.IsNull(msg) {
					raw = msg.String()
					gotMessage = true
				}
			}
			if !gotMessage {
				if exported, ok := val.Export().(string); ok {
					raw = exported
				} else {
					raw = val.String()
				}
			}
		}
	}
	return newHookError(hook, raw, wrapped)
}

var forbiddenSyntax = regexp.MustCompile(`(?m)(^|[^A-Za-z0-9_$])(async|await|import)([^A-Za-z0-9_$]|$)`)

type Options struct {
	Key         string
	Version     string
	Timeout     time.Duration
	Concurrency int
	Now         func() time.Time
	Log         func(string)
}

type Engine struct {
	key       string
	version   string
	timeout   time.Duration
	now       func() time.Time
	log       func(string)
	module    *sobek.SourceTextModuleRecord
	pool      chan *runtimeInstance
	semaphore chan struct{}
}

type runtimeInstance struct {
	runtime    *sobek.Runtime
	module     sobek.ModuleInstance
	logContext *runtimeLogContext
}

type runtimeLogContext struct {
	context context.Context
}

// Compile performs upload-time syntax checks and compiles an ESM plugin once.
// All Sobek-specific module and runtime handling is intentionally kept here.
func Compile(source string, options Options) (*Engine, error) {
	if match := forbiddenSyntax.FindString(sourceWithoutCommentsAndStrings(source)); match != "" {
		return nil, fmt.Errorf("unsupported plugin syntax %q: plugins must be synchronous and cannot import modules", strings.TrimSpace(match))
	}

	resolve := func(_ any, specifier string) (sobek.ModuleRecord, error) {
		return nil, fmt.Errorf("plugin imports are disabled: %s", specifier)
	}
	// Plugin source is untrusted; without this option a sourceMappingURL
	// comment makes the parser read arbitrary server files via os.ReadFile.
	module, err := sobek.ParseModule(options.Key+".js", source, resolve, parser.WithDisableSourceMaps)
	if err != nil {
		return nil, fmt.Errorf("compile plugin: %w", err)
	}
	if err = module.Link(); err != nil {
		return nil, fmt.Errorf("link plugin: %w", err)
	}

	timeout := options.Timeout
	if timeout <= 0 {
		timeout = DefaultCallTimeout
	}
	concurrency := options.Concurrency
	if concurrency <= 0 {
		concurrency = DefaultConcurrency
	}
	now := options.Now
	if now == nil {
		now = time.Now
	}

	engine := &Engine{
		key:       options.Key,
		version:   options.Version,
		timeout:   timeout,
		now:       now,
		log:       options.Log,
		module:    module,
		semaphore: make(chan struct{}, concurrency),
		pool:      make(chan *runtimeInstance, concurrency),
	}
	instance, err := engine.newRuntime(context.Background())
	if err != nil {
		return nil, err
	}
	instance.logContext.context = nil
	engine.putRuntime(instance)
	return engine, nil
}

// Export returns one module export without exposing Sobek values outside the
// engine boundary. It is used for declarative exports such as meta.
func (e *Engine) Export(ctx context.Context, exportName string) (result any, err error) {
	select {
	case e.semaphore <- struct{}{}:
		defer func() { <-e.semaphore }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	instance, err := e.getRuntime(ctx)
	if err != nil {
		return nil, err
	}
	reusable := true
	defer func() {
		instance.runtime.ClearInterrupt()
		instance.logContext.context = nil
		if reusable {
			e.putRuntime(instance)
		}
	}()
	timedOut := errors.New("plugin export timed out")
	stopInterrupt := watchRuntimeContext(instance.runtime, ctx, e.timeout, timedOut)
	defer stopInterrupt()
	defer func() {
		if recovered := recover(); recovered != nil {
			reusable = false
			switch value := recovered.(type) {
			case *sobek.InterruptedError:
				err = fmt.Errorf("plugin %s@%s export %s interrupted: %v", e.key, e.version, exportName, value.Value())
			case *sobek.Exception:
				err = fmt.Errorf("plugin %s@%s export %s failed: %v", e.key, e.version, exportName, value)
			default:
				panic(recovered)
			}
		}
	}()
	value := instance.module.GetBindingValue(exportName)
	if value == nil || sobek.IsUndefined(value) {
		return nil, fmt.Errorf("plugin export %q not found", exportName)
	}
	return value.Export(), nil
}

// HasExport reports whether a module export exists. Optional contract hooks
// should be detected with this method instead of relying on engine errors.
func (e *Engine) HasExport(ctx context.Context, exportName string) (bool, error) {
	select {
	case e.semaphore <- struct{}{}:
		defer func() { <-e.semaphore }()
	case <-ctx.Done():
		return false, ctx.Err()
	}
	instance, err := e.getRuntime(ctx)
	if err != nil {
		return false, err
	}
	defer func() {
		instance.logContext.context = nil
		e.putRuntime(instance)
	}()
	value := instance.module.GetBindingValue(exportName)
	return value != nil && !sobek.IsUndefined(value), nil
}

// HasCallablePath reports whether an exported value, or a nested member below
// it, exists and is callable.
func (e *Engine) HasCallablePath(ctx context.Context, exportName string, members ...string) (found bool, err error) {
	select {
	case e.semaphore <- struct{}{}:
		defer func() { <-e.semaphore }()
	case <-ctx.Done():
		return false, ctx.Err()
	}
	instance, err := e.getRuntime(ctx)
	if err != nil {
		return false, err
	}
	reusable := true
	defer func() {
		instance.runtime.ClearInterrupt()
		instance.logContext.context = nil
		if reusable {
			e.putRuntime(instance)
		}
	}()
	timedOut := errors.New("plugin inspection timed out")
	stopInterrupt := watchRuntimeContext(instance.runtime, ctx, e.timeout, timedOut)
	defer stopInterrupt()
	defer func() {
		if recovered := recover(); recovered != nil {
			reusable = false
			hookName := strings.Join(append([]string{exportName}, members...), ".")
			switch value := recovered.(type) {
			case *sobek.InterruptedError:
				err = fmt.Errorf("plugin %s@%s hook %s inspection interrupted: %v", e.key, e.version, hookName, value.Value())
			case *sobek.Exception:
				err = fmt.Errorf("plugin %s@%s hook %s inspection failed: %v", e.key, e.version, hookName, value)
			default:
				panic(recovered)
			}
		}
	}()
	value, _, found := resolveExportPath(instance, exportName, members)
	if !found {
		return false, nil
	}
	_, callable := sobek.AssertFunction(value)
	return callable, nil
}

// Call invokes one named module export and returns its JSON-compatible value.
func (e *Engine) Call(ctx context.Context, exportName string, args ...any) (result any, err error) {
	return e.call(ctx, 0, exportName, nil, args...)
}

// CallMember invokes a function stored on an exported object, such as a
// renderer in the renderers export.
func (e *Engine) CallMember(ctx context.Context, exportName, memberName string, args ...any) (result any, err error) {
	return e.call(ctx, 0, exportName, []string{memberName}, args...)
}

// CallPath invokes a function nested below an exported object. It is used for
// protocol hooks such as protocols.openai_responses.renderEvents.
func (e *Engine) CallPath(ctx context.Context, exportName string, members []string, args ...any) (result any, err error) {
	return e.call(ctx, 0, exportName, members, args...)
}

// CallPathWithAdmissionTimeout gives long-lived observers a separate bound for
// waiting on JavaScript capacity. Once admitted, the hook receives the
// engine's full execution timeout instead of inheriting time already spent in
// the semaphore queue.
func (e *Engine) CallPathWithAdmissionTimeout(
	ctx context.Context,
	admissionTimeout time.Duration,
	exportName string,
	members []string,
	args ...any,
) (result any, err error) {
	return e.call(ctx, admissionTimeout, exportName, members, args...)
}

func (e *Engine) call(
	ctx context.Context,
	admissionTimeout time.Duration,
	exportName string,
	members []string,
	args ...any,
) (result any, err error) {
	if err = e.acquireCallSlot(ctx, admissionTimeout); err != nil {
		return nil, err
	}
	defer func() { <-e.semaphore }()

	instance, err := e.getRuntime(ctx)
	if err != nil {
		return nil, err
	}
	reusable := true
	defer func() {
		instance.runtime.ClearInterrupt()
		instance.logContext.context = nil
		if reusable {
			e.putRuntime(instance)
		}
	}()

	hookName := strings.Join(append([]string{exportName}, members...), ".")
	timedOut := errors.New("plugin call timed out")
	stopInterrupt := watchRuntimeContext(instance.runtime, ctx, e.timeout, timedOut)
	defer stopInterrupt()
	defer func() {
		if recovered := recover(); recovered != nil {
			reusable = false
			switch value := recovered.(type) {
			case *sobek.InterruptedError:
				err = fmt.Errorf("plugin %s@%s hook %s interrupted: %v", e.key, e.version, hookName, value.Value())
			case *sobek.Exception:
				wrapped := fmt.Errorf("plugin %s@%s hook %s failed: %v", e.key, e.version, hookName, value)
				err = hookErrorFromException(hookName, value, wrapped)
			default:
				panic(recovered)
			}
		}
	}()

	value, resolvedHookName, found := resolveExportPath(instance, exportName, members)
	hookName = resolvedHookName
	if !found {
		if len(members) == 0 {
			return nil, fmt.Errorf("plugin export %q not found", exportName)
		}
		return nil, fmt.Errorf("plugin hook %q not found", hookName)
	}
	if value == nil || sobek.IsUndefined(value) {
		return nil, fmt.Errorf("plugin export %q not found", exportName)
	}
	callable, ok := sobek.AssertFunction(value)
	if !ok {
		return nil, fmt.Errorf("plugin hook %q is not a function", hookName)
	}

	callArgs := make([]sobek.Value, len(args))
	for i, arg := range args {
		callArgs[i] = instance.runtime.ToValue(arg)
	}

	value, err = callable(sobek.Undefined(), callArgs...)
	if err != nil {
		var interrupted *sobek.InterruptedError
		if errors.As(err, &interrupted) {
			reusable = false
			return nil, fmt.Errorf("plugin %s@%s hook %s failed: %w", e.key, e.version, hookName, err)
		}
		wrapped := fmt.Errorf("plugin %s@%s hook %s failed: %w", e.key, e.version, hookName, err)
		var exc *sobek.Exception
		if errors.As(err, &exc) {
			return nil, hookErrorFromException(hookName, exc, wrapped)
		}
		return nil, wrapped
	}
	return value.Export(), nil
}

func (e *Engine) acquireCallSlot(ctx context.Context, admissionTimeout time.Duration) error {
	if admissionTimeout <= 0 {
		select {
		case e.semaphore <- struct{}{}:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	timer := time.NewTimer(admissionTimeout)
	defer timer.Stop()
	select {
	case e.semaphore <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		if err := ctx.Err(); err != nil {
			return err
		}
		return fmt.Errorf("%w: plugin %s@%s", ErrCallAdmissionTimeout, e.key, e.version)
	}
}

func resolveExportPath(instance *runtimeInstance, exportName string, members []string) (sobek.Value, string, bool) {
	value := instance.module.GetBindingValue(exportName)
	hookName := exportName
	if value == nil || sobek.IsUndefined(value) || sobek.IsNull(value) {
		return nil, hookName, false
	}
	for _, member := range members {
		hookName += "." + member
		object := value.ToObject(instance.runtime)
		own := slices.Contains(object.GetOwnPropertyNames(), member)
		if !own {
			return nil, hookName, false
		}
		value = object.Get(member)
		if value == nil || sobek.IsUndefined(value) || sobek.IsNull(value) {
			return nil, hookName, false
		}
	}
	return value, hookName, true
}

// Idle runtimes are bounded by the execution limit and survive GC. Start with
// one instance and grow only when concurrent work actually needs more.
func (e *Engine) putRuntime(instance *runtimeInstance) {
	select {
	case e.pool <- instance:
	default:
	}
}

func (e *Engine) getRuntime(ctx context.Context) (*runtimeInstance, error) {
	select {
	case instance := <-e.pool:
		instance.logContext.context = ctx
		return instance, nil
	default:
		return e.newRuntime(ctx)
	}
}

// A timeout callback must finish before its runtime can be reused. Merely
// stopping a timer does not wait for an already-started Interrupt call.
// watchRuntimeContext 把「调用方 ctx 取消」「超过 timeout」和「堆增量超限」三类
// 中断收敛到同一个 Sobek 中断点上，并返回停表函数。
func watchRuntimeContext(runtime *sobek.Runtime, ctx context.Context, timeout time.Duration, timeoutError error) func() {
	callContext, cancel := context.WithTimeoutCause(ctx, timeout, timeoutError)
	interrupted := make(chan struct{})
	stop := context.AfterFunc(callContext, func() {
		runtime.Interrupt(context.Cause(callContext))
		close(interrupted)
	})
	stopMemoryWatch := watchRuntimeHeap(runtime, callContext)
	return func() {
		stopMemoryWatch()
		if !stop() {
			<-interrupted
		}
		cancel()
	}
}

// watchRuntimeHeap 在调用窗口内周期性采样堆增量，越限即中断运行时。
//
// 与超时看门狗共用 runtime.Interrupt：Sobek 的中断是协作式的，JS 引擎会在下一个
// 可中断点抛出 InterruptedError，随后调用点的 recover 把它转成普通错误——因此
// 插件既不会崩进程，也拿不到「继续跑完」的余地。
//
// 采到越限后立即 return：本次调用已被中断，继续采样没有意义；而下一次调用会重新
// 建立自己的看门狗和基准值。
func watchRuntimeHeap(runtime *sobek.Runtime, ctx context.Context) func() {
	var before goruntime.MemStats
	goruntime.ReadMemStats(&before)

	stop := make(chan struct{})
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(memoryWatchInterval)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				return
			case <-ctx.Done():
				return
			case <-ticker.C:
				var current goruntime.MemStats
				goruntime.ReadMemStats(&current)
				// HeapAlloc 是不触发 GC 的当前堆占用，读它才能看到「尚未被回收的
				// 垃圾」——那正是瞬时爆炸的信号；HeapInuse 会因为 GC 而滞后。
				//
				// 必须做饱和减法而不是直接相减：HeapAlloc 是 uint64，GC 一旦回收
				// 掉本调用自己产生的垃圾，current 可能小于 before，直接相减会回绕成
				// 接近 2^64 的天文数字，把一次正常的 GC 误判成堆爆炸并中断调用。
				delta := uint64(0)
				if current.HeapAlloc > before.HeapAlloc {
					delta = current.HeapAlloc - before.HeapAlloc
				}
				if delta > DefaultHeapLimitBytes {
					logger.LogWarn(ctx, "task_plugin subsystem=runtime event=heap_limit_exceeded limit_bytes=%d delta_bytes=%d",
						DefaultHeapLimitBytes, delta)
					runtime.Interrupt(ErrHeapLimitExceeded)
					return
				}
			}
		}
	}()
	return func() {
		close(stop)
		<-done
	}
}

// ErrHeapLimitExceeded 表示插件执行期间的堆增量超过了允许上限。
var ErrHeapLimitExceeded = errors.New("plugin heap limit exceeded")

func (e *Engine) newRuntime(ctx context.Context) (instance *runtimeInstance, err error) {
	runtime := sobek.New()
	logContext := &runtimeLogContext{context: ctx}
	logOutput := e.log
	if logOutput == nil {
		logOutput = func(message string) {
			logger.LogDebug(logContext.context, "task_plugin subsystem=runtime event=console message=%q", message)
		}
	}
	if err := injectGlobals(runtime, func() string {
		return fmt.Sprintf("[plugin:%s@%s]", e.key, e.version)
	}, e.now, logOutput); err != nil {
		return nil, fmt.Errorf("inject plugin utils: %w", err)
	}
	timedOut := errors.New("plugin initialization timed out")
	stopInterrupt := watchRuntimeContext(runtime, ctx, e.timeout, timedOut)
	defer func() {
		stopInterrupt()
		runtime.ClearInterrupt()
	}()
	defer func() {
		if recovered := recover(); recovered != nil {
			if interrupted, ok := recovered.(*sobek.InterruptedError); ok {
				instance = nil
				err = fmt.Errorf("initialize plugin %s@%s: %v", e.key, e.version, interrupted.Value())
				return
			}
			panic(recovered)
		}
	}()
	promise := runtime.CyclicModuleRecordEvaluate(e.module, func(_ any, specifier string) (sobek.ModuleRecord, error) {
		return nil, fmt.Errorf("plugin imports are disabled: %s", specifier)
	})
	if promise.State() != sobek.PromiseStateFulfilled {
		return nil, fmt.Errorf("evaluate plugin: %v", promise.Result().Export())
	}
	return &runtimeInstance{
		runtime:    runtime,
		module:     runtime.GetModuleInstance(e.module),
		logContext: logContext,
	}, nil
}

func sourceWithoutCommentsAndStrings(source string) string {
	var output strings.Builder
	output.Grow(len(source))
	quote := byte(0)
	escaped := false
	lineComment := false
	blockComment := false
	for i := 0; i < len(source); i++ {
		current := source[i]
		next := byte(0)
		if i+1 < len(source) {
			next = source[i+1]
		}
		if lineComment {
			if current == '\n' {
				lineComment = false
				output.WriteByte('\n')
			} else {
				output.WriteByte(' ')
			}
			continue
		}
		if blockComment {
			if current == '*' && next == '/' {
				blockComment = false
				output.WriteString("  ")
				i++
			} else {
				output.WriteByte(' ')
			}
			continue
		}
		if quote != 0 {
			output.WriteByte(' ')
			if escaped {
				escaped = false
			} else if current == '\\' {
				escaped = true
			} else if current == quote {
				quote = 0
			}
			continue
		}
		if current == '/' && next == '/' {
			lineComment = true
			output.WriteString("  ")
			i++
			continue
		}
		if current == '/' && next == '*' {
			blockComment = true
			output.WriteString("  ")
			i++
			continue
		}
		if current == '\'' || current == '"' || current == '`' {
			quote = current
			output.WriteByte(' ')
			continue
		}
		output.WriteByte(current)
	}
	return output.String()
}
