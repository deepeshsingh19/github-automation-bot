import { describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import { claimEvents } from "@/server/worker/claim-events";

async function createEvent() {
  const user = await prisma.user.create({
    data: {
      githubId: "claim-test-user",
      githubLogin: "claim-test",
    },
  });

  const installation = await prisma.installation.create({
    data: {
      githubId: BigInt(9100001),
      userId: user.id,
      accountLogin: "claim-test",
    },
  });

  const repository = await prisma.repository.create({
    data: {
      githubRepoId: BigInt(8100001),
      installationId: installation.id,
      owner: "claim-test",
      name: "claim-test",
      fullName: "claim-test/claim-test",
    },
  });

  return prisma.event.create({
    data: {
      repositoryId: repository.id,
      githubDeliveryId: `claim-${Date.now()}-${Math.random()}`,
      eventType: "issues",
      payload: {
        repository: {
          id: "8100001",
          owner: "claim-test",
          name: "claim-test",
          fullName: "claim-test/claim-test",
        },
        item: {
          number: 1,
          title: "test",
          body: "",
          author: "claim-test",
          labels: [],
          htmlUrl:
            "https://github.com/claim-test/claim-test/issues/1",
        },
      },
    },
  });
}

describe("claimEvents", () => {
  it("allows only one concurrent worker to claim an event", async () => {
    const event = await createEvent();

    const [first, second] =
      await Promise.all([
        claimEvents(1),
        claimEvents(1),
      ]);

    const claimed = [...first, ...second].filter(
      (item) => item.id === event.id
    );

    expect(claimed).toHaveLength(1);

    const stored = await prisma.event.findUnique({
      where: {
        id: event.id,
      },
    });

    expect(stored?.status).toBe("PROCESSING");
    expect(stored?.attempts).toBe(1);
    expect(stored?.lockedAt).not.toBeNull();
  });

  it("reclaims a stale processing event", async () => {
    const event = await createEvent();

    await prisma.event.update({
      where: {
        id: event.id,
      },
      data: {
        status: "PROCESSING",
        attempts: 1,
        lockedAt: new Date(
          Date.now() - 11 * 60 * 1000
        ),
      },
    });

    const claimed = await claimEvents(1);

    expect(
      claimed.some((item) => item.id === event.id)
    ).toBe(true);

    const stored = await prisma.event.findUnique({
      where: {
        id: event.id,
      },
    });

    expect(stored?.attempts).toBe(2);
    expect(stored?.status).toBe("PROCESSING");
  });

  it("marks an exhausted event as failed", async () => {
    const event = await createEvent();

    await prisma.event.update({
      where: {
        id: event.id,
      },
      data: {
        attempts: 5,
      },
    });

    await claimEvents(1);

    const stored = await prisma.event.findUnique({
      where: {
        id: event.id,
      },
    });

    expect(stored?.status).toBe("FAILED");
    expect(stored?.lockedAt).toBeNull();
    expect(stored?.lastError).toBe(
      "Maximum retry attempts exceeded"
    );
  });
});
