'use client';

import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { useTextFileUpload } from '@/hooks/useTextFileUpload';
import { SUPPORTED_TEXT_FILE_ACCEPT, buildDatedTextFilename } from '@/lib/file-text';
import { countChineseWords } from '@/lib/preprocessor';
import { copyResultText, exportResultText } from '@/lib/result-actions';
import { resolveStoryboardTransfer } from '@/lib/transfer';
import { Genre } from '@/lib/types';
import { SAMPLE_SCRIPT } from './constants';
import { useStoryboardGeneration } from './useStoryboardGeneration';

function getInitialTransferredScript() {
  if (typeof window === 'undefined') {
    return '';
  }

  return resolveStoryboardTransfer(new URLSearchParams(window.location.search)).scriptText ?? '';
}

export function useStoryboardPageState() {
  const [scriptText, setScriptText] = useState(getInitialTransferredScript);
  const [visualStyle, setVisualStyle] = useState('真人写实');
  const [colorTone, setColorTone] = useState('暖色调');
  const [genreType, setGenreType] = useState<Genre>('urban');

  const { toast, showToast } = useToast();
  const upload = useTextFileUpload({ onTextLoaded: setScriptText, showToast });
  const generation = useStoryboardGeneration({
    scriptText,
    visualStyle,
    colorTone,
    genreType,
    showToast,
  });

  const wordCount = countChineseWords(scriptText);

  const loadSample = useCallback(() => {
    setScriptText(SAMPLE_SCRIPT);
    showToast('已加载示例剧本');
  }, [showToast]);

  const handleCopy = useCallback(async () => {
    void copyResultText(generation.storyboardResult, showToast);
  }, [generation.storyboardResult, showToast]);

  const handleExport = useCallback(() => {
    exportResultText(
      generation.storyboardResult,
      buildDatedTextFilename('分镜提示词'),
      showToast,
      { emptyMessage: '暂无可导出的内容', successMessage: '已导出！' }
    );
  }, [generation.storyboardResult, showToast]);

  return {
    scriptText,
    visualStyle,
    colorTone,
    genreType,
    isGenerating: generation.isGenerating,
    currentStep: generation.currentStep,
    progress: generation.progress,
    storyboardResult: generation.storyboardResult,
    characters: generation.characters,
    scenes: generation.scenes,
    safeModePrompt: generation.safeModePrompt,
    wordCount,
    resultRef: generation.resultRef,
    toast,
    textUpload: upload,
    loadSample,
    setScriptText,
    setVisualStyle,
    setColorTone,
    setGenreType,
    handleGenerate: generation.startGeneration,
    handleStop: generation.stopGeneration,
    handleCopy,
    handleExport,
    dismissSafeModePrompt: generation.dismissSafeModePrompt,
    accept: SUPPORTED_TEXT_FILE_ACCEPT,
  };
}
