# 🫧 NotionSnap

> 开源的 Notion 工作空间备份与恢复工具。
> 备份到 Git，出了事一键恢复回 Notion。

[中文](#中文) | [English](#english)

---

## 中文

### ✨ 特性

- 🔐 **OAuth 认证** — 不依赖 cookie，不用偷取 token_v2，安全可靠
- 📝 **双格式导出** — Markdown 给人看，JSON 给机器读（Restore 用）
- 🔄 **Restore 恢复** — 市面唯一支持从备份恢复回 Notion 的工具
- 📊 **Git 版本历史** — Clean Diff，每次备份都是一次可审计的 commit
- ⚡ **增量备份** — 只更新有变化的页面，不是每次全量
- 🗄️ **数据库支持** — 自动备份 Notion 数据库（schema + 所有条目）
- 🛡️ **错误不中断** — 单页失败不影响整次备份，下次自动重试
- 🆓 **完全免费** — MIT 开源，永远免费

### 🚀 快速开始

#### 前置要求

- Node.js 18 或更高版本
- Git
- 一个 Notion 账号

#### 第 1 步：安装

```bash
git clone https://github.com/Vomoon9/notion-snap.git
cd notion-snap
npm install
npm run build
```

#### 第 2 步：创建 Notion OAuth Integration

1. 访问 [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. 点击 **创建新 Integration**
3. 填写名称（比如 `NotionSnap`）
4. **开发工作空间**：选择你的个人工作空间
5. **安装范围**：选择"Any workspace"（这样可以备份任何你有权限的工作空间）
6. **重定向 URI**：填写 `http://localhost:3000/oauth/callback`
7. **权限**：勾选 Read content、Read properties、Update content、Update properties
8. 保存，记下 **Client ID** 和 **Client Secret**

#### 第 3 步：配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```
NOTION_OAUTH_CLIENT_ID=你的Client_ID
NOTION_OAUTH_CLIENT_SECRET=你的Client_Secret
REDIRECT_URI=http://localhost:3000/oauth/callback
```

#### 第 4 步：授权连接

```bash
node dist/index.js init
```

浏览器会自动打开 Notion 授权页面。**选择你要备份的工作空间**，勾选要备份的页面（或选择全部），点击允许。

授权成功后，终端会显示已连接的工作空间名称。

#### 第 5 步：首次备份

你需要一个**根页面 ID**——这是你要备份的页面树的顶层页面。

获取方法：在 Notion 中打开你要备份的页面，URL 格式类似：
```
https://www.notion.so/你的页面标题-0eed7de9c807835ba998010e7ba0d835
```
最后那串字符（去掉连字符后的 32 位）就是页面 ID。

运行备份：

```bash
node dist/index.js backup --root 0eed7de9-c807-835b-a998-010e7ba0d835 --output ./backups
```

备份完成后，`./backups` 目录下就是你的备份数据。

### 📂 输出结构

```
backups/
├── manifest.json                  ← 备份元数据（成功/失败列表 + 哈希）
├── 希沃白板公约-0eed7de9/
│   ├── page.md                    ← 人类可读 Markdown
│   └── page.json                  ← 完整 API 数据（Restore 用）
├── 课件侵权指南-a6bd7de9/
│   ├── page.md
│   └── page.json
└── 项目数据库-ghi12345/
    ├── database.md                ← Schema 表格 + 条目索引
    └── database.json              ← 完整 API 数据（schema + 所有条目）
```

- **page.md**：人类可读的 Markdown，可以直接用 VSCode、Typora 等打开
- **page.json**：完整的 Notion API 数据，包含所有 block 结构，用于 Restore
- **database.md**：数据库的 schema 摘要 + 所有条目的索引表格
- **database.json**：完整的数据库数据（schema + 条目 + 每个条目的内容块）
- **manifest.json**：记录本次备份的所有页面、哈希值、成功/失败状态

### 📖 配置文件

用配置文件管理备份任务更方便。创建 `notion-snap.yaml`：

```yaml
source:
  rootPageId: "0eed7de9-c807-835b-a998-010e7ba0d835"

storage:
  # 存储方式：local（本地目录）或 git（自动推送到 Git 仓库）
  type: local
  outputDir: ./backups          # local 模式专用

  # 如果要推送到 Git 仓库，改为：
  # type: git
  # repo: git@github.com:你的用户名/notion-backup-data.git
  # branch: main

export:
  timezone: Asia/Shanghai
```

使用配置文件运行：

```bash
node dist/index.js backup --config notion-snap.yaml
```

### ⏰ 定时备份

用系统 cron 实现每天自动备份：

```bash
# 编辑 crontab
crontab -e

# 每天凌晨 2 点自动备份
0 2 * * * cd /path/to/notion-snap && node dist/index.js backup --config notion-snap.yaml >> sync.log 2>&1
```

### 🔄 恢复 (Restore)

如果你的 Notion 页面被误删或内容被修改，可以从备份恢复：

#### 预览恢复内容（不实际创建）

```bash
node dist/index.js restore --dir ./backups --dest <目标页面ID> --dry-run
```

这会显示将要恢复哪些页面、每个页面有多少个块，但不会在 Notion 中创建任何内容。

#### 执行恢复

```bash
# 恢复全部备份内容到指定页面下
node dist/index.js restore --dir ./backups --dest <目标页面ID>
```

`--dest` 是恢复的目标父页面——备份内容会作为这个页面的子页面创建。这个页面需要已经共享给你的 NotionSnap Integration。

#### 只恢复指定页面

```bash
node dist/index.js restore --dir ./backups --dest <目标页面ID> --only "页面ID1,页面ID2"
```

#### 恢复说明

- 恢复会在目标页面下**创建新页面**，不会覆盖原有内容
- 每个页面的所有 block（段落、标题、列表、代码块、表格等）都会恢复
- 数据库的 schema 和所有条目都会恢复
- 以下内容无法恢复（Notion API 限制）：
  - `relation`（关联属性，跨数据库引用）
  - `people`（人员属性，用户 ID 不通用）
  - `formula`（公式，引用其他属性）
  - `rollup`（汇总，依赖关联）
  - `created_time` / `last_edited_time` 等自动字段

### 📋 命令参考

| 命令 | 说明 | 示例 |
|---|---|---|
| `init` | OAuth 授权连接 | `node dist/index.js init` |
| `backup` | 备份 | `node dist/index.js backup --root <ID> --output ./backups` |
| `backup` | 用配置文件备份 | `node dist/index.js backup --config notion-snap.yaml` |
| `backup` | 备份到 Git 仓库 | `node dist/index.js backup --root <ID> --git <repoURL>` |
| `restore` | 恢复 | `node dist/index.js restore --dir ./backups --dest <ID>` |
| `restore` | 预览恢复 | `node dist/index.js restore --dir ./backups --dest <ID> --dry-run` |
| `restore` | 恢复指定页面 | `node dist/index.js restore --dir ./backups --dest <ID> --only <ID1,ID2>` |
| `status` | 查看凭证状态 | `node dist/index.js status` |

### ❓ 常见问题

**Q: 备份的图片打不开？**

A: Notion API 返回的图片 URL 是 S3 预签名 URL，有效期约 1 小时。Markdown 中的图片链接会在 1 小时后失效。这是 Notion API 的限制，不是我们的 bug。JSON 快照中保存了原始数据，Restore 不受影响。未来版本会支持下载图片到本地。

**Q: 备份速度为什么有点慢？**

A: Notion API 限制每秒约 3 个请求。NotionSnap 在每次 API 调用之间等待 350ms 以遵守限制。大型工作空间（几百个页面）可能需要几分钟。增量备份会跳过未变化的页面，大幅提速。

**Q: 可以备份别人的共享工作空间吗？**

A: 可以。在 OAuth 授权时选择对方的工作空间即可。但对方需要把要备份的页面共享给你的 Integration。

**Q: 备份会修改我的 Notion 内容吗？**

A: 不会。备份只读取数据，不修改任何内容。只有 Restore 命令会创建新页面。

**Q: 可以迁移到 Obsidian/其他工具吗？**

A: NotionSnap 不面向这个场景。Notion 自带导出功能（Settings → Export）可以导出为 Markdown。NotionSnap 专注于"备份 + 恢复"，不是"迁移"。

**Q: token 会过期吗？**

A: Notion OAuth 的 access_token 不会像 cookie 那样频繁过期。如果 token 失效，重新运行 `init` 授权即可。

**Q: 单个页面备份失败了怎么办？**

A: NotionSnap 不会因为单个页面失败而中断整次备份。失败的页面会记录在 `manifest.json` 的 `failed` 列表中，下次备份时会自动重试。

### ⚠️ 已知限制

- **图片 URL 过期**：Markdown 中的图片链接 1 小时后失效（Notion API 限制）
- **不做跨工具迁移**：专注于 Notion 备份 + 恢复
- **API 速率限制**：约 3 请求/秒，大型工作空间需要时间
- **部分属性无法恢复**：relation/people/formula/rollup 等（Notion API 限制）

---

## English

### ✨ Features

- 🔐 **OAuth Authentication** — No cookies, no token_v2 stealing, secure and reliable
- 📝 **Dual Format Export** — Markdown for humans, JSON for machines (Restore)
- 🔄 **Restore** — The only tool that can restore backups back to Notion
- 📊 **Git Version History** — Clean diffs, every backup is an auditable commit
- ⚡ **Incremental Backup** — Only updates changed pages, not full re-export every time
- 🗄️ **Database Support** — Automatically backs up Notion databases (schema + all entries)
- 🛡️ **Error Resilient** — Single page failure doesn't abort the whole backup
- 🆓 **Free Forever** — MIT licensed, open source

### 🚀 Quick Start

#### Prerequisites

- Node.js 18+
- Git
- A Notion account

#### Step 1: Install

```bash
git clone https://github.com/Vomoon9/notion-snap.git
cd notion-snap
npm install
npm run build
```

#### Step 2: Create a Notion OAuth Integration

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **Create new integration**
3. Name it (e.g., `NotionSnap`)
4. **Development workspace**: Select your personal workspace
5. **Installation scope**: Select "Any workspace"
6. **Redirect URI**: `http://localhost:3000/oauth/callback`
7. **Capabilities**: Check Read content, Read properties, Update content, Update properties
8. Save and note down your **Client ID** and **Client Secret**

#### Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```
NOTION_OAUTH_CLIENT_ID=your_client_id
NOTION_OAUTH_CLIENT_SECRET=your_client_secret
REDIRECT_URI=http://localhost:3000/oauth/callback
```

#### Step 4: Authorize

```bash
node dist/index.js init
```

Your browser will open Notion's authorization page. **Select the workspace** you want to back up, choose pages to share, and click Allow.

#### Step 5: First Backup

You need a **root page ID** — the top-level page of the tree you want to back up.

Find it in your Notion page URL:
```
https://www.notion.so/Your-Page-Title-0eed7de9c807835ba998010e7ba0d835
```
The 32-character string at the end (remove hyphens) is the page ID.

Run backup:

```bash
node dist/index.js backup --root 0eed7de9-c807-835b-a998-010e7ba0d835 --output ./backups
```

### 📂 Output Structure

```
backups/
├── manifest.json                  ← Backup metadata (success/failed lists + hashes)
├── My-Page-0eed7de9/
│   ├── page.md                    ← Human-readable Markdown
│   └── page.json                  ← Full API data (for Restore)
├── Sub-Page-a6bd7de9/
│   ├── page.md
│   └── page.json
└── My-Database-ghi12345/
    ├── database.md                ← Schema table + entry index
    └── database.json              ← Full API data (schema + all entries)
```

- **page.md**: Readable Markdown, open with any text editor
- **page.json**: Complete Notion API data for Restore
- **database.md**: Schema summary + entry index table
- **database.json**: Full database data (schema + entries + entry content blocks)
- **manifest.json**: Page list, hashes, success/failed status

### 📖 Configuration File

Create `notion-snap.yaml`:

```yaml
source:
  rootPageId: "your-root-page-id"

storage:
  type: local                     # or git
  outputDir: ./backups            # for local mode

  # For Git mode:
  # type: git
  # repo: git@github.com:youruser/notion-backup-data.git
  # branch: main

export:
  timezone: Asia/Shanghai
```

Run with config:

```bash
node dist/index.js backup --config notion-snap.yaml
```

### ⏰ Scheduled Backup

```bash
# crontab -e
0 2 * * * cd /path/to/notion-snap && node dist/index.js backup --config notion-snap.yaml >> sync.log 2>&1
```

### 🔄 Restore

#### Preview (dry-run, no changes)

```bash
node dist/index.js restore --dir ./backups --dest <targetPageId> --dry-run
```

#### Execute Restore

```bash
node dist/index.js restore --dir ./backups --dest <targetPageId>
```

The `--dest` page is where restored content will be created as child pages. This page must be shared with your NotionSnap integration.

#### Restore Specific Pages Only

```bash
node dist/index.js restore --dir ./backups --dest <targetPageId> --only "pageId1,pageId2"
```

#### Restore Notes

- Restore **creates new pages** under the target — it does not overwrite existing content
- All block types are restored (paragraphs, headings, lists, code, tables, etc.)
- Database schema and all entries are restored
- The following cannot be restored (Notion API limitations):
  - `relation` (cross-database references)
  - `people` (user IDs are not portable)
  - `formula` (references other properties)
  - `rollup` (depends on relations)
  - `created_time` / `last_edited_time` (auto-computed)

### 📋 Command Reference

| Command | Description | Example |
|---|---|---|
| `init` | OAuth authorization | `node dist/index.js init` |
| `backup` | Backup to local | `node dist/index.js backup --root <ID> --output ./backups` |
| `backup` | Backup with config | `node dist/index.js backup --config notion-snap.yaml` |
| `backup` | Backup to Git | `node dist/index.js backup --root <ID> --git <repoURL>` |
| `restore` | Restore to Notion | `node dist/index.js restore --dir ./backups --dest <ID>` |
| `restore` | Preview restore | `node dist/index.js restore --dir ./backups --dest <ID> --dry-run` |
| `restore` | Restore specific pages | `node dist/index.js restore --dir ./backups --dest <ID> --only <ID1,ID2>` |
| `status` | Check credentials | `node dist/index.js status` |

### ❓ FAQ

**Q: Image links in the backup don't work?**

A: Notion API returns S3 pre-signed URLs that expire in ~1 hour. This is a Notion API limitation. JSON snapshots preserve the original data, so Restore is unaffected. Future versions will support downloading images locally.

**Q: Why is backup slow?**

A: Notion API limits ~3 requests/second. NotionSnap waits 350ms between API calls. Large workspaces may take several minutes. Incremental backup skips unchanged pages, significantly speeding up subsequent runs.

**Q: Can I back up a shared workspace?**

A: Yes. Select the shared workspace during OAuth authorization. The workspace owner needs to share pages with your Integration.

**Q: Does backup modify my Notion content?**

A: No. Backup only reads data. Only the Restore command creates new pages.

**Q: Can I migrate to Obsidian/other tools?**

A: NotionSnap is not designed for this. Notion's built-in export (Settings → Export) handles Markdown export. NotionSnap focuses on "backup + restore", not "migration".

**Q: What if a single page fails to back up?**

A: NotionSnap won't abort the entire backup. Failed pages are recorded in `manifest.json`'s `failed` list and automatically retried on the next backup.

### ⚠️ Known Limitations

- **Image URL expiry**: Markdown image links expire after 1 hour (Notion API limitation)
- **No cross-tool migration**: Focused on Notion backup + restore only
- **API rate limit**: ~3 req/sec, large workspaces take time
- **Some properties can't be restored**: relation/people/formula/rollup (Notion API limitation)

### 🤝 Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md). PRs welcome!

### 📄 License

MIT — see [LICENSE](LICENSE)