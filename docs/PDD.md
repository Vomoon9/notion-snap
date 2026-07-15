# 🫧 NotionSnap — 产品设计文档 (PDD)

> **一句话定位**：一个开源的 Notion 工作空间备份与恢复工具。
> 备份到 Git，出了事一键恢复回 Notion。

---

## 📋 文档信息

| 字段 | 内容 |
|---|---|
| 项目名称 | **NotionSnap** |
| 项目性质 | 开源 · MIT 许可证 · 完全免费 |
| 产品形态 | CLI 工具 → Web Dashboard（分阶段） |
| 技术栈 | Node.js (TypeScript) |
| 目标用户 | Notion 个人用户 + 小团队（留在 Notion、但怕丢数据的人） |
| 文档版本 | v1.0 |
| 创建日期 | 2026-07-15 |
| 产品设计师 | Hermes Agent (AI 产品总设计师) |
| 发起人 | 力工王 |

---

## 📑 目录

1. [市场调研与竞品分析](#1-市场调研与竞品分析)
2. [产品定位与差异化](#2-产品定位与差异化)
3. [核心功能规划](#3-核心功能规划)
4. [技术架构设计](#4-技术架构设计)
5. [项目目录结构](#5-项目目录结构)
6. [分阶段路线图](#6-分阶段路线图)
7. [第一步行动指南](#7-第一步行动指南-立即可执行)
8. [第二步行动指南](#8-第二步行动指南)
9. [AI 执行手册](#9-ai-执行手册防傻瓜化)
10. [Notion API 已知坑位清单](#10-notion-api-已知坑位清单)
11. [竞争壁垒分析](#11-竞争壁垒分析)
12. [开源项目运营策略](#12-开源项目运营策略)

---

## 1. 市场调研与竞品分析

### 1.1 竞品全景图

我们对市面上的 Notion 备份工具做了全面扫描，按技术方案分为两大阵营：

#### 阵营 A：调用 Notion 私有导出 API（非官方）

这类工具通过抓取浏览器 cookie（`token_v2`）调用 Notion 内部导出接口，获取 Notion 官方生成的 ZIP 包。

| 项目 | 语言 | ⭐ Stars | 活跃度 | 认证方式 | 核心特点 |
|---|---|---|---|---|---|
| **darobin/notion-backup** | JS | 437 | ❌ 已停止维护 | token_v2 cookie | 最早期项目，GitHub Actions 定时导出 |
| **richartkeil/notion-guardian** | TS | 160 | ⚠️ 2年前停更 | token_v2 cookie | 模板仓库，fork 即用 |
| **nikhilbadyal/notion-backup** | Python | 16 | ✅ 活跃 | token_v2 cookie | 模块化设计，Docker，rclone，通知系统 |

#### 阵营 B：调用 Notion 公开 API（官方）

通过 Notion 官方 API 逐页读取内容，自行渲染为 Markdown/JSON。

| 项目 | 语言 | ⭐ Stars | 活跃度 | 认证方式 | 核心特点 |
|---|---|---|---|---|---|
| **NotionGitBackup** (SaaS) | 未知 | N/A | ⚠️ 疑似停运 | OAuth | SaaS 产品，£9/月，Markdown+JSON → Git |
| **我们的 notion-backup** | JS | 私有 | ✅ 运行中 | OAuth + Internal Token | Notion→Notion 跨空间克隆 + 增量同步 |

### 1.2 竞品对比矩阵

| 能力 | darobin | notion-guardian | nikhilbadyal | NotionGitBackup | **我们(目标)** |
|---|---|---|---|---|---|
| 认证方式 | token_v2 ⚠️ | token_v2 ⚠️ | token_v2 ⚠️ | OAuth ✅ | **OAuth ✅** |
| token 过期风险 | 高 ❌ | 高 ❌ | 高 ❌ | 低 ✅ | **低 ✅** |
| 输出格式 | ZIP(MD/HTML) | ZIP(MD/HTML) | ZIP(MD/HTML) | MD + JSON | **MD + JSON** |
| Git 集成 | GH Actions | GH Actions | cron + rclone | 原生 commit | **原生 commit** |
| Clean diff | ❌ 每次全量 | ❌ 每次全量 | ❌ 每次全量 | ✅ deterministic | **✅ deterministic** |
| 增量同步 | ❌ | ❌ | ❌ | ❌ | **✅** |
| **恢复 (Restore)** | ❌ | ❌ | ❌ | ❌ 明确不支持 | **✅ 核心差异** |
| 跨空间迁移 | ❌ | ❌ | ❌ | ❌ | **✅ 已实现** |
| 中文支持 | ❌ | ❌ | ❌ | ❌ | **✅** |
| 自托管 | ✅ | ✅ | ✅ | ❌ SaaS only | **✅** |
| Docker | ❌ | ❌ | ✅ | ❌ | **计划中** |
| 通知系统 | ❌ | ❌ | ✅ 70+ 服务 | 邮件 | **计划中** |
| 开源 | ✅ MIT | ✅ MIT | ✅ MIT | ❌ 闭源 | **✅ MIT** |
| 免费 | ✅ | ✅ | ✅ | ❌ £9/月 | **✅ 永远免费** |

### 1.3 关键发现

**发现 1：token_v2 方案是行业痛点**

几乎所有开源竞品都依赖 `token_v2` cookie——这是一个**非官方、会过期、需要手动刷新**的认证方式。darobin 在 README 里明确抱怨：
> *"I got tired of having to constantly fight the API just to get my own data back"*

他因为这个原因停更了项目，转投 Obsidian。这验证了 token_v2 方案的不可持续性。

**发现 2：恢复能力是市场空白**

在所有竞品中——包括付费的 NotionGitBackup——**没有一个能做 Restore**。NotionGitBackup 在 FAQ 里明确说：
> *"Can I fully restore an entire workspace? — No."*

这是最大的市场缺口。而我们因为已经实现了 Notion→Notion 的完整克隆逻辑，**天然具备恢复能力**。

**发现 3：Notion 官方导出 API 是黑箱**

阵营 A 的工具调用的是 Notion 内部接口（`/api/v3/getBacklinksForPage` 等），这个接口：
- 没有文档
- 随时可能改
- 需要 cookie 认证（不是 OAuth）
- 导出的是 Notion 自己的 ZIP 格式，不可控

我们选择阵营 B（官方 API）是正确的长期决策。

---

## 2. 产品定位与差异化

### 2.1 产品定位

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│   "你的 Notion 数据，备份在你自己手里                  │
│    出了事，一键恢复回来"                               │
│                                                      │
│   NotionSnap = 备份 (Backup) + 恢复 (Restore)        │
│                                                      │
│   不是导出工具 —— 是 Notion 工作空间的                │
│   安全网（备份 + 版本历史 + 恢复）                     │
│                                                      │
│   ❌ 不是给离开 Notion 的人用的                       │
│   ❌ 不是迁移到 Obsidian/其他工具的                    │
│   ✅ 是给留在 Notion 但怕丢数据的人用的                │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**明确不做的事情**：
- ❌ 不做跨工具迁移（Notion → Obsidian/其他）——这是 Notion 自带导出就能做的
- ❌ 不追求 Markdown interop兼容性——Markdown 只给人看，不追求被其他工具解析
- ❌ 不做 Notion 私有 API 导出（token_v2 cookie 方案）——不可持续

### 2.2 差异化三角

```
                    Restore 恢复
                   （独有 · 核心壁垒）
                        /\
                       /  \
                      /    \
                     /      \
                    /        \
                   /          \
                  /            \
                 /     我们      \
                /   NotionSnap    \
               /                  \
              /                    \
     OAuth 安全认证          Clean Git Diff
    （不偷 cookie）        （可审计的版本历史）
```

**三个差异化点组合在一起，构成了竞品无法快速复制的产品壁垒。**

### 2.3 用户画像

| 用户类型 | 痛点 | 我们的解决方案 |
|---|---|---|
| **个人知识管理者** | "Notion 万一删了我的数据怎么办" | 定时备份到 Git，有版本历史可回溯 |
| **小团队** | "员工离职删了共享空间的内容" | 备份 + **Restore 恢复** |
| **数据安全焦虑者** | "不想所有数据只存在云端" | 本地 Git 备份，自己掌握副本 |
| **中文用户** | "现有工具都是英文，文档看不懂" | 中文 README + 中文文档 |

> **注**：我们不面向"想离开 Notion 迁移到其他工具"的用户。
> 那是 Notion 自带导出功能和 darobin 等项目服务的场景。

---

## 3. 核心功能规划

### 3.1 MVP（最小可用产品）— Phase 1

> **目标**：一个能跑的 CLI，能把自己的 Notion 备份到 Git 仓库

| # | 功能 | 描述 | 优先级 |
|---|---|---|---|
| F1 | OAuth 认证 | 通过 Notion OAuth 连接 workspace，不需要 cookie | P0 |
| F2 | 页面树遍历 | 递归读取所有页面和子页面 | P0 |
| F3 | 数据库读取 + 导出 | 读取数据库 schema + 所有条目，导出为 database.json + database.md 索引表（方案 B） | P0 |
| F4 | Markdown 导出 | 将 Notion block 结构转换为可读 Markdown（仅用于人眼浏览，不追求 interop） | P0 |
| F5 | JSON 快照 | 每个页面/数据库同时导出完整 JSON 结构（用于 Restore） | P0 |
| F6 | Git 集成 | 自动 commit + push 到指定仓库 | P0 |
| F7 | manifest.json | 记录本次快照的元数据（页面列表、时间、哈希） | P1 |
| F8 | 增量检测 | 对比上次备份，只更新有变化的页面 | P1 |
| F9 | 配置文件 | YAML 配置文件，管理备份任务 | P1 |
| F9a | 错误处理 | 单页失败不中断整次备份，记录失败列表到 manifest，下次自动重试 | P0 |

### 3.2 Phase 2 — 恢复能力

| # | 功能 | 描述 | 优先级 |
|---|---|---|---|
| F10 | Restore 命令 | 从 JSON 快照恢复页面到 Notion | P0 |
| F11 | 选择性恢复 | 只恢复指定页面/数据库 | P1 |
| F12 | 新 workspace 恢复 | 恢复到一个全新的 Notion workspace | P1 |
| F13 | 恢复预览 | dry-run 模式，展示将要恢复什么 | P2 |

### 3.3 Phase 3 — 体验完善

| # | 功能 | 描述 | 优先级 |
|---|---|---|---|
| F14 | Web Dashboard | 简洁的 Web 界面管理备份任务 | P1 |
| F15 | 调度引擎 | 内置定时任务，不依赖系统 cron | P1 |
| F16 | 通知系统 | 失败/成功通知（邮件、webhook） | P1 |
| F17 | Docker | 官方 Docker 镜像，一键部署 | P2 |
| F18 | 多存储后端 | 本地、S3、WebDAV 等 | P2 |

### 3.4 Phase 4 — 高级功能

| # | 功能 | 描述 | 优先级 |
|---|---|---|---| 
| F19 | 跨空间恢复 | 恢复到一个全新的 Notion workspace（本质是 Restore 的扩展） | P2 |
| F20 | 加密备份 | 端到端加密备份文件 | P2 |
| F21 | GitHub Action | 一键 fork 即用的 GitHub Action 模板 | P2 |
| F22 | i18n | 多语言界面支持 | P3 |

> **注**：跨空间恢复（F19）不是"跨工具迁移"，是 Restore 的自然扩展——
> 把快照恢复到另一个 Notion workspace，不是导出到 Obsidian/其他工具。

---

## 4. 技术架构设计

### 4.1 架构总览

```
                    ┌──────────────────────┐
                    │     用户终端          │
                    │  (CLI / Web UI)      │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │    核心调度器         │
                    │   (Orchestrator)     │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼───────┐ ┌─────▼──────┐ ┌───────▼───────┐
     │  Notion Reader │ │  Exporter  │ │   Storage    │
     │  (API 读取)     │ │ (MD+JSON)  │ │  (Git/Local) │
     └────────┬───────┘ └─────┬──────┘ └───────┬───────┘
              │                │                │
     ┌────────▼───────┐ ┌─────▼──────┐ ┌───────▼───────┐
     │  Notion API    │ │  Block →   │ │  Git Repo /  │
     │  (OAuth)       │ │  Markdown  │ │  Local FS /  │
     │                │ │  Renderer  │ │  S3 / WebDAV │
     └────────────────┘ └────────────┘ └───────────────┘
```

### 4.2 核心模块说明

#### Module 1: Notion Reader（读取器）

**职责**：通过 Notion 官方 API 读取 workspace 的全部内容

**已有基础**：我们的 `~/notion-backup/` 项目中 `migrate/discover.js` 已经实现了完整的递归遍历逻辑，包括：
- 页面树递归扫描（`blocks.children.list` → 发现 `child_page` / `child_database` → 递归）
- 数据库查询（`databases.query` 分页）
- 所有 block 类型处理

**改造要点**：
- 原来读取后写入另一个 Notion workspace → 现在改为读取后写入文件
- 保留原有的 rate limiting（350ms 间隔）
- 保留 fetch 绕过 SDK bug 的策略

```
输入：OAuth token + 根页面 ID
输出：NotionBlock 树（内存中的完整 workspace 快照）
```

#### Module 2: Exporter（导出器）

**职责**：将 Notion API 返回的 block 结构转换为人类可读的 Markdown + 机器可读的 JSON

**这是唯一需要从零开发的核心模块。**

**Block → Markdown 转换规则**：

| Notion Block Type | Markdown 输出 |
|---|---|
| paragraph | 普通文本 |
| heading_1 | `# 标题` |
| heading_2 | `## 标题` |
| heading_3 | `### 标题` |
| bulleted_list_item | `- 列表项` |
| numbered_list_item | `1. 列表项` |
| to_do | `- [ ]` 或 `- [x]` |
| toggle | `<details><summary>标题</summary>内容</details>` |
| code | ` ```lang\ncode\n``` ` |
| quote | `> 引用` |
| callout | `> 💡 引用块`（用 blockquote 模拟） |
| divider | `---` |
| image | `![alt](url)` |
| bookmark | `[标题](url)` |
| embed | `[嵌入内容](url)` |
| table | Markdown table |
| column_list | 按顺序平铺（Markdown 不支持分栏） |
| child_page | `[页面标题](./页面标题-abc12345/page.md)` |
| child_database | `[数据库标题](./数据库标题-abc12345/database.md)` |
| link_to_page | `[链接](目标路径)` |

**JSON 快照格式**（每个页面一个 `.json` 文件）：

```json
{
  "id": "页面ID",
  "url": "Notion 原始 URL",
  "title": "页面标题",
  "icon": { "type": "emoji", "emoji": "📄" },
  "cover": "https://...",
  "created_time": "2024-01-01T00:00:00.000Z",
  "last_edited_time": "2024-07-15T00:00:00.000Z",
  "created_by": { "object": "user", "id": "..." },
  "last_edited_by": { "object": "user", "id": "..." },
  "parent": { "type": "page_id", "page_id": "..." },
  "properties": { ... },
  "children": [
    { "type": "paragraph", "paragraph": { "rich_text": [...] } },
    { "type": "heading_1", "heading_1": { "rich_text": [...] } },
    ...
  ]
}
```

**为什么同时存 Markdown 和 JSON？**
- **Markdown**：人类可读，打开就能看，用于日常浏览
- **JSON**：机器可读，包含完整 API 数据，用于 Restore 恢复

> **注意**：Markdown 不追求被 Obsidian 或其他工具解析。
> 我们只服务"留在 Notion 的用户"，不服务"想离开 Notion 的用户"。

#### Module 2b: 数据库导出策略（方案 B）

**数据库不是普通页面**——它有 schema + 条目，需要专门的导出策略。

**设计决策**：一个数据库 = 两个文件（方案 B）

```
我的数据库-abc12345/
  database.md          ← schema 摘要 + 所有条目的索引表格（人看）
  database.json        ← 完整 API 数据：schema + 所有条目 + 每个条目的 blocks（Restore 用）
```

**database.md 结构**：

```markdown
# 我的数据库

> Notion URL: https://notion.so/abc12345
> 最后编辑: 2024-07-15T10:30:00Z
> 条目数: 42

## Schema

| 属性名 | 类型 | 说明 |
|---|---|---|
| 名称 | title | — |
| 状态 | status | 进行中/已完成/已归档 |
| 优先级 | select | P0/P1/P2 |
| 负责人 | people | — |
| 截止日期 | date | — |

## 条目索引

| 名称 | 状态 | 优先级 | 最后编辑 |
|---|---|---|---|
| [项目A](#项目a) | 进行中 | P0 | 2024-07-14 |
| [项目B](#项目b) | 已完成 | P1 | 2024-07-10 |
| ... | | | |
```

**database.json 结构**：

```json
{
  "id": "数据库ID",
  "title": "我的数据库",
  "url": "https://notion.so/...",
  "schema": {
    "名称": { "type": "title", "title": {} },
    "状态": { "type": "status", "status": { "options": [...] } },
    ...
  },
  "entries": [
    {
      "id": "条目页面ID",
      "properties": { "名称": { "title": [...] }, "状态": { "status": {...} } },
      "last_edited_time": "2024-07-14T...",
      "children": [
        { "type": "paragraph", "paragraph": { "rich_text": [...] } },
        ...
      ]
    },
    ...
  ]
}
```

**为什么不用方案 A（每条目独立文件）？**
- 我们不面向 Obsidian 迁移用户，不需要每个条目是独立 markdown 文件
- 方案 B 更简洁：42 个条目 = 2 个文件，不是 84 个文件
- Restore 时读一个 JSON 文件比遍历 42 个子目录更快
- Git diff 也能清晰看到"哪个数据库变了"

#### Module 2c: 完整 Block 类型覆盖表

> Markdown 导出器必须处理以下所有 block 类型。
> 未知类型输出为 HTML 注释，不崩溃。

| Notion Block Type | Markdown 输出 | 备注 |
|---|---|---|
| paragraph | 普通文本 | |
| heading_1 | `# 标题` | |
| heading_2 | `## 标题` | |
| heading_3 | `### 标题` | |
| bulleted_list_item | `- 列表项` | |
| numbered_list_item | `1. 列表项` | |
| to_do | `- [ ]` 或 `- [x]` | |
| toggle | `<details><summary>标题</summary>递归子块</details>` | **需递归处理子块** |
| code | ` ```lang\ncode\n``` ` | |
| quote | `> 引用` | |
| callout | `> 💡 引用块` | 用 blockquote 模拟，保留 icon |
| divider | `---` | |
| image | `![alt](url)` | URL 1小时过期，已知限制 |
| bookmark | `[标题](url)` | |
| embed | `[嵌入内容](url)` | |
| video | `[视频](url)` | |
| audio | `[音频](url)` | |
| file | `[文件名](url)` | |
| pdf | `[PDF](url)` | |
| table | Markdown table | **需先获取 children rows** |
| table_of_contents | `[目录]` | 静态输出，不自动生成 |
| equation | `$$ 公式 $$` | |
| column_list / column | 按顺序平铺 | Markdown 不支持分栏 |
| child_page | `[标题](./标题-abc12345/page.md)` | |
| child_database | `[标题](./标题-abc12345/database.md)` | |
| link_to_page | `[链接](目标路径)` | |
| synced_block | 递归处理内部子块 | 同步块内容展开 |
| breadcrumb | `<!-- breadcrumb -->` | 忽略 |
| unsupported | `<!-- unsupported block: TYPE -->` | 不崩溃 |

#### Module 3: Storage（存储层）

**职责**：将导出的文件写入目标存储

**Phase 1 只需实现两种**：
1. **Local**：写入本地目录
2. **Git**：写入 Git 仓库并自动 commit + push

**Git 集成策略**：

```bash
# 伪代码
1. 克隆/拉取目标仓库到临时目录
2. 将导出文件写入临时目录
3. git add .
4. git diff --cached --quiet → 如果无变化，跳过
5. git commit -m "backup: 2026-07-15 14:30 — 42 pages, 3 changed"
6. git push origin main
```

**Clean Diff 策略**（关键差异化）：
- 文件路径使用确定性命名：`{page-slug}-{pageId前8位}/page.md`
- JSON 输出做 key 排序（`JSON.stringify(obj, null, 2)` + sorted keys）
- 时间戳字段统一格式
- 避免每次备份都产生"无意义变化"的 diff

#### Module 4: 错误处理策略

> **备份过程中某个页面 API 报错了怎么办？**
> 这是弱 AI 执行时最容易卡住的地方。以下策略必须严格执行。

**核心原则：单页失败不中断整次备份。**

```
备份流程：
  for each page in tree:
    try:
      读取页面 → 导出 → 写入文件
      记录成功到 manifest.success[]
    except error:
      记录失败到 manifest.failed[]
      日志输出: "⚠️ 页面 XXX 失败: 错误信息"
      继续下一个页面  ← 不要中止！
  
  备份结束后:
    如果 manifest.failed 非空:
      日志输出摘要: "⚠️ 42 页成功, 3 页失败"
      manifest 中记录失败页面 ID + 错误原因
    下次备份时:
      优先重试 manifest.failed 中的页面
```

**manifest.json 错误记录格式**：

```json
{
  "timestamp": "2026-07-15T14:30:00Z",
  "stats": { "success": 42, "failed": 3, "skipped": 0 },
  "success": [
    { "id": "abc123", "title": "页面A", "hash": "sha256...", "lastEdited": "..." }
  ],
  "failed": [
    { "id": "def456", "title": "页面B", "error": "api_error: rate limited", "retryCount": 0 }
  ]
}
```

**重试策略**：
- 单个 API 调用失败：立即重试 1 次，间隔 2 秒
- 重试仍失败：记录到 failed 列表，继续下一个页面
- 下次备份运行时：failed 列表中的页面优先处理
- 连续 3 次备份都失败的页面：输出警告日志，建议用户检查该页面权限

**OAuth token 过期特殊处理**：
- token 过期会导致所有页面失败，不是单页问题
- 检测到连续 5 个页面都报 401 → 中止备份，提示用户重新授权
- 不要把 token 过期当单页错误处理

### 4.3 技术选型

| 层 | 选择 | 理由 |
|---|---|---|
| 语言 | TypeScript | 类型安全，Notion API 返回结构复杂，类型定义能减少错误 |
| Notion API | 官方 API + OAuth 2.0 | 不依赖 cookie，不过期（refresh token），长期稳定 |
| Git 操作 | simple-git (npm) | 成熟库，封装了所有 git 命令 |
| CLI 框架 | commander (npm) | Node.js 生态最成熟的 CLI 框架 |
| 配置 | YAML | 人类可读，比 JSON 更适合配置文件 |
| 日志 | winston 或 pino | 结构化日志 |
| 测试 | vitest | 快速、现代、零配置 |

### 4.4 安全性设计

| 项目 | 策略 |
|---|---|
| OAuth token 存储 | `~/.notion-snap/credentials.json`，文件权限 `0600`（仅 owner 可读写） |
| .gitignore | `.env`、`credentials.json`、`*.token` 必须在 .gitignore 中 |
| token 刷新 | access_token 有效期约 1 年，使用 refresh_token 自动续期 |
| 备份数据仓库 | 建议用户使用私有仓库，文档中明确提醒 |
| 不存储敏感信息 | manifest.json 中不记录 token、不记录完整 URL 中的敏感参数 |

### 4.5 测试策略

| 层 | 方法 | 覆盖目标 |
|---|---|---|
| 单元测试 | vitest + mock Notion API 响应 | markdown.ts（所有 block 类型）、path-naming.ts、incremental.ts |
| 集成测试 | 使用 tests/fixtures/ 中的真实 API 响应片段 | reader.ts + exporter.ts 联动 |
| E2E 测试 | 需要真实 Notion workspace | 备份 → 检查文件 → 恢复 → 检查结果 |

**Mock 数据准备**：
- `tests/fixtures/` 目录存放 Notion API 响应片段（从真实 API 脱敏后保存）
- 每种 block 类型至少一个 fixture
- 数据库 schema + 条目至少一个 fixture

---

## 5. 项目目录结构

```
notion-snap/
│
├── README.md                    # 项目入口（中英双语）
├── LICENSE                      # MIT
├── package.json
├── tsconfig.json
├── .env.example                 # 环境变量示例
├── docs/                        # 文档目录
│   ├── PDD.md                   # 本文档（产品设计文档）
│   ├── ARCHITECTURE.md          # 架构详细说明
│   ├── CONTRIBUTING.md          # 贡献指南
│   ├── API-QUIRKS.md            # Notion API 已知坑位
│   └── CHANGELOG.md             # 版本变更记录
│
├── src/
│   ├── index.ts                 # CLI 入口
│   ├── commands/                # CLI 命令
│   │   ├── backup.ts            # notion-snap backup
│   │   ├── restore.ts           # notion-snap restore
│   │   ├── init.ts              # notion-snap init (配置向导)
│   │   └── status.ts            # notion-snap status
│   │
│   ├── notion/                  # Notion API 适配层
│   │   ├── client.ts            # OAuth 认证 + API 客户端
│   │   ├── reader.ts            # 页面树递归读取器
│   │   ├── types.ts             # Notion API TypeScript 类型
│   │   └── rate-limit.ts        # 速率限制器
│   │
│   ├── exporter/                # 导出器
│   │   ├── markdown.ts          # Block → Markdown 转换
│   │   ├── json-snapshot.ts     # Block → JSON 快照
│   │   ├── manifest.ts          # manifest.json 生成
│   │   └── path-naming.ts       # 确定性路径命名
│   │
│   ├── storage/                 # 存储后端
│   │   ├── local.ts             # 本地文件存储
│   │   ├── git.ts               # Git 仓库存储
│   │   └── interface.ts         # 存储后端接口
│   │
│   ├── orchestrator/            # 核心调度
│   │   ├── backup-runner.ts     # 备份流程编排
│   │   ├── incremental.ts       # 增量检测逻辑
│   │   └── restore-runner.ts    # 恢复流程编排
│   │
│   └── utils/                   # 工具函数
│       ├── config.ts            # 配置文件加载
│       ├── logger.ts            # 日志
│       └── slug.ts              # 文件名安全化
│
├── tests/                       # 测试
│   ├── unit/                    # 单元测试
│   ├── fixtures/                # 测试数据（Notion API mock 响应）
│   └── e2e/                     # 端到端测试
│
└── examples/                    # 示例
    ├── notion-snap.yaml         # 配置文件示例
    └── github-action.yml        # GitHub Action 示例
```

---

## 6. 分阶段路线图

### 路线图总览（AI 执行节奏）

> ⚠️ 以下时间线基于 **AI 执行**，不是人类开发周期。
> AI 写代码只需几分钟，真正的耗时在于：人工操作（OAuth 授权）、
> 真实数据测试、边界 case 调试迭代。

```
Phase 1: MVP CLI ──────►  1 个 AI session（约 1-2 小时）
  "能把自己的 Notion 备份到 Git"
    │
Phase 2: Restore ──────►  1 个 AI session（约 1-2 小时）
  "能从备份恢复回 Notion"
    │
Phase 3: 体验完善 ─────►  2-3 个 AI session（约 3-5 小时）
  "Web UI + 调度 + 通知"
    │
Phase 4: 高级功能 ─────►  按需迭代
  "Docker + 多存储 + 迁移"
```

### Phase 1 详细分解（MVP CLI — 1 个 AI session）

```
Step 1: 脚手架 + 依赖安装                        ~5 min
  ├── TypeScript + commander + 目录结构
  └── npm install

Step 2: OAuth 认证                               ~15 min
  ├── 复用 ~/notion-backup/auth/authorize.js 逻辑
  └── 改写为 TypeScript

Step 3: 页面树遍历                               ~10 min
  ├── 复用 ~/notion-backup/migrate/discover.js
  └── 去掉 clone 调用，改为纯读取

Step 4: Block → Markdown 转换器                   ~20 min  ← 唯一真正的新代码
  ├── 参考 Notion block 类型文档
  └── 实现所有 block 类型的 Markdown 映射

Step 5: JSON 快照 + manifest.json                 ~10 min
Step 6: Git 集成（simple-git）                    ~10 min
Step 7: 增量检测（复用 incremental-sync 逻辑）     ~10 min
Step 8: 配置文件 + CLI 打磨                       ~10 min
Step 9: README + 文档                            ~10 min

—— 以上为纯 AI 写代码时间 ——

Step 10: 人工操作                                ~10 min（用户）
  ├── 在 Notion 创建 OAuth Integration
  ├── 运行 notion-snap init 浏览器授权
  └── 获取 root page ID

Step 11: 真实数据测试 + 调试迭代                   ~30-60 min
  ├── 跑首次备份，检查输出结构
  ├── 修复边界 case（未知 block 类型、空页面等）
  └── 验证 Git diff 是否 clean

发布 v0.1.0
```

### Phase 2 详细分解（Restore — 1 个 AI session）

```
Step 1: JSON → Notion Block 转换                  ~20 min
  ├── 复用 ~/notion-backup/migrate/clone.js 写入逻辑
  └── 适配为从 JSON 文件读取

Step 2: Restore 命令实现                          ~15 min
Step 3: dry-run 预览模式                         ~10 min
Step 4: 选择性恢复（指定页面/数据库）              ~15 min

—— 以上为纯 AI 写代码时间 ——

Step 5: 真实数据测试 + 调试                       ~30-60 min
  ├── 恢复到测试页面验证
  └── 确认 block 类型完整性

发布 v0.2.0
```

### 瓶颈说明

AI 写代码很快，但以下环节无法加速：

| 瓶颈 | 耗时 | 原因 |
|---|---|---|
| OAuth 创建 + 授权 | ~10 min | 需要用户在 Notion 网页手动操作 |
| 真实数据测试 | ~30-60 min | 必须跑真实 Notion API，受 rate limit 限制 |
| 边界 case 调试 | 不确定 | 取决于用户的 Notion 数据结构有多复杂 |
| 人工 review | 因人而异 | 用户确认输出正确后才推进下一步 |

---

## 7. 第一步行动指南（立即可执行）

> **此章节专为后续执行的 AI 编写。**
> **如果你是一个拿到这个文档的 AI，从这里开始读。**

### 7.1 前置条件检查

```bash
# 1. 确认 Node.js 版本 >= 18
node --version

# 2. 确认 Git 已安装
git --version

# 3. 确认有 GitHub 账号且已配置 SSH key 或 token
gh auth status
```

### 7.2 第一步：创建项目仓库

```bash
# 1. 在 GitHub 上创建新仓库：notion-snap
# 2. 克隆到本地
git clone git@github.com:<你的用户名>/notion-snap.git
cd notion-snap

# 3. 初始化 Node.js 项目
npm init -y

# 4. 安装核心依赖
npm install @notionhq/client commander simple-git yaml dotenv
npm install -D typescript @types/node vitest

# 5. 初始化 TypeScript
npx tsc --init
```

### 7.3 第二步：搭建项目骨架

按照 [第 5 节：项目目录结构](#5-项目目录结构) 创建所有目录和空文件。

### 7.4 第三步：实现 OAuth 认证

**参考代码**：`~/notion-backup/auth/authorize.js`

**核心流程**：
1. 用户在 Notion 创建 OAuth Integration（`notion.so/my-integrations`）
2. 获取 Client ID 和 Client Secret
3. 运行 `notion-snap init`，打开浏览器授权
4. 本地服务器接收 callback，交换 token
5. 保存 token 到 `~/.notion-snap/credentials.json`

### 7.5 第四步：实现页面遍历

**参考代码**：`~/notion-backup/migrate/discover.js`

**核心函数签名**：
```typescript
// 输入：Notion client + 根页面 ID
// 输出：完整的页面树结构
async function discoverTree(
  client: NotionClient, 
  rootPageId: string
): Promise<PageTreeNode>
```

### 7.6 第五步：实现 Markdown 导出

**这是最关键的新代码。** 需要实现一个 `blockToMarkdown(block)` 函数。

**测试方法**：准备几个典型的 Notion 页面，手动调用 API 获取 block 数据，然后测试转换结果。

---

## 8. 第二步行动指南

### 8.1 验证 MVP

当 Phase 1 的代码写完后，执行以下验证流程：

```bash
# 1. 配置 OAuth 凭证
cp .env.example .env
# 编辑 .env 填入 NOTION_CLIENT_ID 和 NOTION_CLIENT_SECRET

# 2. 初始化（OAuth 授权）
npx notion-snap init

# 3. 首次备份
npx notion-snap backup --root <根页面ID> --output ./backups

# 4. 验证输出
ls -la backups/
# 应该看到：
# backups/
#   manifest.json
#   我的页面-abc12345/
#     page.md
#     page.json
#   子页面-def67890/
#     page.md
#     page.json
#   项目数据库-ghi12345/
#     database.md          ← schema + 条目索引表
#     database.json        ← 完整 API 数据
```

### 8.2 配置 Git 自动备份

```bash
# 1. 创建私有仓库用于存放备份
# 2. 配置 notion-snap
cat > notion-snap.yaml << 'EOF'
source:
  root_page_id: "你的根页面ID"
storage:
  type: git
  repo: git@github.com:你的用户名/notion-backup-data.git
  branch: main
export:
  format: [markdown, json]
  timezone: Asia/Shanghai
EOF

# 3. 运行
npx notion-snap backup --config notion-snap.yaml
```

### 8.3 设置定时备份

```bash
# crontab -e
0 2 * * * cd /path/to/notion-snap && npx notion-snap backup --config notion-snap.yaml >> sync.log 2>&1
```

---

## 9. AI 执行手册（防傻瓜化）

> **这一节是给后续接手开发的 AI 看的。**
> **假设你是一个能力较弱的 AI，请严格按本节执行。**

### 9.1 你是谁、你要做什么

```
你是 NotionSnap 项目的开发者。
你拿到了这份 PDD 文档。
你的任务是按照路线图实现代码。
你可能会遇到问题——下面是你的"生存手册"。
```

### 9.2 黄金法则

```
规则 1: 不要跳步。按 Phase 1 → Phase 2 → Phase 3 顺序执行。
规则 2: 不要发明 API。Notion API 的行为以本文档第 10 节为准。
规则 3: 不要删除 JSON 快照。它是 Restore 功能的数据基础。
规则 4: 不要用 token_v2。只用 OAuth。
规则 5: 每完成一个模块就写测试。不要等全部写完再测。
规则 6: 如果遇到 Notion API 报错，先看第 10 节（已知坑位）。
规则 7: 文件路径用英文 slug + pageId 前 8 位，不要用中文文件名。
规则 8: Markdown 输出用 UTF-8，换行用 \n（Unix 风格）。
规则 9: 不要用 Notion SDK 的 databases.retrieve()，用 fetch 直接调 API。
规则 10: 所有写入 Notion 的操作，先清理 null 值。
规则 11: 单页失败不中断整次备份。记录到 manifest.failed，继续下一个页面。
规则 12: 连续 5 个页面报 401 → token 过期，中止备份，提示重新授权。
规则 13: 未知 block 类型输出 HTML 注释，不崩溃。
规则 14: 不追求 Markdown interop。Markdown 只给人看，不服务其他工具。
```

### 9.3 代码复用地图

**我们已有的代码在 `~/notion-backup/`，可以直接参考/复用：**

| 已有文件 | 复用到 | 改造方式 |
|---|---|---|
| `auth/authorize.js` | `src/notion/client.ts` | TypeScript 重写，逻辑基本不变 |
| `notion/client.js` | `src/notion/client.ts` | 去掉 destClient，只保留 source |
| `migrate/discover.js` | `src/notion/reader.ts` | 去掉 clone 调用，只保留遍历逻辑 |
| `migrate/clone.js` | `src/orchestrator/restore-runner.ts` | Phase 2 复用，block 创建逻辑 |
| `sync/incremental-sync.js` | `src/orchestrator/incremental.ts` | last_edited_time 对比逻辑复用 |

### 9.4 开发顺序检查清单

**每完成一步，打勾确认后再继续下一步。**

```
Phase 1 开发清单：

[ ] 1. 项目脚手架创建完成
    - package.json, tsconfig.json 就位
    - npm install 完成
    - 目录结构创建完成

[ ] 2. OAuth 认证流程实现
    - notion-snap init 能打开浏览器授权
    - token 保存到 ~/.notion-snap/credentials.json
    - token 过期时能自动 refresh

[ ] 3. 页面树遍历实现
    - 输入根页面 ID，能递归读取所有子页面
    - 能处理数据库（child_database）
    - 有速率限制（350ms 间隔）

[ ] 4. Markdown 导出实现（必须覆盖所有 block 类型）
    - paragraph → 普通文本 ✅
    - heading_1/2/3 → # ## ### ✅
    - bulleted_list_item → - text ✅
    - numbered_list_item → 1. text ✅
    - to_do → - [ ] / - [x] ✅
    - toggle → <details><summary> 递归子块 ✅
    - code → ```code``` ✅
    - quote → > text ✅
    - callout → > 💡 text ✅
    - divider → --- ✅
    - image → ![](url) ✅
    - bookmark / embed / video / audio / file / pdf ✅
    - equation → $$ 公式 $$ ✅
    - table → markdown table ✅
    - table_of_contents → [目录] ✅
    - column_list → 按顺序平铺 ✅
    - child_page → 链接到子目录 ✅
    - child_database → 链接到 database.md ✅
    - synced_block → 递归展开 ✅
    - link_to_page → 页面链接 ✅
    - 未知类型 → <!-- unsupported block: TYPE --> ✅

[ ] 5. JSON 快照实现
    - 每个页面一个 page.json
    - 每个数据库一个 database.json（包含 schema + 所有条目）
    - 包含完整 API 返回数据
    - JSON key 按字母排序（保证 diff 稳定）

[ ] 5a. 数据库导出实现
    - database.md：schema 摘要 + 条目索引表格
    - database.json：完整 API 数据（schema + entries + 每个条目的 children blocks）
    - 数据库条目查询分页处理（page_size=100，has_more 循环）

[ ] 5b. 错误处理实现
    - 单页失败 → 记录到 manifest.failed，继续备份
    - API 调用失败 → 重试 1 次，间隔 2 秒
    - 连续 5 个 401 → 中止，提示重新授权
    - manifest.json 包含 success/failed 列表

[ ] 6. Git 集成实现
    - 能 clone 目标仓库
    - 写入文件后能 commit + push
    - 无变化时不 commit（跳过空 diff）

[ ] 7. manifest.json 生成
    - 记录本次备份的元数据
    - 页面 ID 列表、标题、哈希、时间戳

[ ] 8. 增量检测实现
    - 对比上次 manifest.json
    - 只更新 last_edited_time 有变化的页面
    - 输出变更摘要（新增 N 页、更新 N 页、删除 N 页）

[ ] 9. 配置文件支持
    - notion-snap.yaml 加载
    - 支持 multiple backup jobs

[ ] 10. README.md 编写
    - 中英双语
    - 安装步骤
    - 使用示例
    - 配置说明

[ ] 11. 发布 v0.1.0
    - git tag v0.1.0
    - npm publish（可选）
    - GitHub Release
```

### 9.5 常见错误处理指南

```
错误：API rate limited
  → 检查 rate-limit.ts 的间隔是否 >= 350ms
  → 检查是否有并发请求（应该串行）

错误：oauth token expired
  → 检查 credentials.json 中的 expires_at
  → 用 refresh_token 换新 token
  → POST https://api.notion.com/v1/oauth/token

错误：block type not supported
  → 查看第 10 节已知坑位
  → 在 markdown.ts 中添加新的 block type 处理
  → 未知类型输出为 HTML 注释：<!-- unsupported block: XYZ -->

错误：git push failed
  → 检查 SSH key 或 token 是否有效
  → 检查目标仓库是否存在且可写
  → 检查分支名是否正确

错误：databases.retrieve() 返回不含 properties
  → 这是 Notion SDK 的已知 bug
  → 改用 fetch 直接调 API（见第 10 节）

错误：table block 创建失败
  → table block 必须带 children (rows)
  → 见第 10 节详细说明
```

### 9.6 给弱 AI 的代码模板

#### OAuth 客户端模板

```typescript
// src/notion/client.ts
import { Client } from '@notionhq/client';
import * as fs from 'fs';
import * as path from 'path';

const NOTION_VERSION = '2022-06-28';
const CREDENTIALS_PATH = path.join(
  process.env.HOME || '', '.notion-snap', 'credentials.json'
);

interface Credentials {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  workspace_name?: string;
}

export class NotionClient {
  private client: Client;
  private credentials: Credentials;

  constructor() {
    this.credentials = this.loadCredentials();
    this.client = new Client({ auth: this.credentials.access_token });
  }

  private loadCredentials(): Credentials {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error(
        '未找到 Notion 凭证。请先运行: notion-snap init'
      );
    }
    return JSON.parse(
      fs.readFileSync(CREDENTIALS_PATH, 'utf8')
    );
  }

  /**
   * 用 fetch 直接调 Notion API（绕过 SDK bug）
   * SDK 的 databases.retrieve() 可能返回不含 properties 的对象
   */
  async fetchAPI(method: string, apiPath: string, body?: any): Promise<any> {
    const resp = await fetch(`https://api.notion.com${apiPath}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.credentials.access_token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await resp.json();
    if (data.object === 'error') {
      throw new Error(`${data.code}: ${data.message}`);
    }
    return data;
  }

  // 速率限制包装器
  static async rateLimit(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 350));
  }
}
```

#### 页面遍历模板

```typescript
// src/notion/reader.ts
import { NotionClient } from './client';

export interface PageTreeNode {
  id: string;
  type: 'page' | 'database';
  title: string;
  url: string;
  lastEditedTime: string;
  children: PageTreeNode[];
  // 页面内容在导出时再获取（避免一次性加载太多到内存）
}

/**
 * 递归发现页面树
 * 参考：~/notion-backup/migrate/discover.js
 */
export async function discoverTree(
  client: NotionClient,
  rootPageId: string
): Promise<PageTreeNode> {
  // 1. 获取根页面信息
  const page = await client.fetchAPI('GET', `/v1/pages/${rootPageId}`);
  await NotionClient.rateLimit();

  // 2. 获取子块（child_page, child_database）
  const children = await listChildren(client, rootPageId);

  // 3. 递归处理每个子节点
  const childNodes: PageTreeNode[] = [];
  for (const child of children) {
    if (child.type === 'child_page') {
      childNodes.push(
        await discoverTree(client, child.id)
      );
    } else if (child.type === 'child_database') {
      childNodes.push({
        id: child.id,
        type: 'database',
        title: child.child_database.title,
        url: `https://notion.so/${child.id.replace(/-/g, '')}`,
        lastEditedTime: child.last_edited_time,
        children: [],
      });
    }
  }

  return {
    id: rootPageId,
    type: 'page',
    title: extractTitle(page),
    url: page.url,
    lastEditedTime: page.last_edited_time,
    children: childNodes,
  };
}

async function listChildren(
  client: NotionClient,
  blockId: string
): Promise<any[]> {
  const allBlocks: any[] = [];
  let cursor: string | undefined;

  do {
    const data = await client.fetchAPI(
      'GET',
      `/v1/blocks/${blockId}/children?page_size=100${
        cursor ? `&start_cursor=${cursor}` : ''
      }`
    );
    allBlocks.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
    await NotionClient.rateLimit();
  } while (cursor);

  return allBlocks;
}
```

#### Markdown 导出模板

```typescript
// src/exporter/markdown.ts

/**
 * 将 Notion block 转换为 Markdown
 * 输入：Notion API 返回的 block 对象
 * 输出：Markdown 字符串
 */
export function blockToMarkdown(block: any, depth: number = 0): string {
  const indent = '  '.repeat(depth);
  switch (block.type) {
    case 'paragraph':
      return indent + richTextToMarkdown(block.paragraph.rich_text);

    case 'heading_1':
      return `# ${richTextToMarkdown(block.heading_1.rich_text)}`;
    case 'heading_2':
      return `## ${richTextToMarkdown(block.heading_2.rich_text)}`;
    case 'heading_3':
      return `### ${richTextToMarkdown(block.heading_3.rich_text)}`;

    case 'bulleted_list_item':
      return `${indent}- ${richTextToMarkdown(block.bulleted_list_item.rich_text)}`;
    case 'numbered_list_item':
      return `${indent}1. ${richTextToMarkdown(block.numbered_list_item.rich_text)}`;

    case 'to_do':
      const checked = block.to_do.checked ? '[x]' : '[ ]';
      return `${indent}- ${checked} ${richTextToMarkdown(block.to_do.rich_text)}`;

    case 'code':
      const lang = block.code.language || '';
      const code = block.code.rich_text.map((t: any) => t.plain_text).join('');
      return `​```${lang}\n${code}\n​````;

    case 'quote':
      return `> ${richTextToMarkdown(block.quote.rich_text)}`;

    case 'callout':
      const icon = block.callout?.icon?.emoji || '💡';
      const calloutText = richTextToMarkdown(block.callout.rich_text);
      return `> ${icon} ${calloutText}`;

    case 'divider':
      return '---';

    case 'image':
      const imgUrl = block.image?.file?.url || block.image?.external?.url || '';
      const imgCaption = block.image?.caption?.map((t: any) => t.plain_text).join('') || '';
      return `![${imgCaption}](${imgUrl})`;

    case 'bookmark':
      return `[${block.bookmark.url}](${block.bookmark.url})`;

    case 'embed':
      return `[嵌入内容](${block.embed.url})`;

    case 'video':
      return `[视频](${block.video?.external?.url || block.video?.file?.url || ''})`;

    case 'audio':
      return `[音频](${block.audio?.external?.url || block.audio?.file?.url || ''})`;

    case 'file':
      return `[文件](${block.file?.external?.url || block.file?.file?.url || ''})`;

    case 'pdf':
      return `[PDF](${block.pdf?.external?.url || block.pdf?.file?.url || ''})`;

    case 'equation':
      return `$$ ${block.equation.expression} $$`;

    case 'table_of_contents':
      return `[目录]`;

    case 'toggle':
      const toggleTitle = richTextToMarkdown(block.toggle.rich_text);
      // toggle 需要递归处理子块
      const toggleChildren = (block.toggle.children || [])
        .map((child: any) => blockToMarkdown(child, depth + 1))
        .join('\n');
      return `<details><summary>${toggleTitle}</summary>\n\n${toggleChildren}\n\n</details>`;

    case 'synced_block':
      // 同步块：递归处理内部子块（展开内容）
      const syncedChildren = (block.synced_block.children || [])
        .map((child: any) => blockToMarkdown(child, depth))
        .join('\n');
      return syncedChildren;

    case 'column_list':
      // 分栏：按顺序平铺子块
      const columns = block.column_list?.children || [];
      const columnContent = columns
        .map((col: any) => (col.column?.children || [])
          .map((child: any) => blockToMarkdown(child, depth))
          .join('\n'))
        .join('\n');
      return columnContent;

    case 'child_page':
      return `[${block.child_page.title}](./${slugify(block.child_page.title)}-${block.id.slice(0, 8)}/page.md)`;

    case 'child_database':
      return `[${block.child_database.title}](./${slugify(block.child_database.title)}-${block.id.slice(0, 8)}/database.md)`;

    case 'link_to_page':
      const linked = block.link_to_page;
      if (linked?.type === 'page_id') {
        return `[页面链接](https://notion.so/${linked.page_id.replace(/-/g, '')})`;
      }
      return `<!-- link_to_page: ${linked?.type} -->`;

    case 'breadcrumb':
      return `<!-- breadcrumb -->`;

    case 'table':
      return tableToMarkdown(block);

    default:
      return `<!-- unsupported block type: ${block.type} -->`;
  }
}

/**
 * Notion rich_text 数组 → Markdown 字符串
 * 处理加粗、斜体、代码、链接等内联格式
 */
function richTextToMarkdown(richText: any[]): string {
  return richText.map(rt => {
    let text = rt.plain_text;

    if (rt.annotations?.bold) text = `**${text}**`;
    if (rt.annotations?.italic) text = `*${text}*`;
    if (rt.annotations?.code) text = `\`${text}\``;
    if (rt.annotations?.strikethrough) text = `~~${text}~~`;
    if (rt.href) text = `[${text}](${rt.href})`;

    return text;
  }).join('');
}

function tableToMarkdown(block: any): string {
  // Notion table 的 children 是行（table_row）
  // 需要在调用前先获取 children
  if (!block.table?.children?.results) {
    return `<!-- table: children not loaded -->`;
  }

  const rows = block.table.children.results;
  if (rows.length === 0) return '';

  const tableWidth = block.table.table_width || 1;
  const hasHeader = block.table.has_column_header;

  let md = '';
  rows.forEach((row: any, i: number) => {
    const cells = row.table_row?.cells || [];
    const cellTexts = cells.map((cell: any[]) =>
      cell.map(t => t.plain_text).join('')
    );
    md += `| ${cellTexts.join(' | ')} |\n`;

    if (hasHeader && i === 0) {
      md += `| ${Array(tableWidth).fill('---').join(' | ')} |\n`;
    }
  });

  return md;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
}
```

---

## 10. Notion API 已知坑位清单

> **以下坑位全部来自我们实战经验。**
> **这是我们比从零开始的竞品最大的技术优势。**

### 10.1 SDK Bug — databases.retrieve() 缺 properties

**问题**：`@notionhq/client` SDK 的 `databases.retrieve()` 在某些版本返回的对象不包含 `properties` 字段。

**影响**：无法获取数据库 schema，导致数据库克隆失败。

**解决方案**：不用 SDK，用 `fetch()` 直接调 API：
```javascript
const resp = await fetch(
  `https://api.notion.com/v1/databases/${dbId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
    },
  }
);
const db = await resp.json();
// db.properties 现在可用了
```

### 10.2 Table Block 创建必须带 rows

**问题**：Notion API 拒绝创建没有 children（行）的 `table` block。

**影响**：恢复时如果先创建空 table 再添加行，会报错。

**解决方案**：创建 table 时必须一次性带上所有行：
```javascript
{
  type: 'table',
  table: {
    table_width: 3,
    has_column_header: true,
    has_row_header: false,
    children: rows // 必须包含所有行
  }
}
```

### 10.3 Null 值导致验证错误

**问题**：Notion API 拒绝 block 数据中的 `null` 值（如 `icon: null`）。

**影响**：恢复时直接使用快照中的原始数据会报验证错误。

**解决方案**：递归清理所有 null/undefined：
```javascript
function cleanNulls(obj) {
  if (obj === null || obj === undefined) return undefined;
  if (typeof obj !== 'object') return obj;
  const cleaned = {};
  for (const [key, val] of Object.entries(obj)) {
    const cleanedVal = cleanNulls(val);
    if (cleanedVal !== undefined) {
      cleaned[key] = cleanedVal;
    }
  }
  return cleaned;
}
```

### 10.4 Database Schema 每种类型需要完整配置对象

**问题**：创建数据库时只传 `{ type: 'rich_text' }` 会失败。

**影响**：恢复数据库时 schema 重建失败。

**解决方案**：每种属性类型需要对应的配置对象：
```javascript
const SCHEMA_TEMPLATES = {
  rich_text: { rich_text: {} },
  title: { title: {} },
  select: { select: { options: [] } },
  multi_select: { multi_select: { options: [] } },
  number: { number: { format: 'number' } },
  checkbox: { checkbox: {} },
  url: { url: {} },
  email: { email: {} },
  phone_number: { phone_number: {} },
  date: { date: {} },
  status: { status: { options: [] } },
  people: { people: {} },
  files: { files: {} },
  relation: { relation: { ... } },
  // formula, rollup, created_time, created_by, last_edited_time, last_edited_by
  // → 这些是自动计算的，创建时不传
};
```

### 10.5 Database Page 属性 — Select/Status 用 name 匹配

**问题**：创建数据库页面时，select/status 属性的 option ID 在不同 workspace 间不通用。

**影响**：跨 workspace 恢复时，option ID 不匹配导致报错。

**解决方案**：只传 `name`，不传 `id`：
```javascript
// ❌ 错误
{ select: { id: "abc123", name: "P0", color: "default" } }

// ✅ 正确
{ select: { name: "P0" } }
```

### 10.6 速率限制

**问题**：Notion API 限制约 3 请求/秒。

**解决方案**：每个 API 调用之间等待 350ms：
```javascript
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 每次调用后
await sleep(350);
```

### 10.7 OAuth Scope 格式

**问题**：OAuth scope 是空格分隔，不是逗号分隔。

**正确格式**：
```
page.content.read page.properties.read
```

**错误格式**：
```
page.content.read,page.properties.read
```

### 10.8 OAuth 授权时必须选对 workspace

**问题**：用户在浏览器授权时，如果选错了 workspace，token 只能访问错误 workspace 的页面。

**解决方案**：授权后检查 token 响应中的 `workspace_name` 字段：
```javascript
const tokenResp = await exchangeCodeForToken(code);
console.log(`已连接 workspace: ${tokenResp.workspace_name}`);
// 如果不对，提示用户重新授权
```

### 10.9 跨 workspace 不兼容的属性

**问题**：以下数据库属性类型在跨 workspace 恢复时不兼容：
- `relation` — 关联的是另一个 workspace 的数据库
- `people` — 用户 ID 不通用
- `formula` — 引用其他属性的计算
- `rollup` — 引用关联数据库的属性
- `created_time`, `created_by`, `last_edited_time`, `last_edited_by` — 自动计算

**解决方案**：恢复时跳过这些属性，日志中记录跳过原因。

### 10.10 Notion File URL 会过期

**问题**：Notion API 返回的 `file.url`（图片、附件）是 S3 预签名 URL，有效期约 1 小时。

**影响**：备份的 Markdown 中如果引用了这些 URL，1 小时后图片就打不开了。

**解决方案（Phase 1 简单处理）**：
- 在 JSON 快照中保存原始 URL（用于 Restore）
- 在 Markdown 中保留 URL（短期可用）
- Phase 3 再实现：下载图片到本地，Markdown 引用本地路径

### 10.11 Append Children 必须用 PATCH，不是 POST

**问题**：Notion API 的 `blocks/{id}/children` 端点，**追加子块必须用 PATCH 方法**，不是 POST。用 POST 会返回 `invalid_request_url` 错误——这个错误信息极其误导，让人以为是 URL 格式问题。

**影响**：Restore 恢复时所有 block 创建都会失败。

**解决方案**：用 PATCH：
```javascript
// ❌ 错误 — 返回 invalid_request_url
await fetch(`https://api.notion.com/v1/blocks/${parentId}/children`, {
  method: 'POST',
  ...
});

// ✅ 正确 — 用 PATCH
await fetch(`https://api.notion.com/v1/blocks/${parentId}/children`, {
  method: 'PATCH',
  ...
});
```

**验证方法**：Notion SDK 的 `blocks.children.append` 方法用的就是 PATCH。查看 SDK 源码 `api-endpoints.js` 可以确认。

---

## 11. 竞争壁垒分析

### 11.1 我们的壁垒在哪里

```
壁垒 1: Notion API 实战经验（已验证）
  ├── 我们花了大量时间踩坑：SDK bug、table 创建、null 清理、
  │   schema 配置、rate limit、OAuth scope 格式……
  ├── 这些坑全部记录在 SKILL 和本文档第 10 节中
  └── 竞品开发者需要从零踩一遍

壁垒 2: Restore 恢复能力（独有）
  ├── 我们已经实现了 Notion→Notion 的完整克隆逻辑
  ├── 包括所有 block 类型、数据库 schema、数据库条目
  └── 竞品全部只做导出，不做恢复

壁垒 3: 增量同步逻辑（已实现）
  ├── last_edited_time 对比策略
  ├── 新增/更新/删除检测
  └── 竞品全部是全量导出，没有增量

壁垒 4: 开源 + 免费（对商业竞品）
  ├── NotionGitBackup 收 £9/月
  ├── 我们完全免费
  └── 开源社区可贡献代码
```

### 11.2 壁垒可持续性

| 壁垒 | 可被复制难度 | 持续时间 |
|---|---|---|
| API 实战经验 | 中（需时间踩坑） | 6-12 月（API 变化后需重新踩坑） |
| Restore 能力 | 高（需完整写入逻辑） | 12-24 月（无人做 = 持续领先） |
| 增量同步 | 中 | 6-12 月 |
| 开源社区 | 高（需社区信任） | 长期（随 star 增长而强化） |

---

## 12. 开源项目运营策略

### 12.1 GitHub 仓库设置

| 项目 | 设置 |
|---|---|
| 仓库名 | `notion-snap` |
| 描述 | "🫧 Open-source Notion backup & restore tool. OAuth-based, Git-friendly, with version history." |
| License | MIT |
| Topics | `notion`, `backup`, `open-source`, `markdown`, `restore`, `git` |
| 默认分支 | main |

### 12.2 README 结构

```markdown
# 🫧 NotionSnap

> 开源的 Notion 知识库备份与恢复工具

## ✨ 特性
- 🔐 OAuth 认证（不用 cookie）
- 📝 Markdown + JSON 双格式导出
- 🔄 Restore 恢复（市面唯一）
- 📊 Git 版本历史 + Clean Diff
- ⚡ 增量备份
- 🆓 完全免费 · MIT 开源

## 🚀 快速开始
（3 步安装 + 首次备份）

## 📖 文档
- 完整文档
- 配置说明
- Restore 指南
- API 坑位清单

## 🤝 贡献
欢迎 PR！

## 📄 License
MIT
```

### 12.3 发布节奏

| 版本 | 内容 | AI 执行时间 |
|---|---|---|
| v0.1.0 | MVP CLI（backup 命令） | ~1-2 小时（1 session） |
| v0.2.0 | Restore 命令 | ~1-2 小时（1 session） |
| v0.3.0 | 配置文件 + 增量优化 | ~1 小时（1 session） |
| v0.4.0 | Docker + 通知 | ~2 小时（1 session） |
| v1.0.0 | Web Dashboard + 稳定版 | ~3-5 小时（2-3 session） |

### 12.4 推广渠道

1. **GitHub** — Topics 标签 + README 精美设计
2. **Reddit** — r/Notion, r/selfhosted, r/opensource
3. **V2EX** — 中文开发者社区
4. **少数派** — 中文效率工具社区
5. **Product Hunt** — 开源新产品发布
6. **Notion 社区** — Notion 官方论坛/社区

---

## 📌 总结

```
NotionSnap 不是一个导出工具。
NotionSnap 是 Notion 工作空间的安全网。

我们做的是：
  备份 → 让你有副本
  恢复 → 让你有退路
  版本历史 → 让你有时间线
  开源免费 → 让所有人都能做到

我们不做的是：
  ❌ 跨工具迁移（Notion → Obsidian）——那是 Notion 自带导出的事
  ❌ 追求 Markdown interop——Markdown 只给人看

技术上我们已经有 60% 的基础：
  Notion API 适配 ✅
  增量同步逻辑 ✅
  跨空间克隆 ✅ (→ Restore 基础)
  OAuth 认证 ✅

需要补的 40%：
  Markdown 导出器 ← 核心新增（所有 block 类型）
  数据库导出（方案 B：database.md + database.json）
  Git 集成 ← 简单
  错误处理 ← 单页失败不中断
  CLI 包装 ← 简单
  Web UI ← Phase 3

第一步：创建仓库，搭脚手架，实现 OAuth + 遍历 + Markdown 导出 + 数据库导出
第二步：跑通首次备份，验证输出结构
第三步：加 Git 集成 + 错误处理，发布 v0.1.0
```

---

*本文档由 Hermes Agent (AI 产品总设计师) 编写*
*2026-07-15*