import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Version {
    id: string;
    note_id: string;
    content: string;
    created_at: number;
}

interface VersionHistoryProps {
    noteId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onRestore: (content: string) => void;
}

export default function VersionHistory({ noteId, isOpen, onClose, onRestore }: VersionHistoryProps) {
    const [versions, setVersions] = useState<Version[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
    const [loading, setLoading] = useState(false);

    const loadVersions = useCallback(async () => {
        if (!noteId) return;
        setLoading(true);
        try {
            const result = await invoke<Version[]>('get_versions', { noteId });
            setVersions(result);
        } catch (e) {
            console.error('Failed to load versions:', e);
            setVersions([]);
        } finally {
            setLoading(false);
        }
    }, [noteId]);

    useEffect(() => {
        if (isOpen && noteId) {
            loadVersions();
        }
    }, [isOpen, noteId, loadVersions]);

    const handleRestore = async () => {
        if (!selectedVersion || !noteId) return;
        try {
            await invoke('restore_version', { noteId, versionId: selectedVersion.id });
            onRestore(selectedVersion.content);
            onClose();
        } catch (e) {
            console.error('Failed to restore version:', e);
        }
    };

    const formatTime = (timestamp: number) => {
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
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const previewText = (content: string) => {
        // Strip HTML tags for preview
        const text = content.replace(/<[^>]+>/g, '').trim();
        return text.substring(0, 120) + (text.length > 120 ? '...' : '');
    };

    if (!isOpen) return null;

    return (
        <div className="version-history-panel">
            <div className="version-header">
                <h3>Version History</h3>
                <button className="version-close" onClick={onClose} title="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            <div className="version-list">
                {loading && <div className="version-loading">Loading...</div>}
                {!loading && versions.length === 0 && (
                    <div className="version-empty">No versions saved yet</div>
                )}
                {versions.map((version) => (
                    <button
                        key={version.id}
                        className={`version-item ${selectedVersion?.id === version.id ? 'active' : ''}`}
                        onClick={() => setSelectedVersion(version)}
                    >
                        <span className="version-time">{formatTime(version.created_at)}</span>
                        <span className="version-preview">{previewText(version.content)}</span>
                    </button>
                ))}
            </div>

            {selectedVersion && (
                <div className="version-actions">
                    <button className="btn-primary version-restore" onClick={handleRestore}>
                        Restore this version
                    </button>
                </div>
            )}
        </div>
    );
}
