/**
 * 接收多种 API 请求示例，展示协议识别结果与置信度，并把用户确认的草稿交给模型编辑器。
 */
import Select from '../shared/Select';
import { Icon } from '@iconify/react';
import { useMemo, useState } from 'react';
import { GENERAL_MODEL_CATEGORY_LABELS, type GeneralModelCategory } from '../../types';
import {
  analyzeModelProtocolExamples,
  type ModelProtocolImportConfidence,
  type ModelProtocolImportFormat,
  type ModelProtocolImportResult,
  type ModelProtocolExamples,
} from '../../services/ai/modelProtocolImport';
import {
  OFFICIAL_SELECT_TRIGGER,
  OfficialBadge,
  OfficialButton,
  OfficialNote,
  OfficialSwitch,
  OfficialTextarea,
} from './official/OfficialControls';
import { useT } from '../../i18n';

interface ProtocolImportPanelProps {
  onApply: (result: ModelProtocolImportResult) => void;
  onClose: () => void;
}

const FORMAT_LABELS: Record<ModelProtocolImportFormat, string> = {
  fetch: 'Fetch',
  axios: 'Axios',
  curl: 'cURL',
  python: 'Python',
  'raw-http': 'Raw HTTP',
  openapi: 'OpenAPI JSON',
  json: 'JSON 响应',
};

const CONFIDENCE_LABELS: Record<ModelProtocolImportConfidence, string> = {
  high: '高置信度',
  medium: '需要检查',
  low: '低置信度',
};

const CONFIDENCE_TONES: Record<ModelProtocolImportConfidence, 'success' | 'warning' | 'danger'> = {
  high: 'success',
  medium: 'warning',
  low: 'danger',
};

const EMPTY_EXAMPLES: ModelProtocolExamples = {
  submitRequest: '',
  submitResponse: '',
  pollRequest: '',
  pollResponse: '',
};

interface ExampleEditorProps {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

function ExampleEditor({ label, value, placeholder, onChange }: ExampleEditorProps) {
  return (
    <label className="o-field">
      <span className="o-field__label">
        <Icon icon="lucide:braces" width={14} /> {label}
      </span>
      <OfficialTextarea
        value={value}
        rows={8}
        spellCheck={false}
        autoComplete="off"
        placeholder={placeholder}
        className="min-h-36 w-full resize-y font-mono text-xs"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export default function ProtocolImportPanel({ onApply, onClose }: ProtocolImportPanelProps) {
  const t = useT();
  const [examples, setExamples] = useState<ModelProtocolExamples>(EMPTY_EXAMPLES);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [result, setResult] = useState<ModelProtocolImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptedLowConfidence, setAcceptedLowConfidence] = useState(false);

  const canApply = !!result?.baseUrl
    && !!result.modelId
    && !!result.category
    && !!result.protocol
    && (result.confidence !== 'low' || acceptedLowConfidence);
  const protocolSummary = useMemo(() => {
    if (!result?.protocol) return '';
    const protocol = result.protocol;
    const lines = [`${protocol.submit.method} ${protocol.submit.path}`];
    if (protocol.mode === 'async' && protocol.poll) lines.push(`${protocol.poll.method} ${protocol.poll.path}`);
    return lines.join('  ->  ');
  }, [result]);
  const hasAnyExample = Object.values(examples).some((value) => !!value?.trim());
  const hasRequiredExamples = !!examples.submitRequest.trim()
    && !!examples.submitResponse.trim()
    && (!pollingEnabled || (!!examples.pollRequest?.trim() && !!examples.pollResponse?.trim()));

  const updateExample = (key: keyof ModelProtocolExamples, value: string) => {
    setExamples((current) => ({ ...current, [key]: value }));
    setResult(null);
    setError(null);
    setAcceptedLowConfidence(false);
  };

  const analyze = (category?: GeneralModelCategory) => {
    try {
      const nextResult = analyzeModelProtocolExamples({
        submitRequest: examples.submitRequest,
        submitResponse: examples.submitResponse,
        ...(pollingEnabled ? {
          pollRequest: examples.pollRequest,
          pollResponse: examples.pollResponse,
        } : {}),
      }, category ? { category } : undefined);
      setResult(nextResult);
      setError(null);
      setAcceptedLowConfidence(false);
    } catch (analysisError) {
      setResult(null);
      setError(analysisError instanceof Error ? analysisError.message : t('接口文档解析失败'));
      setAcceptedLowConfidence(false);
    }
  };

  const clear = () => {
    setExamples(EMPTY_EXAMPLES);
    setPollingEnabled(false);
    setResult(null);
    setError(null);
    setAcceptedLowConfidence(false);
  };

  return (
    <section
      className="o-card o-card--pad"
      aria-label={t('从接口文档导入')}
    >
      <div className="o-section">
        <div className="o-section__head">
          <div>
            <h4 className="o-section__title">
              <Icon icon="lucide:file-down" width={15} /> {t('从接口文档导入')}
            </h4>
            <p className="o-section__desc">
              {t('分别粘贴文档中的请求代码和响应 JSON，支持 Fetch、Axios、cURL、Python、Raw HTTP 与 OpenAPI JSON。')}
            </p>
          </div>
          <OfficialButton
            type="button"
            variant="ghost"
            size="icon-sm"
            className="o-icon-btn"
            aria-label={t('关闭接口文档导入')}
            title={t('关闭')}
            onClick={onClose}
          >
            <Icon icon="lucide:x" width={16} />
          </OfficialButton>
        </div>

        <div className="o-card">
          <div className="o-card__row o-card__row--stack">
            <div className="o-section__head">
              <div><h4 className="o-section__title">{t('提交阶段')}</h4></div>
              <span className="o-field__desc">{t('请求与响应均必填')}</span>
            </div>
            <div className="o-fields">
              <ExampleEditor
                label={t('提交请求示例')}
                value={examples.submitRequest}
                placeholder={t('粘贴 Fetch、cURL、Python 或 Raw HTTP 请求...')}
                onChange={(value) => updateExample('submitRequest', value)}
              />
              <ExampleEditor
                label={t('提交响应示例')}
                value={examples.submitResponse}
                placeholder={t('粘贴提交接口返回的 JSON...')}
                onChange={(value) => updateExample('submitResponse', value)}
              />
            </div>
          </div>

          <div className="o-card__row o-card__row--stack">
            <label className="o-inline" style={{ cursor: 'pointer' }}>
              <OfficialSwitch
                label={t('包含异步轮询')}
                checked={pollingEnabled}
                onChange={(next) => {
                  setPollingEnabled(next);
                  setResult(null);
                  setError(null);
                  setAcceptedLowConfidence(false);
                }}
              />
              <span className="o-field__label">{t('包含异步轮询')}</span>
            </label>
            {pollingEnabled ? (
              <div className="o-fields">
                <ExampleEditor
                  label={t('轮询请求示例')}
                  value={examples.pollRequest ?? ''}
                  placeholder={t('粘贴查询任务状态的请求代码...')}
                  onChange={(value) => updateExample('pollRequest', value)}
                />
                <ExampleEditor
                  label={t('轮询响应示例')}
                  value={examples.pollResponse ?? ''}
                  placeholder={t('粘贴任务完成时返回的 JSON...')}
                  onChange={(value) => updateExample('pollResponse', value)}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="o-inline o-inline--wrap">
          <span className="o-field__desc">{t('只在本地静态解析，不执行代码、不请求接口、不导入密钥')}</span>
          {hasAnyExample ? (
            <OfficialButton type="button" variant="ghost" size="sm" className="o-icon-btn" onClick={clear}>
              {t('清空')}
            </OfficialButton>
          ) : null}
          <OfficialButton
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasRequiredExamples}
            onClick={() => analyze()}
          >
            <Icon icon="lucide:wand-sparkles" width={16} />
            {t('识别文档')}
          </OfficialButton>
        </div>

        {error ? (
          <OfficialNote tone="danger" icon={<Icon icon="lucide:circle-alert" width={16} />}>
            <span role="alert">{error}</span>
          </OfficialNote>
        ) : null}

        {result ? (
          <div className="o-section" aria-live="polite">
            <div className="o-inline o-inline--wrap">
              <OfficialBadge tone={CONFIDENCE_TONES[result.confidence]}>
                {t(CONFIDENCE_LABELS[result.confidence])}
              </OfficialBadge>
              {result.formats.map((format) => (
                <OfficialBadge key={format} tone="outline">
                  {FORMAT_LABELS[format]}
                </OfficialBadge>
              ))}
            </div>

            <div className="o-fields">
              {result.fields.map((field) => (
                <div key={field.id} className="o-field" style={{ gap: 4 }}>
                  <span className="o-field__desc">{field.label}</span>
                  <code className="o-field__code">
                    {field.id === 'category'
                      ? t(GENERAL_MODEL_CATEGORY_LABELS[field.value as GeneralModelCategory] ?? field.value)
                      : field.value}
                  </code>
                </div>
              ))}
            </div>

            {result.category ? (
              <label className="o-field">
                <span className="o-field__label">{t('模型分类')}</span>
                <Select fixedMenu triggerClassName={OFFICIAL_SELECT_TRIGGER} menuClassName="o-menu" menuHideOverlayScrollbar closeOnScroll
                  value={result.category}
                  className="min-w-0"
                  size="sm"
                  onChange={(selectedOptionValue) => analyze(selectedOptionValue as GeneralModelCategory)}
                >
                  {(Object.keys(GENERAL_MODEL_CATEGORY_LABELS) as GeneralModelCategory[]).map((category) => (
                    <option key={category} value={category}>{t(GENERAL_MODEL_CATEGORY_LABELS[category])}</option>
                  ))}
                </Select>
              </label>
            ) : null}

            {protocolSummary ? (
              <OfficialNote icon={<Icon icon="lucide:git-branch" width={16} />}>
                <code className="o-field__code">{protocolSummary}</code>
              </OfficialNote>
            ) : null}

            {result.warnings.length > 0 ? (
              <OfficialNote tone="warning" icon={<Icon icon="lucide:triangle-alert" width={16} />}>
                {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
              </OfficialNote>
            ) : null}

            {result.confidence === 'low' ? (
              <label className="o-inline" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  className="o-check"
                  checked={acceptedLowConfidence}
                  onChange={(event) => setAcceptedLowConfidence(event.target.checked)}
                />
                <span className="o-field__desc">{t('我已检查低置信度字段，确认将识别结果应用到当前草稿')}</span>
              </label>
            ) : null}

            <div className="o-inline o-inline--wrap">
              <span className="o-field__desc">{t('应用后仍需保存厂商设置；现有 API Key 不会被覆盖')}</span>
              <OfficialButton
                type="button"
                variant="default"
                size="sm"
                disabled={!canApply}
                onClick={() => result && onApply(result)}
              >
                <Icon icon="lucide:check" width={16} />
                {t('应用识别结果')}
              </OfficialButton>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
