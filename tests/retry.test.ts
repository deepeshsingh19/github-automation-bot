import {
  describe,
  expect,
  it,
} from "vitest";

import { prisma } from "@/db/client";
import {
  MAX_EVENT_ATTEMPTS,
  RETRY_DELAYS_MS,
} from "@/server/worker/constants";
import { scheduleRetry } from "@/server/worker/retry";

async function createEvent() {
  const user = await prisma.user.create({
    data: {
      githubId: `retry-user-${Date.now()}-${Math.random()}`,
      githubLogin: "retry-test",
    },
  });

  const installation =
    await prisma.installation.create({
      data: {
        githubId: BigInt(
          9200000 +
            Math.floor(Math.random() * 100000)
        ),
        userId: user.id,
        accountLogin: "retry-test",
      },
    });

  const repository =
    await prisma.repository.create({
      data: {
        githubRepoId: BigInt(
          8200000 +
            Math.floor(Math.random() * 100000)
        ),
        installationId:
          installation.id,
        owner: "retry-test",
        name: "retry-test",
        fullName:
          "retry-test/retry-test",
      },
    });

  return prisma.event.create({
    data: {
      repositoryId: repository.id,
      githubDeliveryId:
        `retry-${Date.now()}-${Math.random()}`,
      eventType: "issues",
      status: "PROCESSING",
      attempts: 1,
      lockedAt: new Date(),
      payload: {
        repository: {
          id: "8200001",
          owner: "retry-test",
          name: "retry-test",
          fullName:
            "retry-test/retry-test",
        },
        item: {
          number: 1,
          title: "retry test",
          body: "",
          author: "retry-test",
          labels: [],
          htmlUrl:
            "https://github.com/retry-test/retry-test/issues/1",
        },
      },
    },
  });
}

async function claimEventForTest(
  eventId: string,
  attempts: number
) {
  const lockedAt = new Date();

  await prisma.event.update({
    where: {
      id: eventId,
    },
    data: {
      status: "PROCESSING",
      attempts,
      lockedAt,
    },
  });

  return lockedAt;
}

describe("scheduleRetry", () => {
  it("schedules a retry using the first backoff delay", async () => {
    const event = await createEvent();
    const lockedAt =
      await claimEventForTest(
        event.id,
        1
      );

    const before = Date.now();

    const result =
      await scheduleRetry(
        event.id,
        lockedAt,
        "temporary GitHub failure"
      );

    const after = Date.now();

    expect(result).toBe(true);

    const stored =
      await prisma.event.findUnique({
        where: {
          id: event.id,
        },
      });

    expect(stored?.status).toBe(
      "PENDING"
    );
    expect(stored?.lockedAt).toBeNull();
    expect(stored?.lastError).toBe(
      "temporary GitHub failure"
    );

    expect(
      stored?.nextRetryAt
    ).not.toBeNull();

    const retryAt =
      stored!.nextRetryAt!.getTime();

    expect(retryAt).toBeGreaterThanOrEqual(
      before + RETRY_DELAYS_MS[0]
    );

    expect(retryAt).toBeLessThanOrEqual(
      after + RETRY_DELAYS_MS[0]
    );
  });

  it("uses the correct exponential-style backoff sequence", async () => {
    const expectedDelays =
      RETRY_DELAYS_MS;

    for (
      let attempts = 1;
      attempts <= expectedDelays.length;
      attempts++
    ) {
      const event =
        await createEvent();

      const lockedAt =
        await claimEventForTest(
          event.id,
          attempts
        );

      const before = Date.now();

      await scheduleRetry(
        event.id,
        lockedAt,
        `retry-${attempts}`
      );

      const stored =
        await prisma.event.findUnique({
          where: {
            id: event.id,
          },
        });

      expect(
        stored?.nextRetryAt
      ).not.toBeNull();

      const retryAt =
        stored!.nextRetryAt!.getTime();

      expect(retryAt).toBeGreaterThanOrEqual(
        before +
          expectedDelays[attempts - 1]
      );
    }
  });

  it("marks the event failed after the maximum attempts", async () => {
    const event = await createEvent();

    const lockedAt =
      await claimEventForTest(
        event.id,
        MAX_EVENT_ATTEMPTS
      );

    const result =
      await scheduleRetry(
        event.id,
        lockedAt,
        "maximum retries reached"
      );

    expect(result).toBe(true);

    const stored =
      await prisma.event.findUnique({
        where: {
          id: event.id,
        },
      });

    expect(stored?.status).toBe(
      "FAILED"
    );
    expect(stored?.lockedAt).toBeNull();
    expect(stored?.nextRetryAt).toBeNull();
    expect(stored?.lastError).toBe(
      "maximum retries reached"
    );
    expect(stored?.processedAt).not.toBeNull();
  });

  it("does not retry when the worker lease has been lost", async () => {
    const event = await createEvent();

    const actualLockedAt =
      await claimEventForTest(
        event.id,
        1
      );

    const staleLockedAt =
      new Date(
        actualLockedAt.getTime() - 1
      );

    const result =
      await scheduleRetry(
        event.id,
        staleLockedAt,
        "stale worker"
      );

    expect(result).toBe(false);

    const stored =
      await prisma.event.findUnique({
        where: {
          id: event.id,
        },
      });

    expect(stored?.status).toBe(
      "PROCESSING"
    );
    expect(stored?.lockedAt).not.toBeNull();
    expect(stored?.lastError).toBeNull();
  });
});
