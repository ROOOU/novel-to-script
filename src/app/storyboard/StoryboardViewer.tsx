'use client';

import { type RefObject } from 'react';
import { countChineseWords } from '@/lib/preprocessor';

export interface StoryboardViewerProps {
  storyboardResult: string;
  isGenerating: boolean;
  currentStep: string;
  resultRef: RefObject<HTMLDivElement | null>;
  onCopy: () => void;
  onExport: () => void;
}

function renderStoryboardContent(text: string) {
  return text.split(/(分镜[①②③④⑤⑥⑦⑧⑨⑩\d]+)/g).map((segment, segmentIndex) => {
    if (/^分镜[①②③④⑤⑥⑦⑧⑨⑩\d]+/.test(segment)) {
      return <span key={segmentIndex} className="shot-number-tag">{segment}</span>;
    }

    let processed = segment;
    processed = processed.replace(/(🧑\s*[^\s,，。]+?-基础形象-基础形象)/g, '##CHARACTER##$1##/CHARACTER##');
    processed = processed.replace(/(🖼️[^\s,，。]+)/g, '##SCENE##$1##/SCENE##');
    processed = processed.replace(/(说：「[^」]+」)/g, '##DIALOGUE##$1##/DIALOGUE##');
    processed = processed.replace(/(音色：[^。]+。)/g, '##VOICE##$1##/VOICE##');
    processed = processed.replace(/(镜头：[^，,]+)/g, '##CAMERA##$1##/CAMERA##');
    processed = processed.replace(/(镜头(?:静止|缓慢|快速|平稳|平移|推进|拉远|旋转)[^。]*。)/g, '##MOVEMENT##$1##/MOVEMENT##');

    return processed.split(/(##\w+##.*?##\/\w+##)/g).map((part, partIndex) => {
      const key = `${segmentIndex}-${partIndex}`;
      if (part.startsWith('##CHARACTER##')) return <span key={key} className="sb-tag sb-character">{part.replace(/##\/?CHARACTER##/g, '')}</span>;
      if (part.startsWith('##SCENE##')) return <span key={key} className="sb-tag sb-scene">{part.replace(/##\/?SCENE##/g, '')}</span>;
      if (part.startsWith('##DIALOGUE##')) return <span key={key} className="sb-tag sb-dialogue">{part.replace(/##\/?DIALOGUE##/g, '')}</span>;
      if (part.startsWith('##VOICE##')) return <span key={key} className="sb-tag sb-voice">{part.replace(/##\/?VOICE##/g, '')}</span>;
      if (part.startsWith('##CAMERA##')) return <span key={key} className="sb-tag sb-camera">{part.replace(/##\/?CAMERA##/g, '')}</span>;
      if (part.startsWith('##MOVEMENT##')) return <span key={key} className="sb-tag sb-movement">{part.replace(/##\/?MOVEMENT##/g, '')}</span>;
      return <span key={key}>{part}</span>;
    });
  });
}

export function StoryboardViewer({
  storyboardResult,
  isGenerating,
  currentStep,
  resultRef,
  onCopy,
  onExport,
}: StoryboardViewerProps) {
  return (
    <div className="result-panel">
      {storyboardResult && (
        <div className="toolbar">
          <button className="toolbar-btn" onClick={onCopy}>📋 复制全部</button>
          <button className="toolbar-btn" onClick={onExport}>💾 导出文本</button>
          <div className="toolbar-spacer" />
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{countChineseWords(storyboardResult)} 字</span>
        </div>
      )}

      <div className="script-viewer sb-viewer" ref={resultRef}>
        {storyboardResult ? (
          <div className="sb-content animate-fade-in">{renderStoryboardContent(storyboardResult)}</div>
        ) : (
          <div className="script-placeholder">
            <div className="script-placeholder-icon">🎥</div>
            <div className="script-placeholder-text">
              {isGenerating ? '正在生成分镜提示词...' : '分镜提示词将在这里显示'}
            </div>
            <div className="script-placeholder-hint">
              {isGenerating ? currentStep : '输入剧本文本，配置画面风格，点击"生成分镜提示词"'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
