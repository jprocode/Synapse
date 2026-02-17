import { useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

interface EditorProps {
    noteId: string | null;
    content: string;
    saving: boolean;
    onSave: (id: string, content: string) => void;
    onContentChange: (content: string) => void;
}

export default function Editor({ noteId, content, saving, onSave, onContentChange }: EditorProps) {
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedContentRef = useRef<string>('');
    const noteIdRef = useRef<string | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Placeholder.configure({
                placeholder: 'Start writing...',
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'editor-content',
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

    // Update editor content when note changes
    useEffect(() => {
        if (editor && noteId) {
            editor.commands.setContent(content || '');
            lastSavedContentRef.current = content || '';
        } else if (editor) {
            editor.commands.clearContent();
        }
    }, [editor, noteId, content]);

    // Cmd+S force save
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
            if (noteIdRef.current && editor) {
                const html = editor.getHTML();
                onSave(noteIdRef.current, html);
                lastSavedContentRef.current = html;
            }
        }
    }, [editor, onSave]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, []);

    if (!noteId) {
        return (
            <div className="editor-empty">
                <div className="editor-empty-icon">📝</div>
                <h2>Select a note or create a new one</h2>
                <p>Use <kbd>⌘</kbd> + <kbd>K</kbd> to open the command palette</p>
            </div>
        );
    }

    return (
        <div className="editor-wrapper">
            {/* Toolbar */}
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
                        onClick={() => editor?.chain().focus().toggleStrike().run()}
                        className={`toolbar-btn ${editor?.isActive('strike') ? 'active' : ''}`}
                        title="Strikethrough"
                    >
                        <s>S</s>
                    </button>
                    <button
                        onClick={() => editor?.chain().focus().toggleCode().run()}
                        className={`toolbar-btn ${editor?.isActive('code') ? 'active' : ''}`}
                        title="Inline Code"
                    >
                        {'</>'}
                    </button>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-group">
                    <button
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                        className={`toolbar-btn ${editor?.isActive('heading', { level: 1 }) ? 'active' : ''}`}
                        title="Heading 1"
                    >
                        H1
                    </button>
                    <button
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={`toolbar-btn ${editor?.isActive('heading', { level: 2 }) ? 'active' : ''}`}
                        title="Heading 2"
                    >
                        H2
                    </button>
                    <button
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                        className={`toolbar-btn ${editor?.isActive('heading', { level: 3 }) ? 'active' : ''}`}
                        title="Heading 3"
                    >
                        H3
                    </button>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-group">
                    <button
                        onClick={() => editor?.chain().focus().toggleBulletList().run()}
                        className={`toolbar-btn ${editor?.isActive('bulletList') ? 'active' : ''}`}
                        title="Bullet List"
                    >
                        •
                    </button>
                    <button
                        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                        className={`toolbar-btn ${editor?.isActive('orderedList') ? 'active' : ''}`}
                        title="Ordered List"
                    >
                        1.
                    </button>
                    <button
                        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                        className={`toolbar-btn ${editor?.isActive('codeBlock') ? 'active' : ''}`}
                        title="Code Block"
                    >
                        {'{ }'}
                    </button>
                    <button
                        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                        className={`toolbar-btn ${editor?.isActive('blockquote') ? 'active' : ''}`}
                        title="Blockquote"
                    >
                        "
                    </button>
                </div>

                <div className="toolbar-spacer" />

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

            {/* Editor content */}
            <div className="editor-body">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}
