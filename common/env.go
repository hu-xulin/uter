package common

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

func GetEnvOrDefault(env string, defaultValue int) int {
	if env == "" || os.Getenv(env) == "" {
		return defaultValue
	}
	num, err := strconv.Atoi(os.Getenv(env))
	if err != nil {
		SysError(fmt.Sprintf("failed to parse %s: %s, using default value: %d", env, err.Error(), defaultValue))
		return defaultValue
	}
	return num
}

func GetEnvOrDefaultString(env string, defaultValue string) string {
	if env == "" || os.Getenv(env) == "" {
		return defaultValue
	}
	return os.Getenv(env)
}

func GetEnvOrDefaultBool(env string, defaultValue bool) bool {
	if env == "" || os.Getenv(env) == "" {
		return defaultValue
	}
	b, err := strconv.ParseBool(os.Getenv(env))
	if err != nil {
		SysError(fmt.Sprintf("failed to parse %s: %s, using default value: %t", env, err.Error(), defaultValue))
		return defaultValue
	}
	return b
}

// GetEnvOrDefaultIntList 解析形如 "1,2,3" 的整数列表环境变量。
//
// 与其它 GetEnv* 辅助函数不同，单项解析失败只跳过该项并记日志，不会整体回退到默认值：
// 列表类配置（如组织白名单）里单个笔误不应让其余正确条目一并失效。
func GetEnvOrDefaultIntList(env string, defaultValue []int) []int {
	raw := strings.TrimSpace(os.Getenv(env))
	if env == "" || raw == "" {
		return defaultValue
	}
	parts := strings.Split(raw, ",")
	values := make([]int, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item == "" {
			continue
		}
		value, err := strconv.Atoi(item)
		if err != nil {
			SysError(fmt.Sprintf("failed to parse %s item %q: %s (item skipped)", env, item, err.Error()))
			continue
		}
		values = append(values, value)
	}
	if len(values) == 0 {
		return defaultValue
	}
	return values
}
