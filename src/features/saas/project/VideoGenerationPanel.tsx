'use client';

import { useMemo, useRef } from 'react';
import { WorkspaceListRow, WorkspaceNoteCard } from '@/components/WorkspaceUI';
import { parseStoryboardShotsFromContent } from '@/lib/storyboard-shots';
import type { VideoAspectRatio } from '@/features/video-generation/contracts';
import type { GenerationArtifact, SupportedLocale } from '@/server/shared/platform/domain';

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

interface VideoGenerationPanelProps {
  locale: SupportedLocale;
  enabled: boolean;
  message: string | null;
  generating: boolean;
  uploading: boolean;
  shotPlanArtifacts: GenerationArtifact[];
  referenceImageArtifacts: GenerationArtifact[];
  selectedShotPlanArtifactId: string | null;
  selectedShotId: string | null;
  promptOverride: string;
  aspectRatio: VideoAspectRatio;
  selectedReferenceImageArtifactIds: string[];
  selectedFirstFrameArtifactId: string | null;
  selectedLastFrameArtifactId: string | null;
  onShotPlanArtifactChange: (artifactId: string) => void;
  onShotIdChange: (shotId: string) => void;
  onPromptOverrideChange: (value: string) => void;
  onAspectRatioChange: (value: VideoAspectRatio) => void;
  onToggleReferenceImage: (artifactId: string) => void;
  onFirstFrameArtifactChange: (artifactId: string | null) => void;
  onLastFrameArtifactChange: (artifactId: string | null) => void;
  onUploadAsset: (file: File) => Promise<void>;
  onGenerate: () => void;
}

export function VideoGenerationPanel({
  locale,
  enabled,
  message,
  generating,
  uploading,
  shotPlanArtifacts,
  referenceImageArtifacts,
  selectedShotPlanArtifactId,
  selectedShotId,
  promptOverride,
  aspectRatio,
  selectedReferenceImageArtifactIds,
  selectedFirstFrameArtifactId,
  selectedLastFrameArtifactId,
  onShotPlanArtifactChange,
  onShotIdChange,
  onPromptOverrideChange,
  onAspectRatioChange,
  onToggleReferenceImage,
  onFirstFrameArtifactChange,
  onLastFrameArtifactChange,
  onUploadAsset,
  onGenerate,
}: VideoGenerationPanelProps) {
  const copy = getVideoPanelCopy(locale);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedShotPlanArtifact =
    shotPlanArtifacts.find((artifact) => artifact.id === selectedShotPlanArtifactId) ??
    shotPlanArtifacts[0] ??
    null;
  const shots = useMemo(
    () => parseStoryboardShotsFromContent(selectedShotPlanArtifact?.content),
    [selectedShotPlanArtifact?.content]
  );
  const selectedShot = shots.find((shot) => shot.shotId === selectedShotId) ?? shots[0] ?? null;
  const selectedReferenceImageIdSet = new Set(selectedReferenceImageArtifactIds);

  return (
    <article className="card stack-gap">
      <div className="stack-gap-sm">
        <h2>{copy.title}</h2>
        <p>{copy.subtitle}</p>
      </div>

      {!enabled ? (
        <p className="helper-text">{copy.disabled}</p>
      ) : (
        <>
          <div className="action-row">
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden-file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) {
                  return;
                }

                void onUploadAsset(file);
              }}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? copy.uploading : copy.upload}
            </button>
            <span className="helper-text">{copy.uploadHint}</span>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>{copy.shotPlan}</span>
              <select
                value={selectedShotPlanArtifact?.id ?? ''}
                onChange={(event) => onShotPlanArtifactChange(event.target.value)}
                disabled={shotPlanArtifacts.length === 0}
              >
                {shotPlanArtifacts.length === 0 ? (
                  <option value="">{copy.noShotPlans}</option>
                ) : (
                  shotPlanArtifacts.map((artifact) => (
                    <option key={artifact.id} value={artifact.id}>
                      {artifact.title} · v{artifact.version}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="field">
              <span>{copy.shot}</span>
              <select
                value={selectedShot?.shotId ?? ''}
                onChange={(event) => onShotIdChange(event.target.value)}
                disabled={shots.length === 0}
              >
                {shots.length === 0 ? (
                  <option value="">{copy.noShots}</option>
                ) : (
                  shots.map((shot) => (
                    <option key={shot.shotId} value={shot.shotId}>
                      {shot.shotId} · {shot.sceneId || copy.unnamedScene}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          <label className="field">
            <span>{copy.prompt}</span>
            <textarea
              rows={5}
              value={promptOverride}
              onChange={(event) => onPromptOverrideChange(event.target.value)}
              placeholder={selectedShot?.videoPrompt || copy.promptPlaceholder}
            />
          </label>

          <section className="stack-gap-sm">
            <WorkspaceListRow>
              <strong>{copy.aspectRatio}</strong>
              <span className="helper-text">{copy.aspectRatioHint}</span>
            </WorkspaceListRow>
            <div className="artifact-filter-bar">
              {(['9:16', '16:9'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`filter-chip ${aspectRatio === value ? 'active' : ''}`}
                  onClick={() => onAspectRatioChange(value)}
                >
                  <strong>{value}</strong>
                  <span>{value === '9:16' ? copy.portrait : copy.landscape}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="stack-gap-sm">
            <WorkspaceListRow>
              <strong>{copy.referenceImages}</strong>
              <span className="helper-text">{copy.referenceHint}</span>
            </WorkspaceListRow>
            {referenceImageArtifacts.length === 0 ? (
              <p className="helper-text">{copy.noImages}</p>
            ) : (
              <div className="artifact-filter-bar">
                {referenceImageArtifacts.map((artifact) => (
                  <button
                    key={artifact.id}
                    type="button"
                    className={`filter-chip ${
                      selectedReferenceImageIdSet.has(artifact.id) ? 'active' : ''
                    }`}
                    onClick={() => onToggleReferenceImage(artifact.id)}
                  >
                    <strong>{artifact.title}</strong>
                    <span>v{artifact.version}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="form-grid">
            <label className="field">
              <span>{copy.firstFrame}</span>
              <select
                value={selectedFirstFrameArtifactId ?? ''}
                onChange={(event) =>
                  onFirstFrameArtifactChange(event.target.value ? event.target.value : null)
                }
              >
                <option value="">{copy.none}</option>
                {referenceImageArtifacts.map((artifact) => (
                  <option key={artifact.id} value={artifact.id}>
                    {artifact.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{copy.lastFrame}</span>
              <select
                value={selectedLastFrameArtifactId ?? ''}
                onChange={(event) =>
                  onLastFrameArtifactChange(event.target.value ? event.target.value : null)
                }
              >
                <option value="">{copy.none}</option>
                {referenceImageArtifacts.map((artifact) => (
                  <option key={artifact.id} value={artifact.id}>
                    {artifact.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedShot ? (
            <WorkspaceNoteCard
              tone="blueberry"
              eyebrow={copy.selectedShot}
              title={selectedShot.shotId}
              description={selectedShot.videoPrompt || copy.promptPlaceholder}
              titleAs="h3"
              framed={false}
            />
          ) : null}

          <div className="action-row">
            <button
              type="button"
              className="primary-button"
              onClick={onGenerate}
              disabled={!selectedShotPlanArtifact || !selectedShot || generating}
            >
              {generating ? copy.generating : copy.generate}
            </button>
          </div>
        </>
      )}

      {message ? <p className="helper-text">{message}</p> : null}
    </article>
  );
}

function getVideoPanelCopy(locale: SupportedLocale) {
  if (locale === 'en-US') {
    return {
      title: 'Video Generation',
      subtitle: 'Choose a shot plan, bind reference images, and generate a Veo video clip directly inside the workspace.',
      disabled: 'Video generation is disabled. Set NOVELSCRIPT_ENABLE_VIDEO_GENERATION=true and GEMINI_API_KEY on the server to enable it.',
      upload: 'Upload image asset',
      uploading: 'Uploading...',
      uploadHint: 'Supports PNG, JPEG, and WebP. Uploaded images become reusable project assets.',
      shotPlan: 'Shot plan version',
      noShotPlans: 'No shot plan artifacts yet',
      shot: 'Shot',
      noShots: 'No structured shots available',
      unnamedScene: 'Scene',
      prompt: 'Prompt override',
      promptPlaceholder: 'Use the shot prompt as-is, or override it here.',
      aspectRatio: 'Aspect ratio',
      aspectRatioHint: 'The first version supports portrait and landscape clips.',
      portrait: 'Portrait',
      landscape: 'Landscape',
      referenceImages: 'Reference images',
      referenceHint: 'You can pick up to 3 reference images. Click again to remove.',
      noImages: 'No uploaded image assets yet.',
      firstFrame: 'First frame',
      lastFrame: 'Last frame',
      none: 'None',
      selectedShot: 'Selected shot',
      generate: 'Generate video clip',
      generating: 'Generating video...',
    };
  }

  return {
    title: '视频生成',
    subtitle: '选择镜头计划、绑定参考图，再直接在工作台里生成 Veo 视频片段。',
    disabled: '视频能力当前未开启。请在服务端设置 NOVELSCRIPT_ENABLE_VIDEO_GENERATION=true 与 GEMINI_API_KEY。',
    upload: '上传图片素材',
    uploading: '上传中...',
    uploadHint: '支持 PNG、JPEG、WebP。上传后会作为项目可复用素材保留。',
    shotPlan: '镜头计划版本',
    noShotPlans: '当前还没有镜头计划',
    shot: '镜头',
    noShots: '当前镜头计划里没有结构化镜头',
    unnamedScene: '场景',
    prompt: '提示词覆盖',
    promptPlaceholder: '默认使用镜头计划里的 videoPrompt，也可以在这里手动覆盖。',
    aspectRatio: '画幅比例',
    aspectRatioHint: '第一期支持竖版与横版两种输出。',
    portrait: '竖版',
    landscape: '横版',
    referenceImages: '参考图',
    referenceHint: '最多可选 3 张参考图，再点一次可取消。',
    noImages: '当前还没有上传图片素材。',
    firstFrame: '首帧',
    lastFrame: '尾帧',
    none: '不使用',
    selectedShot: '当前镜头',
    generate: '生成视频片段',
    generating: '正在生成视频...',
  };
}
