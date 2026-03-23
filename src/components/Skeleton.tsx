'use client';

/**
 * Skeleton 组件属性。
 */
export interface SkeletonProps {
  /** 骨架条数量 */
  lines?: number;
  /** 骨架呈现形态 */
  variant?: 'text' | 'card';
}

/**
 * 通用骨架屏组件。
 * 支持文本和卡片两种形态。
 */
export function Skeleton({ lines = 4, variant = 'text' }: SkeletonProps) {
  return (
    <div className={`skeleton-block skeleton-${variant}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="skeleton-line"
          style={{
            width: `${variant === 'card' ? 100 : Math.max(45, 100 - index * 9)}%`,
          }}
        />
      ))}
    </div>
  );
}
