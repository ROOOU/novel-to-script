import { describe, expect, it } from 'vitest';
import { extractCharacters, extractScenes } from '@/app/api/storyboard/extract-helpers';

describe('extractCharacters', () => {
  it('preserves current cast parsing behavior', () => {
  const script = `1-1 日 内 宴会厅
人物：沈念安, 顾承泽, 宾客若干
司仪：欢迎各位来宾。
沈念安（微笑）：谢谢大家。
顾承泽：开始吧。`;

    expect(extractCharacters(script)).toEqual(['沈念安', '顾承泽', '宾客', '人物']);
  });

  it('ignores numeric scene markers but keeps current dialogue regex behavior', () => {
    const script = `1-1 日 内 客厅
123：这不是角色
超级超级长名字：这也不是
阿杰：是我`;

    expect(extractCharacters(script)).toEqual(['超级超级长名']);
  });
});
describe('extractScenes', () => {
  it('extracts numbered Chinese scene headings', () => {
    const script = `1-1 日 内 豪华酒店宴会厅
人物：甲, 乙
2-3 夜 外 江边码头`;

    expect(extractScenes(script)).toEqual(['豪华酒店宴会厅', '江边码头']);
  });

  it('falls back to INT/EXT patterns when numbered headings are absent', () => {
    const script = `INT. 审讯室 - 夜
角色A：说话
EXT. 天台 - 日
角色B：回应`;

    expect(extractScenes(script)).toEqual(['审讯室', '天台']);
  });
});
