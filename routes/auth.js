const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');

const router = express.Router();

// ---- 简单的内存登录限流：同一 IP 15 分钟内最多失败 5 次 ----
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;
const attempts = new Map();

function isBlocked(ip) {
  const item = attempts.get(ip);
  if (!item) return false;
  if (Date.now() > item.resetAt) {
    attempts.delete(ip);
    return false;
  }
  return item.count >= MAX_FAILS;
}

function recordFailure(ip) {
  const item = attempts.get(ip);
  if (!item || Date.now() > item.resetAt) {
    attempts.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    item.count += 1;
  }
  if (attempts.size > 1000) {
    const now = Date.now();
    for (const [key, value] of attempts) {
      if (now > value.resetAt) attempts.delete(key);
    }
  }
}

// ---- 工具函数 ----
function getClientIp(req) {
  let ip = req.ip || req.socket?.remoteAddress || '';
  if (typeof ip === 'string' && ip.includes(',')) ip = ip.split(',')[0].trim();
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
  return ip;
}

function getLocalTime() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.server.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

// ---- 登录 ----
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const ip = getClientIp(req);
  if (isBlocked(ip)) {
    return res.status(429).json({ error: '尝试次数过多，请 15 分钟后再试' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) {
      recordFailure(ip);
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    bcrypt.compare(password, user.password, (err2, matched) => {
      if (err2 || !matched) {
        recordFailure(ip);
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      attempts.delete(ip);

      const lastLoginTime = user.last_login_time;
      const lastLoginIp = user.last_login_ip;
      db.run('UPDATE users SET last_login_time = ?, last_login_ip = ? WHERE id = ?', [
        getLocalTime(),
        ip,
        user.id
      ]);

      const token = jwt.sign(
        { id: user.id, username: user.username },
        config.server.jwtSecret,
        { expiresIn: '12h' }
      );
      res.json({ token, lastLoginTime, lastLoginIp });
    });
  });
});

module.exports = router;
