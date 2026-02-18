import { Mark, mergeAttributes } from '@tiptap/core';
import { InputRule } from '@tiptap/core';

export interface WikiLinkOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        wikiLink: {
            setWikiLink: (attrs: { noteTitle: string; noteId?: string }) => ReturnType;
            unsetWikiLink: () => ReturnType;
        };
    }
}

const WikiLink = Mark.create<WikiLinkOptions>({
    name: 'wikiLink',
    priority: 1000,
    inclusive: false,

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            noteTitle: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-note-title'),
                renderHTML: (attributes) => ({ 'data-note-title': attributes.noteTitle }),
            },
            noteId: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-note-id'),
                renderHTML: (attributes) => {
                    if (!attributes.noteId) return {};
                    return { 'data-note-id': attributes.noteId };
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'span[data-type="wiki-link"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'span',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-type': 'wiki-link',
                class: 'wiki-link',
            }),
            0,
        ];
    },

    addCommands() {
        return {
            setWikiLink:
                (attrs) =>
                    ({ commands }) => {
                        return commands.setMark(this.name, attrs);
                    },
            unsetWikiLink:
                () =>
                    ({ commands }) => {
                        return commands.unsetMark(this.name);
                    },
        };
    },

    addInputRules() {
        return [
            // Match [[note title]] pattern
            new InputRule({
                find: /\[\[([^\]]+)\]\]$/,
                handler: ({ state, range, match }) => {
                    const title = match[1];
                    const { tr } = state;
                    const start = range.from;
                    const end = range.to;

                    tr.replaceWith(
                        start,
                        end,
                        state.schema.text(title, [
                            state.schema.marks.wikiLink.create({ noteTitle: title }),
                        ])
                    );
                },
            }),
        ];
    },
});

export default WikiLink;
