'use client';

import { type RefObject, useCallback, useState } from 'react';
import { useSSEStream } from '@/hooks/useSSEStream';
import { GenerateConfig, Genre, NovelAnalysis } from '@/lib/types';
import {
  type ScriptGenerationEvent,
  type ScriptGenerationRequest,
} from '@/features/script-generation/contracts';
import { createScriptStreamHandlers } from './stream-handlers';

interface ScriptGenerationConfig {
  novelText: string;
  selectedGenre: Genre;
  episodeCount: number;
  episodeDuration: GenerateConfig['episodeDuration'];
  scriptStyle: GenerateConfig['style'];
  scriptViewerRef: RefObject<HTMLDivElement | null>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export interface ScriptGenerationState {
  isGenerating: boolean;
  currentStep: string;
  progress: number;
  scripts: Record<number, string>;
  activeEpisode: number;
  analysis: NovelAnalysis | null;
  analysisRaw: string;
  analysisError: string | null;
  outline: string;
}

export interface ScriptGenerationActions {
  setActiveEpisode: (episode: number) => void;
  startGeneration: () => Promise<void>;
  stopGeneration: () => void;
}

/**
 * 管理小说转剧本页面的流式生成状态。
 * 只负责与 SSE 生成流程强耦合的状态和动作。
 */
export function useScriptGeneration({
  novelText,
  selectedGenre,
  episodeCount,
  episodeDuration,
  scriptStyle,
  scriptViewerRef,
  showToast,
}: ScriptGenerationConfig): ScriptGenerationState & ScriptGenerationActions {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [scripts, setScripts] = useState<Record<number, string>>({});
  const [activeEpisode, setActiveEpisode] = useState(1);
  const [analysis, setAnalysis] = useState<NovelAnalysis | null>(null);
  const [analysisRaw, setAnalysisRaw] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [outline, setOutline] = useState('');

  const { startStream, stopStream } = useSSEStream();

  const resetGenerationState = useCallback(() => {
    setScripts({});
    setAnalysis(null);
    setAnalysisRaw('');
    setAnalysisError(null);
    setOutline('');
    setProgress(0);
    setCurrentStep('');
    setActiveEpisode(1);
  }, []);

  const startGeneration = useCallback(async () => {
    if (!novelText.trim()) {
      showToast('请先输入或粘贴小说文本', 'error');
      return;
    }

    setIsGenerating(true);
    resetGenerationState();

    const config: GenerateConfig = {
      genre: selectedGenre,
      episodeCount,
      episodeDuration,
      style: scriptStyle,
      includeDirectorNotes: true,
    };

    await startStream<ScriptGenerationEvent, ScriptGenerationRequest>({
      url: '/api/generate',
      body: { text: novelText, genre: selectedGenre, config },
      handlers: createScriptStreamHandlers({
        episodeCount,
        scriptViewerRef,
        setCurrentStep,
        setProgress,
        setAnalysis,
        setAnalysisRaw,
        setAnalysisError,
        setOutline,
        setActiveEpisode,
        setScripts,
        showToast,
      }),
      onError: (error) => showToast(error.message, 'error'),
      onFinally: () => setIsGenerating(false),
    });
  }, [
    episodeCount,
    episodeDuration,
    novelText,
    resetGenerationState,
    scriptStyle,
    scriptViewerRef,
    selectedGenre,
    showToast,
    startStream,
  ]);

  const stopGeneration = useCallback(() => {
    stopStream();
    showToast('已停止生成', 'success');
  }, [showToast, stopStream]);

  return {
    isGenerating,
    currentStep,
    progress,
    scripts,
    activeEpisode,
    analysis,
    analysisRaw,
    analysisError,
    outline,
    setActiveEpisode,
    startGeneration,
    stopGeneration,
  };
}
