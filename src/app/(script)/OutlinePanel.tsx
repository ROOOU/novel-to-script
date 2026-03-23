'use client';

import { parseOutlinePayload } from './panel-parsers';

export interface OutlinePanelProps {
  outline: string;
  onDownload: () => void;
}

export function OutlinePanel({ outline, onDownload }: OutlinePanelProps) {
  const parsedOutline = outline ? (() => {
    try {
      return { entries: parseOutlinePayload(outline), error: null };
    } catch (error) {
      return {
        entries: null,
        error: error instanceof Error ? error.message : '大纲 JSON 解析失败',
      };
    }
  })() : { entries: null, error: null };

  return (
    <>
      {outline && (
        <div className="toolbar">
          <button className="toolbar-btn" onClick={onDownload}>⬇️ 下载大纲</button>
        </div>
      )}
      <div className="script-viewer">
        {parsedOutline.entries ? (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>📋 分集大纲</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {parsedOutline.entries.map((entry) => (
                <div
                  key={entry.episodeNumber}
                  style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: '12px',
                    padding: '16px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline' }}>
                    <strong style={{ color: 'var(--accent)', fontSize: '16px' }}>
                      第 {entry.episodeNumber} 集 · {entry.title}
                    </strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>悬念钩子已配置</span>
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <div className="analysis-item-label">剧情概要</div>
                    <div className="analysis-item-value">{entry.summary}</div>
                  </div>
                  {entry.keyEvents.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div className="analysis-item-label">关键事件</div>
                      <div className="analysis-item-value">
                        {entry.keyEvents.map((event, index) => (
                          <div key={index} style={{ marginBottom: '4px' }}>• {event}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop: '12px' }}>
                    <div className="analysis-item-label">结尾钩子</div>
                    <div className="analysis-item-value">{entry.hook}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : outline ? (
          <div className="script-content animate-fade-in">
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>📋 分集大纲</h3>
            <div
              style={{
                marginBottom: '16px',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                background: 'rgba(245, 158, 11, 0.08)',
                color: '#fbbf24',
                fontSize: '13px',
                lineHeight: 1.7,
              }}
            >
              结构化解析失败：{parsedOutline.error ?? '大纲格式异常'}。已降级显示原始输出。
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: "'Noto Sans SC', sans-serif", fontSize: '14px', lineHeight: '1.8' }}>
              {outline}
            </pre>
          </div>
        ) : (
          <div className="script-placeholder">
            <div className="script-placeholder-icon">📋</div>
            <div className="script-placeholder-text">大纲将在这里显示</div>
            <div className="script-placeholder-hint">生成剧本时会先创建分集大纲</div>
          </div>
        )}
      </div>
    </>
  );
}
