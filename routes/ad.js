const express = require('express');
const db = require('../db');
const auth = require('./authMiddleware');

const router = express.Router();

const POSITIONS = new Set(['left', 'right']);

function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validImage(value) {
  return isHttpUrl(value) || String(value || '').startsWith('/uploads/');
}

// 获取广告
router.get('/', (req, res) => {
  const { page, pageSize } = req.query;

  if (!page && !pageSize) {
    db.all('SELECT * FROM ads ORDER BY id', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
    return;
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const size = Math.min(Math.max(parseInt(pageSize, 10) || 10, 1), 200);
  const offset = (pageNum - 1) * size;

  db.get('SELECT COUNT(*) as total FROM ads', [], (err, countRow) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all('SELECT * FROM ads ORDER BY id LIMIT ? OFFSET ?', [size, offset], (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ total: countRow.total, page: pageNum, pageSize: size, data: rows });
    });
  });
});

// 新增广告
router.post('/', auth, (req, res) => {
  const { position, img, url } = req.body || {};
  if (!POSITIONS.has(position)) return res.status(400).json({ error: '广告位置只能是 left 或 right' });
  if (!validImage(img)) return res.status(400).json({ error: '图片地址不合法' });
  if (!isHttpUrl(url)) return res.status(400).json({ error: '跳转链接必须以 http:// 或 https:// 开头' });

  db.run('INSERT INTO ads (position, img, url) VALUES (?, ?, ?)', [position, img, url], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// 修改广告
router.put('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '无效的广告 ID' });

  const { position, img, url } = req.body || {};
  if (!POSITIONS.has(position)) return res.status(400).json({ error: '广告位置只能是 left 或 right' });
  if (!validImage(img)) return res.status(400).json({ error: '图片地址不合法' });
  if (!isHttpUrl(url)) return res.status(400).json({ error: '跳转链接必须以 http:// 或 https:// 开头' });

  db.run('UPDATE ads SET position=?, img=?, url=? WHERE id=?', [position, img, url, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changed: this.changes });
  });
});

// 删除广告
router.delete('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '无效的广告 ID' });

  db.run('DELETE FROM ads WHERE id=?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

module.exports = router;
