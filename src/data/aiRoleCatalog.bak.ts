/**
 * AiRoleCatalog —— 官方「AI角色库」目录数据（**从官方窗口 9444 实测抽取，勿手改**）
 *
 * 抽取脚本：`D:\DEEPSEEK\t865-gen-airole-data.mjs`
 *  - 卡片（90 张）：官方 `role=dialog` 弹窗原文 DOM（`t825-D-airole.html`，打开时的默认「全部角色」首屏）
 *    每张 = 官方三段原文：`<img src alt=名称>` + `<span class="text-sm font-medium text-white/90 …">名称</span>`
 *    + `<p class="text-xs text-white/50 …">性别 · 年龄段 · 体格 · 气质</p>`
 *  - 两级分类树（36 项）：官方左列全展开实测（`t861-airole-catalog2.json`）；
 *    「当代现实 / 科幻未来 / 架空幻想」官方**无子类**
 *  - 筛选组 9 个：官方 chip 原文顺序；其中 **4 个（性别/年龄段/体格/气质）**的取值可由卡片副标题推导
 *    （官方副标题恰好只含这 4 维），另外 5 维（物种/身高/肤色/发长/发色）无数据来源。
 *
 * ⚠️ 图片是官方 CDN（`files.tapnow.media`）直链；离线或防盗链时卡片图区为空，但布局/尺寸仍为官方值。
 */

export interface AiRoleCharacter {
  name: string;
  /** 官方副标题：性别 · 年龄段 · 体格 · 气质 */
  meta: string;
  /** 官方 CDN 图片（`variant_name=small`） */
  img: string;
  /** 副标题 4 格（供筛选） */
  slots: [string, string, string, string];
}

export interface AiRoleCategory {
  label: string;
  children?: string[];
}

/** 官方左列两级分类（原文顺序；默认选中「全部角色」，默认**不展开**任何分类） */
export const AI_ROLE_TREE: AiRoleCategory[] = [
  { label: '全部角色' },
  { label: '古代历史', children: ['日本·战国至江户', '中国·唐宋', '中国·先秦', '韩国·朝鲜王朝', '中国·明清', '欧洲·古希腊', '美洲·美洲古文明', '东南亚·吴哥/暹罗', '北欧·维京时代', '欧洲·古罗马', '非洲·古非洲王国', '中东·波斯帝国', '北非·古埃及', '南亚·古印度', '欧洲·中世纪', '中东·奥斯曼帝国'] },
  { label: '近代历史', children: ['美国·西部拓荒', '欧洲·大航海时代', '欧洲·文艺复兴', '跨区域·殖民时代', '欧洲·维多利亚时代', '美国·南北战争', '中国·晚清', '南亚·殖民时代', '欧洲·巴洛克/洛可可', '跨区域·海盗时代', '欧洲·拿破仑时代', '拉美·独立革命', '日本·明治时代', '非洲·殖民前后'] },
  { label: '当代现实' },
  { label: '科幻未来' },
  { label: '架空幻想' },
];

/** 官方筛选组（9 个 chip 原文顺序；每个 chip 前是 plus 图标） */
export const AI_ROLE_FILTERS = ['性别', '年龄段', '物种', '体格', '身高', '肤色', '发长', '发色', '气质'] as const;

/** 有数据来源的筛选维度（其余 5 维官方目录里没有字段，MTV 渲染为不可用态） */
export const AI_ROLE_FILTER_VALUES: Record<string, string[]> = {
  '性别': ['男', '女', '中性'],
  '年龄段': ['青年', '中年', '老年', '少年', '幼年'],
  '物种': ['人类', '机械体', '妖怪', '其他', '神明', '亡灵', '外星种族', '精灵', '兽人', '矮人'],
  '体格': ['纤细', '标准', '健壮', '壮硕', '非人形'],
  '身高': ['中等', '高挑', '矮小'],
  '肤色': ['中等', '浅', '深', '极浅', '极深', '非自然色'],
  '发长': ['短发', '长发', '中长', '极短', '遮盖', '光头'],
  '发色': [],
  '气质': ['飒爽', '清冷', '稚嫩', '威严', '温柔', '儒雅', '憨厚', '沧桑', '霸气', '阴鸷', '妩媚', '癫狂'],
};

/** 官方卡片目录（90 条，官方原文顺序） */
export const AI_ROLE_CHARACTERS: AiRoleCharacter[] = [
  { name: '诸侯国君', meta: '男 · 中年 · 壮硕 · 威严', img: 'https://files.tapnow.media/api/conversation/storage/uploads/88a2f8f4-7fb3-4bee-84e4-b69c38e277f9?variant_name=small', slots: ['男', '中年', '壮硕', '威严'] },
  { name: '游说学子', meta: '男 · 青年 · 纤细 · 儒雅', img: 'https://files.tapnow.media/api/conversation/storage/uploads/c0c69b13-f2cb-4a91-b574-047aee61bf2e?variant_name=small', slots: ['男', '青年', '纤细', '儒雅'] },
  { name: '从军女将', meta: '女 · 青年 · 健壮 · 飒爽', img: 'https://files.tapnow.media/api/conversation/storage/uploads/0c98288f-a553-4086-b4fe-f1b2a43a6225?variant_name=small', slots: ['女', '青年', '健壮', '飒爽'] },
  { name: '饱经战乱的农夫', meta: '男 · 老年 · 纤细 · 沧桑', img: 'https://files.tapnow.media/api/conversation/storage/uploads/9777938d-1888-46ea-8dac-eb03bdcc9c84?variant_name=small', slots: ['男', '老年', '纤细', '沧桑'] },
  { name: '贵族卿大夫之女', meta: '女 · 青年 · 标准 · 温柔', img: 'https://files.tapnow.media/api/conversation/storage/uploads/e24d4e91-2d88-4bd7-a8b1-eacf87cd7d1b?variant_name=small', slots: ['女', '青年', '标准', '温柔'] },
  { name: '幕后权谋策士', meta: '男 · 中年 · 纤细 · 阴鸷', img: 'https://files.tapnow.media/api/conversation/storage/uploads/67913cb4-6b78-481d-b4cb-4e1cf8c74912?variant_name=small', slots: ['男', '中年', '纤细', '阴鸷'] },
  { name: '守城士卒', meta: '男 · 青年 · 壮硕 · 憨厚', img: 'https://files.tapnow.media/api/conversation/storage/uploads/a788d138-1221-4866-8077-4b631ccce76c?variant_name=small', slots: ['男', '青年', '壮硕', '憨厚'] },
  { name: '私塾学子', meta: '男 · 少年 · 纤细 · 稚嫩', img: 'https://files.tapnow.media/api/conversation/storage/uploads/b15fd88d-2884-4730-9234-a0c675aea012?variant_name=small', slots: ['男', '少年', '纤细', '稚嫩'] },
  { name: '宫廷乐舞伎', meta: '女 · 青年 · 纤细 · 妩媚', img: 'https://files.tapnow.media/api/conversation/storage/uploads/039022ac-13fa-4f46-ae3f-b021c9ec7a4a?variant_name=small', slots: ['女', '青年', '纤细', '妩媚'] },
  { name: '统兵大将军', meta: '男 · 中年 · 壮硕 · 霸气', img: 'https://files.tapnow.media/api/conversation/storage/uploads/cffc98fd-ecea-47f3-8be5-95831e8dd19f?variant_name=small', slots: ['男', '中年', '壮硕', '霸气'] },
  { name: '山野隐逸狂人', meta: '男 · 老年 · 纤细 · 癫狂', img: 'https://files.tapnow.media/api/conversation/storage/uploads/7dcb5a97-0bd8-45bf-bd6b-d0643adbf718?variant_name=small', slots: ['男', '老年', '纤细', '癫狂'] },
  { name: '铸剑名匠', meta: '男 · 中年 · 壮硕 · 憨厚', img: 'https://files.tapnow.media/api/conversation/storage/uploads/fe5b9015-916a-444c-a0a1-90bfd68a3893?variant_name=small', slots: ['男', '中年', '壮硕', '憨厚'] },
  { name: '墨家游侠', meta: '女 · 少年 · 健壮 · 飒爽', img: 'https://files.tapnow.media/api/conversation/storage/uploads/3be4e849-e7e0-469b-986f-7b7fc635c48b?variant_name=small', slots: ['女', '少年', '健壮', '飒爽'] },
  { name: '失国公主', meta: '女 · 少年 · 纤细 · 清冷', img: 'https://files.tapnow.media/api/conversation/storage/uploads/0b022e1b-cb09-4ae8-b33c-4b22875af9af?variant_name=small', slots: ['女', '少年', '纤细', '清冷'] },
  { name: '奔走列国的使臣', meta: '男 · 老年 · 标准 · 沧桑', img: 'https://files.tapnow.media/api/conversation/storage/uploads/67a7780e-f872-4f79-839d-5b350b71b818?variant_name=small', slots: ['男', '老年', '标准', '沧桑'] },
  { name: '王府侍女', meta: '女 · 少年 · 标准 · 稚嫩', img: 'https://files.tapnow.media/api/conversation/storage/uploads/281f5ff5-c644-4f9c-a5d0-e3ee0ef45e69?variant_name=small', slots: ['女', '少年', '标准', '稚嫩'] },
  { name: '通灵大祝', meta: '男 · 老年 · 纤细 · 威严', img: 'https://files.tapnow.media/api/conversation/storage/uploads/0073c38c-a2cf-4cd6-9ed2-8f29fc456175?variant_name=small', slots: ['男', '老年', '纤细', '威严'] },
  { name: '一方诸侯国君', meta: '男 · 老年 · 健壮 · 威严', img: 'https://files.tapnow.media/api/conversation/storage/uploads/0ea6afa7-5bf7-46c3-9df8-dc784eb05fe6?variant_name=small', slots: ['男', '老年', '健壮', '威严'] },
  { name: '卿大夫之女', meta: '女 · 青年 · 纤细 · 温柔', img: 'https://files.tapnow.media/api/conversation/storage/uploads/e1e0bf81-4023-49ef-bd7e-7d32fa9c63a3?variant_name=small', slots: ['女', '青年', '纤细', '温柔'] },
  { name: '游学士子', meta: '男 · 青年 · 标准 · 儒雅', img: 'https://files.tapnow.media/api/conversation/storage/uploads/d8e398e8-8f46-4f7c-b3b1-1149000e60b1?variant_name=small', slots: ['男', '青年', '标准', '儒雅'] },
  { name: '边境守将', meta: '男 · 中年 · 壮硕 · 霸气', img: 'https://files.tapnow.media/api/conversation/storage/uploads/b334e1cb-6ec1-4de0-9520-81ec8bc6351a?variant_name=small', slots: ['男', '中年', '壮硕', '霸气'] },
  { name: '刺客组织成员', meta: '女 · 青年 · 纤细 · 清冷', img: 'https://files.tapnow.media/api/conversation/storage/uploads/494cf8f9-2746-4836-8892-7a9d967f4608?variant_name=small', slots: ['女', '青年', '纤细', '清冷'] },
  { name: '王室幼子', meta: '男 · 幼年 · 纤细 · 稚嫩', img: 'https://files.tapnow.media/api/conversation/storage/uploads/1e730e86-fc11-4a76-84b3-fca03b613736?variant_name=small', slots: ['男', '幼年', '纤细', '稚嫩'] },
  { name: '掌权王后', meta: '女 · 中年 · 标准 · 威严', img: 'https://files.tapnow.media/api/conversation/storage/uploads/314599e3-b56b-4dfb-b9bf-0c8645b64428?variant_name=small', slots: ['女', '中年', '标准', '威严'] },
  { name: '纵横家说客', meta: '男 · 青年 · 纤细 · 阴鸷', img: 'https://files.tapnow.media/api/conversation/storage/uploads/7ab6251c-816c-4a39-8b10-843010d04c43?variant_name=small', slots: ['男', '青年', '纤细', '阴鸷'] },
  { name: '隐遁老农', meta: '男 · 老年 · 纤细 · 沧桑', img: 'https://files.tapnow.media/api/conversation/storage/uploads/ac63f885-df45-40e4-83de-cc7598197ae5?variant_name=small', slots: ['男', '老年', '纤细', '沧桑'] },
  { name: '将门习武少女', meta: '女 · 少年 · 标准 · 飒爽', img: 'https://files.tapnow.media/api/conversation/storage/uploads/ed5e9faf-bfb5-40a6-a801-c7160ce0ba37?variant_name=small', slots: ['女', '少年', '标准', '飒爽'] },
  { name: '墨家工匠', meta: '男 · 中年 · 健壮 · 憨厚', img: 'https://files.tapnow.media/api/conversation/storage/uploads/55ecbeff-e8a6-4b17-9da5-4d24cd23aa37?variant_name=small', slots: ['男', '中年', '健壮', '憨厚'] },
  { name: '宫廷舞姬', meta: '女 · 青年 · 纤细 · 妩媚', img: 'https://files.tapnow.media/api/conversation/storage/uploads/5ac5611e-570a-442a-a5ec-93d5aaaadc35?variant_name=small', slots: ['女', '青年', '纤细', '妩媚'] },
  { name: '落魄雇佣兵', meta: '男 · 中年 · 壮硕 · 沧桑', img: 'https://files.tapnow.media/api/conversation/storage/uploads/077be6de-9802-4b69-bfee-b302efd1053e?variant_name=small', slots: ['男', '中年', '壮硕', '沧桑'] },
  { name: '王府老乳母', meta: '女 · 老年 · 标准 · 温柔', img: 'https://files.tapnow.media/api/conversation/storage/uploads/4817254d-efdc-4e07-a812-87c833081ad2?variant_name=small', slots: ['女', '老年', '标准', '温柔'] },
  { name: '死士死刑犯', meta: '男 · 青年 · 壮硕 · 癫狂', img: 'https://files.tapnow.media/api/conversation/storage/uploads/43d0d0e6-89ba-41b8-a5b2-b8c8c84e0f03?variant_name=small', slots: ['男', '青年', '壮硕', '癫狂'] },
  { name: '跨国大商人', meta: '女 · 中年 · 标准 · 飒爽', img: 'https://files.tapnow.media/api/conversation/storage/uploads/1b7d4126-af4a-4497-acb9-867c06beb756?variant_name=small', slots: ['女', '中年', '标准', '飒爽'] },
  { name: '统兵将帅', meta: '男 · 中年 · 壮硕 · 威严', img: 'https://files.tapnow.media/api/conversation/storage/uploads/1d96718b-2e9a-4873-8804-c629a53e3244?variant_name=small', slots: ['男', '中年', '壮硕', '威严'] },
  { name: '士大夫之女', meta: '女 · 青年 · 纤细 · 清冷', img: 'https://files.tapnow.media/api/conversation/storage/uploads/f903f3c3-8e26-4d83-9bd4-bd6f7199bf5a?variant_name=small', slots: ['女', '青年', '纤细', '清冷'] },
  { name: '游说诸子', meta: '男 · 老年 · 标准 · 儒雅', img: 'https://files.tapnow.media/api/conversation/storage/uploads/ded0d808-8c63-4e52-a51d-230050062ce3?variant_name=small', slots: ['男', '老年', '标准', '儒雅'] },
  { name: '宫廷侍女', meta: '女 · 少年 · 纤细 · 稚嫩', img: 'https://files.tapnow.media/api/conversation/storage/uploads/70ecc4f3-f4b3-48f9-9eba-8f6f409fc69e?variant_name=small', slots: ['女', '少年', '纤细', '稚嫩'] },
  { name: '赵国骑兵', meta: '男 · 青年 · 健壮 · 飒爽', img: 'https://files.tapnow.media/api/conversation/storage/uploads/e2981ea2-e63e-464a-9504-12ac03767ae2?variant_name=small', slots: ['男', '青年', '健壮', '飒爽'] },
  { name: '城防工匠', meta: '男 · 中年 · 壮硕 · 憨厚', img: 'https://files.tapnow.media/api/conversation/storage/uploads/2fcceb3b-075b-426a-9d30-0e4f7096870e?variant_name=small', slots: ['男', '中年', '壮硕', '憨厚'] },
  { name: '贵族主母', meta: '女 · 中年 · 标准 · 温柔', img: 'https://files.tapnow.media/api/conversation/storage/uploads/5085f34f-e6c5-4105-b87b-e1fc39a9fdf3?variant_name=small', slots: ['女', '中年', '标准', '温柔'] },
  { name: '秦国密探', meta: '男 · 青年 · 纤细 · 阴鸷', img: 'https://files.tapnow.media/api/conversation/storage/uploads/953bedfd-60a0-4c4f-be12-620c2f399a11?variant_name=small', slots: ['男', '青年', '纤细', '阴鸷'] },
  { name: '战国诸侯', meta: '男 · 中年 · 标准 · 霸气', img: 'https://files.tapnow.media/api/conversation/storage/uploads/c26958ca-b63c-4602-b54a-09008047af47?variant_name=small', slots: ['男', '中年', '标准', '霸气'] },
  { name: '乐府舞姬', meta: '女 · 青年 · 纤细 · 妩媚', img: 'https://files.tapnow.media/api/conversation/storage/uploads/51516237-2258-4e8c-a4ea-83c5a933cabb?variant_name=small', slots: ['女', '青年', '纤细', '妩媚'] },
  { name: '求学学子', meta: '男 · 少年 · 标准 · 清冷', img: 'https://files.tapnow.media/api/conversation/storage/uploads/8aeb6cb0-085f-435c-bd08-95bdf91785da?variant_name=small', slots: ['男', '少年', '标准', '清冷'] },
  { name: '边境女猎户', meta: '女 · 青年 · 健壮 · 飒爽', img: 'https://files.tapnow.media/api/conversation/storage/uploads/4c81f0dd-2c99-41da-8fd7-f42d84c0fd29?variant_name=small', slots: ['女', '青年', '健壮', '飒爽'] },
  { name: '跨国商人', meta: '男 · 中年 · 标准 · 沧桑', img: 'https://files.tapnow.media/api/conversation/storage/uploads/c983dec2-4980-4bfd-ac73-528ac02c875e?variant_name=small', slots: ['男', '中年', '标准', '沧桑'] },
  { name: '宫廷舞姬', meta: '女 · 青年 · 纤细 · 妩媚', img: 'https://files.tapnow.media/api/conversation/storage/uploads/620158c2-c55c-471a-b706-34f562809c78?variant_name=small', slots: ['女', '青年', '纤细', '妩媚'] },
  { name: '当朝高官', meta: '男 · 中年 · 健壮 · 威严', img: 'https://files.tapnow.media/api/conversation/storage/uploads/44dd31a2-4ad7-471d-875a-472f0651bd39?variant_name=small', slots: ['男', '中年', '健壮', '威严'] },
  { name: '清流名士', meta: '男 · 青年 · 标准 · 儒雅', img: 'https://files.tapnow.media/api/conversation/storage/uploads/5dc2ac2a-dfe1-47ca-b82e-43fd75bfad05?variant_name=small', slots: ['男', '青年', '标准', '儒雅'] },
  { name: '码头苦力', meta: '男 · 中年 · 壮硕 · 憨厚', img: 'https://files.tapnow.media/api/conversation/storage/uploads/10ec69b2-5f72-40a2-82ac-831662195550?variant_name=small', slots: ['男', '中年', '壮硕', '憨厚'] },
  { name: '市井货郎之女', meta: '女 · 少年 · 纤细 · 稚嫩', img: 'https://files.tapnow.media/api/conversation/storage/uploads/24da1763-71e6-4b09-8017-80b1730057da?variant_name=small', slots: ['女', '少年', '纤细', '稚嫩'] },
  { name: '内廷近侍', meta: '中性 · 青年 · 标准 · 温柔', img: 'https://files.tapnow.media/api/conversation/storage/uploads/163e40e7-a8b8-43e9-ba0b-335e39c862d5?variant_name=small', slots: ['中性', '青年', '标准', '温柔'] },
  { name: '宫廷炼丹术士', meta: '男 · 老年 · 纤细 · 清冷', img: 'https://files.tapnow.media/api/conversation/storage/uploads/815a7e5e-2611-459b-a33e-1f65e267f6c4?variant_name=small', slots: ['男', '老年', '纤细', '清冷'] },
  { name: '禁卫军统领', meta: '男 · 青年 · 壮硕 · 霸气', img: 'https://files.tapnow.media/api/conversation/storage/uploads/69629c3e-b9d0-45dc-b09f-acb46e0d184e?variant_name=small', slots: ['男', '青年', '壮硕', '霸气'] },
  { name: '富户幼童', meta: '女 · 幼年 · 标准 · 稚嫩', img: 'https://files.tapnow.media/api/conversation/storage/uploads/54e22fdf-28d2-4982-af43-b1adbc32f401?variant_name=small', slots: ['女', '幼年', '标准', '稚嫩'] },
  { name: '市井女侠客', meta: '女 · 青年 · 健壮 · 飒爽', img: 'https://files.tapnow.media/api/conversation/storage/uploads/a2009c54-fb71-4d43-8a2d-05d71dd3a66b?variant_name=small', slots: ['女', '青年', '健壮', '飒爽'] },
  { name: '黑市商贾', meta: '男 · 中年 · 标准 · 阴鸷', img: 'https://files.tapnow.media/api/conversation/storage/uploads/1ae7b320-47ff-4e4e-86ed-a4a1de2195b1?variant_name=small', slots: ['男', '中年', '标准', '阴鸷'] },
  { name: '落魄乐伎', meta: '女 · 青年 · 纤细 · 清冷', img: 'https://files.tapnow.media/api/conversation/storage/uploads/df67f305-0bfc-42f3-a851-358f98a7c884?variant_name=small', slots: ['女', '青年', '纤细', '清冷'] },
  { name: '酒楼掌柜', meta: '女 · 老年 · 标准 · 沧桑', img: 'https://files.tapnow.media/api/conversation/storage/uploads/fcce77af-a9ef-46f3-8c6d-398eedcbfaa4?variant_name=small', slots: ['女', '老年', '标准', '沧桑'] },
  { name: '书院小童', meta: '男 · 少年 · 纤细 · 稚嫩', img: 'https://files.tapnow.media/api/conversation/storage/uploads/66a72fe8-0477-441f-8d85-37fda68b7ed2?variant_name=small', slots: ['男', '少年', '纤细', '稚嫩'] },
  { name: '落第狂生', meta: '男 · 青年 · 标准 · 癫狂', img: 'https://files.tapnow.media/api/conversation/storage/uploads/c10410b2-3949-42fe-a9c6-069fa2c5423d?variant_name=small', slots: ['男', '青年', '标准', '癫狂'] },
  { name: '官家夫人', meta: '女 · 中年 · 标准 · 温柔', img: 'https://files.tapnow.media/api/conversation/storage/uploads/5b871fb4-cbf0-45a3-b8d5-8575530d9a1e?variant_name=small', slots: ['女', '中年', '标准', '温柔'] },
  { name: '深闺才女', meta: '女 · 青年 · 标准 · 清冷', img: 'https://files.tapnow.media/api/conversation/storage/uploads/c63240e0-b518-4ab5-9adb-a72ef58b8028?variant_name=small', slots: ['女', '青年', '标准', '清冷'] },
  { name: '勋贵子弟', meta: '男 · 青年 · 健壮 · 飒爽', img: 'https://files.tapnow.media/api/conversation/storage/uploads/fe1adc73-d3ad-4525-82cc-39b768f8cd45?variant_name=small', slots: ['男', '青年', '健壮', '飒爽'] },
  { name: '高冷女官', meta: '女 · 青年 · 纤细 · 清冷', img: 'https://files.tapnow.media/api/conversation/storage/uploads/7946ac40-625d-4e7e-8f4b-84db6f658b03?variant_name=small', slots: ['女', '青年', '纤细', '清冷'] },
  { name: '市井货郎', meta: '男 · 老年 · 标准 · 憨厚', img: 'https://files.tapnow.media/api/conversation/storage/uploads/78a76487-b1cf-43ee-979b-1a17354dead6?variant_name=small', slots: ['男', '老年', '标准', '憨厚'] },
  { name: '官宦家童', meta: '中性 · 少年 · 纤细 · 稚嫩', img: 'https://files.tapnow.media/api/conversation/storage/uploads/181a3b8e-a3a9-4009-8d36-30ac7e3741e4?variant_name=small', slots: ['中性', '少年', '纤细', '稚嫩'] },
  { name: '翰林学士', meta: '男 · 青年 · 纤细 · 儒雅', img: 'https://files.tapnow.media/api/conversation/storage/uploads/97fd2bf8-0b92-4c7c-a565-60398c378164?variant_name=small', slots: ['男', '青年', '纤细', '儒雅'] },
  { name: '宫廷侍女', meta: '女 · 青年 · 标准 · 温柔', img: 'https://files.tapnow.media/api/conversation/storage/uploads/3756f0c0-09fb-49e2-9db6-10c8500284f0?variant_name=small', slots: ['女', '青年', '标准', '温柔'] },
  { name: '内廷宦官', meta: '男 · 中年 · 纤细 · 阴鸷', img: 'https://files.tapnow.media/api/conversation/storage/uploads/66f9d0c4-4787-4990-9fb2-1fa500416906?variant_name=small', slots: ['男', '中年', '纤细', '阴鸷'] },
  { name: '镖局女教头', meta: '女 · 中年 · 健壮 · 飒爽', img: 'https://files.tapnow.media/api/conversation/storage/uploads/b4c45cc6-1b3a-457a-ad5b-6ce3092cac61?variant_name=small', slots: ['女', '中年', '健壮', '飒爽'] },
  { name: '西域胡商', meta: '男 · 青年 · 健壮 · 霸气', img: 'https://files.tapnow.media/api/conversation/storage/uploads/2ac95fa0-8b24-4a26-9e7d-929bf049d455?variant_name=small', slots: ['男', '青年', '健壮', '霸气'] },
  { name: '落魄老诗人', meta: '男 · 老年 · 纤细 · 沧桑', img: 'https://files.tapnow.media/api/conversation/storage/uploads/a8c0e9a2-f6c3-474e-90dd-c8e52155c701?variant_name=small', slots: ['男', '老年', '纤细', '沧桑'] },
  { name: '皇室公主', meta: '女 · 青年 · 纤细 · 威严', img: 'https://files.tapnow.media/api/conversation/storage/uploads/6bd0d104-61e1-486a-b88d-89ee8592e46d?variant_name=small', slots: ['女', '青年', '纤细', '威严'] },
  { name: '江湖杂耍人', meta: '男 · 青年 · 健壮 · 飒爽', img: 'https://files.tapnow.media/api/conversation/storage/uploads/b070d5f1-f025-4cf9-bcb4-9c313b018659?variant_name=small', slots: ['男', '青年', '健壮', '飒爽'] },
  { name: '教坊乐伎', meta: '女 · 青年 · 纤细 · 妩媚', img: 'https://files.tapnow.media/api/conversation/storage/uploads/a3e97a40-40b0-4427-8556-e07c512e35c2?variant_name=small', slots: ['女', '青年', '纤细', '妩媚'] },
  { name: '游方僧人', meta: '男 · 中年 · 纤细 · 儒雅', img: 'https://files.tapnow.media/api/conversation/storage/uploads/d624bbe5-006c-4579-83af-6c5743f6c94b?variant_name=small', slots: ['男', '中年', '纤细', '儒雅'] },
  { name: '街头疯丐', meta: '男 · 老年 · 纤细 · 癫狂', img: 'https://files.tapnow.media/api/conversation/storage/uploads/3d6f08f8-f86a-48fe-ae83-9a2315a2aeb5?variant_name=small', slots: ['男', '老年', '纤细', '癫狂'] },
  { name: '年轻校尉', meta: '男 · 少年 · 标准 · 飒爽', img: 'https://files.tapnow.media/api/conversation/storage/uploads/5c2e2c55-5bbb-4db6-a114-6bdf406049c0?variant_name=small', slots: ['男', '少年', '标准', '飒爽'] },
  { name: '世家主母', meta: '女 · 老年 · 标准 · 威严', img: 'https://files.tapnow.media/api/conversation/storage/uploads/b8cef38f-e94f-4334-82bf-edf1468b28c4?variant_name=small', slots: ['女', '老年', '标准', '威严'] },
  { name: '宫廷贵妃', meta: '女 · 青年 · 纤细 · 温柔', img: 'https://files.tapnow.media/api/conversation/storage/uploads/46dc6a1e-82b4-4764-975e-f4cf7a42338e?variant_name=small', slots: ['女', '青年', '纤细', '温柔'] },
  { name: '三品朝臣', meta: '男 · 中年 · 标准 · 威严', img: 'https://files.tapnow.media/api/conversation/storage/uploads/c410a128-e77b-4541-a32a-dc8ae21208dc?variant_name=small', slots: ['男', '中年', '标准', '威严'] },
  { name: '禁军将领', meta: '男 · 青年 · 壮硕 · 霸气', img: 'https://files.tapnow.media/api/conversation/storage/uploads/70eea01a-d902-40e2-ace9-7311399c9ba8?variant_name=small', slots: ['男', '青年', '壮硕', '霸气'] },
  { name: '市井书生', meta: '男 · 少年 · 纤细 · 儒雅', img: 'https://files.tapnow.media/api/conversation/storage/uploads/821484c1-57cd-4bc5-99f3-178c3b569b39?variant_name=small', slots: ['男', '少年', '纤细', '儒雅'] },
  { name: '富家幼女', meta: '女 · 幼年 · 标准 · 稚嫩', img: 'https://files.tapnow.media/api/conversation/storage/uploads/f3be31d4-7f58-459e-9565-2a348f1febc4?variant_name=small', slots: ['女', '幼年', '标准', '稚嫩'] },
  { name: '集市摊主', meta: '男 · 老年 · 标准 · 沧桑', img: 'https://files.tapnow.media/api/conversation/storage/uploads/b414f32b-9627-4290-a684-ecc340af9967?variant_name=small', slots: ['男', '老年', '标准', '沧桑'] },
  { name: '公府侍卫', meta: '女 · 青年 · 健壮 · 飒爽', img: 'https://files.tapnow.media/api/conversation/storage/uploads/d34d5bf8-7d41-42fe-b988-f7c4b3d3f680?variant_name=small', slots: ['女', '青年', '健壮', '飒爽'] },
  { name: '内廷内监', meta: '男 · 青年 · 纤细 · 清冷', img: 'https://files.tapnow.media/api/conversation/storage/uploads/b497e64b-7dc2-4375-bf5b-584c65ce5daa?variant_name=small', slots: ['男', '青年', '纤细', '清冷'] },
  { name: '教坊舞姬', meta: '女 · 青年 · 纤细 · 妩媚', img: 'https://files.tapnow.media/api/conversation/storage/uploads/800d0c8a-1531-4b3e-9cb9-72f3a3b8c403?variant_name=small', slots: ['女', '青年', '纤细', '妩媚'] },
  { name: '山间樵夫', meta: '男 · 中年 · 健壮 · 憨厚', img: 'https://files.tapnow.media/api/conversation/storage/uploads/829298f3-f7c0-4e1d-b40c-54b499cd2531?variant_name=small', slots: ['男', '中年', '健壮', '憨厚'] },
];

/** 分类/细类 → 角色名集合（官方逐类实测采集；尚未采到时为空 ⇒ 过滤为 no-op） */
export const AI_ROLE_SET_MEMBERSHIP: Record<string, string[]> = {
  '科幻未来': ["企业高级特工","地下黑市医生","街头黑客","古董数据贩子","街头雇佣兵","帮派头目","街头信使","城市治安官","赛博酒吧老板娘","机械学徒","虚拟实境架构师","企业处刑人","仿生人艺术家","地下社区长老","街头跑酷者","黑市拳击手","企业财务总监","原型AI测试机","赛博夜店舞者","非法数据快递员","黑市义体医生","企业高级间谍","街头流浪儿","自由雇佣兵","赛博教派祭司","暗网清道夫","地下情报掮客","旧城区机械修理师","迷幻电子乐黑客","霓虹街区帮派头目","人工智能实体化身","治安维持局特工","企业高层执行官","高科技温室儿童","地下竞速车手","地下数据传送员","贫民窟黑市打手","街头导航AI实体","企业雇佣兵","废墟信息掮客","霓虹俱乐部舞者","高层特勤保镖","电子禅修导师","地下义肢修理师","街头骇客少年","合成植物培育员","黑市禁药商人","帮派跑腿小妹","地下格斗拳手","反叛军黑客","企业执行官","黑市信息贩子","地下义体医生","企业高级保镖","贫民窟流浪儿","深度网路沉溺者","企业间谍","废料场头目","企业基因工程师","城市极速快递员","影子暗杀者","街头帮派大姐大","走私飞艇驾驶员","荒野拾荒者","企业前台导览","天才黑客少年","反叛军精神领袖","街头非法赛车手","贫民窟机械修理工","贪腐企业高管","地下暗杀者","地下诊所医生","废料场回收商","雇佣兵团长","人工智能交互实体","霓虹酒吧情报员","荒野拾荒暴徒","反叛军学徒工","企业法务调查员","城市历史记忆保管者","企业高级执行官","地下反抗组织首领","企业暗杀仿生人","企业特遣队队员","情报掮客","街头帮派成员","企业总部接待员","黑市义体改造师","码头重型搬运工","垃圾场拾荒者","受雇佣的反叛军战士","部落议事长老","都市巡游骑手","网络数据实体","贫民窟天才黑客","义体维修技师","霓虹俱乐部公关","都市防卫队指挥官","垂直农场培育员","地下赏金猎人","移动医疗机器人","部族记忆库守护者","霓虹帮派头目","过气电子乐手","都市潜行探员","都市议政厅高层官员","科技都市巡逻卫兵","高精度数据分析员","地下都市涂鸦黑客","全息剧场首席舞者","都市植物园研究员","废料场回收监管者","企业间谍刺客","地底矿脉开采工","合成生物学专家","都市快递穿梭者","都市防卫军指挥官","科技竞技场业余选手","高阶人工智能向导","科技外交官","都市卫队指挥官","城市跑酷信使","部族议事长","地下受雇佣兵","科技学校学生","重工业维护机甲","电子废料回收者","赛博涂鸦艺术家","都市生态架构师","地热能矿工","虚拟演艺明星","街头科技玩家","都市安全主管","星际母舰舰长","首席导航员","舰载AI实体化身","机库维修学徒","陆战队指挥官","星际史官","异星生物学家","首席医官","母舰安保队长","秘密情报官","反应堆工程师","外交礼宾官","异星议会代表","高阶将领家属","王牌飞行员","星图分析师","重型设备操作员","遗传学研究员","首席科学官","母舰维修技师","随舰医生","资深轮机长","安全主管","中央人工智能实体","情报分析官","能源实验室专家","母舰政务官","外语联络员","突击队指挥官","母舰特工","生化实验室员","舰载机王牌飞行员","母舰结构总工","母舰最高指挥官","首席星际导航员","舰桥AI交互中枢","首席轮机工程师","舰桥安全官","动力室高级技工","母舰首席医官","深空通讯专家","舰桥实习生","异星文化联络员","重型武器大师","资深穿梭机飞行员","舰内情报调查官","外壳维修兵","地质采样分析员","星球土著遗孤","报废区安保主管","物资运输机驾驶员","殖民地防卫军士官","殖民星行政长官","中央情报处理单元","殖民者后代","温室植物园医生","荒原拾荒者首领","殖民地酒吧服务生","重型设备维修工","殖民地侦察学徒","殖民地史官","异星生物联络员","殖民地治安队长","新晋地质勘探员","殖民地导航AI","太空站速递员","殖民地执政官","安保队长","生物实验室研究员","穿梭机维修工","重型仓储机器人"],
  '架空幻想': ["仙门掌教","剑道首席弟子","戒律堂长老","藏经阁记录员","掌门关门弟子","巡山护法弟子","炼丹房医修","灵兽峰峰主","灵田管事","影卫堂刺客","护宗神兽幻化形态","合欢峰亲传弟子","铸剑池铁匠","秘境试炼狂人","外门杂役童子","后山闭关隐修","御兽堂训导员","执法堂大长老","外门采药弟子","门派守护灵兽化形","藏经阁守阁人","演武场教头","合欢宗交流修士","炼器房学徒","灵植园看守","佛道双修护法","内门巡逻弟子","门派禁地残魂祖师","体修一脉弟子","阵法堂核心弟子","丹药房长老","潜入宗门的魔修间谍","乱葬岗通灵者","掌门大长老","真传剑修弟子","外门执勤弟子","护山大阵阵灵","山门守卫","执法堂女修","潜伏的魔道散修","灵药峰长老","依附门派的妖修","镇派机关傀儡","入门小弟子","剑峰峰主","医道女修","隐世扫地僧","天庭神威大将军","魔界先锋猛将","仙宫首席乐师","魔界影卫刺客","天庭文曲星官","魔界巨兽骑兵队长","太阳神殿灵体守卫","魔界幽冥 Countess","莲花童子亲传弟子","魔界灵魂编织者","巡天龙卫女队长","魔界深渊典狱长","仙界御马监仙娥","魔界至尊魔皇","天庭通天录史官","魔界至尊小公主","须弥界金刚护法","魔界远古祭司","天庭镇守大将","魔界暗杀者","天庭雷部统领","天宫巡界使","天庭文职仙官","魔界先锋悍将","天庭传令童子","魔界边境祭司","天庭神庙守卫","魔界魅影领主","天庭神兽骑兵","魔界重装骑兵","天庭医官","魔界侦察兵","神兽幼崽","天庭剑仙","魔界长老","魔界督战官","仙门关门弟子","魔界斥候队长","灵狐族幼崽","仙界采药隐士","天工阁护法傀儡","魔宫魅惑祭司","魔界军团统帅","百花谷引路精灵","四海龙族太子","魔界刑罚长老","九天玄女官","仙兽园学徒","魔界禁地囚徒","正派一门之主","门派新入门弟子","暗杀门派刺客","隐世门派长老","外家功夫高手","名门女剑客","浪迹江湖的游侠","邪派女掌门","游方僧人","擅长用毒的毒师","镖局押镖武师","大漠刀客","琴剑双绝弟子","情报组织探子","医宗药童","走火入魔的武疯子","乐坊出身的杀手","武林盟执法使","将门世家传人","少林戒律院僧人","百草谷采药童子","丐帮传功长老","青城山坤道","黑风寨副寨主","江南名门主母","五毒教暗杀者","幻音坊乐伶","神兵山庄铁匠","风行门探子","天山派隐世长老","佛寺扫地小僧","漠北赤焰堂堂主","江湖流浪杀手","极乐宫弃徒","名门一派掌门","门派首席女弟子","独行江湖浪客","隐世宗门长老","暗杀组织成员","山门护法力士","医道门派圣女","门派关门小弟子","邪派狂徒","佛门戒律僧","门派智囊军师","塞外刀客弟子","潜伏于教坊的间谍","退隐江湖的门派老仆","浪迹天涯的游侠","客栈掌柜的小女儿","镖局资深趟子手","独行女刺客","客栈常驻的老酒鬼","市井帮派的小头目","客栈风情万种的掌柜","初出茅庐的游学书生","镖局的总镖头","镖局随行的女医者","隐匿市井的江湖掮客","客栈门前的跑腿小儿","镖局的大小姐","客栈后院的铁匠师傅","失意的癫狂剑客","街角卖药的老妪","深藏不露的客栈伙计","擅长用毒的江湖散人","市井浪荡游侠","落魄世家剑客","镖局大当家","客栈跑堂伙计","客栈老板娘","隐姓埋名的更夫","集市肉铺学徒","随行女镖师","镖局武术教头","街头卖艺少女","游历江湖的画师","江湖赏金猎人","客栈驻唱舞娘","烂醉如泥的老乞丐","市井好斗狂徒","资深女护镖","初入江湖的小贼","神秘市井刺客","落拓剑客","镖局见习镖头","市井说书人","走方医女","镖局趟子手","酒肆老板娘","醉拳游侠","赏金猎人","退役老镖头","市井隐士","客栈小二","江湖女侠","王廷首席魔法师","王城武器锻造师","王国边境骑士","半龙人角斗士","魔法学院院长","森林见习祭司","荒野雇佣兵头目","圣光教廷圣女","王国首席技师","被放逐的通灵师","王室密探","酒馆魅惑舞者","古龙祭坛守护者","魔法学院新生","矿区实习生","月光林地贤者","邪龙教派狂信徒"],
  '日本·战国至江户': ["战国大名","公家千金","流浪武士","吉原花魁","寺院住持","町人子弟","新选组队士","神社巫女","搬运苦力","茶屋老板娘","歌舞伎役者","幕府老中","伊贺女忍","阴阳师学徒","足轻长","武家老女","町医者","南蛮贸易商子弟","领地大名","云游僧侣","武家子弟","吴服店老板娘","浪人剑客","町人幼童","锻造师","忍者","京都公卿","女武芸者","幕府谋臣","山村药婆","神社神子","町火消首领","茶屋乐师","米行掌柜","领主大名","女武者","流浪浪人","米店商人","武家幼子","隐秘忍者","战国老将","町家姑娘","刀匠","茶道大师","义贼"],
  '中国·明清': ["清代帝王","后宫宠妃","明代文官","八旗将军","明代新嫁娘","王府马夫","明代隐逸诗人","告老还乡的老臣","满洲女猎户","明代锦衣卫高层","富家小少爷","旗人名门闺秀","明代大内侍卫","清代贫寒书生","明代大户丫鬟","清代宅门老太君","明末游方疯道","清代掌案太监","内阁大学士","深宫嫔妃","致仕还乡的词臣","御前侍卫","公侯府邸千金","一品诰命夫人","皇亲贵胄","官宦家生丫鬟","晋商大掌柜","待嫁名门嫡女","锦衣卫千户","皇子乳母","蒙学学童","教坊司舞姬","营造司石匠","落魄疯癫诗人","朝廷重臣","世家子弟","锦衣卫将领","宫廷侍女","秉笔太监","科举考生","市井老农","王府贝勒","寺庙僧侣","富家姨娘","富家幼童"],
  '欧洲·古希腊': ["步兵指挥官","神庙祭司","奥林匹克运动员","执政官","石匠学徒","富商之女","流浪诗人","地下贸易商","陶艺工匠","狩猎女战士","学园学生","酒神信徒","抒情诗人","葡萄园主","城邦贵族继承人","重装步兵","贵族主妇","学童","盲眼先知","交际花","竞技运动员","公民之女","奴隶监工","神谕解读者","吟游诗人","斯巴达女兵","陶艺师","贵族青年","草药女巫","高级交际花","斯巴达战士","神庙祭司助手","贵族少女","城邦平民之子","被放逐的阴谋家","阿耳忒弥斯祭司","青铜匠人","神谕记录者","城邦将军","庆典献花女童"],
  '美洲·美洲古文明': ["玛雅大祭司","印加王室女官","神庙侍童","蹴球运动员","部落草药医","观星台女祭司","矿石采集商","神庙乐师","宫廷舞者","丛林隐士/先知","陶器工匠","抄录员/学者","小公主","城邦统治者","玛雅祭司长","阿兹特克雄鹰武士","丛林草药医","王室幼子","神庙女祭司","黑曜石工匠","城邦女执政官","宫廷乐师","星象观测者","丛林巡逻者","通灵萨满","贵族千金","美洲豹战士统领","集市摊贩","金字塔石匠","祭祀献祭者","神庙大祭司","美洲豹武士","贵族幼女","农户之子","观星女祭司","码头搬运工","城邦公主","神庙抄录员"],
  '东南亚·吴哥/暹罗': ["苦行老僧","小贵族子嗣","月神殿祭司","神庙搬运工","宫廷学者","丛林巫毒师","集市花商","年幼的公主","石刻匠人","城郊平民女孩","森林通灵者","王国太后","驯猴少年","皇家祭司","古王国君主","隐居僧侣","年幼公主","宫廷乐师","王宫女侍卫","神庙建筑工","王后","幕后谋士","神庙舞者","部落巫医","神庙侍童","贵族千金","史官","驯象女官","外贸富商","皇家祭祀舞者","神庙守卫","王室幼公主","神庙大祭司","皇家书记官","女禁卫统领","浮雕石匠","暗杀者","王室乳母","皇家象军将领"],
  '北非·古埃及': ["统治者法老","王后","大祭司","军队统帅","宫廷书记官","陵墓工匠","王室女猎手","防腐师","荒漠苦修者","法老近侍","莎草收割农夫","神庙女祭司长","守墓圣童","神庙祭祀舞者","贵族幼女","王室女官","年幼的王子","金字塔石匠领工","荒漠神谕者","神庙搬运工","贵族侍女","见习士兵","尼罗河老渔民","执政王后","陵墓建筑师助手","乐府竖琴手","法老","资深书吏","皇家卫队长","王室成员","小王子","荒野占卜者","皇家建筑师","王室猎手","神庙大祭司","宫廷乐师","金字塔石匠"],
};
