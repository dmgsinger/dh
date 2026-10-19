const express = require('express');
const db = require('../db');
const auth = require('./authMiddleware');

const router = express.Router();

function withDisplayLogo(card) {
  card.display_logo = card.custom_logo_path
    ? `/uploads/${card.custom_logo_path}`
    : card.logo_url || `${String(card.url).replace(/\/+$/, '')}/favicon.ico`;
  return card;
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// 站内搜索：标题 / 网址 / 描述，包含子菜单下的卡片
// 注意：必须放在 /:menuId 之前，否则会被当成菜单 ID
router.get('/search', (req, res) => {
  const keyword = String(req.query.q || '').trim();
  if (!keyword) return res.json([]);

  const like = `%${keyword}%`;
  db.all(
    `SELECT c.*, COALESCE(c.menu_id, sm.parent_id) AS parent_menu_id
       FROM cards c
       LEFT JOIN sub_menus sm ON c.sub_menu_id = sm.id
      WHERE c.title LIKE ? OR c.url LIKE ? OR IFNULL(c.desc, '') LIKE ?
      ORDER BY c."order", c.id
      LIMIT 50`,
    [like, like, like],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(withDisplayLogo));
    }
  );
});

// 获取指定菜单（或子菜单）的卡片
router.get('/:menuId', (req, res) => {
  const menuId = Number(req.params.menuId);
  if (!Number.isInteger(menuId)) return res.status(400).json({ error: '无效的菜单 ID' });

  const subMenuId = req.query.subMenuId ? Number(req.query.subMenuId) : null;
  if (subMenuId !== null && !Number.isInteger(subMenuId)) {
    return res.status(400).json({ error: '无效的子菜单 ID' });
  }

  const query = subMenuId
    ? 'SELECT * FROM cards WHERE sub_menu_id = ? ORDER BY "order", id'
    : 'SELECT * FROM cards WHERE menu_id = ? AND sub_menu_id IS NULL ORDER BY "order", id';

  db.all(query, [subMenuId || menuId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(withDisplayLogo));
  });
});

// 新增、修改、删除卡片需认证
router.post('/', auth, (req, res) => {
  const { menu_id, sub_menu_id, title, url, logo_url, custom_logo_path, desc, order } = req.body || {};
  if (!title || !url) return res.status(400).json({ error: '标题和网址不能为空' });
  if (!isHttpUrl(url)) return res.status(400).json({ error: '网址必须以 http:// 或 https:// 开头' });
  if (logo_url && !isHttpUrl(logo_url) && !String(logo_url).startsWith('/')) {
    return res.status(400).json({ error: '图标地址不合法' });
  }

  db.run(
    'INSERT INTO cards (menu_id, sub_menu_id, title, url, logo_url, custom_logo_path, desc, "order") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [menu_id || null, sub_menu_id || null, title, url, logo_url || null, custom_logo_path || null, desc || '', order || 0],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

router.put('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '无效的卡片 ID' });

  const { menu_id, sub_menu_id, title, url, logo_url, custom_logo_path, desc, order } = req.body || {};
  if (!title || !url) return res.status(400).json({ error: '标题和网址不能为空' });
  if (!isHttpUrl(url)) return res.status(400).json({ error: '网址必须以 http:// 或 https:// 开头' });

  db.run(
    'UPDATE cards SET menu_id=?, sub_menu_id=?, title=?, url=?, logo_url=?, custom_logo_path=?, desc=?, "order"=? WHERE id=?',
    [menu_id || null, sub_menu_id || null, title, url, logo_url || null, custom_logo_path || null, desc || '', order || 0, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ changed: this.changes });
    }
  );
});

router.delete('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '无效的卡片 ID' });

  db.run('DELETE FROM cards WHERE id=?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

module.exports = router;
