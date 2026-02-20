import { Node, mergeAttributes, InputRule } from '@tiptap/core';

/**
 * Footnote system for Obsidian-style markdown.
 *
 * Inline footnote reference: [^1] renders as a superscript link
 * Footnote definition block: [^1]: footnote text
 */

export interface FootnoteRefOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        footnoteRef: {
            insertFootnoteRef: (id: string) => ReturnType;
        };
    }
}

export const FootnoteRef = Node.create<FootnoteRefOptions>({
    name: 'footnoteRef',
    group: 'inline',
    inline: true,
    atom: true,

    addOptions() {
        return { HTMLAttributes: {} };
    },

    addAttributes() {
        return {
            id: {
                default: '1',
                parseHTML: (el: Element) => el.getAttribute('data-footnote-id') || '1',
                renderHTML: (attrs: Record<string, unknown>) => ({ 'data-footnote-id': attrs.id }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'sup[data-type="footnote-ref"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        const id = HTMLAttributes['data-footnote-id'] || '1';
        return [
            'sup',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-type': 'footnote-ref',
                class: 'footnote-ref',
                title: `Footnote ${id}`,
            }),
            `[${id}]`,
        ];
    },

    addCommands() {
        return {
            insertFootnoteRef:
                (id: string) =>
                    ({ commands }: { commands: any }) => {
                        return commands.insertContent({
                            type: this.name,
                            attrs: { id },
                        });
                    },
        };
    },

    addInputRules() {
        return [
            new InputRule({
                find: /\[\^(\w+)\]$/,
                handler: ({ range, match, chain }) => {
                    const id = match[1];
                    chain()
                        .deleteRange(range)
                        .insertFootnoteRef(id)
                        .run();
                },
            }),
        ];
    },
});

// ─── Footnote Definition ─────────────────────────────────────

export interface FootnoteDefOptions {
    HTMLAttributes: Record<string, unknown>;
}

export const FootnoteDef = Node.create<FootnoteDefOptions>({
    name: 'footnoteDef',
    group: 'block',
    content: 'inline*',
    defining: true,

    addOptions() {
        return { HTMLAttributes: {} };
    },

    addAttributes() {
        return {
            id: {
                default: '1',
                parseHTML: (el: Element) => el.getAttribute('data-footnote-id') || '1',
                renderHTML: (attrs: Record<string, unknown>) => ({ 'data-footnote-id': attrs.id }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="footnote-def"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        const id = HTMLAttributes['data-footnote-id'] || '1';
        return [
            'div',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-type': 'footnote-def',
                class: 'footnote-def',
            }),
            [
                'span',
                { class: 'footnote-def-id', contenteditable: 'false' },
                `[^${id}]:`,
            ],
            ['span', { class: 'footnote-def-content' }, 0],
        ];
    },
});

export default FootnoteRef;
