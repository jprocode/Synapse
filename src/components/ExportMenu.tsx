import { useState } from 'react';

interface ExportMenuProps {
    noteTitle: string;
    getHTML: () => string;
    getText: () => string;
    isOpen: boolean;
    onClose: () => void;
}

export default function ExportMenu({ noteTitle, getHTML, getText, isOpen, onClose }: ExportMenuProps) {
    const [exporting, setExporting] = useState(false);

    const sanitizeFilename = (name: string) => {
        return name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'untitled';
    };

    const downloadFile = (content: string, filename: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const exportMarkdown = () => {
        setExporting(true);
        try {
            // Convert HTML to basic Markdown
            const html = getHTML();
            let md = html
                // Headings
                .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
                .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
                .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
                .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
                // Bold, italic, strike, code
                .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
                .replace(/<em>(.*?)<\/em>/gi, '*$1*')
                .replace(/<s>(.*?)<\/s>/gi, '~~$1~~')
                .replace(/<code>(.*?)<\/code>/gi, '`$1`')
                // Links
                .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
                // Lists
                .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
                .replace(/<\/?[ou]l[^>]*>/gi, '\n')
                // Blockquote
                .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
                // Paragraph
                .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
                // Horizontal rule
                .replace(/<hr[^>]*>/gi, '---\n\n')
                // Line breaks
                .replace(/<br\s*\/?>/gi, '\n')
                // Strip remaining HTML
                .replace(/<[^>]+>/g, '')
                // Decode entities
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                // Clean up extra whitespace
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            downloadFile(md, `${sanitizeFilename(noteTitle)}.md`, 'text/markdown');
        } finally {
            setExporting(false);
            onClose();
        }
    };

    const exportHTML = () => {
        setExporting(true);
        try {
            const html = getHTML();
            const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${noteTitle}</title>
  <style>
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      max-width: 720px;
      margin: 64px auto;
      padding: 0 24px;
      line-height: 1.7;
      color: #1A1A2E;
      background: #fff;
    }
    h1 { font-size: 2em; font-weight: 700; margin-top: 1.5em; }
    h2 { font-size: 1.5em; font-weight: 600; margin-top: 1.5em; }
    h3 { font-size: 1.25em; font-weight: 500; margin-top: 1.5em; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: #f0f0f0; padding: 16px; border-radius: 8px; overflow-x: auto; }
    blockquote { border-left: 3px solid #ddd; padding-left: 16px; color: #666; margin: 1em 0; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f0f0f0; font-weight: 600; }
    a { color: #5B8AF0; }
    hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
  </style>
</head>
<body>
  <h1>${noteTitle}</h1>
  ${html}
</body>
</html>`;
            downloadFile(fullHTML, `${sanitizeFilename(noteTitle)}.html`, 'text/html');
        } finally {
            setExporting(false);
            onClose();
        }
    };

    const exportText = () => {
        setExporting(true);
        try {
            const text = getText();
            downloadFile(text, `${sanitizeFilename(noteTitle)}.txt`, 'text/plain');
        } finally {
            setExporting(false);
            onClose();
        }
    };

    const exportPDF = () => {
        setExporting(true);
        try {
            // Create a hidden iframe for print-to-PDF
            const html = getHTML();
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${noteTitle}</title>
  <style>
    body {
      font-family: 'Inter', system-ui, sans-serif;
      max-width: 720px;
      margin: 40px auto;
      padding: 0 24px;
      line-height: 1.7;
      color: #1A1A2E;
    }
    h1 { font-size: 2em; font-weight: 700; }
    h2 { font-size: 1.5em; font-weight: 600; }
    h3 { font-size: 1.25em; font-weight: 500; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
    pre { background: #f0f0f0; padding: 16px; border-radius: 8px; }
    blockquote { border-left: 3px solid #ddd; padding-left: 16px; color: #666; }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${noteTitle}</h1>
  ${html}
</body>
</html>`);
                printWindow.document.close();
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 250);
            }
        } finally {
            setExporting(false);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="export-backdrop" onClick={onClose} />
            <div className="export-menu">
                <div className="export-menu-header">Export Note</div>
                <button className="export-option" onClick={exportMarkdown} disabled={exporting}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                        <path d="M14 2v6h6" />
                    </svg>
                    <span>Markdown (.md)</span>
                </button>
                <button className="export-option" onClick={exportHTML} disabled={exporting}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                    </svg>
                    <span>HTML (.html)</span>
                </button>
                <button className="export-option" onClick={exportText} disabled={exporting}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="17" y1="10" x2="3" y2="10" />
                        <line x1="21" y1="6" x2="3" y2="6" />
                        <line x1="21" y1="14" x2="3" y2="14" />
                        <line x1="17" y1="18" x2="3" y2="18" />
                    </svg>
                    <span>Plain Text (.txt)</span>
                </button>
                <button className="export-option" onClick={exportPDF} disabled={exporting}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2z" />
                        <path d="M13 2v6h6" />
                    </svg>
                    <span>PDF (via Print)</span>
                </button>
            </div>
        </>
    );
}
