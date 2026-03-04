# Easy Paste 实现计划

## 概述

Easy Paste 是一个跨平台剪贴板管理器，使用 Tauri v2 + React + TypeScript + shadcn/ui 构建。

**核心需求:**
- 自动监听并保存剪贴板内容
- 仅支持文本和图片格式
- UI 使用 shadcn/ui
- 数据存储使用 SQLite
- 不支持云同步

---

## 1. 项目初始化

### 步骤 1.1: 创建 Tauri v2 项目

```bash
pnpm create tauri-app@latest . --template react-ts
```

### 步骤 1.2: 安装 shadcn/ui

```bash
pnpm add tailwindcss @tailwindcss/vite
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input scroll-area dropdown-menu
```

### 步骤 1.3: 项目结构

```
easy_paste/
├── src/                      # 前端源码
│   ├── components/
│   │   ├── ui/              # shadcn 组件
│   │   ├── ClipboardList.tsx
│   │   ├── ClipboardItem.tsx
│   │   └── SearchBar.tsx
│   ├── hooks/
│   │   ├── useClipboard.ts
│   │   └── useHistory.ts
│   ├── lib/
│   │   └── tauri.ts         # Tauri API 封装
│   ├── types/
│   │   └── clipboard.ts
│   └── App.tsx
├── src-tauri/                # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── commands/        # IPC 命令
│   │   ├── clipboard/       # 剪贴板监听
│   │   ├── database/        # SQLite 操作
│   │   └── models/          # 数据模型
│   ├── migrations/          # 数据库迁移
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

---

## 2. 数据库设计

```sql
CREATE TABLE IF NOT EXISTS clipboard_items (
    id TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,  -- 'text' 或 'image'
    text_content TEXT,           -- 文本内容
    image_data BLOB,             -- 图片数据 (Base64)
    created_at INTEGER NOT NULL, -- Unix 时间戳
    is_favorite INTEGER DEFAULT 0,
    metadata TEXT                -- JSON 额外数据
);

CREATE INDEX idx_created_at ON clipboard_items(created_at DESC);
CREATE INDEX idx_content_type ON clipboard_items(content_type);
```

---

## 3. Rust 后端架构

### 3.1 依赖 (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4"] }
tokio = { version = "1", features = ["full"] }
arboard = "3"              # 剪贴板访问
base64 = "0.22"            # 图片 Base64 编码
```

### 3.2 核心模块

**clipboard/monitor.rs** - 剪贴板监听器
- 每 500ms 轮询剪贴板
- 使用 hash 检测变化
- 通过 Tauri 事件通知前端

**commands/clipboard.rs** - IPC 命令
- `start_monitoring` - 开始监听
- `stop_monitoring` - 停止监听
- `copy_to_clipboard` - 复制到剪贴板

**commands/history.rs** - 历史管理
- `get_history` - 获取历史列表
- `get_item` - 获取单个条目
- `delete_item` - 删除条目
- `toggle_favorite` - 切换收藏

---

## 4. 前端架构

### 4.1 TypeScript 类型

```typescript
type ContentType = 'text' | 'image';

interface ClipboardItem {
  id: string;
  content_type: ContentType;
  text_content: string | null;
  image_data: string | null;
  created_at: number;
  is_favorite: boolean;
}

interface ClipboardItemPreview {
  id: string;
  content_type: ContentType;
  preview: string;
  created_at: number;
  is_favorite: boolean;
}
```

### 4.2 核心 Hooks

- `useClipboard()` - 管理剪贴板事件监听
- `useHistory()` - 管理历史记录 CRUD

### 4.3 组件

- `ClipboardList` - 历史列表
- `ClipboardItem` - 单个条目卡片
- `SearchBar` - 搜索和过滤

---

## 5. IPC API 设计

| 命令 | 参数 | 说明 |
|------|------|------|
| `start_monitoring` | - | 开始监听剪贴板 |
| `stop_monitoring` | - | 停止监听 |
| `copy_to_clipboard` | content, content_type | 复制到系统剪贴板 |
| `get_history` | limit, offset, content_type? | 获取历史列表 |
| `get_item` | id | 获取单个条目 |
| `delete_item` | id | 删除条目 |
| `toggle_favorite` | id | 切换收藏状态 |
| `search_history` | query, limit | 搜索文本内容 |

**事件:**
- `clipboard-changed` - 后端 → 前端，新剪贴板内容检测到

---

## 6. Tauri 配置

**tauri.conf.json:**
- 窗口: 400x600, 可调整大小
- 权限: SQL, 剪贴板读写, 事件

**capabilities/default.json:**
- `sql:default`, `sql:allow-execute`, `sql:allow-select`
- `clipboard-manager:default`
- `core:event:allow-emit`, `core:event:allow-listen`

---

## 7. 实现顺序

### 阶段 1: 项目搭建
1. 创建 Tauri v2 + React + TypeScript 项目
2. 安装 Tailwind CSS + shadcn/ui
3. 配置路径别名

### 阶段 2: 数据库层
1. 添加 tauri-plugin-sql
2. 创建迁移脚本
3. 实现 CRUD 操作

### 阶段 3: 剪贴板监听
1. 添加 arboard crate
2. 实现轮询监听机制
3. 实现文本和图片检测
4. 发送事件到前端

### 阶段 4: IPC 命令
1. 定义所有 Rust 命令
2. 实现剪贴板控制命令
3. 实现历史管理命令

### 阶段 5: 前端核心
1. 创建类型定义
2. 实现 Tauri API 封装
3. 创建自定义 Hooks
4. 构建组件

### 阶段 6: 集成与测试
1. 连接前后端
2. 实现点击复制功能
3. 添加键盘快捷键
4. 测试完整流程

---

## 8. 验证方法

1. **运行开发服务器:** `pnpm tauri dev`
2. **测试剪贴板监听:** 复制文本/图片，检查是否出现在列表
3. **测试历史管理:** 删除、收藏、搜索功能
4. **测试跨平台:** 在 macOS/Windows/Linux 上验证

---

## 9. 关键文件

- `src-tauri/src/lib.rs` - Tauri 应用入口
- `src-tauri/src/clipboard/monitor.rs` - 剪贴板监听核心
- `src-tauri/src/commands/history.rs` - 历史管理命令
- `src/hooks/useClipboard.ts` - 前端剪贴板 Hook
- `src-tauri/tauri.conf.json` - Tauri 配置