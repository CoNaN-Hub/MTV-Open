/**
 * 官方 `chatAdapter.streaming.*` 文案表 —— `index-DjCL4F9p.js` 逐字
 * （en@8460904 一带 · ja@8869157 · ko@9006350 · zh@9138170）。
 *
 * 含官方 `Jx` 那四档思考活动文案（thinking / working / processing / composing）
 * 与 `recovering` / `interrupted` / `stoppedByUser`。
 *
 * ⚠️ 单独成表、不并入 MTV 的 i18n 字典，原因有二：
 *   ① `处理中...` 在 `settings.ts` 里已有别的译文（`Working…`），同键会串味；
 *   ② 原先 `ThinkingStatusLine` 用的是 `t('重连中...')` / `t('停止中...')`，这两个键在 zh 字典里
 *      **不存在** ⇒ 四种语言下都直接吐出中文源串（真 bug）。官方 zh 是「正在重连...」/「正在停止...」。
 */
const STREAM_LABELS: Record<string, Record<string, string>> = {
  'zh-CN': {
    recovering: '正在重连...',
    interrupted: '正在停止...',
    thinking: '思考中...',
    working: '处理中...',
    processing: '运行中...',
    composing: '整理中...',
    stoppedByUser: '你已停止本次回复',
    compacting: '正在自动压缩上下文',
    compacted: '上下文已自动压缩',
  },
  'en-US': {
    recovering: 'Reconnecting...',
    interrupted: 'Stopping...',
    thinking: 'Thinking...',
    working: 'Working...',
    processing: 'Processing...',
    composing: 'Composing...',
    stoppedByUser: 'You stopped this response',
    compacting: 'Automatically compacting context',
    compacted: 'Context automatically compacted',
  },
  'ja-JP': {
    recovering: '再接続中...',
    interrupted: '停止中...',
    thinking: '考え中...',
    working: '処理中...',
    processing: '実行中...',
    composing: 'まとめ中...',
    stoppedByUser: '応答を停止しました',
    compacting: 'コンテキストを自動圧縮中',
    compacted: 'コンテキストを自動圧縮しました',
  },
  'ko-KR': {
    recovering: '재연결 중...',
    interrupted: '중지 중...',
    thinking: '생각 중...',
    working: '처리 중...',
    processing: '실행 중...',
    composing: '정리 중...',
    stoppedByUser: '응답을 중지했습니다',
    compacting: '컨텍스트 자동 압축 중',
    compacted: '컨텍스트 자동 압축 완료',
  },
};

/** 取官方 `chatAdapter.streaming.<key>` 文案（未知 locale 回落英文；未知 key 原样返回）。 */
export function streamLabel(key: string, locale: string): string {
  const table = STREAM_LABELS[locale] ?? STREAM_LABELS['en-US'];
  return table[key] ?? STREAM_LABELS['en-US'][key] ?? key;
}
