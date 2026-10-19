const express = require('express');
const db = require('../db');
const auth = require('./authMiddleware');

const router = express.Router();

function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// 获取友链
router.get('/', (req, res) => {
  const { page, pageSize } = req.query;

  if (!page && !pageSize) {
    db.all('SELECT * FROM friends ORDER BY id', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
    return;
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const size = Math.min(Math.max(parseInt(pageSize, 10) || 10, 1), 200);
  const offset = (pageNum - 1) * size;

  db.get('SELECT COUNT(*) as total FROM friends', [], (err, countRow) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all('SELECT * FROM friends ORDER BY id LIMIT ? OFFSET ?', [size, offset], (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ total: countRow.total, page: pageNum, pageSize: size, data: rows });
    });
  });
});

// 新增友链
router.post('/', auth, (req, res) => {
  const { title, url, logo } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: '站点名称不能为空' });
  if (!isHttpUrl(url)) return res.status(400).json({ error: '站点地址必须以 http:// 或 https:// 开头' });
  if (logo && !isHttpUrl(logo)) return res.status(400).json({ error: 'logo 地址不合法' });

  db.run('INSERT INTO friends (title, url, logo) VALUES (?, ?, ?)', [String(title).trim(), url, logo || null], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// 修改友链
router.put('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '无效的友链 ID' });

  const { title, url, logo } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: '站点名称不能为空' });
  if (!isHttpUrl(url)) return res.status(400).json({ error: '站点地址必须以 http:// 或 https:// 开头' });
  if (logo && !isHttpUrl(logo)) return res.status(400).json({ error: 'logo 地址不合法' });

  db.run('UPDATE friends SET title=?, url=?, logo=? WHERE id=?', [String(title).trim(), url, logo || null, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changed: this.changes });
  });
});

// 删除友链
router.delete('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '无效的友链 ID' });

  db.run('DELETE FROM friends WHERE id=?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

module.exports = router;
