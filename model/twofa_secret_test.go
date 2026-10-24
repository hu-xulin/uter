package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
)

// twoFASecretFixture 保存并还原进程级密钥，并清空 2FA 表。
func twoFASecretFixture(t *testing.T) {
	t.Helper()
	truncateTables(t)

	originalSession, originalCrypto := common.SessionSecret, common.CryptoSecret
	t.Cleanup(func() {
		common.SessionSecret, common.CryptoSecret = originalSession, originalCrypto
	})
	common.SessionSecret = "twofa-test-session-secret-0123456789abcdef"
	common.CryptoSecret = "twofa-test-crypto-secret-9876543210fedcba"
}

// seedTwoFAWithPlainSecret 直接写一条历史明文行，模拟迁移前的存量数据。
func seedTwoFAWithPlainSecret(t *testing.T, userId int, plainSecret string) TwoFA {
	t.Helper()
	record := TwoFA{UserId: userId, Secret: plainSecret, IsEnabled: true}
	require.NoError(t, DB.Create(&record).Error)
	require.NotEmpty(t, record.Id)
	return record
}

func createTwoFATestUser(t *testing.T, username string) User {
	t.Helper()
	user := User{
		Username:    username,
		Password:    "unused-password-hash",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
		AffCode:     "twofa-" + common.GetRandomString(8),
	}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

// TestTwoFASetPlainSecretStoresCiphertext 覆盖验收标准「新创建的 TOTP 种子以
// 密文存储」与「数据库导出内容不直接包含原始 TOTP 种子」。
func TestTwoFASetPlainSecretStoresCiphertext(t *testing.T) {
	twoFASecretFixture(t)

	const plainSecret = "JBSWY3DPEHPK3PXP"
	record := TwoFA{UserId: 1}
	require.NoError(t, record.SetPlainSecret(plainSecret))
	// 落库后再从数据库读一遍，确认磁盘上的值也是密文。
	require.NoError(t, DB.Create(&record).Error)

	assert.True(t, common.IsSecretEnvelope(record.Secret), "落库值必须是密文信封")
	assert.NotContains(t, record.Secret, plainSecret, "密文中不得出现原始种子")

	// 直接从库里读一行，确认磁盘上也不是明文。
	var stored TwoFA
	require.NoError(t, DB.Where("user_id = ?", 1).First(&stored).Error)
	assert.NotContains(t, stored.Secret, plainSecret, "数据库中的值不得包含原始种子")
	assert.True(t, common.IsSecretEnvelope(stored.Secret))

	// 同一个种子加密两次应得到不同密文（随机 nonce），但都能解回同一明文。
	again := TwoFA{UserId: 1}
	require.NoError(t, again.SetPlainSecret(plainSecret))
	assert.NotEqual(t, record.Secret, again.Secret, "相同明文的两次加密不应产生相同密文")
}

// TestTwoFAPlainSecretRoundTrips 覆盖「正常的 TOTP 验证仍然成功」：
// 密文存取后取回的种子必须与原值一致。
func TestTwoFAPlainSecretRoundTrips(t *testing.T) {
	twoFASecretFixture(t)

	const plainSecret = "KRSXG5CTMVRXEZLU"
	record := TwoFA{UserId: 1}
	require.NoError(t, record.SetPlainSecret(plainSecret))

	plain, err := record.PlainSecret()
	require.NoError(t, err)
	assert.Equal(t, plainSecret, plain)
}

// TestTwoFALegacyPlainSecretIsUpgradedOnRead 覆盖「旧记录迁移后可以正常验证」：
// 历史明文行在第一次被读取时升级为密文，且明文值保持不变。
func TestTwoFALegacyPlainSecretIsUpgradedOnRead(t *testing.T) {
	twoFASecretFixture(t)
	user := createTwoFATestUser(t, "twofa-legacy")

	const plainSecret = "MFRGGZDFMZTWQ2LK"
	legacy := seedTwoFAWithPlainSecret(t, user.Id, plainSecret)

	reloaded := TwoFA{Id: legacy.Id, UserId: user.Id, Secret: legacy.Secret}
	plain, err := reloaded.PlainSecret()
	require.NoError(t, err)
	assert.Equal(t, plainSecret, plain, "迁移后取到的种子必须与原来一致")

	var stored TwoFA
	require.NoError(t, DB.First(&stored, legacy.Id).Error)
	assert.True(t, common.IsSecretEnvelope(stored.Secret), "读取后应已升级为密文")
	assert.NotContains(t, stored.Secret, plainSecret)
}

// TestTwoFAUpgradeIsIdempotentAndConcurrencySafe 覆盖「迁移操作可以安全重复
// 执行」：重复读同一行不会二次加密，条件 UPDATE 也保证并发下只有一个请求命中。
func TestTwoFAUpgradeIsIdempotentAndConcurrencySafe(t *testing.T) {
	twoFASecretFixture(t)
	user := createTwoFATestUser(t, "twofa-idempotent")

	const plainSecret = "NBSWY3DPFQQFO33S"
	legacy := seedTwoFAWithPlainSecret(t, user.Id, plainSecret)

	first := TwoFA{Id: legacy.Id, UserId: user.Id, Secret: legacy.Secret}
	migrated, err := first.upgradePlainSecret(plainSecret)
	require.NoError(t, err)
	assert.True(t, migrated, "首次升级应当命中")
	firstCipher := first.Secret

	// 重复执行：secret 已变成密文，条件 UPDATE 不再命中。
	second := TwoFA{Id: legacy.Id, UserId: user.Id, Secret: firstCipher}
	migrated, err = second.upgradePlainSecret(firstCipher)
	require.Error(t, err, "把密文当明文再加密一层必须被拒绝")
	assert.False(t, migrated)
	assert.Equal(t, firstCipher, second.Secret, "密文不得被二次加密")

	// 用过期快照再升级一次：条件 WHERE 里的旧明文已不存在，不得命中。
	stale := TwoFA{Id: legacy.Id, UserId: user.Id, Secret: plainSecret}
	migrated, err = stale.upgradePlainSecret(plainSecret)
	require.NoError(t, err)
	assert.False(t, migrated, "过期快照不得覆盖已写入的密文")
}

// TestTwoFAPlainSecretFailsClosedOnRotatedKey 覆盖验收标准「加密密钥缺失、
// 使用占位值或无法解密时，系统不会静默降级为明文存储」。
func TestTwoFAPlainSecretFailsClosedOnRotatedKey(t *testing.T) {
	twoFASecretFixture(t)
	user := createTwoFATestUser(t, "twofa-rotated")

	const plainSecret = "GEZDGNBVGY3TQOJQ"
	record := TwoFA{UserId: user.Id}
	require.NoError(t, record.SetPlainSecret(plainSecret))

	// 轮换数据加密密钥：同一份密文在新密钥下必须解不开。
	originalCrypto := common.CryptoSecret
	common.CryptoSecret = "rotated-crypto-secret-abcdefghijklmnopqrstuvw"
	t.Cleanup(func() { common.CryptoSecret = originalCrypto })

	rotated := TwoFA{Id: record.Id, UserId: user.Id, Secret: record.Secret}
	plain, err := rotated.PlainSecret()

	require.Error(t, err, "密钥轮换后必须报错，不得静默放行")
	assert.ErrorIs(t, err, ErrTwoFASecretUndecryptable)
	assert.Empty(t, plain, "解不开时不得返回任何可用种子")
	assert.NotEqual(t, plainSecret, plain, "绝不能把密文当明文返回")
}

// TestTwoFAPlainSecretFailsClosedOnMissingKey 覆盖密钥未初始化的情形。
func TestTwoFAPlainSecretFailsClosedOnMissingKey(t *testing.T) {
	twoFASecretFixture(t)
	user := createTwoFATestUser(t, "twofa-missing-key")

	record := TwoFA{UserId: user.Id}
	require.NoError(t, record.SetPlainSecret("JBSWY3DPEHPK3PXP"))

	originalCrypto := common.CryptoSecret
	common.CryptoSecret = ""
	t.Cleanup(func() { common.CryptoSecret = originalCrypto })

	uninitialized := TwoFA{Id: record.Id, UserId: user.Id, Secret: record.Secret}
	plain, err := uninitialized.PlainSecret()

	require.Error(t, err, "加密密钥未初始化时必须拒绝")
	assert.ErrorIs(t, err, ErrTwoFASecretUndecryptable)
	assert.Empty(t, plain)
}

// TestMigrateTwoFASecretsToEncrypted 覆盖批量迁移的四个要求：分批、避免重复
// 加密、校验结果、失败可重跑。
func TestMigrateTwoFASecretsToEncrypted(t *testing.T) {
	twoFASecretFixture(t)

	plainSecrets := []string{"JBSWY3DPEHPK3PXP", "KRSXG5CTMVRXEZLU", "MFRGGZDFMZTWQ2LK"}
	for i, secret := range plainSecrets {
		user := createTwoFATestUser(t, "twofa-migrate-"+string(rune('a'+i)))
		seedTwoFAWithPlainSecret(t, user.Id, secret)
	}
	// 再放一条已经是密文的行，确认它会被跳过而不是被二次加密。
	encryptedUser := createTwoFATestUser(t, "twofa-migrate-encrypted")
	encryptedRecord := TwoFA{UserId: encryptedUser.Id}
	require.NoError(t, encryptedRecord.SetPlainSecret(plainSecrets[0]))
	require.NoError(t, DB.Create(&encryptedRecord).Error)

	result, err := MigrateTwoFASecretsToEncrypted(2)
	require.NoError(t, err)

	assert.Equal(t, 4, result.Scanned, "应读到全部 4 行")
	assert.Equal(t, 3, result.Migrated, "3 条明文应被升级")
	assert.Equal(t, 1, result.Encrypted, "1 条密文应被跳过")
	assert.Zero(t, result.Failed, "不应有失败行")
	assert.Equal(t, 4, result.TotalHandled())

	// 库里不应再有任何明文种子。
	var rows []TwoFA
	require.NoError(t, DB.Find(&rows).Error)
	require.Len(t, rows, 4)
	for _, row := range rows {
		assert.True(t, common.IsSecretEnvelope(row.Secret), "迁移后不允许残留明文")
	}

	// 重复执行：全部行已是密文，Migrated 必须为 0（可安全重复执行）。
	replay, err := MigrateTwoFASecretsToEncrypted(2)
	require.NoError(t, err)
	assert.Equal(t, 4, replay.Scanned)
	assert.Zero(t, replay.Migrated, "重复执行不得再次改动任何行")
	assert.Equal(t, 4, replay.Encrypted)
	assert.Zero(t, replay.Failed)
}

// TestMigrateTwoFASecretsToEncryptedBatchesThroughManyRows 确认游标分批能走完
// 超过一个批次大小的表，不漏行也不重复行。
func TestMigrateTwoFASecretsToEncryptedBatchesThroughManyRows(t *testing.T) {
	twoFASecretFixture(t)

	const total = 7
	for i := 0; i < total; i++ {
		user := createTwoFATestUser(t, "twofa-batch-"+string(rune('a'+i)))
		seedTwoFAWithPlainSecret(t, user.Id, "JBSWY3DPEHPK3PXP")
	}

	result, err := MigrateTwoFASecretsToEncrypted(3)
	require.NoError(t, err)

	assert.Equal(t, total, result.Scanned, "分批遍历必须覆盖全部行")
	assert.Equal(t, total, result.Migrated)
	assert.Zero(t, result.Failed)

	// 每个用户的种子都应能解回原值。
	var rows []TwoFA
	require.NoError(t, DB.Find(&rows).Error)
	require.Len(t, rows, total)
	for _, row := range rows {
		plain, plainErr := row.PlainSecret()
		require.NoError(t, plainErr)
		assert.Equal(t, "JBSWY3DPEHPK3PXP", plain)
	}
}

// TestMigrateTwoFASecretsKeepsPlaintextWhenKeyUnavailable 覆盖「迁移失败时告警
// 并保留安全恢复路径」：加密密钥不可用时升级失败，但明文行必须原样留在库里，
// 等密钥恢复后可以重跑成功——删掉明文等于直接销毁用户的 2FA。
func TestMigrateTwoFASecretsKeepsPlaintextWhenKeyUnavailable(t *testing.T) {
	twoFASecretFixture(t)
	user := createTwoFATestUser(t, "twofa-migrate-nokey")
	const plainSecret = "JBSWY3DPEHPK3PXP"
	legacy := seedTwoFAWithPlainSecret(t, user.Id, plainSecret)

	// 加密密钥不可用：EncryptSecret 直接报错。
	originalCrypto := common.CryptoSecret
	common.CryptoSecret = ""
	t.Cleanup(func() { common.CryptoSecret = originalCrypto })

	result, err := MigrateTwoFASecretsToEncrypted(10)
	require.NoError(t, err, "迁移整体不应报错，失败要逐行记录")
	assert.Equal(t, 1, result.Scanned)
	assert.Zero(t, result.Migrated)
	assert.Equal(t, 1, result.Failed, "升级失败必须被逐行记录")
	require.Len(t, result.FailedIDs, 1)
	assert.Equal(t, legacy.Id, result.FailedIDs[0])

	// 明文行必须原样保留，作为安全恢复路径。
	var stored TwoFA
	require.NoError(t, DB.First(&stored, legacy.Id).Error)
	assert.Equal(t, plainSecret, stored.Secret, "升级失败不得改动或清除明文")

	// 密钥恢复后重跑：同一行应当顺利升级，且仍能解回原值。
	common.CryptoSecret = originalCrypto
	retry, err := MigrateTwoFASecretsToEncrypted(10)
	require.NoError(t, err)
	assert.Equal(t, 1, retry.Migrated, "密钥恢复后重跑应当成功")
	assert.Zero(t, retry.Failed)

	require.NoError(t, DB.First(&stored, legacy.Id).Error)
	assert.True(t, common.IsSecretEnvelope(stored.Secret))
	plain, err := stored.PlainSecret()
	require.NoError(t, err)
	assert.Equal(t, plainSecret, plain, "重跑后种子必须仍然可用")
}

// TestTwoFASecretColumnRejectsOversizedCiphertext 确认密文信封在既有列宽内。
// 种子最长 32 字符，AES-GCM 加 12 字节 nonce 与 16 字节 tag 后远小于 255。
func TestTwoFASecretColumnRejectsOversizedCiphertext(t *testing.T) {
	twoFASecretFixture(t)

	longest := strings.Repeat("A", 32)
	record := TwoFA{UserId: 1}
	require.NoError(t, record.SetPlainSecret(longest))
	assert.Less(t, len(record.Secret), 255, "密文必须能放进 varchar(255)")
}
