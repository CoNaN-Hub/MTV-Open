/**
 * AiRoleDetailDialog —— 官方「AI角色库」卡片详情弹窗（图9）的 1:1 移植
 *
 * 官方源码：`page-DPdEgTS0.js` 里的 `Nge`（t922 抽取，见 `D:\DEEPSEEK\t922-detail-pretty.txt`）
 * 结构与度量（逐条照抄官方）：
 *  · 遮罩  `fixed inset-0 z-[210] flex items-center justify-center p-6`
 *          `background: rgba(0,0,0,0.72)` + `backdropFilter: blur(6px)`，点遮罩关闭
 *  · 面板  `relative w-full flex flex-col overflow-hidden rounded-2xl`
 *          `maxWidth: min(1080px, 92vw)` / `maxHeight: 88vh` / `background: rgba(14,14,14,0.96)`
 *          `border: 1px solid rgba(255,255,255,0.1)`
 *          `boxShadow: 0 32px 96px rgba(0,0,0,0.75), inset 0 0.5px 0 rgba(255,255,255,0.12)`
 *  · 头部  `flex items-center gap-3 px-5 py-4 border-b border-white/[0.07] shrink-0`
 *          返回(size-8 rounded-lg text-white/45) + h3(text-xl font-semibold text-white/90,
 *          max-w-[60%] truncate) + p(text-sm text-white/45, `worldview  ·  theme  ·  scene`)
 *          + 上一个/下一个(X1: size-8 rounded-lg，禁用 text-white/15) + 关闭(size-8 text-white/35)
 *  · 左列  `w-[65%] shrink-0 p-4 flex flex-col gap-4 overflow-y-auto border-r border-white/[0.06]`
 *          图 3 连 `grid grid-cols-3 gap-4`（aspect-[3/4]）+ 三视图 `aspect-[43/24] w-full`
 *  · 右列  `flex-1 flex flex-col min-w-0 px-5 py-5 overflow-y-auto gap-6`
 *          「角色属性」`dl` 两列组（`gridTemplateColumns: max-content 1fr max-content 1fr`）
 *          + 辨识特征/着装描述/视觉锚点 段落 + 底部「应用到画布」按钮
 *  · 图块  `_p`：`rounded-xl border border-white/[0.08] bg-white/[0.04] overflow-hidden relative shrink-0`
 *          底部标签 `absolute bottom-0 … px-2 py-1 text-xs text-white/55 text-right` +
 *          `linear-gradient(transparent, rgba(0,0,0,0.55))`；无图时占位 `◼` + 标签
 *  · 文案（官方中文 i18n `assets.cl.*`，t925 抽取）：角色属性/大类/文化区域/题材/时代/性别/年龄段/物种/
 *          体格/身高/肤色/发长/发色/气质/场景/辨识特征/着装描述/视觉锚点/角色立绘/肖像特写/表情九宫格/
 *          三视图/应用到画布/角色 {{id}}
 */
import { Fragment } from 'react';
import type { AiRoleCharacter } from '../../data/aiRoleCatalog';

/** 官方 `fn(url, variant)`：把上传地址换成 CDN + 变体参数（官方 tn.SMALL/MEDIUM） */
function variant(url: string, v: 'small' | 'medium' | '' = 'small'): string {
  if (!url) return '';
  return `${url}${v ? `?variant_name=${v}` : ''}`;
}

/** 官方 `_p`：带底部标签的图片块 */
function ImagePlate({ url, label, alt, aspectClass, v = 'medium', className }: {
  url: string; label: string; alt?: string; aspectClass: string; v?: 'small' | 'medium' | '';
  className?: string;
}) {
  const src = variant(url, v);
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04] ${aspectClass}${className ? ` ${className}` : ''}`}>
      {src ? (
        <>
          <img src={src} alt={alt || label} className="h-full w-full object-cover" />
          <span
            className="absolute bottom-0 left-0 right-0 select-none px-2 py-1 text-right text-xs text-white/55"
            style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.55))' }}
          >{label}</span>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/15">
          <span className="text-xl">{'◼'}</span>
          <span className="text-xs">{label}</span>
        </div>
      )}
    </div>
  );
}

/** 官方 `X1`：头部圆形导航钮 */
function NavButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`flex size-8 items-center justify-center rounded-lg transition-colors ${disabled ? 'cursor-default text-white/15' : 'text-white/50 hover:bg-white/10 hover:text-white/85'}`}
    >{children}</button>
  );
}

export interface AiRoleDetailDialogProps {
  character: AiRoleCharacter | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onAddToCanvas: (c: AiRoleCharacter) => void;
}

export default function AiRoleDetailDialog({
  character: c, onClose, onPrev, onNext, hasPrev, hasNext, onAddToCanvas,
}: AiRoleDetailDialogProps) {
  if (!c) return null;
  /* 官方属性表行序（`Nge` 里的 `d` 数组，逐行照抄；空值过滤） */
  const rows = [
    { label: '大类', value: c.era },
    { label: '文化区域', value: c.region },
    { label: '题材', value: c.genre },
    { label: '时代', value: c.timePeriod },
    { label: '性别', value: c.attrs['性别'] },
    { label: '年龄段', value: c.attrs['年龄段'] },
    { label: '物种', value: c.attrs['物种'] },
    { label: '体格', value: c.attrs['体格'] },
    { label: '身高', value: c.attrs['身高'] },
    { label: '肤色', value: c.attrs['肤色'] },
    { label: '发长', value: c.attrs['发长'] },
    { label: '发色', value: c.attrs['发色'] },
    { label: '气质', value: c.attrs['气质'] },
  ].filter((r) => r.value && r.value.trim());
  /* 官方：`scene` 单独一行且跨列 `gridColumn: '2 / -1'` */
  const sceneRow = c.scene && c.scene.trim() ? { label: '场景', value: c.scene } : null;
  /* 官方段落：辨识特征 / 着装描述 / 视觉锚点（无值不渲染） */
  const sections = [
    { title: '辨识特征', value: c.distinctive },
    { title: '着装描述', value: c.outfit },
    { title: '视觉锚点', value: '' },
  ].filter((s) => s.value && s.value.trim());

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative flex w-full flex-col overflow-hidden rounded-2xl"
        style={{
          maxWidth: 'min(1080px, 92vw)', maxHeight: '88vh', background: 'rgba(14,14,14,0.96)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 32px 96px rgba(0,0,0,0.75), inset 0 0.5px 0 rgba(255,255,255,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] px-5 py-4">
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white/85"
            onClick={onClose}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6l6 6" /></svg>
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h3 className="max-w-[60%] shrink-0 truncate text-xl font-semibold leading-tight tracking-tight text-white/90">
              {c.name || `角色 ${c.era}`}
            </h3>
            <p className="min-w-0 truncate text-sm leading-tight text-white/45">
              {[c.worldview, c.theme, c.scene].filter(Boolean).join('  ·  ')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <NavButton onClick={onPrev} disabled={!hasPrev}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6l6 6" /></svg>
            </NavButton>
            <NavButton onClick={onNext} disabled={!hasNext}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6l-6 6" /></svg>
            </NavButton>
          </div>
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/10 hover:text-white/75"
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
          </button>
        </div>

        {/* 主体：左 65% 图 / 右 属性 + 应用 */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            className="flex w-[65%] shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/[0.06] p-4"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
          >
            <div className="grid grid-cols-3 gap-4">
              <ImagePlate url={c.images.full} label="角色立绘" alt={c.name} aspectClass="aspect-[3/4]" v="small" />
              <ImagePlate url={c.images.closeup} label="肖像特写" alt={c.name} aspectClass="aspect-[3/4]" v="small" />
              <ImagePlate url={c.images.expression} label="表情九宫格" alt={c.name} aspectClass="aspect-[3/4]" v="small" />
            </div>
            <ImagePlate url={c.images.three} label="三视图" alt={c.name} aspectClass="aspect-[43/24]" v="medium" className="w-full" />
          </div>

          <div
            className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
          >
            <div>
              <p className="mb-3 text-[14px] font-medium tracking-wide text-white/50">{'角色属性'}</p>
              <dl className="grid gap-x-5 gap-y-0" style={{ gridTemplateColumns: 'max-content 1fr max-content 1fr' }}>
                {rows.map((r) => (
                  <Fragment key={r.label}>
                    <dt className="whitespace-nowrap py-[5px] text-[14px] leading-snug text-white/32">{r.label}</dt>
                    <dd className="overflow-hidden text-ellipsis whitespace-nowrap py-[5px] text-[14px] leading-snug text-white/78">{r.value}</dd>
                  </Fragment>
                ))}
                {sceneRow ? (
                  <>
                    <dt className="whitespace-nowrap py-[5px] text-[14px] leading-snug text-white/32">{sceneRow.label}</dt>
                    <dd className="py-[5px] text-[14px] leading-snug text-white/78" style={{ gridColumn: '2 / -1' }}>{sceneRow.value}</dd>
                  </>
                ) : null}
              </dl>
            </div>
            {sections.length > 0 ? (
              <div className="flex flex-col gap-5">
                {sections.map((s) => (
                  <div key={s.title}>
                    <p className="mb-2 text-[14px] font-medium tracking-wide text-white/50">{s.title}</p>
                    <p className="text-[14px] leading-[1.75] text-white/65">{s.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-auto pt-2">
              <button
                type="button"
                onClick={() => onAddToCanvas(c)}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white/90 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.18)',
                  boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.22), 0 4px 16px rgba(0,0,0,0.35)',
                }}
              >{'应用到画布'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
