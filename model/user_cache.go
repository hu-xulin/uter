package model

import (
	"errors"
	"fmt"
	"sync"

	"github.com/bytedance/gopkg/util/gopool"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/relaykit/dto"

	"github.com/gin-gonic/gin"
	"golang.org/x/sync/singleflight"
)

// cacheSyncBarrier 记录在途的「异步缓存同步」协程数量。
//
// 缓存同步是 fire-and-forget 的：调用方提交事务后立刻返回，协程里再读
// common.RedisEnabled / common.RDB 决定是否写 Redis。生产环境这两个变量只在启动
// 时写一次，没问题；但测试会临时把它们指向 miniredis 再改回原值，于是「测试
// cleanup 写 vs 协程读」构成数据竞争（go test -race 必现）。登记到这个屏障上，
// 测试就能在改动全局量之前等所有在途同步落定。
var cacheSyncBarrier sync.WaitGroup

// runCacheSync 把一次缓存同步交给后台协程，并登记到 cacheSyncBarrier。
// 语义与原 gopool.Go 完全一致（异步、不阻塞调用方），只是让协程可被等待。
func runCacheSync(fn func()) {
	cacheSyncBarrier.Add(1)
	gopool.Go(func() {
		defer cacheSyncBarrier.Done()
		fn()
	})
}

// WaitCacheSyncForTest 阻塞到所有在途缓存同步协程结束。
//
// 仅供测试使用：测试在改动 common.RedisEnabled / common.RDB 前后各调用一次，
// 避免与仍在运行的同步协程相撞。生产代码不要调用——它会抹掉「异步」的意义。
func WaitCacheSyncForTest() {
	cacheSyncBarrier.Wait()
}

// 版本 3：新增 DepartmentName。部门管理员的数据可见范围按部门【名称】判定
// （department_id 列已废弃、从不写入），旧哈希缺少该字段会让部门范围失效，
// 因此必须让旧版本哈希整体失效并重新水合。
const userCacheSchemaVersion = 3

type UserBase struct {
	Id             int    `json:"id"`
	Group          string `json:"group"`
	Email          string `json:"email"`
	Quota          int    `json:"quota"`
	Status         int    `json:"status"`
	Role           int    `json:"role"`
	Username       string `json:"username"`
	Setting        string `json:"setting"`
	OrganizationId int    `json:"organization_id"`
	DepartmentId   int    `json:"department_id"`
	DepartmentName string `json:"department_name"`
	OrgRole        string `json:"org_role"`
	UsedQuota      int    `json:"used_quota"`
	SubQuotaLimit  int64  `json:"sub_quota_limit"`
	AuthVersion    int64  `json:"-"`
	CacheSchema    int    `json:"-"`
}

func (user *UserBase) WriteContext(c *gin.Context) {
	common.SetContextKey(c, constant.ContextKeyUserGroup, user.Group)
	common.SetContextKey(c, constant.ContextKeyUserQuota, user.Quota)
	common.SetContextKey(c, constant.ContextKeyUserStatus, user.Status)
	common.SetContextKey(c, constant.ContextKeyUserEmail, user.Email)
	common.SetContextKey(c, constant.ContextKeyUserName, user.Username)
	common.SetContextKey(c, constant.ContextKeyUserSetting, user.GetSetting())
	c.Set("organization_id", user.OrganizationId)
	c.Set("department_id", user.DepartmentId)
	c.Set("department_name", user.DepartmentName)
	c.Set("org_role", user.OrgRole)
}

func (user *UserBase) GetSetting() dto.UserSetting {
	setting := dto.UserSetting{}
	if user.Setting != "" {
		err := common.Unmarshal([]byte(user.Setting), &setting)
		if err != nil {
			common.SysLog("failed to unmarshal setting: " + err.Error())
		}
	}
	return setting
}

// getUserCacheKey returns the key for user cache
func getUserCacheKey(userId int) string {
	return fmt.Sprintf("user:%d", userId)
}

func userCacheTTLSeconds() int {
	ttl := common.RedisKeyCacheSeconds()
	if ttl <= 0 {
		return 60
	}
	return ttl
}

// invalidateUserCache clears user cache
func invalidateUserCache(userId int) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisDelKey(getUserCacheKey(userId))
}

func populateUserCache(user User) error {
	if !common.RedisEnabled {
		return nil
	}
	return writeUserCache(user.ToBaseUser(), true)
}

// updateUserCache refreshes non-quota user cache fields.
// Quota is maintained by atomic quota delta paths and must not be overwritten
// by stale user snapshots from profile/settings updates.
func updateUserCache(user User) error {
	if !common.RedisEnabled {
		return nil
	}
	return writeUserCache(user.ToBaseUser(), false)
}

// userCacheMissGroup 合并并发的缓存未命中回源。
//
// Redis 集体过期（或被批量失效）的瞬间，同一用户的并发请求会同时穿透到
// GetUserById。列表页一次可涉及上百个不同 user_id，若不加合并就是上百次
// users 表查询；单个高频用户的并发穿透同样会被放大成同等量级的查库。
var userCacheMissGroup singleflight.Group

// GetUserCache gets complete user cache from hash
func GetUserCache(userId int) (*UserBase, error) {
	// Try getting from Redis first
	userCache, err := cacheGetUserBase(userId)
	if err == nil {
		return userCache, nil
	}

	// Redis misses and read failures both fall back to the shared database. A
	// version fence newer than the database is the one exception: allowing that
	// snapshot would re-authorize a user while a restrictive update is pending.
	// 同一 userId 的并发未命中只放一个请求回源，其余等待并复用其结果。
	key := fmt.Sprintf("%d", userId)
	loaded, err, _ := userCacheMissGroup.Do(key, func() (any, error) {
		// 等锁期间缓存可能已被别的请求填好，先复查一次。
		if cached, cacheErr := cacheGetUserBase(userId); cacheErr == nil {
			return cached, nil
		}
		return loadUserCacheFromDB(userId)
	})
	if err != nil {
		return nil, err
	}
	return loaded.(*UserBase), nil
}

// loadUserCacheFromDB 回源数据库并顺带水合缓存，是缓存未命中时的唯一落库路径。
func loadUserCacheFromDB(userId int) (*UserBase, error) {
	user, err := GetUserById(userId, false)
	if err != nil {
		return nil, err
	}
	if common.RedisEnabled {
		floor, floorErr := getUserAuthVersionFloor(userId)
		if floorErr == nil && floor > user.AuthVersion {
			return nil, ErrUserAuthCachePending
		}
		if err := populateUserCache(*user); err != nil {
			if errors.Is(err, ErrUserAuthCachePending) {
				return nil, err
			}
			common.SysLog("failed to synchronously populate user cache: " + err.Error())
		}
	}
	return user.ToBaseUser(), nil
}

func cacheGetUserBase(userId int) (*UserBase, error) {
	if !common.RedisEnabled {
		return nil, fmt.Errorf("redis is not enabled")
	}
	var userCache UserBase
	// Try getting from Redis first
	err := common.RedisHGetObj(getUserCacheKey(userId), &userCache)
	if err != nil {
		return nil, err
	}
	if userCache.Id != userId || userCache.CacheSchema != userCacheSchemaVersion || userCache.AuthVersion <= 0 {
		return nil, fmt.Errorf("user cache schema is stale")
	}
	floor, err := getUserAuthVersionFloor(userId)
	if err != nil {
		return nil, err
	}
	if floor > userCache.AuthVersion {
		return nil, ErrUserAuthCachePending
	}
	return &userCache, nil
}

// GetUserCaches 批量取用户基础信息，返回 userId -> *UserBase。
//
// 列表页一页最多 100 条记录，逐个 GetUserCache 在 Redis 集体过期瞬间会打
// 100 次 users 表。这里先各自命中缓存，未命中的合并成一次 WHERE id IN ? 回源，
// 把「一页 100 次查库」压成「最多 1 次查库」。
//
// 单个用户的读取语义（含 auth version fence 校验）与 GetUserCache 一致；
// 取不到的用户不会出现在返回 map 中，调用方按缺省处理即可。
func GetUserCaches(userIds []int) map[int]*UserBase {
	result := make(map[int]*UserBase, len(userIds))
	if len(userIds) == 0 {
		return result
	}
	missing := make([]int, 0, len(userIds))
	for _, userId := range userIds {
		if userId <= 0 {
			continue
		}
		if cached, err := cacheGetUserBase(userId); err == nil {
			result[userId] = cached
			continue
		}
		missing = append(missing, userId)
	}
	if len(missing) == 0 {
		return result
	}

	var users []User
	if err := DB.Omit("password", "access_token").Where("id IN ?", missing).Find(&users).Error; err != nil {
		common.SysLog("failed to batch load users: " + err.Error())
		return result
	}
	for _, user := range users {
		if common.RedisEnabled {
			floor, floorErr := getUserAuthVersionFloor(user.Id)
			if floorErr == nil && floor > user.AuthVersion {
				// 限制性更新在途：宁可让调用方拿不到，也不要用旧快照重新授权。
				continue
			}
			if err := populateUserCache(user); err != nil && !errors.Is(err, ErrUserAuthCachePending) {
				common.SysLog("failed to synchronously populate user cache: " + err.Error())
			}
		}
		result[user.Id] = user.ToBaseUser()
	}
	return result
}

// Add atomic quota operations using hash fields.
// 通过守卫式 Lua 脚本执行：哈希不存在时直接跳过（下次读取会从数据库水合），
// 不会像裸 HINCRBY 那样创建只含 Quota 字段的残缺哈希。
func cacheIncrUserQuota(userId int, delta int64) error {
	if !common.RedisEnabled {
		return nil
	}
	_, err := cacheApplyUserQuotaDelta(userId, delta)
	return err
}

func cacheDecrUserQuota(userId int, delta int64) error {
	return cacheIncrUserQuota(userId, -delta)
}

// syncCreditUserQuotaCache 在授信事务（充值/兑换等）提交后同步把增量补进缓存
// 余额。预扣以缓存值为准（存在期间），授信不能绕过它，否则新到账的额度在
// 缓存过期前不可用；缓存未命中无需处理，下次读取会从已提交的数据库余额水合。
func syncCreditUserQuotaCache(userId int, quota int, operation string) {
	if quota <= 0 {
		return
	}
	if err := cacheIncrUserQuota(userId, int64(quota)); err != nil {
		common.SysLog(fmt.Sprintf("failed to sync %s credit to user quota cache: %s", operation, err.Error()))
	}
}

// Helper functions to get individual fields if needed
func getUserGroupCache(userId int) (string, error) {
	cache, err := GetUserCache(userId)
	if err != nil {
		return "", err
	}
	return cache.Group, nil
}

func getUserQuotaCache(userId int) (int, error) {
	cache, err := GetUserCache(userId)
	if err != nil {
		return 0, err
	}
	return cache.Quota, nil
}

func getUserNameCache(userId int) (string, error) {
	cache, err := GetUserCache(userId)
	if err != nil {
		return "", err
	}
	return cache.Username, nil
}

func getUserSettingCache(userId int) (dto.UserSetting, error) {
	cache, err := GetUserCache(userId)
	if err != nil {
		return dto.UserSetting{}, err
	}
	return cache.GetSetting(), nil
}

// RefreshUserGroupCache writes the database-authoritative group into an
// existing user hash without changing the user's authentication version.
func RefreshUserGroupCache(userId int) error {
	if !common.RedisEnabled {
		return nil
	}
	if userId <= 0 {
		return fmt.Errorf("invalid user id")
	}
	var authoritative User
	if err := DB.Select("id", "auth_version", commonGroupCol).Where("id = ?", userId).First(&authoritative).Error; err != nil {
		return err
	}
	// Group transitions intentionally keep the same authentication version. A
	// refresh that read the previous group can therefore arrive after a newer
	// refresh and still pass the auth-version fence. Re-read after every write
	// and repair the cache when the authoritative group changed in between.
	for range 3 {
		if err := updateUserCacheFieldAtVersion(userId, "Group", authoritative.Group, authoritative.AuthVersion); err != nil {
			return err
		}

		var verified User
		if err := DB.Select("id", "auth_version", commonGroupCol).Where("id = ?", userId).First(&verified).Error; err != nil {
			return err
		}
		if verified.AuthVersion == authoritative.AuthVersion && verified.Group == authoritative.Group {
			return nil
		}
		authoritative = verified
	}

	// Preserve the freshest snapshot observed even when the row was too busy to
	// stabilize within the bounded retries. Returning an error lets best-effort
	// callers emit an operation-specific warning.
	if err := updateUserCacheFieldAtVersion(userId, "Group", authoritative.Group, authoritative.AuthVersion); err != nil {
		return err
	}
	return fmt.Errorf("user group changed repeatedly during cache refresh")
}

func updateUserEmailCache(userId int, email string) error {
	return updateUserCacheField(userId, "Email", email)
}

func updateUserNameCache(userId int, username string) error {
	return updateUserCacheField(userId, "Username", username)
}

func updateUserSettingCache(userId int, setting string) error {
	return updateUserCacheField(userId, "Setting", setting)
}

// updateUserCacheField prevents individual cache refreshes from bypassing the
// auth-version fence. It intentionally does nothing when the complete hash is
// absent; the next GetUserCache call will repopulate it from the database.
func updateUserCacheField(userId int, field string, value any) error {
	if !common.RedisEnabled {
		return nil
	}
	var user User
	if err := DB.Select("id", "auth_version").Where("id = ?", userId).First(&user).Error; err != nil {
		return err
	}
	if user.AuthVersion <= 0 {
		return fmt.Errorf("invalid user auth version")
	}
	return updateUserCacheFieldAtVersion(userId, field, value, user.AuthVersion)
}

// GetUserLanguage returns the user's language preference from cache
// Uses the existing GetUserCache mechanism for efficiency
func GetUserLanguage(userId int) string {
	userCache, err := GetUserCache(userId)
	if err != nil {
		return ""
	}
	return userCache.GetSetting().Language
}
