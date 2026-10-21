/**
 * 官方 `VP`(`textLengthLimit`) + `_p` + `DP` + `W4` —— 提及输入的字数限制扩展（逐字移植）。
 * live `vendor-packages-jvPqKqU8.js`：`W4` @497966 · `_p` @497994 · `DP` @498092 · `VP` @498153。
 *
 * ```js
 * W4 = "textLengthLimitBypass";
 * _p = doc => getTextBetween(doc, {from:0, to:doc.content.size},
 *                            {textSerializers: getTextSerializersFromSchema(doc.type.schema)}).length;
 * DP = (oldDoc, newDoc, limit) => { const s = _p(oldDoc), r = _p(newDoc); return r <= limit ? true : r <= s; };
 * VP = limit => Extension.create({ name:"textLengthLimit", addProseMirrorPlugins(){ return [ new Plugin({
 *   filterTransaction: (tr, state) => tr.getMeta(W4) === true || !tr.docChanged ? true : DP(state.doc, tr.doc, limit),
 * }) ] } });
 * ```
 * 单独成文件以满足 `react-refresh/only-export-components`。
 */
import { Extension, getTextBetween, getTextSerializersFromSchema } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/** 官方 `W4`：长度限制的 bypass meta key。 */
export const TEXT_LENGTH_LIMIT_BYPASS = 'textLengthLimitBypass';

/** 官方 `_p(doc)`：文档「可序列化文本」长度（mention 按自身 `renderText` 序列化）。 */
export function countDocText(doc: ProseMirrorNode): number {
  return getTextBetween(
    doc,
    { from: 0, to: doc.content.size },
    { textSerializers: getTextSerializersFromSchema(doc.type.schema) },
  ).length;
}

/** 官方 `DP(oldDoc, newDoc, limit)`：不超限就放行；超限时只有**没变长**才放行。 */
export function isTextLengthChangeAllowed(oldDoc: ProseMirrorNode, newDoc: ProseMirrorNode, limit: number): boolean {
  const previous = countDocText(oldDoc);
  const next = countDocText(newDoc);
  return next <= limit ? true : next <= previous;
}

/** 官方 `VP`：`textLengthLimit` 扩展。 */
export function createTextLengthLimitExtension(limit: number) {
  return Extension.create({
    name: 'textLengthLimit',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          filterTransaction: (transaction, state) => (
            transaction.getMeta(TEXT_LENGTH_LIMIT_BYPASS) === true || !transaction.docChanged
              ? true
              : isTextLengthChangeAllowed(state.doc, transaction.doc, limit)
          ),
        }),
      ];
    },
  });
}
