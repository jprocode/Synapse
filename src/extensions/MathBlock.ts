import { Node, mergeAttributes } from '@tiptap/core';
import { InputRule } from '@tiptap/core';
import katex from 'katex';

export interface MathBlockOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        mathBlock: {
            setMathBlock: (attrs?: { content?: string }) => ReturnType;
        };
    }
}

const MathBlock = Node.create<MathBlockOptions>({
    name: 'mathBlock',
    group: 'block',
    atom: true,
    draggable: true,

    addOptions() {
        return { HTMLAttributes: {} };
    },

    addAttributes() {
        return {
            content: {
                default: '',
                parseHTML: (el) => el.getAttribute('data-content') || '',
                renderHTML: (attrs) => ({ 'data-content': attrs.content }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="math-block"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        const latex = HTMLAttributes['data-content'] || '';
        let rendered = '';
        try {
            rendered = katex.renderToString(latex, { displayMode: true, throwOnError: false });
        } catch {
            rendered = `<span class="math-error">${latex}</span>`;
        }

        return [
            'div',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-type': 'math-block',
                class: 'math-block',
                contenteditable: 'false',
            }),
            ['div', { class: 'math-rendered', innerHTML: rendered }],
            ['div', { class: 'math-source' }, latex],
        ];
    },

    addCommands() {
        return {
            setMathBlock:
                (attrs) =>
                    ({ commands }) => {
                        return commands.insertContent({
                            type: this.name,
                            attrs: { content: attrs?.content || '' },
                        });
                    },
        };
    },

    addInputRules() {
        return [
            new InputRule({
                find: /\$\$(.+)\$\$\s$/,
                handler: ({ state, range, match }) => {
                    const content = match[1];
                    const { tr } = state;
                    tr.replaceWith(
                        range.from,
                        range.to,
                        state.schema.nodes.mathBlock.create({ content })
                    );
                },
            }),
        ];
    },
});

export default MathBlock;
