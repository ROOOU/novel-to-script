import { describe, expect, it } from 'vitest';
import { summarizeVersionDiff } from '@/lib/version-summary';

describe('summarizeVersionDiff', () => {
  it('returns zero deltas for identical content', () => {
    expect(summarizeVersionDiff('hello\nworld', 'hello\nworld')).toEqual({
      previousCharacters: 11,
      currentCharacters: 11,
      characterDelta: 0,
      previousLines: 2,
      currentLines: 2,
      lineDelta: 0,
      changedLines: 0,
    });
  });

  it('tracks added characters and changed lines', () => {
    expect(summarizeVersionDiff('a\nb', 'a\nbeta\nc')).toEqual({
      previousCharacters: 3,
      currentCharacters: 8,
      characterDelta: 5,
      previousLines: 2,
      currentLines: 3,
      lineDelta: 1,
      changedLines: 2,
    });
  });

  it('handles empty content safely', () => {
    expect(summarizeVersionDiff('', '')).toEqual({
      previousCharacters: 0,
      currentCharacters: 0,
      characterDelta: 0,
      previousLines: 0,
      currentLines: 0,
      lineDelta: 0,
      changedLines: 0,
    });
  });
});
