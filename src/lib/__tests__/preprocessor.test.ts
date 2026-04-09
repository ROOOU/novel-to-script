import { describe, expect, it } from 'vitest';
import {
  cleanText,
  countChineseWords,
  splitChapters,
  truncateTextForLLM,
} from '@/lib/preprocessor';

describe('cleanText', () => {
  it('removes ad copy and trims whitespace', () => {
    const input = `  第一章 开始

本章未完请点击下一页

手机用户请浏览 wap 阅读

主角登场。  `;

    expect(cleanText(input)).toBe('第一章 开始\n\n主角登场。');
  });

  it('collapses excessive blank lines', () => {
    expect(cleanText('a\n\n\n\nb')).toBe('a\n\nb');
  });
});

describe('splitChapters', () => {
  it('splits chinese chapter headings', () => {
    const chapters = splitChapters('第一章 开始\n内容A\n第二章 转折\n内容B');
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toContain('第一章');
    expect(chapters[1].title).toContain('第二章');
  });

  it('splits english chapter headings', () => {
    const chapters = splitChapters('Chapter 1 Dawn\nalpha\nChapter 2 Night\nbeta');
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toContain('Chapter 1');
  });

  it('falls back when no chapter headings exist', () => {
    const longText = `${'一二三四五六七八九十'.repeat(250)}\n\n${'甲乙丙丁戊己庚辛壬癸'.repeat(250)}`;
    const chapters = splitChapters(longText);
    expect(chapters.length).toBeGreaterThan(0);
    expect(chapters[0].title).toContain('段落');
  });
});

describe('countChineseWords', () => {
  it('counts chinese, english, and numeric groups', () => {
    expect(countChineseWords('你好 world 2025')).toBe(4);
  });
});

describe('truncateTextForLLM', () => {
  it('keeps long prompts within both char and byte budgets', () => {
    const input = `第一段 ${'甲'.repeat(2200)}\n\n第二段 ${'乙'.repeat(2200)}\n\n第三段 ${'丙'.repeat(2200)}`;
    const output = truncateTextForLLM(input, { maxChars: 5000, maxBytes: 12000 });

    expect(output.length).toBeLessThanOrEqual(5000);
    expect(Buffer.byteLength(output, 'utf8')).toBeLessThanOrEqual(12000);
    expect(output).toContain('第一段');
  });
});
