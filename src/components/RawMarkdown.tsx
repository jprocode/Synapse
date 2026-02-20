import { useState, useEffect, useRef } from 'react';

interface RawMarkdownProps {
    content: string;
    isOpen: boolean;
    onContentChange: (content: string) => void;
}

function htmlToMarkdown(html: string): string {
    let md = html
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
        .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<em>(.*?)<\/em>/gi, '*$1*')
        .replace(/<s>(.*?)<\/s>/gi, '~~$1~~')
        .replace(/<u>(.*?)<\/u>/gi, '__$1__')
        .replace(/<code>(.*?)<\/code>/gi, '`$1`')
        .replace(/<mark[^>]*>(.*?)<\/mark>/gi, '==$1==')
        .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
        .replace(/<li[^>]*data-checked="true"[^>]*>(.*?)<\/li>/gi, '- [x] $1\n')
        .replace(/<li[^>]*data-checked="false"[^>]*>(.*?)<\/li>/gi, '- [ ] $1\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<\/?[ou]l[^>]*>/gi, '\n')
        .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '> $1\n\n')
        .replace(/<hr[^>]*>/gi, '---\n\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return md;
}

export default function RawMarkdown({ content, isOpen, onContentChange: _onContentChange }: RawMarkdownProps) {
    const [rawContent, setRawContent] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            setRawContent(htmlToMarkdown(content));
        }
    }, [isOpen, content]);

    useEffect(() => {
        if (isOpen && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="raw-markdown-panel">
            <div className="raw-markdown-header">
                <span className="raw-markdown-label">Raw Markdown</span>
            </div>
            <textarea
                ref={textareaRef}
                className="raw-markdown-editor"
                value={rawContent}
                onChange={(e) => {
                    setRawContent(e.target.value);
                    // Note: real-time sync to rendered would require 
                    // a markdown→HTML parser (e.g. marked), which can
                    // be added later. For now, this provides read/edit access.
                }}
                spellCheck={false}
            />
        </div>
    );
}
