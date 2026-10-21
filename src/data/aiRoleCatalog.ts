/**
 * AiRoleCatalog —— 官方「AI角色库」目录（**从官方 App 接口全量抽取，勿手改**）
 *
 * 数据来源：官方窗口内 App 自身请求（带 App 鉴权头重放）
 *   · 卡片 GET /api/canvas/v1/character-library/characters?filter_worldview=&filter_theme=&filter_scene=&offset=&limit=60
 *   · 分类树 GET /api/canvas/v1/character-library/categories ⇒ 5 / 59 / 169 三级
 *   · 图片：接口给 `app.tapnow.ai/…/uploads/<id>`，UI 用同 id 的 CDN 形式 `files.tapnow.media/…/uploads/<id>?variant_name=small`
 *
 * ★ **完全按官方分页**：全量 8979 张切成 **150 页、每页正好 60 张**
 *   （`src/data/aiRole/p000.ts … p149.ts`，最大 35KB，= 官方一次 `limit=60`）。
 *   各范围（世界观 / 子类）给出**页区间**；UI 首屏按顺序加载页，直到**当前范围内**够 60 张（= 官方第一页），
 *   滚动到底继续加载下一页 —— 与官方行为一致。
 *
 * 各分类总数：当代现实 5769 · 架空幻想 1214 · 科幻未来 746 · 古代历史 664 · 近代历史 586
 * 发色取值：黑 / 无 / 灰白 / 深棕 / 金 / 白 / 浅棕 / 彩色 / 红
 */

export interface AiRoleCharacter {
  name: string;
  meta: string;
  img: string;
  slots: [string, string, string, string];
  worldview: string;
  theme: string;
  filterScene: string;
  era: string;
  region: string;
  scene: string;
  timePeriod: string;
  genre: string;
  attrs: Record<string, string>;
  outfit: string;
  distinctive: string;
  images: { full: string; three: string; expression: string; closeup: string };
}

/** 官方分类树节点（三级） */
export interface AiRoleCategoryNode {
  label: string;
  filter_worldview?: string;
  filter_theme?: string;
  filter_scene?: string;
  children?: AiRoleCategoryNode[];
}

/** 官方左列分类树（接口 `/character-library/categories` 原样） */
export const AI_ROLE_TREE: AiRoleCategoryNode[] = [
  { label: '古代历史', filter_worldview: '古代历史',
      children: [
        { label: '日本·战国至江户', filter_worldview: '古代历史', filter_theme: '日本·战国至江户' },
        { label: '中国·唐宋', filter_worldview: '古代历史', filter_theme: '中国·唐宋' },
        { label: '中国·先秦', filter_worldview: '古代历史', filter_theme: '中国·先秦' },
        { label: '韩国·朝鲜王朝', filter_worldview: '古代历史', filter_theme: '韩国·朝鲜王朝' },
        { label: '中国·明清', filter_worldview: '古代历史', filter_theme: '中国·明清' },
        { label: '欧洲·古希腊', filter_worldview: '古代历史', filter_theme: '欧洲·古希腊' },
        { label: '美洲·美洲古文明', filter_worldview: '古代历史', filter_theme: '美洲·美洲古文明' },
        { label: '东南亚·吴哥/暹罗', filter_worldview: '古代历史', filter_theme: '东南亚·吴哥/暹罗' },
        { label: '北欧·维京时代', filter_worldview: '古代历史', filter_theme: '北欧·维京时代' },
        { label: '欧洲·古罗马', filter_worldview: '古代历史', filter_theme: '欧洲·古罗马' },
        { label: '非洲·古非洲王国', filter_worldview: '古代历史', filter_theme: '非洲·古非洲王国' },
        { label: '中东·波斯帝国', filter_worldview: '古代历史', filter_theme: '中东·波斯帝国' },
        { label: '北非·古埃及', filter_worldview: '古代历史', filter_theme: '北非·古埃及' },
        { label: '南亚·古印度', filter_worldview: '古代历史', filter_theme: '南亚·古印度' },
        { label: '欧洲·中世纪', filter_worldview: '古代历史', filter_theme: '欧洲·中世纪' },
        { label: '中东·奥斯曼帝国', filter_worldview: '古代历史', filter_theme: '中东·奥斯曼帝国' },
      ] },
  { label: '近代历史', filter_worldview: '近代历史',
      children: [
        { label: '美国·西部拓荒', filter_worldview: '近代历史', filter_theme: '美国·西部拓荒' },
        { label: '欧洲·大航海时代', filter_worldview: '近代历史', filter_theme: '欧洲·大航海时代' },
        { label: '欧洲·文艺复兴', filter_worldview: '近代历史', filter_theme: '欧洲·文艺复兴' },
        { label: '跨区域·殖民时代', filter_worldview: '近代历史', filter_theme: '跨区域·殖民时代' },
        { label: '欧洲·维多利亚时代', filter_worldview: '近代历史', filter_theme: '欧洲·维多利亚时代' },
        { label: '美国·南北战争', filter_worldview: '近代历史', filter_theme: '美国·南北战争' },
        { label: '中国·晚清', filter_worldview: '近代历史', filter_theme: '中国·晚清' },
        { label: '南亚·殖民时代', filter_worldview: '近代历史', filter_theme: '南亚·殖民时代' },
        { label: '欧洲·巴洛克/洛可可', filter_worldview: '近代历史', filter_theme: '欧洲·巴洛克/洛可可' },
        { label: '跨区域·海盗时代', filter_worldview: '近代历史', filter_theme: '跨区域·海盗时代' },
        { label: '欧洲·拿破仑时代', filter_worldview: '近代历史', filter_theme: '欧洲·拿破仑时代' },
        { label: '拉美·独立革命', filter_worldview: '近代历史', filter_theme: '拉美·独立革命' },
        { label: '日本·明治时代', filter_worldview: '近代历史', filter_theme: '日本·明治时代' },
        { label: '非洲·殖民前后', filter_worldview: '近代历史', filter_theme: '非洲·殖民前后' },
      ] },
  { label: '当代现实', filter_worldview: '当代现实',
      children: [
        { label: '职场商业', filter_worldview: '当代现实', filter_theme: '职场商业',
        children: [
          { label: '东亚·科技创业', filter_worldview: '当代现实', filter_theme: '职场商业', filter_scene: '东亚·科技创业' },
          { label: '欧美·科技创业', filter_worldview: '当代现实', filter_theme: '职场商业', filter_scene: '欧美·科技创业' },
          { label: '南亚·律所/法庭', filter_worldview: '当代现实', filter_theme: '职场商业', filter_scene: '南亚·律所/法庭' },
          { label: '欧美·新闻媒体', filter_worldview: '当代现实', filter_theme: '职场商业', filter_scene: '欧美·新闻媒体' },
          { label: '东亚·律所/法庭', filter_worldview: '当代现实', filter_theme: '职场商业', filter_scene: '东亚·律所/法庭' },
          { label: '东亚·新闻媒体', filter_worldview: '当代现实', filter_theme: '职场商业', filter_scene: '东亚·新闻媒体' },
          { label: '东亚·金融/投行', filter_worldview: '当代现实', filter_theme: '职场商业', filter_scene: '东亚·金融/投行' },
          { label: '尖端实验室', filter_worldview: '当代现实', filter_theme: '职场商业', filter_scene: '尖端实验室' },
          { label: '欧美·律所/法庭', filter_worldview: '当代现实', filter_theme: '职场商业', filter_scene: '欧美·律所/法庭' },
          { label: '航天机构', filter_worldview: '当代现实', filter_theme: '职场商业', filter_scene: '航天机构' },
          { label: '欧美·商战/职场', filter_worldview: '当代现实', filter_theme: '职场商业', filter_scene: '欧美·商战/职场' },
          { label: '东亚·商战/职场', filter_worldview: '当代现实', filter_theme: '职场商业', filter_scene: '东亚·商战/职场' },
          { label: '中东·金融/投行', filter_worldview: '当代现实', filter_theme: '职场商业', filter_scene: '中东·金融/投行' },
          { label: '欧美·金融/投行', filter_worldview: '当代现实', filter_theme: '职场商业', filter_scene: '欧美·金融/投行' },
        ] },
        { label: '文体娱乐', filter_worldview: '当代现实', filter_theme: '文体娱乐',
        children: [
          { label: '东亚·时尚界', filter_worldview: '当代现实', filter_theme: '文体娱乐', filter_scene: '东亚·时尚界' },
          { label: '东亚·高端餐饮', filter_worldview: '当代现实', filter_theme: '文体娱乐', filter_scene: '东亚·高端餐饮' },
          { label: '欧洲·时尚界', filter_worldview: '当代现实', filter_theme: '文体娱乐', filter_scene: '欧洲·时尚界' },
          { label: '电竞/赛车', filter_worldview: '当代现实', filter_theme: '文体娱乐', filter_scene: '电竞/赛车' },
          { label: '跨区域·职业体育', filter_worldview: '当代现实', filter_theme: '文体娱乐', filter_scene: '跨区域·职业体育' },
          { label: '东亚·演艺圈', filter_worldview: '当代现实', filter_theme: '文体娱乐', filter_scene: '东亚·演艺圈' },
          { label: '东亚·职业体育', filter_worldview: '当代现实', filter_theme: '文体娱乐', filter_scene: '东亚·职业体育' },
          { label: '欧美·职业体育', filter_worldview: '当代现实', filter_theme: '文体娱乐', filter_scene: '欧美·职业体育' },
          { label: '非洲·时尚界', filter_worldview: '当代现实', filter_theme: '文体娱乐', filter_scene: '非洲·时尚界' },
          { label: '直播/网红', filter_worldview: '当代现实', filter_theme: '文体娱乐', filter_scene: '直播/网红' },
          { label: '欧美·高端餐饮', filter_worldview: '当代现实', filter_theme: '文体娱乐', filter_scene: '欧美·高端餐饮' },
          { label: '欧美·演艺圈', filter_worldview: '当代现实', filter_theme: '文体娱乐', filter_scene: '欧美·演艺圈' },
          { label: '南亚·演艺圈', filter_worldview: '当代现实', filter_theme: '文体娱乐', filter_scene: '南亚·演艺圈' },
        ] },
        { label: '社会民生', filter_worldview: '当代现实', filter_theme: '社会民生',
        children: [
          { label: '东亚·工厂', filter_worldview: '当代现实', filter_theme: '社会民生', filter_scene: '东亚·工厂' },
          { label: '欧洲·乡村', filter_worldview: '当代现实', filter_theme: '社会民生', filter_scene: '欧洲·乡村' },
          { label: '跨区域·工厂', filter_worldview: '当代现实', filter_theme: '社会民生', filter_scene: '跨区域·工厂' },
          { label: '东亚·乡村', filter_worldview: '当代现实', filter_theme: '社会民生', filter_scene: '东亚·乡村' },
          { label: '南亚·乡村', filter_worldview: '当代现实', filter_theme: '社会民生', filter_scene: '南亚·乡村' },
          { label: '南亚·贫民窟', filter_worldview: '当代现实', filter_theme: '社会民生', filter_scene: '南亚·贫民窟' },
          { label: '原住民/少数族群社区', filter_worldview: '当代现实', filter_theme: '社会民生', filter_scene: '原住民/少数族群社区' },
          { label: '拉美·乡村', filter_worldview: '当代现实', filter_theme: '社会民生', filter_scene: '拉美·乡村' },
          { label: '难民营', filter_worldview: '当代现实', filter_theme: '社会民生', filter_scene: '难民营' },
          { label: '拉美·贫民窟', filter_worldview: '当代现实', filter_theme: '社会民生', filter_scene: '拉美·贫民窟' },
          { label: '非洲·乡村', filter_worldview: '当代现实', filter_theme: '社会民生', filter_scene: '非洲·乡村' },
          { label: '东亚·城市底层', filter_worldview: '当代现实', filter_theme: '社会民生', filter_scene: '东亚·城市底层' },
        ] },
        { label: '犯罪悬疑', filter_worldview: '当代现实', filter_theme: '犯罪悬疑',
        children: [
          { label: '跨区域·缉毒', filter_worldview: '当代现实', filter_theme: '犯罪悬疑', filter_scene: '跨区域·缉毒' },
          { label: '东亚·监狱', filter_worldview: '当代现实', filter_theme: '犯罪悬疑', filter_scene: '东亚·监狱' },
          { label: '拉美·刑侦', filter_worldview: '当代现实', filter_theme: '犯罪悬疑', filter_scene: '拉美·刑侦' },
          { label: '欧美·监狱', filter_worldview: '当代现实', filter_theme: '犯罪悬疑', filter_scene: '欧美·监狱' },
          { label: '拉美·监狱', filter_worldview: '当代现实', filter_theme: '犯罪悬疑', filter_scene: '拉美·监狱' },
          { label: '东亚·刑侦', filter_worldview: '当代现实', filter_theme: '犯罪悬疑', filter_scene: '东亚·刑侦' },
          { label: '非洲·黑帮', filter_worldview: '当代现实', filter_theme: '犯罪悬疑', filter_scene: '非洲·黑帮' },
          { label: '拉美·黑帮', filter_worldview: '当代现实', filter_theme: '犯罪悬疑', filter_scene: '拉美·黑帮' },
          { label: '南亚·刑侦', filter_worldview: '当代现实', filter_theme: '犯罪悬疑', filter_scene: '南亚·刑侦' },
          { label: '欧美·刑侦', filter_worldview: '当代现实', filter_theme: '犯罪悬疑', filter_scene: '欧美·刑侦' },
          { label: '欧美·黑帮', filter_worldview: '当代现实', filter_theme: '犯罪悬疑', filter_scene: '欧美·黑帮' },
          { label: '东亚·黑帮', filter_worldview: '当代现实', filter_theme: '犯罪悬疑', filter_scene: '东亚·黑帮' },
        ] },
        { label: '宗教民俗', filter_worldview: '当代现实', filter_theme: '宗教民俗',
        children: [
          { label: '东亚·佛教寺院', filter_worldview: '当代现实', filter_theme: '宗教民俗', filter_scene: '东亚·佛教寺院' },
          { label: '拉美·节庆(狂欢节/亡灵节)', filter_worldview: '当代现实', filter_theme: '宗教民俗', filter_scene: '拉美·节庆(狂欢节/亡灵节)' },
          { label: '东亚·节庆(庙会/祭典)', filter_worldview: '当代现实', filter_theme: '宗教民俗', filter_scene: '东亚·节庆(庙会/祭典)' },
          { label: '南亚·节庆(排灯节/胡里节/婚礼)', filter_worldview: '当代现实', filter_theme: '宗教民俗', filter_scene: '南亚·节庆(排灯节/胡里节/婚礼)' },
          { label: '东南亚·节庆(泼水节/市场)', filter_worldview: '当代现实', filter_theme: '宗教民俗', filter_scene: '东南亚·节庆(泼水节/市场)' },
          { label: '南亚·印度教寺庙', filter_worldview: '当代现实', filter_theme: '宗教民俗', filter_scene: '南亚·印度教寺庙' },
          { label: '欧洲·基督教堂', filter_worldview: '当代现实', filter_theme: '宗教民俗', filter_scene: '欧洲·基督教堂' },
          { label: '非洲·节庆(部落仪式/市集)', filter_worldview: '当代现实', filter_theme: '宗教民俗', filter_scene: '非洲·节庆(部落仪式/市集)' },
          { label: '中东·节庆(斋月/巴扎)', filter_worldview: '当代现实', filter_theme: '宗教民俗', filter_scene: '中东·节庆(斋月/巴扎)' },
          { label: '中东·清真寺', filter_worldview: '当代现实', filter_theme: '宗教民俗', filter_scene: '中东·清真寺' },
        ] },
        { label: '都市生活', filter_worldview: '当代现实', filter_theme: '都市生活',
        children: [
          { label: '东南亚·都市景观', filter_worldview: '当代现实', filter_theme: '都市生活', filter_scene: '东南亚·都市景观' },
          { label: '航空/机场', filter_worldview: '当代现实', filter_theme: '都市生活', filter_scene: '航空/机场' },
          { label: '夜生活/酒吧', filter_worldview: '当代现实', filter_theme: '都市生活', filter_scene: '夜生活/酒吧' },
          { label: '度假/旅游', filter_worldview: '当代现实', filter_theme: '都市生活', filter_scene: '度假/旅游' },
          { label: '东亚·街头文化', filter_worldview: '当代现实', filter_theme: '都市生活', filter_scene: '东亚·街头文化' },
          { label: '欧美·街头文化', filter_worldview: '当代现实', filter_theme: '都市生活', filter_scene: '欧美·街头文化' },
          { label: '拉美·都市景观', filter_worldview: '当代现实', filter_theme: '都市生活', filter_scene: '拉美·都市景观' },
          { label: '非洲·都市景观', filter_worldview: '当代现实', filter_theme: '都市生活', filter_scene: '非洲·都市景观' },
          { label: '博物馆/考古', filter_worldview: '当代现实', filter_theme: '都市生活', filter_scene: '博物馆/考古' },
          { label: '赌场', filter_worldview: '当代现实', filter_theme: '都市生活', filter_scene: '赌场' },
        ] },
        { label: '权谋', filter_worldview: '当代现实', filter_theme: '权谋',
        children: [
          { label: '欧美·豪门家族', filter_worldview: '当代现实', filter_theme: '权谋', filter_scene: '欧美·豪门家族' },
          { label: '南亚·豪门家族', filter_worldview: '当代现实', filter_theme: '权谋', filter_scene: '南亚·豪门家族' },
          { label: '东亚·豪门家族', filter_worldview: '当代现实', filter_theme: '权谋', filter_scene: '东亚·豪门家族' },
          { label: '南亚·政坛', filter_worldview: '当代现实', filter_theme: '权谋', filter_scene: '南亚·政坛' },
          { label: '中东·豪门家族', filter_worldview: '当代现实', filter_theme: '权谋', filter_scene: '中东·豪门家族' },
          { label: '东亚·政坛', filter_worldview: '当代现实', filter_theme: '权谋', filter_scene: '东亚·政坛' },
          { label: '欧美·政坛', filter_worldview: '当代现实', filter_theme: '权谋', filter_scene: '欧美·政坛' },
          { label: '跨区域·政坛', filter_worldview: '当代现实', filter_theme: '权谋', filter_scene: '跨区域·政坛' },
        ] },
        { label: '军事动作', filter_worldview: '当代现实', filter_theme: '军事动作',
        children: [
          { label: '欧美·军旅', filter_worldview: '当代现实', filter_theme: '军事动作', filter_scene: '欧美·军旅' },
          { label: '东亚·军旅', filter_worldview: '当代现实', filter_theme: '军事动作', filter_scene: '东亚·军旅' },
          { label: '中东·军旅', filter_worldview: '当代现实', filter_theme: '军事动作', filter_scene: '中东·军旅' },
          { label: '南亚·灾难救援', filter_worldview: '当代现实', filter_theme: '军事动作', filter_scene: '南亚·灾难救援' },
          { label: '欧美·灾难救援', filter_worldview: '当代现实', filter_theme: '军事动作', filter_scene: '欧美·灾难救援' },
          { label: '特种反恐', filter_worldview: '当代现实', filter_theme: '军事动作', filter_scene: '特种反恐' },
          { label: '东亚·灾难救援', filter_worldview: '当代现实', filter_theme: '军事动作', filter_scene: '东亚·灾难救援' },
        ] },
        { label: '战争', filter_worldview: '当代现实', filter_theme: '战争',
        children: [
          { label: '越战', filter_worldview: '当代现实', filter_theme: '战争', filter_scene: '越战' },
          { label: '二战苏德战场', filter_worldview: '当代现实', filter_theme: '战争', filter_scene: '二战苏德战场' },
          { label: '二战中国战场', filter_worldview: '当代现实', filter_theme: '战争', filter_scene: '二战中国战场' },
          { label: '二战太平洋战场', filter_worldview: '当代现实', filter_theme: '战争', filter_scene: '二战太平洋战场' },
          { label: '二战北非战场', filter_worldview: '当代现实', filter_theme: '战争', filter_scene: '二战北非战场' },
          { label: '二战欧洲战场', filter_worldview: '当代现实', filter_theme: '战争', filter_scene: '二战欧洲战场' },
          { label: '中东战争', filter_worldview: '当代现实', filter_theme: '战争', filter_scene: '中东战争' },
        ] },
        { label: '校园', filter_worldview: '当代现实', filter_theme: '校园',
        children: [
          { label: '东亚·高中校园', filter_worldview: '当代现实', filter_theme: '校园', filter_scene: '东亚·高中校园' },
          { label: '东亚·大学校园', filter_worldview: '当代现实', filter_theme: '校园', filter_scene: '东亚·大学校园' },
          { label: '南亚·高中校园', filter_worldview: '当代现实', filter_theme: '校园', filter_scene: '南亚·高中校园' },
          { label: '欧美·大学校园', filter_worldview: '当代现实', filter_theme: '校园', filter_scene: '欧美·大学校园' },
          { label: '南亚·大学校园', filter_worldview: '当代现实', filter_theme: '校园', filter_scene: '南亚·大学校园' },
          { label: '欧美·高中校园', filter_worldview: '当代现实', filter_theme: '校园', filter_scene: '欧美·高中校园' },
        ] },
        { label: '爱情', filter_worldview: '当代现实', filter_theme: '爱情',
        children: [
          { label: '南亚·都市爱情', filter_worldview: '当代现实', filter_theme: '爱情', filter_scene: '南亚·都市爱情' },
          { label: '东南亚·都市爱情', filter_worldview: '当代现实', filter_theme: '爱情', filter_scene: '东南亚·都市爱情' },
          { label: '拉美·都市爱情', filter_worldview: '当代现实', filter_theme: '爱情', filter_scene: '拉美·都市爱情' },
          { label: '欧美·都市爱情', filter_worldview: '当代现实', filter_theme: '爱情', filter_scene: '欧美·都市爱情' },
          { label: '中东·都市爱情', filter_worldview: '当代现实', filter_theme: '爱情', filter_scene: '中东·都市爱情' },
          { label: '东亚·都市爱情', filter_worldview: '当代现实', filter_theme: '爱情', filter_scene: '东亚·都市爱情' },
        ] },
        { label: '年代风情', filter_worldview: '当代现实', filter_theme: '年代风情',
        children: [
          { label: '东亚·泡沫经济时代', filter_worldview: '当代现实', filter_theme: '年代风情', filter_scene: '东亚·泡沫经济时代' },
          { label: '北美·爵士时代与禁酒令', filter_worldview: '当代现实', filter_theme: '年代风情', filter_scene: '北美·爵士时代与禁酒令' },
          { label: '东亚·香港黄金年代', filter_worldview: '当代现实', filter_theme: '年代风情', filter_scene: '东亚·香港黄金年代' },
          { label: '北美·NASA登月时代', filter_worldview: '当代现实', filter_theme: '年代风情', filter_scene: '北美·NASA登月时代' },
          { label: '欧美·反文化运动', filter_worldview: '当代现实', filter_theme: '年代风情', filter_scene: '欧美·反文化运动' },
        ] },
        { label: '医疗', filter_worldview: '当代现实', filter_theme: '医疗',
        children: [
          { label: '欧美·医院', filter_worldview: '当代现实', filter_theme: '医疗', filter_scene: '欧美·医院' },
          { label: '中东·医院', filter_worldview: '当代现实', filter_theme: '医疗', filter_scene: '中东·医院' },
          { label: '东亚·医院', filter_worldview: '当代现实', filter_theme: '医疗', filter_scene: '东亚·医院' },
          { label: '非洲·医院', filter_worldview: '当代现实', filter_theme: '医疗', filter_scene: '非洲·医院' },
          { label: '南亚·医院', filter_worldview: '当代现实', filter_theme: '医疗', filter_scene: '南亚·医院' },
        ] },
        { label: '家庭', filter_worldview: '当代现实', filter_theme: '家庭',
        children: [
          { label: '东亚·家庭伦理', filter_worldview: '当代现实', filter_theme: '家庭', filter_scene: '东亚·家庭伦理' },
          { label: '欧美·家庭伦理', filter_worldview: '当代现实', filter_theme: '家庭', filter_scene: '欧美·家庭伦理' },
          { label: '中东·家庭伦理', filter_worldview: '当代现实', filter_theme: '家庭', filter_scene: '中东·家庭伦理' },
          { label: '南亚·家庭伦理', filter_worldview: '当代现实', filter_theme: '家庭', filter_scene: '南亚·家庭伦理' },
        ] },
        { label: '谍战', filter_worldview: '当代现实', filter_theme: '谍战',
        children: [
          { label: '欧美·现代谍战', filter_worldview: '当代现实', filter_theme: '谍战', filter_scene: '欧美·现代谍战' },
          { label: '东亚·现代谍战', filter_worldview: '当代现实', filter_theme: '谍战', filter_scene: '东亚·现代谍战' },
          { label: '欧美·冷战谍战', filter_worldview: '当代现实', filter_theme: '谍战', filter_scene: '欧美·冷战谍战' },
        ] },
        { label: '社会运动', filter_worldview: '当代现实', filter_theme: '社会运动',
        children: [
          { label: '非洲·去殖民化浪潮', filter_worldview: '当代现实', filter_theme: '社会运动', filter_scene: '非洲·去殖民化浪潮' },
          { label: '南亚·甘地时代反殖民', filter_worldview: '当代现实', filter_theme: '社会运动', filter_scene: '南亚·甘地时代反殖民' },
          { label: '拉美·游击战与革命', filter_worldview: '当代现实', filter_theme: '社会运动', filter_scene: '拉美·游击战与革命' },
        ] },
        { label: '悬疑奇情', filter_worldview: '当代现实', filter_theme: '悬疑奇情',
        children: [
          { label: '秘密社群/邪教', filter_worldview: '当代现实', filter_theme: '悬疑奇情', filter_scene: '秘密社群/邪教' },
          { label: '精神/心理治疗', filter_worldview: '当代现实', filter_theme: '悬疑奇情', filter_scene: '精神/心理治疗' },
        ] },
      ] },
  { label: '科幻未来', filter_worldview: '科幻未来',
      children: [
        { label: '太空探索', filter_worldview: '科幻未来', filter_theme: '太空探索',
        children: [
          { label: '外星接触', filter_worldview: '科幻未来', filter_theme: '太空探索', filter_scene: '外星接触' },
          { label: '星际母舰', filter_worldview: '科幻未来', filter_theme: '太空探索', filter_scene: '星际母舰' },
          { label: '殖民星球', filter_worldview: '科幻未来', filter_theme: '太空探索', filter_scene: '殖民星球' },
          { label: '空间站', filter_worldview: '科幻未来', filter_theme: '太空探索', filter_scene: '空间站' },
          { label: '宇宙政治', filter_worldview: '科幻未来', filter_theme: '太空探索', filter_scene: '宇宙政治' },
        ] },
        { label: '近未来', filter_worldview: '科幻未来', filter_theme: '近未来',
        children: [
          { label: 'AI控制社会', filter_worldview: '科幻未来', filter_theme: '近未来', filter_scene: 'AI控制社会' },
          { label: '人类与机械体共存', filter_worldview: '科幻未来', filter_theme: '近未来', filter_scene: '人类与机械体共存' },
          { label: '时空穿越', filter_worldview: '科幻未来', filter_theme: '近未来', filter_scene: '时空穿越' },
          { label: '近未来监控都市', filter_worldview: '科幻未来', filter_theme: '近未来', filter_scene: '近未来监控都市' },
        ] },
        { label: '末日废土', filter_worldview: '科幻未来', filter_theme: '末日废土',
        children: [
          { label: '东亚废土世界', filter_worldview: '科幻未来', filter_theme: '末日废土', filter_scene: '东亚废土世界' },
          { label: '西方废土世界', filter_worldview: '科幻未来', filter_theme: '末日废土', filter_scene: '西方废土世界' },
          { label: '全球气候灾难', filter_worldview: '科幻未来', filter_theme: '末日废土', filter_scene: '全球气候灾难' },
          { label: '末日幸存者与丧尸', filter_worldview: '科幻未来', filter_theme: '末日废土', filter_scene: '末日幸存者与丧尸' },
        ] },
        { label: '赛博朋克', filter_worldview: '科幻未来', filter_theme: '赛博朋克',
        children: [
          { label: '霓虹街头与地下', filter_worldview: '科幻未来', filter_theme: '赛博朋克', filter_scene: '霓虹街头与地下' },
          { label: '企业与反叛', filter_worldview: '科幻未来', filter_theme: '赛博朋克', filter_scene: '企业与反叛' },
          { label: '非洲科技都市', filter_worldview: '科幻未来', filter_theme: '赛博朋克', filter_scene: '非洲科技都市' },
        ] },
      ] },
  { label: '架空幻想', filter_worldview: '架空幻想',
      children: [
        { label: '神话传说', filter_worldview: '架空幻想', filter_theme: '神话传说',
        children: [
          { label: '摩诃婆罗多/罗摩衍那', filter_worldview: '架空幻想', filter_theme: '神话传说', filter_scene: '摩诃婆罗多/罗摩衍那' },
          { label: '西游/封神/百鬼', filter_worldview: '架空幻想', filter_theme: '神话传说', filter_scene: '西游/封神/百鬼' },
          { label: '非洲传统神话体系', filter_worldview: '架空幻想', filter_theme: '神话传说', filter_scene: '非洲传统神话体系' },
          { label: '奥林匹斯/阿斯加德', filter_worldview: '架空幻想', filter_theme: '神话传说', filter_scene: '奥林匹斯/阿斯加德' },
          { label: '百鬼夜行/阴阳师', filter_worldview: '架空幻想', filter_theme: '神话传说', filter_scene: '百鬼夜行/阴阳师' },
          { label: '一千零一夜', filter_worldview: '架空幻想', filter_theme: '神话传说', filter_scene: '一千零一夜' },
        ] },
        { label: '超自然恐怖', filter_worldview: '架空幻想', filter_theme: '超自然恐怖',
        children: [
          { label: '洛夫克拉夫特宇宙', filter_worldview: '架空幻想', filter_theme: '超自然恐怖', filter_scene: '洛夫克拉夫特宇宙' },
          { label: '西方经典超自然', filter_worldview: '架空幻想', filter_theme: '超自然恐怖', filter_scene: '西方经典超自然' },
          { label: '中国民俗/日本怪谈', filter_worldview: '架空幻想', filter_theme: '超自然恐怖', filter_scene: '中国民俗/日本怪谈' },
          { label: '西方民俗恐怖', filter_worldview: '架空幻想', filter_theme: '超自然恐怖', filter_scene: '西方民俗恐怖' },
          { label: '驱魔/猎魔', filter_worldview: '架空幻想', filter_theme: '超自然恐怖', filter_scene: '驱魔/猎魔' },
        ] },
        { label: '仙侠武侠', filter_worldview: '架空幻想', filter_theme: '仙侠武侠',
        children: [
          { label: '仙界/魔界', filter_worldview: '架空幻想', filter_theme: '仙侠武侠', filter_scene: '仙界/魔界' },
          { label: '市井游侠', filter_worldview: '架空幻想', filter_theme: '仙侠武侠', filter_scene: '市井游侠' },
          { label: '江湖门派', filter_worldview: '架空幻想', filter_theme: '仙侠武侠', filter_scene: '江湖门派' },
          { label: '修真门派', filter_worldview: '架空幻想', filter_theme: '仙侠武侠', filter_scene: '修真门派' },
        ] },
        { label: '风格架空', filter_worldview: '架空幻想', filter_theme: '风格架空',
        children: [
          { label: '蒸汽朋克世界', filter_worldview: '架空幻想', filter_theme: '风格架空', filter_scene: '蒸汽朋克世界' },
          { label: '哥特美学', filter_worldview: '架空幻想', filter_theme: '风格架空', filter_scene: '哥特美学' },
          { label: '暗黑童话世界', filter_worldview: '架空幻想', filter_theme: '风格架空', filter_scene: '暗黑童话世界' },
        ] },
        { label: '都市异能', filter_worldview: '架空幻想', filter_theme: '都市异能',
        children: [
          { label: '现代超能力', filter_worldview: '架空幻想', filter_theme: '都市异能', filter_scene: '现代超能力' },
          { label: '超级英雄/异能', filter_worldview: '架空幻想', filter_theme: '都市异能', filter_scene: '超级英雄/异能' },
        ] },
        { label: '魔幻现实', filter_worldview: '架空幻想', filter_theme: '魔幻现实',
        children: [
          { label: '拉美超自然', filter_worldview: '架空幻想', filter_theme: '魔幻现实', filter_scene: '拉美超自然' },
          { label: '魔幻现实主义', filter_worldview: '架空幻想', filter_theme: '魔幻现实', filter_scene: '魔幻现实主义' },
        ] },
        { label: '穿越转生', filter_worldview: '架空幻想', filter_theme: '穿越转生',
        children: [
          { label: '日式异世界', filter_worldview: '架空幻想', filter_theme: '穿越转生', filter_scene: '日式异世界' },
          { label: '古代穿越', filter_worldview: '架空幻想', filter_theme: '穿越转生', filter_scene: '古代穿越' },
        ] },
        { label: '史诗奇幻', filter_worldview: '架空幻想', filter_theme: '史诗奇幻',
        children: [
          { label: '王国与冒险', filter_worldview: '架空幻想', filter_theme: '史诗奇幻', filter_scene: '王国与冒险' },
          { label: '黑暗势力', filter_worldview: '架空幻想', filter_theme: '史诗奇幻', filter_scene: '黑暗势力' },
        ] },
      ] },
];

/** 官方筛选组（chip 原文顺序） */
export const AI_ROLE_FILTERS = ['性别', '年龄段', '物种', '体格', '身高', '肤色', '发长', '发色', '气质'] as const;

/** 官方筛选取值（`发色` = 接口 `hair_color` 全量取值） */
export const AI_ROLE_FILTER_VALUES: Record<string, string[]> = {
  '性别': ['男', '女', '中性'],
  '年龄段': ['青年', '中年', '老年', '少年', '幼年'],
  '物种': ['人类', '机械体', '妖怪', '其他', '神明', '亡灵', '外星种族', '精灵', '兽人', '矮人'],
  '体格': ['纤细', '标准', '健壮', '壮硕', '非人形'],
  '身高': ['中等', '高挑', '矮小'],
  '肤色': ['中等', '浅', '深', '极浅', '极深', '非自然色'],
  '发长': ['短发', '长发', '中长', '极短', '遮盖', '光头'],
  '发色': ['黑', '无', '灰白', '深棕', '金', '白', '浅棕', '彩色', '红'],
  '气质': ['飒爽', '清冷', '稚嫩', '威严', '温柔', '儒雅', '憨厚', '沧桑', '霸气', '阴鸷', '妩媚', '癫狂'],
};

/** 官方分类总数（接口 `with_total`） */
export const AI_ROLE_CATEGORY_TOTALS: Record<string, number> = {
  '当代现实': 5769,
  '架空幻想': 1214,
  '科幻未来': 746,
  '古代历史': 664,
  '近代历史': 586,
  '全部角色': 8979,
};

/** 官方分页大小（接口 `limit=60`） */
export const AI_ROLE_PAGE_SIZE = 60;

/** 官方 CDN */
export function aiRoleCdn(uploadId: string, variant = 'small'): string {
  if (!uploadId) return '';
  return `https://files.tapnow.media/api/conversation/storage/uploads/${uploadId}${variant ? `?variant_name=${variant}` : ''}`;
}

/* 卡片行 → 对象（列序：name, worldview, theme, era, region, scene, gender, age, species, physique, height, skin, hairLen, hairColor, temperament, outfit, distinctive, full, three, expr, closeup, timePeriod, genre, filterScene） */
function decode(RAW: string[][]): AiRoleCharacter[] {
  return RAW.map((r) => ({
    name: r[0],
    meta: [r[6], r[7], r[9], r[14]].filter(Boolean).join(' · '),
    img: aiRoleCdn(r[17]),
    slots: [r[6], r[7], r[9], r[14]] as [string, string, string, string],
    worldview: r[1], theme: r[2], filterScene: r[23], era: r[3], region: r[4], scene: r[5], timePeriod: r[21], genre: r[22],
    attrs: { '性别': r[6], '年龄段': r[7], '物种': r[8], '体格': r[9], '身高': r[10], '肤色': r[11], '发长': r[12], '发色': r[13], '气质': r[14] },
    outfit: r[15], distinctive: r[16],
    images: { full: aiRoleCdn(r[17], ''), three: aiRoleCdn(r[18], ''), expression: aiRoleCdn(r[19], ''), closeup: aiRoleCdn(r[20], '') },
  }));
}

const PAGE_LOADERS: Record<string, () => Promise<AiRoleCharacter[]>> = {
  'p000': async () => decode((await import('./aiRole/p000')).RAW),
  'p001': async () => decode((await import('./aiRole/p001')).RAW),
  'p002': async () => decode((await import('./aiRole/p002')).RAW),
  'p003': async () => decode((await import('./aiRole/p003')).RAW),
  'p004': async () => decode((await import('./aiRole/p004')).RAW),
  'p005': async () => decode((await import('./aiRole/p005')).RAW),
  'p006': async () => decode((await import('./aiRole/p006')).RAW),
  'p007': async () => decode((await import('./aiRole/p007')).RAW),
  'p008': async () => decode((await import('./aiRole/p008')).RAW),
  'p009': async () => decode((await import('./aiRole/p009')).RAW),
  'p010': async () => decode((await import('./aiRole/p010')).RAW),
  'p011': async () => decode((await import('./aiRole/p011')).RAW),
  'p012': async () => decode((await import('./aiRole/p012')).RAW),
  'p013': async () => decode((await import('./aiRole/p013')).RAW),
  'p014': async () => decode((await import('./aiRole/p014')).RAW),
  'p015': async () => decode((await import('./aiRole/p015')).RAW),
  'p016': async () => decode((await import('./aiRole/p016')).RAW),
  'p017': async () => decode((await import('./aiRole/p017')).RAW),
  'p018': async () => decode((await import('./aiRole/p018')).RAW),
  'p019': async () => decode((await import('./aiRole/p019')).RAW),
  'p020': async () => decode((await import('./aiRole/p020')).RAW),
  'p021': async () => decode((await import('./aiRole/p021')).RAW),
  'p022': async () => decode((await import('./aiRole/p022')).RAW),
  'p023': async () => decode((await import('./aiRole/p023')).RAW),
  'p024': async () => decode((await import('./aiRole/p024')).RAW),
  'p025': async () => decode((await import('./aiRole/p025')).RAW),
  'p026': async () => decode((await import('./aiRole/p026')).RAW),
  'p027': async () => decode((await import('./aiRole/p027')).RAW),
  'p028': async () => decode((await import('./aiRole/p028')).RAW),
  'p029': async () => decode((await import('./aiRole/p029')).RAW),
  'p030': async () => decode((await import('./aiRole/p030')).RAW),
  'p031': async () => decode((await import('./aiRole/p031')).RAW),
  'p032': async () => decode((await import('./aiRole/p032')).RAW),
  'p033': async () => decode((await import('./aiRole/p033')).RAW),
  'p034': async () => decode((await import('./aiRole/p034')).RAW),
  'p035': async () => decode((await import('./aiRole/p035')).RAW),
  'p036': async () => decode((await import('./aiRole/p036')).RAW),
  'p037': async () => decode((await import('./aiRole/p037')).RAW),
  'p038': async () => decode((await import('./aiRole/p038')).RAW),
  'p039': async () => decode((await import('./aiRole/p039')).RAW),
  'p040': async () => decode((await import('./aiRole/p040')).RAW),
  'p041': async () => decode((await import('./aiRole/p041')).RAW),
  'p042': async () => decode((await import('./aiRole/p042')).RAW),
  'p043': async () => decode((await import('./aiRole/p043')).RAW),
  'p044': async () => decode((await import('./aiRole/p044')).RAW),
  'p045': async () => decode((await import('./aiRole/p045')).RAW),
  'p046': async () => decode((await import('./aiRole/p046')).RAW),
  'p047': async () => decode((await import('./aiRole/p047')).RAW),
  'p048': async () => decode((await import('./aiRole/p048')).RAW),
  'p049': async () => decode((await import('./aiRole/p049')).RAW),
  'p050': async () => decode((await import('./aiRole/p050')).RAW),
  'p051': async () => decode((await import('./aiRole/p051')).RAW),
  'p052': async () => decode((await import('./aiRole/p052')).RAW),
  'p053': async () => decode((await import('./aiRole/p053')).RAW),
  'p054': async () => decode((await import('./aiRole/p054')).RAW),
  'p055': async () => decode((await import('./aiRole/p055')).RAW),
  'p056': async () => decode((await import('./aiRole/p056')).RAW),
  'p057': async () => decode((await import('./aiRole/p057')).RAW),
  'p058': async () => decode((await import('./aiRole/p058')).RAW),
  'p059': async () => decode((await import('./aiRole/p059')).RAW),
  'p060': async () => decode((await import('./aiRole/p060')).RAW),
  'p061': async () => decode((await import('./aiRole/p061')).RAW),
  'p062': async () => decode((await import('./aiRole/p062')).RAW),
  'p063': async () => decode((await import('./aiRole/p063')).RAW),
  'p064': async () => decode((await import('./aiRole/p064')).RAW),
  'p065': async () => decode((await import('./aiRole/p065')).RAW),
  'p066': async () => decode((await import('./aiRole/p066')).RAW),
  'p067': async () => decode((await import('./aiRole/p067')).RAW),
  'p068': async () => decode((await import('./aiRole/p068')).RAW),
  'p069': async () => decode((await import('./aiRole/p069')).RAW),
  'p070': async () => decode((await import('./aiRole/p070')).RAW),
  'p071': async () => decode((await import('./aiRole/p071')).RAW),
  'p072': async () => decode((await import('./aiRole/p072')).RAW),
  'p073': async () => decode((await import('./aiRole/p073')).RAW),
  'p074': async () => decode((await import('./aiRole/p074')).RAW),
  'p075': async () => decode((await import('./aiRole/p075')).RAW),
  'p076': async () => decode((await import('./aiRole/p076')).RAW),
  'p077': async () => decode((await import('./aiRole/p077')).RAW),
  'p078': async () => decode((await import('./aiRole/p078')).RAW),
  'p079': async () => decode((await import('./aiRole/p079')).RAW),
  'p080': async () => decode((await import('./aiRole/p080')).RAW),
  'p081': async () => decode((await import('./aiRole/p081')).RAW),
  'p082': async () => decode((await import('./aiRole/p082')).RAW),
  'p083': async () => decode((await import('./aiRole/p083')).RAW),
  'p084': async () => decode((await import('./aiRole/p084')).RAW),
  'p085': async () => decode((await import('./aiRole/p085')).RAW),
  'p086': async () => decode((await import('./aiRole/p086')).RAW),
  'p087': async () => decode((await import('./aiRole/p087')).RAW),
  'p088': async () => decode((await import('./aiRole/p088')).RAW),
  'p089': async () => decode((await import('./aiRole/p089')).RAW),
  'p090': async () => decode((await import('./aiRole/p090')).RAW),
  'p091': async () => decode((await import('./aiRole/p091')).RAW),
  'p092': async () => decode((await import('./aiRole/p092')).RAW),
  'p093': async () => decode((await import('./aiRole/p093')).RAW),
  'p094': async () => decode((await import('./aiRole/p094')).RAW),
  'p095': async () => decode((await import('./aiRole/p095')).RAW),
  'p096': async () => decode((await import('./aiRole/p096')).RAW),
  'p097': async () => decode((await import('./aiRole/p097')).RAW),
  'p098': async () => decode((await import('./aiRole/p098')).RAW),
  'p099': async () => decode((await import('./aiRole/p099')).RAW),
  'p100': async () => decode((await import('./aiRole/p100')).RAW),
  'p101': async () => decode((await import('./aiRole/p101')).RAW),
  'p102': async () => decode((await import('./aiRole/p102')).RAW),
  'p103': async () => decode((await import('./aiRole/p103')).RAW),
  'p104': async () => decode((await import('./aiRole/p104')).RAW),
  'p105': async () => decode((await import('./aiRole/p105')).RAW),
  'p106': async () => decode((await import('./aiRole/p106')).RAW),
  'p107': async () => decode((await import('./aiRole/p107')).RAW),
  'p108': async () => decode((await import('./aiRole/p108')).RAW),
  'p109': async () => decode((await import('./aiRole/p109')).RAW),
  'p110': async () => decode((await import('./aiRole/p110')).RAW),
  'p111': async () => decode((await import('./aiRole/p111')).RAW),
  'p112': async () => decode((await import('./aiRole/p112')).RAW),
  'p113': async () => decode((await import('./aiRole/p113')).RAW),
  'p114': async () => decode((await import('./aiRole/p114')).RAW),
  'p115': async () => decode((await import('./aiRole/p115')).RAW),
  'p116': async () => decode((await import('./aiRole/p116')).RAW),
  'p117': async () => decode((await import('./aiRole/p117')).RAW),
  'p118': async () => decode((await import('./aiRole/p118')).RAW),
  'p119': async () => decode((await import('./aiRole/p119')).RAW),
  'p120': async () => decode((await import('./aiRole/p120')).RAW),
  'p121': async () => decode((await import('./aiRole/p121')).RAW),
  'p122': async () => decode((await import('./aiRole/p122')).RAW),
  'p123': async () => decode((await import('./aiRole/p123')).RAW),
  'p124': async () => decode((await import('./aiRole/p124')).RAW),
  'p125': async () => decode((await import('./aiRole/p125')).RAW),
  'p126': async () => decode((await import('./aiRole/p126')).RAW),
  'p127': async () => decode((await import('./aiRole/p127')).RAW),
  'p128': async () => decode((await import('./aiRole/p128')).RAW),
  'p129': async () => decode((await import('./aiRole/p129')).RAW),
  'p130': async () => decode((await import('./aiRole/p130')).RAW),
  'p131': async () => decode((await import('./aiRole/p131')).RAW),
  'p132': async () => decode((await import('./aiRole/p132')).RAW),
  'p133': async () => decode((await import('./aiRole/p133')).RAW),
  'p134': async () => decode((await import('./aiRole/p134')).RAW),
  'p135': async () => decode((await import('./aiRole/p135')).RAW),
  'p136': async () => decode((await import('./aiRole/p136')).RAW),
  'p137': async () => decode((await import('./aiRole/p137')).RAW),
  'p138': async () => decode((await import('./aiRole/p138')).RAW),
  'p139': async () => decode((await import('./aiRole/p139')).RAW),
  'p140': async () => decode((await import('./aiRole/p140')).RAW),
  'p141': async () => decode((await import('./aiRole/p141')).RAW),
  'p142': async () => decode((await import('./aiRole/p142')).RAW),
  'p143': async () => decode((await import('./aiRole/p143')).RAW),
  'p144': async () => decode((await import('./aiRole/p144')).RAW),
  'p145': async () => decode((await import('./aiRole/p145')).RAW),
  'p146': async () => decode((await import('./aiRole/p146')).RAW),
  'p147': async () => decode((await import('./aiRole/p147')).RAW),
  'p148': async () => decode((await import('./aiRole/p148')).RAW),
  'p149': async () => decode((await import('./aiRole/p149')).RAW),
};

const pageCache = new Map<string, AiRoleCharacter[]>();
/** 加载一页（正好 60 张，= 官方一次请求；带缓存） */
export async function loadAiRolePage(id: string): Promise<AiRoleCharacter[]> {
  if (!pageCache.has(id) && PAGE_LOADERS[id]) pageCache.set(id, await PAGE_LOADERS[id]());
  return pageCache.get(id) || [];
}

/** 页总数与页 id 列表 */
export const AI_ROLE_PAGE_COUNT = 150;
export function aiRolePageId(index: number): string | null {
  return index >= 0 && index < 150 ? 'p' + String(index).padStart(3, '0') : null;
}

/** 世界观 → 页区间 [起, 止] */
export const AI_ROLE_PAGE_RANGE_BY_WORLDVIEW: Record<string, [number, number]> = {
  '古代历史': [0, 11],
  '近代历史': [11, 20],
  '当代现实': [20, 116],
  '科幻未来': [116, 129],
  '架空幻想': [129, 149],
};
/** 子类 → 页区间 [起, 止] */
export const AI_ROLE_PAGE_RANGE_BY_THEME: Record<string, [number, number]> = {
  '中国·先秦': [0, 0],
  '中国·唐宋': [0, 1],
  '中国·明清': [1, 2],
  '日本·战国至江户': [2, 3],
  '韩国·朝鲜王朝': [3, 3],
  '北非·古埃及': [3, 4],
  '欧洲·古希腊': [4, 5],
  '欧洲·古罗马': [5, 5],
  '欧洲·中世纪': [5, 6],
  '北欧·维京时代': [6, 7],
  '中东·波斯帝国': [7, 7],
  '中东·奥斯曼帝国': [7, 8],
  '南亚·古印度': [8, 9],
  '东南亚·吴哥/暹罗': [9, 9],
  '非洲·古非洲王国': [9, 10],
  '美洲·美洲古文明': [10, 11],
  '欧洲·文艺复兴': [11, 11],
  '欧洲·大航海时代': [11, 12],
  '欧洲·巴洛克/洛可可': [12, 13],
  '欧洲·拿破仑时代': [13, 13],
  '欧洲·维多利亚时代': [13, 14],
  '跨区域·殖民时代': [14, 15],
  '跨区域·海盗时代': [15, 16],
  '美国·西部拓荒': [16, 16],
  '美国·南北战争': [16, 17],
  '日本·明治时代': [17, 18],
  '中国·晚清': [18, 18],
  '南亚·殖民时代': [18, 19],
  '拉美·独立革命': [19, 20],
  '非洲·殖民前后': [20, 20],
  '战争': [20, 26],
  '谍战': [24, 109],
  '社会运动': [26, 28],
  '年代风情': [28, 32],
  '爱情': [32, 36],
  '家庭': [36, 39],
  '犯罪悬疑': [39, 108],
  '医疗': [46, 49],
  '校园': [49, 54],
  '军事动作': [54, 59],
  '职场商业': [59, 116],
  '权谋': [65, 71],
  '文体娱乐': [71, 85],
  '都市生活': [85, 116],
  '社会民生': [86, 113],
  '宗教民俗': [94, 102],
  '悬疑奇情': [111, 115],
  '赛博朋克': [116, 119],
  '太空探索': [119, 128],
  '末日废土': [122, 125],
  '近未来': [125, 129],
  '仙侠武侠': [129, 132],
  '史诗奇幻': [132, 134],
  '神话传说': [134, 138],
  '都市异能': [138, 140],
  '超自然恐怖': [140, 148],
  '风格架空': [143, 145],
  '穿越转生': [145, 147],
  '魔幻现实': [147, 149],
};

/** 当前筛选范围的**页区间**（官方语义：范围 = 三级筛选；场景 ⊂ 子类，由 UI 再过滤） */
export function aiRolePageRange(scope: { worldview?: string; theme?: string; scene?: string }): [number, number] {
  if (scope.theme && AI_ROLE_PAGE_RANGE_BY_THEME[scope.theme]) return AI_ROLE_PAGE_RANGE_BY_THEME[scope.theme];
  if (scope.worldview && AI_ROLE_PAGE_RANGE_BY_WORLDVIEW[scope.worldview]) return AI_ROLE_PAGE_RANGE_BY_WORLDVIEW[scope.worldview];
  return [0, 149];
}
