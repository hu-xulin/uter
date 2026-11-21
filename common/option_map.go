package common

// GetOption returns the current in-memory value of an option. Reads must go
// through this helper: OptionMap is written by UpdateOption under
// OptionMapRWMutex, and an unsynchronized read races with those writes
// (observed as a fatal "concurrent map read and map write" during scheduled
// upstream syncs).
func GetOption(key string) string {
	OptionMapRWMutex.RLock()
	defer OptionMapRWMutex.RUnlock()
	if OptionMap == nil {
		return ""
	}
	return OptionMap[key]
}
