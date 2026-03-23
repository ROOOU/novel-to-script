'use client';

export interface SafeModeDialogProps {
  open: boolean;
  message: string;
  retryPrompt: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SafeModeDialog({
  open,
  message,
  retryPrompt,
  onCancel,
  onConfirm,
}: SafeModeDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="confirm-overlay">
      <div className="confirm-card">
        <div className="confirm-title">安全内容错误</div>
        <div className="confirm-body">{message}</div>
        <div className="confirm-question">{retryPrompt}</div>
        <div className="confirm-actions">
          <button className="toolbar-btn" onClick={onCancel}>取消</button>
          <button className="generate-btn primary" onClick={onConfirm}>继续安全影视化重试</button>
        </div>
      </div>
    </div>
  );
}
