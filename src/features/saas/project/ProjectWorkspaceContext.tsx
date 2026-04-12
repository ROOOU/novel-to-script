'use client';

import { createContext, useContext, useEffect, useState, startTransition, useMemo, type ReactNode } from 'react';
import type { GenerationArtifact, GenerationJob, ArtifactRelation } from '@/server/shared/platform/domain';

interface ProjectWorkspaceContextValue {
  jobs: GenerationJob[];
  artifacts: GenerationArtifact[];
  artifactRelations: ArtifactRelation[];
  hasActiveJobs: boolean;
  refreshProjectBundle: () => Promise<void>;
}

const ProjectWorkspaceContext = createContext<ProjectWorkspaceContextValue | null>(null);

export function useProjectWorkspace() {
  const context = useContext(ProjectWorkspaceContext);
  if (!context) {
    throw new Error('useProjectWorkspace must be used within a ProjectWorkspaceProvider');
  }
  return context;
}

export function ProjectWorkspaceProvider({
  projectId,
  initialJobs,
  initialArtifacts,
  initialArtifactRelations,
  children,
}: {
  projectId: string;
  initialJobs: GenerationJob[];
  initialArtifacts: GenerationArtifact[];
  initialArtifactRelations: ArtifactRelation[];
  children: ReactNode;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [artifactRelations, setArtifactRelations] = useState(initialArtifactRelations);

  const hasActiveJobs = jobs.some((job) => job.status === 'queued' || job.status === 'running');

  async function refreshProjectBundle() {
    const response = await fetch(`/api/projects/${projectId}`);
    const payload = await response.json();
    if (payload.ok) {
      setJobs(payload.jobs);
      setArtifacts(payload.artifacts);
      setArtifactRelations(payload.artifactRelations ?? []);
    }
  }

  useEffect(() => {
    if (!hasActiveJobs) {
      return;
    }

    const timer = window.setInterval(() => {
      startTransition(() => {
        void refreshProjectBundle();
      });
    }, 2000);

    return () => window.clearInterval(timer);
  }, [hasActiveJobs, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(
    () => ({
      jobs,
      artifacts,
      artifactRelations,
      hasActiveJobs,
      refreshProjectBundle,
    }),
    [jobs, artifacts, artifactRelations, hasActiveJobs]
  );

  return <ProjectWorkspaceContext.Provider value={value}>{children}</ProjectWorkspaceContext.Provider>;
}
