/**
 * API 常量 — 各供应商的默认 base URL
 * 集中管理，避免在多个文件中硬编码相同 URL
 */

/** APIMart 供应商 */
export const APIMART_BASE_URL = 'https://api.apib.ai/v1';

/** CCC API 中转站（OpenAI 兼容协议） */
export const CCCAPI_BASE_URL = 'https://cccapi.cn/v1';

/** 火山方舟 */
export const VOLCENGINE_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

/**
 * 土豆网关（`api.ai-tudou.net`）—— new-api 系、OpenAI 兼容。
 *
 * 实测依据（2026，落盘样本 `D:\DEEPSEEK\_r129-tudou-pricing.json`）：
 *   · 模型清单走**标准 OpenAI 端点** `GET /v1/models`（需要该连接的 API Key）；
 *   · 站点公开价目表 `GET /api/pricing`（**无需鉴权**）挂在**站点根**上，不带 `/v1`。
 * `https://api.ai-tudou.net/v1/models` 已实测存在，所以默认地址带 `/v1`。
 */
export const TUDOU_BASE_URL = 'https://api.ai-tudou.net/v1';

/** GRSAI */
export const GRSAI_LEGACY_BASE_URL = 'https://api.grsai.com';
export const GRSAI_GLOBAL_BASE_URL = 'https://grsaiapi.com/v1';
export const GRSAI_BASE_URL = 'https://grsai.dakka.com.cn/v1';

/** 即梦 Dreamina */
export const DREAMINA_BASE_URL = 'https://api.dreamina.com';

/** RunningHUB */
export const RUNNINGHUB_BASE_URL = 'https://api.runninghub.cn';

/** RunningHUB 标准模型 API（异步任务协议） */
export const RUNNINGHUB_MODEL_BASE_URL = 'https://www.runninghub.cn/openapi/v2';

/** Tavily 联网搜索 */
export const TAVILY_BASE_URL = 'https://api.tavily.com';

/** 博查 Web Search */
export const BOCHA_SEARCH_BASE_URL = 'https://api.bocha.cn';

/** 智谱 Web Search */
export const ZHIPU_SEARCH_BASE_URL = 'https://open.bigmodel.cn/api';

/** Exa Search */
export const EXA_SEARCH_BASE_URL = 'https://api.exa.ai';

/** 默认供应商 base URL 映射（用于 aiService 的 fallback） */
export const DEFAULT_BASE_URLS: Record<string, string> = {
  apimart: APIMART_BASE_URL,
  cccapi: CCCAPI_BASE_URL,
  volcengine: VOLCENGINE_BASE_URL,
  grsai: GRSAI_BASE_URL,
  dreamina: DREAMINA_BASE_URL,
  runninghub: RUNNINGHUB_BASE_URL,
};
