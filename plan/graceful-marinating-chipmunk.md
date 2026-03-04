# Easy Paste 完整实现方案

## 一、项目概述

Easy Paste 是一个跨平台剪贴板管理器，支持 macOS、Windows 和 Linux。

**核心功能**：
- 剪贴板历史记录（自动监控、保存历史）
- 多格式支持（文本、图片、文件）
- 快捷键快速唤起与粘贴
- 搜索与收藏功能
- 数据本地持久化

---

## 二、技术架构

### 2.1 技术栈选择

| 层级 | 技术 | 说明 |
|------|------|------|
| 框架 | Tauri v2 | 轻量级跨平台方案 |
| 后端 | Rust | 高性能、内存安全 |
| 前端 | React 18 + TypeScript | 现代化 UI 开发 |
| 构建 | Vite | 快速 HMR |
| 样式 | Tailwind CSS + shadcn/ui | 轻量、可定制 |
| 数据库 | SQLite (rusqlite) | 轻量、高性能 |
| 测试 | Vitest | 前端单元测试 |

### 2.2 项目结构

```
easy_paste/
├── src/                          # 前端源码
│   ├── components/               # UI 组件
│   │   ├── ui/                   # shadcn/ui 基础组件
│   │   ├── ClipboardList.tsx     # 历史列表
│   │   ├── ClipboardItem.tsx     # 单条记录
│   │   ├── SearchBar.tsx         # 搜索栏
│   │   └── PreviewPane.tsx       # 预览面板
│   ├── hooks/                    # 自定义 Hooks
│   │   ├── useClipboard.ts       # 剪贴板操作
│   │   └── useShortcuts.ts       # 快捷键
│   ├── stores/                   # 状态管理 (Zustand)
│   │   └── clipboardStore.ts
│   ├── lib/                      # 工具函数
│   │   ├── tauri.ts              # Tauri IPC 封装
│   │   └── utils.ts
│   ├── types/                    # TypeScript 类型
│   │   └── clipboard.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── lib.rs                # 入口
│   │   ├── clipboard/            # 剪贴板模块
│   │   │   ├── mod.rs
│   │   │   ├── monitor.rs        # 剪贴板监控
│   │   │   └── types.rs          # 类型定义
│   │   ├── database/             # 数据库模块
│   │   │   ├── mod.rs
│   │   │   └── models.rs
│   │   ├── commands/             # IPC 命令
│   │   │   ├── mod.rs
│   │   │   └── clipboard.rs
│   │   └── utils/                # 工具函数
│   │       └── mod.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 三、后端架构 (Rust)

### 3.1 核心模块

#### 3.1.1 剪贴板监控 (`src-tauri/src/clipboard/monitor.rs`)

```rust
use tauri::{AppHandle, Emitter};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

pub struct ClipboardMonitor {
    running: AtomicBool,
}

impl ClipboardMonitor {
    pub fn start(app_handle: AppHandle) -> Self {
        let running = AtomicBool::new(true);
        let running_clone = running.clone();

        thread::spawn(move || {
            let mut last_content = String::new();

            while running_clone.load(Ordering::SeqCst) {
                // 跨平台剪贴板读取
                if let Ok(content) = read_clipboard_text() {
                    if content != last_content && !content.is_empty() {
                        last_content = content.clone();

                        // 发送事件到前端
                        app_handle.emit("clipboard-changed", content).ok();
                    }
                }
                thread::sleep(Duration::from_millis(200));
            }
        });

        Self { running }
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}
```

#### 3.1.2 数据模型 (`src-tauri/src/database/models.rs`)

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardItem {
    pub id: i64,
    pub content_type: ContentType,
    pub content: String,
    pub preview: String,
    pub is_favorite: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContentType {
    Text,
    Image,
    File,
    RichText,
}

pub struct Database {
    conn: rusqlite::Connection,
}

impl Database {
    pub fn new(app_data_dir: &Path) -> Result<Self, Error> {
        let db_path = app_data_dir.join("clipboard.db");
        let conn = rusqlite::Connection::open(db_path)?;

        // 创建表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS clipboard_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content_type TEXT NOT NULL,
                content TEXT NOT NULL,
                preview TEXT,
                is_favorite BOOLEAN DEFAULT FALSE,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )?;

        Ok(Self { conn })
    }

    pub fn insert(&self, item: &ClipboardItem) -> Result<i64, Error> { ... }
    pub fn get_all(&self, limit: i64, offset: i64) -> Result<Vec<ClipboardItem>, Error> { ... }
    pub fn search(&self, query: &str) -> Result<Vec<ClipboardItem>, Error> { ... }
    pub fn toggle_favorite(&self, id: i64) -> Result<(), Error> { ... }
    pub fn delete(&self, id: i64) -> Result<(), Error> { ... }
}
```

#### 3.1.3 IPC 命令 (`src-tauri/src/commands/clipboard.rs`)

```rust
use tauri::State;
use crate::database::models::{ClipboardItem, Database};

#[tauri::command]
pub async fn get_clipboard_history(
    db: State<'_, Database>,
    limit: i64,
    offset: i64,
) -> Result<Vec<ClipboardItem>, String> {
    db.get_all(limit, offset)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_clipboard(
    db: State<'_, Database>,
    query: String,
) -> Result<Vec<ClipboardItem>, String> {
    db.search(&query)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_favorite(
    db: State<'_, Database>,
    id: i64,
) -> Result<(), String> {
    db.toggle_favorite(id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn copy_to_clipboard(
    content: String,
) -> Result<(), String> {
    write_clipboard_text(&content)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_item(
    db: State<'_, Database>,
    id: i64,
) -> Result<(), String> {
    db.delete(id)
        .map_err(|e| e.to_string())
}
```

### 3.2 依赖 (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
chrono = "0.4"
thiserror = "1"
tokio = { version = "1", features = ["full"] }
clipboard-master = "0.2"  # 跨平台剪贴板监控
arboard = "3.4"           # 跨平台剪贴板操作
dirs = "5"
```

---

## 四、前端架构 (React)

### 4.1 状态管理 (Zustand)

```typescript
// src/stores/clipboardStore.ts
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface ClipboardItem {
  id: number;
  contentType: 'text' | 'image' | 'file';
  content: string;
  preview: string;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
}

interface ClipboardStore {
  items: ClipboardItem[];
  favorites: ClipboardItem[];
  searchQuery: string;
  isLoading: boolean;

  fetchItems: () => Promise<void>;
  searchItems: (query: string) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  copyToClipboard: (content: string) => Promise<void>;
  deleteItem: (id: number) => Promise<void>;
}

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  items: [],
  favorites: [],
  searchQuery: '',
  isLoading: false,

  fetchItems: async () => {
    set({ isLoading: true });
    const items = await invoke<ClipboardItem[]>('get_clipboard_history', {
      limit: 100,
      offset: 0,
    });
    set({ items, isLoading: false });
  },

  // ... 其他方法
}));
```

### 4.2 核心组件

```typescript
// src/components/ClipboardList.tsx
import { useClipboardStore } from '@/stores/clipboardStore';
import { ClipboardItem } from './ClipboardItem';
import { useEffect } from 'react';

export function ClipboardList() {
  const { items, fetchItems, isLoading } = useClipboardStore();

  useEffect(() => {
    fetchItems();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <SearchBar />
      </div>
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            加载中...
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <ClipboardItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### 4.3 快捷键监听

```typescript
// src/hooks/useShortcuts.ts
import { useEffect } from 'react';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';

export function useShortcuts() {
  useEffect(() => {
    // 注册全局快捷键: Cmd/Ctrl + Shift + V
    register('CommandOrControl+Shift+V', () => {
      // 显示主窗口
      invoke('show_window');
    });

    return () => {
      unregister('CommandOrControl+Shift+V');
    };
  }, []);
}
```

### 4.4 前端依赖 (package.json)

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-global-shortcut": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "vitest": "^1.6.0"
  }
}
```

---

## 五、初始化步骤

### 5.1 项目初始化命令

```bash
# 1. 创建 Tauri 项目
pnpm create tauri-app@latest easy_paste --template react-ts

# 2. 安装前端依赖
cd easy_paste
pnpm add zustand clsx tailwind-merge lucide-react
pnpm add -D tailwindcss postcss autoprefixer

# 3. 初始化 Tailwind
pnpm dlx tailwindcss init -p

# 4. 初始化 shadcn/ui
pnpm dlx shadcn@latest init

# 5. 添加常用组件
pnpm dlx shadcn@latest add button input scroll-area separator dialog

# 6. 安装 Tauri 插件
pnpm add @tauri-apps/plugin-global-shortcut @tauri-apps/plugin-shell
```

### 5.2 Tauri 配置 (tauri.conf.json)

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Easy Paste",
  "version": "0.1.0",
  "identifier": "com.easypaste.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "pnpm build",
    "beforeDevCommand": "pnpm dev"
  },
  "app": {
    "windows": [
      {
        "title": "Easy Paste",
        "width": 400,
        "height": 600,
        "resizable": true,
        "visible": false,
        "decorations": true,
        "transparent": false
      }
    ],
    "security": {
      "csp": null
    },
    "trayIcon": {
      "iconPath": "icons/icon.png",
      "iconAsTemplate": true
    },
    "macOSPrivateApi": true
  },
  "plugins": {
    "global-shortcut": {}
  }
}
```

### 5.3 权限配置 (macOS)

需要在 `Info.plist` 中添加：
```xml
<key>NSAppleEventsUsageDescription</key>
<string>Easy Paste needs accessibility access to monitor clipboard.</string>
```

---

## 六、功能实现细节

### 6.1 剪贴板监控流程

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ 剪贴板变化检测   │────▶│  读取内容      │────▶│  保存到数据库   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   前端更新列表   │◀────│  发送事件通知   │◀────│  生成预览文本   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 6.2 快捷键流程

```
用户按下 Cmd+Shift+V
        │
        ▼
全局快捷键捕获
        │
        ▼
显示/隐藏主窗口
        │
        ▼
窗口显示时聚焦搜索框
```

### 6.3 搜索功能

- 支持模糊搜索
- 高亮匹配文本
- 实时搜索 (防抖 200ms)

---

## 七、实现计划

### Phase 1: 项目初始化 (Day 1)
1. 创建 Tauri 项目结构
2. 配置前端构建工具 (Vite + Tailwind)
3. 配置 shadcn/ui 组件库
4. 设置 TypeScript 配置

### Phase 2: 后端核心 (Day 2-3)
1. 实现数据库模型与迁移
2. 实现剪贴板监控模块
3. 实现 IPC 命令层
4. 测试 Rust 核心功能

### Phase 3: 前端 UI (Day 4-5)
1. 实现状态管理 (Zustand)
2. 实现核心组件 (列表、搜索、预览)
3. 实现快捷键监听
4. 对接后端 IPC

### Phase 4: 系统集成 (Day 6)
1. 系统托盘功能
2. 全局快捷键
3. 开机自启动
4. 权限处理

### Phase 5: 测试与优化 (Day 7)
1. 单元测试
2. 跨平台测试
3. 性能优化
4. 打包发布

---

## 八、验证方式

### 功能测试
1. **剪贴板监控**: 复制文本后检查是否自动记录
2. **历史列表**: 验证列表正确显示所有历史
3. **搜索功能**: 输入关键词验证搜索结果
4. **快捷键**: 按 Cmd+Shift+V 验证窗口唤起
5. **收藏功能**: 点击收藏验证状态持久化

### 性能测试
- 启动时间 < 500ms
- 内存占用 < 50MB
- 支持 10000+ 历史记录无卡顿

---

## 九、关键文件清单

| 文件 | 用途 |
|------|------|
| `src-tauri/src/lib.rs` | Rust 入口，注册命令和状态 |
| `src-tauri/src/clipboard/monitor.rs` | 剪贴板监控核心逻辑 |
| `src-tauri/src/database/models.rs` | 数据模型和数据库操作 |
| `src-tauri/src/commands/clipboard.rs` | IPC 命令定义 |
| `src-tauri/tauri.conf.json` | Tauri 配置 |
| `src/stores/clipboardStore.ts` | 前端状态管理 |
| `src/components/ClipboardList.tsx` | 主列表组件 |
| `src/hooks/useShortcuts.ts` | 快捷键 Hook |
| `src/App.tsx` | 应用入口 |