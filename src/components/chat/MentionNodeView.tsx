/**
 * 官方 `UR` —— 提及节点视图（live `vendor-pkg-canvas-ChpWx5JY.js` @158840）**逐字移植（基础分支）**。
 *
 * 官方结构（见 `live-ProseMirror-提及输入内核.md` §5.1）：
 * ```js
 * UR = ({ node, deleteNode }) => {
 *   const { nodeId, label, mentionType, isQuotedText, isLibraryPath, isLibraryFolder, isSkill,
 *           isBrainstorm, isPlugin, pluginName, xyNode, thumb, previewSrc, textContent, placeholderType } = Uve(node);
 *   const title = (isPlugin && pluginName) ? (label || pluginDisplayName(pluginName)) : label;
 *   const goNode = () => { xyNode && fitView({ nodes: [{ id: nodeId }], ...Dve }); };
 *   const base = <NodeViewWrapper as="span" className={zve} data-mention-type={mentionType}>
 *     <ls label={label} thumb={thumb} onClick={isQuotedText || isLibraryPath ? undefined : goNode}
 *         showDelete onDelete={deleteNode} placeholderType={placeholderType}
 *         leadingIcon={isLibraryFolder ? <IconFolder size={14} className="text-white/60"/> : undefined}
 *         title={isLibraryPath ? (textContent || label) : undefined}/>
 *   </NodeViewWrapper>;
 *   if (isLibraryFolder) return base;
 *   if (isSkill)      return <NodeViewWrapper as="span" className={gk} data-mention-type={mentionType} style={xk}>
 *                       <ls mentionType="skill" skillName={nodeId} label={label} bg="transparent"
 *                           className="cursor-default p-0 hover:brightness-100 hover:shadow-none"
 *                           labelClassName="font-medium leading-none text-text-text-primary"
 *                           buttonClassName="cursor-default text-text-text-primary"/></NodeViewWrapper>;
 *   if (isBrainstorm) return …同上（mentionType="brainstorm"、leadingIcon = brainstorm 图标）…;
 *   if (isPlugin && pluginName) return …plugin 分支（iconUrl）…;
 *   return base;
 * };
 * ```
 * 逐字 class 常量（canvas @152690 / @152725）：
 * `zve = "inline-flex align-middle my-1"` · `gk = "inline-flex align-middle"` ·
 * `xk = { display:"inline-flex", verticalAlign:"middle", whiteSpace:"nowrap", width:"auto" }`
 *
 * ⚠️ 官方 `ls`（提及 chip）的完整实现本轮未移植 ⇒ 这里渲染一个**等价 chip**：
 * 根 `span.mention.mention-node`（`Xq` 的 36 条类串就是按这个类名写的），
 * 内含 `label`，并提供 `showDelete` 的删除钮。`Uve(node)` 的 attr 归一与 `Wq`（插件图标）暂缺，
 * 因此 plugin 分支的 `iconUrl` 未接。
 */
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';

/** 官方 `zve`。 */
const ZVE = 'inline-flex align-middle my-1';
/** 官方 `gk`。 */
const GK = 'inline-flex align-middle';
/** 官方 `xk`。 */
const XK = { display: 'inline-flex', verticalAlign: 'middle', whiteSpace: 'nowrap', width: 'auto' } as const;
/** 官方 `ls` 在 skill / brainstorm / plugin 分支上的 className。 */
const CHIP_PASSIVE_CLASS = 'cursor-default p-0 hover:brightness-100 hover:shadow-none';

export default function MentionNodeView({ node, deleteNode }: ReactNodeViewProps) {
  const attrs = node.attrs as Record<string, unknown>;
  const label = (attrs.label ?? attrs.id ?? '') as string;
  const mentionType = (attrs.type ?? 'node') as string;
  const isSkill = mentionType === 'skill';
  const isBrainstorm = mentionType === 'brainstorm';
  const isPlugin = mentionType === 'plugin';

  if (isSkill || isBrainstorm || isPlugin) {
    return (
      <NodeViewWrapper as="span" className={GK} data-mention-type={mentionType} style={XK}>
        <span
          className={`mention mention-node group ${CHIP_PASSIVE_CLASS}`}
          data-mention-type={mentionType}
          contentEditable={false}
          title={label}
        >
          {label}
        </span>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="span" className={ZVE} data-mention-type={mentionType}>
      <span className="mention mention-node group" data-mention-type={mentionType} contentEditable={false}>
        {label}
        <button
          type="button"
          aria-label="remove mention"
          tabIndex={-1}
          onMouseDown={(event) => { event.preventDefault(); deleteNode(); }}
          className="ml-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        >
          ×
        </button>
      </span>
    </NodeViewWrapper>
  );
}
