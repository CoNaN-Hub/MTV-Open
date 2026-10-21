/**
 * settings/ShortcutSettings —— 官方「快捷键」面板（`$Ps`）**逐字照抄**
 *
 * 官方出处：`index-BsHyQ2qj.js` @8415008 `$Ps=({onClose})`，导出名 `qO`。
 * 官方 JSX（**原样**，只把 i18n 换成 MTV 的中文串）：
 * ```jsx
 * <div className="w-[640px] bg-card rounded-3xl px-10 py-6 grid grid-cols-2 gap-14 shadow-lg border relative">
 *   <Button shape="circle" size="sm" variant="clean" onClick={onClose}
 *           className="absolute top-3 right-2 text-muted-foreground"><X size={20}/></Button>
 *   {[[basic,zoom],[moveCanvas,timeline,others]].map(col => (
 *     <div className="col-span-1 flex flex-col gap-3">
 *       {col.map(sec => (
 *         <div className="flex flex-col gap-3">
 *           <h2 className="text-lg font-[400] text-muted-foreground">{sec.title}</h2>
 *           <div className="flex flex-col gap-2">
 *             {sec.items.map(it => (
 *               <div className="flex justify-between items-center flex-nowrap text-popover-foreground">
 *                 <div className="flex items-center gap-2 flex-nowrap text-nowrap text-md">{it.itemName}</div>
 *                 <div className="flex items-center gap-2 flex-nowrap">
 *                   {it.keys.map(k => k === '/'
 *                     ? <span className="text-muted-foreground">/</span>
 *                     : <span className="min-w-8 h-8 px-2 text-center place-content-center border rounded-[6px]">{k}</span>)}
 *                   {it.icon && <span className="min-w-8 h-8 flex items-center justify-center">{it.icon}</span>}
 *                 </div>
 *               </div>
 *             ))}
 *           </div>
 *         </div>
 *       ))}
 *     </div>
 *   ))}
 * </div>
 * ```
 *
 * 官方数据（`a` = ⌘/Ctrl、`r` = ⇧/Shift、`o` = ⌫/Del；`n` = 是否显示 Agent 相关项）：
 *   缩放   : 放大 [a,+] · 缩小 [a,-] · 键盘 [a,<Yxe/>] · 触控板 [<zoom.gif>]
 *   移动画布: 键盘 [a,Space,<Yxe/>] · 触控板 [<double-click.gif>]
 *   基础   : 删除 [o] · 撤销 [a,Z] · **重做 [r,a,Z]** · 复制 [a,C] · 粘贴 [a,V] · 堆叠 [a,G]
 *            · Search nodes [a,F] · 多选 [r,<Yxe/>]
 *   时间轴 : 切割 [C] · 向左裁切 [Q] · 向右裁切 [E]
 *   其他   : 打开/关闭 Agent [a,J] · 焦点编辑 [a,I] · 语音输入 [长按,V] · 完成语音输入 [V]
 *
 * 图标（官方原名 → MTV 落点）：
 *   · `Yxe`（键盘，13×19 自绘，含一颗 **#1FA2DC** 蓝的「1」）→ 内联 SVG，原样
 *   · `Iui`（触控板缩放）= `v.jsx("img",{src:"/assets/zoom-9JfllZME.gif"})`
 *   · `Sui`（触控板双击）= `v.jsx("img",{src:"/assets/double-click-BJZPLkGG.gif"})`
 *     ⇒ 两个 GIF 已从官方 assets 原样拷进 `src/assets/official-icons/hotkeys/`
 *
 * ⚠️ MTV 偏离（就这一条）：官方这是**独立 640px 小弹窗**（`w-[640px] … rounded-3xl`），
 *    MTV 把它当设置面板的「快捷键」页签 ⇒ **去掉固定 640px 宽**，让它铺满右栏；
 *    其余 class（`bg-card / rounded-3xl / px-10 / py-6 / grid-cols-2 / gap-14 / shadow-lg / border`）
 *    与键帽（`min-w-8 h-8 px-2 text-center place-content-center border rounded-[6px]`）**逐字保留**。
 *    × 也没搬官方的关闭键（设置面板自己有右上关闭键，重复了）。
 */
import { useMemo } from 'react';

import { useT } from '../../i18n';
import { SettingsPaneBody } from './SettingsPane';
import zoomGif from '../../assets/official-icons/hotkeys/zoom-9JfllZME.gif';
import doubleClickGif from '../../assets/official-icons/hotkeys/double-click-BJZPLkGG.gif';

const IS_MAC = typeof navigator !== 'undefined' && /Macintosh|Mac OS X/.test(navigator.userAgent);
/** 官方 `a` / `r` / `o` */
const MOD = IS_MAC ? '⌘' : 'Ctrl';
const SHIFT = IS_MAC ? '⇧' : 'Shift';
const DEL = IS_MAC ? '⌫' : 'Del';

/** 官方 `Yxe`：键盘图标（13×19，自绘，含 #1FA2DC 的「1」） */
function KeyboardIcon({ className }: { className?: string }) {
  return (
    <svg
      width="13"
      height="19"
      viewBox="0 0 13 19"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    >
      <path
        d="M0.599976 4.8765C0.599976 2.51471 2.51458 0.600098 4.87637 0.600098H7.7273C10.0891 0.600098 12.0037 2.51471 12.0037 4.8765V13.3237C12.0037 15.6855 10.0891 17.6001 7.7273 17.6001H4.87638C2.51459 17.6001 0.599976 15.6855 0.599976 13.3237V4.8765Z"
        stroke="#CCCCCC"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M5.34089 5.67852L6.05362 4.82324L6.05362 9.09964L6.76636 7.81672"
        stroke="#1FA2DC"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrackpadIcon({ kind }: { kind: 'zoom' | 'double-click' }) {
  /* 官方：`Sui=({className}) => <div className={className}><img src={gif} className="object-cover"/></div>`，
     用的时候传 `className="size-7"` ⇒ 28×28 的壳 + 官方的 preflight `img{max-width:100%}` 把 gif 收进壳里。
     ⚠️ 这里显式给 `w-full h-full` —— 只靠 preflight 的话，父级是「min-w-8 的内容宽 flex 项」，
        `max-width:100%` 没有约束力，gif 会按原始尺寸（417px）铺开（实测就是这个 bug）。 */
  return (
    <div className="size-7">
      <img
        src={kind === 'zoom' ? zoomGif : doubleClickGif}
        alt={kind === 'zoom' ? 'zoom' : 'double-click'}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

interface HotkeyItem {
  itemName: string;
  keys: string[];
  icon?: 'keyboard' | 'zoom' | 'double-click';
}
interface HotkeySection {
  title: string;
  items: HotkeyItem[];
}

function useSections(): HotkeySection[] {
  const t = useT();
  return useMemo(() => {
    /* ── 官方 `s` 缩放 ──────────────────────────────────────────────
       官方 4 项：放大 / 缩小 / 键盘 / 触控板
       + MTV 独有（按官方形式补进本类目）：
         · 锁定比例缩放 —— MTV `useKeyboardShortcuts` 里缩放时按住 Shift 锁比例
         · 画布复位 F   —— MTV line 330 `e.key === 'f'`                              */
    const zoom: HotkeySection = {
      title: t('缩放'),
      items: [
        { itemName: t('放大'), keys: [MOD, '+'] },
        { itemName: t('缩小'), keys: [MOD, '-'] },
        { itemName: t('键盘'), keys: [MOD], icon: 'keyboard' },
        { itemName: t('触控板'), keys: [], icon: 'zoom' },
        { itemName: t('锁定比例缩放'), keys: [t('缩放时按住'), SHIFT] },
        { itemName: t('画布复位'), keys: ['F'] },
      ],
    };
    /* ── 官方 `l` 移动画布 ─────────────────────────────────────────
       官方 2 项：键盘 / 触控板
       + MTV 独有：小地图 M（line 336）                                        */
    const moveCanvas: HotkeySection = {
      title: t('移动画布'),
      items: [
        { itemName: t('键盘'), keys: [MOD, 'Space'], icon: 'keyboard' },
        { itemName: t('触控板'), keys: [], icon: 'double-click' },
        { itemName: t('小地图'), keys: ['M'] },
      ],
    };
    /* ── 官方 `c` 基础 ─────────────────────────────────────────────
       官方 8 项：删除 / 撤销 / 重做 / 复制 / 粘贴 / 堆叠 / Search nodes / 多选
       ⚠️ 官方第 6 项是「堆叠」（`pile.stack`，Ctrl+G）；MTV 的 Ctrl+G **实际行为是分组/取消分组**
          （`useKeyboardShortcuts` line 359 注释 `Ctrl+G / Alt+G: Group / Ungroup`），
          且 MTV 还多一个 `Alt+G` ⇒ 这一行保留 MTV 的标签与键位（同一个键，语义不同，不能照抄官方标签）。
       + MTV 独有：保存画布 Ctrl/Alt+S（line 150）· 创建生成节点 1–6 / 创建源节点 Alt+1–5（line 210）
         · 弹出对话框 选中节点+Space（line 176）                                  */
    const basic: HotkeySection = {
      title: t('基础'),
      items: [
        { itemName: t('删除'), keys: [DEL] },
        { itemName: t('撤销'), keys: [MOD, 'Z'] },
        { itemName: t('重做'), keys: [SHIFT, MOD, 'Z', '/', MOD, 'Y'] },
        { itemName: t('复制'), keys: [MOD, 'C'] },
        { itemName: t('粘贴'), keys: [MOD, 'V'] },
        { itemName: t('分组 / 取消分组'), keys: [MOD, 'G'] },
        { itemName: t('Search nodes'), keys: [MOD, 'F'] },
        { itemName: t('多选'), keys: [SHIFT], icon: 'keyboard' },
        { itemName: t('保存画布'), keys: [MOD, 'S'] },
        { itemName: t('创建生成节点'), keys: ['1', '–', '6'] },
        { itemName: t('创建源节点'), keys: [IS_MAC ? '⌥' : 'Alt', '1', '–', '5'] },
        { itemName: t('弹出对话框'), keys: [t('选中节点'), 'Space'] },
      ],
    };
    /* ── 官方 `u` 时间轴（3 项，MTV 无独有项） ─────────────────────── */
    const timeline: HotkeySection = {
      title: t('时间轴'),
      items: [
        { itemName: t('切割'), keys: ['C'] },
        { itemName: t('向左裁切'), keys: ['Q'] },
        { itemName: t('向右裁切'), keys: ['E'] },
      ],
    };
    /* ── 官方 `d` 其他 ─────────────────────────────────────────────
       官方 4 项：打开/关闭Agent · 焦点编辑 · 语音输入 · 完成语音输入
       + MTV 独有：关闭菜单/设置 Escape（line 342）· 资产库 Tab（line 126）
         · 资源搜索窗口 Alt+Space / Ctrl+Shift+Space（line 168）
         · 显示/隐藏吉祥物 Ctrl+Shift+M（line 348）                              */
    const others: HotkeySection = {
      title: t('其他'),
      items: [
        { itemName: t('打开/关闭Agent'), keys: [MOD, 'J'] },
        { itemName: t('焦点编辑'), keys: [MOD, 'I'] },
        { itemName: t('语音输入'), keys: [t('长按'), 'V'] },
        { itemName: t('完成语音输入'), keys: ['V'] },
        { itemName: t('关闭菜单 / 设置'), keys: ['Escape'] },
        { itemName: t('资产库'), keys: ['Tab'] },
        { itemName: t('资源搜索窗口'), keys: [IS_MAC ? '⌥' : 'Alt', 'Space', '/', MOD, SHIFT, 'Space'] },
        { itemName: t('显示/隐藏吉祥物'), keys: [MOD, SHIFT, 'M'] },
      ],
    };
    return [basic, zoom, moveCanvas, timeline, others];
  }, [t]);
}

function HotkeyRow({ item }: { item: HotkeyItem }) {
  return (
    <div className="flex items-center justify-between flex-nowrap text-popover-foreground">
      <div className="flex items-center gap-2 flex-nowrap text-nowrap text-md">{item.itemName}</div>
      <div className="flex items-center gap-2 flex-nowrap">
        {item.keys.map((key, index) => (
          key === '/'
            ? <span key={`sep-${index}`} className="text-muted-foreground">/</span>
            : <span
                key={`${key}-${index}`}
                /* 官方原类名：`min-w-8 h-8 px-2 text-center place-content-center border rounded-[6px]`
                   ⚠️ 补了一个 `grid`：官方那个 `place-content-center` 在 `display:block` 的 span 上是**无效**的
                      （span 被 flex 父级 blockify 成 block）⇒ 官方那颗键帽的文字其实贴着 32px 盒子的上沿。
                      加 `grid` 让 `place-content-center` 真正生效，文字居中 —— 与官方截图里的观感一致。*/
                className="grid min-w-8 h-8 px-2 text-center place-content-center border rounded-[6px]"
              >{key}</span>
        ))}
        {item.icon && (
          <span className="min-w-8 h-8 flex items-center justify-center">
            {item.icon === 'keyboard'
              ? <KeyboardIcon className="size-7 p-1" />
              : <TrackpadIcon kind={item.icon} />}
          </span>
        )}
      </div>
    </div>
  );
}

function HotkeyColumn({ sections }: { sections: HotkeySection[] }) {
  return (
    <div className="col-span-1 flex flex-col gap-3">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-3">
          <h2 className="text-lg font-[400] text-muted-foreground">{section.title}</h2>
          <div className="flex flex-col gap-2">
            {section.items.map((item) => <HotkeyRow key={item.itemName} item={item} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ShortcutSettings() {
  const sections = useSections();
  /* 官方 `h=[[c,s],[l,u,d]]` —— 第一栏 基础+缩放，第二栏 移动画布+时间轴+其他 */
  const left = [sections[0], sections[1]];
  const right = [sections[2], sections[3], sections[4]];
  return (
    <SettingsPaneBody>
      <div className="o-hotkeys-panel bg-card rounded-3xl px-10 py-6 grid grid-cols-2 gap-14 shadow-lg border relative">
        <HotkeyColumn sections={left} />
        <HotkeyColumn sections={right} />
      </div>
    </SettingsPaneBody>
  );
}
