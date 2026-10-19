# Nav-Item · 个人导航站

一个自用的导航页：星空背景 + 毛玻璃卡片 + 聚合搜索，带一套够用的后台管理。
基于 [eooce/nav-item](https://github.com/eooce/nav-item)（Apache-2.0）修改，主要做了**安全加固**和**已知 Bug 修复**，适合个人 / 家庭内网自建。

![首页](assets/7.jpg)

## 这个版本改了什么

上游是很好的模板，但默认配置直接挂公网有风险，所以这个 fork 重点修了这些：

| 问题 | 处理方式 |
|---|---|
| JWT 密钥写死在源码里，且 `JWT_SECRET` 环境变量实际不生效 | 统一从 `config.server.jwtSecret` 读取；未配置时自动生成随机密钥并持久化到 `database/.jwt-secret` |
| `/api/upload` 无鉴权、无类型/大小限制，可传 HTML 造成存储型 XSS | 加登录校验、扩展名 + MIME 白名单、2MB 上限、随机文件名、`nosniff` |
| 默认口令 `admin / 123456` | 未设置 `ADMIN_PASSWORD` 时首次启动生成随机密码并打印一次；登录失败 15 分钟内限 5 次 |
| SQLite 外键默认关闭，删栏目不会级联删卡片 | 打开 `PRAGMA foreign_keys`，同时启用 WAL 与 busy_timeout |
| 自定义 logo 写死 `http://localhost:3000`，线上必裂 | 前端改用后端返回的 `display_logo` 相对路径 |
| 站内搜索只搜主菜单，搜不到子菜单（上游 Issue #4） | 新增 `GET /api/cards/search`，一次 SQL 覆盖全部栏目与子栏目 |
| 搜索框输入会同时过滤当前卡片列表 | 搜索框只负责搜索引擎 / 站内检索，不再联动过滤 |
| 背景图外链作者服务器 | 改用仓库内的 `/background.webp` |
| token 过期后后台"假登录" | 统一 401 拦截，自动清 token 并回登录页 |
| 一处 `ALTER TABLE` 靠吞错误实现"迁移" | 改为 `PRAGMA table_info` 判断后再加列 |
| 无 `.gitignore` / `.dockerignore` / `.env.example`、后端无 lockfile | 全部补齐，Docker 改用 `npm ci` |
| Docker 以 root 运行、无健康检查、compose 漏挂 uploads | 非 root 运行、`HEALTHCHECK`、compose 同时挂载数据库与上传目录 |
| 许可证 README 写 MIT、LICENSE 实际是 Apache-2.0 | 统一为 Apache-2.0，并补 `NOTICE` 保留上游署名 |

另外把默认种子数据从 60 条（含作者个人服务与盗版站链接）精简为一份中性的常用站点列表，首次启动更干净。

## 功能

**前台**
- 主菜单 + 二级菜单（悬停展开），卡片网格自适应 6/4/3 列
- 聚合搜索：Google / 百度 / Bing / GitHub / 站内
- 左右广告位、友情链接弹窗
- 切换栏目时的卡片入场动画

**后台**（`/admin`）
- 栏目管理：主菜单 / 子菜单增删改、排序
- 卡片管理：行内编辑、排序、**上传本地图标**（2MB 内）
- 广告管理、友链管理
- 修改密码、上次登录时间 / IP

## 技术栈

- 后端：Node.js 20 + Express 4 + SQLite（`sqlite3`）+ JWT + `bcryptjs`
- 前端：Vue 3 + Vite 7 + vue-router + axios
- 部署：Docker 多阶段构建 / docker-compose / 直接 `node app.js`

## 快速开始

### 方式一：Docker Compose（推荐）

```bash
git clone https://github.com/dmgsinger/dh.git
cd dh
cp .env.example .env      # 按需修改，ADMIN_PASSWORD 可留空自动生成
docker compose up -d --build
docker compose logs -f    # 首次启动会打印随机管理员密码
```

打开 <http://localhost:3000>，后台在 `/admin`。

数据保存在 `./data/database`（SQLite）和 `./data/uploads`（上传的图标），重建容器不会丢。

### 方式二：本地运行

```bash
npm install
npm --prefix web install
npm --prefix web run build
ADMIN_PASSWORD='你的密码' npm start
```

开发模式（前端热更新 + 接口代理到 3000 端口）：

```bash
# 终端 1
npm run dev

# 终端 2
npm --prefix web run dev   # http://localhost:5173
```

### 方式三：docker run

```bash
docker run -d --name nav-item \
  -p 3000:3000 \
  -v $(pwd)/data/database:/app/database \
  -v $(pwd)/data/uploads:/app/uploads \
  -e ADMIN_PASSWORD='换成你的密码' \
  ghcr.io/dmgsinger/nav-item:latest
```

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | 监听端口 |
| `ADMIN_USERNAME` | `admin` | 仅首次初始化时写入数据库 |
| `ADMIN_PASSWORD` | 空 | 留空则自动生成随机密码并打印到日志；建议显式设置 |
| `JWT_SECRET` | 空 | ≥32 字符；留空则生成并保存到 `database/.jwt-secret` |
| `TRUST_PROXY` | `0` | 在 Nginx / Caddy 后面设为 `1`，否则记录不到真实 IP |
| `APP_TIMEZONE` | `Asia/Shanghai` | 登录时间显示时区 |

## 数据备份与迁移

整个站点的状态只有两样东西：

```bash
# SQLite 热备（服务运行中也可以执行）
sqlite3 data/database/nav.db ".backup 'nav-backup.db'"

# 上传的图标
tar czf uploads-backup.tar.gz -C data uploads
```

换机器时把 `data/` 整个目录拷过去即可（包含数据库、上传图片、JWT 密钥）。

## 目录结构

```
nav-item/
├── app.js                 # Express 入口：静态资源、安全头、路由挂载
├── config.js              # 环境变量与 JWT 密钥解析
├── db.js                  # 建表、迁移、默认数据
├── routes/
│   ├── auth.js            # 登录 + 失败限流
│   ├── authMiddleware.js  # JWT 校验
│   ├── menu.js            # 栏目 / 子栏目
│   ├── card.js            # 卡片 + 站内搜索
│   ├── ad.js  friend.js  user.js  upload.js
├── web/                   # Vue 3 前端（构建产物在 web/dist）
├── database/              # 运行时生成：nav.db、.jwt-secret（已 gitignore）
├── uploads/               # 上传的图标（已 gitignore，保留默认图标）
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## 安全建议

即使已经修过一轮，个人站点上线前仍建议：

1. **一定设置 `ADMIN_PASSWORD`**，不要依赖随机密码长期使用；
2. 前面套一层 Nginx / Caddy 做 HTTPS，并给 `/api/login` 配 `limit_req`；
3. 只把需要的端口暴露到公网，或干脆只在内网 / Tailscale 里用；
4. 定期备份 `database/` 与 `uploads/`；
5. 不要把 `.env`、`database/`、`uploads/` 提交到仓库（`.gitignore` 已处理）。

## 开发

```bash
npm run dev              # 后端，文件变更自动重启
npm --prefix web run dev # 前端，/api 与 /uploads 自动代理到 3000
```

修改后端接口后记得同步 `web/src/api.js`。

## 许可证

[Apache License 2.0](LICENSE)。上游版权归 [eooce](https://github.com/eooce) 所有，修改部分见 [NOTICE](NOTICE)。
