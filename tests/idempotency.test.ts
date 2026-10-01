import { describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import { createEventActions } from "@/server/worker/actions";
import type { PlannedAction } from "@/server/rules/engine";

async function createEvent() {
  const user = await prisma.user.create({
    data: {
      githubId: "idempotency-test-user",
      githubLogin: "idempotency-test",
    },
  });

  const installation =
    await prisma.installation.create({
      data: {
        githubId: BigInt(9200001),
        userId: user.id,
        accountLogin: "idempotency-test",
      },
    });

  const repository =
    await prisma.repository.create({
      data: {
        githubRepoId: BigInt(8200001),
        installationId: installation.id,
        owner: "idempotency-test",
        name: "idempotency-test",
        fullName:
          "idempotency-test/idempotency-test",
      },
    });

  return prisma.event.create({
    data: {
      repositoryId: repository.id,
      githubDeliveryId: `idempotency-${Date.now()}-${Math.random()}`,
      eventType: "issues",
      payload: {},
    },
  });
}

describe("action idempotency", () => {
  it("does not create duplicate action rows", async () => {
    const event = await createEvent();

    const action: PlannedAction = {
      actionType: "ADD_LABEL",
      actionKey: "rule:rule-1:add_label:bug",
      ruleId: null,
      definition: {
        type: "addLabel",
        label: "bug",
      },
    };

    await Promise.all([
      createEventActions(event.id, [
        action,
      ]),
      createEventActions(event.id, [
        action,
      ]),
    ]);

    const actions = await prisma.action.findMany({
      where: {
        eventId: event.id,
      },
    });

    expect(actions).toHaveLength(1);
  });
});
