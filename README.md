# Easy Paste

A cross-platform clipboard manager built with Tauri v2, React, and TypeScript.

## Features

- **Automatic Clipboard Monitoring** - Automatically captures clipboard content changes
- **History Management** - Stores and displays clipboard history with search functionality
- **Favorites** - Mark frequently used items as favorites for quick access
- **Local Storage** - All data stored locally using SQLite for privacy
- **Cross-Platform** - Supports macOS, Windows, and Linux

## Tech Stack

- **Backend**: Rust (Tauri v2)
- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: SQLite (rusqlite)
- **Build**: Vite + pnpm

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/)

### Installation

```bash
# Clone the repository
git clone https://github.com/zhangdeyu/easy_paste.git
cd easy_paste

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Development

```bash
# Start development server
pnpm tauri dev

# Check Rust code
cargo check --manifest-path src-tauri/Cargo.toml

# Build frontend
pnpm build
```

## Project Structure

```
easy_paste/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # API and utilities
│   └── types/              # TypeScript definitions
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── clipboard/      # Clipboard monitoring
│   │   ├── commands/       # IPC command handlers
│   │   └── database/       # SQLite operations
│   └── tauri.conf.json     # Tauri configuration
└── package.json
```

## Platform Notes

- **macOS**: Requires accessibility permissions for clipboard monitoring
- **Windows**: Works out of the box
- **Linux**: Supports X11 and Wayland

## License

MIT

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)