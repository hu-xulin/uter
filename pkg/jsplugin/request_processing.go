package jsplugin

import (
	"errors"
	"fmt"
	"strings"
)

// errCallTimeout mirrors the engine's timed-out call error for config validators,
// which render a short finding instead of the raw engine error.
var errCallTimeout = errors.New("plugin call timed out")

// truncateRunes keeps at most limit runes of text, appending an ellipsis when
// it cuts. Config validation findings are capped with it.

// decodeLocalizedText reads a string or locale object as LocalizedText;
// subject names it in errors. Config schemas use it for titles and
// descriptions.
func decodeLocalizedText(value any, subject string, maxRunes int) (LocalizedText, error) {
	var text LocalizedText
	switch typed := value.(type) {
	case string:
		text = LocalizedText{"en": typed}
	case map[string]any:
		text = make(LocalizedText, len(typed))
		for locale, raw := range typed {
			item, ok := raw.(string)
			if !ok {
				return nil, fmt.Errorf("%s locale %q must be a string", subject, locale)
			}
			text[locale] = item
		}
	default:
		return nil, fmt.Errorf("%s must be a string or object", subject)
	}
	if err := validateLocalizedText(text, strings.TrimPrefix(subject, "plugin meta "), maxRunes); err != nil {
		return nil, err
	}
	return text, nil
}
