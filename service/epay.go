package service

import (
	"github.com/Uter-AI/Uter/setting/operation_setting"

	"github.com/Uter-AI/Uter/setting/system_setting"
)

func GetCallbackAddress() string {
	if operation_setting.CustomCallbackAddress == "" {
		return system_setting.ServerAddress
	}
	return operation_setting.CustomCallbackAddress
}
