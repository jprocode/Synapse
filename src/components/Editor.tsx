import { useEffect, useRef, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';

// StarterKit bundles: Document, Paragraph, Text, Heading, Bold, Italic,
// Strike, Code, HardBreak, Dropcursor, Gapcursor,
// Blockquote, BulletList, OrderedList, ListItem, HorizontalRule, CodeBlock
import StarterKit from '@tiptap/starter-kit';

// Additional extensions (not in StarterKit)
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import CharacterCount from '@tiptap/extension-character-count';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-text-style';
import Typography from '@tiptap/extension-typography';

// Custom extensions
import Callout from '../extensions/Callout';
import WikiLink from '../extensions/WikiLink';
import TableOfContents from '../extensions/TableOfContents';
import MathBlock from '../extensions/MathBlock';
import MathInline from '../extensions/MathInline';
import InlineComment from '../extensions/InlineComment';
import MarkdownExtraInputRules from '../extensions/MarkdownExtraInputRules';
import ObsidianComment from '../extensions/ObsidianComment';
import { FootnoteRef, FootnoteDef } from '../extensions/Footnote';

// Sub-components
import FindReplace from './FindReplace';
import ExportMenu from './ExportMenu';
import VersionHistory from './VersionHistory';
import RawMarkdown from './RawMarkdown';

// KaTeX CSS for math rendering
import 'katex/dist/katex.min.css';

// Lowlight for code block syntax highlighting
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

// Highlight color presets
const HIGHLIGHT_COLORS = [
    { name: 'Yellow', color: '#fef08a' },
    { name: 'Green', color: '#bbf7d0' },
    { name: 'Blue', color: '#bfdbfe' },
    { name: 'Pink', color: '#fbcfe8' },
    { name: 'Purple', color: '#e9d5ff' },
    { name: 'Orange', color: '#fed7aa' },
    { name: 'Grey', color: '#e5e7eb' },
];

// Text color presets
const TEXT_COLORS = [
    { name: 'Default', color: '' },
    { name: 'Red', color: '#ef4444' },
    { name: 'Orange', color: '#f97316' },
    { name: 'Yellow', color: '#eab308' },
    { name: 'Green', color: '#22c55e' },
    { name: 'Blue', color: '#3b82f6' },
    { name: 'Purple', color: '#a855f7' },
    { name: 'Pink', color: '#ec4899' },
    { name: 'Grey', color: '#6b7280' },
];

interface EditorProps {
    noteId: string | null;
    noteTitle: string;
    content: string;
    saving: boolean;
    onSave: (id: string, content: string) => void;
    onContentChange: (content: string) => void;
    onTitleChange: (title: string) => void;
}

export default function Editor({ noteId, noteTitle, content, saving, onSave, onContentChange, onTitleChange: _onTitleChange }: EditorProps) {
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedContentRef = useRef<string>('');
    const noteIdRef = useRef<string | null>(null);

    // UI state
    const [focusMode, setFocusMode] = useState(false);
    const [findReplaceOpen, setFindReplaceOpen] = useState(false);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
    const [rawMarkdownOpen, setRawMarkdownOpen] = useState(false);
    const [showHighlightPicker, setShowHighlightPicker] = useState(false);
    const [showTextColorPicker, setShowTextColorPicker] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4] },
                dropcursor: { color: '#7c5bf0', width: 2 },
                codeBlock: false, // replaced by CodeBlockLowlight
            }),

            // Additional inline marks
            Underline,
            Subscript,
            Superscript,
            Highlight.configure({ multicolor: true }),
            TextStyle,
            Color,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { class: 'editor-link' },
            }),

            // Task lists
            TaskList,
            TaskItem.configure({ nested: true }),

            // Images
            Image.configure({
                inline: false,
                allowBase64: true,
            }),

            // Code blocks with syntax highlighting
            CodeBlockLowlight.configure({
                lowlight,
                defaultLanguage: 'plaintext',
            }),

            // Tables
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,

            // Text alignment
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),

            // Typography (smart quotes, em-dashes, ellipsis)
            Typography,

            // Character count
            CharacterCount,

            // Custom extensions
            Callout,
            WikiLink,
            TableOfContents,
            MathBlock,
            MathInline,
            InlineComment,
            MarkdownExtraInputRules,
            ObsidianComment,
            FootnoteRef,
            FootnoteDef,

            // Placeholder
            Placeholder.configure({
                placeholder: ({ node }) => {
                    if (node.type.name === 'heading') {
                        const level = node.attrs.level;
                        return `Heading ${level}`;
                    }
                    return 'Type something, or use markdown shortcuts...';
                },
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'editor-content',
                spellcheck: 'true',
            },
            handleKeyDown: (_view, event) => {
                // Cmd+Shift+S → Strikethrough
                if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'S') {
                    event.preventDefault();
                    editor?.chain().focus().toggleStrike().run();
                    return true;
                }
                // Cmd+E is handled by App.tsx for reading mode toggle
                // Cmd+Shift+H → Highlight
                if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'H') {
                    event.preventDefault();
                    editor?.chain().focus().toggleHighlight().run();
                    return true;
                }
                // Cmd+Alt+1/2/3/4 → Headings
                if ((event.metaKey || event.ctrlKey) && event.altKey) {
                    const level = parseInt(event.key);
                    if (level >= 1 && level <= 4) {
                        event.preventDefault();
                        editor?.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 }).run();
                        return true;
                    }
                }
                // Cmd+Shift+7 → Numbered list
                if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === '7') {
                    event.preventDefault();
                    editor?.chain().focus().toggleOrderedList().run();
                    return true;
                }
                // Cmd+Shift+8 → Bullet list
                if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === '8') {
                    event.preventDefault();
                    editor?.chain().focus().toggleBulletList().run();
                    return true;
                }
                // Cmd+Shift+9 → Checkbox/Task list
                if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === '9') {
                    event.preventDefault();
                    editor?.chain().focus().toggleTaskList().run();
                    return true;
                }
                // Cmd+Shift+B → Blockquote
                if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'B') {
                    event.preventDefault();
                    editor?.chain().focus().toggleBlockquote().run();
                    return true;
                }
                // Cmd+Alt+C → Code block
                if ((event.metaKey || event.ctrlKey) && event.altKey && event.key === 'c') {
                    event.preventDefault();
                    editor?.chain().focus().toggleCodeBlock().run();
                    return true;
                }
                // Cmd+Enter → Toggle checkbox
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    if (editor?.isActive('taskItem')) {
                        event.preventDefault();
                        const { state, dispatch } = editor.view;
                        const { $from } = state.selection;
                        let taskItemPos: number | null = null;
                        for (let d = $from.depth; d >= 0; d--) {
                            if ($from.node(d).type.name === 'taskItem') {
                                taskItemPos = $from.before(d);
                                break;
                            }
                        }
                        if (taskItemPos !== null) {
                            const taskNode = state.doc.nodeAt(taskItemPos);
                            if (taskNode) {
                                dispatch(
                                    state.tr.setNodeMarkup(taskItemPos, undefined, {
                                        ...taskNode.attrs,
                                        checked: !taskNode.attrs.checked,
                                    })
                                );
                            }
                        }
                        return true;
                    }
                }
                return false;
            },
        },
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            onContentChange(html);

            // Auto-save after 2 seconds of inactivity
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            if (noteIdRef.current && html !== lastSavedContentRef.current) {
                saveTimerRef.current = setTimeout(() => {
                    if (noteIdRef.current) {
                        onSave(noteIdRef.current, html);
                        lastSavedContentRef.current = html;
                    }
                }, 2000);
            }
        },
        onBlur: ({ editor }) => {
            // Save on blur
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
            const html = editor.getHTML();
            if (noteIdRef.current && html !== lastSavedContentRef.current) {
                onSave(noteIdRef.current, html);
                lastSavedContentRef.current = html;
            }
        },
    });

    // Keep noteIdRef in sync
    useEffect(() => {
        noteIdRef.current = noteId;
    }, [noteId]);

    // Update editor content when switching notes (not on every content change)
    useEffect(() => {
        if (editor && noteId) {
            const currentHtml = editor.getHTML();
            // Only set content when switching to a different note
            if (currentHtml !== content) {
                editor.commands.setContent(content || '');
                lastSavedContentRef.current = content || '';
            }
        } else if (editor) {
            editor.commands.clearContent();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, noteId]);

    // Global keyboard shortcuts
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Cmd+S → Force save
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            if (noteIdRef.current && editor) {
                const html = editor.getHTML();
                onSave(noteIdRef.current, html);
                lastSavedContentRef.current = html;
            }
        }
        // Cmd+Shift+L → Focus mode
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'l') {
            e.preventDefault();
            setFocusMode(prev => !prev);
        }
        // Cmd+F → Find & Replace
        if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
            e.preventDefault();
            setFindReplaceOpen(prev => !prev);
        }
        // Cmd+Shift+M → Raw markdown toggle
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'm') {
            e.preventDefault();
            setRawMarkdownOpen(prev => !prev);
        }
    }, [editor, onSave]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    // Character count stats
    const wordCount = editor?.storage.characterCount?.words() ?? 0;
    const charCount = editor?.storage.characterCount?.characters() ?? 0;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    // Close color pickers on outside click
    useEffect(() => {
        const close = () => {
            setShowHighlightPicker(false);
            setShowTextColorPicker(false);
        };
        if (showHighlightPicker || showTextColorPicker) {
            document.addEventListener('click', close);
            return () => document.removeEventListener('click', close);
        }
    }, [showHighlightPicker, showTextColorPicker]);

    if (!noteId) {
        return (
            <div className="editor-empty">
                <div className="editor-empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                    </svg>
                </div>
                <h2>Select a note or create a new one</h2>
                <p>Use <kbd>⌘</kbd> + <kbd>K</kbd> to open the command palette</p>
            </div>
        );
    }

    return (
        <div className={`editor-wrapper ${focusMode ? 'focus-mode' : ''}`}>
            {/* Top Bar Controls */}
            <div className="editor-topbar">
                <div className="topbar-left">
                    {/* Save indicator */}
                    <div className="save-indicator">
                        {saving ? (
                            <span className="saving">
                                <span className="saving-dot" />
                                Saving...
                            </span>
                        ) : (
                            <span className="saved">Saved</span>
                        )}
                    </div>
                </div>
                <div className="topbar-right">
                    <button
                        className={`topbar-btn ${focusMode ? 'active' : ''}`}
                        onClick={() => setFocusMode(!focusMode)}
                        title="Focus Mode (⌘⇧L)"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </button>
                    <button
                        className="topbar-btn"
                        onClick={() => setFindReplaceOpen(!findReplaceOpen)}
                        title="Find & Replace (⌘F)"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </button>
                    <button
                        className="topbar-btn"
                        onClick={() => setExportMenuOpen(!exportMenuOpen)}
                        title="Export"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                    </button>
                    <button
                        className={`topbar-btn ${rawMarkdownOpen ? 'active' : ''}`}
                        onClick={() => setRawMarkdownOpen(!rawMarkdownOpen)}
                        title="Raw Markdown (⌘⇧M)"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="16 18 22 12 16 6" />
                            <polyline points="8 6 2 12 8 18" />
                        </svg>
                    </button>
                    <button
                        className={`topbar-btn ${versionHistoryOpen ? 'active' : ''}`}
                        onClick={() => setVersionHistoryOpen(!versionHistoryOpen)}
                        title="Version History"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Find & Replace */}
            <FindReplace
                editor={editor}
                isOpen={findReplaceOpen}
                onClose={() => setFindReplaceOpen(false)}
            />

            {/* Export Menu */}
            <ExportMenu
                noteTitle={noteTitle}
                getHTML={() => editor?.getHTML() ?? ''}
                getText={() => editor?.getText() ?? ''}
                isOpen={exportMenuOpen}
                onClose={() => setExportMenuOpen(false)}
            />

            {/* Fixed Toolbar */}
            {!focusMode && (
                <div className="editor-toolbar">
                    <div className="toolbar-group">
                        <button
                            onClick={() => editor?.chain().focus().toggleBold().run()}
                            className={`toolbar-btn ${editor?.isActive('bold') ? 'active' : ''}`}
                            title="Bold (⌘B)"
                        >
                            <strong>B</strong>
                        </button>
                        <button
                            onClick={() => editor?.chain().focus().toggleItalic().run()}
                            className={`toolbar-btn ${editor?.isActive('italic') ? 'active' : ''}`}
                            title="Italic (⌘I)"
                        >
                            <em>I</em>
                        </button>
                        <button
                            onClick={() => editor?.chain().focus().toggleUnderline().run()}
                            className={`toolbar-btn ${editor?.isActive('underline') ? 'active' : ''}`}
                            title="Underline (⌘U)"
                        >
                            <span style={{ textDecoration: 'underline' }}>U</span>
                        </button>
                        <button
                            onClick={() => editor?.chain().focus().toggleStrike().run()}
                            className={`toolbar-btn ${editor?.isActive('strike') ? 'active' : ''}`}
                            title="Strikethrough (⌘⇧S)"
                        >
                            <s>S</s>
                        </button>
                        <button
                            onClick={() => editor?.chain().focus().toggleCode().run()}
                            className={`toolbar-btn ${editor?.isActive('code') ? 'active' : ''}`}
                            title="Inline Code (⌘E)"
                        >
                            {'</>'}
                        </button>
                    </div>

                    <div className="toolbar-divider" />

                    {/* Text Color */}
                    <div className="toolbar-group">
                        <div className="toolbar-dropdown-wrapper" onClick={(e) => e.stopPropagation()}>
                            <button
                                className="toolbar-btn"
                                onClick={() => setShowTextColorPicker(!showTextColorPicker)}
                                title="Text Color"
                            >
                                <span style={{ borderBottom: '2px solid var(--accent)', paddingBottom: '1px' }}>A</span>
                            </button>
                            {showTextColorPicker && (
                                <div className="color-picker-dropdown">
                                    {TEXT_COLORS.map(c => (
                                        <button
                                            key={c.name}
                                            className="color-swatch"
                                            style={{ background: c.color || 'var(--text-primary)' }}
                                            title={c.name}
                                            onClick={() => {
                                                if (c.color) {
                                                    editor?.chain().focus().setColor(c.color).run();
                                                } else {
                                                    editor?.chain().focus().unsetColor().run();
                                                }
                                                setShowTextColorPicker(false);
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Highlight Color */}
                        <div className="toolbar-dropdown-wrapper" onClick={(e) => e.stopPropagation()}>
                            <button
                                className={`toolbar-btn ${editor?.isActive('highlight') ? 'active' : ''}`}
                                onClick={() => setShowHighlightPicker(!showHighlightPicker)}
                                title="Highlight (⌘⇧H)"
                            >
                                <span className="toolbar-highlight-icon">HL</span>
                            </button>
                            {showHighlightPicker && (
                                <div className="color-picker-dropdown">
                                    {HIGHLIGHT_COLORS.map(c => (
                                        <button
                                            key={c.name}
                                            className="color-swatch"
                                            style={{ background: c.color }}
                                            title={c.name}
                                            onClick={() => {
                                                editor?.chain().focus().toggleHighlight({ color: c.color }).run();
                                                setShowHighlightPicker(false);
                                            }}
                                        />
                                    ))}
                                    <button
                                        className="color-swatch color-swatch-remove"
                                        title="Remove highlight"
                                        onClick={() => {
                                            editor?.chain().focus().unsetHighlight().run();
                                            setShowHighlightPicker(false);
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Link */}
                        <button
                            onClick={() => {
                                const prev = editor?.getAttributes('link').href;
                                const url = window.prompt('Enter URL:', prev || 'https://');
                                if (url === null) return;
                                if (url === '') {
                                    editor?.chain().focus().unsetLink().run();
                                } else {
                                    editor?.chain().focus().setLink({ href: url }).run();
                                }
                            }}
                            className={`toolbar-btn ${editor?.isActive('link') ? 'active' : ''}`}
                            title="Link (⌘K)"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                        </button>
                    </div>

                    <div className="toolbar-divider" />

                    <div className="toolbar-group">
                        <button
                            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                            className={`toolbar-btn ${editor?.isActive('heading', { level: 1 }) ? 'active' : ''}`}
                            title="Heading 1 (⌘⌥1)"
                        >
                            H1
                        </button>
                        <button
                            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                            className={`toolbar-btn ${editor?.isActive('heading', { level: 2 }) ? 'active' : ''}`}
                            title="Heading 2 (⌘⌥2)"
                        >
                            H2
                        </button>
                        <button
                            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                            className={`toolbar-btn ${editor?.isActive('heading', { level: 3 }) ? 'active' : ''}`}
                            title="Heading 3 (⌘⌥3)"
                        >
                            H3
                        </button>
                    </div>

                    <div className="toolbar-divider" />

                    <div className="toolbar-group">
                        <button
                            onClick={() => editor?.chain().focus().toggleBulletList().run()}
                            className={`toolbar-btn ${editor?.isActive('bulletList') ? 'active' : ''}`}
                            title="Bullet List (⌘⇧8)"
                        >
                            •
                        </button>
                        <button
                            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                            className={`toolbar-btn ${editor?.isActive('orderedList') ? 'active' : ''}`}
                            title="Ordered List (⌘⇧7)"
                        >
                            1.
                        </button>
                        <button
                            onClick={() => editor?.chain().focus().toggleTaskList().run()}
                            className={`toolbar-btn ${editor?.isActive('taskList') ? 'active' : ''}`}
                            title="Checkbox (⌘⇧9)"
                        >
                            ☑
                        </button>
                        <button
                            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                            className={`toolbar-btn ${editor?.isActive('codeBlock') ? 'active' : ''}`}
                            title="Code Block (⌘⌥C)"
                        >
                            {'{ }'}
                        </button>
                        <button
                            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                            className={`toolbar-btn ${editor?.isActive('blockquote') ? 'active' : ''}`}
                            title="Blockquote (⌘⇧B)"
                        >
                            ❝
                        </button>
                        <button
                            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                            className="toolbar-btn"
                            title="Divider"
                        >
                            ―
                        </button>
                    </div>

                    <div className="toolbar-divider" />

                    {/* Insert blocks */}
                    <div className="toolbar-group">
                        <button
                            onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                            className="toolbar-btn"
                            title="Insert Table"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="3" y1="15" x2="21" y2="15" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                                <line x1="15" y1="3" x2="15" y2="21" />
                            </svg>
                        </button>
                        <button
                            onClick={() => editor?.chain().focus().setCallout({ type: 'note', title: 'Note' }).run()}
                            className="toolbar-btn"
                            title="Insert Callout"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                        </button>
                        <button
                            onClick={() => {
                                const url = window.prompt('Enter image URL or paste base64:');
                                if (url) {
                                    editor?.chain().focus().setImage({ src: url }).run();
                                }
                            }}
                            className="toolbar-btn"
                            title="Insert Image"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                        </button>
                    </div>

                    <div className="toolbar-divider" />

                    {/* Alignment */}
                    <div className="toolbar-group">
                        <button
                            onClick={() => editor?.chain().focus().setTextAlign('left').run()}
                            className={`toolbar-btn ${editor?.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
                            title="Align Left"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" /></svg>
                        </button>
                        <button
                            onClick={() => editor?.chain().focus().setTextAlign('center').run()}
                            className={`toolbar-btn ${editor?.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
                            title="Align Center"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="10" x2="6" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="18" y1="18" x2="6" y2="18" /></svg>
                        </button>
                        <button
                            onClick={() => editor?.chain().focus().setTextAlign('right').run()}
                            className={`toolbar-btn ${editor?.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
                            title="Align Right"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="7" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="7" y2="18" /></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Bubble Menu (floating toolbar on text selection) */}
            {editor && (
                <BubbleMenu
                    editor={editor}
                    className="bubble-menu"
                >
                    <button
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`bubble-btn ${editor.isActive('bold') ? 'active' : ''}`}
                        title="Bold"
                    >
                        <strong>B</strong>
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`bubble-btn ${editor.isActive('italic') ? 'active' : ''}`}
                        title="Italic"
                    >
                        <em>I</em>
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        className={`bubble-btn ${editor.isActive('underline') ? 'active' : ''}`}
                        title="Underline"
                    >
                        <span style={{ textDecoration: 'underline' }}>U</span>
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        className={`bubble-btn ${editor.isActive('strike') ? 'active' : ''}`}
                        title="Strikethrough"
                    >
                        <s>S</s>
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleCode().run()}
                        className={`bubble-btn ${editor.isActive('code') ? 'active' : ''}`}
                        title="Inline Code"
                    >
                        {'</>'}
                    </button>
                    <div className="bubble-divider" />
                    <button
                        onClick={() => editor.chain().focus().toggleHighlight().run()}
                        className={`bubble-btn ${editor.isActive('highlight') ? 'active' : ''}`}
                        title="Highlight"
                    >
                        <span className="bubble-highlight-icon">HL</span>
                    </button>
                    <button
                        onClick={() => {
                            const prev = editor.getAttributes('link').href;
                            const url = window.prompt('Enter URL:', prev || 'https://');
                            if (url === null) return;
                            if (url === '') {
                                editor.chain().focus().unsetLink().run();
                            } else {
                                editor.chain().focus().setLink({ href: url }).run();
                            }
                        }}
                        className={`bubble-btn ${editor.isActive('link') ? 'active' : ''}`}
                        title="Link"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                    </button>
                    <div className="bubble-divider" />
                    <button
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        className={`bubble-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
                        title="Heading 1"
                    >
                        H1
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={`bubble-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
                        title="Heading 2"
                    >
                        H2
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        className={`bubble-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
                        title="Blockquote"
                    >
                        ❝
                    </button>
                </BubbleMenu>
            )}

            {/* Editor content area with raw markdown side panel */}
            <div className="editor-content-area">
                <div className={`editor-body ${rawMarkdownOpen ? 'split' : ''}`}>
                    <EditorContent editor={editor} />
                </div>

                {/* Raw Markdown Panel */}
                <RawMarkdown
                    content={editor?.getHTML() ?? ''}
                    isOpen={rawMarkdownOpen}
                    onContentChange={(md) => {
                        // Raw markdown changes — for read-only preview in this version
                        console.log('Raw markdown changed:', md.length, 'chars');
                    }}
                />

                {/* Version History Panel */}
                <VersionHistory
                    noteId={noteId}
                    isOpen={versionHistoryOpen}
                    onClose={() => setVersionHistoryOpen(false)}
                    onRestore={(restoredContent) => {
                        editor?.commands.setContent(restoredContent);
                        onContentChange(restoredContent);
                    }}
                />
            </div>

            {/* Status Bar */}
            <div className="editor-status-bar">
                <span>{wordCount} words</span>
                <span className="status-divider">·</span>
                <span>{charCount} characters</span>
                <span className="status-divider">·</span>
                <span>~{readingTime} min read</span>
                <span className="status-divider">·</span>
                <span>{editor?.state.doc.content.childCount ?? 0} paragraphs</span>
            </div>
        </div>
    );
}
