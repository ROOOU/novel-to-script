'use client';

import { Genre } from '@/lib/types';
import { COLOR_TONES, GENRE_VISUAL_LABELS, VISUAL_STYLES } from '@/lib/prompts/storyboard';

export interface StyleConfigProps {
  visualStyle: string;
  colorTone: string;
  genreType: Genre;
  onVisualStyleChange: (value: string) => void;
  onColorToneChange: (value: string) => void;
  onGenreTypeChange: (value: Genre) => void;
}

export function StyleConfig({
  visualStyle,
  colorTone,
  genreType,
  onVisualStyleChange,
  onColorToneChange,
  onGenreTypeChange,
}: StyleConfigProps) {
  return (
    <div className="card animate-fade-in card-delay-1">
      <div className="card-header">
        <div className="card-icon card-icon-style">🎨</div>
        <div>
          <div className="card-title">画面风格</div>
          <div className="card-subtitle">配置视频生成参数</div>
        </div>
      </div>

      <div className="config-row">
        <span className="config-label">画面风格</span>
        <select className="style-select" value={visualStyle} onChange={(event) => onVisualStyleChange(event.target.value)}>
          {VISUAL_STYLES.map((style) => <option key={style} value={style}>{style}</option>)}
        </select>
      </div>

      <div className="config-row">
        <span className="config-label">色调</span>
        <select className="style-select" value={colorTone} onChange={(event) => onColorToneChange(event.target.value)}>
          {COLOR_TONES.map((tone) => <option key={tone} value={tone}>{tone}</option>)}
        </select>
      </div>

      <div className="config-row">
        <span className="config-label">类型</span>
        <select className="style-select" value={genreType} onChange={(event) => onGenreTypeChange(event.target.value as Genre)}>
          {Object.entries(GENRE_VISUAL_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      <div className="api-security-note">
        分镜生成使用后端配置的模型服务，前端页面不再暴露 API 设置。
      </div>
    </div>
  );
}
