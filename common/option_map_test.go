package common

import (
	"strconv"
	"sync"
	"testing"
)

// OptionMap is mutated by UpdateOption while background tasks read it. An
// unsynchronized read caused a fatal "concurrent map read and map write" in
// the scheduled upstream sync loop, so GetOption must stay safe under
// concurrent writes. Run with -race to verify the invariant.
func TestGetOptionConcurrentWithWrites(t *testing.T) {
	OptionMapRWMutex.Lock()
	previous := OptionMap
	OptionMap = map[string]string{"key": "0"}
	OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		OptionMapRWMutex.Lock()
		OptionMap = previous
		OptionMapRWMutex.Unlock()
	})

	var wg sync.WaitGroup
	wg.Go(func() {
		for i := range 5000 {
			OptionMapRWMutex.Lock()
			OptionMap["key"] = strconv.Itoa(i)
			OptionMapRWMutex.Unlock()
		}
	})
	for range 4 {
		wg.Go(func() {
			for range 5000 {
				_ = GetOption("key")
				_ = GetOption("missing")
			}
		})
	}
	wg.Wait()

	if got := GetOption("key"); got == "" {
		t.Fatalf("expected the last written value, got empty string")
	}
}
