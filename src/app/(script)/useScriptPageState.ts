'use client';

import { useCallback, useRef, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { useTextFileUpload } from '@/hooks/useTextFileUpload';
import { SUPPORTED_TEXT_FILE_ACCEPT, buildDatedTextFilename } from '@/lib/file-text';
import { countChineseWords } from '@/lib/preprocessor';
import { copyResultText, exportResultText } from '@/lib/result-actions';
import { GENRE_LABELS, GenerateConfig, Genre } from '@/lib/types';
import { SAMPLE_TEXTS, getSampleLoadedMessage } from './constants';
import { useScriptGeneration } from './useScriptGeneration';

export type ResultTab = 'script' | 'analysis' | 'outline';

export function useScriptPageState() {
  const [novelText, setNovelText] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<Genre>('xianxia');
  const [episodeCount, setEpisodeCount] = useState(5);
  const [episodeDuration, setEpisodeDuration] = useState<GenerateConfig['episodeDuration']>('1:30-2:00');
  const [scriptStyle, setScriptStyle] = useState<GenerateConfig['style']>('dramatic');
  const [activeTab, setActiveTab] = useState<ResultTab>('script');
  const scriptViewerRef = useRef<HTMLDivElement>(null);

  const { toast, showToast } = useToast();
  const upload = useTextFileUpload({ onTextLoaded: setNovelText, showToast });
  const generation = useScriptGeneration({
    novelText,
    selectedGenre,
    episodeCount,
    episodeDuration,
    scriptStyle,
    scriptViewerRef,
    showToast,
  });

  const wordCount = countChineseWords(novelText);

  const loadSample = useCallback(() => {
    setNovelText(SAMPLE_TEXTS[selectedGenre]);
    showToast(getSampleLoadedMessage(selectedGenre));
  }, [selectedGenre, showToast]);

  const handleGenerate = useCallback(() => {
    setActiveTab('script');
    void generation.startGeneration();
  }, [generation]);

  const handleExport = useCallback(() => {
    const allScripts = Object.entries(generation.scripts).toSorted(([left], [right]) => Number(left) - Number(right)).map(([, content]) => content).join('\n\n\n');
    exportResultText(
      allScripts,
      buildDatedTextFilename(`短剧剧本_${GENRE_LABELS[selectedGenre]}`),
      showToast,
      { emptyMessage: '暂无可导出的剧本', successMessage: '剧本已导出！' }
    );
  }, [generation.scripts, selectedGenre, showToast]);

  const handleDownloadCurrent = useCallback(() => {
    if (activeTab === 'script') {
      const content = generation.scripts[generation.activeEpisode];
      exportResultText(
        content ?? '',
        buildDatedTextFilename(`第${generation.activeEpisode}集剧本_${GENRE_LABELS[selectedGenre]}`),
        showToast,
        { emptyMessage: '当前集暂无可下载内容', successMessage: '当前剧本已下载！' }
      );
      return;
    }

    if (activeTab === 'analysis') {
      exportResultText(
        generation.analysis ? JSON.stringify(generation.analysis, null, 2) : generation.analysisRaw,
        buildDatedTextFilename(`小说分析_${GENRE_LABELS[selectedGenre]}`, generation.analysis ? 'json' : 'txt'),
        showToast,
        { emptyMessage: '暂无可下载的分析结果', successMessage: '分析结果已下载！' }
      );
      return;
    }

    exportResultText(
      generation.outline,
      buildDatedTextFilename(`分集大纲_${GENRE_LABELS[selectedGenre]}`),
      showToast,
      { emptyMessage: '暂无可下载的大纲', successMessage: '大纲已下载！' }
    );
  }, [activeTab, generation.activeEpisode, generation.analysis, generation.analysisRaw, generation.outline, generation.scripts, selectedGenre, showToast]);

  const handleCopy = useCallback(async () => {
    void copyResultText(generation.scripts[generation.activeEpisode] ?? '', showToast);
  }, [generation.activeEpisode, generation.scripts, showToast]);

  return {
    novelText,
    selectedGenre,
    episodeCount,
    episodeDuration,
    scriptStyle,
    isGenerating: generation.isGenerating,
    currentStep: generation.currentStep,
    progress: generation.progress,
    scripts: generation.scripts,
    activeEpisode: generation.activeEpisode,
    activeTab,
    analysis: generation.analysis,
    analysisRaw: generation.analysisRaw,
    analysisError: generation.analysisError,
    outline: generation.outline,
    wordCount,
    toast,
    scriptViewerRef,
    textUpload: upload,
    loadSample,
    setNovelText,
    setSelectedGenre,
    setEpisodeCount,
    setEpisodeDuration,
    setScriptStyle,
    setActiveEpisode: generation.setActiveEpisode,
    setActiveTab,
    handleGenerate,
    handleStop: generation.stopGeneration,
    handleExport,
    handleDownloadCurrent,
    handleCopy,
    accept: SUPPORTED_TEXT_FILE_ACCEPT,
  };
}
