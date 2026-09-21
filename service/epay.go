package service

import (
	"github.com/QuantumNous/uter/setting/operation_setting"
	"github.com/QuantumNous/uter/setting/system_setting"
)

func GetCallbackAddress() string {
	if operation_setting.CustomCallbackAddress == "" {
		return system_setting.ServerAddress
	}
	return operation_setting.CustomCallbackAddress
}
