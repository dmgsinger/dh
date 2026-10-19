const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

const config = require('./config');
const db = require('./db');

const menuRoutes = require('./routes/menu');
const cardRoutes = require('./routes/card');
const uploadRoutes = require('./routes/upload');
const authRoutes = require('./routes/auth');
const adRoutes = require('./routes/ad');
const friendRoutes = require('./routes/friend');
const userRoutes = require('./routes/user');

const app = express();
const distDir = path.join(__dirname, 'web/dist');
const uploadsDir = path.join(__dirname, 'uploads');
const indexHtml = path.join(distDir, 'index.html');

app.disable('x-powered-by');
if (config.server.trustProxy) app.set('trust proxy', 1);

// 基础安全响应头（个人站点够用，不想用可整段删掉）
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; " +
      "script-src 'self'; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
  );
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(compression());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), time: new Date().toISOString() });
});

// 上传的图片：禁止嗅探 MIME，长缓存
app.use(
  '/uploads',
  express.static(uploadsDir, {
    fallthrough: true,
    maxAge: '7d',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
  })
);

// 前端静态资源
app.use(
  express.static(distDir, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    }
  })
);

// SPA 兜底：非 API / 非上传路径都回 index.html
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  const requested = path.normalize(path.join(distDir, req.path));
  if (requested.startsWith(distDir) && fs.existsSync(requested)) return next();
  if (!fs.existsSync(indexHtml)) {
    return res.status(503).send('前端尚未构建，请先在 web 目录执行 npm run build');
  }
  res.sendFile(indexHtml);
});

app.use('/api/menus', menuRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', authRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/users', userRoutes);

// API 404 统一返回 JSON
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

// 统一错误处理：不把堆栈/内部细节抛给前端
app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: status >= 500 ? '服务器内部错误' : err.message });
});

const server = app.listen(config.server.port, () => {
  console.log(`server is running at http://localhost:${config.server.port}`);
});

// 优雅退出，保证 SQLite 正常落盘
function shutdown(signal) {
  console.log(`\n[${signal}] 正在关闭服务...`);
  server.close(() => {
    db.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
['SIGINT', 'SIGTERM'].forEach((signal) => process.on(signal, () => shutdown(signal)));
