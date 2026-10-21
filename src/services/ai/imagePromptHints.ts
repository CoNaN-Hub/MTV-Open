/**
 * 出站提示词的组装 —— **必须与官方口径一致，且对所有厂商一视同仁**。
 *
 * ★★★ 用户 2026：
 *   1.「批量生成时 一样的模型 一样的参考图 一样的提示词，但是官方的生成结果 效果更好，
 *      MTV 生图结果相比官方就差很多」——
 *     根因就是我们**发出去的提示词和官方不是同一段文本**：
 *       · 官方：**用户原话直发**，只带用户自己在编辑器里打的 `参考{{Image 1}}` 标记
 *         （实测官方报文 `{prompt:"参考{{Image 1}} …", scene:"image-edit", …}`）。
 *       · MTV（旧）：`【参考图输入】…以参考图为基图…不要重新构思画面` +
 *         用户原话 + `【输出画幅】…`。
 *     那段样板是「参考图完全不生效」那轮打的补丁，**它从来没让参考图生效过**
 *     （见下面那张实测对照表：真正起作用的是「换端点 / 换字段」，不是文案），
 *     却在用户要「重新构图」时把模型按住不动 ⇒ 实测出图「几乎跟参考图一样、没啥变化」
 *     （用户截图：官方出全新构图的海报，MTV 只在原图上加了几个小物件）。
 *   2.「我接入的是自定义 api 厂商，目前是土豆，未来我可能会更换厂商，
 *      所以上面的修改不要单纯只针对土豆，未来适配进来的厂商也要适配」
 *     ⇒ **不再按 provider / 参考图模式分支**：所有厂商一律**原话直发**（与官方同构），
 *       只有 MTV 独有的「项目风格母图」额外补一行（那是官方没有的语义）。
 *
 * ⚠️ 历史实测对照表（「参考图完全不生效」那轮，9333 + 中转站 + `gpt-image-2-pro`；
 *    同一张参考图、同一个字段、同一个尺寸，只改提示词）——**保留供后人别再走回头路**：
 *    | 提示词 | 结果 |
 *    | 「**保留参考图里的红色爱心椅子、粉/黄/绿小椅子与蓝绿棋盘格地面（3D 黏土风格）**，改成霓虹夜景」<br>（= **点明了参考图内容**） | ✅ 100% 跟着参考图 |
 *    | 「保持需要延续的主体、风格与细节」+「按目标画幅重新构图，不继承参考图或旧图宽高比」 | ❌ 重新构思，生成无关产品海报 |
 *    | 硬绑定「以参考图为基图：主体/构图/风格/场景必须保留延续，不要重新构思画面」 | ❌ 同上 |
 *    | `<<<image_1>>>` 占位符 | ❌ 原样出现在画面里 |
 *    ⇒ **决定性的不是「说得有多硬」，而是「有没有点名参考图里是什么」**（content grounding）；
 *       而且这些文案从没让参考图必然生效 —— 真正生效的是**换端点/换字段**
 *       （见 `providers/standardImage.ts` 的实测注释）。
 */
import type { ImageReferenceRequestMode } from '../../types';

export interface BuildImagePromptOptions {
  /** 用户原话（已解析 `@{node}` 引用后的文本） */
  rawPrompt: string;
  /** 本次实际带上的参考图张数 */
  referenceCount: number;
  /** 第一张是否是项目风格母图 */
  styleAsFirst: boolean;
  /** round 122 追加：可以为 `undefined`；**本函数不读它**（原话直发，见下），保留字段只为调用方签名稳定。 */
  aspectRatio?: string;
  /** 参考图请求模式（保留字段：现在所有模式都原话直发，不再参与分支） */
  mode?: ImageReferenceRequestMode;
}

/** 历史上唯一被豁免的模式（等价官方 `scene:"image-edit"`）。
 *  ⚠️ 现在**所有模式都原话直发**，这个判定只用于文档/兼容，不再参与分支。 */
export function isVerbatimPromptMode(mode?: ImageReferenceRequestMode): boolean {
  return mode === 'edits-json-images';
}

/** 项目风格母图那一行（只有 MTV 才知道「哪张是母图」，所以即使原话直发也要保留） */
function styleMasterHint(referenceCount: number): string[] {
  return [
    '【项目风格母图】图片1 为当前项目统一风格参考。',
    '请严格遵循其画风、色彩、材质、光影与整体气质；不要复制母图中的具体人物、场景或构图，只迁移视觉风格。',
    ...(referenceCount > 1
      ? [`【内容参考图】图片2…图片${referenceCount} 为角色/场景等内容参考：主体、造型与设定必须保留延续，风格仍服从母图。`]
      : []),
  ];
}

export function buildImagePrompt(options: BuildImagePromptOptions): string {
  const { rawPrompt, referenceCount, styleAsFirst } = options;
  if (referenceCount <= 0) return rawPrompt;

  /* ★★ 一律**原话直发**（对齐官方）—— 不看 provider、不看参考图模式（用户 2026：
     「不要单纯只针对土豆，未来适配进来的厂商也要适配」）。
     唯一补的是 MTV 独有的「项目风格母图」那一行：哪张图是母图只有我们才知道。 */
  if (!styleAsFirst) return rawPrompt;
  return [...styleMasterHint(referenceCount), '', rawPrompt].join('\n');
}
