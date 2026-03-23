import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { type SSEHandlers } from '@/hooks/useSSEStream';
import { NovelAnalysis } from '@/lib/types';
import { type ScriptGenerationEvent } from '@/features/script-generation/contracts';
import { parseAnalysisPayload } from './panel-parsers';

interface ScriptStreamHandlerOptions {
  episodeCount: number;
  scriptViewerRef: RefObject<HTMLDivElement | null>;
  setCurrentStep: Dispatch<SetStateAction<string>>;
  setProgress: Dispatch<SetStateAction<number>>;
  setAnalysis: Dispatch<SetStateAction<NovelAnalysis | null>>;
  setAnalysisRaw: Dispatch<SetStateAction<string>>;
  setAnalysisError: Dispatch<SetStateAction<string | null>>;
  setOutline: Dispatch<SetStateAction<string>>;
  setActiveEpisode: Dispatch<SetStateAction<number>>;
  setScripts: Dispatch<SetStateAction<Record<number, string>>>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function createScriptStreamHandlers({
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
}: ScriptStreamHandlerOptions): SSEHandlers<ScriptGenerationEvent> {
  return {
    preprocessing: () => { setCurrentStep('预处理文本...'); setProgress(5); },
    analyzing: () => { setCurrentStep('分析小说内容...'); setProgress(15); },
    analyzed: (data) => {
      const raw = String(data.data ?? '');
      setProgress(30);
      setAnalysisRaw(raw);
      try {
        setAnalysis(parseAnalysisPayload(raw));
        setAnalysisError(null);
      } catch (error) {
        setAnalysis(null);
        setAnalysisError(error instanceof Error ? error.message : '分析 JSON 解析失败');
        console.warn('[分析] JSON 解析失败，保留原始文本:', error);
        showToast('分析结果格式异常，已显示原始文本', 'error');
      }
    },
    outlining: () => { setCurrentStep('生成分集大纲...'); setProgress(40); },
    outlined: (data) => { setProgress(50); setOutline(String(data.data ?? '')); },
    generating: (data) => setCurrentStep(String(data.message ?? '')),
    streaming: (data) => {
      const episode = Number(data.episode ?? 1);
      const content = String(data.content ?? '');
      setActiveEpisode(episode);
      setScripts((prev) => ({ ...prev, [episode]: content }));
      setProgress(Math.min(95, 50 + (episode - 1) * (45 / episodeCount)));
      if (scriptViewerRef.current) {
        scriptViewerRef.current.scrollTop = scriptViewerRef.current.scrollHeight;
      }
    },
    episode_done: (data) => {
      const episode = Number(data.episode ?? 1);
      setScripts((prev) => ({ ...prev, [episode]: String(data.content ?? '') }));
    },
    done: () => { setCurrentStep('生成完成！'); setProgress(100); showToast('全部剧本生成完成！'); },
    error: (data) => showToast(String(data.message ?? '生成失败'), 'error'),
  };
}
