import "server-only";

import { prisma } from "@/db/client";
import { listInstallationRepositories } from "@/server/github/repositories";

export async function getDashboardRepositories(
  userId: string,
  accessToken: string
) {
  const installations = await prisma.installation.findMany({
    where: {
      userId,
      active: true,
    },
    select: {
      id: true,
      githubId: true,
      accountLogin: true,
      suspended: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const groups = await Promise.all(
    installations.map(async (installation) => {
      const [githubRepositories, connectedRepositories] =
        await Promise.all([
          listInstallationRepositories(
            accessToken,
            installation.githubId.toString()
          ),
          prisma.repository.findMany({
            where: {
              installationId: installation.id,
            },
            select: {
              id: true,
              githubRepoId: true,
              owner: true,
              name: true,
              fullName: true,
              active: true,
              slackWebhookEncrypted: true,
            },
          }),
        ]);

      const connectedByGithubId = new Map(
        connectedRepositories.map((repository) => [
          repository.githubRepoId.toString(),
          repository,
        ])
      );

      return {
        installation: {
          id: installation.id,
          githubId: installation.githubId.toString(),
          accountLogin: installation.accountLogin,
          suspended: installation.suspended,
        },
        repositories: githubRepositories.map((repository) => {
          const connected = connectedByGithubId.get(
            String(repository.id)
          );

          return {
            databaseId: connected?.id ?? null,
            githubRepoId: String(repository.id),
            owner: repository.owner.login,
            name: repository.name,
            fullName: repository.full_name,
            private: repository.private,
            htmlUrl: repository.html_url,
            canConnect:
              repository.permissions?.push === true ||
              repository.permissions?.admin === true,
            connected: Boolean(connected?.active),
            active: connected?.active ?? false,
            slackConfigured: Boolean(
              connected?.slackWebhookEncrypted
            ),
          };
        }),
      };
    })
  );

  return groups;
}
