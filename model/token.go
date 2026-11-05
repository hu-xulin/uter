package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/setting/operation_setting"
	"gorm.io/gorm"
)

type Token struct {
	Id                 int            `json:"id"`
	UserId             int            `json:"user_id" gorm:"index"`
	Key                string         `json:"key" gorm:"type:varchar(128);uniqueIndex"`
	Status             int            `json:"status" gorm:"default:1"`
	Name               string         `json:"name" gorm:"index" `
	CreatedTime        int64          `json:"created_time" gorm:"bigint"`
	AccessedTime       int64          `json:"accessed_time" gorm:"bigint"`
	ExpiredTime        int64          `json:"expired_time" gorm:"bigint;default:-1"` // -1 means never expired
	RemainQuota        int            `json:"remain_quota" gorm:"default:0"`
	UnlimitedQuota     bool           `json:"unlimited_quota"`
	ModelLimitsEnabled bool           `json:"model_limits_enabled"`
	ModelLimits        string         `json:"model_limits" gorm:"type:text"`
	AllowIps           *string        `json:"allow_ips" gorm:"default:''"`
	UsedQuota          int            `json:"used_quota" gorm:"default:0"` // used quota
	Group              string         `json:"group" gorm:"default:''"`
	CrossGroupRetry    bool           `json:"cross_group_retry"` // 跨分组重试，仅auto分组有效
	AutoGroups         string         `json:"-" gorm:"type:text"`
	DeletedAt          gorm.DeletedAt `gorm:"index"`
	// 允许用此令牌查询所属用户的额度；新建令牌默认开启，已有令牌升级后保持关闭
	AllowUserQuotaQuery bool `json:"allow_user_quota_query"`
}

func (token *Token) GetAutoGroups() ([]string, error) {
	if token.AutoGroups == "" {
		return nil, nil
	}
	var groups []string
	if err := common.UnmarshalJsonStr(token.AutoGroups, &groups); err != nil {
		return nil, err
	}
	return groups, nil
}

func (token *Token) SetAutoGroups(groups []string) error {
	if len(groups) == 0 {
		token.AutoGroups = ""
		return nil
	}
	data, err := common.Marshal(groups)
	if err != nil {
		return err
	}
	token.AutoGroups = string(data)
	return nil
}

func (token *Token) Clean() {
	token.Key = ""
}

func MaskTokenKey(key string) string {
	if key == "" {
		return ""
	}
	if len(key) <= 4 {
		return strings.Repeat("*", len(key))
	}
	if len(key) <= 8 {
		return key[:2] + "****" + key[len(key)-2:]
	}
	return key[:4] + "**********" + key[len(key)-4:]
}

func (token *Token) GetFullKey() string {
	return token.Key
}

func (token *Token) GetMaskedKey() string {
	return MaskTokenKey(token.Key)
}

func (token *Token) GetIpLimits() []string {
	// delete empty spaces
	//split with \n
	ipLimits := make([]string, 0)
	if token.AllowIps == nil {
		return ipLimits
	}
	cleanIps := strings.ReplaceAll(*token.AllowIps, " ", "")
	if cleanIps == "" {
		return ipLimits
	}
	ips := strings.SplitSeq(cleanIps, "\n")
	for ip := range ips {
		ip = strings.TrimSpace(ip)
		ip = strings.ReplaceAll(ip, ",", "")
		if ip != "" {
			ipLimits = append(ipLimits, ip)
		}
	}
	return ipLimits
}

func GetAllUserTokens(userId int, startIdx int, num int) ([]*Token, error) {
	var tokens []*Token
	var err error
	err = DB.Where("user_id = ?", userId).Order("id desc").Limit(num).Offset(startIdx).Find(&tokens).Error
	return tokens, err
}

// sanitizeLikePattern 校验并清洗用户输入的 LIKE 搜索模式。
// 规则：
//  1. 转义 ! 和 _（使用 ! 作为 ESCAPE 字符，兼容 MySQL/PostgreSQL/SQLite）
//  2. 连续的 % 合并为单个 %
//  3. 最多允许 2 个 %
//  4. 含 % 时（模糊搜索），去掉 % 后关键词长度必须 >= 2
//  5. 不含 % 时按精确匹配
func sanitizeLikePattern(input string) (string, error) {
	// 1. 先转义 ESCAPE 字符 ! 自身，再转义 _
	//    使用 ! 而非 \ 作为 ESCAPE 字符，避免 MySQL 中反斜杠的字符串转义问题
	input = strings.ReplaceAll(input, "!", "!!")
	input = strings.ReplaceAll(input, `_`, `!_`)

	if err := validateLikePattern(input); err != nil {
		return "", err
	}

	// 5. 无 % 时，精确全匹配
	return input, nil
}

func validateLikePattern(input string) error {
	// 1. 连续的 % 直接拒绝
	if strings.Contains(input, "%%") {
		return common.NewMessage("The search pattern cannot contain consecutive % wildcards")
	}

	// 2. 统计 % 数量，不得超过 2
	count := strings.Count(input, "%")
	if count > 2 {
		return common.NewMessage("The search pattern can contain at most 2 % wildcards")
	}

	// 3. 含 % 时，去掉 % 后关键词长度必须 >= 2
	if count > 0 {
		stripped := strings.ReplaceAll(input, "%", "")
		if len(stripped) < 2 {
			return common.NewMessage("Fuzzy search keywords must be at least 2 characters long")
		}
	}

	return nil
}

const searchHardLimit = 100

func SearchUserTokens(userId int, keyword string, token string, offset int, limit int) (tokens []*Token, total int64, err error) {
	// model 层强制截断
	if limit <= 0 || limit > searchHardLimit {
		limit = searchHardLimit
	}
	if offset < 0 {
		offset = 0
	}

	if token != "" {
		token = strings.TrimPrefix(token, "sk-")
	}

	// 超量用户（令牌数超过上限）只允许精确搜索，禁止模糊搜索
	maxTokens := operation_setting.GetMaxUserTokens()
	hasFuzzy := strings.Contains(keyword, "%") || strings.Contains(token, "%")
	if hasFuzzy {
		count, err := CountUserTokens(userId)
		if err != nil {
			common.SysLog(common.LogText("failed to count user tokens: %s", err.Error()))
			return nil, 0, common.NewMessage("Failed to get the token count")
		}
		if int(count) > maxTokens {
			return nil, 0, common.NewMessage("Token count exceeds the limit. Only exact search is allowed, do not use the % wildcard")
		}
	}

	baseQuery := DB.Model(&Token{}).Where("user_id = ?", userId)

	// 非空才加 LIKE 条件，空则跳过（不过滤该字段）
	if keyword != "" {
		keywordPattern, err := sanitizeLikePattern(keyword)
		if err != nil {
			return nil, 0, err
		}
		baseQuery = baseQuery.Where("name LIKE ? ESCAPE '!'", keywordPattern)
	}
	if token != "" {
		tokenPattern, err := sanitizeLikePattern(token)
		if err != nil {
			return nil, 0, err
		}
		baseQuery = baseQuery.Where(commonKeyCol+" LIKE ? ESCAPE '!'", tokenPattern)
	}

	// 先查匹配总数（用于分页，受 maxTokens 上限保护，避免全表 COUNT）
	err = baseQuery.Limit(maxTokens).Count(&total).Error
	if err != nil {
		common.SysError(common.LogText("failed to count search tokens: %s", err.Error()))
		return nil, 0, common.NewMessage("Failed to search tokens")
	}

	// 再分页查数据
	err = baseQuery.Order("id desc").Offset(offset).Limit(limit).Find(&tokens).Error
	if err != nil {
		common.SysError(common.LogText("failed to search tokens: %s", err.Error()))
		return nil, 0, common.NewMessage("Failed to search tokens")
	}
	return tokens, total, nil
}

func ValidateUserToken(key string) (token *Token, err error) {
	if key == "" {
		return nil, ErrTokenNotProvided
	}
	token, err = GetTokenByKey(key, false)
	if err == nil {
		if token.Status == common.TokenStatusExhausted ||
			token.Status == common.TokenStatusExpired ||
			token.Status != common.TokenStatusEnabled {
			return token, ErrTokenInvalid
		}
		if token.ExpiredTime != -1 && token.ExpiredTime < common.GetTimestamp() {
			if !common.RedisEnabled {
				token.Status = common.TokenStatusExpired
				err := token.SelectUpdate()
				if err != nil {
					common.SysLog(common.LogText("failed to update token status%s", err.Error()))
				}
			}
			return token, ErrTokenInvalid
		}
		if !token.UnlimitedQuota && token.RemainQuota <= 0 {
			if !common.RedisEnabled {
				token.Status = common.TokenStatusExhausted
				err := token.SelectUpdate()
				if err != nil {
					common.SysLog(common.LogText("failed to update token status%s", err.Error()))
				}
			}
			return token, ErrTokenInvalid
		}
		return token, nil
	}
	common.SysLog(common.LogText("ValidateUserToken: failed to get token: %s", err.Error()))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrTokenInvalid
	}
	return nil, fmt.Errorf("%w: %v", ErrDatabase, err)
}

func GetTokenByIds(id int, userId int) (*Token, error) {
	if id == 0 || userId == 0 {
		return nil, common.NewMessage("Token ID or user ID is empty")
	}
	token := Token{Id: id, UserId: userId}
	var err error = nil
	err = DB.First(&token, "id = ? and user_id = ?", id, userId).Error
	return &token, err
}

func GetTokenById(id int) (*Token, error) {
	if id == 0 {
		return nil, errors.New("token id is empty")
	}
	token := Token{Id: id}
	var err error = nil
	err = DB.First(&token, "id = ?", id).Error
	return &token, err
}

func GetTokenByKey(key string, fromDB bool) (token *Token, err error) {
	if !fromDB && common.RedisEnabled {
		// Try Redis first
		token, err := cacheGetTokenByKey(key)
		if err == nil {
			return token, nil
		}
		// Don't return error - fall through to DB
	}
	token = &Token{}
	if err = DB.Where(commonKeyCol+" = ?", key).First(token).Error; err != nil {
		return nil, err
	}
	if common.RedisEnabled {
		// 冷缓存时用数据库快照初始化；已存在的哈希只刷新 TTL，
		// 避免快照覆盖 Redis 中已被原子预扣的余额。初始化失败不影响本次读取。
		if _, cacheErr := cacheInitToken(*token); cacheErr != nil {
			common.SysLog(common.LogText("failed to init token cache: %s", cacheErr.Error()))
		}
	}
	return token, nil
}

func (token *Token) Insert() error {
	var err error
	err = DB.Create(token).Error
	return err
}

// ErrTokenLimitExceeded 表示这次创建会使用户的令牌总数越过配置上限。
// 调用方必须把它与普通数据库错误区分开：前者对客户端表现为「已达上限」，
// 后者是服务端故障，两者都不能被当成创建成功。
var ErrTokenLimitExceeded = errors.New("token count limit exceeded")

// InsertWithinLimit 在单个事务内创建令牌并复核该用户的令牌总数。
//
// TOK-003：上限只靠「先 COUNT 再 INSERT」无法在并发下成立——两个请求可以
// 同时读到 count == maxTokens-1 并双双插入。因此把插入与复核放进同一个事务：
// 复核看到的是本事务插入后的真实状态，一旦超过上限就整体回滚，不会留下
// 「已插入但超限」的孤儿行，也无需依赖事后 Delete（删除失败即永久超限）。
//
// 计数或插入本身失败时错误原样上抛，调用方不得据此认为创建成功。
func (token *Token) InsertWithinLimit(maxTokens int) error {
	if maxTokens <= 0 {
		// 上限非正数意味着不允许创建任何令牌；这里必须 fail-closed，
		// 否则一次误配就会把上限检查整个跳过。
		return ErrTokenLimitExceeded
	}

	tx := DB.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	if err := tx.Create(token).Error; err != nil {
		tx.Rollback()
		return err
	}

	var total int64
	if err := tx.Model(&Token{}).Where("user_id = ?", token.UserId).Count(&total).Error; err != nil {
		tx.Rollback()
		return err
	}
	if int(total) > maxTokens {
		tx.Rollback()
		return ErrTokenLimitExceeded
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}
	return nil
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (token *Token) Update() (err error) {
	// 写库前失效缓存并设置 fence，防止并发读者把过期快照重新写回缓存。
	if cacheErr := invalidateTokenCacheForMutation(token.Key); cacheErr != nil {
		common.SysLog(common.LogText("failed to invalidate token cache before update: %s", cacheErr.Error()))
	}
	return DB.Model(token).Select("name", "status", "expired_time", "remain_quota", "unlimited_quota",
		"model_limits_enabled", "model_limits", "allow_ips", "group", "cross_group_retry", "auto_groups",
		"allow_user_quota_query").Updates(token).Error
}

func (token *Token) SelectUpdate() (err error) {
	if cacheErr := invalidateTokenCacheForMutation(token.Key); cacheErr != nil {
		common.SysLog(common.LogText("failed to invalidate token cache before status update: %s", cacheErr.Error()))
	}
	// This can update zero values
	return DB.Model(token).Select("accessed_time", "status").Updates(token).Error
}

func (token *Token) Delete() (err error) {
	if cacheErr := invalidateTokenCacheForMutation(token.Key); cacheErr != nil {
		common.SysLog(common.LogText("failed to invalidate token cache before delete: %s", cacheErr.Error()))
	}
	return DB.Delete(token).Error
}

func (token *Token) IsModelLimitsEnabled() bool {
	return token.ModelLimitsEnabled
}

func (token *Token) GetModelLimits() []string {
	if token.ModelLimits == "" {
		return []string{}
	}
	return strings.Split(token.ModelLimits, ",")
}

func (token *Token) GetModelLimitsMap() map[string]bool {
	limits := token.GetModelLimits()
	limitsMap := make(map[string]bool)
	for _, limit := range limits {
		limitsMap[limit] = true
	}
	return limitsMap
}

func DisableModelLimits(tokenId int) error {
	token, err := GetTokenById(tokenId)
	if err != nil {
		return err
	}
	token.ModelLimitsEnabled = false
	token.ModelLimits = ""
	return token.Update()
}

func DeleteTokenById(id int, userId int) (err error) {
	// Why we need userId here? In case user want to delete other's token.
	if id == 0 || userId == 0 {
		return common.NewMessage("Token ID or user ID is empty")
	}
	token := Token{Id: id, UserId: userId}
	err = DB.Where(token).First(&token).Error
	if err != nil {
		return err
	}
	return token.Delete()
}

func IncreaseTokenQuota(tokenId int, key string, quota int) (err error) {
	if quota < 0 {
		return errors.New("quota cannot be negative")
	}
	if common.RedisEnabled {
		runCacheSync(func() {
			// 守卫式增量：哈希不存在时跳过，由下次读取从数据库水合，
			// 绝不创建只有配额字段的残缺哈希。
			if _, err := cacheApplyTokenQuotaDelta(tokenId, key, int64(quota)); err != nil {
				common.SysLog(common.LogText("failed to increase token quota: %s", err.Error()))
			}
		})
	}
	if common.BatchUpdateEnabled {
		addNewRecord(BatchUpdateTypeTokenQuota, tokenId, quota)
		return nil
	}
	return increaseTokenQuota(tokenId, quota)
}

func increaseTokenQuota(id int, quota int) (err error) {
	return increaseTokenQuotaTx(DB, id, quota)
}

// increaseTokenQuotaTx adjusts token accounting inside the caller's transaction.
// It deliberately does not touch Redis or the batch-update queue: cache hydration
// must happen only after the enclosing transaction commits.
func increaseTokenQuotaTx(tx *gorm.DB, id int, quota int) error {
	if tx == nil {
		return errors.New("token quota transaction is nil")
	}
	if id <= 0 {
		return errors.New("token ID must be positive")
	}
	if quota < 0 {
		return errors.New("token quota increment cannot be negative")
	}
	if quota == 0 {
		return nil
	}

	result := tx.Model(&Token{}).Where("id = ?", id).Updates(
		map[string]any{
			"remain_quota":  gorm.Expr("remain_quota + ?", quota),
			"used_quota":    gorm.Expr("used_quota - ?", quota),
			"accessed_time": common.GetTimestamp(),
		},
	)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func DecreaseTokenQuota(id int, key string, quota int) (err error) {
	if quota < 0 {
		return errors.New("quota cannot be negative")
	}
	if common.RedisEnabled {
		runCacheSync(func() {
			if _, err := cacheApplyTokenQuotaDelta(id, key, int64(-quota)); err != nil {
				common.SysLog(common.LogText("failed to decrease token quota: %s", err.Error()))
			}
		})
	}
	if common.BatchUpdateEnabled {
		addNewRecord(BatchUpdateTypeTokenQuota, id, -quota)
		return nil
	}
	return decreaseTokenQuota(id, quota)
}

func decreaseTokenQuota(id int, quota int) (err error) {
	// TOK-005: deduct atomically only when the balance actually covers the
	// charge, and verify a row was affected. Without the remain_quota >= quota
	// condition a concurrent or out-of-order call could drive remain_quota
	// negative; without the RowsAffected check a silent no-op would look like a
	// success to the caller.
	//
	// 无限额度令牌豁免该守卫：ValidateUserToken 对 UnlimitedQuota 本就跳过
	// RemainQuota 检查（remain 只是记账字段，会随结算差额合法变负），而
	// TryReserveTokenQuota 的 unlimited 分支同样绕过余额判断。若在此处仍然
	// 强制 remain_quota >= quota，一个 remain 耗尽的无限令牌会被预扣误杀，
	// 报出误导性的 "insufficient token quota"。
	res := DB.Model(&Token{}).
		Where("id = ? AND (unlimited_quota = ? OR remain_quota >= ?)", id, true, quota).
		Updates(map[string]any{
			"remain_quota":  gorm.Expr("remain_quota - ?", quota),
			"used_quota":    gorm.Expr("used_quota + ?", quota),
			"accessed_time": common.GetTimestamp(),
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return common.NewMessage("insufficient token quota")
	}
	return nil
}

// CountUserTokens returns total number of tokens for the given user, used for pagination
func CountUserTokens(userId int) (int64, error) {
	var total int64
	err := DB.Model(&Token{}).Where("user_id = ?", userId).Count(&total).Error
	return total, err
}

// BatchDeleteTokens 删除指定用户的一组令牌，返回成功删除数量
func BatchDeleteTokens(ids []int, userId int) (int, error) {
	if len(ids) == 0 {
		return 0, common.NewMessage("Token IDs cannot be empty")
	}

	tx := DB.Begin()

	var tokens []Token
	if err := tx.Where("user_id = ? AND id IN (?)", userId, ids).Find(&tokens).Error; err != nil {
		tx.Rollback()
		return 0, err
	}
	if err := invalidateTokensCache(tokens); err != nil {
		common.SysLog(common.LogText("failed to invalidate token cache before batch delete: %s", err.Error()))
	}

	if err := tx.Where("user_id = ? AND id IN (?)", userId, ids).Delete(&Token{}).Error; err != nil {
		tx.Rollback()
		return 0, err
	}

	if err := tx.Commit().Error; err != nil {
		return 0, err
	}

	return len(tokens), nil
}

func GetTokenKeysByIds(ids []int, userId int) ([]Token, error) {
	var tokens []Token
	err := DB.Select("id", commonKeyCol).
		Where("user_id = ? AND id IN (?)", userId, ids).
		Find(&tokens).Error
	return tokens, err
}

// InvalidateUserTokensCache 清理指定用户所有令牌在 Redis 中的缓存，
// 配合 InvalidateUserCache 使用，可在用户被禁用/删除时立即阻断其令牌的请求。
// 下一次请求将从数据库重新加载令牌及用户状态，从而立即识别出被禁用的用户。
func InvalidateUserTokensCache(userId int) error {
	if !common.RedisEnabled {
		return nil
	}
	if userId <= 0 {
		return errors.New("invalid user id")
	}
	var tokens []Token
	if err := DB.Unscoped().
		Select("id", commonKeyCol).
		Where("user_id = ?", userId).
		Find(&tokens).Error; err != nil {
		return err
	}
	return invalidateTokensCache(tokens)
}

func invalidateTokensCache(tokens []Token) error {
	if !common.RedisEnabled {
		return nil
	}
	var firstErr error
	for _, t := range tokens {
		if t.Key == "" {
			continue
		}
		if err := invalidateTokenCacheForMutation(t.Key); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func likeContains(keyword string) (string, error) {
	pattern, err := sanitizeLikePattern(keyword)
	if err != nil {
		return "", err
	}
	return "%" + pattern + "%", nil
}
