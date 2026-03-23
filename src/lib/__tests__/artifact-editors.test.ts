import { describe, expect, it } from 'vitest';
import {
  createEmptyAnalysisDraft,
  createEmptyOutlineEntry,
  joinLines,
  parseAnalysisDraft,
  parseOutlineDraft,
  serializeAnalysisDraft,
  serializeOutlineDraft,
  splitLines,
} from '@/lib/artifact-editors';

describe('artifact editors', () => {
  it('parses analysis drafts from wrapped json', () => {
    const parsed = parseAnalysisDraft('```json\n{"analysis":{"title":"T","genre":"urban","characters":[],"plotSummary":"S","keyConflicts":[],"climaxPoints":[],"emotionalBeats":[]}}\n```');
    expect(parsed.error).toBeNull();
    expect(parsed.value?.title).toBe('T');
  });

  it('normalizes empty analysis drafts', () => {
    expect(createEmptyAnalysisDraft()).toEqual({
      title: '',
      genre: 'urban',
      characters: [],
      plotSummary: '',
      keyConflicts: [],
      climaxPoints: [],
      emotionalBeats: [],
    });
  });

  it('serializes analysis drafts', () => {
    const content = serializeAnalysisDraft({
      title: 'A',
      genre: 'urban',
      characters: [],
      plotSummary: 'P',
      keyConflicts: [],
      climaxPoints: [],
      emotionalBeats: [],
    });

    expect(JSON.parse(content)).toMatchObject({ title: 'A', plotSummary: 'P' });
  });

  it('parses outline drafts from wrapper objects', () => {
    const parsed = parseOutlineDraft('{"episodes":[{"episodeNumber":2,"title":"Ep2","summary":"S","keyEvents":["A"],"hook":"H"}]}');
    expect(parsed.error).toBeNull();
    expect(parsed.value?.[0]?.episodeNumber).toBe(2);
  });

  it('normalizes outline drafts', () => {
    expect(createEmptyOutlineEntry(3)).toEqual({
      episodeNumber: 3,
      title: '',
      summary: '',
      keyEvents: [],
      hook: '',
    });
  });

  it('serializes outline drafts in episode order', () => {
    const content = serializeOutlineDraft([
      { episodeNumber: 2, title: 'B', summary: '', keyEvents: [], hook: '' },
      { episodeNumber: 1, title: 'A', summary: '', keyEvents: [], hook: '' },
    ]);

    expect(JSON.parse(content)[0].episodeNumber).toBe(1);
  });

  it('supports simple line helpers', () => {
    expect(splitLines('a\n\n b \n c')).toEqual(['a', 'b', 'c']);
    expect(joinLines(['a', '', 'b'])).toBe('a\nb');
  });
});
