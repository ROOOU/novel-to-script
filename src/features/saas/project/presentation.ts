import type {
  GenerationArtifact,
  GenerationJob,
  SupportedLocale,
} from '@/server/shared/platform/domain';
import type { PipelineStageStatus } from './PipelineProgressBar';

export function formatLocaleDateTime(
  locale: SupportedLocale,
  value?: string | null
): string {
  if (!value) {
    return locale === 'en-US' ? '—' : '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(locale);
}

export function formatJobStatus(
  locale: SupportedLocale,
  status?: GenerationJob['status'] | PipelineStageStatus
): string {
  switch (status) {
    case 'queued':
      return locale === 'en-US' ? 'Queued' : '排队中';
    case 'running':
      return locale === 'en-US' ? 'Running' : '运行中';
    case 'succeeded':
      return locale === 'en-US' ? 'Succeeded' : '已成功';
    case 'failed':
      return locale === 'en-US' ? 'Failed' : '失败';
    case 'cancelled':
      return locale === 'en-US' ? 'Cancelled' : '已取消';
    case 'pending':
    default:
      return locale === 'en-US' ? 'Pending' : '待开始';
  }
}

export function formatJobKind(
  locale: SupportedLocale,
  kind: GenerationJob['kind']
): string {
  switch (kind) {
    case 'asset-upload':
      return locale === 'en-US' ? 'Asset Upload' : '素材上传';
    case 'analysis-generation':
      return locale === 'en-US' ? 'Analysis' : '分析';
    case 'export-generation':
      return locale === 'en-US' ? 'Export' : '导出';
    case 'script-generation':
      return locale === 'en-US' ? 'Script' : '剧本';
    case 'storyboard-generation':
      return locale === 'en-US' ? 'Storyboard' : '分镜';
    case 'video-generation':
      return locale === 'en-US' ? 'Video' : '视频';
    default:
      return kind;
  }
}

export function formatArtifactKind(
  locale: SupportedLocale,
  kind: GenerationArtifact['kind']
): string {
  switch (kind) {
    case 'analysis':
      return locale === 'en-US' ? 'Analysis' : '分析';
    case 'story_bible':
      return locale === 'en-US' ? 'Story Bible' : '故事圣经';
    case 'scene_cards':
      return locale === 'en-US' ? 'Scene Cards' : '场景卡';
    case 'outline':
      return locale === 'en-US' ? 'Outline' : '大纲';
    case 'script':
      return locale === 'en-US' ? 'Script' : '剧本';
    case 'storyboard':
      return locale === 'en-US' ? 'Storyboard' : '分镜';
    case 'shot_plan':
      return locale === 'en-US' ? 'Shot Plan' : '镜头计划';
    case 'prompt_pack':
      return locale === 'en-US' ? 'Prompt Pack' : '提示词包';
    case 'reference_image':
      return locale === 'en-US' ? 'Reference Image' : '参考图';
    case 'video_clip':
      return locale === 'en-US' ? 'Video Clip' : '视频片段';
    case 'export':
      return locale === 'en-US' ? 'Export' : '导出';
    case 'prompt':
      return locale === 'en-US' ? 'Prompt' : '提示词';
    default:
      return kind;
  }
}

export function formatCounterLabel(
  locale: SupportedLocale,
  count: number,
  singular: string,
  plural: string,
  zhLabel: string
) {
  if (locale === 'en-US') {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  return `${count} ${zhLabel}`;
}
