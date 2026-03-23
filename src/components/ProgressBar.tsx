'use client';

/**
 * ProgressBar 组件属性。
 */
export interface ProgressBarProps {
  /** 当前进度，0 时显示不定长动画 */
  progress: number;
  /** 当前步骤文案 */
  currentStep: string;
}

/**
 * 通用进度条与步骤说明。
 * 当 `progress` 为 0 时显示不定长动画。
 */
export function ProgressBar({ progress, currentStep }: ProgressBarProps) {
  return (
    <div>
      <div className="progress-bar-container">
        <div
          className={`progress-bar ${progress === 0 ? 'indeterminate' : ''}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="progress-text">
        <span className="progress-dot" />
        {currentStep}
      </div>
    </div>
  );
}
