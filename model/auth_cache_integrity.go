package model

import (
	"crypto/hmac"
	"errors"
	"time"

	"github.com/uter-ai/uter/common"
)

// authCacheMAC binds cache metadata to its purpose and Redis key. Only
// database snapshots or server-created session states may be signed.
func authCacheMAC(key string, metadata any) (string, error) {
	payload, err := common.Marshal(metadata)
	if err != nil {
		return "", err
	}
	return common.GenerateHMACWithKey([]byte("auth-cache-v1:"+common.CryptoSecret), key+"\x00"+string(payload)), nil
}

// validAuthCacheMAC reports whether the stored signature matches the expected
// one. A positive expiresAt must still be in the future; zero means the cache
// entry carries no expiry of its own and only the signature decides.
func validAuthCacheMAC(expected, actual string, expiresAt int64) bool {
	if expiresAt > 0 && expiresAt <= time.Now().UnixMilli() {
		return false
	}
	return hmac.Equal([]byte(expected), []byte(actual))
}

// userCacheMACPayload binds the cache signature to the fields that decide what
// the entry grants. A tampered entry fails the check instead of being served.
//
// Only fields that change together with the authentication version are
// signed. Group, email, username and setting are updated in place without a
// version change, so signing them would fail the check on a legitimate
// refresh.
type userCacheMACPayload struct {
	Id             int    `json:"id"`
	Status         int    `json:"status"`
	Role           int    `json:"role"`
	AuthVersion    int64  `json:"auth_version"`
	OrganizationId int    `json:"organization_id"`
	DepartmentId   int    `json:"department_id"`
	OrgRole        string `json:"org_role"`
	CacheExpiresAt int64  `json:"cache_expires_at"`
}

// userCacheMAC signs the cache entry of a user under its own cache key.
func userCacheMAC(user *UserBase) (string, error) {
	if user == nil {
		return "", errors.New("user cache signature needs a user")
	}
	return authCacheMAC(getUserCacheKey(user.Id), userCacheMACPayload{
		Id:             user.Id,
		Status:         user.Status,
		Role:           user.Role,
		AuthVersion:    user.AuthVersion,
		OrganizationId: user.OrganizationId,
		DepartmentId:   user.DepartmentId,
		OrgRole:        user.OrgRole,
		CacheExpiresAt: user.CacheExpiresAt,
	})
}
