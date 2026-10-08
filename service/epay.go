package service

import (
	"github.com/uter-ai/uter/setting/operation_setting"

	"github.com/uter-ai/uter/setting/system_setting"
)

func GetCallbackAddress() string {
	if operation_setting.CustomCallbackAddress == "" {
		return system_setting.ServerAddress
	}
	return operation_setting.CustomCallbackAddress
}
