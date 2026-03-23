/** 从剧本文本中提取角色名 */
export function extractCharacters(text: string): string[] {
  const characters = new Set<string>();

  const castMatch = text.match(/人物[：:]\s*(.+)/);
  if (castMatch) {
    castMatch[1].split(/[,，、\s]+/).forEach((name) => {
      const cleaned = name.trim().replace(/若干|等/g, '');
      if (cleaned && cleaned.length <= 6) characters.add(cleaned);
    });
  }

  const dialoguePattern = /^([^\s（(△【\d][^\s：:]{1,5})[（(]?[^)）]*[)）]?[：:]/gm;
  let match;
  while ((match = dialoguePattern.exec(text)) !== null) {
    const name = match[1].trim();
    if (name && name.length <= 6 && !/^[\d\-]+$/.test(name)) {
      characters.add(name);
    }
  }

  return Array.from(characters);
}

/** 从剧本文本中提取场景 */
export function extractScenes(text: string): string[] {
  const scenes: string[] = [];

  const scenePattern = /\d+-\d+\s+(日|夜|晨|暮|黄昏)\s*(内|外|内外)\s*(.+?)(?:\s|$)/gm;
  let match;
  while ((match = scenePattern.exec(text)) !== null) {
    scenes.push(match[3].trim());
  }

  if (scenes.length === 0) {
    const altPattern = /(?:INT\.|EXT\.|内|外)[.\s]*(.+?)(?:\s*[-—]\s*(日|夜))?$/gm;
    while ((match = altPattern.exec(text)) !== null) {
      scenes.push(match[1].trim());
    }
  }

  return scenes;
}
