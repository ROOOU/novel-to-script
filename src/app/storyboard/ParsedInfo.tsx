'use client';

export interface ParsedInfoProps {
  characters: string[];
  scenes: string[];
}

export function ParsedInfo({ characters, scenes }: ParsedInfoProps) {
  if (characters.length === 0 && scenes.length === 0) {
    return null;
  }

  return (
    <div className="card animate-fade-in">
      <div className="card-header">
        <div className="card-icon" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>👥</div>
        <div>
          <div className="card-title">识别结果</div>
          <div className="card-subtitle">从剧本中提取的信息</div>
        </div>
      </div>

      {characters.length > 0 && (
        <div style={{ marginBottom: scenes.length > 0 ? '12px' : 0 }}>
          <div className="analysis-item-label">🧑 角色</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            {characters.map((character, index) => <span key={index} className="character-tag">{character}</span>)}
          </div>
        </div>
      )}

      {scenes.length > 0 && (
        <div>
          <div className="analysis-item-label">🖼️ 场景</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            {scenes.map((scene, index) => (
              <span
                key={index}
                className="character-tag"
                style={{ background: 'rgba(6, 182, 212, 0.12)', color: 'var(--genre-fantasy)' }}
              >
                {scene}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
