import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface Note {
    id: string;
    title: string;
    file_path: string;
    created_at: number;
    modified_at: number;
}

export type SortMode = 'modified' | 'title' | 'created';

export function useNotes() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
    const [activeContent, setActiveContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortMode, setSortMode] = useState<SortMode>('modified');
    const contentLoadedRef = useRef<string | null>(null);

    // Fetch all notes from the backend
    const fetchNotes = useCallback(async () => {
        try {
            const allNotes = await invoke<Note[]>('get_all_notes');
            setNotes(allNotes);
            setError(null);
        } catch (e) {
            setError(`Failed to load notes: ${e}`);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load notes on mount
    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    // Load note content when active note changes
    useEffect(() => {
        if (!activeNoteId) {
            setActiveContent('');
            contentLoadedRef.current = null;
            return;
        }

        const loadContent = async () => {
            try {
                const content = await invoke<string>('get_note_content', { id: activeNoteId });
                setActiveContent(content);
                contentLoadedRef.current = activeNoteId;
                setError(null);
            } catch (e) {
                setError(`Failed to load note: ${e}`);
            }
        };

        loadContent();
    }, [activeNoteId]);

    // Create a new note
    const createNote = useCallback(async (title: string): Promise<Note | null> => {
        try {
            const note = await invoke<Note>('create_note', { title });
            await fetchNotes();
            setActiveNoteId(note.id);
            setError(null);
            return note;
        } catch (e) {
            setError(`Failed to create note: ${e}`);
            return null;
        }
    }, [fetchNotes]);

    // Save note content
    const saveNote = useCallback(async (id: string, content: string) => {
        setSaving(true);
        try {
            await invoke('save_note', { id, content });
            await fetchNotes();
            setError(null);
        } catch (e) {
            setError(`Failed to save note: ${e}`);
        } finally {
            setSaving(false);
        }
    }, [fetchNotes]);

    // Delete a note
    const deleteNote = useCallback(async (id: string) => {
        try {
            await invoke('delete_note', { id });
            if (activeNoteId === id) {
                setActiveNoteId(null);
                setActiveContent('');
            }
            await fetchNotes();
            setError(null);
        } catch (e) {
            setError(`Failed to delete note: ${e}`);
        }
    }, [activeNoteId, fetchNotes]);

    // Rename a note
    const renameNote = useCallback(async (id: string, newTitle: string) => {
        try {
            await invoke('rename_note', { id, newTitle });
            await fetchNotes();
            setError(null);
        } catch (e) {
            setError(`Failed to rename note: ${e}`);
        }
    }, [fetchNotes]);

    // Filter and sort notes
    const filteredNotes = notes
        .filter(note =>
            note.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            switch (sortMode) {
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'created':
                    return b.created_at - a.created_at;
                case 'modified':
                default:
                    return b.modified_at - a.modified_at;
            }
        });

    const activeNote = notes.find(n => n.id === activeNoteId) || null;

    return {
        notes: filteredNotes,
        allNotes: notes,
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
        clearError: () => setError(null),
    };
}
