/**
 * prompt 编辑缓冲 hooks —— 官方 `xF` @2268459 / `Use` @2269308 的逐字移植。
 *
 * ⚠️ 官方这两段**就是** `useState` + `useEffect(() => { setX(initial); ref.current = {} }, [initial])`
 * 的写法（`Use` 还在 render 期直接写 `i.current = e`）。仓库 ESLint 的
 * `react-hooks/set-state-in-effect` 与 `react-hooks/refs` 会报错，故按官方原样保留并**逐点豁免**
 * —— 不改成「等价实现」，以免与官方行为分叉。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** 官方 `xF`（legacy 单条）。 */
export function useSinglePromptState(initial: string) {
  const [prompt, setPrompt] = useState(initial);
  const pendingEditsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 官方 `xF` 逐字
    setPrompt(initial);
    pendingEditsRef.current = {};
  }, [initial]);
  const handleItemChange = useCallback((index: number, value: string) => {
    if (index === 0) setPrompt(value);
  }, []);
  const getEffectivePrompt = useCallback(() => {
    const pending = pendingEditsRef.current;
    if (0 in pending) {
      const value = pending[0];
      setPrompt(value);
      pendingEditsRef.current = {};
      return value;
    }
    return prompt;
  }, [prompt]);
  return { getEffectivePrompt, handleItemChange, pendingEditsRef, prompt, setPrompt };
}

/** 官方 `Use`（批量）。 */
export function useBatchPromptState(initial: readonly string[]) {
  const [prompts, setPrompts] = useState<readonly string[]>(initial);
  const pendingEditsRef = useRef<Record<string, string>>({});
  const serialized = JSON.stringify(initial);
  const latestRef = useRef(initial);
  // eslint-disable-next-line react-hooks/refs -- 官方 `Use` 逐字（render 期写 ref）
  latestRef.current = initial;
  useEffect(() => {
    setPrompts(latestRef.current);
    pendingEditsRef.current = {};
  }, [serialized]);
  const handleItemChange = useCallback((index: number, value: string) => {
    setPrompts((current) => {
      if (index < 0 || index >= current.length || current[index] === value) return current;
      const next = current.slice();
      next[index] = value;
      return next;
    });
  }, []);
  const getEffectivePrompts = useCallback(() => {
    const pending = pendingEditsRef.current;
    const keys = Object.keys(pending);
    if (keys.length === 0) return prompts;
    const next = prompts.slice();
    for (const key of keys) {
      const index = Number(key);
      if (index >= 0 && index < next.length) next[index] = pending[key];
    }
    setPrompts(next);
    pendingEditsRef.current = {};
    return next;
  }, [prompts]);
  return { getEffectivePrompts, handleItemChange, pendingEditsRef, prompts, setPrompts };
}
