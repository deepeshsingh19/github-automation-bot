import "server-only";

import { prisma } from "@/db/client";
import type { PlannedAction } from "@/server/rules/engine";

export async function createEventActions(
  eventId: string,
  plannedActions: PlannedAction[]
) {
  if (plannedActions.length === 0) {
    return;
  }

  await prisma.action.createMany({
    data: plannedActions.map((action) => ({
      eventId,
      ruleId: action.ruleId,
      actionType: action.actionType,
      actionKey: action.actionKey,
      status: "PENDING" as const,
    })),
    skipDuplicates: true,
  });
}

export async function getEventActions(eventId: string) {
  return prisma.action.findMany({
    where: {
      eventId,
    },
    include: {
      rule: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function resetProcessingActions(
  eventId: string,
  claimedLockedAt: Date
) {
  await prisma.$executeRaw`
    UPDATE "Action" a
    SET
      "status" = 'PENDING',
      "error" = NULL
    FROM "Event" e
    WHERE
      a."eventId" = e."id"
      AND a."eventId" = ${eventId}
      AND a."status" = 'PROCESSING'
      AND e."status" = 'PROCESSING'
      AND e."lockedAt" = ${claimedLockedAt}
  `;
}

export async function claimAction(
  actionId: string,
  eventId: string,
  claimedLockedAt: Date
) {
  const result = await prisma.$executeRaw`
    UPDATE "Action" a
    SET
      "status" = 'PROCESSING',
      "error" = NULL
    FROM "Event" e
    WHERE
      a."id" = ${actionId}
      AND a."eventId" = ${eventId}
      AND a."eventId" = e."id"
      AND a."status" = 'PENDING'
      AND e."status" = 'PROCESSING'
      AND e."lockedAt" = ${claimedLockedAt}
  `;

  return result === 1;
}

export async function markActionSuccess(
  actionId: string,
  eventId: string,
  claimedLockedAt: Date,
  response?: unknown
) {
  const result = await prisma.$executeRaw`
    UPDATE "Action" a
    SET
      "status" = 'SUCCESS',
      "error" = NULL,
      "response" = ${response ?? null},
      "completedAt" = CURRENT_TIMESTAMP
    FROM "Event" e
    WHERE
      a."id" = ${actionId}
      AND a."eventId" = ${eventId}
      AND a."eventId" = e."id"
      AND a."status" = 'PROCESSING'
      AND e."status" = 'PROCESSING'
      AND e."lockedAt" = ${claimedLockedAt}
  `;

  return result === 1;
}

export async function markActionPending(
  actionId: string,
  eventId: string,
  claimedLockedAt: Date,
  errorMessage: string
) {
  const result = await prisma.$executeRaw`
    UPDATE "Action" a
    SET
      "status" = 'PENDING',
      "error" = ${errorMessage},
      "completedAt" = NULL
    FROM "Event" e
    WHERE
      a."id" = ${actionId}
      AND a."eventId" = ${eventId}
      AND a."eventId" = e."id"
      AND a."status" = 'PROCESSING'
      AND e."status" = 'PROCESSING'
      AND e."lockedAt" = ${claimedLockedAt}
  `;

  return result === 1;
}

export async function markActionFailed(
  actionId: string,
  eventId: string,
  claimedLockedAt: Date,
  errorMessage: string
) {
  const result = await prisma.$executeRaw`
    UPDATE "Action" a
    SET
      "status" = 'FAILED',
      "error" = ${errorMessage},
      "completedAt" = CURRENT_TIMESTAMP
    FROM "Event" e
    WHERE
      a."id" = ${actionId}
      AND a."eventId" = ${eventId}
      AND a."eventId" = e."id"
      AND a."status" = 'PROCESSING'
      AND e."status" = 'PROCESSING'
      AND e."lockedAt" = ${claimedLockedAt}
  `;

  return result === 1;
}
