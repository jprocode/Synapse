# Synapse

A **local-first, privacy-focused knowledge base** built as a native desktop application. Synapse lets you create, organize, and edit rich Markdown notes — all stored locally on your machine. No cloud, no accounts, no tracking. Your notes, your data.

---

## Getting Started

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **Rust** | 1.70+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Tauri CLI** | 2.0+ | Included via `@tauri-apps/cli` dev dependency |

> **macOS Note:** Xcode Command Line Tools required — run `xcode-select --install` if not already installed.

### Installation

```bash
# Clone the repository
git clone https://github.com/jprocode/Synapse.git
cd Synapse

# Install dependencies
npm install
```

### Running the App

```bash
# Development mode (launches desktop window with hot-reload)
npx tauri dev # you only need to run this command in development mode

# Build production binary
npx tauri build
```

### Useful Commands

```bash
# Type-check the frontend (no output = all good)
npx tsc --noEmit

# Check Rust backend compiles
cd src-tauri && cargo check

# Run Vite dev server only (frontend preview, no Tauri backend)
npm run dev

# Clean Rust build cache
cd src-tauri && cargo clean
```

### Data Location

All your data lives locally at `~/.synapse/`:

```
~/.synapse/
├── notes/          # Markdown files (one .md per note)
│   ├── abc123.md
│   └── def456.md
└── synapse.db      # SQLite metadata database
```

---

## What Synapse Does

Synapse is a desktop note-taking app designed for people who want a fast, private, and distraction-free writing experience. Think of it like Obsidian or Notion — but fully offline and built with native performance.

**Core idea:** Write in a rich editor, notes save as Markdown files on your disk, and a local SQLite database keeps everything searchable and organized.

---

## Planned Features

### Weeks 1-2 — Foundation & Core Editor (Complete)
- Rich text editor with Markdown support (TipTap)
- Note CRUD: create, read, update, delete notes
- Auto-save with visual indicator
- Sidebar with search, sort, and note list
- Command palette (⌘K) for quick actions
- Dark theme with premium UI
- Markdown files with YAML frontmatter metadata
- SQLite database for fast note lookup

### Weeks 3-4 — Organization & Navigation
- Folder / notebook organization system
- Tags and tag-based filtering
- Bi-directional note linking (`[[wiki-links]]`)
- Backlinks panel showing incoming references
- Quick switcher for jumping between notes
- Breadcrumb navigation

### Weeks 5-6 — Advanced Editor & Media
- Slash commands (`/heading`, `/code`, `/list`)
- Code blocks with syntax highlighting
- Image and file embedding (drag & drop)
- Table support
- LaTeX / math equation rendering
- Checklist / task lists with toggle
- Focus mode / zen mode

### Weeks 7-8 — Search & Intelligence
- Full-text search across all notes
- Fuzzy search with ranked results
- Search-and-replace within notes
- Recent notes and activity history
- Note templates (meeting notes, journal, etc.)
- Word count and reading time stats

### Weeks 9-10 — Sync & Collaboration
- Git-based version history for notes
- Export to PDF, HTML, and plain Markdown
- Import from Markdown files and other apps
- Optional encrypted cloud sync
- Conflict resolution for synced edits

### Weeks 11-12 — Polish & Performance
- Custom themes and appearance settings
- Keyboard shortcut customization
- Performance optimization for large vaults (1000+ notes)
- Plugin / extension system
- Onboarding experience and sample notes
- Final QA, edge-case testing, accessibility

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 18.3 | UI component framework |
| **TypeScript** | 5.0 | Type-safe JavaScript |
| **Vite** | 5.0+ | Lightning-fast build tool and dev server |
| **TipTap** | 2.6 | Rich text editor built on ProseMirror |
| **CSS** | — | Custom dark theme with design tokens (600+ lines) |

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Rust** | 1.70+ | High-performance native backend |
| **Tauri** | 2.0 | Desktop app framework (Rust + WebView) |
| **rusqlite** | 0.31 | SQLite database driver (bundled) |
| **serde** | 1.0 | Serialization/deserialization |
| **uuid** | 1.0 | Unique note identifiers |
| **chrono** | 0.4 | Timestamps |
| **anyhow** | 1.0 | Error handling |

### Why This Stack?

- **Tauri over Electron** — 10x smaller binaries, lower RAM usage, native security model
- **Rust backend** — Memory safety, zero-cost abstractions, compiled performance
- **TipTap** — Extensible, headless editor that outputs clean HTML/Markdown
- **SQLite** — Battle-tested embedded DB, no server needed, WAL mode for concurrent reads
- **Local-first** — All data stays on your machine. No cloud dependency.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Tauri Desktop Window                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   ┌─────────────┐    ┌──────────────────────────────┐    │
│   │   Sidebar    │    │          Main Area            │    │
│   │             │    │                              │    │
│   │  Search     │    │  ┌────────────────────────┐  │    │
│   │  Sort       │    │  │   Formatting Toolbar   │  │    │
│   │  Note List  │    │  ├────────────────────────┤  │    │
│   │             │    │  │                        │  │    │
│   │             │    │  │    TipTap Editor        │  │    │
│   │             │    │  │    (auto-save)          │  │    │
│   │             │    │  │                        │  │    │
│   │             │    │  └────────────────────────┘  │    │
│   └─────────────┘    └──────────────────────────────┘    │
│                                                          │
│   ┌──────────────────────────────────────────────────┐   │
│   │          Command Palette (⌘K)                     │   │
│   └──────────────────────────────────────────────────┘   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                  Tauri IPC Bridge                         │
├──────────────────────────────────────────────────────────┤
│                      Rust Backend                        │
│                                                          │
│   ┌──────────────┐    ┌──────────────┐                   │
│   │ File Manager │    │   Database   │                   │
│   │              │    │              │                   │
│   │ CRUD notes   │    │ SQLite + WAL │                   │
│   │ Frontmatter  │    │ Metadata     │                   │
│   │ parsing      │    │ queries      │                   │
│   └──────┬───────┘    └──────┬───────┘                   │
│          │                   │                           │
│    ~/.synapse/notes/   ~/.synapse/synapse.db              │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User action** (click, type, ⌘K) → React component
2. React calls `invoke('command_name', args)` → Tauri IPC
3. Rust `#[tauri::command]` handler processes the request
4. File Manager reads/writes `.md` files + Database updates SQLite
5. Response returns through IPC → React state updates → UI re-renders

### File Format

Each note is stored as a Markdown file with YAML frontmatter:

```markdown
---
id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
title: My First Note
created: 1708123456
modified: 1708123789
---

Your note content goes here...
```

---

## Project Structure

```
Synapse/
├── src/                          # React frontend
│   ├── components/
│   │   ├── Editor.tsx            # TipTap rich text editor
│   │   ├── NoteList.tsx          # Sidebar note list
│   │   ├── CommandPalette.tsx    # ⌘K command palette
│   │   └── Toast.tsx             # Notification system
│   ├── hooks/
│   │   └── useNotes.ts           # State management + IPC
│   ├── App.tsx                   # Main layout
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Dark theme styles
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Tauri entry point
│   │   ├── lib.rs                # App setup + state
│   │   ├── commands.rs           # IPC command handlers
│   │   ├── file_manager.rs       # Markdown file CRUD
│   │   └── database.rs           # SQLite operations
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri configuration
├── index.html                    # HTML shell
├── vite.config.ts                # Vite + Tailwind config
├── package.json                  # Node dependencies
└── tsconfig.json                 # TypeScript config
```

---

## Development Log

### Weeks 1-2: Foundation & Core Editor (Complete)

#### Rust Backend
- **File Manager** (`file_manager.rs`) — Full CRUD for Markdown notes stored at `~/.synapse/notes/`. Each note is a `.md` file with YAML frontmatter containing `id`, `title`, `created`, and `modified` timestamps. Includes functions for creating, reading, updating, deleting, and renaming notes with proper frontmatter parsing and serialization.
- **SQLite Database** (`database.rs`) — Initializes `~/.synapse/synapse.db` with WAL mode for concurrent reads. Creates the `notes` table on first run. Provides thread-safe access via `Mutex<Connection>` with INSERT, SELECT, UPDATE, and DELETE operations.
- **IPC Commands** (`commands.rs`) — Six `#[tauri::command]` handlers that bridge the frontend to the backend: `create_note`, `get_all_notes`, `get_note_content`, `save_note`, `delete_note`, `rename_note`. Each handler coordinates between the file manager and database layers.
- **App Setup** (`lib.rs`) — Initializes the database on startup, manages it as Tauri application state, and registers all IPC command handlers.

#### React Frontend
- **TipTap Editor** (`Editor.tsx`) — Rich text editor powered by TipTap with StarterKit extensions. Features a formatting toolbar (bold, italic, strikethrough, headings H1-H3, bullet list, ordered list, code block, blockquote, horizontal rule), auto-save with 2-second debounce + save on blur, ⌘S force save, and a "Saving..." indicator.
- **Note List Sidebar** (`NoteList.tsx`) — 260px left sidebar displaying all notes with title and relative timestamps ("2m ago", "3h ago"). Includes search-by-title filtering, sort options (Last Modified, Title A-Z, Created Date), a "New Note" button, skeleton loading states, and empty state messaging.
- **Command Palette** (`CommandPalette.tsx`) — Modal overlay triggered by ⌘K/Ctrl+K with keyboard navigation (↑↓ to browse, Enter to select, Esc to close). Supports actions: New Note, Rename Current Note (inline rename input), Delete Current Note (confirmation dialog). Also provides quick note switching by searching through all note titles.
- **State Management** (`useNotes.ts`) — Custom hook that wraps all six Tauri IPC commands with React state. Manages the note list, active note selection, content loading, search/sort filtering, loading states, saving indicators, and error handling. Auto-fetches note content when the active note changes.
- **Toast Notifications** (`Toast.tsx`) — Global notification system with success, error, and info variants. Auto-dismisses after 4 seconds with smooth slide-in animation.
- **App Layout** (`App.tsx`) — Main application shell wiring the sidebar, editor, command palette, and toast system together. Includes the global ⌘K listener.
- **Dark Theme** (`index.css`) — 600+ line custom CSS with design tokens (colors, radii, transitions), styled scrollbars, TipTap prose styling, command palette animations, skeleton loader shimmer effects, and a premium dark aesthetic.

#### Verification
- TypeScript: `tsc --noEmit` passes with zero errors
- Rust: 414 crates compile successfully
- Tauri: `tauri dev` builds and launches (exit code 0)
- UI: All components render correctly with dark theme applied

---

### Weeks 3-4: Organization & Navigation
*Coming soon...*

### Weeks 5-6: Advanced Editor & Media
*Coming soon...*

### Weeks 7-8: Search & Intelligence
*Coming soon...*

### Weeks 9-10: Sync & Collaboration
*Coming soon...*

### Weeks 11-12: Polish & Performance
*Coming soon...*

---
