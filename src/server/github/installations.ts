import "server-only";

import { env } from "@/lib/env";
import { githubUserRequest } from "@/server/github/api";

type GithubInstallation = {
  id: number;
  account: {
    login: string;
    id: number;
  };
  app_id: number;
  app_slug: string;
  suspended_at: string | null;
  repository_selection: "all" | "selected";
};

type GithubInstallationsResponse = {
  total_count: number;
  installations: GithubInstallation[];
};

export async function verifyGithubInstallation(
  accessToken: string,
  installationId: string
) {
  if (!/^\d+$/.test(installationId)) {
    throw new Error("Invalid installation ID");
  }

  const targetId = BigInt(installationId);

  for (let page = 1; page <= 10; page += 1) {
    const result = await githubUserRequest<GithubInstallationsResponse>(
      accessToken,
      `/user/installations?per_page=100&page=${page}`
    );

    const installation = result.installations.find(
      (item) => BigInt(item.id) === targetId
    );

    if (installation) {
      if (String(installation.app_id) !== env.GITHUB_APP_ID) {
        throw new Error("Installation belongs to a different GitHub App");
      }

      return installation;
    }

    if (result.installations.length < 100) {
      break;
    }
  }

  return null;
}
