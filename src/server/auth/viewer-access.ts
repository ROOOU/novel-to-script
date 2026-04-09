import type {
  GenerationArtifact,
  Project,
} from '@/server/shared/platform/domain';

interface ViewerAccessScope {
  organization: { id: string };
  workspace: { id: string };
}

interface ArtifactAccessScope {
  organizationId: string;
  workspaceId: string;
}

export function viewerOwnsProject(
  viewer: ViewerAccessScope,
  project: Pick<Project, 'organizationId' | 'workspaceId'>
) {
  return (
    project.organizationId === viewer.organization.id &&
    project.workspaceId === viewer.workspace.id
  );
}

export function viewerOwnsArtifact(
  viewer: ViewerAccessScope,
  artifact: Pick<GenerationArtifact, 'organizationId' | 'workspaceId'>
) {
  return artifactBelongsToScope(artifact, {
    organizationId: viewer.organization.id,
    workspaceId: viewer.workspace.id,
  });
}

export function artifactBelongsToScope(
  artifact: Pick<GenerationArtifact, 'organizationId' | 'workspaceId'>,
  scope: ArtifactAccessScope
) {
  return (
    artifact.organizationId === scope.organizationId &&
    artifact.workspaceId === scope.workspaceId
  );
}
