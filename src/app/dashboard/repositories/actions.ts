"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/auth";
import { prisma } from "@/db/client";
import { getGithubAuthContextFromCurrentRequest } from "@/server/auth/github-token-context";
import { listInstallationRepositories } from "@/server/github/repositories";
import { encryptSecret } from "@/server/crypto/encryption";
import { validateSlackWebhookUrl } from "@/server/slack/validate";

const repositoryIdSchema = z.string().regex(/^\d+$/);
const databaseIdSchema = z.string().cuid();
const installationIdSchema = z.string().cuid();

export type RepositoryActionResult = {
  success: boolean;
  error?: string;
};

async function getAuthenticatedContext() {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return null;
  }

  const githubAuth = await getGithubAuthContextFromCurrentRequest();

  if (!githubAuth || githubAuth.userId !== session.user.id) {
    return null;
  }

  return {
    session,
    githubAuth,
  };
}

export async function connectRepository(
  installationIdInput: string,
  githubRepoIdInput: string
): Promise<RepositoryActionResult> {
  const installationIdResult =
    installationIdSchema.safeParse(installationIdInput);

  const githubRepoIdResult =
    repositoryIdSchema.safeParse(githubRepoIdInput);

  if (!installationIdResult.success || !githubRepoIdResult.success) {
    return {
      success: false,
      error: "Invalid repository or installation.",
    };
  }

  const context = await getAuthenticatedContext();

  if (!context) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const installation = await prisma.installation.findFirst({
    where: {
      id: installationIdResult.data,
      userId: context.session.user.id,
      active: true,
      suspended: false,
    },
    select: {
      id: true,
      githubId: true,
    },
  });

  if (!installation) {
    return {
      success: false,
      error: "Installation not found.",
    };
  }

  let githubRepositories;

  try {
    githubRepositories = await listInstallationRepositories(
      context.githubAuth.accessToken,
      installation.githubId.toString()
    );
  } catch {
    return {
      success: false,
      error: "Unable to load repositories from GitHub.",
    };
  }

  const githubRepository = githubRepositories.find(
    (repository) =>
      String(repository.id) === githubRepoIdResult.data
  );

  if (!githubRepository) {
    return {
      success: false,
      error: "Repository is not accessible through this installation.",
    };
  }

  const canConnect =
    githubRepository.permissions?.push === true ||
    githubRepository.permissions?.admin === true;

  if (!canConnect) {
    return {
      success: false,
      error: "You need push or admin access to connect this repository.",
    };
  }

  const githubRepoId = BigInt(githubRepository.id);

  try {
    const existing = await prisma.repository.findUnique({
      where: {
        githubRepoId,
      },
      select: {
        id: true,
        installationId: true,
      },
    });

    if (existing && existing.installationId !== installation.id) {
      return {
        success: false,
        error: "Repository is already connected to another installation.",
      };
    }

    if (existing) {
      await prisma.repository.update({
        where: {
          id: existing.id,
        },
        data: {
          owner: githubRepository.owner.login,
          name: githubRepository.name,
          fullName: githubRepository.full_name,
          active: true,
        },
      });
    } else {
      await prisma.repository.create({
        data: {
          githubRepoId,
          installationId: installation.id,
          owner: githubRepository.owner.login,
          name: githubRepository.name,
          fullName: githubRepository.full_name,
          active: true,
        },
      });
    }
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "Repository was connected concurrently. Refresh and try again.",
      };
    }

    return {
      success: false,
      error: "Unable to connect repository.",
    };
  }

  revalidatePath("/dashboard/repositories");

  return {
    success: true,
  };
}

export async function disconnectRepository(
  repositoryIdInput: string
): Promise<RepositoryActionResult> {
  const repositoryIdResult =
    databaseIdSchema.safeParse(repositoryIdInput);

  if (!repositoryIdResult.success) {
    return {
      success: false,
      error: "Invalid repository.",
    };
  }

  const context = await getAuthenticatedContext();

  if (!context) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const repository = await prisma.repository.findFirst({
    where: {
      id: repositoryIdResult.data,
      installation: {
        userId: context.session.user.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (!repository) {
    return {
      success: false,
      error: "Repository not found.",
    };
  }

  await prisma.repository.update({
    where: {
      id: repository.id,
    },
    data: {
      active: false,
      slackWebhookEncrypted: null,
    },
  });

  revalidatePath("/dashboard/repositories");

  return {
    success: true,
  };
}

export async function configureSlackWebhook(
  repositoryIdInput: string,
  webhookUrl?: string
): Promise<RepositoryActionResult> {
  const repositoryIdResult =
    databaseIdSchema.safeParse(repositoryIdInput);

  if (!repositoryIdResult.success) {
    return {
      success: false,
      error: "Invalid repository.",
    };
  }

  const context = await getAuthenticatedContext();

  if (!context) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const repository = await prisma.repository.findFirst({
    where: {
      id: repositoryIdResult.data,
      active: true,
      installation: {
        userId: context.session.user.id,
        active: true,
        suspended: false,
      },
    },
    select: {
      id: true,
    },
  });

  if (!repository) {
    return {
      success: false,
      error: "Repository not found.",
    };
  }

  if (webhookUrl === undefined) {
    return {
      success: true,
    };
  }

  if (webhookUrl === "") {
    await prisma.repository.update({
      where: {
        id: repository.id,
      },
      data: {
        slackWebhookEncrypted: null,
      },
    });

    revalidatePath("/dashboard/repositories");

    return {
      success: true,
    };
  }

  let validatedUrl: string;

  try {
    validatedUrl = validateSlackWebhookUrl(webhookUrl);
  } catch {
    return {
      success: false,
      error: "Invalid Slack webhook URL.",
    };
  }

  const encryptedWebhook = encryptSecret(validatedUrl);

  await prisma.repository.update({
    where: {
      id: repository.id,
    },
    data: {
      slackWebhookEncrypted: encryptedWebhook,
    },
  });

  revalidatePath("/dashboard/repositories");

  return {
    success: true,
  };
}
