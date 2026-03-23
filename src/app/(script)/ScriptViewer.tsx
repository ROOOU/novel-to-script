'use client';

import { type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/Skeleton';
import { countChineseWords } from '@/lib/preprocessor';
import { buildStoryboardTransferTarget } from '@/lib/transfer';

export interface ScriptViewerProps {
  scripts: Record<number, string>;
  episodeCount: number;
  activeEpisode: number;
  isGenerating: boolean;
  currentStep: string;
  viewerRef: RefObject<HTMLDivElement | null>;
  onEpisodeChange: (episode: number) => void;
  onCopy: () => void;
  onDownloadCurrent: () => void;
  onExportAll: () => void;
}

export function ScriptViewer({
  scripts,
  episodeCount,
  activeEpisode,
  isGenerating,
  currentStep,
  viewerRef,
  onEpisodeChange,
  onCopy,
  onDownloadCurrent,
  onExportAll,
}: ScriptViewerProps) {
  const router = useRouter();
  const currentScript = scripts[activeEpisode];
  const handleSendToStoryboard = () => {
    if (!currentScript) return;
    router.push(buildStoryboardTransferTarget(currentScript).href);
  };

  return (
    <>
      {Object.keys(scripts).length > 0 && (
        <>
          <div className="episode-nav">
            {Array.from({ length: episodeCount }, (_, index) => index + 1).map((episode) => (
              <button
                key={episode}
                className={`episode-pill ${activeEpisode === episode ? 'active' : ''} ${isGenerating && !scripts[episode] ? 'generating' : ''}`}
                onClick={() => onEpisodeChange(episode)}
              >
                第{episode}集
                {scripts[episode] ? ' ✓' : ''}
              </button>
            ))}
          </div>
          <div className="toolbar">
            <button className="toolbar-btn" onClick={onCopy}>📋 复制当前集</button>
            <button className="toolbar-btn" onClick={onDownloadCurrent}>⬇️ 下载当前集</button>
            <button className="toolbar-btn" onClick={onExportAll}>💾 导出全部</button>
            <button className="toolbar-btn" onClick={handleSendToStoryboard}>🎥 发送到分镜</button>
            <div className="toolbar-spacer" />
            {currentScript && (
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {countChineseWords(currentScript)} 字
              </span>
            )}
          </div>
        </>
      )}

      <div className="script-viewer" ref={viewerRef}>
        {currentScript ? (
          <div className="script-content">{currentScript}</div>
        ) : isGenerating ? (
          <div className="skeleton-panel animate-fade-in">
            <div className="skeleton-panel-header">
              <span className="analysis-item-label">正在生成剧本</span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{currentStep}</span>
            </div>
            <Skeleton lines={6} />
          </div>
        ) : (
            <div className="script-placeholder">
              <div className="script-placeholder-icon">🎭</div>
              <div className="script-placeholder-text">剧本将在这里显示</div>
              <div className="script-placeholder-hint">输入小说文本，选择题材，点击&quot;开始生成剧本&quot;即可</div>
            </div>
        )}
      </div>
    </>
  );
}
