'use client';

import { Genre, GENRE_LABELS } from '@/lib/types';
import { GenreOption } from './constants';

export interface GenreSelectorProps {
  genres: GenreOption[];
  selectedGenre: Genre;
  onSelect: (genre: Genre) => void;
}

export function GenreSelector({ genres, selectedGenre, onSelect }: GenreSelectorProps) {
  return (
    <div className="card animate-fade-in card-delay-1">
      <div className="card-header">
        <div className="card-icon card-icon-genre">🎬</div>
        <div>
          <div className="card-title">题材类型</div>
          <div className="card-subtitle">选择短剧题材风格</div>
        </div>
      </div>

      <div className="genre-grid">
        {genres.map((genre) => (
          <div
            key={genre.id}
            className={`genre-card ${selectedGenre === genre.id ? 'selected' : ''}`}
            data-genre={genre.id}
            onClick={() => onSelect(genre.id)}
          >
            <div className="genre-emoji">{genre.emoji}</div>
            <div className="genre-name">{GENRE_LABELS[genre.id]}</div>
            <div className="genre-desc">{genre.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
