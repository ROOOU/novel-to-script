import type {
  GenerationArtifact,
  GenerationJob,
  SupportedLocale,
} from '@/server/shared/platform/domain';

export type OnboardingStepTone = 'completed' | 'current' | 'pending';

export interface OnboardingStep {
  id: 'create-project' | 'save-source' | 'generate-script' | 'generate-storyboard';
  title: string;
  description: string;
  tone: OnboardingStepTone;
}

interface BuildProjectsOnboardingStepsLabels {
  createProjectTitle: string;
  createProjectDescription: string;
  saveSourceTitle: string;
  saveSourceDescription: string;
  generateScriptTitle: string;
  generateScriptDescription: string;
  generateStoryboardTitle: string;
  generateStoryboardDescription: string;
}

interface BuildProjectWorkspaceOnboardingStepsInput {
  locale: SupportedLocale;
  sourceText: string;
  artifacts: GenerationArtifact[];
  jobs: GenerationJob[];
  labels: BuildProjectsOnboardingStepsLabels;
}

export function buildProjectsOnboardingSteps(
  labels: BuildProjectsOnboardingStepsLabels
): OnboardingStep[] {
  return [
    {
      id: 'create-project',
      title: labels.createProjectTitle,
      description: labels.createProjectDescription,
      tone: 'current',
    },
    {
      id: 'save-source',
      title: labels.saveSourceTitle,
      description: labels.saveSourceDescription,
      tone: 'pending',
    },
    {
      id: 'generate-script',
      title: labels.generateScriptTitle,
      description: labels.generateScriptDescription,
      tone: 'pending',
    },
    {
      id: 'generate-storyboard',
      title: labels.generateStoryboardTitle,
      description: labels.generateStoryboardDescription,
      tone: 'pending',
    },
  ];
}

export function buildProjectWorkspaceOnboardingSteps({
  sourceText,
  artifacts,
  jobs,
  labels,
}: BuildProjectWorkspaceOnboardingStepsInput): OnboardingStep[] {
  const hasSource = sourceText.trim().length > 0;
  const hasScriptArtifact = artifacts.some((artifact) => artifact.kind === 'script');
  const hasStoryboardArtifact = artifacts.some((artifact) => artifact.kind === 'storyboard');
  const hasScriptJobInFlight = jobs.some(
    (job) =>
      job.kind === 'script-generation' &&
      (job.status === 'queued' || job.status === 'running')
  );
  const hasStoryboardJobInFlight = jobs.some(
    (job) =>
      job.kind === 'storyboard-generation' &&
      (job.status === 'queued' || job.status === 'running')
  );

  return [
    {
      id: 'save-source',
      title: labels.saveSourceTitle,
      description: labels.saveSourceDescription,
      tone: hasSource ? 'completed' : 'current',
    },
    {
      id: 'generate-script',
      title: labels.generateScriptTitle,
      description: labels.generateScriptDescription,
      tone: resolveStepTone({
        completed: hasScriptArtifact,
        current: hasSource || hasScriptJobInFlight,
      }),
    },
    {
      id: 'generate-storyboard',
      title: labels.generateStoryboardTitle,
      description: labels.generateStoryboardDescription,
      tone: resolveStepTone({
        completed: hasStoryboardArtifact,
        current: hasScriptArtifact || hasStoryboardJobInFlight,
      }),
    },
  ];
}

export function getOnboardingStepIndicator(
  locale: SupportedLocale,
  tone: OnboardingStepTone
) {
  switch (tone) {
    case 'completed':
      return locale === 'en-US' ? 'Done' : '已完成';
    case 'current':
      return locale === 'en-US' ? 'Next' : '下一步';
    case 'pending':
    default:
      return locale === 'en-US' ? 'Later' : '稍后';
  }
}

function resolveStepTone(input: {
  completed: boolean;
  current: boolean;
}): OnboardingStepTone {
  if (input.completed) {
    return 'completed';
  }

  if (input.current) {
    return 'current';
  }

  return 'pending';
}
