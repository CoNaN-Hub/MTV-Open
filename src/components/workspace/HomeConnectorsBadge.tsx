/**
 * HomeConnectorsBadge —— 官方首页输入条右侧那颗「Connectors」徽标。
 * ══════════════════════════════════════════════════════════════════════════
 * 官方证据：CDP 9222 `/home` 实测 `button[aria-label="Connectors"]` 的 outerHTML（逐字搬运）：
 *   `<span class="flex items-center" aria-hidden="true">`
 *     + 3 × `<span class="relative flex size-3.5 items-center justify-center overflow-hidden
 *                rounded-[3px] bg-white shadow-[0_0_0_1px_#141414]" style="z-index:N">`
 *       （第 2、3 个额外带 `-ml-1`，形成叠压）
 *       + 内嵌 9×9 的品牌 logo `<svg>`：Figma / Slack / Linear
 *   `</span>`
 * 对应官方 bundle 的 `const Hp=["figma","slack","linear"]` 与 `TV(e)`（按名字返回内联 path）。
 * ⚠️ 官方这三条路径的 `d`/`fill` 全部**逐字**取自上面那次实测 DOM，未做任何改动。
 */
const CONNECTORS = ['figma', 'slack', 'linear'] as const;

function FigmaLogo() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 24c2.208 0 4-1.792 4-4v-4H8c-2.208 0-4 1.792-4 4s1.792 4 4 4Z" fill="#0ACF83" />
      <path d="M4 12c0-2.208 1.792-4 4-4h4v8H8c-2.208 0-4-1.792-4-4Z" fill="#A259FF" />
      <path d="M4 4c0-2.208 1.792-4 4-4h4v8H8C5.792 8 4 6.208 4 4Z" fill="#F24E1E" />
      <path d="M12 0h4c2.208 0 4 1.792 4 4s-1.792 4-4 4h-4V0Z" fill="#FF7262" />
      <path d="M20 12c0 2.208-1.792 4-4 4s-4-1.792-4-4 1.792-4 4-4 4 4Z" fill="#1ABCFE" />
    </svg>
  );
}

function SlackLogo() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.2 14.6a2.1 2.1 0 1 1-2.1-2.1h2.1v2.1Zm1.05 0a2.1 2.1 0 1 1 4.2 0v5.25a2.1 2.1 0 1 1-4.2 0V14.6Z" fill="#E01E5A" />
      <path d="M9.4 6.2a2.1 2.1 0 1 1 2.1-2.1v2.1H9.4Zm0 1.05a2.1 2.1 0 1 1 0 4.2H4.15a2.1 2.1 0 1 1 0-4.2H9.4Z" fill="#36C5F0" />
      <path d="M17.8 9.4a2.1 2.1 0 1 1 2.1 2.1h-2.1V9.4Zm-1.05 0a2.1 2.1 0 1 1-4.2 0V4.15a2.1 2.1 0 1 1 4.2 0V9.4Z" fill="#2EB67D" />
      <path d="M14.6 17.8a2.1 2.1 0 1 1-2.1 2.1v-2.1h2.1Zm0-1.05a2.1 2.1 0 1 1 0-4.2h5.25a2.1 2.1 0 1 1 0 4.2H14.6Z" fill="#ECB22E" />
    </svg>
  );
}

function LinearLogo() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.86 16.54 16.54 2.86A9.95 9.95 0 0 0 12 1.5C6.2 1.5 1.5 6.2 1.5 12c0 1.63.39 3.17 1.08 4.54h.28ZM7.46 21.14 21.14 7.46c.45.9.7 1.92.7 3.01A8.53 8.53 0 0 1 13.3 19c-1.88 0-3.59-.66-4.95-1.75l-.89 3.89Zm1.77.94A10.45 10.45 0 0 0 12 22.5C17.8 22.5 22.5 17.8 22.5 12c0-1.1-.17-2.15-.49-3.14L9.23 22.08Z"
        fill="#5E6AD2"
      />
    </svg>
  );
}

const LOGOS = { figma: FigmaLogo, slack: SlackLogo, linear: LinearLogo } as const;

export default function HomeConnectorsBadge() {
  return (
    <span className="flex items-center" aria-hidden="true">
      {CONNECTORS.map((name, i) => {
        const Logo = LOGOS[name];
        return (
          <span
            key={name}
            className={`relative flex size-3.5 items-center justify-center overflow-hidden rounded-[3px] bg-white shadow-[0_0_0_1px_#141414]${i > 0 ? ' -ml-1' : ''}`}
            style={{ zIndex: CONNECTORS.length - i }}
          >
            <Logo />
          </span>
        );
      })}
    </span>
  );
}
