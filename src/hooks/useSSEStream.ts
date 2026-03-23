import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * SSE 事件基础载荷。
 */
export interface SSEEventPayload {
  /** SSE step 标记 */
  step?: string;
  [key: string]: unknown;
}

/**
 * step -> handler 的映射表。
 */
export type SSEHandlers<TPayload extends SSEEventPayload = SSEEventPayload> = Partial<
  Record<string, (data: TPayload) => void>
>;

export interface StartSSEStreamOptions<
  TPayload extends SSEEventPayload = SSEEventPayload,
  TBody extends object = object,
> {
  /** 请求地址 */
  url: string;
  /** 请求体 */
  body: TBody;
  /** 额外请求头 */
  extraHeaders?: Record<string, string>;
  /** SSE 事件处理器映射（step → handler） */
  handlers: SSEHandlers<TPayload>;
  /** 出错时的回调 */
  onError?: (error: Error) => void;
  /** 完成时的回调 */
  onFinally?: () => void;
}

export interface UseSSEStreamResult {
  /** 当前是否正在流式请求 */
  isStreaming: boolean;
  /** 启动流式请求 */
  startStream: <
    TPayload extends SSEEventPayload = SSEEventPayload,
    TBody extends object = object,
  >(
    options: StartSSEStreamOptions<TPayload, TBody>
  ) => Promise<void>;
  /** 中止当前请求 */
  stopStream: () => void;
}

/**
 * 共享 SSE 流式消费 Hook。
 * 自动处理 AbortController、SSE 解析、错误处理和中止清理。
 */
export function useSSEStream(): UseSSEStreamResult {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // 组件卸载时自动取消
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const startStream = useCallback(async <
    TPayload extends SSEEventPayload,
    TBody extends object,
  >({
    url,
    body,
    extraHeaders = {},
    handlers,
    onError,
    onFinally,
  }: StartSSEStreamOptions<TPayload, TBody>): Promise<void> => {
    // 取消之前的请求
    abortControllerRef.current?.abort();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsStreaming(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...extraHeaders,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const err = await response.json();
          throw new Error(err.error || '请求失败');
        }
        throw new Error(`服务器错误 (${response.status})，请检查服务是否正常运行`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法获取流式响应');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6)) as TPayload;
            const step = typeof data.step === 'string' ? data.step : '';
            if (step && handlers[step]) {
              handlers[step](data);
            }
          } catch (e) {
            console.warn('[SSE] 解析事件数据失败:', line, e);
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // 用户手动取消，不视为错误
      } else if (onError) {
        onError(error instanceof Error ? error : new Error('未知错误'));
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
      onFinally?.();
    }
  }, []);

  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { isStreaming, startStream, stopStream };
}
