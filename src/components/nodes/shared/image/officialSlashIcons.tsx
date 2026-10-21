/* ══════════════════════════════════════════════════════════════════════════
   官方 `/` 指令菜单图标组件 —— 等价复刻官方 `@tabler/icons-react` 的 `g(...)` 工厂产物
   ──────────────────────────────────────────────────────────────────────────
   官方组件渲染出来等价于：
     <svg xmlns width=24 height=24 viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth=2 strokeLinecap="round" strokeLinejoin="round"
          className="tabler-icon tabler-icon-<name> w-5 h-5">…</svg>
   （工厂默认属性 `_ui.outline`；`class` 透传 = `l.jsx(h1,{className:"w-5 h-5"})`）
   菜单项里的 `[&_svg]:size-[18px]` 再把它压到 18×18（官方同）。
   图标名与逐字 path 见 `officialSlashIconData.ts`。
   ══════════════════════════════════════════════════════════════════════════ */
import { OFFICIAL_SLASH_ICONS } from './officialSlashIconData';

export function OfficialSlashIcon({ id }: { id: string }) {
  const def = OFFICIAL_SLASH_ICONS[id];
  if (!def) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`tabler-icon tabler-icon-${def.name} w-5 h-5`}
    >
      {def.d.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
