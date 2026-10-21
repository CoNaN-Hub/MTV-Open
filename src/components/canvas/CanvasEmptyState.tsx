/**
 * CanvasEmptyState 画布空状态 — 无节点时的引导
 *
 * 版式**逐字对齐 TapNow 官方空态**（CDP 运行时实测 + 官方 HTML dump）：
 *   外层容器  641×83 · `w-full h-full flex flex-col gap-3 items-center justify-center` → gap 12 · 居中
 *   第一行    293×33 · `flex items-center gap-2` → gap 8
 *     「双击」chip  81×33 · bg rgb(43,43,43) · radius 12 · 1px rgba(255,255,255,.1)
 *                   · pad **6px 12px** · gap 8 · 14px · rgb(245,245,245)
 *     说明文案      18px · rgb(122,122,122)  「画布自由生成,或查看模板」
 *   第二行    641×37 · `flex items-center gap-2` → gap 8
 *     5 个 chip：文字生视频 / 图片换背景 / 首帧生成视频 / 音频生视频 / 模板
 *     chip 规格：h **37** · bg **rgb(15,15,15)** · radius 12 · 1px rgba(255,255,255,.1)
 *                · pad **8px 16px** · **gap 8** · **font-size 16px** · rgb(122,122,122)
 *     图标：tabler video / (自家 20×20) / tabler sparkles / tabler music / tabler template
 *
 * ⚠️ 第二行官方是**模板入口**，MTV 暂无对应功能 —— 按用户指示「没有的先放着，功能未知，
 *    后期再改」：**只照抄外观，不接任何逻辑**（点击不做任何事）。
 */
import { memo } from 'react';
import { Icon } from '@iconify/react';
import { useT } from '../../i18n';
import { OfficialIcon } from '../sidebar/OfficialIcon';

/** 官方第二行的 5 个条目 —— **尺寸照官方实测**（统一视窗 2174×1263 下量的）：
      文字生视频 127×37 · 图片换背景 127×37 · 首帧生成视频 141×37 ·
      音频生视频 127×37 · 模板 85×37
    图标实测：前四个 **20**（渲染 20×24，因为 tabler 图标固有比例是 20:24）· 模板 **16** ✓
    ⚠️ 我上一版把前三个写成 24 ✗ → 每个 chip 宽了 18~20px ✗ 用户反馈"大小间距都不对" ✓ */
const EMPTY_STATE_TEMPLATES: Array<{ label: string; icon: string; size: number }> = [
  { label: '文字生视频', icon: 'tabler:video', size: 20 },
  // 「图片换背景」用官方原文件（用户提供，20-viewBox，fill=currentColor）
  { label: '图片换背景', icon: 'official:image-change-bg', size: 20 },
  { label: '首帧生成视频', icon: 'tabler:sparkles', size: 20 },
  { label: '音频生视频', icon: 'tabler:music', size: 20 },
  { label: '模板', icon: 'tabler:template', size: 16 },
];

function CanvasEmptyState() {
  const t = useT();

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        {/* 第一行：键位 chip + 说明 —— 官方 chip：81×33 · bg rgb(43,43,43) · r12
            · 1px rgba(255,255,255,.1) · pad 6px 12px · gap 8 · 14px rgb(245,245,245)，内容「图标 + 双击」 */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center gap-2 rounded-[12px] border border-[rgba(255,255,255,0.1)] bg-[#2B2B2B] px-3 py-[6px] text-sm text-[#F5F5F5]"
            /* 官方空白态第一行胶囊带这个 testid ✓ 1:1 补上 */
            data-testid="canvas-placeholder-instruction-badge"
          >
            {/* 官方原文件：20-viewBox，含一个 #1FA2DC 蓝色元素 */}
            <OfficialIcon name="canvas-doubleclick" size={20} />
            {t('双击')}
          </div>
          <p className="text-lg text-[#7A7A7A]">{t('画布自由生成,或查看模板')}</p>
        </div>

        {/* 第二行：官方 5 个模板入口 chip —— 只照抄外观，**暂不接逻辑**（用户："先放着"） */}
        <div className="pointer-events-auto flex items-center gap-2">
          {EMPTY_STATE_TEMPLATES.map(({ label, icon, size }) => (
            <button
              key={label}
              type="button"
              onClick={(event) => event.preventDefault()}
              /* ⚠️ 文字是 **14px（text-sm）** 不是 16px ✗：
                   官方实测「文字生视频」文字宽 **70px** = **5 字 × 14px** ✓
                   MTV 原来写 16px → 80px → 每个 chip 宽 14px ✗（用户反馈"大小间距都不对"）
                   注意：早前量到 chip 容器是 16px 是**容器的**值，里面文字是 text-sm=14px ✓ */
              /* gap-1 = **4px** —— 官方实测：图标右 803 → 文字左 807 = 4px ✓
                 （chip **之间** 才是 8px ✓，那是外层容器的 gap-2 ✓） */
              className="flex h-[37px] items-center gap-1 rounded-[12px] border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F] px-4 py-2 text-sm leading-none text-[#7A7A7A] transition-colors hover:border-[rgba(255,255,255,0.2)] hover:text-[#F5F5F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.2)]"
            >
              {icon.startsWith('official:')
                ? <OfficialIcon name={icon.slice('official:'.length)} size={size} />
                : <Icon icon={icon} width={size} height={size} aria-hidden="true" />}
              {t(label)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(CanvasEmptyState);
