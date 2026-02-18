import { Node, mergeAttributes } from '@tiptap/core';

export interface CalloutOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        callout: {
            setCallout: (attrs?: { emoji?: string; color?: string }) => ReturnType;
            toggleCallout: (attrs?: { emoji?: string; color?: string }) => ReturnType;
            unsetCallout: () => ReturnType;
            updateCalloutEmoji: (emoji: string) => ReturnType;
            updateCalloutColor: (color: string) => ReturnType;
        };
    }
}

const Callout = Node.create<CalloutOptions>({
    name: 'callout',
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
            emoji: {
                default: '💡',
                parseHTML: (element) => element.getAttribute('data-emoji') || '💡',
                renderHTML: (attributes) => ({ 'data-emoji': attributes.emoji }),
            },
            color: {
                default: 'yellow',
                parseHTML: (element) => element.getAttribute('data-color') || 'yellow',
                renderHTML: (attributes) => ({ 'data-color': attributes.color }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="callout"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-type': 'callout',
                class: `callout callout-${HTMLAttributes['data-color'] || 'yellow'}`,
            }),
            [
                'span',
                { class: 'callout-emoji', contenteditable: 'false' },
                HTMLAttributes['data-emoji'] || '💡',
            ],
            ['div', { class: 'callout-content' }, 0],
        ];
    },

    addCommands() {
        return {
            setCallout:
                (attrs) =>
                    ({ commands }) => {
                        return commands.wrapIn(this.name, attrs);
                    },
            toggleCallout:
                (attrs) =>
                    ({ commands }) => {
                        return commands.toggleWrap(this.name, attrs);
                    },
            unsetCallout:
                () =>
                    ({ commands }) => {
                        return commands.lift(this.name);
                    },
            updateCalloutEmoji:
                (emoji) =>
                    ({ commands }) => {
                        return commands.updateAttributes(this.name, { emoji });
                    },
            updateCalloutColor:
                (color) =>
                    ({ commands }) => {
                        return commands.updateAttributes(this.name, { color });
                    },
        };
    },
});

export default Callout;
