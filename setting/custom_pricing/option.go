package custom_pricing

import (
	"strings"
	"sync"

	"github.com/Uter-AI/Uter/common"
)

// Option keys persisted as JSON strings through the generic option API.
// These are intentionally plain options (not config.GlobalConfig members) so
// the frontend can PATCH them with /api/option/<key> like every other
// platform setting.
const (
	ChannelPriceOptionKey = "ChannelPriceSetting"
	UserPriceOptionKey    = "UserPriceSetting"
)

// optionValue reads an option under the option-map lock. Returns "" when unset.
func optionValue(key string) string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return common.OptionMap[key]
}

// parsedSetting caches a decoded option value keyed by its raw JSON string so
// re-parsing only happens after an admin edits the setting.
type parsedSetting[T any] struct {
	mu      sync.RWMutex
	raw     string
	decoded *T
}

func (p *parsedSetting[T]) get(key string) *T {
	raw := strings.TrimSpace(optionValue(key))
	p.mu.RLock()
	if p.raw == raw {
		cached := p.decoded
		p.mu.RUnlock()
		return cached
	}
	p.mu.RUnlock()

	p.mu.Lock()
	defer p.mu.Unlock()
	if p.raw != raw {
		p.raw = raw
		p.decoded = nil
		if raw != "" {
			decoded := new(T)
			if err := common.UnmarshalJsonStr(raw, decoded); err != nil {
				common.SysError("failed to parse option " + key + ": " + err.Error())
			} else {
				p.decoded = decoded
			}
		}
	}
	return p.decoded
}
