# Easy Paste - Implementation Plan

## Context
Easy Paste is a cross-platform clipboard manager to be built with Tauri v2 (Rust backend) + React + TypeScript (frontend). The project currently has no code - only README.md and CLAUDE.md files. This plan outlines the initial project setup and core architecture.

## Architecture Overview

```
easy_paste/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Main entry point
│   │   ├── clipboard.rs    # Clipboard operations
│   │   ├── history.rs      # History management
│   │   └── storage.rs      # Data persistence
│   └── Cargo.toml
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Implementation Steps

### Step 1: Initialize Tauri v2 Project
- Run `pnpm create tauri-app` with React + TypeScript template
- Configure Vite for Tauri v2
- Set up basic project structure

### Step 2: Configure Dependencies
**Frontend (package.json):**
- React 18+
- TypeScript
- Tailwind CSS (for styling)
- Vitest (for testing)

**Backend (Cargo.toml):**
- tauri v2
- clipboard-rs or arboard (clipboard access)
- serde/serde_json (serialization)
- sqlx or rusqlite (data persistence)

### Step 3: Backend - Clipboard Module
Create `src-tauri/src/clipboard.rs`:
- Monitor clipboard changes
- Read/write clipboard content (text, images)
- Handle different content types

### Step 4: Backend - History Module
Create `src-tauri/src/history.rs`:
- Store clipboard history items
- Search/filter functionality
- Delete/manage entries

### Step 5: Backend - Storage Module
Create `src-tauri/src/storage.rs`:
- Persistent storage (SQLite)
- Load history on startup
- Save changes on clipboard events

### Step 6: IPC Commands
Define Tauri commands in `lib.rs`:
- `get_history()` - Retrieve clipboard history
- `copy_to_clipboard(id)` - Copy item to clipboard
- `delete_item(id)` - Remove from history
- `clear_history()` - Clear all history
- `search_history(query)` - Search entries

### Step 7: Frontend - UI Components
- `HistoryList` - Display clipboard history
- `HistoryItem` - Single history entry
- `SearchBar` - Filter history
- `App` - Main window layout

### Step 8: Frontend - State Management
- Use React hooks for state (or Zustand if needed)
- Connect to Tauri backend via IPC

## Decisions
- **Storage**: SQLite (lightweight, embedded, good for search)
- **UI Style**: Tailwind CSS (fast prototyping)
- **State**: React useState/useContext (simple, built-in)

## Key Files to Create

1. `src-tauri/Cargo.toml` - Rust dependencies
2. `src-tauri/tauri.conf.json` - Tauri configuration
3. `src-tauri/src/lib.rs` - Main backend entry
4. `src-tauri/src/clipboard.rs` - Clipboard operations
5. `src-tauri/src/history.rs` - History management
6. `src-tauri/src/storage.rs` - Persistence layer
7. `src/App.tsx` - Main React component
8. `src/main.tsx` - Frontend entry point
9. `package.json` - Frontend dependencies
10. `vite.config.ts` - Build configuration
11. `tsconfig.json` - TypeScript config

## Verification
- Run `pnpm tauri dev` to start the app
- Verify clipboard monitoring works
- Test copy/paste functionality
- Verify history persists across restarts
- Run `pnpm test` for frontend tests

## Platform Considerations
- **macOS**: Request accessibility permissions for clipboard monitoring
- **Windows**: Should work out of the box
- **Linux**: Support both X11 and Wayland