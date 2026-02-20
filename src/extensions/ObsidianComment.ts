import { Node, mergeAttributes, InputRule } from '@tiptap/core';

/**
 * Obsidian-style hidden comment: %%comment text%%
 * Content between %% markers is hidden in reading mode
 * and displayed with a muted style in edit mode.
 */

export interface ObsidianCommentOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        obsidianComment: {
            setObsidianComment: () => ReturnType;
            unsetObsidianComment: () => ReturnType;
        };
    }
}

const ObsidianComment = Node.create<ObsidianCommentOptions>({
    name: 'obsidianComment',
    group: 'block',
    content: 'text*',
    defining: true,
    selectable: true,

    addOptions() {
        return { HTMLAttributes: {} };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="obsidian-comment"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-type': 'obsidian-comment',
                class: 'obsidian-comment',
            }),
            ['span', { class: 'obsidian-comment-marker', contenteditable: 'false' }, '%%'],
            ['span', { class: 'obsidian-comment-text' }, 0],
            ['span', { class: 'obsidian-comment-marker', contenteditable: 'false' }, '%%'],
        ];
    },

    addCommands() {
        return {
            setObsidianComment:
                () =>
                    ({ commands }: { commands: any }) => {
                        return commands.setNode(this.name);
                    },
            unsetObsidianComment:
                () =>
                    ({ commands }: { commands: any }) => {
                        return commands.setNode('paragraph');
                    },
        };
    },

    addInputRules() {
        return [
            new InputRule({
                find: /^%%\s$/,
                handler: ({ range, chain }) => {
                    chain()
                        .deleteRange(range)
                        .setObsidianComment()
                        .run();
                },
            }),
        ];
    },
});

export default ObsidianComment;
