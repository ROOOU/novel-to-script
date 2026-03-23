import { useState, useCallback, useEffect, useRef } from 'react';

export type ToastType = 'success' | 'error';

/**
 * Toast 展示状态。
 */
export interface ToastState<TType extends string = ToastType> {
  /** 提示文案 */
  message: string;
  /** 提示类型 */
  type: TType;
}

/**
 * useToast 返回值。
 */
export interface UseToastResult<TType extends string = ToastType> {
  /** 当前 toast 状态；为空时不渲染 */
  toast: ToastState<TType> | null;
  /** 展示 toast，默认 success */
  showToast: (message: string, type?: TType) => void;
}

/**
 * 共享 Toast 状态管理 Hook。
 * 自动 3 秒消失，并返回稳定的展示方法。
 */
export function useToast(): UseToastResult<ToastType> {
  const [toast, setToast] = useState<ToastState<ToastType> | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setToast({ message, type });
    timeoutRef.current = window.setTimeout(() => {
      setToast(null);
      timeoutRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { toast, showToast };
}
