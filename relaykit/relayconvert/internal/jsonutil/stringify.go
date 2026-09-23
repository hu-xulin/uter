package jsonutil

import (
	"fmt"

	kitutil "https://github.com/Uter-AI/Uter/relaykit/relayconvert/kitutil"
)

func ToJSONString(v interface{}) string {
	bytes, err := kitutil.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	return string(bytes)
}
