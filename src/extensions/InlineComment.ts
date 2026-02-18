import { Mark, mergeAttributes, InputRule } from '@tiptap/core';

export interface InlineCommentOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        inlineComment: {
            setInlineComment: (attrs: { commentId: string; text: string }) => ReturnType;
            unsetInlineComment: () => ReturnType;
        };
    }
}

const InlineComment = Mark.create<InlineCommentOptions>({
    name: 'inlineComment',
    inclusive: false,
    excludes: '',

    addOptions() {
        return { HTMLAttributes: {} };
    },

    addAttributes() {
        return {
            commentId: {
                default: null,
                parseHTML: (el) => el.getAttribute('data-comment-id'),
                renderHTML: (attrs) => ({ 'data-comment-id': attrs.commentId }),
            },
            text: {
                default: '',
                parseHTML: (el) => el.getAttribute('data-comment-text'),
                renderHTML: (attrs) => ({ 'data-comment-text': attrs.text }),
            },
            resolved: {
                default: false,
                parseHTML: (el) => el.getAttribute('data-resolved') === 'true',
                renderHTML: (attrs) => ({ 'data-resolved': attrs.resolved ? 'true' : 'false' }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'span[data-type="inline-comment"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'span',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-type': 'inline-comment',
                class: `inline-comment ${HTMLAttributes['data-resolved'] === 'true' ? 'resolved' : ''}`,
                title: HTMLAttributes['data-comment-text'] || '',
            }),
            0,
        ];
    },

    addCommands() {
        return {
            setInlineComment:
                (attrs) =>
                    ({ commands }) => {
                        return commands.setMark(this.name, attrs);
                    },
            unsetInlineComment:
                () =>
                    ({ commands }) => {
                        return commands.unsetMark(this.name);
                    },
        };
    },
});

export default InlineComment;
