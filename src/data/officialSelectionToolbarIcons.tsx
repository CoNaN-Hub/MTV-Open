/**
 * officialSelectionToolbarIcons —— 官方「多选浮动工具栏」8 个按钮的**原样 SVG**
 * （t985 从官方窗口 9444 的 DOM 逐个 `outerHTML` 抽出；`strokeWidth`/`className` 已转成 JSX 属性）。
 *
 * 官方源码对照：
 *   布局     `O8`（triggerVariant="toolbar"）   → lucide `layout-template`
 *   堆叠     `i3`（`data-pile-stack-state`）   → 官方自制三层堆叠图标
 *   打组     `o3`                              → tabler `folders`
 *   加入对话 `a3`                              → tabler `message-plus`
 *   新建主体 `Vv`                              → 官方自制 svg，**viewBox 0 0 18 18**（本文件的 `createSubject`）
 *   创建播放列表 `Gj`                          → 官方自制 svg，**viewBox 0 0 20 20**（MTV 无播放列表节点 ⇒ 未收录）
 *   保存到素材库 `l3`（strokeWidth 2）          → tabler `folder-plus`
 *   下载全部 `F8`                              → tabler `download`
 *   反馈问题 `VA`                              → tabler `bug`
 *
 * ⚠️ **勘误（本轮修正）**：本文件此前把 18×18 那颗标成「新建主体 `Gj`」并命名为 `createPlaylist` —— **两个都错**：
 *    按规格 §2，新建主体 = `Vv`（18×18），创建播放列表 = `Gj`（20×20，带 `bg-accent-primary` 角标）。
 *    18×18 的路径本身是对的，只是被挂在了错误的语义名下 ⇒ 已改名 `createSubject`。
 *
 * 官方按钮里图标统一 `size-4`（16×16）；这里直接写死 16×16。
 */
import type { CSSProperties, JSX } from 'react';

export type SelectionToolbarIconName =
  | 'layout'
  | 'pile'
  /** 官方 PILE 工具条的「取消堆叠」= `qse` → index `tT` → `f1s` = Tabler `layers-arrow-up` */
  | 'unpile'
  | 'group'
  | 'addToChat'
  | 'createSubject'
  | 'saveToLibrary'
  | 'downloadAll'
  | 'reportIssue'
  /** 官方分组工具条「解组」图标（源码真身 `fg`，`use-waveform-data-DMduQqB-.js`@86850） */
  | 'ungroup';

interface IconProps {
  name: SelectionToolbarIconName;
  size?: number;
  style?: CSSProperties;
}

function Svg({ size, children, box = 24, strokeWidth = 2, style, extra }: {
  size: number;
  children: JSX.Element | JSX.Element[];
  box?: number;
  strokeWidth?: number;
  style?: CSSProperties;
  extra?: Record<string, unknown>;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${box} ${box}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
      {...extra}
    >
      {children}
    </svg>
  );
}

/** 官方工具栏图标（逐字对照官方 DOM） */
export default function OfficialSelectionToolbarIcon({ name, size = 16, style }: IconProps) {
  switch (name) {
    case 'layout':
      return (
        <Svg size={size} style={style}>
          <rect width="18" height="7" x="3" y="3" rx="1" />
          <rect width="9" height="7" x="3" y="14" rx="1" />
          <rect width="5" height="7" x="16" y="14" rx="1" />
        </Svg>
      );

    case 'pile':
      /* 官方尺寸不是 16 视图盒的 24：`viewBox 0 0 16 16`、`stroke-width 1.5`、`overflow visible` */
      return (
        <Svg size={size} box={16} strokeWidth={1.5} style={style} extra={{ overflow: 'visible' }}>
          <g data-pile-stack-layer="back" opacity={0.6}>
            <path d="M6.5 2.5h6a1.5 1.5 0 0 1 1.5 1.5v6" />
          </g>
          <g data-pile-stack-layer="middle" opacity={0.8}>
            <path d="M4.5 4.5h6a1.5 1.5 0 0 1 1.5 1.5v6" />
          </g>
          <g data-pile-stack-layer="front">
            <rect x="2.5" y="6.5" width="7.5" height="7.5" rx="1.5" />
          </g>
        </Svg>
      );

    /* 官方 PILE 工具条的「取消堆叠」图标 `qse`（别名链：zoom-slider 的 `qse` ← index `tT` ← `f1s`）
       = Tabler **`layers-arrow-up`**，`index-BiTZf8mJ.js`@char12247988 逐字 4 条 path。 */
    case 'unpile':
      return (
        <Svg size={size} style={style}>
          <path d="M12 12V2" />
          <path d="M2 17.002a1 1 0 00.58.91l8.6 3.91a2 2 0 001.65 0l8.58-3.9a1 1 0 00.59-.92" />
          <path d="M7.674 8.774 2.58 11.09a1 1 0 000 1.822l8.6 3.91a2 2 0 001.65 0l8.58-3.9a1 1 0 00.59-.92 1 1 0 00-.59-.922l-5.078-2.308" />
          <path d="m9 5 3-3 3 3" />
        </Svg>
      );

    case 'group':
      return (
        <Svg size={size} style={style}>
          <path d="M9 3h3l2 2h5a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" />
          <path d="M17 16v2a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2h2" />
        </Svg>
      );

    /* 官方分组工具条「解组」图标 —— **源码真身**（不是用户导出的 SVG）。
       出处：`use-waveform-data-DMduQqB-.js` @char86850 的 `fg`，`zoom-slider-3ZcFvYQO.js`
       从该 chunk `import{Z as Toe}`（@7075）后用在 group 工具条
       `{key:"ungroup", node: l.jsx(Toe,{}), buttonType:"obsidian", text: s("common.ungroup")}`（@2883826）。
       ⚠️⚠️ 三次才找对，教训写死：
         · ① 规格 §6 说「自研 16×16 两个分离方框」⇒ 我照它画了别的 ⇒ 用户「解散的图标也不对」✗
         · ② 我在 **index 里瞎找** 同名全局 `Toe` ⇒ 撞上 lucide `folder-sync` / 主题光斑组件 ⇒ 用户
              「解散组图标是错的」✗ —— **`Toe` 是 zoom-slider 本模块的导入别名，必须在它的 import
              子句里解析**（`Z as Toe`），而 `Z` 由 **`use-waveform-data-DMduQqB-.js`** 导出（不是 index！）
         · ③ 真身：16×16、**stroke 型**、`strokeWidth 1.33`、3 条 path（两个圆角方框 + 4 个短十字划）
       （用户给的 SVG 是同一图标经 Illustrator 导出的 fill 版、viewBox 被裁成可见边界 11.33×11.33
        ⇒ 形状对但**描边属性丢了**，所以这里用源码版。） */
    case 'ungroup':
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          style={style}
        >
          <path
            d="M8.25511 3.3335H4.15254C3.69939 3.3335 3.33203 3.68725 3.33203 4.12362V6.49399C3.33203 6.93036 3.69939 7.28411 4.15254 7.28411H8.25511C8.70827 7.28411 9.07562 6.93036 9.07562 6.49399V4.12362C9.07562 3.68725 8.70827 3.3335 8.25511 3.3335Z"
            stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"
          />
          <path
            d="M12.5115 9.38288H8.40895C7.9558 9.38288 7.58844 9.73663 7.58844 10.173V12.5434C7.58844 12.9797 7.9558 13.3335 8.40895 13.3335H12.5115C12.9647 13.3335 13.332 12.9797 13.332 12.5434V10.173C13.332 9.73663 12.9647 9.38288 12.5115 9.38288Z"
            stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"
          />
          <path
            d="M10.732 4.6665V5.9665M13.332 7.2665H12.032M5.93203 10.6998V11.9998M4.63203 9.39984H3.33203"
            stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      );

    case 'addToChat':
      return (
        <Svg size={size} style={style}>
          <path d="M8 9h8" />
          <path d="M8 13h6" />
          <path d="M12.01 18.594l-4.01 2.406v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v5.5" />
          <path d="M16 19h6" />
          <path d="M19 16v6" />
        </Svg>
      );

    case 'createSubject':
      /* 官方 `Vv`：自研 svg，viewBox 0 0 18 18，单条 fill="currentColor" 的加号+圆角方框路径 */
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 18 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={style}
        >
          <path
            d="M13.5 10.6865C13.8105 10.6866 14.0624 10.9385 14.0625 11.249V12.9365H15.75C16.0605 12.9366 16.3124 13.1885 16.3125 13.499C16.3124 13.8096 16.0606 14.0615 15.75 14.0615H14.0625V15.749C14.0624 16.0596 13.8106 16.3115 13.5 16.3115C13.1896 16.3113 12.9376 16.0595 12.9375 15.749V14.0615H11.25C10.9396 14.0613 10.6876 13.8095 10.6875 13.499C10.6876 13.1886 10.9396 12.9367 11.25 12.9365H12.9375V11.249C12.9376 10.9386 13.1896 10.6867 13.5 10.6865ZM10.5752 2.0625C11.4057 2.0625 12.0624 2.06232 12.5908 2.10547C13.1258 2.14918 13.5789 2.2406 13.9922 2.45117C14.6624 2.79273 15.2083 3.33755 15.5498 4.00781C15.7603 4.4211 15.8508 4.87429 15.8945 5.40918C15.9377 5.93755 15.9375 6.59429 15.9375 7.4248V8.19531C15.9374 8.50586 15.6856 8.75781 15.375 8.75781C15.0644 8.75781 14.8126 8.50586 14.8125 8.19531V7.4248C14.8125 6.57588 14.812 5.9729 14.7734 5.50098C14.7354 5.0356 14.6632 4.74689 14.5469 4.51855C14.3132 4.05991 13.9401 3.68682 13.4814 3.45312C13.2532 3.33686 12.9651 3.2646 12.5 3.22656C12.028 3.188 11.4244 3.1875 10.5752 3.1875H7.4248C6.57588 3.1875 5.9729 3.18804 5.50098 3.22656C5.0356 3.26458 4.74689 3.33682 4.51855 3.45312C4.05991 3.68682 3.68682 4.05991 3.45312 4.51855C3.33682 4.74689 3.26458 5.0356 3.22656 5.50098C3.18804 5.9729 3.1875 6.57588 3.1875 7.4248V10.5752C3.1875 11.4244 3.188 12.028 3.22656 12.5C3.2646 12.9651 3.33686 13.2532 3.45312 13.4814C3.68682 13.9401 4.05991 14.3132 4.51855 14.5469C4.74689 14.6632 5.0356 14.7354 5.50098 14.7734C5.9729 14.812 6.57588 14.8125 7.4248 14.8125H8.19531C8.50586 14.8126 8.75781 15.0644 8.75781 15.375C8.75781 15.6856 8.50586 15.9374 8.19531 15.9375H7.4248C6.59429 15.9375 5.93755 15.9377 5.40918 15.8945C4.87429 15.8508 4.4211 15.7603 4.00781 15.5498C3.33755 15.2083 2.79273 14.6624 2.45117 13.9922C2.2406 13.5789 2.14918 13.1258 2.10547 12.5908C2.06232 12.0624 2.0625 11.4057 2.0625 10.5752V7.4248C2.0625 6.59429 2.06232 5.93755 2.10547 5.40918C2.14918 4.87421 2.2406 4.42115 2.45117 4.00781C2.79269 3.33764 3.33764 2.79269 4.00781 2.45117C4.42115 2.2406 4.87421 2.14918 5.40918 2.10547C5.93755 2.06232 6.59429 2.0625 7.4248 2.0625H10.5752ZM9.1875 4.82812C10.6631 4.82812 11.8594 6.02436 11.8594 7.5C11.8594 8.28534 11.5199 8.99161 10.9805 9.48047C11.3429 9.66594 11.6784 9.90694 11.9717 10.2002C12.1913 10.4198 12.1911 10.7754 11.9717 10.9951C11.752 11.2148 11.3964 11.2148 11.1768 10.9951C10.6493 10.4677 9.93342 10.1719 9.1875 10.1719C8.44158 10.1719 7.72569 10.4677 7.19824 10.9951C6.6708 11.5226 6.375 12.2385 6.375 12.9844C6.375 13.295 6.12316 13.5469 5.8125 13.5469C5.50184 13.5469 5.25 13.295 5.25 12.9844C5.25 11.9401 5.6649 10.9386 6.40332 10.2002C6.6964 9.90711 7.03136 9.6659 7.39355 9.48047C6.85423 8.99162 6.51562 8.28524 6.51562 7.5C6.51562 6.02436 7.71186 4.82812 9.1875 4.82812ZM9.1875 5.95312C8.33318 5.95312 7.64062 6.64568 7.64062 7.5C7.64062 8.35432 8.33318 9.04688 9.1875 9.04688C10.0418 9.04688 10.7344 8.35432 10.7344 7.5C10.7344 6.64568 10.0418 5.95312 9.1875 5.95312Z"
            fill="currentColor"
          />
        </svg>
      );

    case 'saveToLibrary':
      return (
        <Svg size={size} style={style}>
          <path d="M12 19h-7a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v3.5" />
          <path d="M16 19h6" />
          <path d="M19 16v6" />
        </Svg>
      );

    case 'downloadAll':
      return (
        <Svg size={size} style={style}>
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
          <path d="M7 11l5 5l5 -5" />
          <path d="M12 4l0 12" />
        </Svg>
      );

    case 'reportIssue':
      return (
        <Svg size={size} style={style}>
          <path d="M9 9v-1a3 3 0 0 1 6 0v1" />
          <path d="M8 9h8a6 6 0 0 1 1 3v3a5 5 0 0 1 -10 0v-3a6 6 0 0 1 1 -3" />
          <path d="M3 13l4 0" />
          <path d="M17 13l4 0" />
          <path d="M12 20l0 -6" />
          <path d="M4 19l3.35 -2" />
          <path d="M20 19l-3.35 -2" />
          <path d="M4 7l3.75 2.4" />
          <path d="M20 7l-3.75 2.4" />
        </Svg>
      );

    default:
      return null;
  }
}
