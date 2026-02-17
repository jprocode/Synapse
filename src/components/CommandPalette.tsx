import { useState, useEffect, useRef, useMemo } from 'react';
import type { Note } from '../hooks/useNotes';

interface CommandPaletteProps {
    isOpen: boolean;
    notes: Note[];
    activeNoteId: string | null;
    onClose: () => void;
    onNewNote: () => void;
    onDeleteNote: (id: string) => void;
    onRenameNote: (id: string, newTitle: string) => void;
    onSelectNote: (id: string) => void;
}

interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon: string;
    action: () => void;
    type: 'action' | 'note';
}

export default function CommandPalette({
    isOpen,
    notes,
    activeNoteId,
    onClose,
    onNewNote,
    onDeleteNote,
    onRenameNote,
    onSelectNote,
}: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);

    // Build command list
    const commands = useMemo((): CommandItem[] => {
        const items: CommandItem[] = [
            {
                id: 'new-note',
                label: 'New Note',
                description: 'Create a new empty note',
                icon: '📝',
                action: () => {
                    onNewNote();
                    onClose();
                },
                type: 'action',
            },
        ];

        if (activeNoteId) {
            items.push(
                {
                    id: 'rename-note',
                    label: 'Rename Current Note',
                    description: 'Change the title of the current note',
                    icon: '✏️',
                    action: () => {
                        const activeNote = notes.find(n => n.id === activeNoteId);
                        setRenameValue(activeNote?.title || '');
                        setIsRenaming(true);
                    },
                    type: 'action',
                },
                {
                    id: 'delete-note',
                    label: 'Delete Current Note',
                    description: 'Permanently delete the current note',
                    icon: '🗑️',
                    action: () => {
                        setIsConfirmingDelete(true);
                    },
                    type: 'action',
                }
            );
        }

        // Add notes for quick navigation
        notes.forEach(note => {
            items.push({
                id: `note-${note.id}`,
                label: note.title,
                description: 'Open note',
                icon: '📄',
                action: () => {
                    onSelectNote(note.id);
                    onClose();
                },
                type: 'note',
            });
        });

        return items;
    }, [notes, activeNoteId, onNewNote, onClose, onSelectNote]);

    // Filter commands by search query
    const filteredCommands = useMemo(() => {
        if (!query.trim()) return commands;
        const q = query.toLowerCase();
        return commands.filter(
            cmd =>
                cmd.label.toLowerCase().includes(q) ||
                (cmd.description && cmd.description.toLowerCase().includes(q))
        );
    }, [commands, query]);

    // Reset state when opened/closed
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setIsRenaming(false);
            setIsConfirmingDelete(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Focus rename input when entering rename mode
    useEffect(() => {
        if (isRenaming) {
            setTimeout(() => renameInputRef.current?.focus(), 50);
        }
    }, [isRenaming]);

    // Clamp selected index
    useEffect(() => {
        if (selectedIndex >= filteredCommands.length) {
            setSelectedIndex(Math.max(0, filteredCommands.length - 1));
        }
    }, [filteredCommands.length, selectedIndex]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            if (isRenaming) {
                setIsRenaming(false);
            } else if (isConfirmingDelete) {
                setIsConfirmingDelete(false);
            } else {
                onClose();
            }
            return;
        }

        if (isRenaming || isConfirmingDelete) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredCommands[selectedIndex]) {
                filteredCommands[selectedIndex].action();
            }
        }
    };

    const handleRenameSubmit = () => {
        if (activeNoteId && renameValue.trim()) {
            onRenameNote(activeNoteId, renameValue.trim());
            setIsRenaming(false);
            onClose();
        }
    };

    const handleDeleteConfirm = () => {
        if (activeNoteId) {
            onDeleteNote(activeNoteId);
            setIsConfirmingDelete(false);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="palette-overlay" onClick={onClose}>
            <div className="palette-container" onClick={e => e.stopPropagation()}>
                {isConfirmingDelete ? (
                    <div className="palette-confirm">
                        <div className="palette-confirm-icon">⚠️</div>
                        <h3>Delete this note?</h3>
                        <p>This action cannot be undone.</p>
                        <div className="palette-confirm-buttons">
                            <button className="btn-cancel" onClick={() => setIsConfirmingDelete(false)}>
                                Cancel
                            </button>
                            <button className="btn-danger" onClick={handleDeleteConfirm}>
                                Delete
                            </button>
                        </div>
                    </div>
                ) : isRenaming ? (
                    <div className="palette-rename">
                        <label>Rename note</label>
                        <input
                            ref={renameInputRef}
                            type="text"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameSubmit();
                                if (e.key === 'Escape') setIsRenaming(false);
                            }}
                            className="palette-rename-input"
                        />
                        <div className="palette-confirm-buttons">
                            <button className="btn-cancel" onClick={() => setIsRenaming(false)}>
                                Cancel
                            </button>
                            <button className="btn-primary" onClick={handleRenameSubmit}>
                                Rename
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="palette-search">
                            <svg className="palette-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M10.5 10.5L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            <input
                                ref={inputRef}
                                type="text"
                                className="palette-input"
                                placeholder="Type a command or search notes..."
                                value={query}
                                onChange={e => {
                                    setQuery(e.target.value);
                                    setSelectedIndex(0);
                                }}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                        <div className="palette-results">
                            {filteredCommands.length === 0 ? (
                                <div className="palette-empty">No results found</div>
                            ) : (
                                filteredCommands.map((cmd, idx) => (
                                    <button
                                        key={cmd.id}
                                        className={`palette-item ${idx === selectedIndex ? 'selected' : ''}`}
                                        onClick={cmd.action}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                    >
                                        <span className="palette-item-icon">{cmd.icon}</span>
                                        <div className="palette-item-text">
                                            <span className="palette-item-label">{cmd.label}</span>
                                            {cmd.description && (
                                                <span className="palette-item-desc">{cmd.description}</span>
                                            )}
                                        </div>
                                        {cmd.type === 'action' && (
                                            <span className="palette-item-badge">Action</span>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                        <div className="palette-footer">
                            <span><kbd>↑↓</kbd> navigate</span>
                            <span><kbd>↵</kbd> select</span>
                            <span><kbd>esc</kbd> close</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
