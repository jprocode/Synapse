import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useVaultStore } from '../stores/vaultStore';

interface BacklinkResult {
    source_path: string;
    source_title: string;
    context: string;
}

interface OutgoingLink {
    target: string;
    exists: boolean;
}

interface TagCount {
    tag: string;
    count: number;
}

interface HeadingItem {
    text: string;
    level: number;
    line: number;
}

type PanelTab = 'backlinks' | 'outgoing' | 'tags' | 'outline';

export default function BacklinksPanel() {
    const { activeNotePath, activeNoteTitle, openNote, createNote, allNotes } = useVaultStore();

    const [activeTab, setActiveTab] = useState<PanelTab>('backlinks');
    const [backlinks, setBacklinks] = useState<BacklinkResult[]>([]);
    const [outgoingLinks, setOutgoingLinks] = useState<OutgoingLink[]>([]);
    const [allTags, setAllTags] = useState<TagCount[]>([]);
    const [headings, setHeadings] = useState<HeadingItem[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch data when active note changes
    useEffect(() => {
        if (!activeNotePath) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Always fetch backlinks and outgoing links
                const [bl, ol, tags, heads] = await Promise.all([
                    invoke<BacklinkResult[]>('get_backlinks', {
                        noteTitle: activeNoteTitle,
                    }).catch(() => []),
                    invoke<string[]>('get_outgoing_links', {
                        notePath: activeNotePath,
                    }).catch(() => []),
                    invoke<TagCount[]>('get_all_tags').catch(() => []),
                    invoke<HeadingItem[]>('get_headings', {
                        notePath: activeNotePath,
                    }).catch(() => []),
                ]);

                setBacklinks(bl);

                // Check which outgoing links have existing notes
                const noteNames = allNotes.map((n) =>
                    n.path.split('/').pop()?.replace('.md', '').toLowerCase() || ''
                );
                setOutgoingLinks(
                    (ol as string[]).map((target) => ({
                        target,
                        exists: noteNames.includes(target.toLowerCase()),
                    }))
                );

                setAllTags(tags);
                setHeadings(heads);
            } catch (e) {
                console.error('Failed to fetch panel data:', e);
            }
            setLoading(false);
        };

        fetchData();
    }, [activeNotePath, activeNoteTitle, allNotes]);

    const handleLinkClick = useCallback(
        async (noteTitle: string) => {
            // Find note by title
            const note = allNotes.find(
                (n) =>
                    n.path
                        .split('/')
                        .pop()
                        ?.replace('.md', '')
                        .toLowerCase() === noteTitle.toLowerCase()
            );
            if (note) {
                await openNote(note.path);
            } else {
                // Create the note
                await createNote(noteTitle, '');
            }
        },
        [allNotes, openNote, createNote]
    );

    if (!activeNotePath) {
        return (
            <div className="backlinks-panel">
                <div className="backlinks-empty">Select a note to see links</div>
            </div>
        );
    }

    return (
        <div className="backlinks-panel">
            {/* Tab bar */}
            <div className="backlinks-tabs">
                {(['backlinks', 'outgoing', 'tags', 'outline'] as PanelTab[]).map((tab) => (
                    <button
                        key={tab}
                        className={`backlinks-tab ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab === 'backlinks' && `← ${backlinks.length}`}
                        {tab === 'outgoing' && `→ ${outgoingLinks.length}`}
                        {tab === 'tags' && `# ${allTags.length}`}
                        {tab === 'outline' && `≡ ${headings.length}`}
                    </button>
                ))}
            </div>

            {/* Content area */}
            <div className="backlinks-content">
                {loading && <div className="backlinks-loading">Loading...</div>}

                {/* ─── Backlinks tab ──────────────────────────── */}
                {activeTab === 'backlinks' && !loading && (
                    <div className="backlinks-list">
                        {backlinks.length === 0 ? (
                            <div className="backlinks-empty">No backlinks found</div>
                        ) : (
                            backlinks.map((bl, i) => (
                                <div
                                    key={i}
                                    className="backlink-item"
                                    onClick={() => handleLinkClick(bl.source_title)}
                                >
                                    <span className="backlink-title">{bl.source_title}</span>
                                    {bl.context && (
                                        <p className="backlink-context">{bl.context}</p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ─── Outgoing links tab ─────────────────────── */}
                {activeTab === 'outgoing' && !loading && (
                    <div className="backlinks-list">
                        {outgoingLinks.length === 0 ? (
                            <div className="backlinks-empty">No outgoing links</div>
                        ) : (
                            outgoingLinks.map((link, i) => (
                                <div
                                    key={i}
                                    className={`backlink-item ${!link.exists ? 'broken' : ''}`}
                                    onClick={() => handleLinkClick(link.target)}
                                >
                                    <span className="backlink-title">
                                        {link.exists ? '📄' : '➕'} {link.target}
                                    </span>
                                    {!link.exists && (
                                        <span className="backlink-badge">Create</span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ─── Tags tab ───────────────────────────────── */}
                {activeTab === 'tags' && !loading && (
                    <div className="backlinks-list">
                        {allTags.length === 0 ? (
                            <div className="backlinks-empty">No tags found</div>
                        ) : (
                            allTags.map((tag, i) => (
                                <div key={i} className="tag-item">
                                    <span className="tag-name">#{tag.tag}</span>
                                    <span className="tag-count">{tag.count}</span>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ─── Outline tab ────────────────────────────── */}
                {activeTab === 'outline' && !loading && (
                    <div className="backlinks-list">
                        {headings.length === 0 ? (
                            <div className="backlinks-empty">No headings found</div>
                        ) : (
                            headings.map((h, i) => (
                                <div
                                    key={i}
                                    className="outline-item"
                                    style={{ paddingLeft: `${(h.level - 1) * 16 + 8}px` }}
                                >
                                    <span className={`outline-heading outline-h${h.level}`}>
                                        {h.text}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
