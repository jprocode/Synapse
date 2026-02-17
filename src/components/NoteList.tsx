import type { Note, SortMode } from '../hooks/useNotes';

interface NoteListProps {
    notes: Note[];
    activeNoteId: string | null;
    searchQuery: string;
    sortMode: SortMode;
    loading: boolean;
    onSelectNote: (id: string) => void;
    onSearchChange: (query: string) => void;
    onSortChange: (mode: SortMode) => void;
    onNewNote: () => void;
}

function formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
}

export default function NoteList({
    notes,
    activeNoteId,
    searchQuery,
    sortMode,
    loading,
    onSelectNote,
    onSearchChange,
    onSortChange,
    onNewNote,
}: NoteListProps) {
    return (
        <aside className="sidebar">
            {/* Header */}
            <div className="sidebar-header">
                <div className="sidebar-title">
                    <span className="sidebar-logo">⚡</span>
                    <h1>Synapse</h1>
                </div>
                <button className="btn-new-note" onClick={onNewNote} title="New Note">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </button>
            </div>

            {/* Search & Sort */}
            <div className="sidebar-controls">
                <div className="search-wrapper">
                    <svg className="search-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M10.5 10.5L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search notes..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="search-clear" onClick={() => onSearchChange('')}>
                            ×
                        </button>
                    )}
                </div>
                <select
                    className="sort-select"
                    value={sortMode}
                    onChange={(e) => onSortChange(e.target.value as SortMode)}
                >
                    <option value="modified">Last Modified</option>
                    <option value="title">Title A-Z</option>
                    <option value="created">Created Date</option>
                </select>
            </div>

            {/* Note List */}
            <div className="sidebar-notes">
                {loading ? (
                    <div className="skeleton-list">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="skeleton-item">
                                <div className="skeleton-title" />
                                <div className="skeleton-date" />
                            </div>
                        ))}
                    </div>
                ) : notes.length === 0 ? (
                    <div className="sidebar-empty">
                        {searchQuery ? (
                            <>
                                <p>No notes matching "{searchQuery}"</p>
                                <button className="btn-link" onClick={() => onSearchChange('')}>
                                    Clear search
                                </button>
                            </>
                        ) : (
                            <>
                                <p>No notes yet</p>
                                <button className="btn-link" onClick={onNewNote}>
                                    Create your first note
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    notes.map(note => (
                        <button
                            key={note.id}
                            className={`note-item ${activeNoteId === note.id ? 'active' : ''}`}
                            onClick={() => onSelectNote(note.id)}
                        >
                            <div className="note-item-title">{note.title}</div>
                            <div className="note-item-date">{formatDate(note.modified_at)}</div>
                        </button>
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="sidebar-footer">
                <span className="note-count">
                    {notes.length} note{notes.length !== 1 ? 's' : ''}
                </span>
            </div>
        </aside>
    );
}
