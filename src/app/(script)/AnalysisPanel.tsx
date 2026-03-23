'use client';

import { Skeleton } from '@/components/Skeleton';
import { NovelAnalysis } from '@/lib/types';

export interface AnalysisPanelProps {
  analysis: NovelAnalysis | null;
  analysisRaw: string;
  analysisError: string | null;
  isGenerating: boolean;
  currentStep: string;
  onDownload: () => void;
}

export function AnalysisPanel({
  analysis,
  analysisRaw,
  analysisError,
  isGenerating,
  currentStep,
  onDownload,
}: AnalysisPanelProps) {
  const hasDownloadableContent = Boolean(analysis || analysisRaw);

  return (
    <>
      {hasDownloadableContent && (
        <div className="toolbar">
          <button className="toolbar-btn" onClick={onDownload}>⬇️ 下载分析</button>
        </div>
      )}
      <div className="script-viewer">
        {analysis ? (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>📊 小说分析结果</h3>
            {analysis.title && (
              <div style={{ marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>推测标题：</span>
                <strong style={{ color: 'var(--accent)', fontSize: '16px' }}>{analysis.title}</strong>
              </div>
            )}
            {analysis.plotSummary && (
              <div style={{ marginBottom: '20px' }}>
                <div className="analysis-item-label">剧情概要</div>
                <div className="analysis-item-value">{analysis.plotSummary}</div>
              </div>
            )}
            {analysis.characters.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div className="analysis-item-label">角色列表</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                  {analysis.characters.map((character, index) => (
                    <div key={index} style={{ background: 'var(--bg-elevated)', borderRadius: '10px', padding: '12px 16px', flex: '1 1 200px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--primary-light)' }}>{character.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{character.description}</div>
                      {character.personality && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>性格: {character.personality}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="analysis-grid">
              {analysis.keyConflicts.length > 0 && (
                <div className="analysis-item">
                  <div className="analysis-item-label">🔥 核心冲突</div>
                  <div className="analysis-item-value">{analysis.keyConflicts.map((item, index) => <div key={index} style={{ marginBottom: '4px' }}>• {item}</div>)}</div>
                </div>
              )}
              {analysis.climaxPoints.length > 0 && (
                <div className="analysis-item">
                  <div className="analysis-item-label">⚡ 高潮/爽点</div>
                  <div className="analysis-item-value">{analysis.climaxPoints.map((item, index) => <div key={index} style={{ marginBottom: '4px' }}>• {item}</div>)}</div>
                </div>
              )}
              {analysis.emotionalBeats.length > 0 && (
                <div className="analysis-item">
                  <div className="analysis-item-label">💫 情感节奏</div>
                  <div className="analysis-item-value">{analysis.emotionalBeats.map((item, index) => <div key={index} style={{ marginBottom: '4px' }}>• {item}</div>)}</div>
                </div>
              )}
            </div>
          </div>
        ) : analysisError && analysisRaw ? (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>📊 小说分析结果</h3>
            <div
              style={{
                marginBottom: '16px',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#fca5a5',
                fontSize: '13px',
                lineHeight: 1.7,
              }}
            >
              解析失败：{analysisError}
            </div>
            <div className="analysis-item-label">原始分析输出</div>
            <pre
              style={{
                marginTop: '10px',
                whiteSpace: 'pre-wrap',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                lineHeight: 1.8,
                color: 'var(--text-secondary)',
              }}
            >
              {analysisRaw}
            </pre>
          </div>
        ) : isGenerating ? (
          <div className="skeleton-panel animate-fade-in">
            <div className="skeleton-panel-header">
              <span className="analysis-item-label">正在分析小说</span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{currentStep}</span>
            </div>
            <Skeleton variant="card" lines={4} />
            <div className="analysis-grid" style={{ marginTop: '16px' }}>
              <div className="analysis-item"><Skeleton variant="card" lines={3} /></div>
              <div className="analysis-item"><Skeleton variant="card" lines={3} /></div>
            </div>
          </div>
        ) : (
          <div className="script-placeholder">
            <div className="script-placeholder-icon">🔍</div>
            <div className="script-placeholder-text">分析结果将在这里显示</div>
            <div className="script-placeholder-hint">生成剧本时会自动分析小说内容</div>
          </div>
        )}
      </div>
    </>
  );
}
