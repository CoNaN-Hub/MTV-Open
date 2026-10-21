/**
 * PileGalleryViewer —— 官方**媒体查看器浮层** `u8`（`zoom-slider-3ZcFvYQO.js` @573328）在
 * PILE 画廊里的落点（MTV **适配层**）。
 *
 * 官方调用点（`WQe` @2966137，见 `_gallery-WQe.pretty.js` 817-826）：
 * ```js
 * I && l.jsx(u8, {phase:I.phase, session:I.viewer, closeTargetAnchor:I.closeTargetAnchor,
 *                 onRequestClose:se, onOpened:be, onClosed:Ye})
 * ```
 * 官方 `u8` 的骨架（`_viewer-u8.pretty.js`）：
 *   · 根 `div[data-media-viewer]`（`fixed inset-0 z-[100] …`、`role="dialog"`、`tabIndex=-1`）+
 *     `onKeyDown:j`（Esc/↑↓）/ `onClick:V`（点空白关）/ `onPointerDown|Move|Up|Cancel:H`（吃掉传播）
 *   · 非文本分支 `p = media.type==="text" ? null : media` ⇒ 媒体列 + 底条 `Qge` + 检视层 `Abe`
 *   · 文本分支 `u = media.type==="text" ? media : null` ⇒ `sxe` 文本查看器
 *   · 顶栏 `header[data-media-viewer-dismiss-blocker].fixed.inset-x-0.top-0.z-30.h-20`
 *     （左上空返回键，`On.chrome` 的 opacity/x 入场）
 *
 * ★ MTV 侧**不重写查看器**：非文本分支直接用 `components/nodes/shared/media/MediaViewer`
 *   （图片/视频，含官方几何、动效、历史列 `Obe`、事实栏 `tbe`、提示词 `nbe`）。
 *   本文件只做「官方形参 → MTV 形参」的映射 + `u8` 自己那几条行为（Esc 守卫 / 全屏 / 相位握手）。
 *
 * ⚠️ MTV 偏离：MTV 的 `MediaViewer` API ≠ 官方 `u8` 的 session，逐项映射：
 *   · `phase`（`opening|open|closing`）→ 同名 prop；按官方 `W = f ? e==="open" : $&&!T` 折算成 `isOpen`
 *     （`$ = !f && e!=="closing"`；MTV 没有检视态 `T`，所以 `W` 等价于 `phase!=="closing"`）
 *   · `session.media.type`  → `mediaType`（官方 image/video 分支；MTV 只建这两种会话）
 *   · `session.media.src`   → `entrySrc`（入口媒体；官方 `pxe` 把它钉在历史列第 0 位）
 *   · `session.resources`   → `versions`（官方历史列 `Obe` 读 `m.resources`；≤1 条整列不渲染）
 *   · `session.activeMedia` + `m.selectResource` → 本层 `activeSrc` + `onSelectVersion`
 *     （官方把「当前展示的媒体」放在会话对象 `m` 里，MTV 放在本层 state）
 *   · `session.prompt` / `m.activeResource.model|createdAt` → `prompt` / `model` / `createdAt`
 *     （随选中版本走，与 `ImageNode`/`VideoNode` 的 `versionFactsOf` 同一口径）
 *   · `closeTargetAnchor`   → **无接收方**：官方把它交给 `Abe`/`sxe` 做「反向形变回成员」，
 *     MTV 的 `MediaViewer` 没有锚点形变（入场/退场是它自己的 fade），所以只按官方形参接收。
 *   · `onRequestClose`      → `MediaViewer.onClose`（本层在回调里补官方 `j` 的 `document.fullscreenElement`
 *     守卫；官方点空白那条 `V` 本来就没有这条守卫，见 `handleCloseRequest` 的记账）
 *   · `onOpened` / `onClosed` → 官方由 `Abe`/`sxe` 的形变结束回调；MTV 的 `MediaViewer` **没有**这两个
 *     握手 ⇒ 用官方 `On.sharedMedia.durationSeconds`（.44s = 媒体帧形变时长）补一拍。
 *   · `session.actions`（底条 `Qge`）→ **未接**：MTV 需要宿主提供复制提示词 / 设为主图 / 下载三个回调，
 *     画廊没有这套宿主数据（官方 `Qge` 的 `favorite` MTV 也没有）。
 *   · 文本分支（`u` → `sxe`）→ **未接**：MTV 的对应实现是 `shared/TextFullscreenViewer`，它没有
 *     官方 `onClosed` 握手（画廊相位机会永远停在 `closing`）⇒ 画廊侧干脆不为文本成员建会话
 *     （见 `PileGallery.tsx` 的 `pileGalleryViewerSession`）。
 *     `session.media.title` 也无接收方（MTV `MediaViewer` 没有标题位）。
 *
 * ⚠️ MTV 偏离：官方 `u8` 里**没有**全屏切换（官方全屏 API 的写法出自官方视频播放器 `W1e` @1401909：
 *   `fullscreenchange` → `z(document.fullscreenElement===F.current)` @1406277、切换
 *   `F.current.requestFullscreen()` / `document.exitFullscreen()` @1406638）。本适配层把这段官方写法
 *   搬到画廊查看器上：`requestFullscreen()` 打在**查看器根**（`[data-media-viewer="media"]`，
 *   等价官方 `F.current`）。`MediaViewer` 的树是 `createPortal(..., document.body)` 且没有 ref 插槽
 *   ⇒ 根节点只能按官方标记反查（不能像官方那样用 `useRef` 持有）。
 *   全屏只包含查看器层本身 ⇒ chrome（本层的全屏按钮）不在全屏里，**退出全屏只能靠浏览器 Esc**
 *   ——正是画廊 `me` 里 `document.fullscreenElement` 守卫（@2959993）要保的那条路。
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';

import MediaViewer from './shared/media/MediaViewer';
import MediaViewerActions from './shared/media/MediaViewerActions';
import { MEDIA_VIEWER_MOTION } from './shared/media/mediaViewerMotion';
import { useFavoriteStatus } from '../../hooks/useFavoriteStatus';
import { useAppStore } from '../../store/useAppStore';
import { saveNodeOutputToFile } from '../../services/fileService';
import type { BaseNodeData } from '../../types';
import { useT } from '../../i18n';
import type {
  PileGalleryViewerAnchor,
  PileGalleryViewerPhase,
  PileGalleryViewerSession,
} from './PileGallery';
import type { MediaHistoryVersion } from '../../utils/mediaViewerHistory';

/** 官方堆叠画廊的会话是**单资源**（见 `MediaViewer` 上那段记账）⇒ 历史列永不渲染。
 *  用同一个空数组常量，避免每次渲染换引用。 */
const EMPTY_MEDIA_VERSIONS: readonly MediaHistoryVersion[] = [];

/** 官方 `u8({phase, session, closeTargetAnchor, onRequestClose, onOpened, onClosed})` @573328 的形参 */
export interface PileGalleryViewerProps {
  phase: PileGalleryViewerPhase;
  session: PileGalleryViewerSession;
  /** 官方 `closeTargetAnchor`（`se` 算的回退锚点）—— 见文件头「无接收方」记账 */
  closeTargetAnchor?: PileGalleryViewerAnchor;
  onRequestClose: () => void;
  onOpened: () => void;
  onClosed: () => void;
}


export default function PileGalleryViewer({
  phase,
  session,
  closeTargetAnchor: _closeTargetAnchor,
  onRequestClose,
  onOpened,
  onClosed,
}: PileGalleryViewerProps) {
  const t = useT();
  /** 官方 `a = Yo()`（`useReducedMotion`） */
  const reducedMotion = useReducedMotion() ?? false;

  /* ⚠️ MTV 偏离：官方 `closeTargetAnchor` 的接收方是 `Abe`/`sxe`（锚点形变）；MTV 的 `MediaViewer`
     没有锚点形变 ⇒ 这里没有消费点。形参保留 = 官方签名保留（画廊照官方算好再传）。 */
  void _closeTargetAnchor;

  /**
   * 官方 `m.activeMedia` + `m.selectResource`：会话内「当前展示的媒体」。
   * ⚠️ MTV 偏离（纯重构，渲染结果相同）：官方靠 `useEffect(..., [t.id, p?.src])` 重置会话内的选中态；
   * 这里改成**按会话 id 派生**（换会话 ⇒ 自动回落到入口媒体），省掉 effect 里的同步 setState。
   */
  const [selection, setSelection] = useState<{ sessionId: string; src: string } | null>(null);
  const entrySrc = session.media.src;
  const activeSrc = selection && selection.sessionId === session.id ? selection.src : entrySrc;

  /** 官方 `m.activeResource` 的字段口径（与 `ImageNode` 的 `versionFactsOf` 同一份数据） */
  const activeVersion = session.versions.find((version) => version.src === activeSrc);
  const prompt = activeVersion?.prompt || session.prompt;
  const model = activeVersion?.model || session.model;
  const createdAt = activeVersion?.createdAt ?? session.createdAt;

  /* ══════════════════════════════════════════════════════════════════════
     官方 `Qge` @436698 —— 查看器底部操作条（`session.actions`）
     MTV 侧这一段 = 把官方 `Qge` 形参映射到 `MediaViewerActions`：
       · `actions.copy && prompt.trim()`  → `prompt` + `onCopyPrompt`
       · `actions.setAsMain`（有 mainSrc）→ `canSetAsMain` / `isCurrentMain` / `onSetAsMain`
       · `actions.download`               → `onDownload` / `downloading`
       · `actions.favorite`               → `favorite`（`Qge` 里读 `nc` 收藏态 → `hooks/useFavoriteStatus`）
     ⚠️ MTV 偏离：官方三条动作各有自己的宿主实现
       （复制 `Vte`、设为主媒体 `setAsMain` 回调、下载 `downloadMediaFiles` of `J6()`）；
       MTV 复用图片/视频节点查看器（`ImageNode`/`VideoNode` 的 `handleViewer*`）**同一条**实现路径。
     ══════════════════════════════════════════════════════════════════════ */
  const favoriteSourceFileId = session.actions.favorite?.sourceFileId;
  const favoriteStatus = useFavoriteStatus(favoriteSourceFileId);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const [downloading, setDownloading] = useState(false);
  const mediaType = session.media.type === 'video' ? 'video' : 'image';

  /** 官方 `x`：`await Vte(s,{showSuccessToast:!1})` + `Ee.success(c("imagePreview.promptCopied")) */
  const handleCopyPrompt = useCallback(() => {
    if (!prompt.trim()) return;
    void navigator.clipboard?.writeText(prompt).then(() => {
      useAppStore.getState().showToast(t('提示词已复制'));
    }).catch(() => undefined);
  }, [prompt, t]);

  /** 官方 `S`：`await u([{src: t.src, canvasId:d, nodeId:e}])`（`downloadMediaFiles`） */
  const handleDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const node = useAppStore.getState().nodes.find((item) => item.id === session.id);
      const data = (node?.data ?? {}) as Partial<BaseNodeData>;
      await saveNodeOutputToFile({
        filePath: activeVersion?.filePath || data.filePath,
        mediaUrl: activeSrc,
        textOutput: undefined,
        nodeType: mediaType === 'video' ? 'ai-video' : 'ai-image',
        fileName: data.fileName || data.label,
      });
    } catch {
      useAppStore.getState().showToast(t('文件保存失败'));
    } finally {
      setDownloading(false);
    }
  }, [activeSrc, activeVersion, downloading, mediaType, session.id, t]);

  /** 官方 `_`：`await L_(g.sourceFileId, g.asset)`（MTV 的落盘 + 回滚在 store 里） */
  const handleToggleFavorite = useCallback(() => {
    const favorite = session.actions.favorite;
    if (!favorite) return;
    return toggleFavorite(favorite.sourceFileId, favorite.asset);
  }, [session.actions.favorite, toggleFavorite]);

  const handleSelectVersion = useCallback(
    (src: string) => {
      setSelection({ sessionId: session.id, src });
    },
    [session.id],
  );

  /* ══════════════════════════════════════════════════════════════════════
     全屏（官方 `W1e` @1406277 / @1406638 的写法搬到这里）
     ══════════════════════════════════════════════════════════════════════ */
  /* ⚠️ 官方媒体查看器没有「全屏切换」这件事（用户实测：官方不存在那颗放大按钮）。
     原来这里搬的是**官方视频播放器 `W1e`** 的全屏机制（`requestFullscreen` + `fullscreenchange`
     + `viewerRootElement()`），并配了一颗自造按钮 —— 已整块删除。
     官方查看器的放大走**检视态**（点图进入、`Ctrl+中键`缩放），不是 Fullscreen API。
     `document.fullscreenElement` 那几处守卫（`u8` 的 `j` / `P`）保留，因为浏览器 F11 仍可能进全屏。 */

  /* ══════════════════════════════════════════════════════════════════════
     相位握手（官方 `Abe`/`sxe` 的 `onOpened` / `onClosed`）
     ══════════════════════════════════════════════════════════════════════ */

  /** 官方 `Abe` 形变结束 → `onOpened:be`（`opening→open`）；MTV 用官方 `On.sharedMedia` 时长补一拍 */
  useEffect(() => {
    if (phase !== 'opening') return undefined;
    const timer = window.setTimeout(
      onOpened,
      reducedMotion ? 0 : MEDIA_VIEWER_MOTION.sharedMedia.durationSeconds * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [onOpened, phase, reducedMotion]);

  /** 官方 `Abe` 退场结束 → `onClosed:Ye`（`viewer=null`）；同上等 `MediaViewer` 的退场动画跑完 */
  useEffect(() => {
    if (phase !== 'closing') return undefined;
    const timer = window.setTimeout(
      onClosed,
      reducedMotion ? 0 : MEDIA_VIEWER_MOTION.sharedMedia.durationSeconds * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [onClosed, phase, reducedMotion]);

  /* ══════════════════════════════════════════════════════════════════════
     关闭入口（官方 `u8` 的 `j`（Esc）与 `V`（点空白））
     ══════════════════════════════════════════════════════════════════════ */

  /**
   * 官方 `j` 的 Esc 分支 @575435：
   * ```js
   * re.key==="Escape" && (document.fullscreenElement || (re.preventDefault(), re.stopPropagation(), P()))
   * ```
   * MTV 的 `MediaViewer` 自己吞 Esc（capture 相位 `preventDefault+stopPropagation` 后调 `onClose`），
   * 所以官方这条守卫要在**回调里**补：原生全屏中 ⇒ 不动（Esc 归浏览器退全屏，画廊/查看器都留着），
   * 第二次 Esc 才真的关查看器。
   * ⚠️ MTV 偏离：官方只在 Esc 分支（`j`）挂这条守卫，点空白的分支（`V` → `P()`）**没有**它；
   *    MTV 的 `MediaViewer` 把「Esc」与「点空白」合成同一个 `onClose` 回调 ⇒ 这里只能一起挡：
   *    全屏中点空白也不关查看器（退出原生全屏只能靠浏览器 Esc）。这是本适配层唯一的行为偏离。
   */
  const handleCloseRequest = useCallback(() => {
    if (document.fullscreenElement) return;
    onRequestClose();
  }, [onRequestClose]);

  /**
   * 官方 u8 的 `$ = !f && e!=="closing"`（文本分支）/ `W = f ? e==="open" : $&&!T`：
   * `closing` 相位整层退场 + 各 chrome `animate` 到不可见。
   */
  const open = phase !== 'closing';

  return createPortal(
    <>
      {/*
        官方 `header[data-media-viewer-dismiss-blocker].fixed.inset-x-0.top-0.z-30.h-20`
        + `Gn.div.absolute.left-5.top-5`（`On.chrome` 的 opacity/x 入场）+ `H$`(`surface="solid"`)
        里的**左上返回箭头**（`$ne` = Tabler arrow-left, 20px；`label: common.back`）——
        ★ 现在整块落在 `MediaViewer` 里（官方把顶栏放在 `u8` 根**内部**，与查看器天然同层）。
        全屏时只有查看器根进全屏 ⇒ 该顶栏不在全屏里（见文件头记账）。
      */}
      {/* ★★ 官方媒体查看器**没有全屏按钮** —— 这里原来那颗 `MediaViewerActionButton` + `fullscreen` 图标
          是 MTV 自己加的（用户实测指出「那个放大按钮官方也不存在」）。
          官方的放大/缩小走**检视态**（`T`）：点图进入、`Ctrl+滚轮`缩放，chrome 随检视态隐藏，
          **没有独立的放大按钮** ⇒ 已整块删除（含 `fullscreen` state / `toggleFullscreen` /
          `fullscreenchange` 监听 / `viewerRootElement` / `MediaViewerActionButton` 用法）。

          ★ 官方顶栏（@585428）里真正有的是**左上返回箭头**：
            <header data-media-viewer-dismiss-blocker className="fixed inset-x-0 top-0 z-30 h-20"
                    style={{pointerEvents: Y ? "auto" : "none"}}>
              <motion.div className="absolute left-5 top-5"
                initial={{opacity:0,x:-28}} animate={{opacity:Y?1:0,x:Y?0:-28}}>
                <H$ label={t("common.back")} showTooltip={false} surface="solid" onClick={P}>
                  <$ne size={20} />
                </H$></motion.div></header>
          它 + 检视态/chrome 隐藏已经**整体落在 `MediaViewer` 里**（官方把这颗箭头放在 `u8` 根内部，
          图片/视频、堆叠画廊/节点预览共用同一条路径），本适配层不再自己造第二套 chrome。 */}

      {/* 官方非文本分支本体（`MediaViewer` = 官方 `lbe` + `Obe` + `tbe` + `nbe` + `Qge` 容器） */}
      <MediaViewer
        isOpen={open}
        mediaType={mediaType}
        entrySrc={entrySrc}
        /* ★★ **堆叠全屏不传历史版本**（用户实测截图：「1 / 2 + 两张缩略图」是 MTV 自己加的）。
           官方出处 `course-api-base-url-CGXqZmAy.js`：
             · `Tet(e)` @2980112 —— 堆叠画廊建会话的地方，只传
               `iK(node, {displaySrc, mode:"view", registeredFileIds})`，**没有 `resources`**；
             · `iK` @591448 —— `resources: Fwe(g, t.resources)`；
             · `Fwe(e, t=[])` @590455 —— `t` 缺省 `[]` ⇒ `resources = [_ve(g, undefined)] = [g]`，**长度 1**；
             · 官方 `u8` 的渲染分支 —— `S && m.resources.length > 1 && l.jsx(rve, {resources, currentUrl, onSelect})`
               ⇒ **长度 1 时历史列整个不渲染**（`MediaViewerHistory` 同一条 `shouldShowMediaHistory`）。
           ⚠️ MTV 偏离（已闭合）：`Obe`/`rve` 那套历史列**不是弃用代码** —— 官方**节点**查看器
             （`nT` @592624）确实会传 `resources: r.resources`（`wve` 建的完整资源表）⇒ 那条路要用它。
             但**堆叠**这条路官方给的是单资源会话 ⇒ MTV 之前把节点那套接过来是错的。
           ★ `session.versions` 仍然保留（facts 面板的 prompt / model / createdAt 要按它取「入口媒体」那条），
             这里只把**渲染历史列**用的 `versions` 明确置空。 */
        versions={EMPTY_MEDIA_VERSIONS}
        activeSrc={activeSrc}
        prompt={prompt}
        model={model}
        width={session.width}
        height={session.height}
        createdAt={createdAt}
        durationSeconds={session.durationSeconds}
        onSelectVersion={handleSelectVersion}
        onClose={handleCloseRequest}
        /* 官方 `u8` 底条 `Qge`（`fixed bottom-7 left-1/2 z-30 -translate-x-1/2`）经由
           `MediaViewer` 的 `actions` 插槽落位（`On.actions` 入场动效在 `MediaViewer` 里） */
        actions={(
          <MediaViewerActions
            prompt={prompt}
            mediaType={mediaType}
            /* ★ 官方 `Qge` 的显示门 `y = !!(o.setAsMain && r && a)`：`MQe` 没传 `setAsMainEnabled`
               ⇒ 官方堆叠画廊**不渲染「设为主图」**。这里传 `false` 与官方一致
               （详见 `PileGallery.tsx` 的 `pileGalleryViewerSession` 里那段记账）。 */
            canSetAsMain={false}
            isCurrentMain={false}
            onCopyPrompt={session.actions.copy ? handleCopyPrompt : undefined}
            onDownload={session.actions.download ? () => { void handleDownload(); } : undefined}
            downloading={downloading}
            favorite={session.actions.favorite
              ? { sourceFileId: session.actions.favorite.sourceFileId, status: favoriteStatus, onToggle: handleToggleFavorite }
              : undefined}
          />
        )}
      />
    </>,
    document.body,
  );
}
