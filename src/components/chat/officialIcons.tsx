/**
 * officialIcons —— TapNow 官方**那一套图标**的逐字复刻（不是 Lucide，是 **Tabler Icons**）。
 *
 * 官方产物里所有图标都是 Tabler 的 `createReactIcon` 产物：
 *   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
 *         strokeLinecap="round" strokeLinejoin="round">` + 一组 `path`。
 *   （唯一例外是 sidePanel 那颗 12×11 的**自绘** glyph，`fill="currentColor"`。）
 *
 * ⚠️ MTV 原来用 `@iconify/react` 的 `lucide:*` —— 名字像但**形状不一样**
 *    （chevron-down 的转角、gauge 的指针、message-square-plus 的气泡尾巴、minimize-2 的箭头朝向
 *     全都对不上），且 `@iconify/react` 默认**联网**取图标，本地画布场景下会退化成空框。
 *    这里改成内联 path，零依赖、零联网、逐字对齐官方。
 *
 * 来源（文件名 → 导出别名 → 内部符号 → 路径常量，全部在 `_dig` 里核对过）：
 *   · sidePanel  `Q$` ← `Image-with-skeleton-CKgMj1gA.js` export `k` = `f1`
 *   · chevron   `ca` ← `index-BsHyQ2qj.js` export `iC` = `B7` = tabler chevron-down
 *   · gauge     `WA` ← `index-BsHyQ2qj.js` export `mu` = `nse` = tabler gauge
 *   · history   `sz` ← `index-BsHyQ2qj.js` export `oF` = `n1e` = tabler message-square-plus
 *   · collapse  `BA` ← `index-BsHyQ2qj.js` export `os` = `v1e` = tabler minimize-2
 *   · panel收起  `tz` ← `index-BsHyQ2qj.js` export `oD` = `eWe` = tabler arrow-narrow-right
 *   · 文件类型   `lc/ZU/yS/ez/bS/Uu` = tabler file / file-text / markdown / file-type-csv /
 *                file-type-html / photo
 */
import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';
import {
  resolveSkillIcon,
  resolveSkillOverride,
  resolveSkillTableKey,
  SKILL_ICON_INSET_KEYS,
} from './skillIconMap';

type TablerIconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** 官方选中态会给图标 `fill="currentColor"`（👍/👎 激活时）。 */
  fill?: string;
};

/** 官方自绘占位 glyph 的统一签名（`({className, size=48, opacity=.2})`）。 */
type GlyphProps = {
  size?: number;
  opacity?: number;
  className?: string;
};

/** 官方 lucide 工厂 `L` 的类名拼法（`vendor-libs` @360749 逐字）：
 *  ```js
 *  const L = (t, e) => forwardRef(({className: a, ...r}, i) =>
 *    createElement(Act, { …, className: Mct(`lucide-${eMa(kze(t))}`, `lucide-${t}`, a), ...r }));
 *  // Act 内层再 className: Mct("lucide", r)
 *  // kze = PascalCase(t)；eMa = '([a-z0-9])([A-Z])' → '$1-$2' 再 toLowerCase
 *  // Mct = (...t) => t.filter((e,n,a) => !!e && e.trim() !== "" && a.indexOf(e) === n).join(" ")  ← **会去重**
 *  ```
 *  ⇒ 最终类串 = \`lucide\` + \`lucide-<kebab(Pascal(name))>\` + \`lucide-<name>\`（去重）+ 自定义类。
 *  例：\`check\` → \`lucide lucide-check\`；\`minimize-2\` → \`lucide lucide-minimize2 lucide-minimize-2\`。 */
function lucideClassTokens(name: string): string[] {
  const pascal = name.replace(/^[a-z]|[\s-_]+(\w)/g, (match, group: string | undefined) => (
    group ? group.toUpperCase() : match.toUpperCase()
  ));
  const kebab = pascal.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return ['lucide', `lucide-${kebab}`, `lucide-${name}`]
    .filter((value, index, all) => all.indexOf(value) === index);
}

function TablerSvg({
  size = 24,
  strokeWidth = 2,
  className,
  fill,
  iconName,
  lucideName,
  children,
}: TablerIconProps & { children: ReactNode; iconName?: string; lucideName?: string }) {
  /* 官方**两套**图标工厂各自的类串拼法（都由工厂自带、再与自定义 `className` 拼接）：
       · tabler（`p("outline"|"filled", name, "Pascal", node)`）：
         `['tabler-icon', 'tabler-icon-' + name, className].join(' ')`（vendor-libs @1529977 逐字）
       · lucide（`L(name, node)`）：`Mct('lucide', 'lucide-' + kebab, 'lucide-' + name, className)`（见上）
     传了名字才补这两组类；都不传时**原样**输出 `className`（既有图标的 DOM 逐字不变）。 */
  const factoryClassNames = [
    ...(iconName ? ['tabler-icon', `tabler-icon-${iconName}`] : []),
    ...(lucideName ? lucideClassTokens(lucideName) : []),
  ];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ?? 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      /* 官方工厂 `p(prefix, name, …)`（vendor-libs @1529977 逐字）把类名拼成
         `['tabler-icon', 'tabler-icon-' + name, className].join(' ')`。
         传入 `iconName` 时才补这两个类 —— 不传则输出与既有图标**逐字不变**（避免动到已有测试）。 */
      className={factoryClassNames.length
        ? [...factoryClassNames, className]
          .filter((value, index, all) => !!value && all.indexOf(value) === index)
          .join(' ')
        : className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** 官方 `Q$`（`f1`）：sidePanel 开关的自绘 glyph，12×11 视图框、`fill` 而非 `stroke`。 */
export function OfficialSidePanelIcon({ size = 18, strokeWidth, className }: TablerIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 12 11"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M2.64706 6.19355C3.71914 6.19355 4.58824 7.04084 4.58824 8.08602V8.77419C4.58824 9.81938 3.71914 10.6667 2.64706 10.6667H1.94118C0.869094 10.6667 0 9.81938 0 8.77419V8.08602C0 7.04084 0.869094 6.19355 1.94118 6.19355H2.64706ZM1.94118 7.22581C1.45387 7.22581 1.05882 7.61094 1.05882 8.08602V8.77419C1.05882 9.24928 1.45387 9.63441 1.94118 9.63441H2.64706C3.13437 9.63441 3.52941 9.24928 3.52941 8.77419V8.08602C3.52941 7.61094 3.13437 7.22581 2.64706 7.22581H1.94118ZM11.4706 8.25806C11.763 8.25806 12 8.48914 12 8.77419C12 9.05924 11.763 9.29032 11.4706 9.29032H6.52941C6.23703 9.29032 6 9.05924 6 8.77419C6 8.48914 6.23703 8.25806 6.52941 8.25806H11.4706ZM2.64706 0C3.71914 0 4.58824 0.847289 4.58824 1.89247V2.58065C4.58824 3.62583 3.71914 4.47312 2.64706 4.47312H1.94118C0.869094 4.47312 0 3.62583 0 2.58065V1.89247C0 0.847289 0.869094 0 1.94118 0H2.64706ZM1.94118 1.03226C1.45387 1.03226 1.05882 1.41739 1.05882 1.89247V2.58065C1.05882 3.05573 1.45387 3.44086 1.94118 3.44086H2.64706C3.13437 3.44086 3.52941 3.05573 3.52941 2.58065V1.89247C3.52941 1.41739 3.13437 1.03226 2.64706 1.03226H1.94118ZM11.4706 1.37634C11.763 1.37634 12 1.60742 12 1.89247C12 2.17752 11.763 2.4086 11.4706 2.4086H6.52941C6.23703 2.4086 6 2.17752 6 1.89247C6 1.60742 6.23703 1.37634 6.52941 1.37634H11.4706Z"
        fill="currentColor"
        stroke={strokeWidth ? 'currentColor' : undefined}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 官方 `ca` = tabler `chevron-down`。 */
export function OfficialChevronDownIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="chevron-down">
      <path d="M6 9l6 6l6 -6" />
    </TablerSvg>
  );
}

/* ── 消息操作栏四颗（官方 `page-BeI7xydN.js`@871388 的 `qe`/`oC`/`aC`/`ct`；全是 **Tabler**，
     不是 lucide —— 尤其是 fork 官方用 `split`（分叉双箭头），lucide 的 `corner-up-right` 形状完全不同）── */

/** 官方 `Ku` = tabler **`dots`（横排三点）** —— 产物详情页「更多操作」的触发键（16/1.5）。
 *  ⚠️ 不是 `dots-vertical`：官方 path 全在 `y=12` 上（`M5 12 / M12 12 / M19 12`）。 */
export function OfficialMoreVerticalIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="dots">
      <path d="M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    </TablerSvg>
  );
}

/** 官方 `_T` = **lucide `trash`**（排队消息行的「删除」，14/1.5）。 */
export function OfficialTrashIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} lucideName="trash">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </TablerSvg>
  );
}

/** 官方 `Wu` = **tabler `trash`**（会话下拉里每行的「删除」，13px）。 */
export function OfficialTablerTrashIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="trash">
      <path d="M4 7l16 0" />
      <path d="M10 11l0 6" />
      <path d="M14 11l0 6" />
      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
      <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </TablerSvg>
  );
}

/** 官方 `Da` = **tabler `pencil`**（会话下拉里每行的「重命名」，13px）。 */
export function OfficialTablerPencilIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="pencil">
      <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
      <path d="M13.5 6.5l4 4" />
    </TablerSvg>
  );
}

/** 官方 `Fs` = **tabler `plus`**（会话下拉「新建对话」行，16/1.5）。 */
export function OfficialTablerPlusIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="plus">
      <path d="M12 5l0 14" />
      <path d="M5 12l14 0" />
    </TablerSvg>
  );
}

/** 官方 `iC` = **tabler `eye`**（只读会话徽标，12px）。 */
export function OfficialTablerEyeIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="eye">
      <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
    </TablerSvg>
  );
}

/** 官方 `qi` = **tabler `chevron-right`**（会话下拉「历史会话」分组折叠箭头，14px）。 */
export function OfficialTablerChevronRightIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="chevron-right">
      <path d="M9 6l6 6l-6 6" />
    </TablerSvg>
  );
}

/**
 * 官方 `dm`：**「从画布添加 / 插入画布内容」的自绘 glyph（16 视框）**。
 *
 * 严格三段式反解（见 `D:\DEEPSEEK\_icon4.mjs` —— 跳过第②段会撞名，之前就栽在这）：
 *   ① 页面 chunk import 块：`g as dm` @ `Image-with-skeleton-PI9Adijj.js`
 *   ② 该 chunk 的 export 块：`i1 as g`
 *   ③ 该 chunk 内 `i1` 的定义 ⇒ `({className, size=16, strokeWidth}) => <svg viewBox="0 0 16 16"
 *      fill="none" aria-hidden><path d="M8.16431 7.51599…" /></svg>`（单条 `path`，无 `fill` 属性 ⇒ 默认黑，
 *      实际由外层 `text-*` 经 `fill` 继承；官方那个 `strokeWidth` 参数是**没用上**的）
 *
 * ⚠️ 早前一轮我按「全局搜同名符号」错解成 index chunk 的 `Nui`（24 视框 + `scale(.84)`），
 *    那是**错的**，已按上面的严格链改正回 16 视框自绘 glyph。
 */
export function OfficialInsertFromCanvasIcon({
  className,
  size = 16,
  strokeWidth,
}: {
  className?: string;
  size?: number;
  /** 官方可选描边：传了才加 `stroke=currentColor` + `strokeWidth`（不传就只有 `fill`）。 */
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8.16431 7.51599C8.32204 7.48359 8.48614 7.49821 8.63599 7.55701L14.636 9.89001H14.637C14.7775 9.94496 14.9004 10.037 14.9924 10.1556L15.0295 10.2084L15.0627 10.264C15.1353 10.3956 15.1715 10.5447 15.1663 10.6957C15.1602 10.8682 15.101 11.035 14.9963 11.1722C14.8917 11.3094 14.7469 11.4108 14.5823 11.4623H14.5813L12.2854 12.1742H12.2844C12.2586 12.1822 12.2352 12.197 12.2161 12.2162C12.197 12.2353 12.1821 12.2588 12.1741 12.2845L11.4631 14.5804V14.5814C11.4117 14.746 11.3102 14.8908 11.1731 14.9955C11.0358 15.1002 10.8691 15.1594 10.6965 15.1654C10.524 15.1714 10.3535 15.1235 10.2092 15.0287C10.0652 14.9339 9.95366 14.7967 9.89087 14.6361V14.6351L7.55786 8.63513L7.52173 8.5199C7.49447 8.40334 7.49257 8.28164 7.51685 8.16345C7.54967 8.00422 7.62845 7.85751 7.74341 7.74255C7.85837 7.6276 8.00507 7.54881 8.16431 7.51599ZM9.39966 1.83337C10.1379 1.83337 10.722 1.83312 11.1917 1.87146C11.6672 1.91031 12.0703 1.99093 12.4377 2.1781C13.0335 2.4817 13.518 2.96706 13.8215 3.56287C14.0086 3.9302 14.0893 4.33258 14.1282 4.80798C14.1665 5.27771 14.1663 5.86158 14.1663 6.59998V7.28455C14.1663 7.56069 13.9424 7.78455 13.6663 7.78455C13.3903 7.78437 13.1663 7.56058 13.1663 7.28455V6.59998C13.1663 5.84506 13.1664 5.30861 13.1321 4.88904C13.0983 4.47546 13.0343 4.21892 12.9309 4.01599C12.7232 3.60841 12.3912 3.27741 11.9836 3.0697C11.7807 2.96628 11.5243 2.90234 11.1106 2.86853C10.691 2.83425 10.1546 2.83337 9.39966 2.83337H6.59985C5.84493 2.83337 5.30848 2.83425 4.88892 2.86853C4.47537 2.90234 4.21879 2.96631 4.01587 3.0697C3.60849 3.27737 3.27725 3.60862 3.06958 4.01599C2.96618 4.21892 2.90222 4.47549 2.86841 4.88904C2.83413 5.30861 2.83325 5.84506 2.83325 6.59998V9.39978C2.83325 10.1547 2.83413 10.6911 2.86841 11.1107C2.90221 11.5245 2.96616 11.7808 3.06958 11.9838C3.27729 12.3913 3.60829 12.7233 4.01587 12.931C4.2188 13.0344 4.47534 13.0984 4.88892 13.1322C5.30848 13.1665 5.84493 13.1664 6.59985 13.1664H7.28442C7.56046 13.1664 7.78425 13.3904 7.78442 13.6664C7.78442 13.9425 7.56057 14.1664 7.28442 14.1664H6.59985C5.86146 14.1664 5.27758 14.1667 4.80786 14.1283C4.33245 14.0895 3.93008 14.0087 3.56274 13.8217C2.96694 13.5181 2.48158 13.0337 2.17798 12.4379C1.99081 12.0705 1.91019 11.6673 1.87134 11.1918C1.83299 10.7221 1.83325 10.138 1.83325 9.39978V6.59998C1.83325 5.86158 1.83297 5.27771 1.87134 4.80798C1.91018 4.33262 1.99095 3.93017 2.17798 3.56287C2.48158 2.96702 2.9669 2.4817 3.56274 2.1781C3.93005 1.99107 4.3325 1.9103 4.80786 1.87146C5.27758 1.83309 5.86146 1.83337 6.59985 1.83337H9.39966ZM10.6497 13.8275L11.219 11.9886C11.2751 11.8075 11.3749 11.6423 11.509 11.5082C11.643 11.3743 11.8076 11.2752 11.9885 11.2191L13.8284 10.6488L8.62622 8.62537L10.6497 13.8275Z"
        fill="currentColor"
        stroke={strokeWidth ? 'currentColor' : undefined}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 官方 `ko` = **lucide `loader-circle`**（「+」触发钮上传中的转圈，16/1.5）。
 *  ⚠️ path 按官方**逐字**：`vendor-libs` 里是 `M21 12a9 9 0 1 1-6.219-8.56`
 *  （`1-6.219` 之间**无空格**）；MTV 原来写成 `1 -6.219 -8.56`，形状相同但不是同一串。 */
export function OfficialLoaderCircleIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} lucideName="loader-circle">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </TablerSvg>
  );
}

/**
 * 官方 `wg`：「+」菜单「头脑风暴」行图标。
 *
 * ⚠️ 这一行**不是字形（不是 lucide brain）**，而是一张官方位图资源。
 * 三段式反解：页面 `import{b8 as wg}` @ `course-api-base-url-*.js` → 该 chunk `uhe as b8` →
 * `const dhe = "/assets/brainstorm-icon-DOBrugdc.svg";`
 * `uhe = ({size, className}) => <img src={dhe} alt="" aria-hidden draggable={false}
 *    className={Q("shrink-0 rounded-[22%] object-cover", className)}
 *    style={{width: size, height: size}} />`
 *
 * 挂载点逐字（PAGE@761469）：`<wg size={16} className={Al} />`，`Al` = `shrink-0 text-text-text-primary`。
 * 资源本体已按官方原字节复制到 `public/assets/brainstorm-icon.svg`。
 */
export function OfficialBrainstormIcon({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <img
      src="/assets/brainstorm-icon.svg"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`shrink-0 rounded-[22%] object-cover${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * 官方 `qt`：技能子面板两条上传行的图标（**两条共用同一颗**，官方没有 file-up / folder-up 之分）。
 * 三段式反解：`use-chat-attachment-file-input-*.js` 页面 `import{F as qt}` @ `index-*.js` → `KLt as F` →
 * `KLt = ({className, size = 16}) => <svg width={size} height={size} viewBox="0 0 48 48" fill="none"
 *   aria-hidden className={className}><path d="M24 9.375V28.875M15.875 17.5L24 9.375L32.125 17.5M38.625
 *   28.875V35.375C38.625 36.237 38.2826 37.0636 37.6731 37.6731C37.0636 38.2826 36.237 38.625 35.375
 *   38.625H12.625C11.763 38.625 10.9364 38.2826 10.3269 37.6731C9.71741 37.0636 9.375 36.237 9.375
 *   35.375V28.875" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>`
 *  （自绘 48 视框「向上箭头 + 托盘」）。
 *
 * 挂载点逐字（`use-chat-attachment-file-input-*.js`@151484 / @152000）：
 * `busy ? <wt size={16} className={cn(dt,"animate-spin")} /> : <qt size={16} className={dt} />`
 *  —— `wt` = lucide `loader-circle`（即 {@link OfficialLoaderCircleIcon}）。
 */
export function OfficialUploadIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M24 9.375V28.875M15.875 17.5L24 9.375L32.125 17.5M38.625 28.875V35.375C38.625 36.237 38.2826 37.0636 37.6731 37.6731C37.0636 38.2826 36.237 38.625 35.375 38.625H12.625C11.763 38.625 10.9364 38.2826 10.3269 37.6731C9.71741 37.0636 9.375 36.237 9.375 35.375V28.875"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 官方 `En`（`use-chat-attachment-file-input-*.js`@147166）：技能头像内部 `<img>` 的样式复位对象。 */
const SKILL_AVATAR_IMG_RESET = {
  display: 'block',
  margin: 0,
  maxWidth: 'none',
  borderRadius: 0,
  boxShadow: 'none',
  transition: 'none',
  transform: 'none',
  cursor: 'default',
} as const;

/**
 * 官方 `qs`：技能子面板每一行的技能头像（**不是通用 sparkles 图标**）。
 * 三段式反解：`use-chat-attachment-file-input-*.js`@148138 `Jh`（技能行）内 `a.jsx(qs,{size:16,skillName,source})`；
 * `qs` 定义在同 chunk @147166：
 * `qs = ({size, skillName, source, className}) => {`
 * `  const r = Xh(skillName, source);              // 仅 source==="tapnow" 才有专属 svg，否则 null`
 * `  if (r) return <img src={r} …/>;`
 * `  const i = source === "tapnow" && skillName ? Vs(skillName) : null;   // MTV 没有 tapnow 技能表 ⇒ null`
 * `  const o = i && Wh.has(i) ? .22 : 0, c = `${o*100}%`, l = `${(1-o*2)*100}%`;`
 * `  return <span className={cn("relative inline-flex shrink-0 overflow-hidden", className)}`
 * `      style={{width:size,height:size,minWidth:size,minHeight:size,borderRadius:"25%"}} aria-hidden>`
 * `    <img src={bh} … className="absolute inset-0 size-full object-cover" style={{...En,width:"100%",height:"100%"}} />`
 * `    {i === "digital_human" ? <Ho color="white" …/> : <img src={Yh(skillName, source)} … className="absolute object-contain"`
 * `        style={{...En, top:c, left:c, width:l, height:l}} />}`
 * `  </span>;`
 * `}`
 * 其中 `bh = "/assets/skill-icon-background-Cc5WbgY8.png"`，`Yh(非 tapnow) ⇒ Kt`（200×200 PNG 兜底，已按原字节取出）。
 * MTV 的技能没有 `source`/专属头像 ⇒ 走官方兜底分支：`o = 0` ⇒ `top/left = 0%`、宽高 `100%`。
 */
/**
 * 官方 `qs`（技能头像，`use-chat-attachment-file-input-CE59XJWo.js@147165`）**逐字**：
 * ```js
 * qs = ({size, skillName, source, className}) => {
 *   const override = Xh(skillName, source);                       // ① scene_director / whitebox_to_film 两个专用 SVG
 *   if (override) return <img src={override} className="shrink-0 object-cover"
 *                             style={{width:size,height:size,minWidth:size,minHeight:size,…}}/>;
 *   const key = source === 'tapnow' && skillName ? Vs(skillName) : null;   // ② 名字 → 表 key
 *   const inset = key && Wh.has(key) ? .22 : 0;                   // ③ 这 12 个 key 的图标要内缩 22%
 *   const c = `${inset*100}%`, l = `${(1-inset*2)*100}%`;
 *   return <span className="relative inline-flex shrink-0 overflow-hidden"
 *                style={{width:size,height:size,minWidth:size,minHeight:size,borderRadius:'25%'}}>
 *     <img src={bh /* /assets/skill-icon-background-Cc5WbgY8.png *\/} className="absolute inset-0 size-full object-cover"/>
 *     {key === 'digital_human'
 *       ? <Ho color="white" className="absolute" style={{top:c,left:c,width:l,height:l}}/>   // tabler filled `man-filled`
 *       : <img src={Yh(skillName, source)} className="absolute object-contain" style={{top:c,left:c,width:l,height:l}}/>}
 *   </span>;
 * };
 * Yh = (name, source) => { if (!name || source !== 'tapnow') return Kt;  // Kt = 兜底 base64 PNG
 *                          const k = Vs(name); return k ? (qh[k] ?? Kt) : Kt };
 * ```
 * ⇒ 内置技能各自的专属图标（29 个 key）已从官方包里逐字取出，见 `./skillIconMap`。
 * ⚠️ 官方用 `source === 'tapnow'` 当开关；MTV 的技能没有这个来源标记 ⇒ 这里按**名字命中**即用专属图标，
 *    没命中就走官方兜底 `Kt`（`public/assets/skill-icon-fallback.png`，与官方 base64 同字节）。
 */
export function OfficialSkillAvatarIcon({
  size = 16,
  skillName,
  className,
}: {
  size?: number;
  skillName?: string;
  className?: string;
}) {
  const override = skillName ? resolveSkillOverride(skillName) : null;
  if (override) {
    return (
      <img
        src={override}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={`shrink-0 object-cover${className ? ` ${className}` : ''}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size, ...SKILL_AVATAR_IMG_RESET }}
      />
    );
  }
  const key = skillName ? resolveSkillTableKey(skillName) : null;
  const inset = key && SKILL_ICON_INSET_KEYS.includes(key) ? 0.22 : 0;
  const offset = `${inset * 100}%`;
  const inner = `${(1 - inset * 2) * 100}%`;
  const glyph = skillName ? resolveSkillIcon(skillName) : null;
  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size, borderRadius: '25%' }}
      aria-hidden="true"
    >
      <img
        src="/assets/skill-icon-background.png"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute inset-0 size-full object-cover"
        style={{ ...SKILL_AVATAR_IMG_RESET, width: '100%', height: '100%' }}
      />
      {key === 'digital_human' ? (
        /* 官方 `Ho` = tabler **filled** `man-filled`（`g("filled","man-filled","ManFilled",…)`），白色。 */
        <Icon
          icon="tabler:man-filled"
          width={size * (1 - inset * 2)}
          height={size * (1 - inset * 2)}
          className="absolute text-white"
          style={{ top: offset, left: offset }}
        />
      ) : (
        <img
          src={glyph ?? '/assets/skill-icon-fallback.png'}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute object-contain"
          style={{ ...SKILL_AVATAR_IMG_RESET, top: offset, left: offset, width: inner, height: inner }}
        />
      )}
    </span>
  );
}

/**
 * 官方 `Oa`：技能子面板「创建技能」行图标。
 * 三段式反解：`use-chat-attachment-file-input-*.js` `import{b as Oa}` @ `IconSkill-*.js` → 该 chunk `z as b` →
 * `z = ({className, size = 16}) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden
 *   className={className}><path d="M8.00195 2.16797…" fill="currentColor" /></svg>`（自绘 16 视框「加号」）。
 */
export function OfficialSkillCreateIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8.00195 2.16797C8.27797 2.16797 8.50176 2.39199 8.50195 2.66797V7.49805H13.335C13.611 7.49805 13.8348 7.72206 13.835 7.99805C13.835 8.27419 13.6111 8.49805 13.335 8.49805H8.50195V13.332C8.50175 13.608 8.27797 13.832 8.00195 13.832C7.72595 13.832 7.50215 13.608 7.50195 13.332V8.49805H2.67188C2.39577 8.498 2.17187 8.27416 2.17188 7.99805C2.17206 7.72209 2.39588 7.49809 2.67188 7.49805H7.50195V2.66797C7.50215 2.39201 7.72595 2.16799 8.00195 2.16797Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * 官方 `Pa`：技能子面板「管理技能」行图标。
 * 三段式反解：`use-chat-attachment-file-input-*.js` `import{c as Pa}` @ `IconSkill-*.js` → 该 chunk `e1 as c` →
 * `e1 = ({className, size = 16}) => <svg … viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
 *   <path d="M7.99903 1.12207…" fill="currentColor" /></svg>`（自绘 16 视框「齿轮」）。
 */
export function OfficialSkillManageIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M7.99903 1.12207C8.49545 1.12207 8.97454 1.3076 9.3418 1.6416C9.6859 1.95465 9.90932 2.37731 9.97462 2.83594L9.98536 2.92871V2.93164C9.99944 3.09071 10.0519 3.24424 10.1377 3.37891C10.2237 3.51365 10.3411 3.62617 10.4795 3.70605C10.6179 3.7859 10.7739 3.83091 10.9336 3.83789C11.0932 3.84483 11.2527 3.81355 11.3975 3.74609L11.4014 3.74414C11.8525 3.53937 12.3642 3.50984 12.8359 3.66113C13.3074 3.81251 13.7064 4.13371 13.9541 4.5625C14.2018 4.99134 14.2812 5.49736 14.1768 5.98145C14.0722 6.4657 13.7905 6.89412 13.3877 7.18262C13.3865 7.18347 13.385 7.18469 13.3838 7.18555C13.2532 7.27729 13.1459 7.39938 13.0723 7.54102C12.9987 7.68263 12.961 7.84043 12.9609 8C12.961 8.15963 12.9986 8.31735 13.0723 8.45898C13.1368 8.58298 13.2269 8.69159 13.3359 8.77832L13.3838 8.81445L13.3877 8.81738C13.7904 9.10586 14.0722 9.5334 14.1768 10.0176C14.2813 10.5016 14.2017 11.0077 13.9541 11.4365C13.7063 11.8654 13.3075 12.1875 12.8359 12.3389C12.3643 12.4901 11.8524 12.4605 11.4014 12.2559C11.4002 12.2553 11.3987 12.2545 11.3975 12.2539C11.2527 12.1864 11.0932 12.1542 10.9336 12.1611C10.7739 12.1681 10.6179 12.2141 10.4795 12.2939C10.3412 12.3738 10.2236 12.4855 10.1377 12.6201C10.0518 12.7548 9.99946 12.9083 9.98536 13.0674V13.0713C9.93829 13.5653 9.7089 14.0245 9.3418 14.3584C8.97456 14.6923 8.49539 14.877 7.99903 14.877C7.50285 14.8769 7.02438 14.6922 6.65723 14.3584C6.29012 14.0245 6.06076 13.5653 6.01368 13.0713L6.0127 13.0674C5.99862 12.9082 5.9463 12.7549 5.86036 12.6201C5.77445 12.4854 5.65787 12.3728 5.51954 12.293C5.38117 12.2132 5.22501 12.1681 5.06544 12.1611C4.90586 12.1542 4.74635 12.1855 4.60157 12.2529C4.60005 12.2536 4.59821 12.2552 4.59669 12.2559C4.1458 12.4605 3.63464 12.4899 3.16309 12.3389C2.69138 12.1876 2.29276 11.8654 2.04493 11.4365C1.79714 11.0076 1.71772 10.5018 1.82227 10.0176C1.92687 9.53349 2.20775 9.10582 2.61036 8.81738L2.61426 8.81445C2.74501 8.72271 2.85208 8.60068 2.92579 8.45898C2.9994 8.31737 3.03802 8.1596 3.03809 8C3.03807 7.84048 2.99928 7.68259 2.92579 7.54102C2.85214 7.39942 2.74487 7.27727 2.61426 7.18555C2.61304 7.18469 2.61158 7.18348 2.61036 7.18262C2.20817 6.89398 1.92756 6.46537 1.82325 5.98145C1.71898 5.49756 1.79836 4.99213 2.04591 4.56348C2.29345 4.13502 2.69105 3.81363 3.16212 3.66211C3.63334 3.5106 4.14473 3.54013 4.59571 3.74414C4.59723 3.74481 4.59912 3.74541 4.60059 3.74609C4.74543 3.81352 4.90485 3.84486 5.06446 3.83789C5.22389 3.83084 5.37933 3.78577 5.51758 3.70605C5.65604 3.62617 5.77341 3.51367 5.85938 3.37891C5.94525 3.24422 5.99764 3.09075 6.01173 2.93164C6.01328 2.91414 6.01529 2.89676 6.01856 2.87988C6.07558 2.40434 6.3021 1.96459 6.65723 1.6416C7.02442 1.30766 7.50271 1.12214 7.99903 1.12207ZM7.99903 2.12207C7.75166 2.12214 7.51315 2.21449 7.33008 2.38086C7.14694 2.54742 7.03225 2.777 7.0088 3.02344C7.00713 3.0408 7.00434 3.05846 7.00098 3.0752C6.96605 3.37454 6.86449 3.6625 6.70216 3.91699C6.52981 4.18709 6.2951 4.41213 6.01758 4.57227C5.74002 4.73239 5.42757 4.82292 5.10743 4.83691C4.78923 4.85079 4.47265 4.78794 4.1836 4.6543C3.95882 4.55263 3.70365 4.53884 3.46876 4.61426C3.2338 4.68984 3.03459 4.84976 2.91114 5.06348C2.78767 5.27729 2.74876 5.53013 2.80079 5.77148C2.85291 6.01256 2.99202 6.22628 3.19239 6.37012C3.45263 6.55374 3.66552 6.7965 3.81251 7.0791C3.96028 7.36331 4.03807 7.67967 4.03809 8C4.03802 8.3202 3.96021 8.63582 3.81251 8.91992C3.66548 9.20268 3.45277 9.4462 3.19239 9.62988L3.12012 9.6875C2.95819 9.82793 2.84549 10.0174 2.79981 10.2285C2.74768 10.47 2.78665 10.7226 2.91016 10.9365C3.03376 11.1504 3.23256 11.3113 3.46778 11.3867C3.70303 11.4622 3.95864 11.4468 4.1836 11.3447C4.47278 11.2108 4.78998 11.1483 5.10841 11.1621C5.42857 11.176 5.74095 11.2667 6.01856 11.4268C6.29622 11.5869 6.53172 11.8118 6.70411 12.082C6.8759 12.3514 6.9802 12.6584 7.0088 12.9766L7.02149 13.0684C7.06168 13.2794 7.16994 13.4725 7.33008 13.6182C7.51317 13.7846 7.75158 13.8769 7.99903 13.877C8.2466 13.877 8.48579 13.7847 8.66895 13.6182C8.85196 13.4517 8.96677 13.2229 8.99024 12.9766C9.01888 12.6584 9.12312 12.3513 9.29493 12.082C9.4672 11.8121 9.70216 11.5878 9.9795 11.4277C10.2571 11.2676 10.5695 11.1761 10.8897 11.1621C11.2081 11.1482 11.5253 11.2109 11.8145 11.3447L11.9004 11.3789C12.1031 11.4491 12.3244 11.4527 12.5303 11.3867C12.7655 11.3112 12.9643 11.1504 13.0879 10.9365C13.2114 10.7226 13.2514 10.47 13.1992 10.2285C13.147 9.9871 13.0065 9.77373 12.8057 9.62988L12.6191 9.48145C12.4426 9.3223 12.2958 9.13197 12.1856 8.91992C12.0379 8.63582 11.961 8.3202 11.9609 8C11.961 7.67967 12.0378 7.36331 12.1856 7.0791C12.3326 6.79639 12.5453 6.55278 12.8057 6.36914C13.0064 6.22528 13.1471 6.01188 13.1992 5.77051C13.2513 5.52907 13.2115 5.27637 13.0879 5.0625C12.9643 4.8487 12.7654 4.68878 12.5303 4.61328C12.295 4.53782 12.0394 4.55215 11.8145 4.6543C11.5252 4.78814 11.2081 4.85081 10.8897 4.83691C10.5695 4.82289 10.2571 4.73241 9.9795 4.57227C9.70197 4.41211 9.46727 4.18712 9.29493 3.91699C9.12324 3.64784 9.01895 3.34136 8.99024 3.02344C8.96678 2.77701 8.85209 2.54741 8.66895 2.38086C8.48579 2.21429 8.24661 2.12207 7.99903 2.12207ZM7.99903 5.58301C9.3336 5.58309 10.4159 6.66543 10.416 8C10.4159 9.33457 9.3336 10.4169 7.99903 10.417C6.66444 10.4169 5.58212 9.33458 5.58204 8C5.58212 6.66542 6.66444 5.58307 7.99903 5.58301ZM7.99903 6.58301C7.21673 6.58307 6.58212 7.2177 6.58204 8C6.58212 8.7823 7.21673 9.41693 7.99903 9.41699C8.78131 9.41691 9.41594 8.78228 9.41602 8C9.41594 7.21772 8.78131 6.58309 7.99903 6.58301Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * 官方 `Hr.image`（`use-chat-attachment-file-input-*.js@155010` 的占位图标表）：
 * 三段式反解 `page` 的 `Tl` → `use-waveform-data-*.js` 的 `K0 as G` →
 * `K0 = ({className, size = 48, opacity = .2}) => <svg width={size} height={size} viewBox="0 0 48 48" fill="none"
 *   className={className}><g opacity={opacity}><path fillRule="evenodd" clipRule="evenodd" d="M31.7998 3…"
 *   fill="currentColor" /></g></svg>`（自绘 48 视框「圆角相框 + 山 + 太阳」）。
 * 占位图标组件 `Ys` 调用时传 `size`（芯片里默认 `op=14`、预览卡里 32）与 `opacity = .6`。
 */
export function OfficialImagePlaceholderIcon({
  size = 48,
  opacity = 0.2,
  className,
}: {
  size?: number;
  opacity?: number;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <g opacity={opacity}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M31.7998 3C33.727 3 35.293 2.998 36.5606 3.10157C37.8514 3.20704 39.0084 3.43147 40.0859 3.98047C41.7794 4.84333 43.1567 6.22061 44.0195 7.91407C44.5685 8.99162 44.793 10.1486 44.8984 11.4395C45.002 12.7071 45 14.273 45 16.2002V31.7998C45 33.727 45.002 35.293 44.8984 36.5606C44.793 37.8514 44.5685 39.0084 44.0195 40.0859C43.1567 41.7794 41.7794 43.1567 40.0859 44.0195C39.0084 44.5685 37.8514 44.793 36.5606 44.8984C35.293 45.002 33.727 45 31.7998 45H16.2002C14.273 45 12.7071 45.002 11.4395 44.8984C10.1486 44.793 8.99162 44.5685 7.91407 44.0195C6.22061 43.1567 4.84333 41.7794 3.98047 40.0859C3.43147 39.0084 3.20704 37.8514 3.10157 36.5606C2.998 35.293 3 33.727 3 31.7998V16.2002C3 14.273 2.998 12.7071 3.10157 11.4395C3.20704 10.1486 3.43147 8.99162 3.98047 7.91407C4.84333 6.22061 6.22061 4.84333 7.91407 3.98047C8.99162 3.43147 10.1486 3.20704 11.4395 3.10157C12.7071 2.998 14.273 3 16.2002 3H31.7998ZM16.6064 24.0537C16.0437 23.8709 15.4378 23.871 14.875 24.0537C14.6778 24.1178 14.3958 24.2616 13.8779 24.7012C13.3422 25.156 12.6948 25.8003 11.7207 26.7744L7 31.4951V31.7998C7 33.7928 7.00173 35.1675 7.08887 36.2344C7.17411 37.2777 7.33114 37.8498 7.54492 38.2695C8.02429 39.2103 8.78967 39.9757 9.73047 40.4551C10.1502 40.6689 10.7223 40.8259 11.7656 40.9111C12.8325 40.9983 14.2072 41 16.2002 41H31.7998C32.6238 41 33.342 40.9977 33.9766 40.9912L19.7598 26.7744C18.7856 25.8003 18.1383 25.155 17.6025 24.7002C17.085 24.2609 16.8036 24.1178 16.6064 24.0537ZM16.2002 7C14.2072 7 12.8325 7.00173 11.7656 7.08887C10.7223 7.17411 10.1502 7.33114 9.73047 7.54492C8.78967 8.02429 8.02429 8.78967 7.54492 9.73047C7.33114 10.1502 7.17411 10.7223 7.08887 11.7656C7.00173 12.8325 7 14.2072 7 16.2002V25.8389L8.89258 23.9463C9.82018 23.0187 10.5998 22.2365 11.2891 21.6514C11.9961 21.0511 12.7385 20.5413 13.6377 20.249C15.004 19.8051 16.4765 19.8042 17.8428 20.248C18.742 20.5402 19.4843 21.0511 20.1914 21.6514C20.8807 22.2366 21.6612 23.0186 22.5889 23.9463L38.79 40.1484C39.4929 39.6756 40.0676 39.0301 40.4551 38.2695C40.6689 37.8498 40.8259 37.2777 40.9111 36.2344C40.9983 35.1675 41 33.7928 41 31.7998V16.2002C41 14.2072 40.9983 12.8325 40.9111 11.7656C40.8259 10.7223 40.6689 10.1502 40.4551 9.73047C39.9757 8.78967 39.2103 8.02429 38.2695 7.54492C37.8498 7.33114 37.2777 7.17411 36.2344 7.08887C35.1675 7.00173 33.7928 7 31.7998 7H16.2002ZM31 13C33.2091 13 35 14.7909 35 17C35 19.2091 33.2091 21 31 21C28.7909 21 27 19.2091 27 17C27 14.7909 28.7909 13 31 13Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}

/**
 * 官方 `Hr.audio`（同上表）：内联 24 视框「音符」（`stroke="currentColor"` `strokeWidth="1.5"`，
 * 两个 `fill="currentColor"` 的圆）。
 * ⚠️ 不是 tabler `music` —— MTV 之前用的 `OfficialMusicIcon` 形状不对。
 */
export function OfficialAudioNoteIcon({
  size = 24,
  opacity,
  className,
}: {
  size?: number;
  opacity?: number;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={opacity} className={className} aria-hidden="true">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" fill="currentColor" />
      <circle cx="18" cy="16" r="3" fill="currentColor" />
    </svg>
  );
}

/**
 * 官方 `Hr.file`（同上表）：内联 24 视框「文件」（`stroke="currentColor"` `strokeWidth="1.5"`）。
 */
export function OfficialFileOutlineIcon({
  size = 24,
  opacity,
  className,
}: {
  size?: number;
  opacity?: number;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={opacity} className={className} aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

/**
 * 官方 `Hr.quote`（同上表）：内联 24 视框「双引号」（`strokeWidth="2"` round）。
 */
export function OfficialQuoteIcon({
  size = 24,
  opacity,
  className,
}: {
  size?: number;
  opacity?: number;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} className={className} aria-hidden="true">
      <path d="M10 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" />
      <path d="M19 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" />
    </svg>
  );
}

/**
 * 官方音频占位 glyph 三态（`use-waveform-data-*.js` 内联定义，都是自绘 16 视框、`fill="currentColor"`）：
 *   `Mr`(=`Xm`) = ({className, size=48, opacity=.2, scene}) => switch(scene){
 *       case "Text-to-Speech": return <cu …/>;   // 等化器竖条
 *       case "Music":          return <Z0 …/>;   // 双音符
 *       case "Sound":          return <U0 …/>;   // 双声波
 *       default:               return <cu …/>;   }
 * ⚠️ 不是 tabler `music`（此前 MTV 用 tabler music，官方音频节点 scene 缺省走的是 `cu` 等化器）。
 */
function OfficialAudioEqualizerIcon({ size = 48, opacity = 0.2, className }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <g opacity={opacity}>
        <path d="M6.80013 2.16699C7.07621 2.16706 7.30013 2.39089 7.30013 2.66699V13.3337C7.30013 13.6098 7.07621 13.8336 6.80013 13.8337C6.52399 13.8337 6.30013 13.6098 6.30013 13.3337V2.66699C6.30013 2.39085 6.52399 2.16699 6.80013 2.16699Z" fill="currentColor" />
        <path d="M4.40007 3.94466C4.67614 3.9447 4.90001 4.16859 4.90007 4.44466V10.9632C4.90007 11.2393 4.67618 11.4632 4.40007 11.4632C4.12392 11.4632 3.90007 11.2394 3.90007 10.9632V4.44466C3.90012 4.16857 4.12396 3.94466 4.40007 3.94466Z" fill="currentColor" />
        <path d="M9.19987 5.12988C9.47599 5.12988 9.69983 5.35377 9.69987 5.62988V9.44466C9.69987 9.7208 9.47601 9.94466 9.19987 9.94466C8.92379 9.94459 8.69987 9.72076 8.69987 9.44466V5.62988C8.69991 5.35382 8.92381 5.12995 9.19987 5.12988Z" fill="currentColor" />
        <path d="M2 6.3151C2.27613 6.3151 2.49998 6.53898 2.5 6.8151V8.59277C2.5 8.86892 2.27614 9.09277 2 9.09277C1.72386 9.09277 1.5 8.86892 1.5 8.59277V6.8151C1.50002 6.53898 1.72387 6.3151 2 6.3151Z" fill="currentColor" />
        <path d="M11.5999 3.35221C11.8761 3.35221 12.0999 3.57607 12.0999 3.85221V7.92611C12.0999 8.20225 11.8761 8.42611 11.5999 8.42611C11.3238 8.42607 11.0999 8.20223 11.0999 7.92611V3.85221C11.0999 3.57609 11.3238 3.35225 11.5999 3.35221Z" fill="currentColor" />
        <path d="M14 6.3151C14.2761 6.3151 14.5 6.53898 14.5 6.8151V7.92611C14.5 8.20225 14.2761 8.42611 14 8.42611C13.7239 8.42611 13.5 8.20225 13.5 7.92611V6.8151C13.5 6.53898 13.7239 6.3151 14 6.3151Z" fill="currentColor" />
        <path d="M13.8333 10.8962C13.8333 11.1723 13.6095 11.3962 13.3333 11.3962C13.0572 11.3962 12.8333 11.1723 12.8333 10.8962V10.8337H12.3333V12.8337H12.3958C12.672 12.8337 12.8958 13.0575 12.8958 13.3337C12.8958 13.6098 12.672 13.8337 12.3958 13.8337H11.2708C10.9947 13.8337 10.7708 13.6098 10.7708 13.3337C10.7708 13.0575 10.9947 12.8337 11.2708 12.8337H11.3333V10.8337H10.8333V10.8962C10.8333 11.1723 10.6095 11.3962 10.3333 11.3962C10.0572 11.3962 9.83333 11.1723 9.83333 10.8962V10.5212C9.83333 10.3388 9.9059 10.1641 10.0348 10.0352C10.1638 9.90623 10.3385 9.83366 10.5208 9.83366H13.1458C13.3282 9.83366 13.5029 9.90623 13.6318 10.0352C13.7608 10.1641 13.8333 10.3388 13.8333 10.5212V10.8962Z" fill="currentColor" />
      </g>
    </svg>
  );
}

/** 官方 `Z0`：`scene === "Music"` 的双音符（16 视框自绘）。 */
function OfficialAudioMusicSceneIcon({ size = 48, opacity = 0.2, className }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <g opacity={opacity}>
        <path d="M5.61096 11.611C5.6109 10.936 5.06389 10.389 4.38896 10.389C3.71398 10.389 3.16668 10.936 3.16663 11.611C3.16663 12.286 3.71394 12.8333 4.38896 12.8333C5.06392 12.8332 5.61096 12.286 5.61096 11.611ZM12.5 10.4629C12.4999 9.78788 11.9526 9.24086 11.2776 9.24086C10.6027 9.24092 10.0557 9.78792 10.0556 10.4629C10.0556 11.1378 10.6027 11.6851 11.2776 11.6852C11.9526 11.6852 12.5 11.1379 12.5 10.4629ZM13.5 10.4629C13.5 11.6902 12.5049 12.6852 11.2776 12.6852C10.0504 12.6851 9.05562 11.6901 9.05562 10.4629C9.05566 9.23563 10.0504 8.24092 11.2776 8.24086C11.7292 8.24086 12.1493 8.37566 12.5 8.60707V3.59014L6.61096 4.57159V11.611C6.61096 12.8382 5.61621 13.8332 4.38896 13.8333C3.16166 13.8333 2.16663 12.8383 2.16663 11.611C2.16668 10.3837 3.16169 9.38897 4.38896 9.38897C4.84046 9.38899 5.26033 9.52383 5.61096 9.75518V4.14809C5.61098 3.90368 5.78785 3.6951 6.02893 3.65492L12.9176 2.50681C13.0626 2.48265 13.2111 2.52346 13.3232 2.61846C13.4353 2.71346 13.5 2.85301 13.5 2.99997V10.4629Z" fill="currentColor" />
      </g>
    </svg>
  );
}

/** 官方 `U0`：`scene === "Sound"` 的双声波（16 视框自绘）。 */
function OfficialAudioSoundSceneIcon({ size = 48, opacity = 0.2, className }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <g opacity={opacity}>
        <path d="M9.63342 10.667V3.73372C9.63342 3.58347 9.57364 3.43927 9.46741 3.33301C9.36115 3.22675 9.21696 3.16701 9.06669 3.16699C8.9164 3.16699 8.77225 3.22674 8.66598 3.33301C8.5597 3.43928 8.49996 3.58343 8.49996 3.73372V12.2669C8.49996 12.6824 8.33478 13.0809 8.04098 13.3747C7.74717 13.6685 7.34873 13.8337 6.93323 13.8337C6.51775 13.8336 6.11927 13.6685 5.82548 13.3747C5.53171 13.0809 5.3665 12.6824 5.3665 12.2669V5.33366C5.3665 5.1834 5.30704 5.03921 5.20081 4.93294C5.09457 4.8267 4.95033 4.76696 4.80009 4.76693C4.64983 4.76693 4.50564 4.82671 4.39937 4.93294C4.2931 5.03921 4.23336 5.18337 4.23336 5.33366V7.46712C4.23332 7.88258 4.06815 8.28109 3.77437 8.57487C3.48057 8.86864 3.0821 9.03353 2.66663 9.03353C2.39048 9.03353 2.16663 8.80967 2.16663 8.53353C2.1667 8.25745 2.39053 8.03353 2.66663 8.03353C2.81688 8.03353 2.96108 7.97407 3.06734 7.86784C3.17358 7.7616 3.23332 7.61736 3.23336 7.46712V5.33366C3.23336 4.9182 3.39827 4.51971 3.69202 4.22591C3.98582 3.9321 4.38458 3.76693 4.80009 3.76693C5.21555 3.76696 5.61406 3.93214 5.90784 4.22591C6.2016 4.51971 6.3665 4.91818 6.3665 5.33366V12.2669C6.3665 12.4172 6.42628 12.5614 6.53251 12.6676C6.63877 12.7739 6.78296 12.8336 6.93323 12.8337C7.08352 12.8337 7.22767 12.7739 7.33394 12.6676C7.44021 12.5614 7.49996 12.4172 7.49996 12.2669V3.73372C7.49996 3.31822 7.66514 2.91978 7.95894 2.62598C8.25275 2.33217 8.65119 2.16699 9.06669 2.16699C9.48217 2.16701 9.88065 2.33218 10.1744 2.62598C10.4682 2.91978 10.6334 3.31825 10.6334 3.73372V10.667C10.6334 10.8173 10.6929 10.9614 10.7991 11.0677C10.9054 11.1739 11.0496 11.2337 11.1998 11.2337C11.3501 11.2337 11.4943 11.1739 11.6005 11.0677C11.7068 10.9614 11.7666 10.8173 11.7666 10.667V8.53353C11.7666 8.11807 11.9318 7.71956 12.2255 7.42578C12.5193 7.13202 12.9178 6.96712 13.3333 6.96712C13.6094 6.96712 13.8333 7.19098 13.8333 7.46712C13.8332 7.74321 13.6094 7.96712 13.3333 7.96712C13.183 7.96712 13.0388 8.02658 12.9326 8.13281C12.8263 8.23905 12.7666 8.38329 12.7666 8.53353V10.667C12.7666 11.0825 12.6016 11.4809 12.3079 11.7747C12.0141 12.0685 11.6153 12.2337 11.1998 12.2337C10.7844 12.2337 10.3859 12.0685 10.0921 11.7747C9.79832 11.4809 9.63342 11.0825 9.63342 10.667Z" fill="currentColor" />
      </g>
    </svg>
  );
}

/**
 * 官方 `Mr`(=`Xm`)：按 `scene` 分派的音频占位 glyph。
 * 调用点（官方 `HL` 的 audio 分支）：`<Mr size={18} opacity={1} scene={h} className="text-muted-foreground/60"/>`，
 * 其中 `h = typeof node.data.params?.scene === "string" ? node.data.params.scene : undefined`。
 */
export function OfficialAudioSceneIcon({
  scene,
  size = 48,
  opacity = 0.2,
  className,
}: GlyphProps & { scene?: string }) {
  if (scene === 'Music') return <OfficialAudioMusicSceneIcon size={size} opacity={opacity} className={className} />;
  if (scene === 'Sound') return <OfficialAudioSoundSceneIcon size={size} opacity={opacity} className={className} />;
  return <OfficialAudioEqualizerIcon size={size} opacity={opacity} className={className} />;
}

/**
 * 官方 `Hr` + `Ys`（`use-chat-attachment-file-input-*.js`@155597 / @156782）——**预览卡**（tooltip）的占位 glyph：
 *   Hr = { text: Ba, video: La, audio: <24 视框音符>, file: <24 视框文件>, quote: <24 视框双引号>, image: Tl }
 *   Ys = ({placeholderType="image", disabled, size}) => { const s = size ?? op (op=14); const o = disabled ? .4 : .6;
 *          return <span className="inline-flex items-center justify-center shrink-0" style={{width:s,height:s}}>
 *                   {(Hr[placeholderType] ?? Hr.image)({size:s, opacity:o})}</span> }
 * `Xs`(=`Ng`) 里固定 `<Ys placeholderType={type} size={32}/>`。
 */
export function OfficialPlaceholderGlyph({
  placeholderType = 'image',
  size = 14,
  disabled = false,
  className,
}: {
  placeholderType?: 'text' | 'video' | 'audio' | 'file' | 'quote' | 'image' | string;
  size?: number;
  disabled?: boolean;
  className?: string;
}) {
  const opacity = disabled ? 0.4 : 0.6;
  let glyph: ReactNode;
  switch (placeholderType) {
    case 'text':
      glyph = <OfficialTextLinesIcon size={size} opacity={opacity} className={className} />;
      break;
    case 'video':
      glyph = <OfficialVideoPlaceholderIcon size={size} opacity={opacity} className={className} />;
      break;
    case 'audio':
      glyph = <OfficialAudioNoteIcon size={size} opacity={opacity} className={className} />;
      break;
    case 'file':
      glyph = <OfficialFileOutlineIcon size={size} opacity={opacity} className={className} />;
      break;
    case 'quote':
      glyph = <OfficialQuoteIcon size={size} opacity={opacity} className={className} />;
      break;
    default:
      glyph = <OfficialImagePlaceholderIcon size={size} opacity={opacity} className={className} />;
  }
  return (
    <span className="inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      {glyph}
    </span>
  );
}

/**
 * 官方 `T7`：「+」菜单「技能」行图标。
 * 三段式反解：页面 import `d as T7` @ `IconSkill-UAYZEup5.js` → 该 chunk `C1 as d` →
 * `C1 = ({className, size=16}) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
 * aria-hidden><path d="M8.50065 3.25911…" fill="currentColor" /></svg>`（自绘 16 视框「拼图块」）。
 */
export function OfficialSkillGlyphIcon({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8.50065 3.25911C8.50061 3.0578 8.42068 2.86469 8.27832 2.72233C8.13597 2.57998 7.94285 2.50004 7.74154 2.5C7.54017 2.5 7.34682 2.57994 7.20443 2.72233C7.06208 2.86468 6.98213 3.05781 6.9821 3.25911V3.889C6.98207 4.1885 6.86311 4.47569 6.65137 4.6875C6.43953 4.89934 6.15212 5.01855 5.85254 5.01855H3.96354C3.92919 5.01857 3.89636 5.03235 3.87207 5.05664C3.84778 5.08094 3.83399 5.11375 3.83398 5.14811V7.03711C3.834 7.07146 3.84778 7.10429 3.87207 7.12858C3.89636 7.15287 3.92919 7.16665 3.96354 7.16667H4.5931C5.05968 7.16667 5.50731 7.35204 5.83724 7.68197C6.16712 8.01186 6.3525 8.45926 6.35254 8.92578C6.35254 9.39237 6.16716 9.84 5.83724 10.1699C5.50731 10.4998 5.05968 10.6852 4.5931 10.6852H3.96354C3.92919 10.6852 3.89636 10.699 3.87207 10.7233C3.84778 10.7476 3.83399 10.7804 3.83398 10.8148V12.7038C3.834 12.7381 3.84778 12.771 3.87207 12.7952C3.89636 12.8195 3.92919 12.8333 3.96354 12.8333H5.85254C5.8869 12.8333 5.91971 12.8195 5.94401 12.7952C5.9683 12.771 5.98208 12.7381 5.9821 12.7038V12.0742C5.9821 11.6076 6.16747 11.16 6.4974 10.8301C6.82732 10.5002 7.27495 10.3148 7.74154 10.3148C8.20806 10.3148 8.65546 10.5002 8.98535 10.8301C9.31528 11.16 9.50065 11.6076 9.50065 12.0742V12.7038C9.50067 12.7381 9.51444 12.771 9.53874 12.7952C9.56303 12.8195 9.59585 12.8333 9.63021 12.8333H11.5192C11.5536 12.8333 11.5864 12.8195 11.6107 12.7952C11.635 12.771 11.6487 12.7381 11.6488 12.7038V10.8148C11.6488 10.5152 11.768 10.2278 11.9798 10.016C12.1916 9.80421 12.4788 9.68525 12.7783 9.68522H13.4082C13.6095 9.68518 13.8026 9.60523 13.945 9.46289C14.0874 9.3205 14.1673 9.12715 14.1673 8.92578C14.1673 8.72447 14.0873 8.53135 13.945 8.389C13.8026 8.24664 13.6095 8.16671 13.4082 8.16667H12.7783C12.4788 8.16664 12.1916 8.04767 11.9798 7.83594C11.768 7.62411 11.6488 7.33668 11.6488 7.03711V5.14811C11.6488 5.11374 11.635 5.08094 11.6107 5.05664C11.5864 5.03234 11.5536 5.01856 11.5192 5.01855H9.63021C9.33064 5.01854 9.04321 4.89933 8.83138 4.6875C8.61965 4.47569 8.50068 4.18849 8.50065 3.889V3.25911ZM9.50065 3.889C9.50068 3.92334 9.51445 3.95618 9.53874 3.98047C9.56303 4.00475 9.59586 4.01854 9.63021 4.01855H11.5192C11.8188 4.01856 12.1062 4.13745 12.318 4.34928C12.5299 4.56112 12.6488 4.84853 12.6488 5.14811V7.03711C12.6488 7.07146 12.6626 7.10429 12.6868 7.12858C12.7111 7.15287 12.744 7.16664 12.7783 7.16667H13.4082C13.8747 7.16671 14.3221 7.35208 14.652 7.68197C14.9819 8.01186 15.1673 8.45925 15.1673 8.92578C15.1673 9.39237 14.9819 9.84 14.652 10.1699C14.3221 10.4998 13.8747 10.6852 13.4082 10.6852H12.7783C12.744 10.6853 12.7111 10.699 12.6868 10.7233C12.6626 10.7476 12.6488 10.7804 12.6488 10.8148V12.7038C12.6487 13.0033 12.5299 13.2908 12.318 13.5026C12.1062 13.7144 11.8188 13.8333 11.5192 13.8333H9.63021C9.33064 13.8333 9.04321 13.7144 8.83138 13.5026C8.61955 13.2908 8.50067 13.0033 8.50065 12.7038V12.0742C8.50065 11.8729 8.42071 11.6795 8.27832 11.5371C8.13597 11.3948 7.94284 11.3148 7.74154 11.3148C7.54017 11.3148 7.34682 11.3947 7.20443 11.5371C7.06204 11.6795 6.9821 11.8729 6.9821 12.0742V12.7038C6.98208 13.0033 6.8632 13.2908 6.65137 13.5026C6.43953 13.7144 6.15211 13.8333 5.85254 13.8333H3.96354C3.66397 13.8333 3.37654 13.7144 3.16471 13.5026C2.95288 13.2908 2.834 13.0033 2.83398 12.7038V10.8148C2.83399 10.5152 2.95289 10.2278 3.16471 10.016C3.37654 9.80412 3.66397 9.68524 3.96354 9.68522H4.5931C4.79447 9.68522 4.98782 9.60528 5.13021 9.46289C5.2726 9.3205 5.35254 9.12715 5.35254 8.92578C5.3525 8.72447 5.27255 8.53135 5.13021 8.389C4.98782 8.24661 4.79447 8.16667 4.5931 8.16667H3.96354C3.66397 8.16665 3.37654 8.04777 3.16471 7.83594C2.95288 7.62411 2.834 7.33668 2.83398 7.03711V5.14811C2.83399 4.84854 2.95289 4.56112 3.16471 4.34928C3.37654 4.13745 3.66397 4.01857 3.96354 4.01855H5.85254C5.88689 4.01855 5.91971 4.00475 5.94401 3.98047C5.9683 3.95618 5.98207 3.92334 5.9821 3.889V3.25911C5.98213 2.79259 6.16752 2.34519 6.4974 2.0153C6.82732 1.68537 7.27495 1.5 7.74154 1.5C8.20807 1.50004 8.65546 1.68541 8.98535 2.0153C9.31524 2.34519 9.50061 2.79258 9.50065 3.25911V3.889Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * 官方 `rG`：「+」菜单「应用/插件」行图标。
 * 三段式反解：页面 import `aA as rG` @ `use-chat-attachment-file-input-*.js` → 该 chunk `Pl as aA` →
 * `Pl = ({className}) => <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden>
 *   <svg width={12} height={12} viewBox="0 0 10 10" fill="none" className={cx('size-3 shrink-0', className)}>
 *     …4 条 evenodd path…` （自绘 10 视框的 2×2 圆角方块）。
 */
export function OfficialAppsGlyphIcon({ className }: { className?: string }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={12}
        height={12}
        viewBox="0 0 10 10"
        fill="none"
        className={['size-3 shrink-0', className ?? ''].join(' ')}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3.22949 5.20996C3.70492 5.21014 4.08984 5.59582 4.08984 6.07129V8.43945C4.08954 8.91466 3.70473 9.29963 3.22949 9.2998H0.861328C0.385977 9.29976 0.000304737 8.91474 0 8.43945V6.07129C0 5.59574 0.385789 5.21001 0.861328 5.20996H3.22949ZM0.861328 5.98438C0.813809 5.98442 0.775391 6.02376 0.775391 6.07129V8.43945C0.775695 8.48672 0.813998 8.52535 0.861328 8.52539H3.22949C3.27671 8.52522 3.31513 8.48664 3.31543 8.43945V6.07129C3.31543 6.02384 3.2769 5.98455 3.22949 5.98438H0.861328Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8.43945 5.20996C8.91477 5.21027 9.2998 5.5959 9.2998 6.07129V8.43945C9.2995 8.91458 8.91458 9.2995 8.43945 9.2998H6.07129C5.5959 9.2998 5.21027 8.91477 5.20996 8.43945V6.07129C5.20996 5.59571 5.59571 5.20996 6.07129 5.20996H8.43945ZM6.07129 5.98438C6.02373 5.98438 5.98438 6.02373 5.98438 6.07129V8.43945C5.98468 8.48675 6.02392 8.52539 6.07129 8.52539H8.43945C8.48657 8.52509 8.52509 8.48657 8.52539 8.43945V6.07129C8.52539 6.02392 8.48675 5.98468 8.43945 5.98438H6.07129Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3.22949 0C3.70489 0.00017592 4.0898 0.385897 4.08984 0.861328V3.22949C4.08967 3.70481 3.70481 4.08967 3.22949 4.08984H0.861328C0.385897 4.0898 0.00017592 3.70489 0 3.22949V0.861328C4.54469e-05 0.385816 0.385816 4.54468e-05 0.861328 0H3.22949ZM0.861328 0.775391C0.813837 0.775436 0.775436 0.813837 0.775391 0.861328V3.22949C0.775567 3.27687 0.813918 3.31538 0.861328 3.31543H3.22949C3.27679 3.31526 3.31526 3.27679 3.31543 3.22949V0.861328C3.31538 0.813918 3.27687 0.775567 3.22949 0.775391H0.861328Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8.43945 0C8.91474 0.000304737 9.29976 0.385977 9.2998 0.861328V3.22949C9.29963 3.70473 8.91466 4.08954 8.43945 4.08984H6.07129C5.59582 4.08984 5.21014 3.70492 5.20996 3.22949V0.861328C5.21001 0.385789 5.59574 0 6.07129 0H8.43945ZM6.07129 0.775391C6.02376 0.775391 5.98442 0.813809 5.98438 0.861328V3.22949C5.98455 3.2769 6.02384 3.31543 6.07129 3.31543H8.43945C8.48664 3.31513 8.52522 3.27671 8.52539 3.22949V0.861328C8.52535 0.813998 8.48672 0.775695 8.43945 0.775391H6.07129Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

/** 官方 `to` = **lucide `paperclip`**（「+」菜单第一行「上传附件」）。
 *  ⚠️ 上一轮写成 tabler 是错的：本文件内联的 2 条 path 在 `vendor-libs` 的
 *  tabler 工厂（`p("outline",…)`）里 0 命中、在官方 lucide 工厂 `L(name,node)` 里**唯一**命中 `paperclip`。 */
export function OfficialPaperclipIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} lucideName="paperclip">
      <path d="M13.234 20.252 21 12.3" />
      <path d="m16 6-8.414 8.586a2 2 0 0 0 0 2.828 2 2 0 0 0 2.828 0l8.414-8.586a4 4 0 0 0 0-5.656 4 4 0 0 0-5.656 0l-8.415 8.585a6 6 0 1 0 8.486 8.486" />
    </TablerSvg>
  );
}

/** 官方 `F4` = **lucide `split`**（fork 钮）—— path 全集唯一命中官方 lucide 工厂的 `split`（不是 tabler）。 */
export function OfficialForkIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} lucideName="split">
      <path d="M16 3h5v5" />
      <path d="M8 3H3v5" />
      <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
      <path d="m15 9 6-6" />
    </TablerSvg>
  );
}

/** 官方 `fa` = **lucide `copy`**（未复制态）：`rect(14×14 @8,8 r2)` + 1 条 path，与官方
 *  `Dxa=[[…rect…],[…path…]],zA=L("copy",Dxa)` **逐字**一致。 */
export function OfficialCopyIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} lucideName="copy">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </TablerSvg>
  );
}

/** 官方 `qc` = **lucide `check`**（已复制态）：`M20 6 9 17l-5-5` 是 lucide 的 check
 *  （tabler 的 check 是 `M5 12l5 5l10 -10`，见本文件 `OfficialTablerCheckIcon`）。 */
export function OfficialCheckIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} lucideName="check">
      <path d="M20 6 9 17l-5-5" />
    </TablerSvg>
  );
}

/** 官方 `oC` = **lucide `thumbs-up`**（path 全集唯一命中官方 lucide 工厂）。 */
export function OfficialThumbsUpIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} lucideName="thumbs-up">
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </TablerSvg>
  );
}

/** 官方 `aC` = **lucide `thumbs-down`**（path 全集唯一命中官方 lucide 工厂）。 */
export function OfficialThumbsDownIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} lucideName="thumbs-down">
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
    </TablerSvg>
  );
}

/** 官方 `Ar` = tabler `chevron-left`（产物详情的返回键，18/1.5）。 */export function OfficialChevronLeftIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="chevron-left">
      <path d="M15 6l-6 6l6 6" />
    </TablerSvg>
  );
}

/** 官方 `Uh`（`Image-with-skeleton` export `g` = `i1`）：16×16 自绘「星芒」glyph。
 *  官方属性 = `fill:"currentColor"` + `stroke: s ? "currentColor" : undefined` + `strokeWidth: s`
 *  + `strokeLinejoin:"round"`（调用处 `strokeWidth={.33}`）；**不是 `fill="none"` 的描边图标**。 */
export function OfficialSparkleIcon({ size = 14, strokeWidth, className }: TablerIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8.16431 7.51599C8.32204 7.48359 8.48614 7.49821 8.63599 7.55701L14.636 9.89001H14.637C14.7775 9.94496 14.9004 10.037 14.9924 10.1556L15.0295 10.2084L15.0627 10.264C15.1353 10.3956 15.1715 10.5447 15.1663 10.6957C15.1602 10.8682 15.101 11.035 14.9963 11.1722C14.8917 11.3094 14.7469 11.4108 14.5823 11.4623H14.5813L12.2854 12.1742H12.2844C12.2586 12.1822 12.2352 12.197 12.2161 12.2162C12.197 12.2353 12.1821 12.2588 12.1741 12.2845L11.4631 14.5804V14.5814C11.4117 14.746 11.3102 14.8908 11.1731 14.9955C11.0358 15.1002 10.8691 15.1594 10.6965 15.1654C10.524 15.1714 10.3535 15.1235 10.2092 15.0287C10.0652 14.9339 9.95366 14.7967 9.89087 14.6361V14.6351L7.55786 8.63513L7.52173 8.5199C7.49447 8.40334 7.49257 8.28164 7.51685 8.16345C7.54967 8.00422 7.62845 7.85751 7.74341 7.74255C7.85837 7.6276 8.00507 7.54881 8.16431 7.51599ZM9.39966 1.83337C10.1379 1.83337 10.722 1.83312 11.1917 1.87146C11.6672 1.91031 12.0703 1.99093 12.4377 2.1781C13.0335 2.4817 13.518 2.96706 13.8215 3.56287C14.0086 3.9302 14.0893 4.33258 14.1282 4.80798C14.1665 5.27771 14.1663 5.86158 14.1663 6.59998V7.28455C14.1663 7.56069 13.9424 7.78455 13.6663 7.78455C13.3903 7.78437 13.1663 7.56058 13.1663 7.28455V6.59998C13.1663 5.84506 13.1664 5.30861 13.1321 4.88904C13.0983 4.47546 13.0343 4.21892 12.9309 4.01599C12.7232 3.60841 12.3912 3.27741 11.9836 3.0697C11.7807 2.96628 11.5243 2.90234 11.1106 2.86853C10.691 2.83425 10.1546 2.83337 9.39966 2.83337H6.59985C5.84493 2.83337 5.30848 2.83425 4.88892 2.86853C4.47537 2.90234 4.21879 2.96631 4.01587 3.0697C3.60849 3.27737 3.27725 3.60862 3.06958 4.01599C2.96618 4.21892 2.90222 4.47549 2.86841 4.88904C2.83413 5.30861 2.83325 5.84506 2.83325 6.59998V9.39978C2.83325 10.1547 2.83413 10.6911 2.86841 11.1107C2.90221 11.5245 2.96616 11.7808 3.06958 11.9838C3.27729 12.3913 3.60829 12.7233 4.01587 12.931C4.2188 13.0344 4.47534 13.0984 4.88892 13.1322C5.30848 13.1665 5.84493 13.1664 6.59985 13.1664H7.28442C7.56046 13.1664 7.78425 13.3904 7.78442 13.6664C7.78442 13.9425 7.56057 14.1664 7.28442 14.1664H6.59985C5.86146 14.1664 5.27758 14.1667 4.80786 14.1283C4.33245 14.0895 3.93008 14.0087 3.56274 13.8217C2.96694 13.5181 2.48158 13.0337 2.17798 12.4379C1.99081 12.0705 1.91019 11.6673 1.87134 11.1918C1.83299 10.7221 1.83325 10.138 1.83325 9.39978V6.59998C1.83325 5.86158 1.83297 5.27771 1.87134 4.80798C1.91018 4.33262 1.99095 3.93017 2.17798 3.56287C2.48158 2.96702 2.9669 2.4817 3.56274 2.1781C3.93005 1.99107 4.3325 1.9103 4.80786 1.87146C5.27758 1.83309 5.86146 1.83337 6.59985 1.83337H9.39966ZM10.6497 13.8275L11.219 11.9886C11.2751 11.8075 11.3749 11.6423 11.509 11.5082C11.643 11.3743 11.8076 11.2752 11.9885 11.2191L13.8284 10.6488L8.62622 8.62537L10.6497 13.8275Z"
        fill="currentColor"
        stroke={strokeWidth ? 'currentColor' : undefined}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 官方 `fle`：空态「换一批」的 16×16 自绘循环箭头（**不是 lucide refresh-cw**）。
 *  ⚠️ 官方是 **`fill:"currentColor"`、完全没有 stroke**；给它加 stroke 会在实心形上描边 ⇒ 又粗又糊。 */
export function OfficialRefreshSuggestionsIcon({ size = 16, className }: TablerIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className ? `size-4 shrink-0 ${className}` : 'size-4 shrink-0'}
      aria-hidden="true"
    >
      <path d="M4.7959 8.72337C4.99181 8.52574 5.30835 8.52671 5.50293 8.72568C5.69752 8.92473 5.69626 9.2466 5.50033 9.44427L4.21289 10.7429H10.5186C10.9568 10.7429 11.3764 10.5674 11.6852 10.2558C11.9939 9.94436 12.1666 9.52271 12.1667 9.08382V8.54182C12.1667 8.26135 12.3906 8.03388 12.6667 8.03388C12.9428 8.03388 13.1666 8.26135 13.1667 8.54182V9.08382C13.1666 9.79441 12.8869 10.4753 12.39 10.9767C11.8931 11.478 11.2198 11.7588 10.5186 11.7588H4.21257L5.50033 13.0577C5.69624 13.2554 5.69745 13.5769 5.50293 13.776C5.30836 13.975 4.99184 13.9763 4.7959 13.7786L2.64779 11.6113C2.55327 11.5159 2.5 11.3862 2.5 11.2508C2.50003 11.1156 2.55331 10.986 2.64779 10.8907L4.7959 8.72337ZM2.5 7.45847V6.91647C2.50002 6.20588 2.77973 5.52499 3.27669 5.02359C3.77357 4.5223 4.4469 4.24151 5.14811 4.2415H11.4541L10.1663 2.94255C9.97043 2.74489 9.96921 2.42334 10.1637 2.22429C10.3583 2.02526 10.6748 2.02403 10.8708 2.22164L13.0189 4.38899C13.1134 4.48435 13.1667 4.61412 13.1667 4.74945C13.1666 4.88471 13.1134 5.01425 13.0189 5.10957L10.8708 7.27692C10.6749 7.47455 10.3583 7.47358 10.1637 7.27461C9.96915 7.07556 9.9704 6.75369 10.1663 6.55601L11.4538 5.25739H5.14811C4.7099 5.2574 4.29026 5.43294 3.98145 5.7445C3.67277 6.05593 3.50002 6.47758 3.5 6.91647V7.45847C3.49993 7.73894 3.2761 7.96641 3 7.96641C2.7239 7.96641 2.50007 7.73894 2.5 7.45847Z" fill="currentColor" />
    </svg>
  );
}

/** 官方 `WA` = **lucide `gauge`**（用量统计，size 19 / strokeWidth 2）。 */
export function OfficialGaugeIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} lucideName="gauge">
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </TablerSvg>
  );
}

/** 官方 `sz` = **lucide `message-square-plus`**（聊天记录，size 18 / strokeWidth 2）。 */
export function OfficialHistoryIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} lucideName="message-square-plus">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M12 7v6" />
      <path d="M9 10h6" />
    </TablerSvg>
  );
}

/** 官方 `BA` = **lucide `minimize-2`**（收起对话，size 18 / strokeWidth 2）。
 *  ⚠️ 官方 lucide 工厂会**去重**但不去连字符：类串是 `lucide lucide-minimize2 lucide-minimize-2`。 */
export function OfficialCollapseChatIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} lucideName="minimize-2">
      <path d="m14 10 7-7" />
      <path d="M20 10h-6V4" />
      <path d="m3 21 7-7" />
      <path d="M4 14h6v6" />
    </TablerSvg>
  );
}

/** 官方 `tz` = tabler `arrow-narrow-right`（侧边栏收起键，size 18 / stroke 1.5）。 */
export function OfficialArrowNarrowRightIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="arrow-narrow-right">
      <path d="M5 12l14 0" />
      <path d="M15 16l4 -4" />
      <path d="M15 8l4 4" />
    </TablerSvg>
  );
}

/**
 * 官方 `j1` = **lucide `arrow-down`**（聊天消息列表右下那颗「回到底部」圆钮的唯一内容）。
 *
 * 逐字依据（`vendor-libs-CQ5RMq_I.js`，`j1` 经 `cY as j1` 导出）：
 * ```js
 * const EAa=[["path",{d:"M12 5v14",key:"s699le"}],["path",{d:"m19 12-7 7-7-7",key:"1idqje"}]]
 *    ,P$=L("arrow-down",EAa);          // P$ = j1 = lucide 工厂（不是 tabler！）
 * ```
 * 消费端（`vendor-packages-jvPqKqU8.js` 的 `KR`，导出名 `ga`）：
 * ```js
 * KR=({className:e,...t})=>{const{isAtBottom:n,scrollToBottom:s}=kg();   // kg = use-stick-to-bottom
 *   return !n&&a.jsx(pe,{className:I("absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full",e),
 *     onClick:()=>s(), size:"icon", type:"button", variant:"outline", ...t,
 *     children:a.jsx(j1,{className:"size-4"})})}
 * ```
 * ⇒ 官方按钮里**只有这颗箭头**，没有文字、没有未读数字（`size-4` = 16px，stroke 默认 2）。
 * ⚠️ MTV 原来用的是 `mdi:arrow-down` + 「最新消息」文字胶囊 —— **自造**，已删除。
 */
export function OfficialArrowDownIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} lucideName="arrow-down">
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </TablerSvg>
  );
}

/** 官方 `ZU`/`lc` = tabler `file-text` / `file`（产物列表行，size 20 / stroke 1.5）。 */
export function OfficialFileTextIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="file-text">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
      <path d="M9 9l1 0" />
      <path d="M9 13l6 0" />
      <path d="M9 17l6 0" />
    </TablerSvg>
  );
}

export function OfficialFileIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="file">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
    </TablerSvg>
  );
}

/** 官方 `yS` = tabler `markdown`。 */
export function OfficialMarkdownIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="markdown">
      <path d="M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" />
      <path d="M7 15v-6l2 2l2 -2v6" />
      <path d="M14 13l2 2l2 -2m-2 2v-6" />
    </TablerSvg>
  );
}

/** 官方 `ez` = tabler `file-type-csv`。 */
export function OfficialCsvIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="file-type-csv">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" />
      <path d="M7 16.5a1.5 1.5 0 0 0 -3 0v3a1.5 1.5 0 0 0 3 0" />
      <path d="M10 20.25c0 .414 .336 .75 .75 .75h1.25a1 1 0 0 0 1 -1v-1a1 1 0 0 0 -1 -1h-1a1 1 0 0 1 -1 -1v-1a1 1 0 0 1 1 -1h1.25a.75 .75 0 0 1 .75 .75" />
      <path d="M16 15l2 6l2 -6" />
    </TablerSvg>
  );
}

/** 官方 `bS` = tabler `file-type-html`。 */
export function OfficialHtmlIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="file-type-html">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" />
      <path d="M2 21v-6" />
      <path d="M5 15v6" />
      <path d="M2 18h3" />
      <path d="M20 15v6h2" />
      <path d="M13 21v-6l2 3l2 -3v6" />
      <path d="M7.5 15h3" />
      <path d="M9 15v6" />
    </TablerSvg>
  );
}

/** 官方 `Uu` = tabler `photo`。 */
export function OfficialPhotoIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="photo">
      <path d="M15 8h.01" />
      <path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z" />
      <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" />
      <path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />
    </TablerSvg>
  );
}

/* ── 任务卡（`TaskProgressRow` / `TodoProgressRing`）用的三颗 ──
   官方在 `page-BeI7xydN.js`@854700 一带用 `Dr`（完成）/ `An`（进行中，带 `animate-spin`）/ `O4`（待办），
   都是 tabler；这里按 tabler 官方 path 内联（名字与原符号无法从产物反解，按语义取 tabler 同名图标）。 */

/** 官方 `Dr` = tabler `circle-check`（任务完成；全完成时也用它替代进度环）。 */
export function OfficialCircleCheckIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="circle-check">
      <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
      <path d="M9 12l2 2l4 -4" />
    </TablerSvg>
  );
}

/**
 * 官方 `Fs` = tabler **`check`**（单 path `M5 12l5 5l10 -10`）—— 任务**完成**态与「全完成」
 * 进度环都画这个**光秃对勾**，**不是** `circle-check`（`Dr` 是另一个符号，用在别处）。
 */
export function OfficialTablerCheckIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="check">
      <path d="M5 12l5 5l10 -10" />
    </TablerSvg>
  );
}

/** 官方 `An` = tabler `loader-2`（任务进行中，靠外层 `animate-spin` 转）。 */
export function OfficialLoader2Icon(props: TablerIconProps) {
  return (
    /* 官方 `An` = `p("outline","loader-2",…)` ⇒ 类名必须带 `tabler-icon tabler-icon-loader-2`
       （`ToolLoadingIndicator` 的兜底分支用它；官方 `Wae` 只给 `show_form` 换图标）。 */
    <TablerSvg {...props} iconName="loader-2">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </TablerSvg>
  );
}

/** 官方 `O4` = tabler `circle`（任务待办）。 */
export function OfficialCircleIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="circle">
      <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
    </TablerSvg>
  );
}

/** 官方 `ij` = tabler `grip-vertical`（排队消息的拖拽把手）。 */
export function OfficialGripVerticalIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="grip-vertical">
      <path d="M9 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M9 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M9 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M15 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M15 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M15 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    </TablerSvg>
  );
}

/** 官方 `H4`（排队消息的「编辑」）。**图标名仍未确定，故不写 `lucideName`**。
 *  ⚠️ 旧注释写「= lucide `pen`」，与产物不符，已订正为「未确定」：
 *    · 本文件内联的是**两条** path：`M21.174 …l-13.346 13.346…` + `m15 5 4 4`；
 *    · `vendor-libs` 里 lucide **`pen`** 只有**一条** path
 *      （`L("pen", …) = [[path,{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174…"}]`）⇒ `pen` 不可能是它；
 *    · lucide **`pencil`** 有两条，其中第二条 `m15 5 4 4` 与本文件**逐字相同**，
 *      但第一条在 `vendor-libs` 里写作 `L3.842 16.174`（绝对指令），本文件是 `l-13.346 13.346`（相对指令）
 *      ⇒ 同一字形的**另一个 lucide 版本**。
 *  两个候选（`pen` / `pencil`）都无法在本地产物里唯一坐实 ⇒ 按「宁缺勿猜」不写类名。 */
export function OfficialPencilIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props}>
      <path d="M21.174 6.812a1 1 0 0 0 -3.986 -3.987l-13.346 13.346a2 2 0 0 0 -.5 .83l-1.321 4.352a.5 .5 0 0 0 .623 .622l4.353 -1.32a2 2 0 0 0 .83 -.497z" />
      <path d="m15 5 4 4" />
    </TablerSvg>
  );
}

/** 官方 `GT` = lucide `circle-alert`（agent 错误横幅的告警图标；官方 `hi as GT` → `P3=F("circle-alert",…)`）。 */
export function OfficialCircleAlertIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} lucideName="circle-alert">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </TablerSvg>
  );
}

/* ── ContextStrip 三个 chip 的**自绘** glyph（不是 tabler/lucide 库图标）──
   反解路径：`use-chat-attachment-file-input-*.js` 的 import 映射 →
   `La <= K (./use-waveform-data-*.js)` → 同文件 export `K <= J0`；`Ba <= J` → `J <= Qm`。
   两者都是 48/14 视框、`fill="currentColor"`、外层 `<g opacity>` 控透明度。 */

/** 官方 `La`（= `J0`，48 视框）：视频占位 glyph（圆角方框 + 播放三角），默认 `opacity .2`。 */
export function OfficialVideoPlaceholderIcon({
  className,
  size = 48,
  opacity = 0.2,
}: {
  className?: string;
  size?: number;
  opacity?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity={opacity}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M31.7998 3C33.727 3 35.293 2.998 36.5606 3.10157C37.8514 3.20704 39.0084 3.43147 40.0859 3.98047C41.7794 4.84333 43.1567 6.22061 44.0195 7.91407C44.5685 8.99162 44.793 10.1486 44.8984 11.4395C45.002 12.7071 45 14.273 45 16.2002V31.7998C45 33.727 45.002 35.293 44.8984 36.5606C44.793 37.8514 44.5685 39.0084 44.0195 40.0859C43.1567 41.7794 41.7794 43.1567 40.0859 44.0195C39.0084 44.5685 37.8514 44.793 36.5606 44.8984C35.293 45.002 33.727 45 31.7998 45H16.2002C14.273 45 12.7071 45.002 11.4395 44.8984C10.1486 44.793 8.99162 44.5685 7.91407 44.0195C6.22061 43.1567 4.84333 41.7794 3.98047 40.0859C3.43147 39.0084 3.20704 37.8514 3.10157 36.5606C2.998 35.293 3 33.727 3 31.7998V16.2002C3 14.273 2.998 12.7071 3.10157 11.4395C3.20704 10.1486 3.43147 8.99162 3.98047 7.91407C4.84333 6.22061 6.22061 4.84333 7.91407 3.98047C8.99162 3.43147 10.1486 3.20704 11.4395 3.10157C12.7071 2.998 14.273 3 16.2002 3H31.7998ZM16.2002 7C14.2072 7 12.8325 7.00173 11.7656 7.08887C10.7223 7.17411 10.1502 7.33114 9.73047 7.54492C8.78966 8.02429 8.02429 8.78966 7.54492 9.73047C7.33114 10.1502 7.17411 10.7223 7.08887 11.7656C7.00173 12.8325 7 14.2072 7 16.2002V31.7998C7 33.7928 7.00173 35.1675 7.08887 36.2344C7.17411 37.2777 7.33114 37.8498 7.54492 38.2695C8.02429 39.2103 8.78967 39.9757 9.73047 40.4551C10.1502 40.6689 10.7223 40.8259 11.7656 40.9111C12.8325 40.9983 14.2072 41 16.2002 41H31.7998C33.7928 41 35.1675 40.9983 36.2344 40.9111C37.2777 40.8259 37.8498 40.6689 38.2695 40.4551C39.2103 39.9757 39.9757 39.2103 40.4551 38.2695C40.6689 37.8498 40.8259 37.2777 40.9111 36.2344C40.9983 35.1675 41 33.7928 41 31.7998V16.2002C41 14.2072 40.9983 12.8325 40.9111 11.7656C40.8259 10.7223 40.6689 10.1502 40.4551 9.73047C39.9757 8.78967 39.2103 8.02429 38.2695 7.54492C37.8498 7.33114 37.2777 7.17411 36.2344 7.08887C35.1675 7.00173 33.7928 7 31.7998 7H16.2002ZM18.5762 19.5801C18.5762 17.9469 20.4979 16.9432 21.9951 17.7949L29.7647 22.2158C31.1977 23.0313 31.1977 24.9687 29.7647 25.7842L21.9951 30.2051C20.4979 31.0568 18.5762 30.0531 18.5762 28.4199V19.5801Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}

/** 官方 `Ba`（= `Qm`，14 视框）：文本占位 glyph（三横线），默认 `opacity .6`。 */
export function OfficialTextLinesIcon({
  className,
  size = 14,
  opacity = 0.6,
}: {
  className?: string;
  size?: number;
  opacity?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity={opacity}>
        <path
          d="M9.71912 10.2559C10.0412 10.2559 10.3021 10.5167 10.3021 10.8389C10.3021 11.161 10.0412 11.4218 9.71912 11.4219H2.04138C1.71938 11.4217 1.45839 11.1609 1.45837 10.8389C1.45837 10.5168 1.71937 10.256 2.04138 10.2559H9.71912ZM7.80017 6.41699C8.12211 6.41721 8.38311 6.67802 8.38318 7C8.38318 7.32203 8.12215 7.58279 7.80017 7.58301H2.04138C1.71937 7.58283 1.45837 7.32206 1.45837 7C1.45844 6.678 1.71941 6.41717 2.04138 6.41699H7.80017ZM11.9584 2.57812C12.2804 2.57812 12.5412 2.8391 12.5414 3.16113C12.5414 3.4833 12.2805 3.74512 11.9584 3.74512H2.04138C1.71937 3.74494 1.45837 3.48319 1.45837 3.16113C1.45853 2.8392 1.71946 2.5783 2.04138 2.57812H11.9584Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}

/**
 * 官方 `Gfe`（`vendor-packages-jvPqKqU8.js` 的 `hk`，@276460）—— 「列表 + 上下折叠箭头」自绘图标。
 * 逐字：`<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
 *        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">`，
 * 默认 `size = 14`，5 条 path。用于 `CompactLifecycleLine`。
 */
export function OfficialCompactIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 5h8" />
      <path d="M3 12h8" />
      <path d="M3 19h8" />
      <path d="m15 5 3 3 3-3" />
      <path d="m15 19 3-3 3 3" />
    </svg>
  );
}

/** 官方 `w7` = tabler `message`（排队消息行首的气泡图标）。 */
export function OfficialMessageIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="message">
      <path d="M8 9h8" />
      <path d="M8 13h6" />
      <path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z" />
    </TablerSvg>
  );
}

/** 官方 `Js` = tabler `video`（消息缩略行 / 附件缩略图的视频兜底图标）。 */
export function OfficialVideoIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props} iconName="video">
      <path d="M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z" />
      <path d="M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" />
    </TablerSvg>
  );
}

/** 官方 `Mr`（音频节点的缩略图兜底图标）。**图标名仍未确定，故不写 `iconName` / `lucideName`**。
 *  ⚠️ 旧注释写「= tabler `music`」，与产物不符：
 *    · 本文件内联的三条 path（`M8 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0` …）
 *      在**全部 470 个本地 bundle**（含 `vendor-libs`、`off-backup`、`t41-scan` 等）里
 *      **0 命中**（空白归一化后同样 0 命中）；
 *    · `vendor-libs` 里 tabler **`music`** 是**四条** path 的另一套坐标
 *      （`M3 17a3 3 0 0 0 -6 0` / `M13 17a3 3 0 0 0 -6 0` / `M9 17v-13h10v13` / `M9 8h10`）；
 *    · lucide `music`（`["path"…,"circle","circle"]`）也不是这个字形。
 *  ⇒ 两套官方图标库都坐实不了 ⇒ 按「宁缺勿猜」不写类名。 */
export function OfficialMusicIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props}>
      <path d="M8 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
      <path d="M17 15m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
      <path d="M8 17v-13l9 2v9" />
    </TablerSvg>
  );
}

