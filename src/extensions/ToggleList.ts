import { Node, mergeAttributes } from '@tiptap/core';

export interface ToggleListOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        synapseToggleList: {
            setToggleList: () => ReturnType;
            unsetToggleList: () => ReturnType;
        };
    }
}

const ToggleList = Node.create<ToggleListOptions>({
    name: 'toggleList',
    group: 'block',
    content: 'block+',
    defining: true,

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            open: {
                default: true,
                parseHTML: (element: Element) => element.hasAttribute('open'),
                renderHTML: (attributes: Record<string, unknown>) => {
                    if (!attributes.open) return {};
                    return { open: 'open' };
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'details' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'details',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                class: 'toggle-list',
            }),
            [
                'summary',
                { class: 'toggle-list-summary' },
                'Toggle',
            ],
            ['div', { class: 'toggle-list-content' }, 0],
        ];
    },

    addCommands() {
        return {
            setToggleList:
                () =>
                    ({ commands }: { commands: any }) => {
                        return commands.wrapIn(this.name);
                    },
            unsetToggleList:
                () =>
                    ({ commands }: { commands: any }) => {
                        return commands.lift(this.name);
                    },
        };
    },

    addKeyboardShortcuts() {
        return {
            'Mod-Enter': ({ editor }) => {
                if (!editor.isActive(this.name)) return false;
                const { state, dispatch } = editor.view;
                const { $from } = state.selection;
                for (let d = $from.depth; d >= 0; d--) {
                    if ($from.node(d).type.name === this.name) {
                        const pos = $from.before(d);
                        const node = state.doc.nodeAt(pos);
                        if (node) {
                            dispatch(
                                state.tr.setNodeMarkup(pos, undefined, {
                                    ...node.attrs,
                                    open: !node.attrs.open,
                                })
                            );
                        }
                        return true;
                    }
                }
                return false;
            },
        };
    },
});

export default ToggleList;
