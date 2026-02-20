import { Node, mergeAttributes, InputRule } from '@tiptap/core';

/**
 * Obsidian-style callout types with their icons and default colors.
 * Usage in markdown: > [!note] or > [!warning] Title
 */
export const CALLOUT_TYPES: Record<string, { icon: string; color: string; label: string }> = {
    note: { icon: '✏️', color: '#448aff', label: 'Note' },
    abstract: { icon: '📋', color: '#00b0ff', label: 'Abstract' },
    summary: { icon: '📋', color: '#00b0ff', label: 'Summary' },
    info: { icon: 'ℹ️', color: '#00b8d4', label: 'Info' },
    todo: { icon: '☑️', color: '#00b8d4', label: 'Todo' },
    tip: { icon: '🔥', color: '#00bfa5', label: 'Tip' },
    hint: { icon: '🔥', color: '#00bfa5', label: 'Hint' },
    important: { icon: '🔥', color: '#00bfa5', label: 'Important' },
    success: { icon: '✅', color: '#00c853', label: 'Success' },
    check: { icon: '✅', color: '#00c853', label: 'Check' },
    done: { icon: '✅', color: '#00c853', label: 'Done' },
    question: { icon: '❓', color: '#64dd17', label: 'Question' },
    help: { icon: '❓', color: '#64dd17', label: 'Help' },
    faq: { icon: '❓', color: '#64dd17', label: 'FAQ' },
    warning: { icon: '⚠️', color: '#ff9100', label: 'Warning' },
    caution: { icon: '⚠️', color: '#ff9100', label: 'Caution' },
    attention: { icon: '⚠️', color: '#ff9100', label: 'Attention' },
    failure: { icon: '❌', color: '#ff5252', label: 'Failure' },
    fail: { icon: '❌', color: '#ff5252', label: 'Fail' },
    missing: { icon: '❌', color: '#ff5252', label: 'Missing' },
    danger: { icon: '⚡', color: '#ff1744', label: 'Danger' },
    error: { icon: '⚡', color: '#ff1744', label: 'Error' },
    bug: { icon: '🐛', color: '#ff1744', label: 'Bug' },
    example: { icon: '📝', color: '#7c4dff', label: 'Example' },
    quote: { icon: '💬', color: '#9e9e9e', label: 'Quote' },
    cite: { icon: '💬', color: '#9e9e9e', label: 'Cite' },
};

export interface ObsidianCalloutOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        callout: {
            setCallout: (attrs?: { type?: string; title?: string; folded?: boolean }) => ReturnType;
            toggleCallout: (attrs?: { type?: string; title?: string }) => ReturnType;
            unsetCallout: () => ReturnType;
        };
    }
}

const ObsidianCallout = Node.create<ObsidianCalloutOptions>({
    name: 'callout',
    group: 'block',
    content: 'block+',
    defining: true,

    addOptions() {
        return { HTMLAttributes: {} };
    },

    addAttributes() {
        return {
            type: {
                default: 'note',
                parseHTML: (el) => el.getAttribute('data-callout-type') || 'note',
                renderHTML: (attrs) => ({ 'data-callout-type': attrs.type }),
            },
            title: {
                default: '',
                parseHTML: (el) => el.getAttribute('data-callout-title') || '',
                renderHTML: (attrs) => ({ 'data-callout-title': attrs.title }),
            },
            folded: {
                default: false,
                parseHTML: (el) => el.getAttribute('data-callout-folded') === 'true',
                renderHTML: (attrs) => ({ 'data-callout-folded': String(attrs.folded) }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="callout"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        const calloutType = (HTMLAttributes['data-callout-type'] as string) || 'note';
        const calloutInfo = CALLOUT_TYPES[calloutType] || CALLOUT_TYPES['note'];
        const title = (HTMLAttributes['data-callout-title'] as string) || calloutInfo.label;

        return [
            'div',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-type': 'callout',
                class: `callout callout-${calloutType}`,
                style: `--callout-color: ${calloutInfo.color}`,
            }),
            [
                'div',
                { class: 'callout-title', contenteditable: 'false' },
                [
                    'span',
                    { class: 'callout-icon' },
                    calloutInfo.icon,
                ],
                [
                    'span',
                    { class: 'callout-title-text' },
                    title,
                ],
            ],
            ['div', { class: 'callout-content' }, 0],
        ];
    },

    addCommands() {
        return {
            setCallout:
                (attrs) =>
                    ({ commands }) =>
                        commands.wrapIn(this.name, attrs),
            toggleCallout:
                (attrs) =>
                    ({ commands }) =>
                        commands.toggleWrap(this.name, attrs),
            unsetCallout:
                () =>
                    ({ commands }) =>
                        commands.lift(this.name),
        };
    },

    addInputRules() {
        // Match > [!type] at the start of a line
        return Object.keys(CALLOUT_TYPES).map(
            (type) =>
                new InputRule({
                    find: new RegExp(`^>\\s*\\[!${type}\\]\\s$`, 'i'),
                    handler: ({ range, chain }) => {
                        chain()
                            .deleteRange(range)
                            .setCallout({ type, title: CALLOUT_TYPES[type].label })
                            .run();
                    },
                })
        );
    },
});

export default ObsidianCallout;
