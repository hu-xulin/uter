package model

import (
	"errors"

	"github.com/uter-ai/uter/common"
)

// ErrChannelOtherInfoBusy reports a channel whose other_info other writers
// kept changing through every attempt of UpdateChannelOtherInfo.
var ErrChannelOtherInfoBusy = errors.New("channel other_info kept changing during the update")

const channelOtherInfoAttempts = 5

// UpdateChannelOtherInfo runs update on the stored channel and writes the
// other_info it leaves, with the columns update returns, only while the
// stored other_info is still the one read. When another writer, on any node,
// changed it in between, the channel is read again and update runs on that,
// so neither change is lost: update may run more than once and must not wait
// on the network. It returns nil to write nothing, and written reports a
// write. Only the returned columns and other_info are written, so a stale
// read never puts back the key, counters or settings. On SQLite, which serves
// one node, the channel's key lock also keeps the locked updates of this
// process out.
func UpdateChannelOtherInfo(channelID int, update func(channel *Channel) (map[string]any, error)) (written bool, err error) {
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		lock := sqliteChannelKeyLock(channelID)
		lock.Lock()
		defer lock.Unlock()
	}
	for range channelOtherInfoAttempts {
		var channel Channel
		if err := DB.First(&channel, "id = ?", channelID).Error; err != nil {
			return false, err
		}
		read := channel.OtherInfo
		updates, err := update(&channel)
		if err != nil || updates == nil {
			return false, err
		}
		updates["other_info"] = channel.OtherInfo
		query := DB.Model(&Channel{}).Where("id = ?", channelID)
		if read == "" {
			query = query.Where("(other_info IS NULL OR other_info = ?)", "")
		} else {
			query = query.Where("other_info = ?", read)
		}
		result := query.Updates(updates)
		if result.Error != nil {
			return false, result.Error
		}
		if result.RowsAffected > 0 {
			return true, nil
		}
		// MySQL counts changed rows only: when other_info is still the one
		// read, the row matched and already held every value written.
		if common.UsingMainDatabase(common.DatabaseTypeMySQL) && channel.OtherInfo == read {
			var stored Channel
			if err := DB.Select("other_info").First(&stored, "id = ?", channelID).Error; err != nil {
				return false, err
			}
			if stored.OtherInfo == read {
				return true, nil
			}
		}
	}
	return false, ErrChannelOtherInfoBusy
}
