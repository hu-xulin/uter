package common

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type verificationValue struct {
	code string
	time time.Time
}

const (
	EmailVerificationPurpose = "v"
	PasswordResetPurpose     = "r"
)

var verificationMutex sync.Mutex
var verificationMap map[string]verificationValue
var verificationMapMaxSize = 10
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
	if len(verificationMap) > verificationMapMaxSize {
		removeExpiredPairs()
	}
}

func VerifyCodeWithKey(key string, code string, purpose string) bool {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	value, okay := verificationMap[purpose+key]
	now := time.Now()
	if !okay || int(now.Sub(value.time).Seconds()) >= VerificationValidMinutes*60 {
		return false
	}
	return code == value.code
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

func init() {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	verificationMap = make(map[string]verificationValue)
}
