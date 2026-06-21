import type { createRepositorySet } from "@platform/database";

type Repos = ReturnType<typeof createRepositorySet>;

export const getActivePrompt = (repos: Repos, tenantId: string, key: string) =>
  repos.prompts.findActive({ tenantId, key });

export const listPromptVersions = (repos: Repos, tenantId: string, key: string) =>
  repos.prompts.listVersions({ tenantId, key });

export async function saveNewPromptVersion(repos: Repos, tenantId: string, key: string, content: string) {
  const versions = await repos.prompts.listVersions({ tenantId, key });
  const nextVersion = versions.length > 0 ? versions[0].version + 1 : 1;
  return repos.prompts.create({ tenantId, key, content, version: nextVersion });
}
