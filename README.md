<h1 align="center">
  <img src="public/favicon.svg" alt="TGYS TV Logo" width="90"/><br/>
  TGYS TV
</h1>

<p align="center">
  现代化的视频聚合搜索与播放站 —— 豆瓣首页墙 · 点击海报直达播放 · 多源聚合（按实测速度排序）· 自带账号系统与管理后台 · TVBox 接口
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License"/></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node.js >=20"/>
  <img src="https://img.shields.io/badge/pnpm-10.15.1-blue" alt="pnpm"/>
  <img src="https://img.shields.io/badge/vite-6-yellowgreen" alt="Vite 6"/>
</p>

---

## ✨ 功能特性

- **豆瓣首页墙**：热门电影 / 热门剧集 / 韩剧 / 美剧 / 日剧 / 热门综艺 / 热门动漫 / 豆瓣高分 / 经典电影；点栏目名进入分类整页（100 部网格，边拉边显示，第一屏立即出图）
- **点击海报直达播放**：点豆瓣海报自动跨源搜索，按片名匹配度分档、再按实测播放速度挑最快的源，直接进入播放页，不用手动选源
- **多源聚合搜索**：一次搜索聚合全部已启用视频源；结果带「接口耗时 / 播放耗时」双标注，慢源一目了然
- **播放页换源**：选集上方有「换源」入口，候选源按第一集实测速度排好（速度圆点 + 毫秒数 + 清晰度标签），切换保留当前集数与播放进度
- **流畅播放**：HLS（hls.js）+ ArtPlayer，倍速、画中画、自动迷你播放器、快捷键齐全；弹幕（可选）兼容弹弹 play 协议，字号 / 速度 / 显示区域可调
- **账号系统**（Cloudflare D1）：自助注册（开放 / 邀请码 / 关闭三态）与登录，30 天内免登录；被禁用、踢下线或到期会在一分钟内被请回登录页
- **管理员后台**（设置中心内）：用户管理（新建账号 / 禁用 / 踢下线 / 删除 / 设置可用天数）、登录与观看记录（含登录属地）、邀请码、站点公告、更新日志
- **系统行为**（管理员后台填写、全站生效）：初始视频源、TMDB 令牌、豆瓣数据 / 图片代理、站点默认弹幕地址、Telegram 登录上线通知、关站维护模式
- **TVBox 接口**：每个用户有专属订阅地址，填进影视 / OK影视 等 App 即可看；聚合站线路与集数全量提供、按实测下载吞吐排序，另有豆瓣图片墙与各托管源直连站；账号禁用 / 到期 / 关站时接口自动失效
- **视频源格式兼容**：自家数组格式、KVideo 格式（`baseUrl`）、MoonTV 订阅格式（`api_site`）、TVBox 播放器配置（自动提取其中 type=1 的 CMS 源）都能直接导入，设置页 URL / 文本 / 文件三种导入与管理员初始源、TVBox 服务端源全支持
- **收藏与历史**：本地收藏、观看进度续播、深色模式、移动端卡片布局

> 本项目不内置任何视频源，源由使用者自行配置（站内「设置 → 视频源」导入，或通过环境变量 / 管理员后台预置）。

## 🚀 搭建教程

### 方式一：Cloudflare Pages（推荐）

#### 1. 准备代码

Fork 本仓库到你的 GitHub，或克隆后推送到你自己的仓库。

#### 2. 创建 Pages 项目

1. 登录 Cloudflare 控制台 → **Workers & Pages** → **创建** → **Pages** → **连接到 Git**
2. 选择你的 TGYSTV 仓库
3. 构建设置：

   | 项 | 值 |
   | --- | --- |
   | 框架预设 | Vite（或「无」） |
   | 构建命令 | `pnpm build` |
   | 构建输出目录 | `dist` |
   | 根目录 | `/`（留空） |

4. 先点「保存并部署」跑通第一次构建（环境变量下一步再加）

#### 3. 设置环境变量

进入项目 → **设置 → 环境变量** → 为「生产」环境添加：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `TGYS_ACCESS_PASSWORD` | ✅ | 站长密码：管理员登录与旧版单密码模式都用它 |
| `TGYS_INITIAL_VIDEO_SOURCES` | 推荐 | 初始视频源清单（JSON 直链 URL 或内联 JSON），新访客打开即带源；也可以之后在管理员后台「系统行为」里填，后台值优先 |
| `NODE_VERSION` | 推荐 | 固定为 `20`，避免构建环境默认 Node 版本过低 |

保存后到 **部署** 页对最新部署点「重试部署」，让变量生效。

#### 4. 开启账号系统（D1，可选但推荐）

不做这一步时站点是单密码模式：所有人共用 `TGYS_ACCESS_PASSWORD` 进站，没有注册功能，TVBox 接口也不可用。

1. 控制台 → **存储和数据库 → D1 SQL 数据库** → **创建数据库**，名字任意（如 `tgys-db`）
2. 回到 Pages 项目 → **设置 → 绑定** → **添加 → D1 数据库**：
   - 变量名填 **`TGYS_DB`**（必须一字不差）
   - 数据库选刚创建的那个
3. **重新部署**。首次有人访问登录接口时数据表会自动创建，无需手动建表
4. 使用方式：
   - 访客在登录页自助注册、登录（有效期、注册模式由管理员在后台设置）
   - 站长用用户名 `admin` + `TGYS_ACCESS_PASSWORD` 登录，进 **设置中心 → 管理员后台**（地址 `/settings/admin`，用户管理在 `/settings/users`）：管理用户、发邀请码、开关注册、发布公告、填系统行为都在这里

#### 5. 可选项

- **自定义域名**：Pages 项目 → **自定义域** → 添加你的域名并按提示改 DNS
- **系统行为（后台填写，优先于环境变量）**：管理员后台可直接填 TMDB 令牌、站点默认弹幕接口、豆瓣数据 / 图片代理、初始视频源，保存即全站生效，不必改环境变量重部署
- **TVBox 接口**：绑定 D1 后，每个用户在 **设置中心 → 播放设置 → TVBox 接口** 里拿到自己的订阅地址，填入影视类 App 即可
- **Telegram 登录通知**：管理员后台填 Bot Token 与 Chat ID 后，用户每次成功登录站长都会收到一条上线消息（可按用户开关）
- **关站维护**：管理员后台一键关站，普通用户暂停登录与注册，站长不受影响
- **人机验证（Turnstile）**：在控制台 **Turnstile** 里创建小部件（域名填你的站点域名），把站点密钥 / 密钥分别填入环境变量 `TGYS_TURNSTILE_SITE_KEY`、`TGYS_TURNSTILE_SECRET` 后重新部署，登录与注册即带人机验证
- **弹幕**：站点默认地址在管理员后台「系统行为」里填（弹弹 play 兼容接口），或用环境变量 `TGYS_DANMAKU_API_URL` 兜底；用户也可在站内「播放设置」里填自己的，个人设置优先

### 方式二：本地开发

```bash
git clone https://github.com/sandeli/TGYSTV.git
cd TGYSTV
pnpm install
pnpm dev        # http://localhost:5173
```

其他命令：`pnpm build`（构建到 dist）、`pnpm preview`（预览构建产物）、`pnpm test`（跑测试）。

> 本地 `pnpm dev` 只有前端，账号系统依赖的 Pages Functions + D1 不会运行，站点自动回退单密码模式。想在本地调试账号系统：先 `pnpm build`，再执行 `npx wrangler pages dev dist --d1 TGYS_DB`。

### 方式三：Docker

```bash
docker compose up -d --build
# 打开 http://localhost:3000
```

环境变量在 `docker-compose.yml` 的 `environment` 中配置（或同目录 `.env` 文件），常用的有 `TGYS_ACCESS_PASSWORD`、`TGYS_INITIAL_VIDEO_SOURCES`、`TGYS_TMDB_API_TOKEN`。注意 Docker 部署没有 D1，账号系统与 TVBox 接口不可用，为单密码模式。

### 其他平台

Vercel / Netlify 均可部署（构建命令 `pnpm build`、输出目录 `dist`），细节见 [docs/deployment.md](docs/deployment.md)；同样没有 D1 时为单密码模式，TVBox 接口不可用。

## ⚙️ 环境变量速查

| 变量 | 说明 |
| --- | --- |
| `TGYS_ACCESS_PASSWORD` | 站长密码（必填） |
| `TGYS_INITIAL_VIDEO_SOURCES` | 初始视频源清单（URL 或内联 JSON；管理员后台填写优先） |
| `TGYS_INITIAL_CONFIG` | 完整初始配置 JSON（高级，见 [docs/configuration.md](docs/configuration.md)） |
| `TGYS_TMDB_API_TOKEN` | TMDB API Token（详情匹配增强；也可在管理员后台填） |
| `TGYS_DANMAKU_API_URL` | 全站默认弹幕接口地址（兜底；管理员后台填写优先） |
| `TGYS_ANNOUNCEMENT` | 首页滚动公告（旧方式；推荐改用管理后台设置，后台优先） |
| `TGYS_REGISTRATION_OPEN` | 是否开放注册（`true` / `false`；管理员后台的注册模式设置优先于此变量） |
| `TGYS_TURNSTILE_SITE_KEY` / `TGYS_TURNSTILE_SECRET` | Cloudflare Turnstile 人机验证密钥对 |
| `TGYS_DB` | D1 数据库**绑定名**（不是变量值，在绑定设置里填） |

## 📖 文档

| 文档 | 说明 |
| --- | --- |
| [部署指南](docs/deployment.md) | Docker / Vercel / Cloudflare / Netlify / 本地开发 |
| [配置管理](docs/configuration.md) | 环境变量、TMDB 配置、完整配置导入 |
| [TMDB Key 申请](docs/tmdb-key.md) | TMDB API Token 注册与获取 |
| [视频源导入](docs/video-sources.md) | 导入方式与 JSON 格式说明 |
| [开发者指南](docs/development.md) | 技术栈、项目结构、代理架构、@tgys/cms-core |

## 🧱 技术栈

React 19 + Vite 6 + TypeScript · Tailwind CSS · Zustand · ArtPlayer + hls.js · Cloudflare Pages Functions + D1 · pnpm workspace（核心库 `@tgys/cms-core`）

## 📜 许可与致谢

本项目采用 [Apache License 2.0](LICENSE) 开源协议。项目最初基于 LibreTV / OuonnkiTV 二次开发，现已独立维护；使用时请保留 LICENSE 与其中的版权声明。

## ⚠️ 免责声明

本项目是一个开源的视频搜索聚合前端源代码，仅提供视频搜索结果的展示与播放功能的代码实现。本项目不提供任何可直接使用的成品软件、在线服务或托管平台，使用者需自行获取源代码并完成部署。

**本项目不提供、不托管、不上传、不存储、不分发、不缓存任何视频、音频、图片或其他受版权保护的内容。** 本项目源代码中不包含任何视频源地址或内容数据，所有搜索结果和播放内容均来自使用者自行配置的第三方视频源 API，本项目开发者不对这些第三方服务的合法性、可用性、安全性或内容质量承担任何责任。

使用者在部署和使用本项目源代码时，应当：

- 确保遵守所在国家或地区的法律法规
- 自行承担部署、配置和使用第三方视频源的全部法律责任
- 尊重内容创作者的知识产权和著作权
- 不将本项目源代码用于任何违法、侵权或商业侵权用途
- 对自行部署的实例及其产生的一切行为和后果承担全部责任

如发现侵权内容，请直接联系原始内容提供方（第三方视频源运营者）处理。本项目开发者仅提供源代码，无法也无义务对使用者部署的实例或第三方内容进行审查、监控、删除或管控。

**本项目源代码按「现状」（AS IS）提供，不附带任何明示或暗示的保证。** 开发者不对因部署、使用或无法使用本项目源代码而导致的任何直接、间接、附带、特殊或后果性损害承担责任。

使用者获取、部署或以任何方式使用本项目源代码即表示已阅读、理解并同意本免责声明的全部内容。如不同意，请立即停止使用并删除相关代码及部署实例。
