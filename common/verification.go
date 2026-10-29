package common

import (
	"crypto/rand"
	"crypto/subtle"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type verificationValue struct {
	code     string
	time     time.Time
	failures int
}

const (
	EmailVerificationPurpose = "v"
	PasswordResetPurpose     = "r"
	// LoginEmailCodePurpose 用于「邮箱验证码登录」。与注册验证（"v"）、
	// 密码重置（"r"）共用同一套验证码存储与生命周期（10 分钟有效、单次
	// 使用、5 次失败作废），但 purpose 隔离 —— 一个用途拿到的码不能在
	// 另一个用途里兑换。
	LoginEmailCodePurpose = "l"

	// 单个验证码的最大尝试次数，超过即作废（防爆破）
	maxVerificationAttempts = 5
)

var verificationMutex sync.Mutex
var verificationMap map[string]verificationValue
var verificationMapMaxSize = 100
var VerificationValidMinutes = 10

func GenerateVerificationCode(length int) string {
	code := uuid.New().String()
	code = strings.Replace(code, "-", "", -1)
	if length == 0 {
		return code
	}
	return code[:length]
}

// GenerateNumericCode returns a cryptographically random code made of exactly
// length digits, keeping leading zeros (e.g. "000123" for length 6).
//
// It exists because GenerateVerificationCode slices a UUID hex string and
// therefore emits hexadecimal letters; user-facing codes must be typeable on a
// numeric keypad and must not be confusable ("0"/"O", "1"/"l"). This function
// is only meant for short human-entered codes - never use it for tokens,
// secrets or generated passwords, whose entropy must stay much higher.
func GenerateNumericCode(length int) (string, error) {
	if length <= 0 {
		return "", fmt.Errorf("invalid verification code length: %d", length)
	}
	limit := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(length)), nil)
	number, err := rand.Int(rand.Reader, limit)
	if err != nil {
		return "", fmt.Errorf("failed to generate verification code: %w", err)
	}
	// number.Text(10) never pads, so very small draws keep their leading zeros.
	code := number.Text(10)
	if missing := length - len(code); missing > 0 {
		code = strings.Repeat("0", missing) + code
	}
	return code, nil
}

func RegisterVerificationCodeWithKey(key string, code string, purpose string) {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	verificationMap[purpose+key] = verificationValue{
		code: code,
		time: time.Now(),
	}
	// 超过上限时淘汰最旧条目，避免进程内无限堆积（内存放大面）
	if len(verificationMap) > verificationMapMaxSize {
		evictOldestPairs(len(verificationMap) - verificationMapMaxSize)
	}
}

// VerifyCodeWithKey 校验验证码：
//   - 成功即作废（单次使用），杜绝 10 分钟内无限复用
//   - 使用常量时间比较，避免时序侧信道
//   - 同一 key 失败达到上限即作废，防爆破
func VerifyCodeWithKey(key string, code string, purpose string) bool {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	mapKey := purpose + key
	value, okay := verificationMap[mapKey]
	now := time.Now()
	if !okay || int(now.Sub(value.time).Seconds()) >= VerificationValidMinutes*60 {
		return false
	}
	if subtle.ConstantTimeCompare([]byte(code), []byte(value.code)) == 1 {
		delete(verificationMap, mapKey) // 单次使用
		return true
	}
	value.failures++
	if value.failures >= maxVerificationAttempts {
		delete(verificationMap, mapKey)
	} else {
		verificationMap[mapKey] = value
	}
	return false
}

func DeleteKey(key string, purpose string) {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	delete(verificationMap, purpose+key)
}

// no lock inside, so the caller must lock the verificationMap before calling!
func removeExpiredPairs() {
	now := time.Now()
	for key := range verificationMap {
		if int(now.Sub(verificationMap[key].time).Seconds()) >= VerificationValidMinutes*60 {
			delete(verificationMap, key)
		}
	}
}

// evictOldestPairs removes the n oldest verification entries (by creation time)
// to keep the in-memory map bounded. Caller must hold verificationMutex.
func evictOldestPairs(n int) {
	if n <= 0 {
		return
	}
	type kv struct {
		key string
		t   time.Time
	}
	entries := make([]kv, 0, len(verificationMap))
	for k, v := range verificationMap {
		entries = append(entries, kv{k, v.time})
	}
	// 简单的插入排序取最旧 n 个（map 规模很小，无需 heap）
	for i := 1; i < len(entries); i++ {
		for j := i; j > 0 && entries[j].t.Before(entries[j-1].t); j-- {
			entries[j], entries[j-1] = entries[j-1], entries[j]
		}
	}
	for i := 0; i < n && i < len(entries); i++ {
		delete(verificationMap, entries[i].key)
	}
}

func init() {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	verificationMap = make(map[string]verificationValue)
}
