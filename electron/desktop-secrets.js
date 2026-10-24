'use strict';

/**
 * 桌面端密钥持久化。
 *
 * 后端从环境变量读取 SESSION_SECRET / CRYPTO_SECRET。若桌面端每次启动都注入
 * 新的随机值，那么重启之后：
 *   - 依赖旧密钥签名的刷新令牌校验全部失败（用户被登出）；
 *   - 用旧密钥加密的数据（如两步验证密钥）无法解密；
 *   - 带签名的任务资源链接全部失效。
 *
 * 因此密钥必须跨重启稳定：首次启动生成一次，写入 Electron 用户数据目录，
 * 之后每次原样复用。
 *
 * 这里刻意**不做静默轮换**：只要文件里已有非空值就复用。发现取值不合规时
 * 只告警不替换——重新生成会让上面三类数据不可恢复，那比一个弱密钥更糟；
 * 弱密钥的风险由「文件只存在于本机用户数据目录且权限 0600」来收敛。
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// SECRET_FILE_NAME 是密钥文件名，仅位于 Electron 用户数据目录下。
const SECRET_FILE_NAME = 'secrets.json';

// DESKTOP_SECRET_KEYS 是需要跨重启稳定保存的密钥清单。
const DESKTOP_SECRET_KEYS = ['SESSION_SECRET', 'CRYPTO_SECRET'];

// MIN_DESKTOP_SECRET_LENGTH 与 Go 侧 common.MinSecretLength 保持一致。
// 低于该长度的复用值会被告警，但不会被替换（见文件头说明）。
const MIN_DESKTOP_SECRET_LENGTH = 32;

// SECRET_FILE_MODE 是密钥文件权限：仅属主可读写。
const SECRET_FILE_MODE = 0o600;

// secretFilePath 返回给定用户数据目录下的密钥文件路径。
function secretFilePath(userDataDir) {
  return path.join(userDataDir, 'data', SECRET_FILE_NAME);
}

// ensureDesktopSecrets 读取（不存在则生成并落盘）桌面端密钥。
//
//   - 生成：crypto.randomBytes(32) 的十六进制串，长度与熵都足够；
//   - 落盘：仅写入 Electron 用户数据目录，并设为 0600（仅属主可读写）；
//   - 复用：已存在且包含全部所需字段时原样返回，保证重启后密钥不变；
//   - 完整性：字段缺失或 JSON 损坏时补全缺失字段并合并写回，
//     不会因为一个坏字段就把用户数据里已有的另一个密钥抹掉；
//   - 不静默轮换：取值不合规只告警，不替换。
//
// 返回值里的密钥只会被塞进子进程 env，绝不打印到日志或诊断输出。
function ensureDesktopSecrets(secretFile, logger) {
  const warn = (logger && typeof logger.warn === 'function')
    ? logger.warn.bind(logger)
    : (...args) => console.warn(...args);

  let existing = {};
  if (fs.existsSync(secretFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(secretFile, 'utf8'));
      if (!existing || typeof existing !== 'object') existing = {};
    } catch (err) {
      // JSON 已损坏：无法从中恢复任何字段，只能整体重新生成。这会让既有
      // 登录会话与已加密数据失效，必须显式告知用户，不能静默进行。
      warn(`密钥文件 ${SECRET_FILE_NAME} 已损坏，无法从中恢复任何密钥（${err.message}）。` +
        '将生成全新密钥：既有登录会话会被登出，已加密数据与已签发的任务资源链接将失效且不可用。' +
        '如这是意外发生，请从备份恢复该文件。');
      existing = {};
    }
  }

  let changed = false;
  const secrets = {};
  for (const key of DESKTOP_SECRET_KEYS) {
    const value = existing[key];
    if (typeof value === 'string' && value.length > 0) {
      secrets[key] = value;
      if (value.length < MIN_DESKTOP_SECRET_LENGTH) {
        // 不合规但保留：替换会导致数据不可恢复。风险由文件位置与权限收敛。
        warn(`${key} 长度仅 ${value.length}，低于建议的 ${MIN_DESKTOP_SECRET_LENGTH}。` +
          '已按原值复用（替换它会让既有加密数据与已签发链接不可恢复）；' +
          '如需更换，请同时接受既有数据失效。');
      }
      continue;
    }
    // 仅在缺失时生成。crypto.randomBytes 是 CSPRNG，不依赖进程内状态。
    secrets[key] = crypto.randomBytes(32).toString('hex');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(secretFile, JSON.stringify(secrets, null, 2), { mode: SECRET_FILE_MODE });
    try {
      fs.chmodSync(secretFile, SECRET_FILE_MODE);
    } catch (err) {
      // chmod 失败（例如某些 Windows 文件系统）不致命：文件仍只在本机用户目录。
      warn(`无法收紧密钥文件权限（${err.message}）。文件仍只位于本机用户数据目录。`);
    }
  }

  return secrets;
}

module.exports = {
  SECRET_FILE_NAME,
  DESKTOP_SECRET_KEYS,
  MIN_DESKTOP_SECRET_LENGTH,
  SECRET_FILE_MODE,
  secretFilePath,
  ensureDesktopSecrets,
};
