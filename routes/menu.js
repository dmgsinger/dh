const express = require('express');
const db = require('../db');
const auth = require('./authMiddleware');

const router = express.Router();

function toId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// 获取所有菜单（一次性带出子菜单，避免 N+1 查询）
router.get('/', (req, res) => {
  const { page, pageSize } = req.query;

  if (!page && !pageSize) {
    db.all('SELECT * FROM menus ORDER BY "order", id', [], (err, menus) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!menus.length) return res.json([]);

      db.all('SELECT * FROM sub_menus ORDER BY "order", id', [], (err2, subMenus) => {
        if (err2) return res.status(500).json({ error: err2.message });
        const grouped = {};
        subMenus.forEach((sub) => {
          (grouped[sub.parent_id] ||= []).push(sub);
        });
        res.json(menus.map((menu) => ({ ...menu, subMenus: grouped[menu.id] || [] })));
      });
    });
    return;
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const size = Math.min(Math.max(parseInt(pageSize, 10) || 10, 1), 200);
  const offset = (pageNum - 1) * size;

  db.get('SELECT COUNT(*) as total FROM menus', [], (err, countRow) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all('SELECT * FROM menus ORDER BY "order", id LIMIT ? OFFSET ?', [size, offset], (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ total: countRow.total, page: pageNum, pageSize: size, data: rows });
    });
  });
});

// 获取指定菜单的子菜单
router.get('/:id/submenus', (req, res) => {
  const menuId = toId(req.params.id);
  if (!menuId) return res.status(400).json({ error: '无效的菜单 ID' });

  db.all('SELECT * FROM sub_menus WHERE parent_id = ? ORDER BY "order", id', [menuId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 新增、修改、删除菜单需认证
router.post('/', auth, (req, res) => {
  const { name, order } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: '菜单名称不能为空' });
  }
  db.run('INSERT INTO menus (name, "order") VALUES (?, ?)', [name.trim(), Number(order) || 0], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

router.put('/:id', auth, (req, res) => {
  const menuId = toId(req.params.id);
  if (!menuId) return res.status(400).json({ error: '无效的菜单 ID' });

  const { name, order } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: '菜单名称不能为空' });
  }
  db.run('UPDATE menus SET name=?, "order"=? WHERE id=?', [name.trim(), Number(order) || 0, menuId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changed: this.changes });
  });
});

router.delete('/:id', auth, (req, res) => {
  const menuId = toId(req.params.id);
  if (!menuId) return res.status(400).json({ error: '无效的菜单 ID' });

  db.run('DELETE FROM menus WHERE id=?', [menuId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// 子菜单相关 API
router.post('/:id/submenus', auth, (req, res) => {
  const menuId = toId(req.params.id);
  if (!menuId) return res.status(400).json({ error: '无效的菜单 ID' });

  const { name, order } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: '子菜单名称不能为空' });
  }
  db.run('INSERT INTO sub_menus (parent_id, name, "order") VALUES (?, ?, ?)', [
    menuId,
    name.trim(),
    Number(order) || 0
  ], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

router.put('/submenus/:id', auth, (req, res) => {
  const subMenuId = toId(req.params.id);
  if (!subMenuId) return res.status(400).json({ error: '无效的子菜单 ID' });

  const { name, order } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: '子菜单名称不能为空' });
  }
  db.run('UPDATE sub_menus SET name=?, "order"=? WHERE id=?', [name.trim(), Number(order) || 0, subMenuId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changed: this.changes });
  });
});

router.delete('/submenus/:id', auth, (req, res) => {
  const subMenuId = toId(req.params.id);
  if (!subMenuId) return res.status(400).json({ error: '无效的子菜单 ID' });

  db.run('DELETE FROM sub_menus WHERE id=?', [subMenuId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

module.exports = router;
