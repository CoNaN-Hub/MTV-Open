/**
 * 官方「提及 token」纯函数层回归 —— 逐字对齐 live `vendor-pkg-canvas-ChpWx5JY.js`。
 *
 * 关键官方事实（易错，全部锁在断言里）：
 *  · 严格 token 文法：`{{node/<id>}}`（id 字符集 `[^{}\s/]+`）与
 *    `{{library_asset|library_folder|element/<正整数>}}`（**0 不合法**）
 *  · `hK`：id 必须是正整数字符串且 ≤ `9223372036854775807`（写成字符串比较）
 *  · `fwe`：label 必须是**规范**的 `encodeURIComponent`（`encodeURIComponent(decodeURIComponent(x)) === x`）
 *  · `w_`：长度计算里**一个提及 token 只算 1 个字符**
 *  · `Uc`：value → HTML 时 `& < > " '` 全部转义
 *  · `D1`：未知 kind 一律当**插件名**；`ElementRef`/`Asset` 属保留 kind ⇒ `null`
 */
import { describe, expect, it } from 'vitest';
import {
  buildMentionToken,
  describeMentionToken,
  escapeMentionHtml,
  fileFallbackTitle,
  isPositiveInt64,
  mentionTextLength,
  mentionsInValue,
  nodeFallbackTitle,
  normalizeMentionSpacing,
  parseGenericMentionToken,
  parseMentionToken,
  parseStrictMentionToken,
  pluginRenderText,
  truncateMentionTitle,
  valueToEditorHtml,
  type MentionLookups,
} from '../src/services/chat/mentionTokens';

const lookups: MentionLookups = {
  nodeTitleMap: new Map([['111', '角色参考图']]),
  fileTitleMap: new Map([['f9', '剧本.md']]),
  brainstormLabel: '头脑风暴',
};

describe('isPositiveInt64（官方 hK）', () => {
  it('正整数才合法，前导 0 / 0 / 非数字都不行', () => {
    expect(isPositiveInt64('1')).toBe(true);
    expect(isPositiveInt64('12')).toBe(true);
    expect(isPositiveInt64('0')).toBe(false);
    expect(isPositiveInt64('007')).toBe(false);
    expect(isPositiveInt64('1.5')).toBe(false);
    expect(isPositiveInt64('')).toBe(false);
    expect(isPositiveInt64('-1')).toBe(false);
  });

  it('int64 上限：19 位最大值合法，+1 不合法，20 位不合法', () => {
    expect(isPositiveInt64('9223372036854775807')).toBe(true);
    expect(isPositiveInt64('9223372036854775808')).toBe(false);
    expect(isPositiveInt64('10000000000000000000')).toBe(false);
  });
});

describe('buildMentionToken / parseMentionToken（官方 mwe / fwe）', () => {
  it('无 label ⇒ 只有 prefix+id（**不含**收尾 `}}`，官方亦然）', () => {
    expect(buildMentionToken('{{node/', { id: '12', label: '  ' })).toBe('{{node/12');
  });

  it('label 走 encodeURIComponent，生成的是「内层」形式', () => {
    const inner = buildMentionToken('{{node/', { id: '12', label: '角色 参考图' });
    expect(inner).toBe(`{{node/12:${encodeURIComponent('角色 参考图')}`);
    expect(parseMentionToken(inner, '{{node/')).toEqual({ id: '12', label: '角色 参考图' });
  });

  it('非规范编码 / 非法 id / 缺 label 一律 null', () => {
    /* `%61bc` 解码是 `abc`，但 `encodeURIComponent('abc') !== '%61bc'` ⇒ 非规范，拒收。 */
    expect(parseMentionToken('{{node/12:%61bc', '{{node/')).toBeNull();
    expect(parseMentionToken('{{node/0:x', '{{node/')).toBeNull();
    expect(parseMentionToken('{{node/12:', '{{node/')).toBeNull();
    expect(parseMentionToken('{{file_ref/12', '{{node/')).toBeNull();
  });
});

describe('parseStrictMentionToken（官方 du/$1）', () => {
  it('node 与三种 library token', () => {
    expect(parseStrictMentionToken('{{node/abc}}')).toEqual({ kind: 'node', id: 'abc' });
    expect(parseStrictMentionToken('{{library_asset/12}}')).toEqual({ kind: 'library_asset', id: '12' });
    expect(parseStrictMentionToken('{{library_folder/7}}')).toEqual({ kind: 'library_folder', id: '7' });
    expect(parseStrictMentionToken('{{element/9}}')).toEqual({ kind: 'element', id: '9' });
  });

  it('library token 的 id 必须是正整数（0 不合法）；node 的 id 不能含空格或斜杠', () => {
    expect(parseStrictMentionToken('{{library_asset/0}}')).toBeNull();
    expect(parseStrictMentionToken('{{node/a b}}')).toBeNull();
    expect(parseStrictMentionToken('{{node/a/b}}')).toBeNull();
  });

  it('非 {{…}} 包裹一律 null', () => {
    expect(parseStrictMentionToken('node/1')).toBeNull();
    expect(parseStrictMentionToken('{{node/1')).toBeNull();
  });
});

describe('parseGenericMentionToken（官方 D1 + 保留表 Mve）', () => {
  it('六个专用 kind', () => {
    expect(parseGenericMentionToken('skill', ' my-skill ')).toEqual({ kind: 'skill', payload: 'my-skill' });
    expect(parseGenericMentionToken('brainstorm', 'brainstorm')).toEqual({ kind: 'brainstorm' });
    expect(parseGenericMentionToken('node_id', 'n1')).toEqual({ kind: 'node_id', id: 'n1' });
    expect(parseGenericMentionToken('file_ref', 'f1')).toEqual({ kind: 'file_ref', id: 'f1' });
    expect(parseGenericMentionToken('quoted_text', 'q1')).toEqual({ kind: 'quoted_text', id: 'q1' });
    expect(parseGenericMentionToken('library_path', 'p1')).toEqual({ kind: 'library_path', id: 'p1' });
  });

  it('未知 kind ⇒ 当作插件名（skillName 取冒号前段）', () => {
    expect(parseGenericMentionToken('my-plugin', 'a:b')).toEqual({ kind: 'plugin', pluginName: 'my-plugin', skillName: 'a' });
    expect(parseGenericMentionToken('my-plugin', 'solo')).toEqual({ kind: 'plugin', pluginName: 'my-plugin', skillName: 'solo' });
  });

  it('保留 kind `ElementRef` / `Asset` ⇒ null；空 payload ⇒ null', () => {
    expect(parseGenericMentionToken('ElementRef', 'x')).toBeNull();
    expect(parseGenericMentionToken('Asset', 'x')).toBeNull();
    expect(parseGenericMentionToken('node_id', '   ')).toBeNull();
  });
});

describe('长度 / 转义 / 归一（官方 w_ / Uc / xrt）', () => {
  it('一个提及 token 只算 1 个字符', () => {
    expect(mentionTextLength('ab{{node/123}}cd')).toBe(5);
    expect(mentionTextLength('{{skill:very-long-skill-name}}')).toBe(1);
  });

  it('HTML 转义覆盖 & < > " \'', () => {
    expect(escapeMentionHtml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&#39;f');
  });

  it('空白归一：brainstorm / skill / 普通通用 token 后的多空白压成 1 个', () => {
    expect(normalizeMentionSpacing('{{brainstorm:brainstorm}}    x')).toBe('{{brainstorm:brainstorm}} x');
    expect(normalizeMentionSpacing('{{node_id:n1}}    x')).toBe('{{node_id:n1}}    x'); // 白名单外，不动
  });
});

describe('describeMentionToken（官方 Wie）', () => {
  it('严格 node token：有标题用标题，没标题用 `node_<前6位>`', () => {
    expect(describeMentionToken('{{node/111}}', lookups)).toMatchObject({
      title: '角色参考图', mentionType: 'node', mentionId: '111', renderText: 'node/111',
    });
    expect(describeMentionToken('{{node/abcdefgh}}', lookups)).toMatchObject({
      title: 'node_abcdef', mentionType: 'node', mentionId: 'abcdefgh',
    });
  });

  it('library_folder / element 的 mentionType 与 mentionId 逐字', () => {
    expect(describeMentionToken('{{library_folder/3}}', lookups)).toMatchObject({
      mentionType: 'library_folder', mentionId: 'library-folder:3', renderText: 'library_folder/3',
    });
    expect(describeMentionToken('{{element/3}}', lookups)).toMatchObject({
      mentionType: 'library_element', mentionId: 'library-element:3',
    });
  });

  it('通用 kind 分支：brainstorm 用注入标签且 isActivation；file_ref → attachment + `file_<前6位>`', () => {
    expect(describeMentionToken('{{brainstorm:brainstorm}}', lookups)).toMatchObject({
      title: '头脑风暴', mentionType: 'brainstorm', mentionId: 'brainstorm', isActivation: true,
    });
    expect(describeMentionToken('{{file_ref/f9}}', lookups)).toBeNull();       // 斜杠形式不是通用 token
    expect(describeMentionToken('{{file_ref:f9}}', lookups)).toMatchObject({
      title: '剧本.md', mentionType: 'attachment', mentionId: 'f9', renderText: 'file_ref:f9',
    });
    expect(describeMentionToken('{{file_ref:zzzzzzzz}}', lookups)).toMatchObject({ title: 'file_zzzzzz' });
  });

  it('quoted_text 标题超 40 字截断并加省略号', () => {
    const long = 'x'.repeat(50);
    expect(truncateMentionTitle(long)).toBe(`${'x'.repeat(40)}…`);
    expect(describeMentionToken(`{{quoted_text:${long}}}`, lookups)).toMatchObject({
      title: `${'x'.repeat(40)}…`, mentionType: 'node', mentionId: long,
    });
  });

  it('插件 renderText 与展示名', () => {
    expect(pluginRenderText('plug', 'sk')).toBe('plugin:plug:sk');
    expect(describeMentionToken('{{plug:sk}}', { ...lookups, pluginDisplayName: () => '插件显示名' })).toMatchObject({
      title: '插件显示名', mentionType: 'plugin', mentionId: 'plug', renderText: 'plugin:plug:sk', isActivation: true,
    });
  });
});

describe('valueToEditorHtml / mentionsInValue（官方 wrt / vrt）', () => {
  it('空值 ⇒ `<p></p>`', () => {
    expect(valueToEditorHtml('', lookups)).toBe('<p></p>');
  });

  it('普通文本 + 节点提及：逐字 HTML（含 data-* 与 class）', () => {
    expect(valueToEditorHtml('看 {{node/111}} 这张', lookups)).toBe(
      '<p>看 <span data-type="mention" data-id="111" data-label="角色参考图"'
      + ' data-render-text="node/111" data-mention-type="node" class="mention mention-node">角色参考图</span> 这张</p>',
    );
  });

  it('文本里的 `<` 与 `&` 会转义，换行变 `<br>`', () => {
    expect(valueToEditorHtml('a<b&c\nd', lookups)).toBe('<p>a&lt;b&amp;c<br>d</p>');
  });

  it('识别不了的 `{{…}}` 原样留在文本里（不丢字符）', () => {
    expect(valueToEditorHtml('{{ElementRef:x}}', lookups)).toBe('<p>{{ElementRef:x}}</p>');
  });

  it('isActivation 提及后面的多空白压成 1 个空格', () => {
    expect(valueToEditorHtml('{{brainstorm:brainstorm}}   尾', lookups)).toBe(
      '<p><span data-type="mention" data-id="brainstorm" data-label="头脑风暴"'
      + ' data-render-text="{{brainstorm:brainstorm}}" data-mention-type="brainstorm"'
      + ' class="mention mention-node">头脑风暴</span> 尾</p>',
    );
  });

  it('mentionsInValue 收集 `mentionId → {label, renderText}`', () => {
    expect(mentionsInValue('{{node/111}} 与 {{skill:mk}}', {
      ...lookups,
      skillOf: () => ({ label: '做图技能', skillName: 'mk' }),
    })).toEqual({
      '111': { label: '角色参考图', renderText: 'node/111' },
      mk: { label: '做图技能', renderText: 'skill:mk' },
    });
  });
});

describe('nodeFallbackTitle / fileFallbackTitle（官方 BV / grt）', () => {
  it('取前 6 位并加前缀', () => {
    expect(nodeFallbackTitle('abcdefgh')).toBe('node_abcdef');
    expect(fileFallbackTitle('abcdefgh')).toBe('file_abcdef');
    expect(nodeFallbackTitle('ab')).toBe('node_ab');
  });
});
