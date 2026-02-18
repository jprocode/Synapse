import { useState, useRef, useEffect } from 'react';

interface NoteHeaderProps {
    noteId: string | null;
    title: string;
    createdAt: number;
    modifiedAt: number;
    wordCount: number;
    charCount: number;
    onTitleChange: (title: string) => void;
    onEditorFocus: () => void;
}

export default function NoteHeader({
    noteId,
    title,
    createdAt,
    modifiedAt,
    wordCount,
    charCount,
    onTitleChange,
    onEditorFocus,
}: NoteHeaderProps) {
    const [icon, setIcon] = useState<string | null>(null);
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [showProperties, setShowProperties] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const titleRef = useRef<HTMLTextAreaElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    // Common emojis for quick picker
    const quickEmojis = [
        '📝', '📋', '💡', '🎯', '🚀', '⚡', '🔥', '✨',
        '📖', '🧠', '🎨', '🔧', '📊', '🌟', '💻', '🏗',
        '📌', '🗂', '📁', '🔑', '🎵', '🎮', '🌍', '❤️',
    ];

    // Format date
    const formatDate = (timestamp: number) => {
        if (!timestamp) return '—';
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    // Auto-resize title textarea
    useEffect(() => {
        if (titleRef.current) {
            titleRef.current.style.height = 'auto';
            titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
        }
    }, [title]);

    // Handle Enter in title → focus editor body
    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onEditorFocus();
        }
    };

    // Handle cover image file selection
    const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = () => {
            setCoverImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    if (!noteId) return null;

    return (
        <div className="note-header-container">
            {/* Cover Image */}
            {coverImage && (
                <div className="note-cover-area">
                    <img
                        src={coverImage}
                        alt="Cover"
                        className="note-cover-image"
                    />
                    <div className="note-cover-actions">
                        <button
                            className="cover-btn"
                            onClick={() => coverInputRef.current?.click()}
                        >
                            Change cover
                        </button>
                        <button
                            className="cover-btn"
                            onClick={() => setCoverImage(null)}
                        >
                            Remove
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden file input for cover images */}
            <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleCoverSelect}
            />

            {/* Icon + Add Cover row */}
            <div className="note-icon-area">
                {icon ? (
                    <button
                        className="note-icon-btn has-icon"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        title="Change icon"
                    >
                        {icon}
                    </button>
                ) : (
                    <button
                        className="note-icon-btn add-icon"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        title="Add icon"
                    >
                        Add icon
                    </button>
                )}

                {!coverImage && (
                    <button
                        className="note-icon-btn add-icon"
                        onClick={() => coverInputRef.current?.click()}
                        title="Add cover image"
                    >
                        Add cover
                    </button>
                )}

                {showEmojiPicker && (
                    <div className="emoji-picker">
                        {icon && (
                            <button
                                className="emoji-remove"
                                onClick={() => {
                                    setIcon(null);
                                    setShowEmojiPicker(false);
                                }}
                            >
                                Remove
                            </button>
                        )}
                        <div className="emoji-grid">
                            {quickEmojis.map((emoji) => (
                                <button
                                    key={emoji}
                                    className="emoji-option"
                                    onClick={() => {
                                        setIcon(emoji);
                                        setShowEmojiPicker(false);
                                    }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Title */}
            <textarea
                ref={titleRef}
                className="note-title-input"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                placeholder="Untitled"
                rows={1}
                spellCheck={false}
            />

            {/* Properties Toggle */}
            <button
                className="properties-toggle"
                onClick={() => setShowProperties(!showProperties)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="19" cy="12" r="1" />
                    <circle cx="5" cy="12" r="1" />
                </svg>
                {showProperties ? 'Hide properties' : 'Properties'}
            </button>

            {/* Properties Bar */}
            {showProperties && (
                <div className="note-properties">
                    <div className="property-row">
                        <span className="property-label">Created</span>
                        <span className="property-value">{formatDate(createdAt)}</span>
                    </div>
                    <div className="property-row">
                        <span className="property-label">Modified</span>
                        <span className="property-value">{formatDate(modifiedAt)}</span>
                    </div>
                    <div className="property-row">
                        <span className="property-label">Words</span>
                        <span className="property-value">{wordCount.toLocaleString()}</span>
                    </div>
                    <div className="property-row">
                        <span className="property-label">Characters</span>
                        <span className="property-value">{charCount.toLocaleString()}</span>
                    </div>
                    <div className="property-row">
                        <span className="property-label">Reading time</span>
                        <span className="property-value">~{readingTime} min</span>
                    </div>
                </div>
            )}
        </div>
    );
}
