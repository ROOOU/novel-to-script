'use client';

import { useState, useRef, useCallback, type ChangeEvent, type DragEvent } from 'react';
import {
  downloadTextFile,
  isSupportedTextFile,
  readTextFile,
  SUPPORTED_TEXT_FILE_ACCEPT,
} from '@/lib/file-text';
import { Genre } from '@/lib/types';
import { countChineseWords } from '@/lib/preprocessor';
import {
  VISUAL_STYLES,
  COLOR_TONES,
  GENRE_VISUAL_LABELS,
} from '@/lib/prompts/storyboard';

// 示例剧本
const SAMPLE_SCRIPT = `1-1 日 内 豪华酒店宴会厅
人物：沈念安, 顾承泽, 沈薇薇, 沈母, 沈父, 宾客若干, 司仪
△宴会厅内鲜花簇拥，水晶灯璀璨夺目，宾客们衣着华丽，举杯交谈。
△舞台中央，司仪手持话筒，面带微笑。
司仪：今天，是沈家千金沈念安小姐与顾家少爷顾承泽先生的订婚之喜。
△聚光灯下，沈念安身着一袭纯白礼服，挽着顾承泽的手臂，脸上洋溢着幸福的笑容。
沈念安（含情脉脉）：承泽，我好像在做梦。
顾承泽（温柔凝视）：念安，这不是梦。从今天起，你就是我唯一的未婚妻。`;

export default function StoryboardPage() {
  // ===== 状态 =====
  const [scriptText, setScriptText] = useState('');
  const [visualStyle, setVisualStyle] = useState<string>('真人写实');
  const [colorTone, setColorTone] = useState<string>('暖色调');
  const [genreType, setGenreType] = useState<Genre>('urban');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [storyboardResult, setStoryboardResult] = useState('');
  const [characters, setCharacters] = useState<string[]>([]);
  const [scenes, setScenes] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [safeModePrompt, setSafeModePrompt] = useState<{ message: string; retryPrompt: string } | null>(null);
  const [isTextDragActive, setIsTextDragActive] = useState(false);

  // API 配置
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [showApiConfig, setShowApiConfig] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);
  const textFileInputRef = useRef<HTMLInputElement>(null);

  const wordCount = countChineseWords(scriptText);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadSample = useCallback(() => {
    setScriptText(SAMPLE_SCRIPT);
    showToast('已加载示例剧本');
  }, [showToast]);

  const loadTextFile = useCallback(async (file: File) => {
    if (!isSupportedTextFile(file)) {
      showToast('仅支持上传 .txt 或 .md 文件', 'error');
      return;
    }

    const content = await readTextFile(file);
    setScriptText(content);
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

  // ===== 生成分镜提示词 =====
  const handleGenerate = useCallback(async (safeMode = false) => {
    if (!scriptText.trim()) {
      showToast('请先输入剧本文本', 'error');
      return;
    }

    setSafeModePrompt(null);
    setIsGenerating(true);
    setStoryboardResult('');
    setCharacters([]);
    setScenes([]);
    setProgress(0);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) headers['X-API-Key'] = apiKey;
      if (baseUrl) headers['X-Base-URL'] = baseUrl;
      if (modelName) headers['X-Model-Name'] = modelName;

      const response = await fetch('/api/storyboard', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          scriptText,
          visualStyle,
          colorTone,
          genreLabel: GENRE_VISUAL_LABELS[genreType],
          safeMode,
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const err = await response.json();
          throw new Error(err.error || '请求失败');
        }
        throw new Error(`服务器错误 (${response.status})，请检查服务是否正常运行`);
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
            handleEvent(data);
          } catch {
            // ignore
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
  }, [scriptText, visualStyle, colorTone, genreType, apiKey, baseUrl, modelName, showToast]);

  const handleEvent = useCallback((data: Record<string, unknown>) => {
    switch (data.step) {
      case 'parsing':
        setCurrentStep('解析剧本结构...');
        setProgress(10);
        break;
      case 'parsed':
        setCharacters(data.characters as string[]);
        setScenes(data.scenes as string[]);
        setProgress(20);
        setCurrentStep(data.message as string);
        break;
      case 'generating':
        setCurrentStep('生成分镜提示词...');
        setProgress(30);
        break;
      case 'content_policy_blocked':
        setCurrentStep(data.message as string);
        setProgress(0);
        setSafeModePrompt({
          message: data.message as string,
          retryPrompt: data.retryPrompt as string,
        });
        showToast(data.message as string, 'error');
        break;
      case 'streaming':
        setStoryboardResult(data.content as string);
        setProgress(Math.min(90, 30 + (data.content as string).length / 50));
        if (resultRef.current) {
          resultRef.current.scrollTop = resultRef.current.scrollHeight;
        }
        break;
      case 'done':
        setStoryboardResult(data.content as string);
        setCurrentStep('生成完成！');
        setProgress(100);
        showToast('分镜提示词生成完成！');
        break;
      case 'error':
        showToast(data.message as string, 'error');
        break;
    }
  }, [showToast]);

  const handleSafeModeRetry = useCallback(() => {
    handleGenerate(true);
  }, [handleGenerate]);

  const handleDismissSafeModePrompt = useCallback(() => {
    setSafeModePrompt(null);
    setCurrentStep('');
    setProgress(0);
  }, []);

  // ===== 复制结果 =====
  const handleCopy = useCallback(() => {
    if (!storyboardResult) return;
    navigator.clipboard.writeText(storyboardResult).then(() => {
      showToast('已复制到剪贴板');
    });
  }, [storyboardResult, showToast]);

  // ===== 导出结果 =====
  const handleExport = useCallback(() => {
    if (!storyboardResult) {
      showToast('暂无可导出的内容', 'error');
      return;
    }
    downloadTextFile(storyboardResult, `分镜提示词_${new Date().toLocaleDateString()}.txt`);
    showToast('已导出！');
  }, [storyboardResult, showToast]);

  // ===== 渲染分镜结果（带高亮） =====
  const renderStoryboardContent = (text: string) => {
    // 按分镜分割
    const segments = text.split(/(分镜[①②③④⑤⑥⑦⑧⑨⑩\d]+)/g);

    return segments.map((segment, i) => {
      // 分镜标题
      if (/^分镜[①②③④⑤⑥⑦⑧⑨⑩\d]+/.test(segment)) {
        return (
          <span key={i} className="shot-number-tag">
            {segment}
          </span>
        );
      }

      // 对内容进行高亮
      let processed = segment;

      // 🧑 角色标记高亮
      processed = processed.replace(
        /(🧑\s*[^\s,，。]+?-基础形象-基础形象)/g,
        '##CHARACTER##$1##/CHARACTER##'
      );

      // 🖼️ 场景标记高亮
      processed = processed.replace(
        /(🖼️[^\s,，。]+)/g,
        '##SCENE##$1##/SCENE##'
      );

      // 台词高亮
      processed = processed.replace(
        /(说：「[^」]+」)/g,
        '##DIALOGUE##$1##/DIALOGUE##'
      );

      // 音色描述高亮
      processed = processed.replace(
        /(音色：[^。]+。)/g,
        '##VOICE##$1##/VOICE##'
      );

      // 镜头类型高亮
      processed = processed.replace(
        /(镜头：[^，,]+)/g,
        '##CAMERA##$1##/CAMERA##'
      );

      // 运镜高亮
      processed = processed.replace(
        /(镜头(?:静止|缓慢|快速|平稳|平移|推进|拉远|旋转)[^。]*。)/g,
        '##MOVEMENT##$1##/MOVEMENT##'
      );

      // 构建 JSX
      const parts = processed.split(/(##\w+##.*?##\/\w+##)/g);
      return parts.map((part, j) => {
        if (part.startsWith('##CHARACTER##')) {
          return <span key={`${i}-${j}`} className="sb-tag sb-character">{part.replace(/##\/?CHARACTER##/g, '')}</span>;
        }
        if (part.startsWith('##SCENE##')) {
          return <span key={`${i}-${j}`} className="sb-tag sb-scene">{part.replace(/##\/?SCENE##/g, '')}</span>;
        }
        if (part.startsWith('##DIALOGUE##')) {
          return <span key={`${i}-${j}`} className="sb-tag sb-dialogue">{part.replace(/##\/?DIALOGUE##/g, '')}</span>;
        }
        if (part.startsWith('##VOICE##')) {
          return <span key={`${i}-${j}`} className="sb-tag sb-voice">{part.replace(/##\/?VOICE##/g, '')}</span>;
        }
        if (part.startsWith('##CAMERA##')) {
          return <span key={`${i}-${j}`} className="sb-tag sb-camera">{part.replace(/##\/?CAMERA##/g, '')}</span>;
        }
        if (part.startsWith('##MOVEMENT##')) {
          return <span key={`${i}-${j}`} className="sb-tag sb-movement">{part.replace(/##\/?MOVEMENT##/g, '')}</span>;
        }
        return <span key={`${i}-${j}`}>{part}</span>;
      });
    });
  };

  return (
    <main className="app-container">
      <div className="main-grid">
        {/* ===== 左侧面板 ===== */}
        <aside className="sidebar">
          {/* 剧本输入 */}
          <div className="card animate-fade-in">
            <div className="card-header">
              <div className="card-icon" style={{ background: 'rgba(6, 182, 212, 0.15)' }}>
                🎬
              </div>
              <div>
                <div className="card-title">剧本文本</div>
                <div className="card-subtitle">输入或粘贴剧本片段</div>
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
                placeholder={"粘贴剧本片段...\n\n格式示例：\n1-1 日 内 场景名\n人物：角色A, 角色B\n△场景描述\n角色A：对白内容"}
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                style={{ minHeight: '180px' }}
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

          {/* 画面风格配置 */}
          <div className="card animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="card-header">
              <div className="card-icon" style={{ background: 'rgba(236, 72, 153, 0.15)' }}>
                🎨
              </div>
              <div>
                <div className="card-title">画面风格</div>
                <div className="card-subtitle">配置视频生成参数</div>
              </div>
            </div>

            {/* 风格选择 */}
            <div className="config-row">
              <span className="config-label">画面风格</span>
              <select
                className="style-select"
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value)}
              >
                {VISUAL_STYLES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="config-row">
              <span className="config-label">色调</span>
              <select
                className="style-select"
                value={colorTone}
                onChange={(e) => setColorTone(e.target.value)}
              >
                {COLOR_TONES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="config-row">
              <span className="config-label">类型</span>
              <select
                className="style-select"
                value={genreType}
                onChange={(e) => setGenreType(e.target.value as Genre)}
              >
                {Object.entries(GENRE_VISUAL_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* API 配置 */}
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
                    placeholder="gpt-4o / deepseek-chat"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 已识别角色/场景 */}
          {(characters.length > 0 || scenes.length > 0) && (
            <div className="card animate-fade-in">
              <div className="card-header">
                <div className="card-icon" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
                  👥
                </div>
                <div>
                  <div className="card-title">识别结果</div>
                  <div className="card-subtitle">从剧本中提取的信息</div>
                </div>
              </div>

              {characters.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div className="analysis-item-label">🧑 角色</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    {characters.map((c, i) => (
                      <span key={i} className="character-tag">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {scenes.length > 0 && (
                <div>
                  <div className="analysis-item-label">🖼️ 场景</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    {scenes.map((s, i) => (
                      <span key={i} className="character-tag" style={{ background: 'rgba(6, 182, 212, 0.12)', color: 'var(--genre-fantasy)' }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 生成按钮 */}
          <button
            className={`generate-btn primary ${isGenerating ? 'generating' : ''}`}
            onClick={() => handleGenerate()}
            disabled={isGenerating || !scriptText.trim()}
          >
            {isGenerating ? (
              <>
                <span style={{ animation: 'pulse-glow 1s infinite' }}>⏳</span>
                生成中...
              </>
            ) : (
              <>🎥 生成分镜提示词</>
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

        {/* ===== 右侧结果 ===== */}
        <div className="result-panel">
          {/* 工具栏 */}
          {storyboardResult && (
            <div className="toolbar">
              <button className="toolbar-btn" onClick={handleCopy}>
                📋 复制全部
              </button>
              <button className="toolbar-btn" onClick={handleExport}>
                💾 导出文本
              </button>
              <div className="toolbar-spacer" />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {countChineseWords(storyboardResult)} 字
              </span>
            </div>
          )}

          {/* 分镜结果 */}
          <div className="script-viewer sb-viewer" ref={resultRef}>
            {storyboardResult ? (
              <div className="sb-content animate-fade-in">
                {renderStoryboardContent(storyboardResult)}
              </div>
            ) : (
              <div className="script-placeholder">
                <div className="script-placeholder-icon">🎥</div>
                <div className="script-placeholder-text">
                  {isGenerating ? '正在生成分镜提示词...' : '分镜提示词将在这里显示'}
                </div>
                <div className="script-placeholder-hint">
                  {isGenerating
                    ? currentStep
                    : '输入剧本文本，配置画面风格，点击"生成分镜提示词"'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.message}
        </div>
      )}

      {safeModePrompt && (
        <div className="confirm-overlay">
          <div className="confirm-card">
            <div className="confirm-title">安全内容错误</div>
            <div className="confirm-body">{safeModePrompt.message}</div>
            <div className="confirm-question">{safeModePrompt.retryPrompt}</div>
            <div className="confirm-actions">
              <button className="toolbar-btn" onClick={handleDismissSafeModePrompt}>
                取消
              </button>
              <button className="generate-btn primary" onClick={handleSafeModeRetry}>
                继续安全影视化重试
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
