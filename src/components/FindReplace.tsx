import { useState, useEffect, useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

interface FindReplaceProps {
    editor: Editor | null;
    isOpen: boolean;
    onClose: () => void;
}

const searchPluginKey = new PluginKey('searchHighlight');

export default function FindReplace({ editor, isOpen, onClose }: FindReplaceProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');
    const [showReplace, setShowReplace] = useState(false);
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [matchCount, setMatchCount] = useState(0);
    const [currentMatch, setCurrentMatch] = useState(0);
    const searchRef = useRef<HTMLInputElement>(null);
    const matchPositionsRef = useRef<{ from: number; to: number }[]>([]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && searchRef.current) {
            searchRef.current.focus();
            searchRef.current.select();
        }
    }, [isOpen]);

    // Search and highlight
    const performSearch = useCallback(() => {
        if (!editor || !searchTerm) {
            setMatchCount(0);
            setCurrentMatch(0);
            matchPositionsRef.current = [];
            // Remove highlights
            if (editor) {
                const existingPlugin = editor.view.state.plugins.find(
                    (p) => (p as Plugin & { key: string }).key === searchPluginKey.key
                );
                if (existingPlugin) {
                    editor.view.dispatch(editor.view.state.tr.setMeta(searchPluginKey, { decorations: DecorationSet.empty }));
                }
            }
            return;
        }

        const doc = editor.state.doc;
        const positions: { from: number; to: number }[] = [];
        const searchString = caseSensitive ? searchTerm : searchTerm.toLowerCase();

        doc.descendants((node, pos) => {
            if (!node.isText || !node.text) return;
            const text = caseSensitive ? node.text : node.text.toLowerCase();
            let index = text.indexOf(searchString);
            while (index !== -1) {
                positions.push({
                    from: pos + index,
                    to: pos + index + searchTerm.length,
                });
                index = text.indexOf(searchString, index + 1);
            }
        });

        matchPositionsRef.current = positions;
        setMatchCount(positions.length);
        if (positions.length > 0 && currentMatch === 0) {
            setCurrentMatch(1);
        } else if (positions.length === 0) {
            setCurrentMatch(0);
        }

        // Apply decorations
        const decorations = positions.map((pos, i) =>
            Decoration.inline(pos.from, pos.to, {
                class: i === currentMatch - 1 ? 'search-highlight-active' : 'search-highlight',
            })
        );

        // Use transaction meta to signal decoration update
        const tr = editor.state.tr;
        tr.setMeta('searchDecorations', DecorationSet.create(doc, decorations));
        editor.view.dispatch(tr);
    }, [editor, searchTerm, caseSensitive, currentMatch]);

    useEffect(() => {
        performSearch();
    }, [performSearch]);

    const goToNext = () => {
        if (matchCount === 0) return;
        const next = currentMatch >= matchCount ? 1 : currentMatch + 1;
        setCurrentMatch(next);
        scrollToMatch(next - 1);
    };

    const goToPrev = () => {
        if (matchCount === 0) return;
        const prev = currentMatch <= 1 ? matchCount : currentMatch - 1;
        setCurrentMatch(prev);
        scrollToMatch(prev - 1);
    };

    const scrollToMatch = (index: number) => {
        if (!editor || index < 0 || index >= matchPositionsRef.current.length) return;
        const pos = matchPositionsRef.current[index];
        editor.commands.setTextSelection(pos);
        editor.commands.scrollIntoView();
    };

    const replaceOne = () => {
        if (!editor || matchCount === 0 || currentMatch === 0) return;
        const pos = matchPositionsRef.current[currentMatch - 1];
        if (!pos) return;

        editor.chain()
            .focus()
            .setTextSelection(pos)
            .deleteSelection()
            .insertContent(replaceTerm)
            .run();

        // Re-search after replacement
        setTimeout(performSearch, 50);
    };

    const replaceAll = () => {
        if (!editor || matchCount === 0) return;

        // Replace from end to start to preserve positions
        const positions = [...matchPositionsRef.current].reverse();
        const { tr } = editor.state;

        positions.forEach((pos) => {
            tr.replaceWith(pos.from, pos.to, editor.state.schema.text(replaceTerm));
        });

        editor.view.dispatch(tr);
        setSearchTerm('');
        setMatchCount(0);
        setCurrentMatch(0);
    };

    // Handle keyboard shortcuts
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            goToNext();
        } else if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            goToPrev();
        }
    };

    // Clear decorations on close
    useEffect(() => {
        if (!isOpen && editor) {
            const tr = editor.state.tr;
            tr.setMeta('searchDecorations', DecorationSet.empty);
            editor.view.dispatch(tr);
            setSearchTerm('');
            setReplaceTerm('');
            setMatchCount(0);
            setCurrentMatch(0);
        }
    }, [isOpen, editor]);

    if (!isOpen) return null;

    return (
        <div className="find-replace-bar" onKeyDown={handleKeyDown}>
            <div className="find-row">
                <input
                    ref={searchRef}
                    type="text"
                    className="find-input"
                    placeholder="Find..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="match-counter">
                    {matchCount > 0 ? `${currentMatch} of ${matchCount}` : 'No results'}
                </span>
                <button className="find-btn" onClick={goToPrev} title="Previous (Shift+Enter)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="18 15 12 9 6 15" />
                    </svg>
                </button>
                <button className="find-btn" onClick={goToNext} title="Next (Enter)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
                <button
                    className={`find-btn option-btn ${caseSensitive ? 'active' : ''}`}
                    onClick={() => setCaseSensitive(!caseSensitive)}
                    title="Case sensitive"
                >
                    Aa
                </button>
                <button
                    className="find-btn"
                    onClick={() => setShowReplace(!showReplace)}
                    title="Toggle replace"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 1l4 4-4 4" />
                        <path d="M3 11V9a4 4 0 014-4h14" />
                        <path d="M7 23l-4-4 4-4" />
                        <path d="M21 13v2a4 4 0 01-4 4H3" />
                    </svg>
                </button>
                <button className="find-btn close-btn" onClick={onClose} title="Close (Esc)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            {showReplace && (
                <div className="replace-row">
                    <input
                        type="text"
                        className="find-input"
                        placeholder="Replace with..."
                        value={replaceTerm}
                        onChange={(e) => setReplaceTerm(e.target.value)}
                    />
                    <button className="find-btn replace-btn" onClick={replaceOne} title="Replace">
                        Replace
                    </button>
                    <button className="find-btn replace-btn" onClick={replaceAll} title="Replace all">
                        All
                    </button>
                </div>
            )}
        </div>
    );
}
