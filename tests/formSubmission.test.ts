/**
 * `show_form` / `form_submission` 表单族**纯逻辑层**的单测（node 环境）。
 *
 * 断言全部对齐 `live-提问表单族.md` §2.2–§2.4 / §2.8 / §3.1–§3.2 的官方逐字事实；
 * 注释里的 `@偏移` 指 `vendor-pkg-canvas-ChpWx5JY.js`。
 * 验证分级 = (d) 源码级 + (b) node 单元。
 */
import { describe, expect, it } from 'vitest';
import {
  ACCENT_PRESET_HEX,
  COMPACT_OPTION_LABEL_MAX,
  FORM_FIELD_TYPES,
  FORM_LABELS,
  HSL_LIGHTNESS_MAX,
  HSL_LIGHTNESS_MIN,
  HSL_SATURATION_MIN,
  asString,
  buildFormAccentVars,
  buildFormLanguageSample,
  buildImageFieldIndex,
  cx,
  detectFormLanguage,
  displayFieldValue,
  findFormDefinitionByToolCallId,
  findSubmissionByToolCallId,
  finiteNumberOrUndefined,
  formatOptionValue,
  formFieldType,
  interpolateCount,
  isCompactOptionLayout,
  normalizeAccentHex,
  normalizeFormAccent,
  numberOrUndefined,
  optionCardClass,
  optionPillClass,
  parseFormContent,
  parseFormField,
  parseFormSubmission,
  resolveFormImageUrl,
  serializeSubmissionValues,
  toOfficialMessages,
  validateField,
  type FormDefinition,
  type FormField,
} from '../src/services/chat/formSubmission';

function field(overrides: Partial<FormField> = {}): FormField {
  return {
    id: 'f1',
    type: 'text',
    label: '字段',
    required: false,
    multiline: false,
    ...overrides,
  };
}

function form(overrides: Partial<FormDefinition> = {}): FormDefinition {
  return { title: '表单', fields: [field()], ...overrides };
}

describe('官方常量（WQe / YQe / QQe / ZQe,JQe,eZe）', () => {
  it('WQe 恰好是 9 种字段类型', () => {
    expect([...FORM_FIELD_TYPES].sort()).toEqual(
      ['checkbox', 'date', 'image_select', 'number', 'radio', 'rating', 'select', 'slider', 'text'].sort(),
    );
    expect(FORM_FIELD_TYPES.size).toBe(9);
  });

  it('COMPACT_OPTION_LABEL_MAX = 14（官方 YQe）', () => {
    expect(COMPACT_OPTION_LABEL_MAX).toBe(14);
  });

  it('QQe 预设与 HSL 钳制常量逐字', () => {
    expect(ACCENT_PRESET_HEX).toEqual({
      success: '#34d399',
      warning: '#fbbf24',
      danger: '#f87171',
    });
    expect([HSL_LIGHTNESS_MIN, HSL_LIGHTNESS_MAX, HSL_SATURATION_MIN]).toEqual([0.56, 0.72, 0.18]);
  });
});

describe('辅助函数（Ur / rh / Goe / gy / z）', () => {
  it('asString 只认 string', () => {
    expect(asString('a')).toBe('a');
    expect(asString(1)).toBe('');
    expect(asString(null, 'x')).toBe('x');
  });

  it('finiteNumberOrUndefined 排除 NaN/Infinity/非 number', () => {
    expect(finiteNumberOrUndefined(3)).toBe(3);
    expect(finiteNumberOrUndefined(Number.NaN)).toBeUndefined();
    expect(finiteNumberOrUndefined(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(finiteNumberOrUndefined('3')).toBeUndefined();
  });

  it('numberOrUndefined 只判 typeof（NaN 也放行，与官方 Goe 一致）', () => {
    expect(numberOrUndefined(3)).toBe(3);
    expect(Number.isNaN(numberOrUndefined(Number.NaN) as number)).toBe(true);
    expect(numberOrUndefined('3')).toBeUndefined();
  });

  it('interpolateCount 只替换第一处 {count}', () => {
    expect(interpolateCount('最多 {count} 项（{count}）', 3)).toBe('最多 3 项（{count}）');
  });

  it('cx 过滤假值后以单空格拼接', () => {
    expect(cx('a', false, undefined, null, 'b')).toBe('a b');
  });
});

describe('formFieldType（af）', () => {
  it('命中 WQe 时原样返回，否则 unknown（大小写敏感）', () => {
    expect(formFieldType({ type: 'radio' })).toBe('radio');
    expect(formFieldType({ type: 'image_select' })).toBe('image_select');
    expect(formFieldType({ type: 'Radio' })).toBe('unknown');
    expect(formFieldType({ type: 'textarea' })).toBe('unknown');
    expect(formFieldType({})).toBe('unknown');
    expect(formFieldType({ type: 7 })).toBe('unknown');
  });
});

describe('语言侦测（qQe / Voe）', () => {
  it('buildFormLanguageSample 拼 title + description + 所有 label', () => {
    const sample = buildFormLanguageSample(
      form({
        title: 'T',
        description: 'D',
        fields: [
          field({ id: 'a', label: 'L1', options: [{ value: '1', label: 'O1' }] }),
          field({ id: 'b', label: 'L2' }),
        ],
      }),
    );
    expect(sample).toBe('T D L1 O1 L2');
  });

  it('buildFormLanguageSample 在 description 缺省时用空串（产生两个连续空格）', () => {
    expect(buildFormLanguageSample(form({ title: 'T' }))).toBe('T  字段');
  });

  it.each([
    ['한국어 안내', 'ko'],
    ['にほんご', 'ja'],
    ['中文标题', 'zh'],
    ["aujourd'hui c'est prêt", 'fr'],
    ['Plain English', 'en'],
  ])('detectFormLanguage(%s) === %s', (text, expected) => {
    expect(detectFormLanguage(text)).toBe(expected);
  });

  it('韩文优先于中日文（正则次序逐字）', () => {
    expect(detectFormLanguage('한국어 中文')).toBe('ko');
    expect(detectFormLanguage('にほんご 中文')).toBe('ja');
  });
});

describe('PM 本地化表（@2167720 逐字）', () => {
  it('zh 全 14 键', () => {
    expect(FORM_LABELS.zh).toEqual({
      submit: '提交',
      skip: '跳过',
      edit: '修改',
      submitted: '已提交',
      skipped: '已跳过',
      required: '此项为必填',
      minSelect: '至少选择 {count} 项',
      maxSelect: '最多选择 {count} 项',
      maxLength: '最多 {count} 字',
      numberMin: '不能小于 {count}',
      numberMax: '不能大于 {count}',
      selectPlaceholder: '请选择',
      datePlaceholder: '选择日期',
      unanswered: '未填写',
    });
  });

  it('en / ja / ko / fr 的代表键', () => {
    expect(FORM_LABELS.en.unanswered).toBe('Not answered');
    expect(FORM_LABELS.ja.submit).toBe('送信');
    expect(FORM_LABELS.ko.skipped).toBe('건너뜀');
    expect(FORM_LABELS.fr.selectPlaceholder).toBe('Sélectionner');
  });

  it('5 种语言键集合完全一致', () => {
    const keys = Object.keys(FORM_LABELS.zh).sort();
    for (const lang of ['en', 'ja', 'ko', 'fr'] as const) {
      expect(Object.keys(FORM_LABELS[lang]).sort()).toEqual(keys);
    }
  });
});

describe('parseFormField（KQe @2169740）', () => {
  it('非对象 / 缺 id / 缺 label → null', () => {
    expect(parseFormField(null)).toBeNull();
    expect(parseFormField('x')).toBeNull();
    expect(parseFormField({ label: 'L' })).toBeNull();
    expect(parseFormField({ id: 'i' })).toBeNull();
    expect(parseFormField({ id: '  ', label: 'L' })).toBeNull();
    expect(parseFormField({ id: 'i', label: '   ' })).toBeNull();
  });

  it('trim + 默认 type=text + required 严格 === true', () => {
    const parsed = parseFormField({ id: ' i ', label: ' L ', type: '  ', required: 'yes' });
    expect(parsed).toMatchObject({ id: 'i', label: 'L', type: 'text', required: false });
  });

  it('options 过滤：非对象/空 value 丢弃，label 缺省取 value', () => {
    const parsed = parseFormField({
      id: 'i',
      label: 'L',
      options: [
        null,
        'x',
        { value: '  ' },
        { value: 'v1' },
        { value: 'v2', label: '  ' },
        { value: 'v3', label: 'V3', file_id: ' fid ', description: ' D ' },
      ],
    });
    expect(parsed?.options).toEqual([
      { value: 'v1', label: 'v1' },
      { value: 'v2', label: 'v2' },
      { value: 'v3', label: 'V3', file_id: 'fid', description: 'D' },
    ]);
  });

  it('空 options 数组 ⇒ options = undefined（不是 []）', () => {
    expect(parseFormField({ id: 'i', label: 'L', options: [] })?.options).toBeUndefined();
    expect(parseFormField({ id: 'i', label: 'L', options: ['bad'] })?.options).toBeUndefined();
  });

  it('数值字段走 rh（有限数才保留），description/placeholder/unit 空串 ⇒ undefined', () => {
    const parsed = parseFormField({
      id: 'i',
      label: 'L',
      min_select: 2,
      max_select: Number.NaN,
      max_length: 10,
      max: 5,
      min: 0,
      step: 0.5,
      description: '   ',
      placeholder: '',
      unit: '',
    });
    expect(parsed).toMatchObject({
      min_select: 2,
      max_select: undefined,
      max_length: 10,
      max: 5,
      min: 0,
      step: 0.5,
      description: undefined,
      placeholder: undefined,
      unit: undefined,
    });
  });

  it('multiline 严格 === true', () => {
    expect(parseFormField({ id: 'i', label: 'L', multiline: 1 })?.multiline).toBe(false);
    expect(parseFormField({ id: 'i', label: 'L', multiline: true })?.multiline).toBe(true);
  });
});

describe('parseFormContent（Hoe @2170560）', () => {
  it('无 form / request ⇒ null', () => {
    expect(parseFormContent({})).toBeNull();
    expect(parseFormContent({ response: {} })).toBeNull();
  });

  it('fields 归一化后为空 ⇒ null（== 不渲染卡片）', () => {
    expect(parseFormContent({ request: { fields: [] } })).toBeNull();
    expect(parseFormContent({ request: { fields: [{ label: '缺 id' }] } })).toBeNull();
    expect(parseFormContent({ request: {} })).toBeNull();
  });

  it('response.form 优先于 request', () => {
    const parsed = parseFormContent({
      response: { form: { title: 'from-response', fields: [{ id: 'a', label: 'A' }] } },
      request: { title: 'from-request', fields: [{ id: 'b', label: 'B' }] },
    });
    expect(parsed?.title).toBe('from-response');
    expect(parsed?.fields.map((item) => item.id)).toEqual(['a']);
  });

  it('response 存在但 response.form 非对象 ⇒ 回落 request', () => {
    const parsed = parseFormContent({
      response: { form: 'x' },
      request: { title: 'req', fields: [{ id: 'b', label: 'B' }] },
    });
    expect(parsed?.title).toBe('req');
  });

  it('顶层可选项缺省 ⇒ undefined；title 缺省 ⇒ ""', () => {
    const parsed = parseFormContent({ request: { fields: [{ id: 'a', label: 'A' }] } });
    expect(parsed).toEqual({
      title: '',
      description: undefined,
      submit_label: undefined,
      accent: undefined,
      form_icon: undefined,
      display_type: undefined,
      fields: [expect.objectContaining({ id: 'a' })],
    });
  });
});

describe('FB / Woe / iZe（展示值与序列化）', () => {
  const radio = field({
    id: 'r',
    type: 'radio',
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'b' },
    ],
  });

  it('formatOptionValue：`label === value` 时才不再追加 ` (value)`（官方 FB 逐字语义）', () => {
    /* ⚠️ 官方比的是 **option.label 与传入值**，不是 option.value 与传入值：
     *    `n.label === t ? n.label : `${n.label} (${t})``
     * ⇒ {value:"a",label:"A"} 查到 "a" 会输出 "A (a)"（官方真实行为，不是笔误）。 */
    expect(formatOptionValue(radio, 'a')).toBe('A (a)');
    expect(formatOptionValue(radio, 'b')).toBe('b');
    expect(formatOptionValue(radio, 'zzz')).toBe('zzz');
  });

  it('formatOptionValue：label 与 value 同名时原样', () => {
    expect(formatOptionValue(field({ options: [{ value: 'x', label: 'x' }] }), 'x')).toBe('x');
  });

  it('displayFieldValue 逐类型', () => {
    expect(displayFieldValue(radio, 'a')).toBe('A (a)');
    expect(displayFieldValue(radio, '')).toBeNull();
    expect(displayFieldValue(field({ type: 'select', options: [{ value: 'v', label: 'V' }] }), 'v')).toBe('V (v)');
    expect(displayFieldValue(field({ type: 'checkbox', options: radio.options }), ['a', 'b'])).toBe('A (a), b');
    expect(displayFieldValue(field({ type: 'checkbox' }), [])).toBeNull();
    expect(
      displayFieldValue(field({ type: 'image_select', options: [{ value: 'v', label: 'V' }] }), ['v']),
    ).toBe('V (v)');
    expect(displayFieldValue(field({ type: 'rating', max: 7 }), 4)).toBe('4/7');
    expect(displayFieldValue(field({ type: 'rating' }), 4)).toBe('4/5');
    expect(displayFieldValue(field({ type: 'slider', unit: 'px' }), 12)).toBe('12px');
    expect(displayFieldValue(field({ type: 'number' }), 12)).toBe('12');
    expect(displayFieldValue(field({ type: 'date' }), '2024-01-02')).toBe('2024-01-02');
    expect(displayFieldValue(field({ type: 'text' }), '  hi  ')).toBe('hi');
    expect(displayFieldValue(field({ type: 'text' }), '   ')).toBeNull();
    expect(displayFieldValue(field({ type: 'unknown-type' }), '  x ')).toBe('x');
    expect(displayFieldValue(field({ type: 'text' }), 5)).toBeNull();
  });

  it('displayFieldValue 对 null/undefined 一律 null（先于 switch）', () => {
    expect(displayFieldValue(field({ type: 'rating' }), null)).toBeNull();
    expect(displayFieldValue(field({ type: 'rating' }), undefined)).toBeNull();
  });

  it('iZe：text/unknown 的 value 存的是 display 而不是原值', () => {
    const fields = [field({ id: 't', type: 'text', label: '文本' }), field({ id: 'n', type: 'number', label: '数' })];
    expect(serializeSubmissionValues(fields, { t: '  abc ', n: 3 })).toEqual([
      { field_id: 't', field_label: '文本', value: 'abc', display: 'abc' },
      { field_id: 'n', field_label: '数', value: 3, display: '3' },
    ]);
  });

  it('iZe：未填字段是 value=null / display=null', () => {
    expect(serializeSubmissionValues([field({ id: 't' })], {})).toEqual([
      { field_id: 't', field_label: '字段', value: null, display: null },
    ]);
  });

  it('iZe：radio 存原始 value（不是 label）', () => {
    expect(serializeSubmissionValues([radio], { r: 'a' })[0]).toEqual({
      field_id: 'r',
      field_label: '字段',
      value: 'a',
      display: 'A (a)',
    });
  });
});

describe('validateField（aZe @2173590）', () => {
  const labels = FORM_LABELS.zh;

  it('空值：必填报 required，非必填放行', () => {
    expect(validateField(field({ required: true }), null, labels)).toBe('此项为必填');
    expect(validateField(field({ required: false }), null, labels)).toBeNull();
    expect(validateField(field({ required: true }), '', labels)).toBe('此项为必填');
  });

  it('min_select / max_select 带 {count} 插值', () => {
    const cb = field({ type: 'checkbox', min_select: 2, max_select: 3 });
    expect(validateField(cb, ['a'], labels)).toBe('至少选择 2 项');
    expect(validateField(cb, ['a', 'b'], labels)).toBeNull();
    expect(validateField(cb, ['a', 'b', 'c', 'd'], labels)).toBe('最多选择 3 项');
  });

  it('image_select 与 checkbox 同规则', () => {
    const img = field({ type: 'image_select', max_select: 1 });
    expect(validateField(img, ['a', 'b'], labels)).toBe('最多选择 1 项');
  });

  it('max_length 用 trim 后的长度', () => {
    const text = field({ type: 'text', max_length: 3 });
    expect(validateField(text, '  abc  ', labels)).toBeNull();
    expect(validateField(text, '  abcd  ', labels)).toBe('最多 3 字');
    expect(validateField(text, 'abcd', labels)).toBe('最多 3 字');
  });

  it('unknown 类型也走 max_length 分支', () => {
    expect(validateField(field({ type: 'textarea', max_length: 2 }), 'abc', labels)).toBe('最多 2 字');
  });

  it('number 的 min/max', () => {
    const num = field({ type: 'number', min: 2, max: 5 });
    expect(validateField(num, 1, labels)).toBe('不能小于 2');
    expect(validateField(num, 6, labels)).toBe('不能大于 5');
    expect(validateField(num, 3, labels)).toBeNull();
  });

  it('lang 参数不影响结果（官方 aZe 只是签名占位）', () => {
    expect(validateField(field({ required: true }), null, FORM_LABELS.en, 'zh')).toBe(
      FORM_LABELS.en.required,
    );
  });
});

describe('isCompactOptionLayout（$oe @2171088）', () => {
  it('仅 radio / checkbox 参与', () => {
    const options = [{ value: 'a', label: 'A' }];
    expect(isCompactOptionLayout(field({ type: 'select', options }))).toBe(false);
    expect(isCompactOptionLayout(field({ type: 'text', options }))).toBe(false);
    expect(isCompactOptionLayout(field({ type: 'radio', options }))).toBe(true);
    expect(isCompactOptionLayout(field({ type: 'checkbox', options }))).toBe(true);
  });

  it('无选项 ⇒ false', () => {
    expect(isCompactOptionLayout(field({ type: 'radio', options: undefined }))).toBe(false);
    expect(isCompactOptionLayout(field({ type: 'radio', options: [] }))).toBe(false);
  });

  it('14 是闭区间上限', () => {
    const fourteen = 'a'.repeat(14);
    const fifteen = 'a'.repeat(15);
    expect(isCompactOptionLayout(field({ type: 'radio', options: [{ value: 'v', label: fourteen }] }))).toBe(true);
    expect(isCompactOptionLayout(field({ type: 'radio', options: [{ value: 'v', label: fifteen }] }))).toBe(false);
  });

  it('任一选项带 description ⇒ false', () => {
    expect(
      isCompactOptionLayout(
        field({
          type: 'checkbox',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B', description: 'D' },
          ],
        }),
      ),
    ).toBe(false);
  });
});

describe('accent（sZe / oZe / rZe）', () => {
  it('normalizeFormAccent：空串 / default / 非法 ⇒ null', () => {
    expect(normalizeFormAccent(undefined)).toBeNull();
    expect(normalizeFormAccent('   ')).toBeNull();
    expect(normalizeFormAccent('default')).toBeNull();
    expect(normalizeFormAccent('  default ')).toBeNull();
    expect(normalizeFormAccent('red')).toBeNull();
    expect(normalizeFormAccent('#12345')).toBeNull();
  });

  it('语义预设原样返回（不过 HSL 钳制）', () => {
    for (const [name, hex] of Object.entries(ACCENT_PRESET_HEX)) {
      expect(normalizeFormAccent(name)).toBe(hex);
    }
  });

  it('8 位 hex 先截成 6 位再归一化', () => {
    expect(normalizeFormAccent('#ffffff80')).toBe(normalizeAccentHex('#ffffff'));
  });

  it('归一化把亮度钳到 [.56,.72]、饱和度抬到 ≥.18', () => {
    /* 纯黑（亮度 0）必被抬到下限；纯白（亮度 1）必被压到上限。 */
    expect(normalizeAccentHex('#000000')).not.toBe('#000000');
    expect(normalizeAccentHex('#ffffff')).not.toBe('#ffffff');
    /* 6 位 hex 结果仍是合法 6 位 hex。 */
    for (const input of ['#000000', '#ffffff', '#123456', '#ff0000']) {
      expect(normalizeAccentHex(input)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('rZe：accent 为空 ⇒ undefined（不写 style）', () => {
    expect(buildFormAccentVars(null)).toBeUndefined();
    expect(buildFormAccentVars(undefined)).toBeUndefined();
  });

  it('rZe：15 个变量 + color-mix 逐字', () => {
    const vars = buildFormAccentVars('#ff0000', false);
    expect(Object.keys(vars ?? {})).toHaveLength(15);
    expect(vars?.['--form-card-bg']).toBe('color-mix(in srgb, #ff0000 12%, #1f1f1f)');
    expect(vars?.['--form-section-bg']).toBe('color-mix(in srgb, #ff0000 8%, transparent)');
    expect(vars?.['--form-btn-bg']).toBe('color-mix(in srgb, #ff0000 56%, transparent)');
    expect(vars?.['--form-desc']).toBe('color-mix(in srgb, #ff0000 20%, #bcbcbc)');
  });

  it('rZe：bubble 改变 4 个比例（20/60/72）', () => {
    const vars = buildFormAccentVars('#ff0000', true);
    expect(vars?.['--form-section-bg']).toBe('color-mix(in srgb, #ff0000 20%, transparent)');
    expect(vars?.['--form-btn-bg']).toBe('color-mix(in srgb, #ff0000 60%, transparent)');
    expect(vars?.['--form-btn-bg-hover']).toBe('color-mix(in srgb, #ff0000 72%, transparent)');
    /* 与 bubble 无关的保持 8/56/68。 */
    expect(buildFormAccentVars('#ff0000', false)?.['--form-section-bg']).toBe(
      'color-mix(in srgb, #ff0000 8%, transparent)',
    );
  });
});

describe('Yoe / Xoe 共享 class 生成器', () => {
  it('optionCardClass：选中/未选中两串逐字', () => {
    expect(optionCardClass(true)).toBe(
      'flex min-h-10 w-full cursor-pointer items-start gap-2.5 rounded-md px-3 py-2.5 transition-all bg-[var(--form-selected-bg,rgba(255,255,255,0.08))] shadow-[inset_0_0_0_1px_var(--form-selected-ring,rgba(255,255,255,0.25))]',
    );
    expect(optionCardClass(false)).toContain('var(--form-option-bg,rgba(255,255,255,0.03))');
    expect(optionCardClass(false)).toContain('hover:bg-[var(--form-option-bg-hover,rgba(255,255,255,0.06))]');
  });

  it('optionPillClass：胶囊 + 不同的 ring 兜底值', () => {
    expect(optionPillClass(true)).toContain('h-9 cursor-pointer rounded-full px-3.5 text-xs font-medium');
    expect(optionPillClass(true)).toContain('var(--form-selected-ring,rgba(255,255,255,0.35))');
    expect(optionPillClass(false)).toContain('var(--form-option-ring,rgba(255,255,255,0.08))');
  });
});

describe('form_submission（qoe / cZe / lZe / Koe）', () => {
  it('qoe：缺 tool_call_id ⇒ null', () => {
    expect(parseFormSubmission({})).toBeNull();
    expect(parseFormSubmission({ tool_call_id: '' })).toBeNull();
  });

  it('qoe：支持 `{form_submission:{…}}` 嵌套与直接平铺两种形状', () => {
    const payload = { tool_call_id: 'tc1', form_title: 'T', values: [], skipped: false };
    expect(parseFormSubmission({ form_submission: payload })?.tool_call_id).toBe('tc1');
    expect(parseFormSubmission(payload)?.tool_call_id).toBe('tc1');
  });

  it('qoe：values 过滤非对象/缺 field_id，value 只保留 string|number|array', () => {
    const parsed = parseFormSubmission({
      tool_call_id: 'tc1',
      form_title: 'T',
      values: [
        null,
        'x',
        { field_label: 'no-id' },
        { field_id: 'a' },
        { field_id: 'b', value: true },
        { field_id: 'c', value: { k: 1 }, display: 5 },
        { field_id: 'd', field_label: 'D', value: ['x'], display: 'X' },
      ],
      skipped: 'yes',
    });
    expect(parsed).toEqual({
      tool_call_id: 'tc1',
      form_title: 'T',
      values: [
        { field_id: 'a', field_label: 'a', value: null, display: null },
        { field_id: 'b', field_label: 'b', value: null, display: null },
        { field_id: 'c', field_label: 'c', value: null, display: null },
        { field_id: 'd', field_label: 'D', value: ['x'], display: 'X' },
      ],
      skipped: false,
    });
  });

  it('qoe：field_label 缺省回落 field_id；skipped 严格 === true', () => {
    const parsed = parseFormSubmission({ tool_call_id: 'tc', values: [{ field_id: 'a' }], skipped: true });
    expect(parsed?.values[0].field_label).toBe('a');
    expect(parsed?.skipped).toBe(true);
  });

  it('cZe：倒序命中最近的 form_submission', () => {
    const messages = [
      { contents: [{ type: 'form_submission', content: { tool_call_id: 'tc', form_title: 'old' } }] },
      { contents: [{ type: 'text', content: 'x' }] },
      { contents: [{ type: 'form_submission', content: { tool_call_id: 'tc', form_title: 'new' } }] },
    ];
    expect(findSubmissionByToolCallId(messages, 'tc')?.form_title).toBe('new');
    expect(findSubmissionByToolCallId(messages, 'nope')).toBeNull();
    expect(findSubmissionByToolCallId(messages, undefined)).toBeNull();
    expect(findSubmissionByToolCallId(messages, '')).toBeNull();
  });

  it('cZe：跳过非对象 content', () => {
    const messages = [{ contents: [{ type: 'form_submission', content: null }] }];
    expect(findSubmissionByToolCallId(messages, 'tc')).toBeNull();
  });

  it('lZe：只认 tool === "show_form" 且 tool_call_id 相等', () => {
    const messages = [
      {
        contents: [
          {
            type: 'tool_event',
            content: { tool: 'show_form', tool_call_id: 'tc', request: { title: 'R', fields: [{ id: 'a', label: 'A' }] } },
          },
        ],
      },
      {
        contents: [
          {
            type: 'tool_event',
            content: { tool: 'show_widget', tool_call_id: 'tc', request: { title: 'X', fields: [{ id: 'b', label: 'B' }] } },
          },
        ],
      },
    ];
    expect(findFormDefinitionByToolCallId(messages, 'tc')?.title).toBe('R');
    expect(findFormDefinitionByToolCallId(messages, 'other')).toBeNull();
    expect(findFormDefinitionByToolCallId(messages, undefined)).toBeNull();
  });

  it('Koe：只为 image_select 建索引，且只收有 file_id 的选项', () => {
    const index = buildImageFieldIndex(
      form({
        fields: [
          field({ id: 'img', type: 'image_select', options: [
            { value: 'a', label: 'A', file_id: 'fa' },
            { value: 'b', label: 'B' },
          ] }),
          field({ id: 'other', type: 'radio', options: [{ value: 'a', label: 'A', file_id: 'fa' }] }),
        ],
      }),
    );
    expect([...(index?.keys() ?? [])]).toEqual(['img']);
    expect(index?.get('img')?.get('a')).toBe('fa');
    expect(index?.get('img')?.has('b')).toBe(false);
  });

  it('Koe：null 表单 ⇒ 空 Map（不是 undefined）', () => {
    expect(buildImageFieldIndex(null)?.size).toBe(0);
  });

  it('toOfficialMessages：MTV 无 contents 通道 ⇒ 恒为空（官方回显分支不触发）', () => {
    expect(toOfficialMessages([{ id: 'm1' }])).toEqual([]);
  });

  it('resolveFormImageUrl：http(s) 直链原样，其余原样（官方 CW 未解析）', () => {
    expect(resolveFormImageUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
    expect(resolveFormImageUrl('  http://x/y  ')).toBe('http://x/y');
    expect(resolveFormImageUrl('file-123')).toBe('file-123');
  });
});
