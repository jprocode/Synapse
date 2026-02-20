import { Mark, mergeAttributes, InputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Enhanced WikiLink extension for Obsidian-style wikilinks.
 *
 * Supported formats:
 * - [[Note]]           — link to a note
 * - [[Note|Alias]]     — link with display text
 * - [[Note#Heading]]   — link to a heading
 * - [[Note^blockid]]   — link to a block
 *
 * Features:
 * - Click to navigate (dispatch custom event)
 * - Broken link styling when target note doesn't exist
 * - Input rule: type [[...]] and it becomes a wikilink
 */

export interface WikiLinkOptions {
    HTMLAttributes: Record<string, unknown>;
    existingNotes: string[]; // list of existing note titles for broken-link detection
    onWikiLinkClick?: (target: string) => void;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        wikiLink: {
            setWikiLink: (attrs: { noteTitle: string; alias?: string; heading?: string; blockRef?: string }) => ReturnType;
            unsetWikiLink: () => ReturnType;
        };
    }
}

const wikiLinkPluginKey = new PluginKey('wikiLinkClick');

const WikiLink = Mark.create<WikiLinkOptions>({
    name: 'wikiLink',
    priority: 1000,
    inclusive: false,

    addOptions() {
        return {
            HTMLAttributes: {},
            existingNotes: [],
            onWikiLinkClick: undefined,
        };
    },

    addAttributes() {
        return {
            noteTitle: {
                default: null,
                parseHTML: (element: Element) => element.getAttribute('data-note-title'),
                renderHTML: (attributes: Record<string, unknown>) => ({ 'data-note-title': attributes.noteTitle }),
            },
            alias: {
                default: null,
                parseHTML: (element: Element) => element.getAttribute('data-alias'),
                renderHTML: (attributes: Record<string, unknown>) => {
                    if (!attributes.alias) return {};
                    return { 'data-alias': attributes.alias };
                },
            },
            heading: {
                default: null,
                parseHTML: (element: Element) => element.getAttribute('data-heading'),
                renderHTML: (attributes: Record<string, unknown>) => {
                    if (!attributes.heading) return {};
                    return { 'data-heading': attributes.heading };
                },
            },
            blockRef: {
                default: null,
                parseHTML: (element: Element) => element.getAttribute('data-block-ref'),
                renderHTML: (attributes: Record<string, unknown>) => {
                    if (!attributes.blockRef) return {};
                    return { 'data-block-ref': attributes.blockRef };
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'span[data-type="wiki-link"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        const noteTitle = HTMLAttributes['data-note-title'] as string || '';
        const existingNotes = this.options.existingNotes;
        const isBroken = noteTitle && existingNotes.length > 0 &&
            !existingNotes.some(n =>
                n.toLowerCase() === noteTitle.toLowerCase() ||
                n.replace('.md', '').toLowerCase() === noteTitle.toLowerCase()
            );

        return [
            'span',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-type': 'wiki-link',
                class: `wiki-link ${isBroken ? 'wiki-link-broken' : ''}`,
                title: isBroken ? `Create "${noteTitle}"` : noteTitle,
            }),
            0,
        ];
    },

    addCommands() {
        return {
            setWikiLink:
                (attrs) =>
                    ({ commands }: { commands: any }) => {
                        return commands.setMark(this.name, attrs);
                    },
            unsetWikiLink:
                () =>
                    ({ commands }: { commands: any }) => {
                        return commands.unsetMark(this.name);
                    },
        };
    },

    addInputRules() {
        return [
            // [[Note]] — basic link
            new InputRule({
                find: /\[\[([^\]|#^]+)\]\]$/,
                handler: ({ state, range, match }) => {
                    const title = match[1].trim();
                    const { tr } = state;
                    tr.replaceWith(
                        range.from,
                        range.to,
                        state.schema.text(title, [
                            state.schema.marks.wikiLink.create({ noteTitle: title }),
                        ])
                    );
                },
            }),
            // [[Note|Alias]] — link with alias
            new InputRule({
                find: /\[\[([^\]|#^]+)\|([^\]]+)\]\]$/,
                handler: ({ state, range, match }) => {
                    const title = match[1].trim();
                    const alias = match[2].trim();
                    const { tr } = state;
                    tr.replaceWith(
                        range.from,
                        range.to,
                        state.schema.text(alias, [
                            state.schema.marks.wikiLink.create({ noteTitle: title, alias }),
                        ])
                    );
                },
            }),
            // [[Note#Heading]] — section link
            new InputRule({
                find: /\[\[([^\]|#^]+)#([^\]]+)\]\]$/,
                handler: ({ state, range, match }) => {
                    const title = match[1].trim();
                    const heading = match[2].trim();
                    const displayText = `${title} > ${heading}`;
                    const { tr } = state;
                    tr.replaceWith(
                        range.from,
                        range.to,
                        state.schema.text(displayText, [
                            state.schema.marks.wikiLink.create({ noteTitle: title, heading }),
                        ])
                    );
                },
            }),
        ];
    },

    addProseMirrorPlugins() {
        const options = this.options;
        return [
            new Plugin({
                key: wikiLinkPluginKey,
                props: {
                    handleClick(view, pos) {
                        const { state } = view;
                        const $pos = state.doc.resolve(pos);
                        const marks = $pos.marks();
                        const wikiMark = marks.find(m => m.type.name === 'wikiLink');

                        if (wikiMark) {
                            const noteTitle = wikiMark.attrs.noteTitle;
                            if (noteTitle && options.onWikiLinkClick) {
                                options.onWikiLinkClick(noteTitle);
                                return true;
                            }
                            // Dispatch custom event for the app to handle
                            window.dispatchEvent(
                                new CustomEvent('wikilink-click', {
                                    detail: {
                                        noteTitle,
                                        heading: wikiMark.attrs.heading,
                                        blockRef: wikiMark.attrs.blockRef,
                                    },
                                })
                            );
                            return true;
                        }
                        return false;
                    },
                },
            }),
        ];
    },
});

export default WikiLink;
