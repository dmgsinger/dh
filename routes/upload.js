const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const auth = require('./authMiddleware');

const router = express.Router();
const uploadDir = path.join(__dirname, '../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error('仅支持 png / jpg / jpeg / webp / gif / ico 图片'));
    }
    if (!/^image\//.test(file.mimetype)) {
      return cb(new Error('文件内容必须是图片'));
    }
    cb(null, true);
  }
});

// 上传图标：需要登录，只接受 2MB 以内的图片
router.post('/', auth, (req, res) => {
  upload.single('logo')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? '图片不能超过 2MB' : err.message;
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: '没有收到文件' });
    res.json({ filename: req.file.filename, url: `/uploads/${req.file.filename}` });
  });
});

module.exports = router;
