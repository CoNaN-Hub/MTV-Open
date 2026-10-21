/**
 * 官方 TapNow `show_form` / `form_submission` 表单族的**纯逻辑层** —— 逐字复刻。
 *
 * 取证来源：`D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`
 * （下文偏移均为该文件内的 UTF-16 code unit 偏移），契约文档 `D:\DEEPSEEK\live-提问表单族.md` §2.2–§2.4 / §3.1–§3.2。
 *
 * 每个函数的**官方压缩名 / 定义偏移**都写在注释里；函数体按源码逐字转写（含官方那些看起来
 * 多余的分支、`?? 5` 之类的兜底、以及 `!(a || b)` 这种写法），不做「等价简化」。
 *
 * 本文件不含任何 React / DOM —— 全部是可直接单测的纯函数。
 */

// ─────────────────────────────────────────────────────────────────────────────
// 官方 `WQe` / `af`（@2167320 / @2167480 邻域，逐字）
// ─────────────────────────────────────────────────────────────────────────────

/** 官方 `WQe = new Set(["radio","checkbox","select","text","rating","slider","date","number","image_select"])`。 */
export const FORM_FIELD_TYPES = new Set([
  'radio',
  'checkbox',
  'select',
  'text',
  'rating',
  'slider',
  'date',
  'number',
  'image_select',
]);

export type FormFieldType =
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'text'
  | 'rating'
  | 'slider'
  | 'date'
  | 'number'
  | 'image_select';

/** 官方 `af` 的返回值域：命中 `WQe` 之外一律 `"unknown"`。 */
export type FormFieldKind = FormFieldType | 'unknown';

export type FormLanguage = 'zh' | 'en' | 'ja' | 'ko' | 'fr';

export interface FormOption {
  value: string;
  label: string;
  /** 官方只在 `file_id` 非空时写入该键（`p && (f.file_id = p)`）。 */
  file_id?: string;
  /** 官方只在 `description` 非空时写入该键。 */
  description?: string;
}

export interface FormField {
  id: string;
  type: string;
  label: string;
  description?: string;
  required: boolean;
  options?: FormOption[];
  min_select?: number;
  max_select?: number;
  multiline: boolean;
  max_length?: number;
  placeholder?: string;
  max?: number;
  min?: number;
  step?: number;
  unit?: string;
}

export interface FormDefinition {
  title: string;
  description?: string;
  submit_label?: string;
  accent?: string;
  form_icon?: string;
  display_type?: string;
  fields: FormField[];
}

export interface FormLabelSet {
  submit: string;
  skip: string;
  edit: string;
  submitted: string;
  skipped: string;
  required: string;
  minSelect: string;
  maxSelect: string;
  maxLength: string;
  numberMin: string;
  numberMax: string;
  selectPlaceholder: string;
  datePlaceholder: string;
  unanswered: string;
}

export type FormFieldValue = string | number | string[] | null;
export type FormValues = Record<string, FormFieldValue>;

export interface FormSubmissionValue {
  field_id: string;
  field_label: string;
  value: string | number | string[] | null;
  display: string | null;
}

export interface FormSubmission {
  tool_call_id: string;
  form_title: string;
  values: FormSubmissionValue[];
  skipped: boolean;
}

/** 官方 `af = e => WQe.has(e.type) ? e.type : "unknown"`（大小写敏感，不做 lower）。 */
export function formFieldType(field: { type?: unknown }): FormFieldKind {
  const type = field.type;
  return typeof type === 'string' && FORM_FIELD_TYPES.has(type) ? (type as FormFieldType) : 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// 官方辅助：`Ur` / `rh` / `Goe` / `gy`（@2169640 / @2169400，逐字）
// ─────────────────────────────────────────────────────────────────────────────

/** 官方 `Ur = (e, t = "") => typeof e === "string" ? e : t`。 */
export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/** 官方 `rh = e => typeof e === "number" && Number.isFinite(e) ? e : void 0`。 */
export function finiteNumberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** 官方 `Goe = (e, t) => typeof e === "number" ? e : void 0`（**不**做 `Number.isFinite`）。 */
export function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/** 官方 `gy = (e, t) => e.replace("{count}", String(t))` —— 只替换**第一处** `{count}`。 */
export function interpolateCount(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

/** `cx`：官方 `z`（clsx 语义）在本族里的全部用法都是「真值拼接」，这里给等价实现。 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// 官方 `PM` 表单本地化表（@2167720–@2169400，逐字；**独立于 i18n**）
// ─────────────────────────────────────────────────────────────────────────────

export const FORM_LABELS: Record<FormLanguage, FormLabelSet> = {
  zh: {
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
  },
  en: {
    submit: 'Submit',
    skip: 'Skip',
    edit: 'Edit',
    submitted: 'Submitted',
    skipped: 'Skipped',
    required: 'This field is required',
    minSelect: 'Select at least {count}',
    maxSelect: 'Select at most {count}',
    maxLength: 'Up to {count} characters',
    numberMin: 'Must be at least {count}',
    numberMax: 'Must be at most {count}',
    selectPlaceholder: 'Select',
    datePlaceholder: 'Pick a date',
    unanswered: 'Not answered',
  },
  ja: {
    submit: '送信',
    skip: 'スキップ',
    edit: '修正',
    submitted: '送信済み',
    skipped: 'スキップ済み',
    required: 'この項目は必須です',
    minSelect: '{count}件以上選択してください',
    maxSelect: '選択は{count}件までです',
    maxLength: '{count}文字以内で入力してください',
    numberMin: '{count}以上で入力してください',
    numberMax: '{count}以下で入力してください',
    selectPlaceholder: '選択してください',
    datePlaceholder: '日付を選択',
    unanswered: '未回答',
  },
  ko: {
    submit: '제출',
    skip: '건너뛰기',
    edit: '수정',
    submitted: '제출됨',
    skipped: '건너뜀',
    required: '필수 항목입니다',
    minSelect: '최소 {count}개 선택하세요',
    maxSelect: '최대 {count}개까지 선택할 수 있습니다',
    maxLength: '{count}자 이내로 입력하세요',
    numberMin: '{count} 이상이어야 합니다',
    numberMax: '{count} 이하여야 합니다',
    selectPlaceholder: '선택하세요',
    datePlaceholder: '날짜 선택',
    unanswered: '미응답',
  },
  fr: {
    submit: 'Envoyer',
    skip: 'Passer',
    edit: 'Modifier',
    submitted: 'Envoyé',
    skipped: 'Passé',
    required: 'Ce champ est requis',
    minSelect: 'Sélectionnez au moins {count}',
    maxSelect: 'Sélectionnez au plus {count}',
    maxLength: '{count} caractères maximum',
    numberMin: 'Doit être au moins {count}',
    numberMax: 'Doit être au plus {count}',
    selectPlaceholder: 'Sélectionner',
    datePlaceholder: 'Choisir une date',
    unanswered: 'Non renseigné',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 语言侦测：官方 `qQe`（@2169640） + `Voe`（@2167500），逐字
// ─────────────────────────────────────────────────────────────────────────────

/** 官方 `qQe = e => [e.title, e.description ?? "", ...e.fields.flatMap(t => [t.label, ...(t.options ?? []).map(n => n.label)])].join(" ")`。 */
export function buildFormLanguageSample(form: FormDefinition): string {
  return [
    form.title,
    form.description ?? '',
    ...form.fields.flatMap((field) => [
      field.label,
      ...(field.options ?? []).map((option) => option.label),
    ]),
  ].join(' ');
}

/** 官方 `Voe`：纯正则、**按表单文案内容**侦测语言（不是界面语言）。 */
export function detectFormLanguage(text: string): FormLanguage {
  return /[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)
    ? 'ko'
    : /[\u3040-\u309F\u30A0-\u30FF]/.test(text)
      ? 'ja'
      : /[\u4E00-\u9FFF]/.test(text)
        ? 'zh'
        : /[àâçéèêëîïôùûüÿœæ]|qu'|aujourd'hui|est-ce/i.test(text)
          ? 'fr'
          : 'en';
}

// ─────────────────────────────────────────────────────────────────────────────
// 字段解析：官方 `KQe`（@2169740） / `Hoe`（@2170560），逐字
// ─────────────────────────────────────────────────────────────────────────────

/** 官方 `KQe`：单个字段归一化；缺 `id` 或 `label` 一律 `null`。 */
export function parseFormField(raw: unknown): FormField | null {
  if (!raw || typeof raw !== 'object') return null;
  const field = raw as Record<string, unknown>;
  const id = asString(field.id).trim();
  const label = asString(field.label).trim();
  if (!id || !label) return null;
  const options = (Array.isArray(field.options) ? field.options : [])
    .map((rawOption) => {
      if (!rawOption || typeof rawOption !== 'object') return null;
      const option = rawOption as Record<string, unknown>;
      const value = asString(option.value).trim();
      const label = asString(option.label).trim() || value;
      if (!value) return null;
      const fileId = asString(option.file_id).trim();
      const description = asString(option.description).trim();
      const parsed: FormOption = { value, label };
      if (fileId) parsed.file_id = fileId;
      if (description) parsed.description = description;
      return parsed;
    })
    .filter((option): option is FormOption => !!option);
  return {
    id,
    type: asString(field.type, 'text').trim() || 'text',
    label,
    description: asString(field.description).trim() || undefined,
    required: field.required === true,
    options: options.length > 0 ? options : undefined,
    min_select: finiteNumberOrUndefined(field.min_select),
    max_select: finiteNumberOrUndefined(field.max_select),
    multiline: field.multiline === true,
    max_length: finiteNumberOrUndefined(field.max_length),
    placeholder: asString(field.placeholder) || undefined,
    max: finiteNumberOrUndefined(field.max),
    min: finiteNumberOrUndefined(field.min),
    step: finiteNumberOrUndefined(field.step),
    unit: asString(field.unit) || undefined,
  };
}

/**
 * 官方 `Hoe`：`tool_event.content` → 表单定义。
 * 先看 `response.form`，否则回落 `request`；`fields` 归一化后为空 ⇒ `null`（== 不渲染卡片）。
 */
export function parseFormContent(content: unknown): FormDefinition | null {
  const event = (content ?? {}) as Record<string, unknown>;
  const response = event.response;
  const nested = response && typeof response === 'object' ? (response as Record<string, unknown>).form : undefined;
  const form =
    nested && typeof nested === 'object'
      ? (nested as Record<string, unknown>)
      : event.request && typeof event.request === 'object'
        ? (event.request as Record<string, unknown>)
        : null;
  if (!form) return null;
  const fields = (Array.isArray(form.fields) ? form.fields : [])
    .map(parseFormField)
    .filter((field): field is FormField => !!field);
  if (fields.length === 0) return null;
  return {
    title: asString(form.title),
    description: asString(form.description) || undefined,
    submit_label: asString(form.submit_label) || undefined,
    accent: asString(form.accent) || undefined,
    form_icon: asString(form.form_icon) || undefined,
    display_type: asString(form.display_type) || undefined,
    fields,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 展示值 / 校验 / 序列化：官方 `FB` `Woe` `iZe` `aZe`（@2172880–@2174200），逐字
// ─────────────────────────────────────────────────────────────────────────────

/** 官方 `FB = (e, t) => { const n = e.options?.find(o => o.value === t); return n ? (n.label === t ? n.label : `${n.label} (${t})`) : t }`。 */
export function formatOptionValue(field: FormField, value: string): string {
  const option = field.options?.find((item) => item.value === value);
  return option ? (option.label === value ? option.label : `${option.label} (${value})`) : value;
}

/** 官方 `Woe`：字段值 → 展示串（`null` 表示「未填」）。 */
export function displayFieldValue(field: FormField, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  switch (formFieldType(field)) {
    case 'radio':
    case 'select':
      return typeof value === 'string' && value ? formatOptionValue(field, value) : null;
    case 'checkbox':
    case 'image_select':
      return Array.isArray(value) && value.length > 0
        ? value.map((item) => formatOptionValue(field, String(item))).join(', ')
        : null;
    case 'rating':
      return typeof value === 'number' ? `${value}/${field.max ?? 5}` : null;
    case 'slider':
    case 'number':
      return typeof value === 'number' ? `${value}${field.unit ?? ''}` : null;
    case 'date':
      return typeof value === 'string' && value ? value : null;
    default: {
      const text = typeof value === 'string' ? value.trim() : '';
      return text || null;
    }
  }
}

/** 官方 `iZe`：把当前字段值组装成提交载荷。 */
export function serializeSubmissionValues(
  fields: FormField[],
  values: FormValues,
): FormSubmissionValue[] {
  return fields.map((field) => {
    const raw = values[field.id] ?? null;
    const display = displayFieldValue(field, raw);
    if (display === null) {
      return { field_id: field.id, field_label: field.label, value: null, display: null };
    }
    const asDisplay = formFieldType(field) === 'text' || formFieldType(field) === 'unknown';
    return {
      field_id: field.id,
      field_label: field.label,
      value: asDisplay ? display : (raw as string | number | string[] | null),
      display,
    };
  });
}

/** 官方 `aZe`：单字段校验，返回错误文案或 `null`。 */
export function validateField(
  field: FormField,
  value: unknown,
  labels: FormLabelSet,
  _lang: FormLanguage = 'zh',
): string | null {
  const kind = formFieldType(field);
  if (displayFieldValue(field, value) === null) return field.required ? labels.required : null;
  if ((kind === 'checkbox' || kind === 'image_select') && Array.isArray(value)) {
    if (typeof field.min_select === 'number' && value.length < field.min_select) {
      return interpolateCount(labels.minSelect, field.min_select);
    }
    if (typeof field.max_select === 'number' && value.length > field.max_select) {
      return interpolateCount(labels.maxSelect, field.max_select);
    }
  }
  if ((kind === 'text' || kind === 'unknown') && typeof value === 'string') {
    const maxLength = numberOrUndefined(field.max_length);
    if (typeof maxLength === 'number' && value.trim().length > maxLength) {
      return interpolateCount(labels.maxLength, maxLength);
    }
  }
  if (kind === 'number' && typeof value === 'number') {
    if (typeof field.min === 'number' && value < field.min) {
      return interpolateCount(labels.numberMin, field.min);
    }
    if (typeof field.max === 'number' && value > field.max) {
      return interpolateCount(labels.numberMax, field.max);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 紧凑布局判定：官方 `$oe`（@2171088）——单选/多选的胶囊布局开关
// ─────────────────────────────────────────────────────────────────────────────

/** 官方 `YQe = 14`：胶囊布局的 label 长度上限。 */
export const COMPACT_OPTION_LABEL_MAX = 14;

/** 官方 `$oe`：仅 radio/checkbox；所有选项 label 长度 ≤ 14 且**全部无 description** 时才走胶囊行。 */
export function isCompactOptionLayout(field: FormField): boolean {
  const kind = formFieldType(field);
  if (kind !== 'radio' && kind !== 'checkbox') return false;
  const options = field.options ?? [];
  return options.length === 0
    ? false
    : options.every((option) => option.label.length <= COMPACT_OPTION_LABEL_MAX && !option.description);
}

// ─────────────────────────────────────────────────────────────────────────────
// accent → CSS 变量：官方 `XQe` `QQe` `ZQe` `JQe` `eZe` `tZe` `nZe` `oZe` `sZe` `rZe`
// （@2171080–@2172280，逐字）
// ─────────────────────────────────────────────────────────────────────────────

/** 官方 `XQe = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/`。 */
export const ACCENT_HEX_PATTERN = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** 官方 `QQe`：语义色预设。 */
export const ACCENT_PRESET_HEX: Record<string, string> = {
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',
};

/** 官方 `ZQe` / `JQe` / `eZe`：HSL 归一化的亮度下限、亮度上限、饱和度下限。 */
export const HSL_LIGHTNESS_MIN = 0.56;
export const HSL_LIGHTNESS_MAX = 0.72;
export const HSL_SATURATION_MIN = 0.18;

/** 官方 `tZe`：hex → 三个 0..255 整数。 */
function hexToRgbChannels(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

/** 官方 `nZe`：RGB → hex（`padStart(2,"0")`，逐字）。 */
function rgbChannelsToHex(r: number, g: number, b: number): string {
  const channel = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** 官方 `oZe`：hex → HSL → 钳制（亮度 [.56,.72]、饱和度 ≥.18）→ hex。 */
export function normalizeAccentHex(hex: string): string {
  const [r0, g0, b0] = hexToRgbChannels(hex);
  const r = r0 / 255;
  const g = g0 / 255;
  const b = b0 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  if (delta !== 0) {
    hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const clampedLightness = Math.min(HSL_LIGHTNESS_MAX, Math.max(HSL_LIGHTNESS_MIN, lightness));
  const clampedSaturation = delta === 0 ? 0 : Math.max(HSL_SATURATION_MIN, saturation);
  if (clampedLightness === lightness && clampedSaturation === saturation) return hex;
  const c = (1 - Math.abs(2 * clampedLightness - 1)) * clampedSaturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = clampedLightness - c / 2;
  const [rp, gp, bp] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];
  return rgbChannelsToHex((rp + m) * 255, (gp + m) * 255, (bp + m) * 255);
}

/** 官方 `sZe`：accent 归一化；`""` / `"default"` / 非法 → `null`。 */
export function normalizeFormAccent(accent: string | undefined): string | null {
  const trimmed = (accent ?? '').trim();
  if (!trimmed || trimmed === 'default') return null;
  const preset = ACCENT_PRESET_HEX[trimmed];
  return (
    preset ??
    (ACCENT_HEX_PATTERN.test(trimmed)
      ? normalizeAccentHex(trimmed.length === 9 ? trimmed.slice(0, 7) : trimmed)
      : null)
  );
}

/** 官方 `rZe` 的返回类型：一整套 `--form-*` CSS 变量。 */
export type FormAccentVars = Record<`--form-${string}`, string>;

/**
 * 官方 `rZe = (e, t = false) => {…}` —— 用 `color-mix` 生成整套 CSS 变量。
 * `bubble`（官方第二参 `t`）会改变 section/按钮的混合比例。
 */
export function buildFormAccentVars(
  accent: string | null | undefined,
  bubble = false,
): FormAccentVars | undefined {
  if (!accent) return undefined;
  const mix = (percent: number, base: string) => `color-mix(in srgb, ${accent} ${percent}%, ${base})`;
  return {
    '--form-card-bg': mix(12, '#1f1f1f'),
    '--form-card-ring': mix(30, 'transparent'),
    '--form-section-bg': mix(bubble ? 20 : 8, 'transparent'),
    '--form-option-bg': mix(22, 'transparent'),
    '--form-option-bg-hover': mix(30, 'transparent'),
    '--form-option-ring': mix(28, 'transparent'),
    '--form-selected-bg': mix(38, 'transparent'),
    '--form-selected-ring': mix(62, 'transparent'),
    '--form-btn-bg': mix(bubble ? 60 : 56, 'transparent'),
    '--form-btn-bg-hover': mix(bubble ? 72 : 68, 'transparent'),
    '--form-btn-ring': mix(72, 'transparent'),
    '--form-btn-fg': mix(20, '#ffffff'),
    '--form-star': mix(65, '#ffffff'),
    '--form-title': mix(42, '#ffffff'),
    '--form-desc': mix(20, '#bcbcbc'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 共享 class 生成器：官方 `Yoe` / `Xoe`（@2176120 / @2176360，逐字）
// ─────────────────────────────────────────────────────────────────────────────

/** 官方 `Yoe`：网格态选项卡片（label 容器）。 */
export function optionCardClass(selected: boolean): string {
  return cx(
    'flex min-h-10 w-full cursor-pointer items-start gap-2.5 rounded-md px-3 py-2.5 transition-all',
    selected
      ? 'bg-[var(--form-selected-bg,rgba(255,255,255,0.08))] shadow-[inset_0_0_0_1px_var(--form-selected-ring,rgba(255,255,255,0.25))]'
      : 'bg-[var(--form-option-bg,rgba(255,255,255,0.03))] shadow-[inset_0_0_0_1px_var(--form-option-ring,rgba(255,255,255,0.06))] hover:bg-[var(--form-option-bg-hover,rgba(255,255,255,0.06))]',
  );
}

/** 官方 `Xoe`：紧凑态胶囊按钮。 */
export function optionPillClass(selected: boolean): string {
  return cx(
    'h-9 cursor-pointer rounded-full px-3.5 text-xs font-medium text-chat-foreground transition-all',
    selected
      ? 'bg-[var(--form-selected-bg,rgba(255,255,255,0.08))] shadow-[inset_0_0_0_1px_var(--form-selected-ring,rgba(255,255,255,0.35))]'
      : 'bg-[var(--form-option-bg,rgba(255,255,255,0.03))] shadow-[inset_0_0_0_1px_var(--form-option-ring,rgba(255,255,255,0.08))] hover:bg-[var(--form-option-bg-hover,rgba(255,255,255,0.06))]',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// `form_submission` item：官方 `qoe`（@2174345） / `lZe`（@2174864） / `cZe`（@2175320）
// ─────────────────────────────────────────────────────────────────────────────

/** 官方 `qoe`：`form_submission` content → 规范化提交记录；缺 `tool_call_id` → `null`。 */
export function parseFormSubmission(content: unknown): FormSubmission | null {
  const raw = (content ?? {}) as Record<string, unknown>;
  const nested = raw.form_submission;
  const source = nested && typeof nested === 'object' ? (nested as Record<string, unknown>) : raw;
  const toolCallId = asString(source.tool_call_id);
  if (!toolCallId) return null;
  const rawValues = Array.isArray(source.values) ? source.values : [];
  const values: FormSubmissionValue[] = [];
  for (const item of rawValues) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const fieldId = asString(entry.field_id);
    if (!fieldId) continue;
    const value = entry.value;
    values.push({
      field_id: fieldId,
      field_label: asString(entry.field_label) || fieldId,
      value:
        typeof value === 'string' || typeof value === 'number' || Array.isArray(value)
          ? (value as string | number | string[])
          : null,
      display: typeof entry.display === 'string' ? entry.display : null,
    });
  }
  return {
    tool_call_id: toolCallId,
    form_title: asString(source.form_title),
    values,
    skipped: source.skipped === true,
  };
}

/** 官方消息形状（本族只用到 `contents[].type` / `contents[].content`）。 */
export interface OfficialContentPart {
  type?: unknown;
  content?: unknown;
}

/** 官方 `hs(e).messages` 的形状。 */
export interface OfficialMessageLike {
  contents?: ReadonlyArray<OfficialContentPart>;
}

/**
 * 官方 `lZe = (e, t) => {…}` —— 按 `tool_call_id` 在同对话历史里**倒序**找 `show_form` 的
 * `tool_event`，再 `Hoe(l)` 得到表单定义（用于「已提交图片回显」）。
 *
 * 官方原文的条件是 `if (!(l.tool !== "show_form" || l.tool_call_id !== t)) return Hoe(l)`，
 * 展开即 `tool === "show_form" && tool_call_id === t`；这里逐字保留展开后的等价形式。
 */
export function findFormDefinitionByToolCallId(
  messages: ReadonlyArray<OfficialMessageLike>,
  toolCallId: string | undefined,
): FormDefinition | null {
  if (!toolCallId) return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const parts = messages[index].contents || [];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = parts[partIndex];
      if (part.type !== 'tool_event' || typeof part.content !== 'object' || !part.content) continue;
      const event = part.content as Record<string, unknown>;
      if (event.tool !== 'show_form' || event.tool_call_id !== toolCallId) continue;
      return parseFormContent(event);
    }
  }
  return null;
}

/** 官方 `cZe = (e, t) => {…}` —— 按 `tool_call_id` 倒序找最近的 `form_submission`（FormCard 回显用）。 */
export function findSubmissionByToolCallId(
  messages: ReadonlyArray<OfficialMessageLike>,
  toolCallId: string | undefined,
): FormSubmission | null {
  if (!toolCallId) return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const parts = messages[index].contents || [];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = parts[partIndex];
      if (part.type !== 'form_submission' || typeof part.content !== 'object' || !part.content) continue;
      const submission = parseFormSubmission(part.content);
      if (submission?.tool_call_id === toolCallId) return submission;
    }
  }
  return null;
}

/** 官方 `Koe`：`image_select` 字段 → `fieldId → (optionValue → file_id)` 索引。 */export function buildImageFieldIndex(
  form: FormDefinition | null | undefined,
): Map<string, Map<string, string>> | undefined {
  const index = new Map<string, Map<string, string>>();
  for (const field of form?.fields ?? []) {
    if (formFieldType(field) !== 'image_select') continue;
    const options = new Map<string, string>();
    for (const option of field.options ?? []) {
      if (option.file_id) options.set(option.value, option.file_id);
    }
    index.set(field.id, options);
  }
  return index;
}

/**
 * ⚠️『官方实体未解析，待替换』—— 官方 `hs(e).messages` 的 MTV 等价物。
 *
 * 官方消息是 `{contents: [{type, content}]}` 的 **part 数组**；MTV 的 `ChatMessage`
 * （`src/types/chat.ts` @377）是**单一字符串 `content`**，没有 part 通道。
 * ⇒ 这里恒产出空列表，官方两条回显分支
 *   （`FormCard` 的 `cZe`「已提交回显」、`FormSubmissionSummaryCard` 的 `lZe`「图片回显」）
 *   在 MTV 上**不会触发**。
 * 等 MTV 引入官方 content-part 消息模型后，**替换本函数体**即可（调用点已按官方排好）。
 */
export function toOfficialMessages(
  _messages: ReadonlyArray<{ id: string }>,
): OfficialMessageLike[] {
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// 图片 URL：官方 `CW`（本族唯一**未解析**的官方实体）
// ─────────────────────────────────────────────────────────────────────────────
/**
 * ⚠️『官方实体未解析，待替换』
 *
 * 官方 `eF`(`ThumbnailImage`) 用 `CW(fileId)` 造图片地址。三步解析结果：
 *   `CW` ← 主 chunk `import{fH as CW}from"./vendor-packages-jvPqKqU8.js"`
 *   → `vendor-packages` `export{Oo as fH}` → `function Oo(e,t={}){return OE(e,t)}`（@48058）
 *   → `function OE(e,t={}){…}`（@11188）：
 *     `const s = /^https?:\/\//.test(n) ? Or(n) : \`${Qi()}${bl}${encodeURIComponent(n)}\``
 *   其中 `Qi()` = TapNow CDN 基址、`bl` = 文件路径前缀、`Or()` = 域名归一化（`RE`/`LE` 域名表）。
 *
 * MTV **没有**对应服务（无 TapNow CDN 基址 / 域名表，全库 grep `convertFileSrc|assetUrl|getFileUrl`
 * 零命中）⇒ 这里只保留「已是 http(s) 直链则原样返回」这一条可判定的分支，其余原样返回 fileId。
 * 后果：非 URL 的 `file_id` 会 `img.onError` ⇒ `ThumbnailImage` 自动退化成 `IconPhoto` 占位
 * （官方也有这条 `onError → IconPhoto` 兜底，见 §2.7.11），不会崩。
 * 等 MTV 有了文件服务后，**替换本函数体**即可。
 */
export function resolveFormImageUrl(fileId: string): string {
  const trimmed = fileId.trim();
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  return trimmed;
}
