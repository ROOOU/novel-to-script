'use client';

import { type DragEventHandler, type ReactNode } from 'react';

/**
 * FileDropzone 组件属性。
 */
export interface FileDropzoneProps {
  /** 是否处于拖拽激活态 */
  isDragActive: boolean;
  /** 拖放回调 */
  onDrop: DragEventHandler<HTMLDivElement>;
  /** 拖入回调 */
  onDragOver: DragEventHandler<HTMLDivElement>;
  /** 拖离回调 */
  onDragLeave: DragEventHandler<HTMLDivElement>;
  /** 区域内部内容 */
  children: ReactNode;
}

/**
 * 通用文本拖放区域。
 * 只提供拖放外壳，内部内容由调用方传入。
 */
export function FileDropzone({
  isDragActive,
  onDrop,
  onDragOver,
  onDragLeave,
  children,
}: FileDropzoneProps) {
  return (
    <div
      className={`text-dropzone ${isDragActive ? 'drag-active' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      {children}
    </div>
  );
}
