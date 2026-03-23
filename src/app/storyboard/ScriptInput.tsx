'use client';

import { type ChangeEventHandler, type DragEventHandler, type RefObject } from 'react';
import { FileDropzone } from '@/components/FileDropzone';

export interface ScriptInputProps {
  scriptText: string;
  wordCount: number;
  isTextDragActive: boolean;
  textFileInputRef: RefObject<HTMLInputElement | null>;
  accept: string;
  onScriptTextChange: (value: string) => void;
  onFileSelect: ChangeEventHandler<HTMLInputElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onOpenFilePicker: () => void;
  onLoadSample: () => void;
}

export function ScriptInput({
  scriptText,
  wordCount,
  isTextDragActive,
  textFileInputRef,
  accept,
  onScriptTextChange,
  onFileSelect,
  onDrop,
  onDragOver,
  onDragLeave,
  onOpenFilePicker,
  onLoadSample,
}: ScriptInputProps) {
  return (
    <div className="card animate-fade-in">
      <div className="card-header">
        <div className="card-icon card-icon-storyboard">🎬</div>
        <div>
          <div className="card-title">剧本文本</div>
          <div className="card-subtitle">输入或粘贴剧本片段</div>
        </div>
      </div>

      <FileDropzone
        isDragActive={isTextDragActive}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <textarea
          className="novel-textarea script-textarea"
          placeholder={"粘贴剧本片段...\n\n格式示例：\n1-1 日 内 场景名\n人物：角色A, 角色B\n△场景描述\n角色A：对白内容"}
          value={scriptText}
          onChange={(event) => onScriptTextChange(event.target.value)}
        />
        <input
          ref={textFileInputRef}
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
