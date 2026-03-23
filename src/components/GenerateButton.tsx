'use client';

/**
 * GenerateButton 组件属性。
 */
export interface GenerateButtonProps {
  /** 是否生成中 */
  isGenerating: boolean;
  /** 空闲态是否禁用 */
  disabled?: boolean;
  /** 开始生成 */
  onGenerate: () => void;
  /** 停止生成 */
  onStop: () => void;
  /** 空闲态文案 */
  idleLabel: string;
  /** 生成中文案 */
  loadingLabel: string;
}

/**
 * 通用生成/停止按钮。
 * 根据 `isGenerating` 在开始和停止两种状态间切换。
 */
export function GenerateButton({
  isGenerating,
  disabled = false,
  onGenerate,
  onStop,
  idleLabel,
  loadingLabel,
}: GenerateButtonProps) {
  if (isGenerating) {
    return (
      <button type="button" className="generate-btn primary generating" onClick={onStop}>
        {loadingLabel}
      </button>
    );
  }

  return (
    <button type="button" className="generate-btn primary" onClick={onGenerate} disabled={disabled}>
      {idleLabel}
    </button>
  );
}
