import { useState, useEffect, useCallback } from 'react';
import { useNotes } from './hooks/useNotes';
import Editor from './components/Editor';
import NoteList from './components/NoteList';
import CommandPalette from './components/CommandPalette';
import ToastContainer, { showToast } from './components/Toast';

export default function App() {
  const {
    notes,
    allNotes,
    activeNote,
    activeNoteId,
    activeContent,
    loading,
    saving,
    error,
    searchQuery,
    sortMode,
    setActiveNoteId,
    setActiveContent,
    setSearchQuery,
    setSortMode,
    createNote,
    saveNote,
    deleteNote,
    renameNote,
    clearError,
  } = useNotes();

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Show errors as toasts
  useEffect(() => {
    if (error) {
      showToast(error, 'error');
      clearError();
    }
  }, [error, clearError]);

  // Global Cmd+K handler for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNewNote = useCallback(async () => {
    const note = await createNote('Untitled Note');
    if (note) {
      showToast('Note created', 'success');
    }
  }, [createNote]);

  const handleDeleteNote = useCallback(async (id: string) => {
    await deleteNote(id);
    showToast('Note deleted', 'success');
  }, [deleteNote]);

  const handleRenameNote = useCallback(async (id: string, newTitle: string) => {
    await renameNote(id, newTitle);
    showToast('Note renamed', 'success');
  }, [renameNote]);

  return (
    <div className="app-layout">
      <NoteList
        notes={notes}
        activeNoteId={activeNoteId}
        searchQuery={searchQuery}
        sortMode={sortMode}
        loading={loading}
        onSelectNote={setActiveNoteId}
        onSearchChange={setSearchQuery}
        onSortChange={setSortMode}
        onNewNote={handleNewNote}
      />

      <main className="main-area">
        {activeNote && (
          <div className="note-header">
            <h2 className="note-title">{activeNote.title}</h2>
          </div>
        )}
        <Editor
          noteId={activeNoteId}
          content={activeContent}
          saving={saving}
          onSave={saveNote}
          onContentChange={setActiveContent}
        />
      </main>

      <CommandPalette
        isOpen={commandPaletteOpen}
        notes={allNotes}
        activeNoteId={activeNoteId}
        onClose={() => setCommandPaletteOpen(false)}
        onNewNote={handleNewNote}
        onDeleteNote={handleDeleteNote}
        onRenameNote={handleRenameNote}
        onSelectNote={(id) => {
          setActiveNoteId(id);
          setCommandPaletteOpen(false);
        }}
      />

      <ToastContainer />
    </div>
  );
}
