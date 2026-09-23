package service

import (
	"strings"

	"https://github.com/Uter-AI/Uter/setting/system_setting"
)

func PaymentReturnURL(suffix string) string {
	base := strings.TrimRight(system_setting.ServerAddress, "/")
	return base + suffix
}
