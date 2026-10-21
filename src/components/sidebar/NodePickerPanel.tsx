/**
 * NodePickerPanel — 加节点菜单的**内容组件**（条目 + 添加动作）。
 *
 * ★ 官方是**两个不同组件、两套规格**（源码：左侧竖条 + = DOCKBAR 弹层，画布双击 = 画布上的
 *   `command` 节点；组标题 class 一个是 `text-xs`、一个是 `text-sm py-1`，testid 命名空间也不同）：
 *     ① 竖条「+」（`Sidebar` → `openRailPicker()`）：240 宽 · r12 · 组标题 12px
 *     ② 画布空白双击（`useNodeCreation.onDoubleClick` → `openCanvasPickerAt(pos)`）：288 宽 · r16 · 组标题 14px
 *   两入口**状态完全独立**：各自开关、互不挪位置、互不关对方 ✓
 *   条目仍来自同一份 `nodePickerCatalog.tsx`（官方两个菜单的节点项本来同源 ✓）；
 *   本组件只负责「面板内容 + 添加节点动作」，锚点与尺寸由调用方外壳类决定。
 */
import { useAppStore, generateId, computeImageNodeDimensions } from '../../store/useAppStore';
import { Icon } from '@iconify/react';
import { useShallow } from 'zustand/react/shallow';
import type { NodeType } from '../../types';
import { NODE_TYPE_CONFIG } from '../../types';
import { uploadSourceFileToProject } from '../../services/fileService';
import { getCanvasPointerPosition } from '../../services/canvasPointerService';
import { nearestAspectRatioForImage, nodeBoxForImageSize } from '../../utils/nodeBounds';
import { classifyFile } from '../../hooks/useNodeCreation';
import {
  createPluginNode,
  getAvailablePluginNodes,
} from '../../services/plugins/pluginRuntime';
import AnimatedButton from '../shared/AnimatedButton';
import { useT } from '../../i18n';
import { addNodeFromPicker } from './nodePickerActions';
import {
  canvasToolItems,
  generationItems,
  resourceItems,
  toolItems,
  type PickerEntry,
} from './nodePickerCatalog';

/** 「+」面板与双击菜单位置不同，但内容/动作共用同一份实现 */
export interface NodePickerPanelProps {
  /** 完成一次「添加节点/上传/插件节点」后关闭菜单 */
  onClose: () => void;
  /**
   * 哪一套外壳（官方是两个不同组件 ✗ 规格不同）：
   *   · `rail`   = 左侧竖条「+」的 DOCKBAR 弹层（240 / r12 / 组标题 12px / 条目组件 `ts`）
   *   · `canvas` = 画布空白双击的 `command` 菜单（288 / r16 / 组标题 14px / 条目组件 `QT`+`qie`）
   */
  variant?: 'rail' | 'canvas';
}

export default function NodePickerPanel({ onClose, variant = 'rail' }: NodePickerPanelProps) {
  const t = useT();
  const { currentProjectId, installedPlugins } = useAppStore(
    useShallow((s) => ({
      currentProjectId: s.currentProjectId,
      installedPlugins: s.installedPlugins,
    })),
  );
  const showToast = useAppStore((s) => s.showToast);
  /* ★ 官方 command 节点（`uZe`）的**分组开关** —— 右键「添加节点 / 添加辅助工具」两条走的就是它：
       · `block`   （右键「添加节点」）：`le = !p && (T==="utility" || source!=="right_click")` = **假**
                    ⇒ **不渲染「辅助工具」组**；又 `showUploadButton:!1` ⇒ 也不渲染「添加资源(上传)」组
                    ⇒ 整个面板**只剩「添加节点」一组**（文本/图片/视频/音频/3D）
       · `utility` （右键「添加辅助工具」）：**只渲染「辅助工具」组**，且 `includeImageEditor: T==="utility"`
                    ⇒ 这一组是**含「图片编辑器」的完整三项**（`toolItems`，不是双击那版 `canvasToolItems`）
       · `full`    （MTV 竖条 / 画布双击）：保持原有完整目录（添加节点 + 辅助工具(少图片编辑器) + 插件 + 添加资源） */
  const canvasPickerMode = useAppStore((s) => s.canvasPickerMode);
  const isCanvas = variant === 'canvas';
  const showBlockGroup = !isCanvas || canvasPickerMode !== 'utility';
  const showToolsGroup = !isCanvas || canvasPickerMode !== 'block';
  const toolsItems = isCanvas && canvasPickerMode === 'utility' ? toolItems : canvasToolItems;
  const showExtras = !isCanvas || canvasPickerMode === 'full';
  const pluginNodes = getAvailablePluginNodes(installedPlugins);

  const handleUploadFile = async () => {
    onClose();
    try {
      const result = await uploadSourceFileToProject('*/*', currentProjectId);
      if (!result) return;

      const ext = result.fileName.split('.').pop()?.toLowerCase() || '';
      const category = classifyFile(ext);

      if (!category) {
        showToast(t('不支持的文件类型'), 'error');
        return;
      }

      const pos = getCanvasPointerPosition();
      const typeMap: Record<string, { type: NodeType; label?: string; field: string }> = {
        image: { type: 'ai-image', field: 'imageUrl' },
        video: { type: 'ai-video', field: 'videoUrl' },
        audio: { type: 'ai-audio', field: 'audioUrl' },
        text: { type: 'ai-text', field: 'output' },
      };
      const info = typeMap[category];

      const nodeData: Record<string, unknown> = {
        label: info.label,
        type: info.type,
        role: 'source',
        status: 'success',
        fileName: result.fileName,
        nodeWidth: info.type === 'ai-audio' ? 260 : 280,
        nodeHeight: 160,
        [info.field]: result.dataUrl,
        ...(result.filePath ? { filePath: result.filePath } : {}),
        ...(info.field === 'output' ? { prompt: '' } : {}),
      };

      if (category === 'image' && result.dataUrl) {
        try {
          const dims = await computeImageNodeDimensions(result.dataUrl);
          /* ★ 比例取**合法表里最接近的** ✓（卡片 = `pR(它)` ✓ 官方口径 ✓）；盒子数据自洽 ✓
             ⚠️ 别写原图真实比例 ✗（不在合法表 → 被比例选择器夹回 ✗ → 卡片弹回 ✗）*/
          Object.assign(
            nodeData,
            dims,
            nodeBoxForImageSize(dims.imageWidth, dims.imageHeight),
            nearestAspectRatioForImage(dims.imageWidth, dims.imageHeight),
          );
        } catch { /* ignore */ }
      }

      useAppStore.getState().addNode({
        id: `node-${generateId()}`,
        type: info.type,
        position: pos,
        data: nodeData,
      } as never);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('上传失败');
      showToast(msg, 'error');
    }
  };

  const handleAddPluginNode = (pluginNode: (typeof pluginNodes)[number]) => {
    useAppStore.getState().addNode(createPluginNode(pluginNode, getCanvasPointerPosition()));
    onClose();
  };

  const renderEntry = ({ type, label, sub, icon, badge, beta }: PickerEntry) => {
    const cfg = type ? NODE_TYPE_CONFIG[type] : undefined;
    const glyph = icon ?? (cfg ? <Icon icon={cfg.icon} width="18" height="18" /> : null);
    const onClick = () => {
      /* type 为 null = 官方有、MTV 无 → 「先放着」（点击不做任何事 ✓） */
      if (type) addNodeFromPicker(type, onClose);
    };

    /* ── 双击画布菜单：官方条目组件 `QT` + `qie` 逐字（zoom-slider @29274 起）──
       行   : group w-full h-13(52) text-base cursor-pointer rounded-xl(12) p-2 gap-2
              transition-all duration-200 flex items-center gap-2
              dark:data-[selected=true]:bg-accent/50 → hover rgba(63,63,70,.5)
       图标盒: relative h-full aspect-square(36×36) rounded-md(6) text-muted-foreground bg-accent/40
              [&_svg]:size-[18px] [&_svg]:text-popover-foreground
       文字块: flex-1 h-full flex flex-col justify-between overflow-hidden
       标题 : font-medium text-sm text-popover-foreground leading-none
              translate-y-[10px] group-hover:translate-y-0 transition-transform duration-200
       副标 : text-xs text-muted-foreground leading-none opacity-0
              group-hover:opacity-100 transition-all duration-200 truncate line-clamp-1
       （竖向间距不靠 margin：靠 `justify-between` + 行高 52 ✓）*/
    if (variant) {
      return (
        /* 官方原结构：cmdk `Item` = **div + role="option"**（不是 `<button>`：
           UA 的 `text-align:center` 会把副标居中；官方选中态也走 `data-selected`）✓ */
        <div
          key={type ?? label}
          role="option"
          onMouseEnter={(e) => {
            const root = e.currentTarget.closest('.node-picker-body');
            root?.querySelectorAll('.command-item[data-selected="true"]').forEach((el) => el.removeAttribute('data-selected'));
            e.currentTarget.setAttribute('data-selected', 'true');
          }}
          className="command-item group flex h-[52px] w-full cursor-pointer select-none items-center gap-2 rounded-2xl p-2 text-base text-left transition-all duration-200 hover:bg-[rgba(64,64,64,0.5)]"
          onClick={onClick}
        >
          <div className="relative flex aspect-square h-full shrink-0 items-center justify-center rounded-[10px] bg-[rgba(64,64,64,0.4)] text-[#7A7A7A] transition-all duration-200 [&_svg]:size-[18px] [&_svg]:text-[#CCCCCC]">
            {glyph}
          </div>
          <div className="flex h-full flex-1 flex-col justify-between overflow-hidden">
            <span className="inline-flex translate-y-[10px] items-center gap-1 text-sm font-medium leading-none text-[#CCCCCC] transition-transform duration-200 group-hover:translate-y-0">
              {t(label)}
              {beta ? <span className="menu-beta">Beta</span> : null}
              {badge ? <span className="menu-beta">{badge}</span> : null}
            </span>
            {sub ? (
              <p className="line-clamp-1 truncate text-xs leading-none text-[#7A7A7A] opacity-0 transition-all duration-200 group-hover:opacity-100">
                {t(sub)}
              </p>
            ) : null}
          </div>
        </div>
      );
    }

    /* ── 左侧竖条「+」面板：官方 DOCKBAR 那套（条目组件 `ts`，逐字 class 待补证）── */
    return (
      <AnimatedButton
        key={type ?? label}
        scale={1.02}
        className="menu-row has-desc"
        onClick={onClick}
      >
        <div className="menu-ico">{glyph}</div>
        <div className="menu-txt-wrap">
          <span className="menu-lbl">
            {t(label)}
            {/* 官方「时间轴」带 Beta 徽章：33×18 · fs10 · w500 · rgb(240,240,240) ✓ */}
            {beta ? <span className="menu-beta">Beta</span> : null}
            {badge ? <span className="menu-beta">{badge}</span> : null}
          </span>
          {/* 副标题留空则不渲染；`menu-sub` 只在 hover 行显示（sidebar.css） */}
          {sub ? <span className="menu-sub">{t(sub)}</span> : null}
        </div>
      </AnimatedButton>
    );
  };

  return (
    /* 官方 cmdk：面板打开即默认选中第一个可用项（`a.current.value || T()`，T() = 第一个非 disabled item ✓） */
    <div
      className="node-picker-body"
      ref={(el) => {
        if (!el || el.dataset.cmdkInitialized) return;
        el.dataset.cmdkInitialized = '1';
        el
          .querySelector('.command-item:not([data-disabled="true"])')
          ?.setAttribute('data-selected', 'true');
      }}
    >
      {showBlockGroup && (
        <>
          <div className="menu-section">
            {/* 官方双击菜单分区标题（实测）：「添加节点」 */}
            <span className="menu-title">{t('添加节点')}</span>
          </div>
          {generationItems.map(renderEntry)}
        </>
      )}
      {showToolsGroup && (
        <>
          {/* 「辅助工具」分组 —— 官方双击菜单有这一组，但**少「图片编辑器」**（见 canvasToolItems 注释）；
              右键「添加辅助工具」（menuMode='utility'）才是含「图片编辑器」的完整三项 ✓ */}
          <div className="menu-section">
            <span className="menu-title">{t('辅助工具')}</span>
          </div>
          {toolsItems.map(renderEntry)}
        </>
      )}
      {showExtras && pluginNodes.length > 0 && (
        <>
          <div className="menu-section">
            <span className="menu-title">{t('插件节点')}</span>
          </div>
          {pluginNodes.map((pluginNode) => (
            /* 插件行：canvas 变体也走官方条目结构（同 command-item），不再用 .menu-row 那条路 ✓ */
            <div
              key={`${pluginNode.pluginId}:${pluginNode.node.id}`}
              role="option"
              onMouseEnter={(e) => {
            const root = e.currentTarget.closest('.node-picker-body');
            root?.querySelectorAll('.command-item[data-selected="true"]').forEach((el) => el.removeAttribute('data-selected'));
            e.currentTarget.setAttribute('data-selected', 'true');
          }}
              className="command-item flex h-[52px] w-full cursor-pointer select-none items-center gap-2 rounded-2xl p-2 text-base text-left transition-all duration-200"
              onClick={() => handleAddPluginNode(pluginNode)}
            >
              <div className="relative flex aspect-square h-full shrink-0 items-center justify-center rounded-[10px] bg-[rgba(64,64,64,0.4)] text-[#7A7A7A] [&_svg]:size-[18px] [&_svg]:text-[#CCCCCC]">
                <Icon icon={pluginNode.node.icon} width="18" height="18" />
              </div>
              <div className="flex h-full flex-1 flex-col justify-between overflow-hidden">
                <span className="inline-flex translate-y-[10px] items-center gap-1 text-sm font-medium leading-none text-[#CCCCCC]">{pluginNode.node.title}</span>
                <p className="line-clamp-1 truncate text-xs leading-none text-[#7A7A7A] opacity-0">{pluginNode.pluginName}</p>
              </div>
            </div>
          ))}
        </>
      )}
      {showExtras && (
        <>
          <div className="menu-section">
            <span className="menu-title">{t('添加资源')}</span>
          </div>
          {resourceItems.map(({ key, label, sub, icon }) => (
        /* 上传行：同样换成官方条目结构（此前吃 --node-picker-hover=zinc-700 导致 hover 底色不对 ✓） */
        <div
          key={key}
          role="option"
          onMouseEnter={(e) => {
            const root = e.currentTarget.closest('.node-picker-body');
            root?.querySelectorAll('.command-item[data-selected="true"]').forEach((el) => el.removeAttribute('data-selected'));
            e.currentTarget.setAttribute('data-selected', 'true');
          }}
          className="command-item flex h-[52px] w-full cursor-pointer select-none items-center gap-2 rounded-2xl p-2 text-base text-left transition-all duration-200"
          onClick={async () => {
            if (key === 'upload') return handleUploadFile();
          }}
        >
          <div className="relative flex aspect-square h-full shrink-0 items-center justify-center rounded-[10px] bg-[rgba(64,64,64,0.4)] text-[#7A7A7A] [&_svg]:size-[18px] [&_svg]:text-[#CCCCCC]">{icon}</div>
          <div className="flex h-full flex-1 flex-col justify-between overflow-hidden">
            <span className="inline-flex translate-y-[10px] items-center gap-1 text-sm font-medium leading-none text-[#CCCCCC]">{t(label)}</span>
            {sub ? (
              <p className="line-clamp-1 truncate text-xs leading-none text-[#7A7A7A] opacity-0">{t(sub)}</p>
            ) : null}
          </div>
        </div>
          ))}
        </>
      )}
    </div>
  );
}
