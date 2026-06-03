import { describe, expect, it } from 'vitest';
import { buildStoryBible } from '@/server/story-engine/story-bible';

describe('buildStoryBible', () => {
  it('normalizes narrative location phrases and filters temporal fillers', () => {
    const storyBible = buildStoryBible({
      analysis: {
        title: '凡人片段',
        genre: 'xianxia',
        characters: [
          {
            name: '韩立',
            description: '主角',
            personality: '克制',
            speechStyle: '简洁',
            relationships: ['银月: 同伴'],
          },
          {
            name: '银月',
            description: '同伴',
            personality: '敏锐',
            speechStyle: '冷静',
            relationships: ['韩立: 同伴'],
          },
        ],
        plotSummary:
          '韩立和银月安然地待在车内。 在这期间，队伍遭遇检查。 队伍出了慕兰草原，韩立又进入了九国盟的丰原国。',
        keyConflicts: ['主角必须在车内判断是否介入。'],
        climaxPoints: ['局势突然升级。'],
        emotionalBeats: ['先压住情绪，观察异动'],
      },
      outline: [
        {
          episodeNumber: 1,
          title: '第1集·荒原异动',
          summary: '韩立从另一条路进了荒原，继续赶路。',
          keyEvents: ['韩立离开车队', '进入荒原'],
          hook: '远处斗法动静逼近。',
        },
      ],
      style: 'highEnergy',
    });

    const locationNames = storyBible.locations.map((location) => location.name);

    expect(locationNames).toEqual(
      expect.arrayContaining(['车内', '慕兰草原', '丰原国', '荒原'])
    );
    expect(locationNames).not.toEqual(expect.arrayContaining(['这期间', '九国盟的丰原国']));
  });
});
