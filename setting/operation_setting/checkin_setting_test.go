package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/uter-ai/uter/common"
)

// TestValidateCheckinQuotaRange 锁住签到奖励区间的合法性。
//
// 区间不自洽时旧实现不会报错，而是静默降级成「按 min 发放」或「发 0」：
// max < min 会让实际发放突破运营设定的上限，min < 0 在事务路径上等于扣款。
func TestValidateCheckinQuotaRange(t *testing.T) {
	cases := []struct {
		name     string
		minQuota int
		maxQuota int
		wantErr  bool
	}{
		{name: "normal range", minQuota: 50000, maxQuota: 250000},
		{name: "equal bounds is a fixed reward", minQuota: 1000, maxQuota: 1000},
		{name: "min zero with positive max", minQuota: 0, maxQuota: 100},
		{name: "max below min", minQuota: 5000, maxQuota: 1000, wantErr: true},
		{name: "both zero awards nothing", minQuota: 0, maxQuota: 0, wantErr: true},
		{name: "negative min", minQuota: -1, maxQuota: 100, wantErr: true},
		{name: "negative max", minQuota: 0, maxQuota: -1, wantErr: true},
		{name: "max above wallet limit", minQuota: 0, maxQuota: common.MaxWalletQuota + 1, wantErr: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateCheckinQuotaRange(tc.minQuota, tc.maxQuota)
			if tc.wantErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
		})
	}
}

// TestCurrentCheckinQuotaRangeFailsClosed 验证读取当前配置时非法值返回错误而不是放行。
func TestCurrentCheckinQuotaRangeFailsClosed(t *testing.T) {
	setting := GetCheckinSetting()
	old := *setting
	t.Cleanup(func() { *setting = old })

	setting.MinQuota = 9000
	setting.MaxQuota = 1000
	_, _, err := CurrentCheckinQuotaRange()
	assert.Error(t, err, "misconfigured range must not be silently accepted")

	setting.MinQuota = 1000
	setting.MaxQuota = 9000
	minQuota, maxQuota, err := CurrentCheckinQuotaRange()
	assert.NoError(t, err)
	assert.Equal(t, 1000, minQuota)
	assert.Equal(t, 9000, maxQuota)
}
