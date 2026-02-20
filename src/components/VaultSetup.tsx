import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useVaultStore } from '../stores/vaultStore';

export default function VaultSetup() {
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const { createVault, openVault } = useVaultStore();

    const handleCreate = async () => {
        try {
            setError('');
            const selected = await open({
                directory: true,
                title: 'Choose location for new vault',
            });
            if (selected) {
                setCreating(true);
                await createVault(selected as string);
            }
        } catch (e) {
            setError(String(e));
            setCreating(false);
        }
    };

    const handleOpen = async () => {
        try {
            setError('');
            const selected = await open({
                directory: true,
                title: 'Open existing vault folder',
            });
            if (selected) {
                setCreating(true);
                await openVault(selected as string);
            }
        } catch (e) {
            setError(String(e));
            setCreating(false);
        }
    };

    return (
        <div className="vault-setup-overlay">
            <div className="vault-setup-card">
                <div className="vault-setup-logo">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <circle cx="24" cy="24" r="24" fill="var(--accent)" opacity="0.15" />
                        <circle cx="24" cy="24" r="8" fill="var(--accent)" />
                        <circle cx="24" cy="8" r="4" fill="var(--accent)" opacity="0.6" />
                        <circle cx="24" cy="40" r="4" fill="var(--accent)" opacity="0.6" />
                        <circle cx="8" cy="24" r="4" fill="var(--accent)" opacity="0.6" />
                        <circle cx="40" cy="24" r="4" fill="var(--accent)" opacity="0.6" />
                        <line x1="24" y1="16" x2="24" y2="12" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4" />
                        <line x1="24" y1="36" x2="24" y2="32" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4" />
                        <line x1="16" y1="24" x2="12" y2="24" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4" />
                        <line x1="36" y1="24" x2="32" y2="24" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4" />
                    </svg>
                </div>

                <h1 className="vault-setup-title">Welcome to Synapse</h1>
                <p className="vault-setup-subtitle">
                    Your local-first knowledge base. Choose a folder to store your notes —
                    they're just markdown files on your disk.
                </p>

                <div className="vault-setup-actions">
                    <button
                        className="vault-setup-btn vault-setup-btn-primary"
                        onClick={handleCreate}
                        disabled={creating}
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Create new vault
                    </button>

                    <div className="vault-setup-divider">
                        <span>or</span>
                    </div>

                    <button
                        className="vault-setup-btn vault-setup-btn-secondary"
                        onClick={handleOpen}
                        disabled={creating}
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M3 7V5a2 2 0 012-2h4l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                        Open existing vault
                    </button>
                </div>

                {error && <p className="vault-setup-error">{error}</p>}
                {creating && (
                    <p className="vault-setup-loading">Setting up vault...</p>
                )}
            </div>
        </div>
    );
}
