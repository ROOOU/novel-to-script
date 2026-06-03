'use client';

import { type RefObject, useCallback, useRef, useState } from 'react';
import { useSSEStream } from '@/hooks/useSSEStream';
import { GENRE_VISUAL_LABELS } from '@/lib/prompts/storyboard';
import { Genre } from '@/lib/types';
import {
  type StoryboardGenerateRequest,
  type StoryboardGenerationEvent,
} from '@/features/storyboard/contracts';
import { createStoryboardStreamHandlers, type SafeModePromptState } from './stream-handlers';

const DEFAULT_STORYBOARD_TARGET_PLATFORM = 'seedance' as const;

interface StoryboardGenerationConfig {
  scriptText: string;
  visualStyle: string;
  colorTone: string;
  genreType: Genre;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export interface StoryboardGenerationState {
  isGenerating: boolean;
  currentStep: string;
  progress: number;
  storyboardResult: string;
  characters: string[];
  scenes: string[];
  safeModePrompt: SafeModePromptState | null;
  resultRef: RefObject<HTMLDivElement | null>;
}

export interface StoryboardGenerationActions {
  startGeneration: (safeMode?: boolean) => Promise<void>;
  stopGeneration: () => void;
  dismissSafeModePrompt: () => void;
}

/**
 * 管理剧本转分镜页的流式生成状态。
 * 只负责与 SSE 生成流程强耦合的状态和动作。
 */
export function useStoryboardGeneration({
  scriptText,
  visualStyle,
  colorTone,
  genreType,
  showToast,
}: StoryboardGenerationConfig): StoryboardGenerationState & StoryboardGenerationActions {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [storyboardResult, setStoryboardResult] = useState('');
  const [characters, setCharacters] = useState<string[]>([]);
  const [scenes, setScenes] = useState<string[]>([]);
  const [safeModePrompt, setSafeModePrompt] = useState<SafeModePromptState | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const { startStream, stopStream } = useSSEStream();

  const resetGenerationState = useCallback(() => {
    setSafeModePrompt(null);
    setStoryboardResult('');
    setCharacters([]);
    setScenes([]);
    setCurrentStep('');
    setProgress(0);
  }, []);

  const startGeneration = useCallback(async (safeMode = false) => {
    if (!scriptText.trim()) {
      showToast('请先输入剧本文本', 'error');
      return;
    }

    resetGenerationState();
    setIsGenerating(true);

    await startStream<StoryboardGenerationEvent, StoryboardGenerateRequest>({
      url: '/api/storyboard',
      body: {
        scriptText,
        visualStyle,
        colorTone,
        genreLabel: GENRE_VISUAL_LABELS[genreType],
        safeMode,
        targetPlatform: DEFAULT_STORYBOARD_TARGET_PLATFORM,
      },
      handlers: createStoryboardStreamHandlers({
        resultRef,
        setCurrentStep,
        setProgress,
        setStoryboardResult,
        setCharacters,
        setScenes,
        setSafeModePrompt,
        showToast,
      }),
      onError: (error) => showToast(error.message, 'error'),
      onFinally: () => setIsGenerating(false),
    });
  }, [
    colorTone,
    genreType,
    resetGenerationState,
    scriptText,
    showToast,
    startStream,
    visualStyle,
  ]);

  const stopGeneration = useCallback(() => {
    stopStream();
    showToast('已停止生成', 'success');
  }, [showToast, stopStream]);

  const dismissSafeModePrompt = useCallback(() => {
    setSafeModePrompt(null);
    setCurrentStep('');
    setProgress(0);
  }, []);

  return {
    isGenerating,
    currentStep,
    progress,
    storyboardResult,
    characters,
    scenes,
    safeModePrompt,
    resultRef,
    startGeneration,
    stopGeneration,
    dismissSafeModePrompt,
  };
}
