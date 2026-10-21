/**
 * 模型 Logo（**官方原版 SVG**，落库在 `src/assets/model-logos/`）
 *
 * 官方底行「选择模型」按钮左侧就是模型自家 logo（截图：🍌 Nano Banana 2 Lite）。
 *
 * ⚠️ 颜色口径（踩过的两个坑，别再犯）：
 *   ① 这些图是 `<img src="…svg">` 加载的 —— **`<img>` 里的 SVG 是独立文档，`currentColor` 继承不到外层**
 *      ⇒ 颜色必须**写死在 svg 文件里**（`fill="#8888a0"`，与官方行内图标实测色 `rgb(136,136,160)` 一致）。
 *   ② **不要内联渲染**（`?raw` + `dangerouslySetInnerHTML`）：那样颜色会随行文字走 ⇒
 *      **hover 时图标会跟着变色** ✗（用户：「hover 模型图标 是不变色的」）。
 *   ③ 返回的是 **URL**（不是 SVG 源码）：调用方一律 `<img src={logo}>`（触发器/行内都用它）✓
 *
 * 匹配规则：按模型 label / value / id 里的关键词命中，命中不到返回 null（保持原徽章行为）。
 */
import geminiGoogle from '../assets/model-logos/gemini-google.svg';
import glm from '../assets/model-logos/glm.svg';
import grokXai from '../assets/model-logos/grok-xai.svg';
import kling from '../assets/model-logos/kling.svg';
import nanoBanana from '../assets/model-logos/nano-banana.svg';
import seedance from '../assets/model-logos/seedance.svg';
import wan from '../assets/model-logos/wan.svg';

interface LogoRule {
  /** 命中关键词（小写比较） */
  keys: string[];
  /** logo 的 **URL**（`<img src>` 用） */
  src: string;
}

const RULES: LogoRule[] = [
  { keys: ['nano banana', 'nanobanana', 'banana'], src: nanoBanana },
  { keys: ['seedance'], src: seedance },
  { keys: ['gemini'], src: geminiGoogle },
  { keys: ['grok'], src: grokXai },
  { keys: ['kling'], src: kling },
  { keys: ['glm', 'chatglm', 'zhipu'], src: glm },
  { keys: ['wan', '通义万相'], src: wan },
];

/** 依据模型的若干候选文本找到 logo 的 **URL**；找不到返回 null */
export function findModelLogo(...candidates: Array<string | undefined | null>): string | null {
  const haystack = candidates.filter(Boolean).join(' ').toLowerCase();
  if (!haystack) return null;
  for (const rule of RULES) {
    if (rule.keys.some((key) => haystack.includes(key))) return rule.src;
  }
  return null;
}
