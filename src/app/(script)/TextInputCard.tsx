'use client';

import { type ChangeEventHandler, type DragEventHandler, type RefObject } from 'react';
import { FileDropzone } from '@/components/FileDropzone';

export interface TextInputCardProps {
  value: string;
  wordCount: number;
  isDragActive: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  accept: string;
  onChange: (value: string) => void;
  onDrop: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onFileSelect: ChangeEventHandler<HTMLInputElement>;
  onOpenFilePicker: () => void;
  onLoadSample: () => void;
}

export function TextInputCard({
  value,
  wordCount,
  isDragActive,
  fileInputRef,
  accept,
  onChange,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileSelect,
  onOpenFilePicker,
  onLoadSample,
}: TextInputCardProps) {
  return (
    <div className="card animate-fade-in">
      <div className="card-header">
        <div className="card-icon card-icon-book">📖</div>
        <div>
          <div className="card-title">小说文本</div>
          <div className="card-subtitle">粘贴小说内容或加载示例</div>
        </div>
      </div>

      <FileDropzone
        isDragActive={isDragActive}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <textarea
          className="novel-textarea"
          placeholder="在此粘贴网络小说文本...&#10;&#10;支持任意格式的小说文本，系统会自动清洗和分析。建议粘贴 1-3 个章节（2000-8000字）获得最佳效果。"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden-file-input"
          onChange={onFileSelect}
        />
      </FileDropzone>

      <div className="text-stats">
        <div className="stat-item">
          字数: <span className="stat-value">{wordCount.toLocaleString()}</span>
        </div>
        <button className="toolbar-btn toolbar-btn-compact" onClick={onOpenFilePicker}>
          📂 上传 txt/md
        </button>
        <button className="toolbar-btn toolbar-btn-compact" onClick={onLoadSample}>
          📝 加载示例
        </button>
        <div className="stat-item text-stats-note">
          支持拖入 `.txt` / `.md`
        </div>
      </div>
    </div>
  );
}
