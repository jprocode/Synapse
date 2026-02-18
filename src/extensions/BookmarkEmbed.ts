import { Node, mergeAttributes } from '@tiptap/core';

export interface BookmarkEmbedOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        bookmarkEmbed: {
            setBookmarkEmbed: (attrs: {
                url: string;
                title?: string;
                description?: string;
                favicon?: string;
            }) => ReturnType;
        };
    }
}

const BookmarkEmbed = Node.create<BookmarkEmbedOptions>({
    name: 'bookmarkEmbed',
    group: 'block',
    atom: true,
    draggable: true,

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            url: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-url'),
                renderHTML: (attributes) => ({ 'data-url': attributes.url }),
            },
            title: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-title'),
                renderHTML: (attributes) => {
                    if (!attributes.title) return {};
                    return { 'data-title': attributes.title };
                },
            },
            description: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-description'),
                renderHTML: (attributes) => {
                    if (!attributes.description) return {};
                    return { 'data-description': attributes.description };
                },
            },
            favicon: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-favicon'),
                renderHTML: (attributes) => {
                    if (!attributes.favicon) return {};
                    return { 'data-favicon': attributes.favicon };
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="bookmark"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        const url = HTMLAttributes['data-url'] || '';
        const title = HTMLAttributes['data-title'] || url;
        const description = HTMLAttributes['data-description'] || '';
        const favicon = HTMLAttributes['data-favicon'] || '';
        let domain = '';
        try {
            domain = new URL(url).hostname;
        } catch {
            domain = url;
        }

        return [
            'div',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-type': 'bookmark',
                class: 'bookmark-embed',
                contenteditable: 'false',
            }),
            [
                'div',
                { class: 'bookmark-content' },
                ['div', { class: 'bookmark-title' }, title],
                ...(description
                    ? [['div', { class: 'bookmark-description' }, description]]
                    : []),
                [
                    'div',
                    { class: 'bookmark-meta' },
                    ...(favicon
                        ? [['img', { class: 'bookmark-favicon', src: favicon, alt: '' }]]
                        : []),
                    ['span', { class: 'bookmark-domain' }, domain],
                ],
            ],
        ];
    },

    addCommands() {
        return {
            setBookmarkEmbed:
                (attrs) =>
                    ({ commands }) => {
                        return commands.insertContent({
                            type: this.name,
                            attrs,
                        });
                    },
        };
    },
});

export default BookmarkEmbed;
