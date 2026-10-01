import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const executeActionMock = vi.hoisted(() =>
  vi.fn()
);

vi.mock("@/server/actions/executor", () => ({
  executeAction: executeActionMock,
}));

import { prisma } from "@/db/client";
import { processEvent } from "@/server/worker/process-event";
import {
  ActionExecutionError,
} from "@/server/worker/errors";

async function createRepository() {
  const user = await prisma.user.create({
    data: {
      githubId: `worker-test-user-${Date.now()}-${Math.random()}`,
      githubLogin: "worker-test",
    },
  });

  const installation =
    await prisma.installation.create({
      data: {
        githubId: BigInt(9300001),
        userId: user.id,
        accountLogin: "worker-test",
      },
    });

  const repository =
    await prisma.repository.create({
      data: {
        githubRepoId: BigInt(8300001),
        installationId:
          installation.id,
        owner: "worker-test",
        name: "worker-test",
        fullName:
          "worker-test/worker-test",
      },
    });

  return repository;
}

async function createEvent(
  repositoryId: string
) {
  const lockedAt = new Date();

  const event =
    await prisma.event.create({
      data: {
        repositoryId,
        githubDeliveryId:
          `worker-${Date.now()}-${Math.random()}`,
        eventType: "issues",
        action: "opened",
        status: "PROCESSING",
        attempts: 1,
        lockedAt,
        payload: {
          repository: {
            id: "8300001",
            owner: "worker-test",
            name: "worker-test",
            fullName:
              "worker-test/worker-test",
          },
          item: {
            number: 42,
            title: "login bug",
            body: "Login fails.",
            author: "worker-test",
            labels: [],
            htmlUrl:
              "https://github.com/worker-test/worker-test/issues/42",
          },
        },
      },
    });

  return {
    event,
    lockedAt,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("processEvent integration", () => {
  it("executes AI, GitHub, and Slack actions in order and keeps AI failure non-blocking", async () => {
    const repository =
      await createRepository();

    await prisma.rule.create({
      data: {
        repositoryId:
          repository.id,
        name:
          "Automate login bugs",
        eventType: "ISSUES",
        matchField: "TITLE",
        matchOperator:
          "CONTAINS",
        matchValue: "login",
        actions: [
          {
            type: "ai",
          },
          {
            type: "addLabel",
            label: "bug",
          },
          {
            type: "slack",
          },
        ],
        enabled: true,
      },
    });

    const { event, lockedAt } =
      await createEvent(
        repository.id
      );

    const executionOrder: string[] =
      [];

    executeActionMock.mockImplementation(
      async ({
        action,
      }: {
        action: {
          actionType: string;
        };
      }) => {
        executionOrder.push(
          action.actionType
        );

        if (
          action.actionType === "AI"
        ) {
          throw new ActionExecutionError(
            "Gemini unavailable",
            "ai"
          );
        }

        return {
          executed: true,
          actionType:
            action.actionType,
        };
      }
    );

    await processEvent({
      id: event.id,
      lockedAt,
      attempts: 1,
    });

    expect(
      executionOrder
    ).toEqual([
      "AI",
      "ADD_LABEL",
      "SLACK",
    ]);

    const storedEvent =
      await prisma.event.findUnique({
        where: {
          id: event.id,
        },
      });

    expect(
      storedEvent?.status
    ).toBe("DONE");

    const actions =
      await prisma.action.findMany({
        where: {
          eventId: event.id,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

    expect(actions).toHaveLength(3);

    const aiAction =
      actions.find(
        (action) =>
          action.actionType === "AI"
      );

    const githubAction =
      actions.find(
        (action) =>
          action.actionType ===
          "ADD_LABEL"
      );

    const slackAction =
      actions.find(
        (action) =>
          action.actionType ===
          "SLACK"
      );

    expect(
      aiAction?.status
    ).toBe("FAILED");

    expect(
      aiAction?.error
    ).toBe("Gemini unavailable");

    expect(
      githubAction?.status
    ).toBe("SUCCESS");

    expect(
      slackAction?.status
    ).toBe("SUCCESS");
  });

  it("schedules a retry when a GitHub action fails transiently", async () => {
    const repository =
      await createRepository();

    await prisma.rule.create({
      data: {
        repositoryId:
          repository.id,
        name:
          "Apply bug label",
        eventType: "ISSUES",
        matchField: "TITLE",
        matchOperator:
          "CONTAINS",
        matchValue: "login",
        actions: [
          {
            type: "addLabel",
            label: "bug",
          },
        ],
        enabled: true,
      },
    });

    const { event, lockedAt } =
      await createEvent(
        repository.id
      );

    executeActionMock.mockRejectedValue(
      new ActionExecutionError(
        "GitHub rate limited",
        "transient",
        429
      )
    );

    const before =
      Date.now();

    await processEvent({
      id: event.id,
      lockedAt,
      attempts: 1,
    });

    const storedEvent =
      await prisma.event.findUnique({
        where: {
          id: event.id,
        },
      });

    expect(
      storedEvent?.status
    ).toBe("PENDING");

    expect(
      storedEvent?.lockedAt
    ).toBeNull();

    expect(
      storedEvent?.lastError
    ).toBe("GitHub rate limited");

    expect(
      storedEvent?.nextRetryAt
    ).not.toBeNull();

    expect(
      storedEvent!.nextRetryAt!.getTime()
    ).toBeGreaterThanOrEqual(
      before + 60 * 1000
    );

    const action =
      await prisma.action.findFirst({
        where: {
          eventId: event.id,
        },
      });

    expect(
      action?.status
    ).toBe("PENDING");

    expect(
      action?.error
    ).toBe("GitHub rate limited");
  });

  it("does not execute an already successful action again", async () => {
    const repository =
      await createRepository();

    const { event, lockedAt } =
      await createEvent(
        repository.id
      );

    await prisma.action.create({
      data: {
        eventId: event.id,
        actionType: "ADD_LABEL",
        actionKey:
          "rule:existing:add_label:bug",
        status: "SUCCESS",
        completedAt:
          new Date(),
        response: {
          type: "github",
          action: "addLabel",
        },
      },
    });

    executeActionMock.mockResolvedValue({
      executed: true,
    });

    await processEvent({
      id: event.id,
      lockedAt,
      attempts: 1,
    });

    expect(
      executeActionMock
    ).not.toHaveBeenCalled();

    const storedEvent =
      await prisma.event.findUnique({
        where: {
          id: event.id,
        },
      });

    expect(
      storedEvent?.status
    ).toBe("DONE");
  });
});
