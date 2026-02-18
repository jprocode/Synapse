import { Mark, mergeAttributes } from '@tiptap/core';
import { InputRule } from '@tiptap/core';
import katex from 'katex';

export interface MathInlineOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        mathInline: {
            setMathInline: (attrs: { content: string }) => ReturnType;
        };
    }
}

const MathInline = Mark.create<MathInlineOptions>({
    name: 'mathInline',
    inclusive: false,

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
        return [{ tag: 'span[data-type="math-inline"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        const latex = HTMLAttributes['data-content'] || '';
        let rendered = '';
        try {
            rendered = katex.renderToString(latex, { displayMode: false, throwOnError: false });
        } catch {
            rendered = latex;
        }

        return [
            'span',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-type': 'math-inline',
                class: 'math-inline',
                contenteditable: 'false',
            }),
            rendered,
        ];
    },

    addCommands() {
        return {
            setMathInline:
                (attrs) =>
                    ({ commands }) => {
                        return commands.setMark(this.name, attrs);
                    },
        };
    },

    addInputRules() {
        return [
            new InputRule({
                find: /(?<!\$)\$([^$]+)\$$/,
                handler: ({ state, range, match }) => {
                    const content = match[1];
                    const { tr } = state;
                    let rendered = '';
                    try {
                        rendered = katex.renderToString(content, { displayMode: false, throwOnError: false });
                    } catch {
                        rendered = content;
                    }

                    const node = state.schema.text(rendered, [
                        state.schema.marks.mathInline.create({ content }),
                    ]);
                    tr.replaceWith(range.from, range.to, node);
                },
            }),
        ];
    },
});

export default MathInline;
