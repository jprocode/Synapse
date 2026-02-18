import { Node, mergeAttributes } from '@tiptap/core';

// Column container — holds 2 or 3 Column children
export interface ColumnBlockOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        columnBlock: {
            setColumns: (columns?: number) => ReturnType;
            unsetColumns: () => ReturnType;
        };
    }
}

export const ColumnBlock = Node.create<ColumnBlockOptions>({
    name: 'columnBlock',
    group: 'block',
    content: 'column{2,3}',
    defining: true,
    isolating: true,

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            columns: {
                default: 2,
                parseHTML: (element) => parseInt(element.getAttribute('data-columns') || '2', 10),
                renderHTML: (attributes) => ({ 'data-columns': attributes.columns }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="column-block"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        const cols = HTMLAttributes['data-columns'] || 2;
        return [
            'div',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-type': 'column-block',
                class: `column-block columns-${cols}`,
                style: `display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 16px;`,
            }),
            0,
        ];
    },

    addCommands() {
        return {
            setColumns:
                (columns = 2) =>
                    ({ commands }) => {
                        const columnContent = Array.from({ length: columns }, () => ({
                            type: 'column',
                            content: [{ type: 'paragraph' }],
                        }));
                        return commands.insertContent({
                            type: this.name,
                            attrs: { columns },
                            content: columnContent,
                        });
                    },
            unsetColumns:
                () =>
                    ({ commands }) => {
                        return commands.lift(this.name);
                    },
        };
    },
});

// Individual column — child of ColumnBlock
export interface ColumnOptions {
    HTMLAttributes: Record<string, unknown>;
}

export const Column = Node.create<ColumnOptions>({
    name: 'column',
    group: '',
    content: 'block+',
    defining: true,
    isolating: true,

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="column"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-type': 'column',
                class: 'column',
            }),
            0,
        ];
    },
});

export default ColumnBlock;
