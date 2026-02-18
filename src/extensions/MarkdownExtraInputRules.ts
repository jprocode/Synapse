import { Extension } from '@tiptap/core';
import { InputRule } from '@tiptap/core';

// Input rules for ==highlight==, ^^superscript^^, ,,subscript,,
const MarkdownExtraInputRules = Extension.create({
    name: 'markdownExtraInputRules',

    addInputRules() {
        return [
            // ==text== → highlight
            new InputRule({
                find: /==([^=]+)==$/,
                handler: ({ state, range, match }) => {
                    const { tr } = state;
                    const text = match[1];
                    const start = range.from;
                    const end = range.to;

                    if (state.schema.marks.highlight) {
                        tr.replaceWith(
                            start,
                            end,
                            state.schema.text(text, [
                                state.schema.marks.highlight.create(),
                            ])
                        );
                    }
                },
            }),

            // ^^text^^ → superscript
            new InputRule({
                find: /\^\^([^^]+)\^\^$/,
                handler: ({ state, range, match }) => {
                    const { tr } = state;
                    const text = match[1];
                    const start = range.from;
                    const end = range.to;

                    if (state.schema.marks.superscript) {
                        tr.replaceWith(
                            start,
                            end,
                            state.schema.text(text, [
                                state.schema.marks.superscript.create(),
                            ])
                        );
                    }
                },
            }),

            // ,,text,, → subscript
            new InputRule({
                find: /,,([^,]+),,$/,
                handler: ({ state, range, match }) => {
                    const { tr } = state;
                    const text = match[1];
                    const start = range.from;
                    const end = range.to;

                    if (state.schema.marks.subscript) {
                        tr.replaceWith(
                            start,
                            end,
                            state.schema.text(text, [
                                state.schema.marks.subscript.create(),
                            ])
                        );
                    }
                },
            }),
        ];
    },
});

export default MarkdownExtraInputRules;
