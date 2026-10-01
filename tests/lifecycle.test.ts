import {
  describe,
  expect,
  it,
} from "vitest";

import { prisma } from "@/db/client";
import {
  handleGithubLifecycleEvent,
} from "@/server/github/webhook-lifecycle";

async function createInstallationWithRepository() {
  const user = await prisma.user.create({
    data: {
      githubId:
        `lifecycle-${Date.now()}-${Math.random()}`,
      githubLogin: "lifecycle-test",
    },
  });

  const installation =
    await prisma.installation.create({
      data: {
        githubId: BigInt(
          9400000 +
            Math.floor(
              Math.random() * 100000
            )
        ),
        userId: user.id,
        accountLogin:
          "lifecycle-test",
      },
    });

  const repository =
    await prisma.repository.create({
      data: {
        githubRepoId: BigInt(
          8400000 +
            Math.floor(
              Math.random() * 100000
            )
        ),
        installationId:
          installation.id,
        owner: "lifecycle-test",
        name: "lifecycle-test",
        fullName:
          "lifecycle-test/lifecycle-test",
        active: true,
      },
    });

  return {
    installation,
    repository,
  };
}

describe("GitHub installation lifecycle", () => {
  it("deactivates repository connections when an installation is deleted", async () => {
    const {
      installation,
      repository,
    } =
      await createInstallationWithRepository();

    const result =
      await handleGithubLifecycleEvent(
        "installation",
        "deleted",
        {
          installation: {
            id:
              installation.githubId.toString(),
          },
        }
      );

    expect(result).toEqual({
      handled: true,
    });

    const storedInstallation =
      await prisma.installation.findUnique({
        where: {
          id: installation.id,
        },
      });

    const storedRepository =
      await prisma.repository.findUnique({
        where: {
          id: repository.id,
        },
      });

    expect(
      storedInstallation?.active
    ).toBe(false);

    expect(
      storedInstallation?.suspended
    ).toBe(false);

    expect(
      storedRepository?.active
    ).toBe(false);
  });
});
