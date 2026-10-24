'use strict';

// 桌面端密钥持久化的回归测试。
//
// 重点验证清单第九章的验收标准：Electron 正常退出并重新启动后，依赖旧密钥的
// 登录会话、加密数据与任务资源访问能力必须继续可用。这等价于「重启后读到的
// 密钥与上一次完全一致」。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  SECRET_FILE_NAME,
  DESKTOP_SECRET_KEYS,
  MIN_DESKTOP_SECRET_LENGTH,
  secretFilePath,
  ensureDesktopSecrets,
} = require('./desktop-secrets');

// makeSecretFile 在临时目录里造一个模拟的用户数据目录，返回密钥文件路径。
//
// 与 Electron 主进程的行为保持一致：userData/data 这一层由 startServer 提前
// mkdir，因此这里也必须先建好，否则测的是「目录不存在」而不是密钥逻辑。
function makeSecretFile() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uter-desktop-secrets-'));
  fs.mkdirSync(path.join(userDataDir, 'data'), { recursive: true });
  return secretFilePath(userDataDir);
}

// silentLogger 收集告警但不打印，便于断言「是否把风险说清楚了」。
function silentLogger() {
  const warnings = [];
  return {
    warnings,
    warn(message) {
      warnings.push(String(message));
    },
  };
}

test('首次启动生成两个足够强的密钥并以 0600 落盘', () => {
  const secretFile = makeSecretFile();
  const logger = silentLogger();

  const secrets = ensureDesktopSecrets(secretFile, logger);

  assert.deepEqual(DESKTOP_SECRET_KEYS, ['SESSION_SECRET', 'CRYPTO_SECRET']);
  for (const key of DESKTOP_SECRET_KEYS) {
    assert.match(secrets[key], /^[0-9a-f]{64}$/, `${key} 应为 32 字节随机值的十六进制串`);
  }
  assert.notEqual(secrets.SESSION_SECRET, secrets.CRYPTO_SECRET, '两个密钥必须互相独立');

  assert.ok(fs.existsSync(secretFile), '密钥文件必须落盘');
  const mode = fs.statSync(secretFile).mode & 0o777;
  assert.equal(mode, 0o600, `密钥文件权限应为 0600，实际为 ${mode.toString(8)}`);

  // 首次生成不应产生任何告警。
  assert.deepEqual(logger.warnings, []);
});

test('重启后密钥保持不变（登录会话与加密数据继续可用）', () => {
  const secretFile = makeSecretFile();
  const first = ensureDesktopSecrets(secretFile, silentLogger());

  // 模拟用户退出并重新启动桌面端：同一份密钥文件被再次读取。
  const second = ensureDesktopSecrets(secretFile, silentLogger());
  const third = ensureDesktopSecrets(secretFile, silentLogger());

  assert.deepEqual(second, first, '第二次启动必须复用首次生成的密钥');
  assert.deepEqual(third, first, '第三次启动仍必须复用，不能逐次漂移');

  // 落盘内容也必须一致，否则备份/恢复会得到不同的密钥。
  const onDisk = JSON.parse(fs.readFileSync(secretFile, 'utf8'));
  assert.deepEqual(onDisk, first);
});

test('密钥文件名与用户数据目录约定一致', () => {
  const secretFile = makeSecretFile();
  assert.equal(path.basename(secretFile), SECRET_FILE_NAME);
  assert.equal(SECRET_FILE_NAME, 'secrets.json');
  assert.ok(secretFile.includes(`${path.sep}data${path.sep}`), '密钥必须位于用户数据目录下');
});

test('部分字段缺失时补全，不抹掉已有的另一个密钥', () => {
  const secretFile = makeSecretFile();
  const first = ensureDesktopSecrets(secretFile, silentLogger());

  // 只保留 SESSION_SECRET，模拟旧版本只写了一个字段的情形。
  fs.writeFileSync(secretFile, JSON.stringify({ SESSION_SECRET: first.SESSION_SECRET }), { mode: 0o600 });

  const repaired = ensureDesktopSecrets(secretFile, silentLogger());

  assert.equal(repaired.SESSION_SECRET, first.SESSION_SECRET, '已有密钥必须原样保留');
  assert.match(repaired.CRYPTO_SECRET, /^[0-9a-f]{64}$/, '缺失字段应被补全');
});

test('JSON 损坏时明确告警数据将失效，而不是静默换密钥', () => {
  const secretFile = makeSecretFile();
  const first = ensureDesktopSecrets(secretFile, silentLogger());

  fs.writeFileSync(secretFile, '{ this is not valid json', { mode: 0o600 });
  const logger = silentLogger();

  const regenerated = ensureDesktopSecrets(secretFile, logger);

  assert.notEqual(regenerated.SESSION_SECRET, first.SESSION_SECRET, '损坏文件无法恢复，只能重新生成');
  assert.ok(
    logger.warnings.some((message) => message.includes('损坏')),
    '必须告知用户密钥文件已损坏',
  );
  assert.ok(
    logger.warnings.some((message) => message.includes('不可用') || message.includes('失效')),
    '必须告知既有会话与数据会失效',
  );
});

test('不合规的已有密钥被复用而非静默轮换', () => {
  const secretFile = makeSecretFile();
  const weak = 'x'.repeat(8);
  fs.writeFileSync(
    secretFile,
    JSON.stringify({ SESSION_SECRET: weak, CRYPTO_SECRET: 'y'.repeat(8) }),
    { mode: 0o600 },
  );
  const logger = silentLogger();

  const reused = ensureDesktopSecrets(secretFile, logger);

  // 重新生成会让已加密数据不可恢复，比弱密钥更糟，因此这里必须原样复用。
  assert.equal(reused.SESSION_SECRET, weak, '不合规密钥也必须复用，不得静默轮换');
  assert.equal(reused.CRYPTO_SECRET, 'y'.repeat(8));
  assert.equal(
    logger.warnings.filter((message) => message.includes('不可恢复')).length,
    DESKTOP_SECRET_KEYS.length,
    '每个不合规密钥都应各自告警一次',
  );
});

test('最小长度常量与 Go 侧约定一致', () => {
  assert.equal(MIN_DESKTOP_SECRET_LENGTH, 32);
});
