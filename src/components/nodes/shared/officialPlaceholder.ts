/**
 * OfficialPlaceholder —— 官方 placeholder 扩展**逐字移植**
 *
 * 出处：官方 EXE `use-waveform-data-DMduQqB-.js` @364958（`g1 = Extension.create({name:"placeholder", …})`）：
 * ```js
 * const g1 = Extension.create({
 *   name: 'placeholder',
 *   addOptions(){ return { emptyEditorClass:'is-editor-empty', emptyNodeClass:'is-empty',
 *                          placeholder:'Write something …', showOnlyWhenEditable:!0,
 *                          showOnlyCurrent:!0, includeChildren:!1 } },
 *   addProseMirrorPlugins(){ return [ new Plugin({ key:new PluginKey('placeholder'), props:{ decorations:({doc,selection})=>{
 *     const editable = this.editor.isEditable || !this.options.showOnlyWhenEditable;
 *     const { anchor } = selection; const decos = [];
 *     if(!editable) return null;
 *     const isEmpty = this.editor.isEmpty;
 *     doc.descendants((node,pos)=>{
 *       const hasAnchor = anchor >= pos && anchor <= pos + node.nodeSize;
 *       const isEmptyBlock = !node.isLeaf && isNodeEmpty(node);
 *       if((hasAnchor || !this.options.showOnlyCurrent) && isEmptyBlock){
 *         const classes=[this.options.emptyNodeClass]; if(isEmpty) classes.push(this.options.emptyEditorClass);
 *         decos.push(Decoration.node(pos, pos+node.nodeSize, { class: classes.join(' '),
 *           'data-placeholder': typeof this.options.placeholder==='function'
 *             ? this.options.placeholder({editor:this.editor,node,pos,hasAnchor}) : this.options.placeholder }));
 *       }
 *       return this.options.includeChildren;   // ★ 命中后**不再下钻**子节点
 *     });
 *     return DecorationSet.create(doc, decos);
 *   }}})] }
 * })
 * ```
 *
 * ⚠️ 为什么不能直接用 `@tiptap/extension-placeholder`（v3.31.3，MTV 原本用的那个）：
 *    它走的是 `showOnlyCurrent && !includeChildren` 的"快捷路径"（`buildPlaceholderDecorations`）——
 *    `resolved.node(1)` 取**顶层块**，并且**要求 `node.type.isTextblock`**：
 *    ```js
 *    const node = resolved.depth > 0 ? resolved.node(1) : resolved.nodeAfter;
 *    if (node && node.type.isTextblock && isNodeEmpty(node)) { …装饰… }
 *    ```
 *    ⇒ 空的 `<ul>/<ol>` **不是 textblock** ⇒ 一个装饰都不加 ⇒ **空列表里占位符整段消失** ✗
 *    （官方实测 9444：空文档点「无序列表」后 `<ul class="tight is-empty is-editor-empty" data-placeholder="开启你的创作...">`
 *      —— 占位符**移到列表节点上继续显示**；MTV 改前是 `<ul class="tight" data-tight="true">`，占位符没了。）
 *    ⇒ 只能按官方那套 `doc.descendants + !isLeaf + isNodeEmpty + 不下钻` 自己实现，才能在外层空块（列表）上落装饰。
 *
 * 另：官方 text 编辑器只覆写了 `emptyEditorClass`（同文件 @598800：`g1.configure({placeholder:()=>…, emptyEditorClass:'is-editor-empty'})`）
 *      ⇒ `emptyNodeClass` 保持默认 `'is-empty'`，与实测 DOM（`class="is-empty is-editor-empty"`）一致 ✓
 */
import { Extension, isNodeEmpty, type Editor } from '@tiptap/core';
/* ★ 注意：`@tiptap/core` 导出的 `Node` 是**扩展类**（`Node.create()` 那个），
   不是 ProseMirror 文档节点；placeholder 回调收到的是后者 ⇒ 必须从 `@tiptap/pm/model` 取。 */
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface OfficialPlaceholderOptions {
  /** 编辑器整体为空时追加的类（官方默认 `'is-editor-empty'`） */
  emptyEditorClass: string;
  /** 空块自身带的类（官方默认 `'is-empty'`） */
  emptyNodeClass: string;
  /** 占位文案：字符串或按节点算（官方支持函数形态） */
  placeholder: string | ((props: { editor: Editor; node: ProseMirrorNode; pos: number; hasAnchor: boolean }) => string);
  showOnlyWhenEditable: boolean;
  showOnlyCurrent: boolean;
  /** ★ 官方为 `false`：命中第一个空块后**不再下钻** ⇒ 装饰落在外层块（列表）上 */
  includeChildren: boolean;
}

export const OfficialPlaceholder = Extension.create<OfficialPlaceholderOptions>({
  name: 'placeholder',

  addOptions() {
    return {
      emptyEditorClass: 'is-editor-empty',
      emptyNodeClass: 'is-empty',
      placeholder: 'Write something …',
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
      includeChildren: false,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('placeholder'),
        props: {
          decorations: ({ doc, selection }) => {
            const editable = this.editor.isEditable || !this.options.showOnlyWhenEditable;
            if (!editable) return null;
            const { anchor } = selection;
            const decorations: Decoration[] = [];
            const isEmptyDoc = this.editor.isEmpty;

            doc.descendants((node, pos) => {
              const hasAnchor = anchor >= pos && anchor <= pos + node.nodeSize;
              /* 官方的"空块"判定：非叶子节点 + 内容为空（列表节点因此也会被判定为空） */
              const isEmptyBlock = !node.isLeaf && isNodeEmpty(node);
              if ((hasAnchor || !this.options.showOnlyCurrent) && isEmptyBlock) {
                const classes = [this.options.emptyNodeClass];
                if (isEmptyDoc) classes.push(this.options.emptyEditorClass);
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: classes.join(' '),
                    'data-placeholder': typeof this.options.placeholder === 'function'
                      ? this.options.placeholder({ editor: this.editor, node, pos, hasAnchor })
                      : this.options.placeholder,
                  }),
                );
              }
              return this.options.includeChildren;
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

export default OfficialPlaceholder;
