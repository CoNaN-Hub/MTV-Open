/**
 * 官方「form 表单族」用到的图标 —— 逐字复刻。
 *
 * ## Tabler 族（10 个）
 * 官方表单族的图标**全部是 Tabler**（`p(variant, name, displayName, paths)` 工厂产物），
 * 不是 lucide。工厂原文（`vendor-libs-CQ5RMq_I.js` @1529600 邻域，逐字）：
 * ```js
 * const p = (t, e, n, a) => { const r = N.forwardRef(({color:i="currentColor", size:o=24, stroke:s=2,
 *   title:l, className:c, children:d, ...u}, h) => N.createElement("svg", { ref:h, ...z2r[t],
 *   width:o, height:o, className:["tabler-icon", `tabler-icon-${e}`, c].join(" "),
 *   ...(t==="filled" ? {fill:i} : {strokeWidth:s, stroke:i}), ...u },
 *   [l && …, ...a.map(([f,g]) => N.createElement(f,g)), ...(Array.isArray(d)?d:[d])]));
 *   return r.displayName = `${n}`, r };
 * var z2r = {
 *   outline: {xmlns:"http://www.w3.org/2000/svg", width:24, height:24, viewBox:"0 0 24 24",
 *             fill:"none", stroke:"currentColor", strokeWidth:2, strokeLinecap:"round", strokeLinejoin:"round"},
 *   filled:  {xmlns:"http://www.w3.org/2000/svg", width:24, height:24, viewBox:"0 0 24 24",
 *             fill:"currentColor", stroke:"none"}
 * };
 * ```
 * ⇒ 每个图标都带 `tabler-icon tabler-icon-<name>` 两个类，`size` 同时给 width/height，
 *   `stroke` 只对 outline 生效（映射成 strokeWidth），`color` 映射成 `stroke`（outline）
 *   或 `fill`（filled）。
 *
 * ## 三步符号解析对照（本文件逐个核过）
 * | 主 chunk 压缩名 | import 子句 | 源 chunk | 真名 | 定义偏移 | 身份 |
 * |---|---|---|---|---|---|
 * | `Fs` | `dk as Fs` | vendor-libs | `vTt` | 1959455 | Tabler outline/check |
 * | `su` | `gi as su` | vendor-libs | `z4n` | 2774479 | Tabler outline/photo |
 * | `$l` | `iV as $l` | vendor-libs | `dXn` | 3703250 | Tabler **filled** variant / `star-filled` |
 * | `ru` | `iU as ru` | vendor-libs | `Hwn` | 3015286 | Tabler outline/star |
 * | `j9` | `gr as j9` | vendor-libs | `Lun` | 2637174 | Tabler outline/minus |
 * | `$r` | `gd as $r` | vendor-libs | `vyn` | 2798992 | Tabler outline/plus |
 * | `i$` | `kE as i$` | vendor-libs | `nLt` | 2035961 | Tabler outline/clipboard-list |
 * | `Fp` | `ha as Fp` | vendor-libs | `avn` | 2743576 | Tabler outline/pencil |
 * | `due` | `kF as due` | vendor-libs | `EEt` | 1908050 | Tabler outline/calendar |
 * | `hue` | `kO as hue` | vendor-libs | `OXt` | 2351276 | Tabler outline/forms |
 *
 * ## Radix 族（2 个，shadcn 包装内部使用）
 * | 主 chunk 压缩名 | 链路 | 身份 |
 * |---|---|---|
 * | `U1`（Checkbox 指示器 / SelectItem 勾） | `U1` ← vendor-packages `dV` ← vendor-libs `Lks`（@4118668） | **radix-icons CheckIcon**（15×15、`fillRule/clipRule=evenodd`、`fill` 取 `color`） |
 * | `p5`（SelectTrigger 箭头） | `p5` ← vendor-packages `er` ← vendor-libs `Pks`（@4119359） | **radix-icons ChevronDownIcon**（15×15） |
 */

type TablerIconProps = {
  size?: number;
  /** 官方 prop 名就是 `stroke`（不是 strokeWidth），只对 outline 变体生效。 */
  stroke?: number;
  color?: string;
  className?: string;
  title?: string;
};

/** 官方 `z2r.outline`。 */
function TablerOutline({
  iconName,
  size = 24,
  stroke = 2,
  color = 'currentColor',
  className,
  title,
  paths,
}: TablerIconProps & { iconName: string; paths: readonly string[] }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={['tabler-icon', `tabler-icon-${iconName}`, className].join(' ')}
      aria-hidden="true"
    >
      {title ? <title>{title}</title> : null}
      {paths.map((d, index) => (
        <path key={`svg-${index}`} d={d} />
      ))}
    </svg>
  );
}

/** 官方 `z2r.filled`：`fill = color`、`stroke = none`、无 strokeWidth。 */
function TablerFilled({
  iconName,
  size = 24,
  color = 'currentColor',
  className,
  title,
  paths,
}: TablerIconProps & { iconName: string; paths: readonly string[] }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      stroke="none"
      className={['tabler-icon', `tabler-icon-${iconName}`, className].join(' ')}
      aria-hidden="true"
    >
      {title ? <title>{title}</title> : null}
      {paths.map((d, index) => (
        <path key={`svg-${index}`} d={d} />
      ))}
    </svg>
  );
}

/** 官方 `Fs` = Tabler `outline/check`（`Xxr` @1959402）。 */
export function IconCheck(props: TablerIconProps) {
  return <TablerOutline iconName="check" paths={['M5 12l5 5l10 -10']} {...props} />;
}

/** 官方 `su` = Tabler `outline/photo`（`Jvi` @2774187）。 */
export function IconPhoto(props: TablerIconProps) {
  return (
    <TablerOutline
      iconName="photo"
      paths={[
        'M15 8h.01',
        'M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z',
        'M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5',
        'M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3',
      ]}
      {...props}
    />
  );
}

/** 官方 `$l` = Tabler **filled** `star-filled`（`GKi` @3702943）。 */
export function IconStarFilled(props: TablerIconProps) {
  return (
    <TablerFilled
      iconName="star-filled"
      paths={[
        'M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z',
      ]}
      {...props}
    />
  );
}

/** 官方 `ru` = Tabler `outline/star`（`kwi` @3015144）。 */
export function IconStar(props: TablerIconProps) {
  return (
    <TablerOutline
      iconName="star"
      paths={[
        'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z',
      ]}
      {...props}
    />
  );
}

/** 官方 `j9` = Tabler `outline/minus`（`qdi` @2637127）。 */
export function IconMinus(props: TablerIconProps) {
  return <TablerOutline iconName="minus" paths={['M5 12l14 0']} {...props} />;
}

/** 官方 `$r` = Tabler `outline/plus`（`Smi` @2798907）。 */
export function IconPlus(props: TablerIconProps) {
  return <TablerOutline iconName="plus" paths={['M12 5l0 14', 'M5 12l14 0']} {...props} />;
}

/** 官方 `i$` = Tabler `outline/clipboard-list`（`WDr` @2035586）。 */
export function IconClipboardList(props: TablerIconProps) {
  return (
    <TablerOutline
      iconName="clipboard-list"
      paths={[
        'M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2',
        'M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z',
        'M9 12l.01 0',
        'M13 12l2 0',
        'M9 16l.01 0',
        'M13 16l2 0',
      ]}
      {...props}
    />
  );
}

/** 官方 `Fp` = Tabler `outline/pencil`（`v3i` @2743443）。 */
export function IconPencil(props: TablerIconProps) {
  return (
    <TablerOutline
      iconName="pencil"
      paths={['M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4', 'M13.5 6.5l4 4']}
      {...props}
    />
  );
}

/** 官方 `due` = Tabler `outline/calendar`（`lCr` @1907757）。 */
export function IconCalendar(props: TablerIconProps) {
  return (
    <TablerOutline
      iconName="calendar"
      paths={[
        'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z',
        'M16 3v4',
        'M8 3v4',
        'M4 11h16',
        'M11 15h1',
        'M12 15v3',
      ]}
      {...props}
    />
  );
}

/** 官方 `hue` = Tabler `outline/forms`（`RKr` @2350925）。`show_form` 工具的专属图标。 */
export function IconForms(props: TablerIconProps) {
  return (
    <TablerOutline
      iconName="forms"
      paths={[
        'M12 3a3 3 0 0 0 -3 3v12a3 3 0 0 0 3 3',
        'M6 3a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3',
        'M13 7h7a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-7',
        'M5 7h-1a1 1 0 0 0 -1 1v8a1 1 0 0 0 1 1h1',
        'M17 12h.01',
        'M13 12h.01',
      ]}
      {...props}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// radix-icons（shadcn 包装内部用）
// ─────────────────────────────────────────────────────────────────────────────

/** radix-icons 图标的公共外壳：15×15、单条 `path`、`fill` 取 `color`（默认 `currentColor`）。 */
function RadixIcon({
  path,
  color = 'currentColor',
  className,
}: {
  path: string;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d={path} fill={color} fillRule="evenodd" clipRule="evenodd" />
    </svg>
  );
}

/** 官方 `U1` = radix-icons `CheckIcon`（`Lks` @4118668）。Checkbox 指示器与 SelectItem 共用。 */
export function RadixCheckIcon({ color, className }: { color?: string; className?: string }) {
  return (
    <RadixIcon
      className={className}
      color={color}
      path="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
    />
  );
}

/** 官方 `p5` = radix-icons `ChevronDownIcon`（`Pks` @4119359）。SelectTrigger 的箭头。 */
export function RadixChevronDownIcon({ color, className }: { color?: string; className?: string }) {
  return (
    <RadixIcon
      className={className}
      color={color}
      path="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z"
    />
  );
}
