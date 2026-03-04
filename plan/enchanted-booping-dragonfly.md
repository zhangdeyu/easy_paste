# Easy Paste 实现方案

## 背景

Easy Paste 是一个跨平台剪贴板管理器项目，目前处于初始化阶段（只有文档，无代码）。本方案将指导从零开始构建完整应用。

**技术栈**：
- 后端: Rust (Tauri v2)
- 前端: React + TypeScript
- 构建: Vite + Tauri v2
- 测试: Vitest
- 包管理: pnpm

---

## 项目结构

```
easy_paste/
├── src/                          # 前端 React
│   ├── components/
│   │   ├── ClipboardList.tsx     # 历史记录列表
│   │   ├── ClipboardItem.tsx     # 单条记录
│   │   ├── SearchBar.tsx         # 搜索栏
│   │   └── SettingsPanel.tsx     # 设置面板
│   ├── hooks/
│   │   ├── useClipboard.ts       # 剪贴板操作
│   │   └── useShortcut.ts        # 快捷键
│   ├── stores/
│   │   └── clipboardStore.ts     # Zustand 状态
│   ├── types/
│   │   └── clipboard.ts          # TypeScript 类型
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs               # 入口
│   │   ├── clipboard/
│   │   │   ├── mod.rs
│   │   │   ├── monitor.rs        # 剪贴板监控
│   │   │   └── operations.rs     # 读写操作
│   │   ├── storage/
│   │   │   ├── mod.rs
│   │   │   └── database.rs       # SQLite 存储
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   └── handlers.rs       # IPC 命令处理
│   │   └── platform/
│   │       ├── mod.rs
│   │       ├── macos.rs          # macOS 特定
│   │       ├── windows.rs        # Windows 特定
│   │       └── linux.rs          # Linux 特定
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── vite.config.ts
```

---

## 核心数据结构

```rust
// Rust 后端
pub struct ClipboardEntry {
    pub id: String,           // UUID
    pub content: ClipboardContent,
    pub content_type: ContentType,
    pub source_app: Option<String>,
    pub created_at: i64,
    pub is_favorite: bool,
    pub preview: String,      // 前100字符预览
}

pub enum ClipboardContent {
    Text(String),
    Image(Vec<u8>),
    FileList(Vec<String>),
}
```

---

## 实现步骤

### 阶段 1: 项目初始化

1. 使用 pnpm 创建 Tauri v2 项目
   ```bash
   pnpm create tauri-app@latest
   ```
2. 配置 TypeScript + Vite
3. 安装依赖：
   - Rust: tauri, serde, tokio, rusqlite, uuid, chrono
   - 前端: react, zustand, @tauri-apps/api

### 阶段 2: 后端核心功能

1. **剪贴板监控** (`src-tauri/src/clipboard/monitor.rs`)
   - 基于轮询的方式 (默认 100ms 间隔)
   - 使用 SHA-256 哈希检测内容变化
   - 变化时触发事件通知前端

2. **数据持久化** (`src-tauri/src/storage/database.rs`)
   - SQLite 存储，单文件数据库
   - 数据库位置：
     - macOS: `~/Library/Application Support/easy-paste/`
     - Windows: `%APPDATA%/easy-paste/`
     - Linux: `~/.local/share/easy-paste/`

3. **IPC 命令** (`src-tauri/src/commands/handlers.rs`)
   - `get_clipboard_history` - 获取历史记录
   - `search_clipboard` - 搜索历史
   - `paste_clipboard_entry` - 粘贴指定条目
   - `delete_clipboard_entry` - 删除条目
   - `toggle_favorite` - 切换收藏
   - `clear_history` - 清空历史

### 阶段 3: 前端 UI

1. **状态管理** (Zustand)
   - entries: 历史记录列表
   - searchQuery: 搜索关键词
   - selectedId: 当前选中

2. **核心组件**
   - ClipboardList: 历史记录列表
   - ClipboardItem: 单条记录 (双击粘贴)
   - SearchBar: 搜索输入 (防抖 300ms)
   - SettingsPanel: 设置面板

3. **事件监听**
   - 监听 `clipboard:changed` 事件更新列表

### 阶段 4: 系统集成

1. **系统托盘**
   - 显示/隐藏主窗口
   - 快速访问最近记录
   - 退出应用

2. **全局快捷键**
   - `Cmd/Ctrl+Shift+V`: 打开历史窗口
   - `Cmd/Ctrl+Shift+C`: 清空历史

3. **平台特定**
   - macOS: 辅助功能权限处理
   - Windows: 无需特殊权限
   - Linux: X11/Wayland 兼容

### 阶段 5: 测试与发布

1. 单元测试 (Vitest + Rust tests)
2. 集成测试 (IPC 命令)
3. CI/CD 配置
4. 多平台构建

---

## 关键依赖

### Rust (Cargo.toml)
```toml
[dependencies]
tauri = { version = "2", features = ["system-tray"] }
tauri-plugin-global-shortcut = "2"
serde = { version = "1", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
dirs = "5"
sha2 = "0.10"
```

### 前端 (package.json)
```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "@tauri-apps/api": "^2",
    "zustand": "^4"
  },
  "devDependencies": {
    "typescript": "^5",
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "vitest": "^1",
    "@tauri-apps/cli": "^2"
  }
}
```

---

## 平台注意事项

| 平台 | 权限 | 剪贴板方式 |
|------|------|-----------|
| macOS | 辅助功能权限 | 轮询 |
| Windows | 无 | Win32 API 或轮询 |
| Linux | 无 | X11(XFixes事件) / Wayland(轮询) |

---

## 验证方法

1. **阶段 1 完成验证**:
   - 运行 `pnpm tauri dev` 启动应用
   - 确认窗口显示正常

2. **阶段 2 完成验证**:
   - 复制文本，确认自动记录到数据库
   - 调用 IPC 命令获取历史记录

3. **阶段 3 完成验证**:
   - UI 正确显示历史记录
   - 搜索功能正常
   - 双击条目可粘贴

4. **阶段 4 完成验证**:
   - 系统托盘图标显示
   - 全局快捷键响应
   - 三平台测试通过