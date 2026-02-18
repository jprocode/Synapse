import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface BlockHandleOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        blockHandle: {
            duplicateBlock: () => ReturnType;
            deleteBlock: () => ReturnType;
            moveBlockUp: () => ReturnType;
            moveBlockDown: () => ReturnType;
        };
    }
}

const blockHandlePluginKey = new PluginKey('blockHandle');

const BlockHandle = Extension.create<BlockHandleOptions>({
    name: 'blockHandle',

    addOptions() {
        return { HTMLAttributes: {} };
    },

    addCommands() {
        return {
            duplicateBlock:
                () =>
                    ({ state, dispatch }) => {
                        const { selection, doc } = state;
                        const { $from } = selection;

                        // Find the top-level block this cursor is in
                        let blockPos = $from.before(1);
                        const blockNode = doc.nodeAt(blockPos);
                        if (!blockNode) return false;

                        if (dispatch) {
                            const endOfBlock = blockPos + blockNode.nodeSize;
                            const copy = blockNode.copy(blockNode.content);
                            const tr = state.tr.insert(endOfBlock, copy);
                            dispatch(tr);
                        }
                        return true;
                    },

            deleteBlock:
                () =>
                    ({ state, dispatch }) => {
                        const { selection, doc } = state;
                        const { $from } = selection;

                        let blockPos = $from.before(1);
                        const blockNode = doc.nodeAt(blockPos);
                        if (!blockNode) return false;

                        if (dispatch) {
                            const endOfBlock = blockPos + blockNode.nodeSize;
                            const tr = state.tr.delete(blockPos, endOfBlock);
                            dispatch(tr);
                        }
                        return true;
                    },

            moveBlockUp:
                () =>
                    ({ state, dispatch }) => {
                        const { selection, doc } = state;
                        const { $from } = selection;

                        let blockPos = $from.before(1);
                        const blockNode = doc.nodeAt(blockPos);
                        if (!blockNode || blockPos === 0) return false;

                        const $pos = doc.resolve(blockPos);
                        if ($pos.index(0) === 0) return false;

                        if (dispatch) {
                            const prevBlockPos = $pos.before(1);
                            const prevResolve = doc.resolve(blockPos - 1);
                            const prevStart = prevResolve.before(1);

                            const tr = state.tr;
                            const endOfBlock = blockPos + blockNode.nodeSize;
                            const slice = tr.doc.slice(blockPos, endOfBlock);
                            tr.delete(blockPos, endOfBlock);
                            tr.insert(prevStart, slice.content);
                            dispatch(tr);
                        }
                        return true;
                    },

            moveBlockDown:
                () =>
                    ({ state, dispatch }) => {
                        const { selection, doc } = state;
                        const { $from } = selection;

                        let blockPos = $from.before(1);
                        const blockNode = doc.nodeAt(blockPos);
                        if (!blockNode) return false;

                        const endOfBlock = blockPos + blockNode.nodeSize;
                        if (endOfBlock >= doc.content.size) return false;

                        if (dispatch) {
                            const nextNode = doc.nodeAt(endOfBlock);
                            if (!nextNode) return false;

                            const tr = state.tr;
                            const nextEnd = endOfBlock + nextNode.nodeSize;
                            const nextSlice = tr.doc.slice(endOfBlock, nextEnd);
                            tr.delete(endOfBlock, nextEnd);
                            tr.insert(blockPos, nextSlice.content);
                            dispatch(tr);
                        }
                        return true;
                    },
        };
    },

    addKeyboardShortcuts() {
        return {
            'Mod-d': () => this.editor.commands.duplicateBlock(),
            'Mod-Backspace': () => this.editor.commands.deleteBlock(),
            'Alt-ArrowUp': () => this.editor.commands.moveBlockUp(),
            'Alt-ArrowDown': () => this.editor.commands.moveBlockDown(),
            'Escape': ({ editor }) => {
                // Exit block editing, select the block
                const { state } = editor;
                const { $from } = state.selection;
                const blockPos = $from.before(1);
                const blockNode = state.doc.nodeAt(blockPos);
                if (blockNode) {
                    editor.commands.setNodeSelection(blockPos);
                    return true;
                }
                return false;
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: blockHandlePluginKey,
                props: {
                    decorations: (state) => {
                        const decorations: Decoration[] = [];
                        const { doc, selection } = state;
                        const { $from } = selection;

                        doc.forEach((node, pos) => {
                            if (node.isBlock && node.isTextblock) {
                                const isActive = pos <= $from.pos && $from.pos <= pos + node.nodeSize;
                                decorations.push(
                                    Decoration.widget(pos, () => {
                                        const handle = document.createElement('div');
                                        handle.className = `block-handle ${isActive ? 'active' : ''}`;
                                        handle.contentEditable = 'false';
                                        handle.innerHTML = '⠿';
                                        handle.draggable = true;
                                        handle.title = 'Drag to move, click for options';
                                        return handle;
                                    }, { side: -1, key: `handle-${pos}` })
                                );
                            }
                        });

                        return DecorationSet.create(doc, decorations);
                    },
                },
            }),
        ];
    },
});

export default BlockHandle;
