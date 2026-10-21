/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /* ★★ 官方 shadcn 的**默认边框色**：裸 `border` 类只给宽度，颜色取
         `borderColor.DEFAULT`。官方 config 把它设成 `hsl(var(--border))`；
         MTV 没设 ⇒ 落到 Tailwind v3 默认的 `gray.200` = `#e5e7eb`（实测色点边框就是这个亮灰 ✗）。
         这里按官方补上 `var(--border)`（= `#ffffff1a`）。
         同时也补上输入框用的 `input` 别名（官方 `border-input`）。 */
      /* ★ 官方 shadcn 的 `Collapsible` 折叠动画（`index-Wfwg-qNM.css`@668072 逐字）：
           `@keyframes collapsible-down{0%{height:0} to{height:var(--radix-collapsible-content-height,...)}}`
           `@keyframes collapsible-up  {0%{height:var(--radix-collapsible-content-height,...)} to{height:0}}`
         官方类名 `data-[state=open]:animate-collapsible-down` / `data-[state=closed]:animate-collapsible-up`
         用在任务历史卡（`Nde`）与思维步骤折叠（`vS`）上；`tailwindcss-animate` **不提供**这两个，
         必须在这里补，否则折叠是「瞬间跳变」（没有高度过渡）。 */
      keyframes: {
        'collapsible-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-collapsible-content-height)' },
        },
        'collapsible-up': {
          from: { height: 'var(--radix-collapsible-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'collapsible-down': 'collapsible-down 0.2s ease-out',
        'collapsible-up': 'collapsible-up 0.2s ease-out',
      },
      borderColor: {
        DEFAULT: 'var(--border)',
        input: 'var(--input)',
      },
      /* ★ 官方「Tapies 用量」热力图每列用 `grid-rows-7`（7 天/列）。
         Tailwind v3 默认 `gridTemplateRows` 只有 1–6，`grid-rows-7` **产不出任何 CSS**
         ⇒ 列高塌成 0、热力图整块不可见。官方类名逐字保留（`UsageDashboard.tsx` 热力图列），
         这里补上第 7 行刻度（官方 = Tailwind v4 默认值 `repeat(7, minmax(0,1fr))`）。 */
      gridTemplateRows: {
        7: 'repeat(7, minmax(0, 1fr))',
      },
      /* ★★ 官方字体栈（官方 `index-*.css` 实测值，与 `styles/base.css` @871-884 的 html/body 声明逐字相同）★★
         ⚠️ Tailwind v3 **没配** `fontFamily` 时，`font-sans` 产出的是 v3 默认栈
            `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", …`；
         而 **`.app-shell` 上挂了 `font-sans`**（`styles/` 内联类）⇒ 整个 app-shell 子树
         （画布 / 聊天 / 各面板）都被换成那条栈，**盖掉了 html/body 上的官方栈**。
         真机实测（CDP `CSS.getPlatformFontsForNode`，同一台机器、同一串中文）：
           · 官方 = `Noto Sans SC Thin`（`NotoSansSC`，系统字体）
           · MTV（修前）= `Microsoft YaHei UI`（`MicrosoftYaHeiUI`）
         同字号下墨迹像素数差 ~26% ⇒ 用户看到的就是「字形/粗细不一样」。
         这里把 `sans` 设成官方栈 ⇒ preflight 的 `html` 默认与 `font-sans` **两处都产出官方栈**，不再互相打架。
         ⚠️ 栈里**绝不能出现任何中文字体**（官方也没有），否则会命中自己 bundle 的字重 —— 见 `base.css` @842-862。 */
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      /* ★ 圆角刻度对齐官方 ★
         官方是 Tailwind v4 + `.dark{--radius:.75rem}`（官方 index-*.css 实测，且用浏览器引擎验证过：
         把官方 CSS 载进 iframe 读计算值 ⇒ --radius=.75rem、rounded-md=10px、rounded-sm=8px）。
         而 MTV 是 Tailwind v3，默认刻度是 sm 2px / md 6px / lg 8px / xl 12px ⇒ 凡是照官方类名写的组件
         （official 源码里就是 rounded-md / rounded-sm / rounded-lg …）圆角都会**小一圈**。
         这里把同名类直接钉到官方 px 值（v4 的换算是 calc）：
           rounded-xs   = --radius-xs            = 2px
           rounded-sm   = calc(--radius − 4px)   = 8px
           rounded-md   = calc(--radius − 2px)   = 10px
           rounded-lg   = var(--radius)          = 12px
           rounded-xl   = calc(--radius + 4px)   = 16px
           rounded-2xl  = --radius-2xl (1rem)    = 16px
           rounded-3xl  = --radius-3xl (1.5rem)  = 24px
         裸 `rounded` / `rounded-t` 等：官方 v4 没有这种写法（v4 里它对应的槽位是 rounded-sm）⇒ 取 8px。 */
      borderRadius: {
        none: '0px',
        xs: '2px',
        sm: '8px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '16px',
        '3xl': '24px',
        full: '9999px',
      },
      /* ★ 官方 v4 的 `--blur-xs:4px`（`index-Wfwg-qNM.css` 逐字）：v3 的模糊刻度从 `sm` 起，
         没有 `xs` ⇒ 官方那批 `backdrop-blur-xs`（如聊天内媒体卡的画布动作胶囊 `g1`）**不会生成**。
         这里按官方值补上 `xs`（同时补 `blur.xs` 以保持一致）。 */
      blur: { xs: '4px' },
      backdropBlur: { xs: '4px' },
      cursor: {        'default': 'var(--cursor-default, default)',
        'pointer': 'var(--cursor-pointer, pointer)',
        'text': 'var(--cursor-text, text)',
        'not-allowed': 'var(--cursor-not-allowed, not-allowed)',
        'move': 'var(--cursor-move, move)',
        'crosshair': 'var(--cursor-crosshair, crosshair)',
        'ew-resize': 'var(--cursor-ew-resize, ew-resize)',
        'ns-resize': 'var(--cursor-ns-resize, ns-resize)',
        'nwse-resize': 'var(--cursor-nwse-resize, nwse-resize)',
        'nesw-resize': 'var(--cursor-nesw-resize, nesw-resize)',
        'help': 'var(--cursor-help, help)',
      },
      colors: {
        /* ══════════════════════════════════════════════════════════════════════
           ★★★★ **官方 shadcn 色键**（`index-DV4al4p1.css` 的 dark 变量表**逐字**）✗✓
           ⚠️⚠️ 这是「照抄官方类名却全都没效果」的**总根因**：
             官方源码里到处是 `bg-card-foreground` / `hover:bg-accent` / `bg-primary-border` /
             `ring-ring` / `bg-popover` / `border-input` / `text-muted-foreground` …
             这些类**都由这组色键生成**；MTV 的 config 里**一个都没有**（只有自造的
             `canvas-*` / `node-*` / `brand` 等）⇒ 那些官方类名**从来没被 Tailwind 生成过**，
             全是惰性 class（等于没写）——所以：
               · 色点 `bg-card-foreground` 无效 ⇒ 透明（只剩 1px 边框 = 「空心圈」）
               · `hover:bg-accent` 无效 ⇒ 没有任何悬浮底
               · `bg-primary-border` 无效 ⇒ **分割线不可见**
               · `focus-visible:ring-ring` 无效 ⇒ **没有焦点环**
             之前补 CSS 变量没用，因为类名压根没生成 ⇒ **必须在这里补色键**。
           取值 = 官方 dark 表原文（`--background:#0f0f0f` · `--foreground:#f5f5f5` ·
             `--card:#1f1f1f` · `--card-foreground:#fafafa` · `--popover:#262626` ·
             `--popover-foreground:#ccc` · `--primary:#1fa2dc` · `--primary-foreground:#fafafa` ·
             `--secondary:#222` · `--secondary-foreground:#f0f0f0` · `--muted:#2b2b2b` ·
             `--muted-foreground:#7a7a7a` · `--accent:#404040` · `--accent-foreground:#fafafa` ·
             `--destructive:#934c4c` · `--destructive-foreground:#ff6163` ·
             `--border:#ffffff1a` · `--input:#ffffff26` · `--ring:#7373731a`）
           `--primary-border` = 官方 `var(--color-zinc-600)` = oklch(44.2% 0.017 285.786)。
           ══════════════════════════════════════════════════════════════════════ */
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        /* 官方 chat 专属色（`index-CF4eb3PV.css` dark 表逐字）：
           `.bg-chat-background{background-color:var(--chat-background)}` 等。
           ⚠️ 之前 config 里没有这三个键 ⇒ 官方类名（`bg-chat-background` /
              `text-chat-foreground` / `ring-chat-background`）**一个都不生成**
              ⇒ 助手面板、侧边栏、输入卡整块透明，露出下面的黑色画布。 */
        'chat-background': 'var(--chat-background)',
        'chat-foreground': 'var(--chat-foreground)',
        'chat-bubble-surface': 'var(--chat-bubble-surface)',
        'chat-bubble-header': 'var(--chat-bubble-header)',
        /* 官方 `--surface-secondary:#1f1f1f`（`bg-surface-secondary` 用在产物面板的文字按钮上） */
        'surface-secondary': 'var(--surface-secondary)',
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        popover: { DEFAULT: 'var(--popover)', foreground: 'var(--popover-foreground)' },
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
        /* 官方 `--accent-primary:#90c4e5`（dark 表）：思考档位滑杆的激活态与开关键选中态。
           官方类名 `bg-accent-primary` / `bg-accent-primary/12` / `text-accent-primary` 由本键生成。 */
        'accent-primary': 'var(--accent-primary)',
        'secondary-muted-foreground': 'var(--secondary-muted-foreground)',
        destructive: { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)' },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        'primary-border': 'var(--primary-border)',
        /* 官方语义文本三级（`--text-text-primary/secondary/tertiary`，取值见 base.css）：
           官方类名 `text-text-text-primary` 由本键生成（缺本键则类名惰性）。 */
        'text-text-primary': 'var(--text-text-primary)',
        'text-text-secondary': 'var(--text-text-secondary)',
        'text-text-tertiary': 'var(--text-text-tertiary)',
        /* 官方 app 级 `--tap-text-*` 令牌。目前只用到 **2 号**：
           「当前视窗没有节点」胶囊的说明文字 `text-tap-text-2`（官方 `fwt` @3561813）。
           ⚠️ 官方产物里 `bg-tap-background-primary` / `border-tap-border-primary` 是**死类**
              （6 份 CSS 0 命中 + 真机令牌为空）⇒ **不要**在这里补这两个键，
              否则就把官方「没有规则」的行为改掉了。 */
        'tap-text-2': 'var(--tap-text-2)',
        /* Theme layer
           ⚠️ MTV 的 `canvas-*` 色键族（`#000000` / `#14141c` / `#1a1a26` / `#2a2a3a` / `#252535`
           / `#e8e8ed` / `#8888a0` / `#7d7d91`）**已删除（2026 round 96）**。
           原因：这是 MTV 自绘的第二套调色板，`#14141c`/`#1a1a26`/`#2a2a3a`/`#252535`/`#8888a0`
           /`#7d7d91` 的蓝通道普遍比红通道高 ⇒ 整块 UI 泛蓝紫；而官方 `:root`
           （`D:\DEEPSEEK\_official-css\index-BroFpZiQ.css` @738536 逐字）里**没有任何偏紫的灰，
           全是中性灰**。用户裁决全局移除（加载屏那道 `#8888a0` 弧就是现场证据）。
           使用点已全部改成官方令牌，映射口径见 `tests/styles/canvasTokensRemoved.test.ts` 顶部注释：
             页面底/覆盖层底 → `background`(#0f0f0f)（画布内部底另有官方 `--background-canvas` #0a0a0a）
             卡面/浮层     → `card`(#1f1f1f)
             面/次级面     → `secondary`(#222) · `chat-background`(#141414) · `surface-secondary`(#1f1f1f)
             hover/选中底  → `accent`(#404040) 或 `muted`(#2b2b2b)
             描边          → `border`(#ffffff1a)
             正文/次级/弱化 → `foreground`(#f5f5f5) · `text-text-secondary`(#9c9c9c) · `text-text-tertiary`(#737373)
             助手面板专属   → `chat-foreground` · `chat-bubble-header` · `chat-background`
           回归：`tests/styles/canvasTokensRemoved.test.ts`。 */

        /* Brand 色键已移除（2026 round 94）—— MTV 的 `#6366f1` 靛蓝一族全部清掉。
           强调色一律走上面的官方 shadcn 色键：`primary`(#1fa2dc) / `accent-primary`(#90c4e5)
           / `accent` / `border` / `input` / `ring` 与官方中性白透明度。 */

        /* Node type colors
           ⚠️ 首档（文本）原为 MTV 品牌靛蓝 `#6366f1` / `#818cf8`，2026 round 95 改用官方令牌
            逐字值 `--primary`(#1fa2dc) / `--accent-primary`(#90c4e5)，与 `base.css` 的
            `--node-text` / `--node-text-light` 同步。官方无 `node-text` 概念，见 round 95 报告。
           ★ round 103：**其余 4 族（image / video / audio / panorama）的硬编码 MTV 裸 hex 全部去掉**，
            一律改为引用 `base.css` 里同名 CSS 令牌 —— 那个令牌的暗色值已落官方 Tailwind 调色板令牌
            （`--color-green-500` / `--color-blue-500` / …，见 base.css 的 round 103 注释）。
            ⇒ 本文件里**不再有任何 MTV 自有颜色的字面值**，且浅色马卡龙（`[data-theme='light']`
            里的 `--node-*`）也能正确生效（原来写死 hex ⇒ 浅色下这两个类不吃马卡龙，是既存缺陷）。
            ⚠️ 这些键**没有删除**（任务书原文是「删除」）：`bg-node-image/15` / `text-node-image-light` /
            `ring-node-image/25` 等类名在 `ProjectSettingsPopover.tsx` 等处**真实在用**，
            删键 ⇒ 类名不再生成 ⇒ 选中态样式直接消失。改为「键 → var()」既去掉字面值又不破坏类名。 */
        'node-text': 'var(--node-text)',
        'node-text-light': 'var(--node-text-light)',
        'node-image': 'var(--node-image)',
        'node-image-light': 'var(--node-image-light)',
        'node-video': 'var(--node-video)',
        'node-video-light': 'var(--node-video-light)',
        'node-audio': 'var(--node-audio)',
        'node-audio-light': 'var(--node-audio-light)',
        'node-panorama': 'var(--node-panorama)',
        'node-panorama-light': 'var(--node-panorama-light)',

        /* Semantic
           ★ round 103：同样去掉 MTV 裸 hex，改为引用 `base.css` 同名 CSS 令牌
            （其暗色值已落官方 `--destructive` / `--destructive-foreground` /
             `--accent-accent-success` / `--tap-state-*`，见 base.css round 103 注释）。 */
        'success': 'var(--success)',
        'success-light': 'var(--success-light)',
        'success-text': 'var(--success-text)',
        'danger': 'var(--danger)',
        'danger-light': 'var(--danger-light)',
        'danger-pale': 'var(--danger-pale)',
        'info': 'var(--info)',
        'info-light': 'var(--info-light)',
        'warning': 'var(--warning)',
        'warning-light': 'var(--warning-light)',

        /* Border variants
           ★ round 103：`rgba(255,255,255,0.06)` 是官方刻度值（保留），但改成引用 CSS 令牌
            以便浅色段（`[data-theme='light']` 里的 `--border-subtle`）能生效。
            `--border-secondary` 本身不在本轮族清单里，这里只去掉重复字面值、不改值。 */
        'border-subtle': 'var(--border-subtle)',
        'border-secondary': 'var(--border-secondary)',

        /* Scrollbar
           ★ round 103：原来两个偏蓝紫值（`#3a3a50` / `#555570`）改为引用 CSS 令牌，
           令牌的暗色值已落官方刻度（见 base.css round 103 注释）。 */
        'scrollbar-thumb': 'var(--scrollbar-thumb)',
        'scrollbar-thumb-hover': 'var(--scrollbar-thumb-hover)',

        /* Stock Tailwind accent families, aliased to CSS variables so the light
           (macaron) theme re-tints every `text-red-400` / `bg-emerald-500/10` style
           utility from one place. Dark values equal the stock Tailwind hexes, so the
           dark theme renders exactly as before. Scales live in src/styles/base.css.
           Only the shades the app actually uses are declared — adding a new shade to
           markup means adding it here and in both theme blocks. */
        /* 'indigo' 色键已删除（2026 round 95，loop 95）—— MTV 的靛蓝 `#6366f1`/`#818cf8`/`#a5b4fc`
        就是 `--brand` 一族同色值，用户裁决「画布统计色板保留，其他全部移除」。
        强调色一律走上面的官方 shadcn 色键：`primary`(#1fa2dc) / `accent-primary`(#90c4e5)
        / `accent` / `border` / `input` / `ring` 与官方中性白透明度。 */
        'purple': {
          '400': 'rgb(var(--tw-purple-400) / <alpha-value>)',
          '500': 'rgb(var(--tw-purple-500) / <alpha-value>)',
          '600': 'rgb(var(--tw-purple-600) / <alpha-value>)',
        },
        'violet': {
          '300': 'rgb(var(--tw-violet-300) / <alpha-value>)',
          '400': 'rgb(var(--tw-violet-400) / <alpha-value>)',
          '500': 'rgb(var(--tw-violet-500) / <alpha-value>)',
          '600': 'rgb(var(--tw-violet-600) / <alpha-value>)',
        },
        'fuchsia': {
          '400': 'rgb(var(--tw-fuchsia-400) / <alpha-value>)',
          '500': 'rgb(var(--tw-fuchsia-500) / <alpha-value>)',
          '600': 'rgb(var(--tw-fuchsia-600) / <alpha-value>)',
        },
        'pink': {
          '400': 'rgb(var(--tw-pink-400) / <alpha-value>)',
          '500': 'rgb(var(--tw-pink-500) / <alpha-value>)',
        },
        'red': {
          '200': 'rgb(var(--tw-red-200) / <alpha-value>)',
          '300': 'rgb(var(--tw-red-300) / <alpha-value>)',
          '400': 'rgb(var(--tw-red-400) / <alpha-value>)',
          '500': 'rgb(var(--tw-red-500) / <alpha-value>)',
        },
        'amber': {
          '200': 'rgb(var(--tw-amber-200) / <alpha-value>)',
          '300': 'rgb(var(--tw-amber-300) / <alpha-value>)',
          '400': 'rgb(var(--tw-amber-400) / <alpha-value>)',
          '500': 'rgb(var(--tw-amber-500) / <alpha-value>)',
        },
        'yellow': {
          '400': 'rgb(var(--tw-yellow-400) / <alpha-value>)',
          '500': 'rgb(var(--tw-yellow-500) / <alpha-value>)',
        },
        'emerald': {
          '100': 'rgb(var(--tw-emerald-100) / <alpha-value>)',
          '200': 'rgb(var(--tw-emerald-200) / <alpha-value>)',
          '300': 'rgb(var(--tw-emerald-300) / <alpha-value>)',
          '400': 'rgb(var(--tw-emerald-400) / <alpha-value>)',
          '500': 'rgb(var(--tw-emerald-500) / <alpha-value>)',
        },
        'green': {
          '300': 'rgb(var(--tw-green-300) / <alpha-value>)',
          '400': 'rgb(var(--tw-green-400) / <alpha-value>)',
          '500': 'rgb(var(--tw-green-500) / <alpha-value>)',
        },
        'blue': {
          '400': 'rgb(var(--tw-blue-400) / <alpha-value>)',
          '500': 'rgb(var(--tw-blue-500) / <alpha-value>)',
        },
        'sky': {
          '100': 'rgb(var(--tw-sky-100) / <alpha-value>)',
          '200': 'rgb(var(--tw-sky-200) / <alpha-value>)',
          '300': 'rgb(var(--tw-sky-300) / <alpha-value>)',
          '400': 'rgb(var(--tw-sky-400) / <alpha-value>)',
        },
        'orange': {
          '400': 'rgb(var(--tw-orange-400) / <alpha-value>)',
          '500': 'rgb(var(--tw-orange-500) / <alpha-value>)',
        },
        'cyan': {
          '400': 'rgb(var(--tw-cyan-400) / <alpha-value>)',
          '500': 'rgb(var(--tw-cyan-500) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [
    /* 官方产物里大量使用容器查询变体（`@[480px]:visible` 等，见 `index-CF4eb3PV.css` 的
       `.\\@\\[480px\\]\\:visible` 一族）——那是 `@tailwindcss/container-queries` 插件生成的。
       ⚠️ 之前 MTV 没装这个插件 ⇒ 源码里所有 `@[Npx]:` 变体都是**惰性**的（`container-type` 拿不到值），
       而 `@container` 工具类也根本不生成。官方输入卡宽/窄双占位就是靠它切换的。 */
    require('@tailwindcss/container-queries'),
    /* 官方消息滚动区用的是 `scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border
       hover:scrollbar-thumb-muted-foreground scrollbar-thumb-rounded`（`hce`）——
       这些类由 `tailwind-scrollbar` 提供，MTV 之前同样没装 ⇒ 那批类名一个都不生成。 */
    require('tailwind-scrollbar'),
    /* 官方 tooltip 内容（`index-BsHyQ2qj.js`@2488776 的 `v9e`）用了
       `animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out … data-[side=*]:slide-in-from-*`，
       这批类名由 `tailwindcss-animate` 生成；MTV 之前同样没装。 */
    require('tailwindcss-animate'),
    /* ★★★ 补上「纯 `var()` 色键 + 透明度修饰符」的类名（本项目反复踩到的总根因 bug 类）★★★
       Tailwind v3 只有在颜色写成 `rgb(var(--x) / <alpha-value>)` 时才会生成透明度变体；
       而 MTV 的 shadcn 色键（`background`/`foreground`/`muted`/`chat-*`/`text-text-primary`/…）**全是纯 `var()`**
       ⇒ 官方源码里那批 `text-muted-foreground/60`、`border-border/40`、`bg-foreground/25`… **一个都不会生成**
       （惰性 class = 等于没写；父级颜色继承下来，肉眼看不出「少了一点透明」）。
       曾被这个坑咬过的地方：输入卡整体透明、时间戳颜色不对、色点空心圈、`.c-body` 透明…
       这里用插件把**源码里真实用到的**组合逐条补出来（`color-mix` 与官方 v4 的算法一致）。
       仅扫描 `(bg|text|border|fill|stroke|placeholder|divide)-<var 色键>/<数字>`；渐变 `from-*`/`to-*`/`via-*`
       语义不同（要改 `--tw-gradient-*`），已在组件侧改用显式 `color-mix` 任意值。 */
    function ({ addUtilities, theme }) {
      const PROPERTY = {
        bg: 'background-color',
        text: 'color',
        border: 'border-color',
        fill: 'fill',
        stroke: 'stroke',
        divide: 'border-color',
        placeholder: 'color',
        /* `ring-*` 官方（shadcn）写的是 `--tw-ring-color`，不是 `outline-color` */
        ring: '--tw-ring-color',
      };
      const varColors = new Map();
      const walk = (node, prefix) => {
        for (const [key, value] of Object.entries(node)) {
          if (typeof value === 'string' && value.trim().startsWith('var(')) {
            const name = prefix ? (key === 'DEFAULT' ? prefix : `${prefix}-${key}`) : key;
            varColors.set(name, value.trim().slice(4, -1).trim());
          } else if (value && typeof value === 'object') {
            walk(value, prefix ? `${prefix}-${key}` : key);
          }
        }
      };
      walk(theme('colors') ?? {}, '');

      const fs = require('node:fs');
      const path = require('node:path');
      const roots = ['src'];
      const files = [];
      const collect = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) collect(p);
          else if (/\.(ts|tsx)$/.test(entry.name)) files.push(p);
        }
      };
      for (const root of roots) if (fs.existsSync(root)) collect(root);

      /* 两种写法都要认：`prefix-key/60`（数字档）与 `prefix-key/[0.12]` / `prefix-key/[12%]`（任意值） */
      const PREFIXES = Object.keys(PROPERTY).join('|');
      const patternScalar = new RegExp(`\\b(${PREFIXES})-([a-z0-9-]+?)/(\\d{1,3})\\b`, 'g');
      const patternArbitrary = new RegExp(`\\b(${PREFIXES})-([a-z0-9-]+?)/\\[(\\d*\\.?\\d+)(%?)\\]`, 'g');
      const utilities = {};
      const register = (prefix, key, alphaPercent, arbitrary) => {
        const cssVar = varColors.get(key);
        if (!cssVar) return;
        const selector = arbitrary
          ? `.${prefix}-${key}\\/\\[${String(alphaPercent).replace('.', '\\.')}%\\]`
          : `.${prefix}-${key}\\/${alphaPercent}`;
        if (utilities[selector]) return;
        utilities[selector] = {
          [PROPERTY[prefix]]:
            alphaPercent >= 100
              ? `var(${cssVar})`
              : `color-mix(in oklab, var(${cssVar}) ${alphaPercent}%, transparent)`,
        };
      };
      for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        let match;
        patternScalar.lastIndex = 0;
        while ((match = patternScalar.exec(text)) !== null) {
          register(match[1], match[2], Number(match[3]), false);
        }
        patternArbitrary.lastIndex = 0;
        while ((match = patternArbitrary.exec(text)) !== null) {
          const raw = Number(match[3]);
          const percent = match[4] === '%' ? raw : raw * 100;
          const normalized = `${percent}`;
          /* ⚠️ **必须**和 `register` 一样先查表：本插件只负责「**纯 `var()` 色键**」的透明度修饰符。
             像 `border-white/[0.07]` 这种**默认调色板色**（`white` 不在 `varColors` 里），
             `varColors.get('white')` 是 `undefined` ⇒ 原来会写出
             `color-mix(in oklab, var(undefined) 7%, transparent)`：
               ① 浏览器视为无效声明 ⇒ 那条 `border-white/[0.07]` **从来没生效过**；
               ② 构建时 `vite build` 的 lightningcss minify **直接抛错**
                  （`Unexpected token Ident("undefined")`）＝ **整个前端构建不出来**。
             跳过它们，交给 Tailwind 自己的生成器 ⇒ 输出 `rgb(255 255 255 / 0.07)`（真正生效）。 */
          const cssVar = varColors.get(match[2]);
          if (!cssVar) continue;
          register(match[1], match[2], percent, true);
          /* 选择器里保留源码原始写法（`[0.12]` 或 `[12%]`） */
          const original = `${match[3]}${match[4]}`;
          const selector = `.${match[1]}-${match[2]}\\/\\[${original.replace('.', '\\.')}\\]`;
          utilities[selector] = {
            [PROPERTY[match[1]]]: `color-mix(in oklab, var(${cssVar}) ${normalized}%, transparent)`,
          };
        }
      }
      /* placeholder 需要伪元素选择器；`[0.06]` 这种选择器里的 `[` `]` 不能被误判 */
      for (const selector of Object.keys(utilities)) {
        if (!selector.startsWith('.placeholder-')) continue;
        utilities[`${selector}::placeholder`] = utilities[selector];
        delete utilities[selector];
      }

      /* ★ 另补一类：官方大量使用的 `ease-[cubic-bezier(a,b,c,d)]`。
         Tailwind v3 视其为**歧义**类（`ease-` 可能指 timing-function 也可能指 duration）⇒ 一个都不生成
         （构建时会打 "is ambiguous and matches multiple utilities" 警告），于是官方的缓动**全部退化成默认值**。
         这里按源码里真实出现的 cubic-bezier 逐条补 `transition-timing-function`。 */
      const easePattern = /ease-\[cubic-bezier\(([\d.,\s-]+)\)\]/g;
      for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        let match;
        easePattern.lastIndex = 0;
        while ((match = easePattern.exec(text)) !== null) {
          const args = match[1].split(',').map((n) => n.trim()).join(',');
          const selector = `.ease-\\[cubic-bezier\\(${args.replace(/\./g, '\\.').replace(/,/g, '\\,')}\\)\\]`;
          if (utilities[selector]) continue;
          utilities[selector] = { 'transition-timing-function': `cubic-bezier(${args})` };
        }
      }
      addUtilities(utilities);
    },

    /* Tailwind v3 不生成 `rounded-xs`（v4 新增）也不生成裸的 `rounded-t/-b/-l/-r/-tl/-tr/-bl/-br`，
       而这些写法在 MTV 源码里是存在的 ⇒ 那几处**根本没有圆角**（computed = 0px）。
       这里按官方刻度补齐：xs = 2px，裸方向类 = 8px（= 官方 rounded-sm / v3 的 DEFAULT）。 */
    function ({ addUtilities, theme }) {
      const xs = theme('borderRadius.xs');
      const base = theme('borderRadius.DEFAULT');
      const sides = {
        t: ['borderTopLeftRadius', 'borderTopRightRadius'],
        r: ['borderTopRightRadius', 'borderBottomRightRadius'],
        b: ['borderBottomRightRadius', 'borderBottomLeftRadius'],
        l: ['borderTopLeftRadius', 'borderBottomLeftRadius'],
        tl: ['borderTopLeftRadius'],
        tr: ['borderTopRightRadius'],
        br: ['borderBottomRightRadius'],
        bl: ['borderBottomLeftRadius'],
      };
      const utilities = { '.rounded-xs': { borderRadius: xs } };
      for (const [suffix, props] of Object.entries(sides)) {
        utilities[`.rounded-${suffix}`] = Object.fromEntries(props.map((p) => [p, base]));
      }
      addUtilities(utilities);
    },
  ],
}
