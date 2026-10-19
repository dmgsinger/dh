const jwt = require('jsonwebtoken');
const config = require('../config');

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), config.server.jwtSecret);
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

module.exports = authMiddleware;
