/**
 * settings/providerConnection/ProviderConnectionForm — 连接信息区块。
 * 负责凭证字段、OAuth 登录态、重复地址提示与「验证连接」，模型选择不在这里。
 */
import Select from '../../shared/Select';
import { Icon } from '@iconify/react';
import type { Dispatch, SetStateAction } from 'react';
import { useT } from '../../../i18n';
import type { ChatApiProtocol } from '../../../types';
import { CHAT_API_PROTOCOL_LABELS } from '../../../services/ai/chatApiProtocol';
import { normalizeBaseUrl } from '../../../services/ai/providerBaseUrl';
import type { ProviderDefinition } from '../../../services/ai/providerCatalogService';
import { OfficialInput, OfficialButton, OfficialNote, OFFICIAL_SELECT_TRIGGER } from '../official/OfficialControls';
import { PROVIDER_LINKS, openExternal, type CatalogStatus } from './providerConnectionShared';

interface ProviderConnectionFormProps {
  editing: boolean;
  definition: ProviderDefinition;
  isWebSearchProvider: boolean;
  connectionName: string;
  setConnectionName: Dispatch<SetStateAction<string>>;
  chatApiProtocol: ChatApiProtocol;
  setChatApiProtocol: Dispatch<SetStateAction<ChatApiProtocol>>;
  apiKey: string;
  setApiKey: Dispatch<SetStateAction<string>>;
  baseUrl: string;
  setBaseUrl: Dispatch<SetStateAction<string>>;
  workflowApiKey: string;
  setWorkflowApiKey: Dispatch<SetStateAction<string>>;
  dreaminaLoggedIn: boolean;
  dreaminaLoading: boolean;
  onDreaminaLogin: () => void;
  duplicateConnectionName: string;
  catalogStatus: CatalogStatus;
  catalogMessage: string;
  missingCredentials: boolean;
  onReturnToPicker: () => void;
  onTestConnection: () => void;
}

export default function ProviderConnectionForm({
  editing,
  definition,
  isWebSearchProvider,
  connectionName,
  setConnectionName,
  chatApiProtocol,
  setChatApiProtocol,
  apiKey,
  setApiKey,
  baseUrl,
  setBaseUrl,
  workflowApiKey,
  setWorkflowApiKey,
  dreaminaLoggedIn,
  dreaminaLoading,
  onDreaminaLogin,
  duplicateConnectionName,
  catalogStatus,
  catalogMessage,
  missingCredentials,
  onReturnToPicker,
  onTestConnection,
}: ProviderConnectionFormProps) {
  const t = useT();
  const isWorkflowApi = definition.kind === 'workflow-api';

  return (
    <section className="o-section">
      <div className="o-section__head">
        <div>
          <h4 className="o-section__title">{t('连接信息')}</h4>
          <p className="o-section__desc">{isWorkflowApi ? t(definition.description) : definition.description}</p>
        </div>
        {!editing && !isWebSearchProvider && (
          <OfficialButton type="button" variant="ghost" size="sm" className="o-icon-btn" onClick={onReturnToPicker}>
            {t('更换厂商')}
          </OfficialButton>
        )}
      </div>

      {definition.id === 'custom-openai' && (
        <OfficialNote tone="warning" icon={<Icon icon="lucide:circle-alert" width={16} />}>
          {t('提示：每个中转站提供的模型和参数规则都不一样，从接口拉取下来的模型，不一定能直接拿来用。不同中转站对同一个模型的名字、传入图片、尺寸等参数往往不同，直接使用可能会报错。请先查看你所用中转站的官方文档，把对应的参数改成文档里的值。如果你不会改，可以这样做：直接把中转站的文档发给对话助手，或者开启智能体并接入 MCP，让助手照着文档帮你添加和配置。')}
        </OfficialNote>
      )}

      {(definition.id === 'custom-openai' || isWorkflowApi) && (
        <label className="o-field">
          <span className="o-field__label">{t('连接名称')}</span>
          <OfficialInput
            type="text"
            value={connectionName}
            placeholder={t('例如：团队模型网关')}
            onChange={(event) => setConnectionName(event.target.value)}
          />
        </label>
      )}

      {definition.id === 'custom-openai' && (
        <label className="o-field">
          <span className="o-field__label">{t('对话协议')}</span>
          <Select fixedMenu triggerClassName={OFFICIAL_SELECT_TRIGGER} menuClassName="o-menu" menuHideOverlayScrollbar closeOnScroll className="min-w-0"
            value={chatApiProtocol}
            onChange={(selectedOptionValue) => setChatApiProtocol(selectedOptionValue as ChatApiProtocol)}
          >
            {Object.entries(CHAT_API_PROTOCOL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{t(label)}</option>
            ))}
          </Select>
          <small className="o-field__desc">
            {chatApiProtocol === 'anthropic-compatible'
              ? t('使用 Messages API、x-api-key 和 Anthropic 流式事件')
              : chatApiProtocol === 'gemini-native'
                ? t('使用原生 generateContent、x-goog-api-key 和 Gemini 内容结构')
                : t('使用 Chat Completions、Bearer Key 和 OpenAI SSE')}
          </small>
        </label>
      )}

      {definition.authType === 'oauth' ? (
        <div className="o-card">
          <div className="o-card__row o-card__row--center">
            <span className={`o-state${dreaminaLoggedIn ? ' o-state--ok' : ''}`}>
              <span className="o-dot" />
            </span>
            <div className="o-card__body">
              <div className="o-card__title">{dreaminaLoggedIn ? t('即梦账号已登录') : t('即梦账号未登录')}</div>
              <div className="o-card__desc">{t('模型调用使用桌面端 OAuth 登录态')}</div>
            </div>
            <OfficialButton
              type="button"
              variant="outline"
              size="sm"
              disabled={dreaminaLoading}
              onClick={onDreaminaLogin}
            >
              {dreaminaLoading ? t('处理中...') : dreaminaLoggedIn ? t('重新登录') : t('OAuth 登录')}
            </OfficialButton>
          </div>
        </div>
      ) : (
        <div className="o-fields">
          {definition.credentials.map((field) => {
            const value = field.key === 'apiKey' ? apiKey : baseUrl;
            const baseUrlLocked = field.key === 'baseUrl'
              && definition.allowCustomBaseUrl === false;
            return (
              <label key={field.key} className="o-field">
                <span className="o-field__label">{definition.id === 'runninghub-model' && field.key === 'apiKey' ? '模型 API Key（企业级 / 共享）' : isWorkflowApi ? t(field.label) : field.label}{field.required && definition.id !== 'runninghub-model' ? ' *' : ''}</span>
                <OfficialInput
                  type={field.secret ? 'password' : 'text'}
                  value={value}
                  placeholder={isWorkflowApi && field.placeholder ? t(field.placeholder) : field.placeholder}
                  readOnly={baseUrlLocked}
                  disabled={baseUrlLocked}
                  onChange={(event) => {
                    if (field.key === 'apiKey') setApiKey(event.target.value);
                    else setBaseUrl(event.target.value);
                  }}
                  onBlur={(event) => {
                    // 补协议、去尾斜杠、剥掉误贴的 /chat/completions，
                    // 让用户在保存前就看见真正会被请求的地址
                    if (field.key === 'baseUrl' && !isWorkflowApi) {
                      setBaseUrl(normalizeBaseUrl(event.target.value, chatApiProtocol));
                    }
                  }}
                />
              </label>
            );
          })}
          {definition.id === 'runninghub-model' && (
            <label className="o-field">
              <span className="o-field__label">{t('工作流 API Key（消费级 / 会员）')}</span>
              <OfficialInput
                type="password"
                value={workflowApiKey}
                placeholder={t('用于 RunningHub 工作流执行（可选）')}
                onChange={(event) => setWorkflowApiKey(event.target.value)}
              />
              <small className="o-field__desc">用于云工作流与 AI 应用；也可以只填写此密钥。每个云工作流可单独选择使用哪种连接。</small>
            </label>
          )}
        </div>
      )}

      {isWorkflowApi && <p className="o-field__desc">{t('填写平台提供的密钥，鉴权方式和前缀在各工作流的调用协议中配置。')}</p>}
      {duplicateConnectionName && (
        <OfficialNote tone="warning" icon={<Icon icon="lucide:copy" width={16} />}>
          {t('已有连接「{name}」使用相同接口地址和对话协议。继续保存会新建第二条同网关连接；如果只是想加模型，建议回列表编辑「{name}」。', {
            name: duplicateConnectionName,
          })}
        </OfficialNote>
      )}

      {(definition.externalUrl || PROVIDER_LINKS[definition.id]) && (
        <div>
          <OfficialButton
            type="button"
            variant="ghost"
            size="sm"
            className="o-icon-btn"
            onClick={() => void openExternal(
              definition.externalUrl || PROVIDER_LINKS[definition.id],
            )}
          >
            <Icon icon="lucide:external-link" width={16} />
            {definition.id === 'grsai' ? t('前往 API Key 页面') : t('前往厂商控制台')}
          </OfficialButton>
        </div>
      )}

      {definition.authType !== 'oauth' && (
        <div className="o-inline o-inline--wrap">
          <OfficialButton
            type="button"
            variant="outline"
            size="sm"
            disabled={missingCredentials || catalogStatus === 'loading'}
            onClick={() => void onTestConnection()}
          >
            <Icon
              icon={catalogStatus === 'loading' ? 'lucide:loader-circle' : 'lucide:plug-zap'}
              className={catalogStatus === 'loading' ? 'settings-spin' : undefined}
              width={16}
            />
            {catalogStatus === 'loading' ? t('验证中') : isWorkflowApi ? t('检查配置') : t('验证连接')}
          </OfficialButton>
          {(isWebSearchProvider || isWorkflowApi) && catalogMessage && (
            <span className={`o-state${catalogStatus === 'error' ? ' o-state--error' : catalogStatus === 'warning' ? ' o-state--wait' : ''}`}>
              <Icon
                icon={catalogStatus === 'error' ? 'lucide:circle-alert' : 'lucide:info'}
                width={14}
              />
              {isWorkflowApi ? t(catalogMessage) : catalogMessage}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
