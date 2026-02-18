import { Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface TableOfContentsOptions {
    HTMLAttributes: Record<string, unknown>;
}

interface HeadingItem {
    level: number;
    text: string;
    pos: number;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        tableOfContents: {
            insertTableOfContents: () => ReturnType;
        };
    }
}

const tocPluginKey = new PluginKey('tableOfContents');

const TableOfContents = Node.create<TableOfContentsOptions>({
    name: 'tableOfContents',
    group: 'block',
    atom: true,
    draggable: true,

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="toc"]' }];
    },

    renderHTML() {
        return [
            'div',
            {
                'data-type': 'toc',
                class: 'table-of-contents',
                contenteditable: 'false',
            },
            ['p', { class: 'toc-title' }, 'Table of Contents'],
            ['nav', { class: 'toc-list' }, ''],
        ];
    },

    addCommands() {
        return {
            insertTableOfContents:
                () =>
                    ({ commands }) => {
                        return commands.insertContent({
                            type: this.name,
                        });
                    },
        };
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: tocPluginKey,
                props: {
                    decorations: (state) => {
                        const decorations: Decoration[] = [];
                        const headings: HeadingItem[] = [];

                        // Collect all headings
                        state.doc.descendants((node, pos) => {
                            if (node.type.name === 'heading') {
                                headings.push({
                                    level: node.attrs.level,
                                    text: node.textContent,
                                    pos,
                                });
                            }
                        });

                        // Find all TOC nodes and add decorations
                        state.doc.descendants((node, pos) => {
                            if (node.type.name === 'tableOfContents') {
                                const tocHtml = headings
                                    .map(
                                        (h) =>
                                            `<a class="toc-item toc-level-${h.level}" data-pos="${h.pos}">${h.text}</a>`
                                    )
                                    .join('');

                                const fullHtml = `<div data-type="toc" class="table-of-contents" contenteditable="false">
                  <p class="toc-title">Table of Contents</p>
                  <nav class="toc-list">${tocHtml || '<p class="toc-empty">No headings found</p>'}</nav>
                </div>`;

                                decorations.push(
                                    Decoration.node(pos, pos + node.nodeSize, {}, {
                                        innerHTML: fullHtml,
                                    })
                                );
                            }
                        });

                        return DecorationSet.create(state.doc, decorations);
                    },
                },
            }),
        ];
    },
});

export default TableOfContents;
