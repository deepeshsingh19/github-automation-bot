import "server-only";

import { githubUserRequest } from "@/server/github/api";

type GithubRepositoryPermissions = {
  admin?: boolean;
  maintain?: boolean;
  push?: boolean;
  triage?: boolean;
  pull?: boolean;
};

export type GithubInstallationRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  owner: {
    login: string;
  };
  permissions?: GithubRepositoryPermissions;
};

type GithubRepositoriesResponse = {
  total_count: number;
  repositories: GithubInstallationRepository[];
};

export async function listInstallationRepositories(
  accessToken: string,
  installationId: string
): Promise<GithubInstallationRepository[]> {
  if (!/^\d+$/.test(installationId)) {
    throw new Error("Invalid installation ID");
  }

  const repositories: GithubInstallationRepository[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const result =
      await githubUserRequest<GithubRepositoriesResponse>(
        accessToken,
        `/user/installations/${installationId}/repositories?per_page=100&page=${page}`
      );

    repositories.push(...result.repositories);

    if (result.repositories.length < 100) {
      break;
    }
  }

  return repositories;
}
