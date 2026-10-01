import "server-only";

import { prisma } from "@/db/client";

type GithubPayload = Record<string, unknown>;

type LifecycleResult = {
  handled: boolean;
};

function getInstallationId(
  payload: GithubPayload
) {
  const installation =
    typeof payload.installation === "object" &&
    payload.installation !== null
      ? (payload.installation as Record<string, unknown>)
      : null;

  const id = installation?.id;

  if (
    typeof id === "number" &&
    Number.isSafeInteger(id)
  ) {
    return BigInt(id);
  }

  if (
    typeof id === "string" &&
    /^\d+$/.test(id)
  ) {
    return BigInt(id);
  }

  return null;
}

function getRepositoryIds(
  payload: GithubPayload,
  field:
    | "repositories_added"
    | "repositories_removed"
) {
  const values = payload[field];

  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => {
      if (
        typeof value !== "object" ||
        value === null
      ) {
        return null;
      }

      const object =
        value as Record<string, unknown>;

      const id = object.id;

      if (
        typeof id === "number" &&
        Number.isSafeInteger(id)
      ) {
        return BigInt(id);
      }

      if (
        typeof id === "string" &&
        /^\d+$/.test(id)
      ) {
        return BigInt(id);
      }

      return null;
    })
    .filter(
      (id): id is bigint =>
        id !== null
    );
}

async function deactivateInstallationRepositories(
  installationId: bigint
) {
  await prisma.repository.updateMany({
    where: {
      installation: {
        githubId: installationId,
      },
    },
    data: {
      active: false,
    },
  });
}

export async function handleGithubLifecycleEvent(
  eventType: string,
  action: string | null,
  payload: GithubPayload
): Promise<LifecycleResult> {
  if (
    eventType !== "installation" &&
    eventType !==
      "installation_repositories"
  ) {
    return {
      handled: false,
    };
  }

  const installationId =
    getInstallationId(payload);

  if (!installationId) {
    return {
      handled: true,
    };
  }

  if (eventType === "installation") {
    switch (action) {
      case "suspend":
      case "deleted":
        await prisma.installation.updateMany({
          where: {
            githubId: installationId,
          },
          data: {
            active: false,
            suspended:
              action === "suspend",
          },
        });

        await deactivateInstallationRepositories(
          installationId
        );
        break;

      case "unsuspend":
        await prisma.installation.updateMany({
          where: {
            githubId: installationId,
          },
          data: {
            active: true,
            suspended: false,
          },
        });

        await prisma.repository.updateMany({
          where: {
            installation: {
              githubId: installationId,
            },
          },
          data: {
            active: true,
          },
        });
        break;

      case "created":
      case "new_permissions_accepted":
        await prisma.installation.updateMany({
          where: {
            githubId: installationId,
          },
          data: {
            active: true,
            suspended: false,
          },
        });
        break;

      default:
        break;
    }

    return {
      handled: true,
    };
  }

  if (action === "added") {
    const repositoryIds =
      getRepositoryIds(
        payload,
        "repositories_added"
      );

    if (repositoryIds.length > 0) {
      await prisma.repository.updateMany({
        where: {
          githubRepoId: {
            in: repositoryIds,
          },
          installation: {
            githubId: installationId,
          },
        },
        data: {
          active: true,
        },
      });
    }
  }

  if (action === "removed") {
    const repositoryIds =
      getRepositoryIds(
        payload,
        "repositories_removed"
      );

    if (repositoryIds.length > 0) {
      await prisma.repository.updateMany({
        where: {
          githubRepoId: {
            in: repositoryIds,
          },
          installation: {
            githubId: installationId,
          },
        },
        data: {
          active: false,
        },
      });
    }
  }

  return {
    handled: true,
  };
}
