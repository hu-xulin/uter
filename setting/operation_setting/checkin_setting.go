package operation_setting

import (
	"fmt"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/setting/config"
)

// CheckinSetting 签到功能配置
type CheckinSetting struct {
	Enabled  bool `json:"enabled"`   // 是否启用签到功能
	MinQuota int  `json:"min_quota"` // 签到最小额度奖励
	MaxQuota int  `json:"max_quota"` // 签到最大额度奖励
}

// 默认配置
var checkinSetting = CheckinSetting{
	Enabled:  false, // 默认关闭
	MinQuota: 1000,  // 默认最小额度 1000 (约 0.002 USD)
	MaxQuota: 10000, // 默认最大额度 10000 (约 0.02 USD)
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("checkin_setting", &checkinSetting)
}

// GetCheckinSetting 获取签到配置
func GetCheckinSetting() *CheckinSetting {
	return &checkinSetting
}

// IsCheckinEnabled 是否启用签到功能
func IsCheckinEnabled() bool {
	return checkinSetting.Enabled
}

// GetCheckinQuotaRange 获取签到额度范围
func GetCheckinQuotaRange() (min, max int) {
	return checkinSetting.MinQuota, checkinSetting.MaxQuota
}

// ValidateCheckinQuotaRange 校验签到奖励区间。
//
// 发放逻辑是「在 [min, max] 内取随机整数」。区间本身不自洽时，旧实现会静默降级：
//   - max < min     → 只发 min，实际发放突破运营设定的上限；
//   - min = max = 0 → 签到成功但发 0 额度，用户白白消耗当天机会；
//   - min < 0       → 事务路径把负数直接加到余额上，等价于扣款。
//
// 因此把区间当成硬约束校验：非负、max ≥ min、max > 0、且不超过钱包上限。
func ValidateCheckinQuotaRange(minQuota, maxQuota int) error {
	if minQuota < 0 || maxQuota < 0 {
		return fmt.Errorf("check-in quota must not be negative (min=%d, max=%d)", minQuota, maxQuota)
	}
	if maxQuota < minQuota {
		return fmt.Errorf("check-in max quota (%d) must not be less than min quota (%d)", maxQuota, minQuota)
	}
	if maxQuota == 0 {
		return fmt.Errorf("check-in quota range must award a positive amount (min=%d, max=%d)", minQuota, maxQuota)
	}
	if maxQuota > common.MaxWalletQuota {
		return fmt.Errorf("check-in max quota (%d) exceeds the wallet limit (%d)", maxQuota, common.MaxWalletQuota)
	}
	return nil
}

// CurrentCheckinQuotaRange 返回并校验当前配置；配置非法时返回错误而不是照旧发放。
func CurrentCheckinQuotaRange() (min, max int, err error) {
	min, max = GetCheckinQuotaRange()
	if err := ValidateCheckinQuotaRange(min, max); err != nil {
		return 0, 0, err
	}
	return min, max, nil
}
