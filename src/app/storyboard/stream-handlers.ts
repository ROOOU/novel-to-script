import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { type SSEHandlers } from '@/hooks/useSSEStream';
import { type StoryboardGenerationEvent } from '@/features/storyboard/contracts';

export interface SafeModePromptState {
  message: string;
  retryPrompt: string;
}

interface StoryboardStreamHandlerOptions {
  resultRef: RefObject<HTMLDivElement | null>;
  setCurrentStep: Dispatch<SetStateAction<string>>;
  setProgress: Dispatch<SetStateAction<number>>;
  setStoryboardResult: Dispatch<SetStateAction<string>>;
  setCharacters: Dispatch<SetStateAction<string[]>>;
  setScenes: Dispatch<SetStateAction<string[]>>;
  setSafeModePrompt: Dispatch<SetStateAction<SafeModePromptState | null>>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function createStoryboardStreamHandlers({
  resultRef,
  setCurrentStep,
  setProgress,
  setStoryboardResult,
  setCharacters,
  setScenes,
  setSafeModePrompt,
  showToast,
}: StoryboardStreamHandlerOptions): SSEHandlers<StoryboardGenerationEvent> {
  return {
    parsing: () => { setCurrentStep('解析剧本结构...'); setProgress(10); },
    parsed: (data) => {
      setCharacters((data.characters as string[]) ?? []);
      setScenes((data.scenes as string[]) ?? []);
      setProgress(20);
      setCurrentStep(String(data.message ?? '解析完成'));
    },
    generating: () => { setCurrentStep('生成分镜提示词...'); setProgress(30); },
    content_policy_blocked: (data) => {
      setCurrentStep(String(data.message ?? '内容安全拦截'));
      setProgress(0);
      setSafeModePrompt({
        message: String(data.message ?? ''),
        retryPrompt: String(data.retryPrompt ?? ''),
      });
      showToast(String(data.message ?? '内容安全拦截'), 'error');
    },
    streaming: (data) => {
      const content = String(data.content ?? '');
      setStoryboardResult(content);
      setProgress(Math.min(90, 30 + content.length / 50));
      if (resultRef.current) {
        resultRef.current.scrollTop = resultRef.current.scrollHeight;
      }
    },
    done: (data) => {
      setStoryboardResult(String(data.content ?? ''));
      setCurrentStep('生成完成！');
      setProgress(100);
      showToast('分镜提示词生成完成！');
    },
    error: (data) => showToast(String(data.message ?? '生成失败'), 'error'),
  };
}
