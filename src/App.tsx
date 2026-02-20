import { useEffect, useCallback, useState, useRef } from 'react';
import { useVaultStore } from './stores/vaultStore';
import VaultSetup from './components/VaultSetup';
import FileExplorer from './components/FileExplorer';
import BacklinksPanel from './components/BacklinksPanel';
import Editor from './components/Editor';
import ToastContainer, { showToast } from './components/Toast';

export default function App() {
  const {
    vaultReady,
    loading,
    activeNotePath,
    activeNoteContent,
    activeNoteTitle,
    saving,
    leftSidebarOpen,
    rightSidebarOpen,
    initVault,
    createNote,
    saveNote,
    toggleLeftSidebar,
    toggleRightSidebar,
  } = useVaultStore();

  const [readingMode, setReadingMode] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize vault on mount
  useEffect(() => {
    initVault();
  }, [initVault]);

  // Auto-save with debounce
  const handleContentChange = useCallback(
    (content: string) => {
      if (!activeNotePath) return;

      // Clear previous timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce save by 500ms
      saveTimeoutRef.current = setTimeout(() => {
        saveNote(activeNotePath, content);
      }, 500);
    },
    [activeNotePath, saveNote]
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+N — new note
      if (meta && e.key === 'n') {
        e.preventDefault();
        createNote('Untitled', '').then(() => {
          showToast('Note created', 'success');
        });
      }

      // Cmd+E — toggle reading mode
      if (meta && e.key === 'e') {
        e.preventDefault();
        setReadingMode((prev) => !prev);
      }

      // Cmd+B — toggle left sidebar
      if (meta && e.key === 'b') {
        e.preventDefault();
        toggleLeftSidebar();
      }

      // Cmd+S — force save (already auto-saving, but respect the habit)
      if (meta && e.key === 's') {
        e.preventDefault();
        if (activeNotePath && activeNoteContent) {
          saveNote(activeNotePath, activeNoteContent);
          showToast('Saved', 'success');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [createNote, toggleLeftSidebar, saveNote, activeNotePath, activeNoteContent]);

  // ─── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <p>Loading Synapse...</p>
      </div>
    );
  }

  // ─── Vault setup (first launch) ──────────────────────────────
  if (!vaultReady) {
    return <VaultSetup />;
  }

  // ─── Main app layout ─────────────────────────────────────────
  return (
    <div className="app-layout">
      {/* Left sidebar: File Explorer */}
      {leftSidebarOpen && (
        <aside className="sidebar sidebar-left">
          <FileExplorer />
        </aside>
      )}

      {/* Main editor area */}
      <main className="main-area">
        {activeNotePath ? (
          <>
            {/* Note title bar */}
            <div className="note-topbar">
              <div className="note-topbar-left">
                <button
                  className="topbar-btn"
                  onClick={toggleLeftSidebar}
                  title="Toggle sidebar (Cmd+B)"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
                    <line x1="5" y1="2" x2="5" y2="14" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </button>
                <span className="note-breadcrumb">
                  {activeNotePath.replace('.md', '')}
                </span>
              </div>
              <div className="note-topbar-right">
                <button
                  className={`topbar-btn ${readingMode ? 'active' : ''}`}
                  onClick={() => setReadingMode(!readingMode)}
                  title="Toggle reading mode (Cmd+E)"
                >
                  {readingMode ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3C4.5 3 2 8 2 8s2.5 5 6 5 6-5 6-5-2.5-5-6-5z" stroke="currentColor" strokeWidth="1.2" />
                      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 3h4l1 1.5H13v8H3V3z" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  )}
                </button>
                <button
                  className={`topbar-btn ${rightSidebarOpen ? 'active' : ''}`}
                  onClick={toggleRightSidebar}
                  title="Toggle backlinks panel"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
                    <line x1="11" y1="2" x2="11" y2="14" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </button>
                {saving && <span className="topbar-saving">Saving...</span>}
              </div>
            </div>

            {/* Editor */}
            <Editor
              noteId={activeNotePath}
              noteTitle={activeNoteTitle}
              content={activeNoteContent || ''}
              saving={saving}
              onSave={(content: string) => {
                if (activeNotePath) {
                  saveNote(activeNotePath, content);
                }
              }}
              onContentChange={handleContentChange}
              onTitleChange={() => { }}
            />
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="30" stroke="var(--text-muted)" strokeWidth="1.5" opacity="0.3" />
                <circle cx="32" cy="32" r="6" fill="var(--text-muted)" opacity="0.3" />
                <circle cx="32" cy="12" r="3" fill="var(--text-muted)" opacity="0.2" />
                <circle cx="32" cy="52" r="3" fill="var(--text-muted)" opacity="0.2" />
                <circle cx="12" cy="32" r="3" fill="var(--text-muted)" opacity="0.2" />
                <circle cx="52" cy="32" r="3" fill="var(--text-muted)" opacity="0.2" />
                <line x1="32" y1="26" x2="32" y2="15" stroke="var(--text-muted)" strokeWidth="1" opacity="0.15" />
                <line x1="32" y1="49" x2="32" y2="38" stroke="var(--text-muted)" strokeWidth="1" opacity="0.15" />
                <line x1="26" y1="32" x2="15" y2="32" stroke="var(--text-muted)" strokeWidth="1" opacity="0.15" />
                <line x1="49" y1="32" x2="38" y2="32" stroke="var(--text-muted)" strokeWidth="1" opacity="0.15" />
              </svg>
            </div>
            <h2>No note selected</h2>
            <p>Select a note from the sidebar or create a new one with <kbd>Cmd+N</kbd></p>
          </div>
        )}
      </main>

      {/* Right sidebar: Backlinks, Tags, Outline */}
      {rightSidebarOpen && (
        <aside className="sidebar sidebar-right">
          <BacklinksPanel />
        </aside>
      )}

      <ToastContainer />
    </div>
  );
}
