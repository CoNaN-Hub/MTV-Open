/**
 * ai/httpUtils — HTTP 请求与错误解析共享工具
 *
 * 提取自 generateImage / generateText 中重复的 `!response.ok → 解析 errorBody → throw` 样板。
 */

/**
 * 解析 fetch 响应的错误信息并抛出。
 *
 * 统一处理 `!response.ok` 场景：优先读取常见 JSON 错误字段，
 * 否则截取原始响应文本（最多 200 字符）追加到默认消息后。
 *
 * @param response  fetch 返回的 Response 对象
 * @param defaultMsg 默认错误消息（应包含状态码，如 `图片生成失败 (404)`）
 * @throws Error — 永远抛出，不会正常返回
 */
export async function parseResponseError(response: Response, defaultMsg: string): Promise<never> {
  const errorBody = await response.text().catch(() => '');
  const isHtml = /text\/html/i.test(response.headers.get('Content-Type') ?? '')
    || /^\s*(?:<!doctype\s+html\b|<html\b)/i.test(errorBody);
  if (response.status === 504 && (isHtml || !errorBody.trim())) {
    throw new Error(`${defaultMsg}：网关等待上游响应超时（HTTP 504）。本次生成结果尚未确认，请先检查服务商任务记录，再决定是否重新生成。`);
  }
  /* ★ 524（Cloudflare 100 秒）—— 事故（用户真机）：土豆中转站同步生图 `gpt-image-2.5-flare`
     实测 **125 秒** 后被网关掐断，落盘成 `图片生成失败 (524): error code: 524`（用户看不懂、
     也无从下手）。厂商文档（`docs.ai-tudou.net/gpt-image-2(new)-docs.html` 标题逐字）：
     「**异步请求，同步请求请联系关管理员**」「如果需要 OpenAI 标准同步生图请求端点
     `v1/images/generations` 和 `v1/images/edits` 的请直接联系管理员进行适配！」
     ⇒ 这里给一条**可操作**的说明（不点厂商名，走「同步端点不适合长耗时生成」这条通用事实）。 */
  if (response.status === 524) {
    throw new Error(`${defaultMsg}：上游在网关的等待上限内没有返回（HTTP 524，Cloudflare 约 100 秒）。`
      + '同步生图端点撑不住长耗时生成——请改用该厂商的**异步生图**模型（id 常带 `-async`，'
      + '或厂商文档指定的统一异步模型）后重试。');
  }
  let errorMsg = defaultMsg;
  try {
    const payload = JSON.parse(errorBody) as unknown;
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const record = payload as Record<string, unknown>;
      const error = record.error;
      if (typeof error === 'string' && error.trim()) {
        errorMsg = error.trim();
      } else if (error && typeof error === 'object' && !Array.isArray(error)) {
        const message = (error as Record<string, unknown>).message;
        if (typeof message === 'string' && message.trim()) errorMsg = message.trim();
      } else if (typeof record.message === 'string' && record.message.trim()) {
        errorMsg = record.message.trim();
      } else if (typeof record.msg === 'string' && record.msg.trim()) {
        errorMsg = record.msg.trim();
      }
    }
  } catch {
    if (errorBody) errorMsg += `: ${errorBody.slice(0, 200)}`;
  }
  if (/\bapi[\s_-]*key\b/i.test(errorMsg)) {
    errorMsg += '（请确认使用模型 API Key，而非账户令牌；若密钥正确，请检查账户权限和积分余额）';
  }
  if (/^upstream request failed[.!]?$/i.test(errorMsg.trim())) {
    errorMsg += `（HTTP ${response.status}）`;
  }
  /* ★ 503 `No available channel for model X under group Y` —— new-api 系上游的标准报错。
     事故（用户真机）：agent 拿到的失败结果只有这一条原始英文，于是它自己总结成
     「当前图片模型暂时没有可用的服务通道（503）」，含糊且不可操作。这里点名**模型**与**分组**
     （上游原文保留），让模型/用户都能立刻知道换什么。 */
  const noChannel = /no available channel for model\s+(\S+)\s+under group\s+(\S+)/i.exec(errorMsg);
  if (noChannel) {
    errorMsg = `${defaultMsg}：平台在分组「${noChannel[2]}」下没有为模型 ${noChannel[1]} 配置可用线路`
      + `（上游原文：${errorMsg.trim()}）。请改用该厂商同族的其它模型，或换一个已配置线路的分组 / API Key 后重试。`;
  }
  throw new Error(errorMsg);
}

/**
 * 构建带 Bearer 认证的 JSON 请求头。
 * apiKey 为空时不添加 Authorization 字段（兼容无需鉴权的本地服务）。
 */
export function buildAuthHeaders(apiKey: string, contentType = 'application/json'): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': contentType };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}
