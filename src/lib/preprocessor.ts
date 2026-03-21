import { Chapter } from './types';

/**
 * 文本预处理引擎
 * 负责：章节拆分、文本清洗、字数统计
 */

/** 清洗小说文本 */
export function cleanText(raw: string): string {
  let text = raw;

  // 移除常见广告/水印文字
  const adPatterns = [
    /本章未完.*?点击下一页/g,
    /手机用户请浏览.*?阅读/g,
    /本站.*?最新章节/g,
    /请记住本站域名.*?\n/g,
    /最新网址.*?\n/g,
    /天才一秒记住.*?\n/g,
    /笔趣阁.*?最快更新/g,
    /一秒记住.*?免费阅读/g,
    /喜欢.*?请大家.*?推荐/g,
  ];

  for (const pattern of adPatterns) {
    text = text.replace(pattern, '');
  }

  // 移除连续空行（保留最多一个空行）
  text = text.replace(/\n{3,}/g, '\n\n');

  // 移除行首行尾空格
  text = text
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

  // 移除首尾空白
  text = text.trim();

  return text;
}

/** 智能分章 */
export function splitChapters(text: string): Chapter[] {
  // 常见章节标题正则
  const chapterPatterns = [
    /^第[一二三四五六七八九十百千\d]+章\s*.*/m,
    /^第[一二三四五六七八九十百千\d]+节\s*.*/m,
    /^Chapter\s+\d+.*/im,
    /^卷[一二三四五六七八九十]+\s*.*/m,
    /^\d+[.、]\s*.+/m,
  ];

  // 合并所有章节标题模式
  const combinedPattern = new RegExp(
    chapterPatterns.map((p) => p.source).join('|'),
    'gm'
  );

  const matches = [...text.matchAll(combinedPattern)];

  // 如果没有找到章节标记，按段落长度拆分
  if (matches.length === 0) {
    return splitByParagraphs(text);
  }

  const chapters: Chapter[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const startIndex = match.index!;
    const endIndex = i < matches.length - 1 ? matches[i + 1].index! : text.length;
    const content = text.slice(startIndex, endIndex).trim();
    const title = match[0].trim();

    chapters.push({
      index: i + 1,
      title,
      content,
      wordCount: countChineseWords(content),
    });
  }

  return chapters;
}

/** 按段落拆分（当无章节标记时的 fallback） */
function splitByParagraphs(text: string, targetSize = 2000): Chapter[] {
  const paragraphs = text.split(/\n\n+/);
  const chapters: Chapter[] = [];
  let currentContent = '';
  let chapterIndex = 1;

  for (const paragraph of paragraphs) {
    currentContent += paragraph + '\n\n';

    if (countChineseWords(currentContent) >= targetSize) {
      chapters.push({
        index: chapterIndex,
        title: `段落 ${chapterIndex}`,
        content: currentContent.trim(),
        wordCount: countChineseWords(currentContent),
      });
      currentContent = '';
      chapterIndex++;
    }
  }

  // 处理剩余内容
  if (currentContent.trim()) {
    chapters.push({
      index: chapterIndex,
      title: `段落 ${chapterIndex}`,
      content: currentContent.trim(),
      wordCount: countChineseWords(currentContent),
    });
  }

  return chapters;
}

/** 中文字数统计（含中文字符 + 英文单词） */
export function countChineseWords(text: string): number {
  // 计算中文字符数
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  // 计算英文单词数
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  // 计算数字组
  const numbers = (text.match(/\d+/g) || []).length;

  return chineseChars + englishWords + numbers;
}

/** 获取文本统计信息 */
export function getTextStats(text: string) {
  const cleaned = cleanText(text);
  const chapters = splitChapters(cleaned);
  const totalWords = countChineseWords(cleaned);

  return {
    totalWords,
    chapterCount: chapters.length,
    chapters,
    averageWordsPerChapter:
      chapters.length > 0 ? Math.round(totalWords / chapters.length) : 0,
  };
}
