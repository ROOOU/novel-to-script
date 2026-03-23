'use client';

import {
  EPISODE_DURATION_LABELS,
  GenerateConfig,
  SCRIPT_STYLE_LABELS,
} from '@/lib/types';

export interface ConfigPanelProps {
  episodeCount: number;
  episodeDuration: GenerateConfig['episodeDuration'];
  scriptStyle: GenerateConfig['style'];
  onEpisodeCountChange: (next: number) => void;
  onEpisodeDurationChange: (next: GenerateConfig['episodeDuration']) => void;
  onScriptStyleChange: (next: GenerateConfig['style']) => void;
}

export function ConfigPanel({
  episodeCount,
  episodeDuration,
  scriptStyle,
  onEpisodeCountChange,
  onEpisodeDurationChange,
  onScriptStyleChange,
}: ConfigPanelProps) {
  return (
    <div className="card animate-fade-in card-delay-2">
      <div className="card-header">
        <div className="card-icon card-icon-config">⚙️</div>
        <div>
          <div className="card-title">生成配置</div>
          <div className="card-subtitle">调整剧本参数</div>
        </div>
      </div>

      <div className="config-row">
        <span className="config-label">目标集数</span>
        <div className="config-control">
          <button className="config-btn" onClick={() => onEpisodeCountChange(Math.max(1, episodeCount - 1))}>−</button>
          <span className="config-value">{episodeCount}</span>
          <button className="config-btn" onClick={() => onEpisodeCountChange(Math.min(30, episodeCount + 1))}>+</button>
        </div>
      </div>

      <div className="config-row">
        <span className="config-label">每集时长</span>
        <select
          className="style-select"
          value={episodeDuration}
          onChange={(event) => onEpisodeDurationChange(event.target.value as GenerateConfig['episodeDuration'])}
        >
          {Object.entries(EPISODE_DURATION_LABELS).map(([duration, label]) => (
            <option key={duration} value={duration}>
              {label.replace('-', ' - ')}
            </option>
          ))}
        </select>
      </div>

      <div className="config-row">
        <span className="config-label">剧本风格</span>
        <select
          className="style-select"
          value={scriptStyle}
          onChange={(event) => onScriptStyleChange(event.target.value as GenerateConfig['style'])}
        >
          {Object.entries(SCRIPT_STYLE_LABELS).map(([style, label]) => (
            <option key={style} value={style}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="api-security-note">
        API 配置已迁移到后端环境变量，前端页面不再接收或存储 API Key。
      </div>
    </div>
  );
}
