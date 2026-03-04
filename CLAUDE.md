# Easy Paste - Cross-Platform Desktop App

## Project Overview
Easy Paste is a cross-platform clipboard manager supporting macOS, Windows, and Linux.

## Tech Stack
- **Backend**: Rust (Tauri v2)
- **Frontend**: React + TypeScript
- **Build**: Vite + Tauri v2
- **Test**: Vitest
- **Package Manager**: pnpm

## Development Guidelines

### Cross-Platform Strategy
- Use Tauri for native performance and small bundle size
- Share 95%+ code across platforms
- Platform-specific code handled in Rust backend when needed
- Single codebase for macOS, Windows, Linux

### Code Quality
- Follow Rust best practices and idioms
- Follow frontend framework conventions
- Keep components small and focused
- Use TypeScript for type safety

### Design Principles
- **No over-engineering**: Keep solutions simple and focused
- **Minimal complexity**: Only add abstraction when clearly needed
- **Native feel**: Respect platform conventions (shortcuts, appearance)
- **Performance first**: Low memory footprint, fast startup

### Architecture
- Frontend: UI state management, user interactions
- Backend (Rust): Clipboard operations, system integration, data persistence
- IPC: Clear API boundary between frontend and backend

### Platform-Specific Notes
- **macOS**: Accessibility permissions for clipboard monitoring
- **Windows**: No special permissions needed
- **Linux**: X11/Wayland clipboard support