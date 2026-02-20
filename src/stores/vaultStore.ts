import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

// ─── Types ────────────────────────────────────────────────────────

export interface VaultEntry {
    path: string;
    name: string;
    is_dir: boolean;
    size: number;
    modified: number;
    created: number;
}

export interface CachedNote {
    path: string;
    title: string;
    created_at: string | null;
    modified_at: string | null;
    word_count: number;
    starred: boolean;
}

export interface BacklinkResult {
    source_path: string;
    source_title: string;
    context: string;
}

export interface Heading {
    text: string;
    level: number;
    line: number;
}

// ─── Vault Store ──────────────────────────────────────────────────

interface VaultState {
    // Vault
    vaultPath: string | null;
    vaultReady: boolean;
    loading: boolean;

    // File explorer
    entries: VaultEntry[];
    expandedFolders: Set<string>;

    // Active note
    activeNotePath: string | null;
    activeNoteContent: string | null;
    activeNoteTitle: string;

    // Notes metadata cache
    allNotes: CachedNote[];

    // Sidebar state
    leftSidebarOpen: boolean;
    rightSidebarOpen: boolean;
    rightSidebarTab: 'links' | 'backlinks' | 'graph' | 'tags' | 'outline';

    // Saving state
    saving: boolean;

    // Actions
    initVault: () => Promise<void>;
    createVault: (path: string) => Promise<void>;
    openVault: (path: string) => Promise<void>;
    refreshEntries: () => Promise<void>;
    refreshNotes: () => Promise<void>;

    // File operations
    createNote: (title: string, folder: string) => Promise<string>;
    createFolder: (path: string) => Promise<void>;
    openNote: (path: string) => Promise<void>;
    saveNote: (path: string, content: string) => Promise<void>;
    deleteEntry: (path: string) => Promise<void>;
    renameEntry: (oldPath: string, newPath: string) => Promise<void>;
    duplicateEntry: (path: string) => Promise<string>;
    toggleStar: (path: string) => Promise<void>;

    // UI state
    toggleFolder: (path: string) => void;
    toggleLeftSidebar: () => void;
    toggleRightSidebar: () => void;
    setRightSidebarTab: (tab: VaultState['rightSidebarTab']) => void;
}

export const useVaultStore = create<VaultState>((set, get) => ({
    // Initial state
    vaultPath: null,
    vaultReady: false,
    loading: true,
    entries: [],
    expandedFolders: new Set<string>(),
    activeNotePath: null,
    activeNoteContent: null,
    activeNoteTitle: 'Untitled',
    allNotes: [],
    leftSidebarOpen: true,
    rightSidebarOpen: false,
    rightSidebarTab: 'links',
    saving: false,

    // ─── Vault lifecycle ──────────────────────────────────────────

    initVault: async () => {
        try {
            const path = await invoke<string | null>('get_vault_path');
            if (path) {
                set({ vaultPath: path, vaultReady: true, loading: false });
                await get().refreshEntries();
                await get().refreshNotes();
            } else {
                set({ loading: false });
            }
        } catch (e) {
            console.error('Failed to init vault:', e);
            set({ loading: false });
        }
    },

    createVault: async (path: string) => {
        try {
            set({ loading: true });
            await invoke('create_vault', { path });
            set({ vaultPath: path, vaultReady: true, loading: false });
            await get().refreshEntries();
            await get().refreshNotes();
        } catch (e) {
            console.error('Failed to create vault:', e);
            set({ loading: false });
            throw e;
        }
    },

    openVault: async (path: string) => {
        try {
            set({ loading: true });
            await invoke('open_vault', { path });
            set({ vaultPath: path, vaultReady: true, loading: false });
            await get().refreshEntries();
            await get().refreshNotes();
        } catch (e) {
            console.error('Failed to open vault:', e);
            set({ loading: false });
            throw e;
        }
    },

    refreshEntries: async () => {
        try {
            const entries = await invoke<VaultEntry[]>('list_vault_entries');
            set({ entries });
        } catch (e) {
            console.error('Failed to list entries:', e);
        }
    },

    refreshNotes: async () => {
        try {
            const allNotes = await invoke<CachedNote[]>('get_all_notes');
            set({ allNotes });
        } catch (e) {
            console.error('Failed to refresh notes:', e);
        }
    },

    // ─── File operations ──────────────────────────────────────────

    createNote: async (title: string, folder: string) => {
        const path = await invoke<string>('create_note', { title, folder });
        await get().refreshEntries();
        await get().refreshNotes();
        await get().openNote(path);
        return path;
    },

    createFolder: async (path: string) => {
        await invoke('create_folder', { path });
        await get().refreshEntries();
    },

    openNote: async (path: string) => {
        try {
            const content = await invoke<string>('read_note', { path });
            // Extract title from filename
            const name = path.split('/').pop()?.replace('.md', '') || 'Untitled';
            set({
                activeNotePath: path,
                activeNoteContent: content,
                activeNoteTitle: name,
            });
        } catch (e) {
            console.error('Failed to open note:', e);
        }
    },

    saveNote: async (path: string, content: string) => {
        try {
            set({ saving: true });
            await invoke('save_note', { path, content });
            set({ saving: false });
            // Refresh notes metadata after save (for search, backlinks, etc.)
            await get().refreshNotes();
        } catch (e) {
            console.error('Failed to save note:', e);
            set({ saving: false });
        }
    },

    deleteEntry: async (path: string) => {
        try {
            await invoke('delete_entry', { path });
            // If we deleted the active note, clear it
            if (get().activeNotePath === path) {
                set({
                    activeNotePath: null,
                    activeNoteContent: null,
                    activeNoteTitle: 'Untitled',
                });
            }
            await get().refreshEntries();
            await get().refreshNotes();
        } catch (e) {
            console.error('Failed to delete entry:', e);
        }
    },

    renameEntry: async (oldPath: string, newPath: string) => {
        try {
            await invoke('rename_entry', { oldPath, newPath });
            // If we renamed the active note, update the path
            if (get().activeNotePath === oldPath) {
                set({ activeNotePath: newPath });
            }
            await get().refreshEntries();
            await get().refreshNotes();
        } catch (e) {
            console.error('Failed to rename entry:', e);
        }
    },

    duplicateEntry: async (path: string) => {
        const newPath = await invoke<string>('duplicate_entry', { path });
        await get().refreshEntries();
        await get().refreshNotes();
        return newPath;
    },

    toggleStar: async (path: string) => {
        try {
            await invoke('toggle_star', { path });
            await get().refreshNotes();
        } catch (e) {
            console.error('Failed to toggle star:', e);
        }
    },

    // ─── UI state ─────────────────────────────────────────────────

    toggleFolder: (path: string) => {
        set((state) => {
            const expanded = new Set(state.expandedFolders);
            if (expanded.has(path)) {
                expanded.delete(path);
            } else {
                expanded.add(path);
            }
            return { expandedFolders: expanded };
        });
    },

    toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
    toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
    setRightSidebarTab: (tab) => set({ rightSidebarTab: tab }),
}));
