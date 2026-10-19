const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('./config');

const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(path.join(dbDir, 'nav.db'));

// WAL 让读写并发更顺畅；外键默认是关闭的，必须显式打开，级联删除才会生效
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA busy_timeout = 5000');

// ---- Promise 化的小工具，避免回调地狱 ----
const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

// ---- 建表 ----
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    "order" INTEGER DEFAULT 0
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_menus_order ON menus("order")`);

  db.run(`CREATE TABLE IF NOT EXISTS sub_menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    "order" INTEGER DEFAULT 0,
    FOREIGN KEY(parent_id) REFERENCES menus(id) ON DELETE CASCADE
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sub_menus_parent_id ON sub_menus(parent_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sub_menus_order ON sub_menus("order")`);

  db.run(`CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_id INTEGER,
    sub_menu_id INTEGER,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    logo_url TEXT,
    custom_logo_path TEXT,
    desc TEXT,
    "order" INTEGER DEFAULT 0,
    FOREIGN KEY(menu_id) REFERENCES menus(id) ON DELETE CASCADE,
    FOREIGN KEY(sub_menu_id) REFERENCES sub_menus(id) ON DELETE CASCADE
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cards_menu_id ON cards(menu_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cards_sub_menu_id ON cards(sub_menu_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cards_order ON cards("order")`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);

  db.run(`CREATE TABLE IF NOT EXISTS ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position TEXT NOT NULL,
    img TEXT NOT NULL,
    url TEXT NOT NULL
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ads_position ON ads(position)`);

  db.run(`CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    logo TEXT
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_friends_title ON friends(title)`);
});

// 兼容老版本数据库：缺列才加，不再靠“执行失败后吞掉错误”
async function ensureColumn(table, column, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  if (columns.some((item) => item.name === column)) return;
  await run(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

// ---- 默认数据（只在空库时写入，可随意改） ----
const DEFAULT_MENUS = [
  {
    name: '首页',
    order: 1,
    cards: [
      { title: 'Google', url: 'https://www.google.com', desc: '搜索引擎' },
      { title: 'GitHub', url: 'https://github.com', desc: '代码托管' },
      { title: 'YouTube', url: 'https://www.youtube.com', desc: '视频' },
      { title: 'Gmail', url: 'https://mail.google.com', logo: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico' },
      { title: '百度', url: 'https://www.baidu.com' },
      { title: '知乎', url: 'https://www.zhihu.com' },
      { title: '哔哩哔哩', url: 'https://www.bilibili.com' },
      { title: 'DeepSeek', url: 'https://www.deepseek.com', logo: 'https://cdn.deepseek.com/chat/icon.png' }
    ]
  },
  {
    name: 'AI',
    order: 2,
    cards: [
      { title: 'ChatGPT', url: 'https://chatgpt.com', desc: 'OpenAI' },
      { title: 'Claude', url: 'https://claude.ai', desc: 'Anthropic' },
      { title: 'Gemini', url: 'https://gemini.google.com', desc: 'Google' },
      { title: 'DeepSeek', url: 'https://chat.deepseek.com', desc: '深度求索' },
      { title: 'Kimi', url: 'https://www.kimi.com', desc: '月之暗面' },
      { title: '通义千问', url: 'https://tongyi.aliyun.com', desc: '阿里云' }
    ],
    subMenus: [
      {
        name: 'AI 对话',
        cards: [
          { title: 'ChatGPT', url: 'https://chatgpt.com' },
          { title: 'DeepSeek', url: 'https://chat.deepseek.com' }
        ]
      },
      {
        name: 'AI 工具',
        cards: [
          { title: 'Hugging Face', url: 'https://huggingface.co' },
          { title: 'Perplexity', url: 'https://www.perplexity.ai' }
        ]
      }
    ]
  },
  {
    name: '云服务',
    order: 3,
    cards: [
      { title: '阿里云', url: 'https://www.aliyun.com' },
      { title: '腾讯云', url: 'https://cloud.tencent.com' },
      { title: 'Cloudflare', url: 'https://dash.cloudflare.com' },
      { title: 'Vercel', url: 'https://vercel.com' },
      { title: 'DigitalOcean', url: 'https://www.digitalocean.com' },
      { title: 'Vultr', url: 'https://www.vultr.com' }
    ]
  },
  {
    name: '软件',
    order: 4,
    cards: [
      { title: 'VS Code', url: 'https://code.visualstudio.com' },
      { title: 'Docker Desktop', url: 'https://www.docker.com/products/docker-desktop' },
      { title: 'JetBrains', url: 'https://www.jetbrains.com' },
      { title: 'Obsidian', url: 'https://obsidian.md' }
    ]
  },
  {
    name: '工具',
    order: 5,
    cards: [
      { title: 'JSON.cn', url: 'https://www.json.cn', desc: 'JSON 格式化' },
      { title: 'ITDOG', url: 'https://www.itdog.cn', desc: '在线 ping / tcping' },
      { title: 'ip.sb', url: 'https://ip.sb', desc: 'IP 查询' },
      { title: '草料二维码', url: 'https://cli.im', desc: '二维码生成' },
      { title: 'TinyPNG', url: 'https://tinypng.com', desc: '图片压缩' },
      { title: 'Squoosh', url: 'https://squoosh.app', desc: '图片压缩' }
    ],
    subMenus: [
      {
        name: '开发工具',
        cards: [
          { title: 'Can I use', url: 'https://caniuse.com' },
          { title: 'DevDocs', url: 'https://devdocs.io' }
        ]
      }
    ]
  },
  {
    name: '其他',
    order: 6,
    cards: [
      { title: 'Outlook', url: 'https://outlook.live.com' },
      { title: 'QQ 邮箱', url: 'https://mail.qq.com' },
      { title: '网易邮箱', url: 'https://mail.163.com' },
      { title: 'Linux.do', url: 'https://linux.do' },
      { title: 'V2EX', url: 'https://www.v2ex.com' }
    ]
  }
];

async function seedDefaults() {
  await ensureColumn('users', 'last_login_time', 'last_login_time TEXT');
  await ensureColumn('users', 'last_login_ip', 'last_login_ip TEXT');

  const menuCount = await get('SELECT COUNT(*) AS count FROM menus');
  if (!menuCount.count) {
    for (const menu of DEFAULT_MENUS) {
      const menuRow = await run('INSERT INTO menus (name, "order") VALUES (?, ?)', [menu.name, menu.order]);

      for (let i = 0; i < menu.cards.length; i += 1) {
        const card = menu.cards[i];
        await run(
          'INSERT INTO cards (menu_id, title, url, logo_url, desc, "order") VALUES (?, ?, ?, ?, ?, ?)',
          [menuRow.lastID, card.title, card.url, card.logo || null, card.desc || '', i + 1]
        );
      }

      const subMenus = menu.subMenus || [];
      for (let i = 0; i < subMenus.length; i += 1) {
        const subMenu = subMenus[i];
        const subRow = await run('INSERT INTO sub_menus (parent_id, name, "order") VALUES (?, ?, ?)', [
          menuRow.lastID,
          subMenu.name,
          i + 1
        ]);
        for (let j = 0; j < subMenu.cards.length; j += 1) {
          const card = subMenu.cards[j];
          await run(
            'INSERT INTO cards (sub_menu_id, title, url, logo_url, desc, "order") VALUES (?, ?, ?, ?, ?, ?)',
            [subRow.lastID, card.title, card.url, card.logo || null, card.desc || '', j + 1]
          );
        }
      }
    }
    console.log('[init] 已写入默认导航数据，可在后台自行增删');
  }

  const userCount = await get('SELECT COUNT(*) AS count FROM users');
  if (!userCount.count) {
    const generated = !config.admin.password;
    const password = generated ? crypto.randomBytes(9).toString('base64url') : config.admin.password;

    if (password === '123456') {
      console.warn('[security] 你正在使用默认弱口令 123456，请登录后立刻修改');
    }

    await run('INSERT INTO users (username, password) VALUES (?, ?)', [
      config.admin.username,
      bcrypt.hashSync(password, 10)
    ]);

    if (generated) {
      console.log('='.repeat(60));
      console.log(`[init] 管理员账号：${config.admin.username}`);
      console.log(`[init] 随机初始密码：${password}`);
      console.log('[init] 请登录后立刻在「用户管理」里修改密码，这段日志只显示一次');
      console.log('='.repeat(60));
    }
  }

  const friendCount = await get('SELECT COUNT(*) AS count FROM friends');
  if (!friendCount.count) {
    const defaultFriends = [
      ['GitHub', 'https://github.com', 'https://github.com/fluidicon.png'],
      ['Linux.do', 'https://linux.do', '']
    ];
    for (const [title, url, logo] of defaultFriends) {
      await run('INSERT INTO friends (title, url, logo) VALUES (?, ?, ?)', [title, url, logo || null]);
    }
  }
}

seedDefaults().catch((err) => {
  console.error('[db] 初始化默认数据失败：', err);
});

module.exports = db;
