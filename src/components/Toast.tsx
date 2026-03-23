'use client';

import { ToastState } from '@/hooks/useToast';

/**
 * Toast 组件属性。
 */
export interface ToastProps {
  /** 当前 toast 状态；为空时不渲染 */
  toast: ToastState | null;
}

/**
 * 通用 Toast 提示组件。
 * 仅负责展示，不持有生命周期状态。
 */
export function Toast({ toast }: ToastProps) {
  if (!toast) {
    return null;
  }

  return (
    <div className={`toast ${toast.type}`}>
      {toast.type === 'success' ? '✅' : '❌'} {toast.message}
    </div>
  );
}
