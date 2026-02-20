import { useState, useCallback, useRef, useEffect } from 'react';
import { useVaultStore, type VaultEntry } from '../stores/vaultStore';

interface TreeNode {
    entry: VaultEntry;
    children: TreeNode[];
}

function buildTree(entries: VaultEntry[]): TreeNode[] {
    const root: TreeNode[] = [];
    const dirMap = new Map<string, TreeNode>();

    // First pass: create nodes for all directories
    for (const entry of entries) {
        if (entry.is_dir) {
            const node: TreeNode = { entry, children: [] };
            dirMap.set(entry.path, node);
        }
    }

    // Second pass: build hierarchy
    for (const entry of entries) {
        const node: TreeNode = entry.is_dir
            ? dirMap.get(entry.path)!
            : { entry, children: [] };

        const parts = entry.path.split('/');
        if (parts.length === 1) {
            // Root level
            root.push(node);
        } else {
            // Find parent directory
            const parentPath = parts.slice(0, -1).join('/');
            const parent = dirMap.get(parentPath);
            if (parent) {
                parent.children.push(node);
            } else {
                root.push(node);
            }
        }
    }

    // Sort each level: folders first, then files, alphabetical
    const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => {
            if (a.entry.is_dir && !b.entry.is_dir) return -1;
            if (!a.entry.is_dir && b.entry.is_dir) return 1;
            return a.entry.name.localeCompare(b.entry.name);
        });
        for (const node of nodes) {
            sortNodes(node.children);
        }
    };
    sortNodes(root);

    return root;
}

function FileTreeItem({
    node,
    depth,
}: {
    node: TreeNode;
    depth: number;
}) {
    const {
        activeNotePath,
        expandedFolders,
        toggleFolder,
        openNote,
        createNote,
        deleteEntry,
        renameEntry,
        duplicateEntry,
        toggleStar,
    } = useVaultStore();

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const renameRef = useRef<HTMLInputElement>(null);

    const isDir = node.entry.is_dir;
    const isExpanded = expandedFolders.has(node.entry.path);
    const isActive = activeNotePath === node.entry.path;
    const isMd = node.entry.path.endsWith('.md');

    useEffect(() => {
        if (renaming && renameRef.current) {
            renameRef.current.focus();
            renameRef.current.select();
        }
    }, [renaming]);

    // Close context menu on click outside
    useEffect(() => {
        if (!contextMenu) return;
        const close = () => setContextMenu(null);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [contextMenu]);

    const handleClick = () => {
        if (isDir) {
            toggleFolder(node.entry.path);
        } else if (isMd) {
            openNote(node.entry.path);
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleRenameSubmit = async () => {
        if (!renameValue.trim()) {
            setRenaming(false);
            return;
        }
        const parts = node.entry.path.split('/');
        parts.pop();
        const ext = isDir ? '' : '.md';
        const newPath = [...parts, renameValue.trim() + ext].join('/');
        await renameEntry(node.entry.path, newPath.startsWith('/') ? newPath.slice(1) : newPath);
        setRenaming(false);
    };

    const handleNewNote = async () => {
        setContextMenu(null);
        const folder = isDir ? node.entry.path : node.entry.path.split('/').slice(0, -1).join('/');
        await createNote('Untitled', folder);
    };

    const handleDelete = async () => {
        setContextMenu(null);
        if (confirm(`Delete "${node.entry.name}"?`)) {
            await deleteEntry(node.entry.path);
        }
    };

    const handleDuplicate = async () => {
        setContextMenu(null);
        await duplicateEntry(node.entry.path);
    };

    const handleStar = async () => {
        setContextMenu(null);
        await toggleStar(node.entry.path);
    };

    const handleRename = () => {
        setContextMenu(null);
        setRenameValue(node.entry.name);
        setRenaming(true);
    };

    const fileCount = isDir ? node.children.filter(c => !c.entry.is_dir).length : 0;

    return (
        <>
            <div
                className={`file-tree-item ${isActive ? 'active' : ''} ${isDir ? 'folder' : 'file'}`}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                onDoubleClick={() => {
                    if (!isDir) handleRename();
                }}
            >
                {/* Expand/collapse arrow for folders */}
                {isDir && (
                    <span className={`file-tree-arrow ${isExpanded ? 'expanded' : ''}`}>
                        ▶
                    </span>
                )}

                {/* Icon */}
                <span className="file-tree-icon">
                    {isDir ? '📁' : '📄'}
                </span>

                {/* Name */}
                {renaming ? (
                    <input
                        ref={renameRef}
                        className="file-tree-rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit();
                            if (e.key === 'Escape') setRenaming(false);
                        }}
                        onBlur={handleRenameSubmit}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="file-tree-name">
                        {node.entry.name}
                        {isDir && fileCount > 0 && (
                            <span className="file-tree-count">{fileCount}</span>
                        )}
                    </span>
                )}
            </div>

            {/* Context menu */}
            {contextMenu && (
                <div
                    className="context-menu"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={handleNewNote}>New note</button>
                    {isDir && (
                        <button onClick={async () => {
                            setContextMenu(null);
                            const name = prompt('Folder name:');
                            if (name) {
                                const { createFolder } = useVaultStore.getState();
                                await createFolder(`${node.entry.path}/${name}`);
                            }
                        }}>New folder</button>
                    )}
                    <div className="context-menu-separator" />
                    <button onClick={handleRename}>Rename</button>
                    {!isDir && <button onClick={handleDuplicate}>Duplicate</button>}
                    {!isDir && <button onClick={handleStar}>Toggle star</button>}
                    <div className="context-menu-separator" />
                    <button onClick={handleDelete} className="context-menu-danger">Delete</button>
                </div>
            )}

            {/* Children (if expanded) */}
            {isDir && isExpanded && (
                <div className="file-tree-children">
                    {node.children.map((child) => (
                        <FileTreeItem
                            key={child.entry.path}
                            node={child}
                            depth={depth + 1}
                        />
                    ))}
                    {node.children.length === 0 && (
                        <div className="file-tree-empty" style={{ paddingLeft: `${12 + (depth + 1) * 16}px` }}>
                            Empty folder
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

export default function FileExplorer() {
    const { entries, vaultPath, createNote, createFolder, refreshEntries } = useVaultStore();
    const tree = buildTree(entries);
    const [searchFilter, setSearchFilter] = useState('');

    const vaultName = vaultPath?.split('/').pop() || 'Vault';

    // Filter entries by search
    const filteredTree = searchFilter
        ? entries
            .filter(
                (e) =>
                    !e.is_dir &&
                    e.name.toLowerCase().includes(searchFilter.toLowerCase())
            )
            .map((e) => ({ entry: e, children: [] } as TreeNode))
        : tree;

    const handleNewNote = useCallback(async () => {
        await createNote('Untitled', '');
    }, [createNote]);

    const handleNewFolder = useCallback(async () => {
        const name = prompt('Folder name:');
        if (name) {
            await createFolder(name);
        }
    }, [createFolder]);

    return (
        <div className="file-explorer">
            {/* Header */}
            <div className="file-explorer-header">
                <span className="file-explorer-vault-name">{vaultName}</span>
                <div className="file-explorer-actions">
                    <button onClick={handleNewNote} title="New note (Cmd+N)" className="file-explorer-action-btn">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </button>
                    <button onClick={handleNewFolder} title="New folder" className="file-explorer-action-btn">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M2 5V4a1 1 0 011-1h3l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" stroke="currentColor" strokeWidth="1.2" />
                            <path d="M8 7v4M6 9h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                    </button>
                    <button onClick={() => refreshEntries()} title="Refresh" className="file-explorer-action-btn">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M13.5 8A5.5 5.5 0 113 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            <path d="M3 2v4h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Search filter */}
            <div className="file-explorer-search">
                <input
                    type="text"
                    placeholder="Filter files..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                />
            </div>

            {/* Tree */}
            <div className="file-explorer-tree">
                {filteredTree.map((node) => (
                    <FileTreeItem key={node.entry.path} node={node} depth={0} />
                ))}
                {filteredTree.length === 0 && (
                    <div className="file-explorer-empty">
                        {searchFilter ? 'No matching files' : 'Empty vault'}
                    </div>
                )}
            </div>
        </div>
    );
}
