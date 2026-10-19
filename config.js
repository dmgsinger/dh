require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * 解析 JWT 密钥（按优先级）：
 *   1. 环境变量 JWT_SECRET（长度 >= 32）
 *   2. database/.jwt-secret（首次启动自动生成并持久化，权限 0600）
 *   3. 进程内随机密钥（磁盘不可写时的兜底，重启后所有 token 失效）
 *
 * 绝不要把密钥写死在源码里——这个仓库是公开的。
 */
function resolveJwtSecret() {
  const fromEnv = (process.env.JWT_SECRET || '').trim();
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (fromEnv) {
    console.warn('[security] JWT_SECRET 长度不足 32 字符，已忽略，改用自动生成的密钥');
  }

  const secretFile = path.join(__dirname, 'database', '.jwt-secret');
  try {
    if (fs.existsSync(secretFile)) {
      const saved = fs.readFileSync(secretFile, 'utf8').trim();
      if (saved.length >= 32) return saved;
    }
    const generated = crypto.randomBytes(48).toString('hex');
    fs.mkdirSync(path.dirname(secretFile), { recursive: true });
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    console.log('[security] 已生成随机 JWT 密钥并保存到 database/.jwt-secret');
    return generated;
  } catch (err) {
    console.warn('[security] 无法持久化 JWT 密钥，本次使用临时密钥（重启后需重新登录）:', err.message);
    return crypto.randomBytes(48).toString('hex');
  }
}

module.exports = {
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    // 为空时由 db.js 在首次初始化时生成随机密码并打印到日志
    password: process.env.ADMIN_PASSWORD || ''
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    jwtSecret: resolveJwtSecret(),
    // 部署在 Nginx/Caddy 等反向代理后面时设为 1，才能拿到真实客户端 IP
    trustProxy: process.env.TRUST_PROXY === '1',
    // 登录信息记录使用的时区
    timezone: process.env.APP_TIMEZONE || 'Asia/Shanghai'
  }
};
