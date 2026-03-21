'use client';

import { useState, useRef, useCallback, type ChangeEvent, type DragEvent } from 'react';
import {
  downloadTextFile,
  isSupportedTextFile,
  readTextFile,
  SUPPORTED_TEXT_FILE_ACCEPT,
} from '@/lib/file-text';
import { Genre, GENRE_LABELS, GenerateConfig, NovelAnalysis } from '@/lib/types';
import { countChineseWords } from '@/lib/preprocessor';

// ===== 题材配置 =====
const GENRES: { id: Genre; emoji: string; desc: string }[] = [
  { id: 'xianxia', emoji: '⚔️', desc: '升级打怪·装逼打脸' },
  { id: 'urban', emoji: '💕', desc: '误解反转·虐恋情深' },
  { id: 'fantasy', emoji: '🐉', desc: '冒险传奇·魔法世界' },
];

// ===== 示例小说文本 =====
const SAMPLE_TEXTS: Record<Genre, string> = {
  xianxia: `第一章 废物少年

"陈阳，你这个废物，也配站在这里？"

青云宗外门广场上，一个锦衣少年指着陈阳的鼻子，满脸不屑地嘲笑着。周围的弟子们也都投来鄙夷的目光。

陈阳攥紧了拳头，指节发白。三年了，自从他的丹田被人暗算震碎，他就成了整个青云宗的笑柄。曾经的天才，如今的废物。

"刘师兄说得对，一个连灵力都感应不到的废物，还赖在宗门里干什么？"
"哈哈哈，听说他以前还是内门首席弟子呢，现在连扫地的杂役都不如！"

陈阳默默转身离开，拳头在袖中微微颤抖。没有人注意到，他怀中那块捡来的破旧玉佩，正散发着微不可察的光芒。

当夜，陈阳打坐修炼时，玉佩突然爆发出刺眼金光。一道苍老而威严的声音在他脑海中响起：

"小子，你的体质……竟是万年难遇的混沌仙体！你那所谓的丹田碎裂，不过是仙体觉醒的前兆！"

陈阳猛然睁眼，只见一个虚幻的老者从玉佩中浮现。

"你……你是谁？"

"老夫乃上古大能太虚真仙，在这块玉佩中沉睡了十万年。今日有缘，便传你'太虚万象诀'，此功法可吞噬天地灵气，化为己用。你那些欺负你的人，三个月后，你可以让他们跪着求你！"

陈阳感觉浑身经脉中有一股磅礴的力量在涌动，碎裂的丹田竟在快速重塑，而且比之前更加广阔深邃……`,
  urban: `第一章 重逢

苏晚宁没想到，兜兜转转三年，她还是在这座城市遇见了他。

CBD写字楼的大堂里，她穿着一身灰色西装裙，正低头翻看手机里甲方发来的修改意见。第二十三次修改——她已经麻木了。

电梯门打开的瞬间，一个高大的身影走出来，擦肩而过时带起一阵清冷的木质香。

苏晚宁浑身一僵。

这个味道，她太熟悉了。三年前的每一个夜晚，她都是枕着这个味道入睡的。

她猛地抬头，看到那个男人修长的背影正走向大门口。西装剪裁利落，步伐沉稳有力。他身边跟着一个穿着精致的年轻女人，正笑着和他说什么。

"顾总，下午和华盛的会议，我已经把资料准备好了。"

顾总。

三年前那个穷得和她挤在出租屋里吃泡面的男孩，现在成了被人恭恭敬敬叫"顾总"的人。

"苏姐？苏姐？"实习生小林在旁边叫了她好几声，"您脸色好差，要不要去休息一下？"

苏晚宁回过神，扯出一个笑容："没事，走吧，去会议室。"

她不知道的是，电梯门关上前的一瞬间，顾深寒回过了头。他看到了她，目光在一瞬间裂开了一道缝。

手机震动，秘书发来消息：【顾总，刚查到了。苏晚宁，锐达广告公司，项目经理。就在这栋楼的14层。】

顾深寒握紧了手机，指节泛白。

三年前，他以为她已经死了。`,
  fantasy: `第一章 命运之门

林恩从未想过，那扇藏在祖母阁楼里的旧木门，会改变他的一生。

十七岁的最后一天，他如往常般爬上吱呀作响的阁楼，准备找一本祖母生前总念叨的老日记。结果日记没找到，他却在一堆积满灰尘的旧物后面，发现了一扇从未见过的门。

门很古老。黑色的木质表面刻满了他看不懂的符文，触摸上去，竟感觉到一阵温热，仿佛门后有一颗正在跳动的心脏。

"这不可能……"林恩喃喃自语。他在这间阁楼里翻过无数次，从来没见过这扇门。

他的手放在门把手上。符文突然亮了起来，散发出银蓝色的光芒。

"警告。"一个没有感情的声音直接出现在他脑海中。"你即将跨入艾尔兰大陆。此行不可逆。请确认：你是否愿意接受命运的馈赠与诅咒？"

林恩还没来得及回答，阁楼的地板突然剧烈震动，门自己打开了——门后不是墙壁，而是一片浩瀚无垠的星空。

他失去平衡，跌了进去。

当他再次睁开眼时，他躺在一片紫色的草地上，头顶是两个月亮。远处，一座巨大的水晶城市悬浮在云层中，折射出彩虹般的光芒。

一个尖尖耳朵、银色长发的少女正蹲在他面前，歪着头看他，碧绿的眼睛里满是好奇。

"你就是'预言之子'？"她用一种奇异但他居然能听懂的语言说道，"看起来……也没什么特别的嘛。"

林恩的手背开始发烫。他翻过手来，一个复杂的金色纹章正在他的皮肤上浮现。`,
};

export default function Home() {
  // ===== 状态管理 =====
  const [novelText, setNovelText] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<Genre>('xianxia');
  const [episodeCount, setEpisodeCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [scripts, setScripts] = useState<Record<number, string>>({});
  const [activeEpisode, setActiveEpisode] = useState(1);
  const [activeTab, setActiveTab] = useState<'script' | 'analysis' | 'outline'>('script');
  const [analysis, setAnalysis] = useState<NovelAnalysis | null>(null);
  const [outline, setOutline] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isTextDragActive, setIsTextDragActive] = useState(false);

  // API 配置
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [showApiConfig, setShowApiConfig] = useState(false);

  const scriptViewerRef = useRef<HTMLDivElement>(null);
  const textFileInputRef = useRef<HTMLInputElement>(null);

  const wordCount = countChineseWords(novelText);

  // ===== Toast 显示 =====
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ===== 加载示例文本 =====
  const loadSample = useCallback(() => {
    setNovelText(SAMPLE_TEXTS[selectedGenre]);
    showToast(`已加载${GENRE_LABELS[selectedGenre]}示例文本`);
  }, [selectedGenre, showToast]);

  const loadTextFile = useCallback(async (file: File) => {
    if (!isSupportedTextFile(file)) {
      showToast('仅支持上传 .txt 或 .md 文件', 'error');
      return;
    }

    const content = await readTextFile(file);
    setNovelText(content);
    showToast(`已载入文件：${file.name}`);
  }, [showToast]);

  const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      await loadTextFile(file);
    } catch {
      showToast('读取文件失败，请重试', 'error');
    }
  }, [loadTextFile, showToast]);

  const handleDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsTextDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    try {
      await loadTextFile(file);
    } catch {
      showToast('读取文件失败，请重试', 'error');
    }
  }, [loadTextFile, showToast]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsTextDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsTextDragActive(false);
  }, []);

  // ===== 开始生成 =====
  const handleGenerate = useCallback(async () => {
    if (!novelText.trim()) {
      showToast('请先输入或粘贴小说文本', 'error');
      return;
    }

    setIsGenerating(true);
    setScripts({});
    setAnalysis(null);
    setOutline('');
    setProgress(0);
    setActiveTab('script');
    setActiveEpisode(1);

    try {
      const config: GenerateConfig = {
        genre: selectedGenre,
        episodeCount,
        episodeDuration: '1:30-2:00',
        style: 'dramatic',
        includeDirectorNotes: true,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // 传递 API 配置到后端
      if (apiKey) headers['X-API-Key'] = apiKey;
      if (baseUrl) headers['X-Base-URL'] = baseUrl;
      if (modelName) headers['X-Model-Name'] = modelName;

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: novelText,
          genre: selectedGenre,
          config,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '请求失败');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法获取流式响应');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            handleStreamEvent(data);
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '生成失败，请检查API配置',
        'error'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [novelText, selectedGenre, episodeCount, apiKey, baseUrl, modelName, showToast]);

  // ===== 处理流式事件 =====
  const handleStreamEvent = useCallback((data: Record<string, unknown>) => {
    const step = data.step as string;

    switch (step) {
      case 'preprocessing':
        setCurrentStep('预处理文本...');
        setProgress(5);
        break;
      case 'analyzing':
        setCurrentStep('分析小说内容...');
        setProgress(15);
        break;
      case 'analyzed':
        setProgress(30);
        try {
          const jsonMatch = (data.data as string).match(/```json\s*([\s\S]*?)\s*```/);
          const jsonStr = jsonMatch ? jsonMatch[1] : data.data as string;
          setAnalysis(JSON.parse(jsonStr.trim()));
        } catch {
          // keep raw
        }
        break;
      case 'outlining':
        setCurrentStep('生成分集大纲...');
        setProgress(40);
        break;
      case 'outlined':
        setProgress(50);
        setOutline(data.data as string);
        break;
      case 'generating':
        setCurrentStep(data.message as string);
        break;
      case 'streaming': {
        const ep = data.episode as number;
        setActiveEpisode(ep);
        setScripts((prev) => ({
          ...prev,
          [ep]: data.content as string,
        }));
        const baseProgress = 50 + (ep - 1) * (45 / episodeCount);
        setProgress(Math.min(95, baseProgress));
        // Auto scroll
        if (scriptViewerRef.current) {
          scriptViewerRef.current.scrollTop = scriptViewerRef.current.scrollHeight;
        }
        break;
      }
      case 'episode_done': {
        const epDone = data.episode as number;
        setScripts((prev) => ({
          ...prev,
          [epDone]: data.content as string,
        }));
        break;
      }
      case 'done':
        setCurrentStep('生成完成！');
        setProgress(100);
        showToast('全部剧本生成完成！');
        break;
      case 'error':
        showToast(data.message as string, 'error');
        break;
    }
  }, [episodeCount, showToast]);

  // ===== 导出剧本 =====
  const handleExport = useCallback(() => {
    const allScripts = Object.entries(scripts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, content]) => content)
      .join('\n\n\n');

    if (!allScripts) {
      showToast('暂无可导出的剧本', 'error');
      return;
    }

    downloadTextFile(
      allScripts,
      `短剧剧本_${GENRE_LABELS[selectedGenre]}_${new Date().toLocaleDateString()}.txt`
    );
    showToast('剧本已导出！');
  }, [scripts, selectedGenre, showToast]);

  const handleDownloadCurrent = useCallback(() => {
    if (activeTab === 'script') {
      const content = scripts[activeEpisode];
      if (!content) {
        showToast('当前集暂无可下载内容', 'error');
        return;
      }
      downloadTextFile(
        content,
        `第${activeEpisode}集剧本_${GENRE_LABELS[selectedGenre]}_${new Date().toLocaleDateString()}.txt`
      );
      showToast('当前剧本已下载！');
      return;
    }

    if (activeTab === 'analysis') {
      if (!analysis) {
        showToast('暂无可下载的分析结果', 'error');
        return;
      }
      downloadTextFile(
        JSON.stringify(analysis, null, 2),
        `小说分析_${GENRE_LABELS[selectedGenre]}_${new Date().toLocaleDateString()}.json`
      );
      showToast('分析结果已下载！');
      return;
    }

    if (!outline) {
      showToast('暂无可下载的大纲', 'error');
      return;
    }
    downloadTextFile(
      outline,
      `分集大纲_${GENRE_LABELS[selectedGenre]}_${new Date().toLocaleDateString()}.txt`
    );
    showToast('大纲已下载！');
  }, [activeEpisode, activeTab, analysis, outline, scripts, selectedGenre, showToast]);

  // ===== 复制剧本 =====
  const handleCopy = useCallback(() => {
    const content = scripts[activeEpisode];
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      showToast('已复制到剪贴板');
    });
  }, [scripts, activeEpisode, showToast]);

  // ===== 渲染 =====
  return (
    <main className="app-container">
      <div className="main-grid">
        {/* ===== 左侧面板 ===== */}
        <aside className="sidebar">
          {/* 小说文本输入 */}
          <div className="card animate-fade-in">
            <div className="card-header">
              <div className="card-icon" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>
                📖
              </div>
              <div>
                <div className="card-title">小说文本</div>
                <div className="card-subtitle">粘贴小说内容或加载示例</div>
              </div>
            </div>

            <div
              className={`text-dropzone ${isTextDragActive ? 'drag-active' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <textarea
                className="novel-textarea"
                placeholder="在此粘贴网络小说文本...&#10;&#10;支持任意格式的小说文本，系统会自动清洗和分析。建议粘贴 1-3 个章节（2000-8000字）获得最佳效果。"
                value={novelText}
                onChange={(e) => setNovelText(e.target.value)}
              />
              <input
                ref={textFileInputRef}
                type="file"
                accept={SUPPORTED_TEXT_FILE_ACCEPT}
                className="hidden-file-input"
                onChange={handleFileSelect}
              />
            </div>

            <div className="text-stats">
              <div className="stat-item">
                字数: <span className="stat-value">{wordCount.toLocaleString()}</span>
              </div>
              <button
                className="toolbar-btn"
                onClick={() => textFileInputRef.current?.click()}
                style={{ fontSize: '12px', padding: '4px 12px' }}
              >
                📂 上传 txt/md
              </button>
              <button
                className="toolbar-btn"
                onClick={loadSample}
                style={{ fontSize: '12px', padding: '4px 12px' }}
              >
                📝 加载示例
              </button>
              <div className="stat-item" style={{ marginLeft: 'auto' }}>
                支持拖入 `.txt` / `.md`
              </div>
            </div>
          </div>

          {/* 题材选择 */}
          <div className="card animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="card-header">
              <div className="card-icon" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
                🎬
              </div>
              <div>
                <div className="card-title">题材类型</div>
                <div className="card-subtitle">选择短剧题材风格</div>
              </div>
            </div>

            <div className="genre-grid">
              {GENRES.map((g) => (
                <div
                  key={g.id}
                  className={`genre-card ${selectedGenre === g.id ? 'selected' : ''}`}
                  data-genre={g.id}
                  onClick={() => setSelectedGenre(g.id)}
                >
                  <div className="genre-emoji">{g.emoji}</div>
                  <div className="genre-name">{GENRE_LABELS[g.id]}</div>
                  <div className="genre-desc">{g.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 生成配置 */}
          <div className="card animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="card-header">
              <div className="card-icon" style={{ background: 'rgba(34, 197, 94, 0.15)' }}>
                ⚙️
              </div>
              <div>
                <div className="card-title">生成配置</div>
                <div className="card-subtitle">调整剧本参数</div>
              </div>
            </div>

            <div className="config-row">
              <span className="config-label">目标集数</span>
              <div className="config-control">
                <button
                  className="config-btn"
                  onClick={() => setEpisodeCount(Math.max(1, episodeCount - 1))}
                >
                  −
                </button>
                <span className="config-value">{episodeCount}</span>
                <button
                  className="config-btn"
                  onClick={() => setEpisodeCount(Math.min(30, episodeCount + 1))}
                >
                  +
                </button>
              </div>
            </div>

            <div className="config-row">
              <span className="config-label">每集时长</span>
              <span className="config-value" style={{ fontSize: '14px' }}>1:30 - 2:00</span>
            </div>

            <div className="config-row">
              <span className="config-label">API 设置</span>
              <button
                className="toolbar-btn"
                onClick={() => setShowApiConfig(!showApiConfig)}
                style={{ fontSize: '12px', padding: '4px 12px' }}
              >
                {showApiConfig ? '收起' : '配置'}
              </button>
            </div>

            {showApiConfig && (
              <div className="api-config" style={{ marginTop: '12px' }}>
                <div className="api-input-group">
                  <label className="api-label">API Key</label>
                  <input
                    className="api-input"
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <div className="api-input-group">
                  <label className="api-label">Base URL (可选)</label>
                  <input
                    className="api-input"
                    placeholder="https://api.openai.com/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>
                <div className="api-input-group">
                  <label className="api-label">模型名称 (可选)</label>
                  <input
                    className="api-input"
                    placeholder="gpt-4o / claude-3-5-sonnet / deepseek-chat"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 生成按钮 */}
          <button
            className={`generate-btn primary ${isGenerating ? 'generating' : ''}`}
            onClick={handleGenerate}
            disabled={isGenerating || !novelText.trim()}
          >
            {isGenerating ? (
              <>
                <span style={{ animation: 'pulse-glow 1s infinite' }}>⏳</span>
                生成中...
              </>
            ) : (
              <>✨ 开始生成剧本</>
            )}
          </button>

          {/* 进度条 */}
          {isGenerating && (
            <div>
              <div className="progress-bar-container">
                <div
                  className={`progress-bar ${progress === 0 ? 'indeterminate' : ''}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="progress-text">
                <span className="progress-dot" />
                {currentStep}
              </div>
            </div>
          )}
        </aside>

        {/* ===== 右侧结果面板 ===== */}
        <div className="result-panel">
          {/* Tab 切换 */}
          <div className="result-tabs">
            <button
              className={`result-tab ${activeTab === 'script' ? 'active' : ''}`}
              onClick={() => setActiveTab('script')}
            >
              📜 剧本
            </button>
            <button
              className={`result-tab ${activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveTab('analysis')}
            >
              🔍 分析
            </button>
            <button
              className={`result-tab ${activeTab === 'outline' ? 'active' : ''}`}
              onClick={() => setActiveTab('outline')}
            >
              📋 大纲
            </button>
          </div>

          {/* 工具栏 */}
          {activeTab === 'script' && Object.keys(scripts).length > 0 && (
            <>
              <div className="episode-nav">
                {Array.from({ length: episodeCount }, (_, i) => i + 1).map((ep) => (
                  <button
                    key={ep}
                    className={`episode-pill ${activeEpisode === ep ? 'active' : ''} ${
                      isGenerating && !scripts[ep] ? 'generating' : ''
                    }`}
                    onClick={() => setActiveEpisode(ep)}
                  >
                    第{ep}集
                    {scripts[ep] ? ' ✓' : ''}
                  </button>
                ))}
              </div>
              <div className="toolbar">
                <button className="toolbar-btn" onClick={handleCopy}>
                  📋 复制当前集
                </button>
                <button className="toolbar-btn" onClick={handleDownloadCurrent}>
                  ⬇️ 下载当前集
                </button>
                <button className="toolbar-btn" onClick={handleExport}>
                  💾 导出全部
                </button>
                <div className="toolbar-spacer" />
                {scripts[activeEpisode] && (
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {countChineseWords(scripts[activeEpisode])} 字
                  </span>
                )}
              </div>
            </>
          )}

          {/* 内容区 */}
          {activeTab === 'script' && (
            <div className="script-viewer" ref={scriptViewerRef}>
              {scripts[activeEpisode] ? (
                <div className="script-content">{scripts[activeEpisode]}</div>
              ) : (
                <div className="script-placeholder">
                  <div className="script-placeholder-icon">🎭</div>
                  <div className="script-placeholder-text">
                    {isGenerating ? '正在生成中...' : '剧本将在这里显示'}
                  </div>
                  <div className="script-placeholder-hint">
                    {isGenerating
                      ? currentStep
                      : '输入小说文本，选择题材，点击"开始生成剧本"即可'}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'analysis' && (
            <>
              {analysis && (
                <div className="toolbar">
                  <button className="toolbar-btn" onClick={handleDownloadCurrent}>
                    ⬇️ 下载分析
                  </button>
                </div>
              )}
              <div className="script-viewer">
                {analysis ? (
                <div className="animate-fade-in">
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
                    📊 小说分析结果
                  </h3>

                  {analysis.title && (
                    <div style={{ marginBottom: '16px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>推测标题：</span>
                      <strong style={{ color: 'var(--accent)', fontSize: '16px' }}>
                        {analysis.title}
                      </strong>
                    </div>
                  )}

                  {analysis.plotSummary && (
                    <div style={{ marginBottom: '20px' }}>
                      <div className="analysis-item-label">剧情概要</div>
                      <div className="analysis-item-value">{analysis.plotSummary}</div>
                    </div>
                  )}

                  {analysis.characters && analysis.characters.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <div className="analysis-item-label">角色列表</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                        {analysis.characters.map((c, i) => (
                          <div
                            key={i}
                            style={{
                              background: 'var(--bg-elevated)',
                              borderRadius: '10px',
                              padding: '12px 16px',
                              flex: '1 1 200px',
                            }}
                          >
                            <div style={{ fontWeight: 600, color: 'var(--primary-light)' }}>
                              {c.name}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {c.description}
                            </div>
                            {c.personality && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                性格: {c.personality}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="analysis-grid">
                    {analysis.keyConflicts && analysis.keyConflicts.length > 0 && (
                      <div className="analysis-item">
                        <div className="analysis-item-label">🔥 核心冲突</div>
                        <div className="analysis-item-value">
                          {analysis.keyConflicts.map((c, i) => (
                            <div key={i} style={{ marginBottom: '4px' }}>• {c}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.climaxPoints && analysis.climaxPoints.length > 0 && (
                      <div className="analysis-item">
                        <div className="analysis-item-label">⚡ 高潮/爽点</div>
                        <div className="analysis-item-value">
                          {analysis.climaxPoints.map((c, i) => (
                            <div key={i} style={{ marginBottom: '4px' }}>• {c}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.emotionalBeats && analysis.emotionalBeats.length > 0 && (
                      <div className="analysis-item">
                        <div className="analysis-item-label">💫 情感节奏</div>
                        <div className="analysis-item-value">
                          {analysis.emotionalBeats.map((c, i) => (
                            <div key={i} style={{ marginBottom: '4px' }}>• {c}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                ) : (
                <div className="script-placeholder">
                  <div className="script-placeholder-icon">🔍</div>
                  <div className="script-placeholder-text">分析结果将在这里显示</div>
                  <div className="script-placeholder-hint">
                    生成剧本时会自动分析小说内容
                  </div>
                </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'outline' && (
            <>
              {outline && (
                <div className="toolbar">
                  <button className="toolbar-btn" onClick={handleDownloadCurrent}>
                    ⬇️ 下载大纲
                  </button>
                </div>
              )}
              <div className="script-viewer">
                {outline ? (
                <div className="script-content animate-fade-in">
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
                    📋 分集大纲
                  </h3>
                  <pre style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: "'Noto Sans SC', sans-serif",
                    fontSize: '14px',
                    lineHeight: '1.8',
                  }}>
                    {outline}
                  </pre>
                </div>
                ) : (
                <div className="script-placeholder">
                  <div className="script-placeholder-icon">📋</div>
                  <div className="script-placeholder-text">大纲将在这里显示</div>
                  <div className="script-placeholder-hint">
                    生成剧本时会先创建分集大纲
                  </div>
                </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Toast 通知 */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.message}
        </div>
      )}
    </main>
  );
}
