'use client';

import type { SupportedLocale } from '@/server/shared/platform/domain';
import {
  getOnboardingStepIndicator,
  type OnboardingStep,
} from '@/features/saas/project/onboarding';

interface OnboardingChecklistPanelProps {
  locale: SupportedLocale;
  title: string;
  subtitle: string;
  steps: OnboardingStep[];
  note?: string | null;
  action?: {
    label: string;
    onClick: () => void;
  } | null;
}

export function OnboardingChecklistPanel({
  locale,
  title,
  subtitle,
  steps,
  note,
  action,
}: OnboardingChecklistPanelProps) {
  return (
    <article className="card stack-gap onboarding-panel">
      <div className="stack-gap-sm">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      <div className="onboarding-step-list">
        {steps.map((step, index) => (
          <div key={step.id} className={`onboarding-step onboarding-step-${step.tone}`}>
            <div className="onboarding-step-head">
              <div className="onboarding-step-title">
                <span className="onboarding-step-index">{index + 1}</span>
                <strong>{step.title}</strong>
              </div>
              <span className={`status-pill status-pill-${mapOnboardingTone(step.tone)}`}>
                {getOnboardingStepIndicator(locale, step.tone)}
              </span>
            </div>
            <p>{step.description}</p>
          </div>
        ))}
      </div>

      {note ? <p className="helper-text">{note}</p> : null}
      {action ? (
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={action.onClick}>
            {action.label}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function mapOnboardingTone(tone: OnboardingStep['tone']) {
  switch (tone) {
    case 'completed':
      return 'success';
    case 'current':
      return 'running';
    case 'pending':
    default:
      return 'pending';
  }
}
