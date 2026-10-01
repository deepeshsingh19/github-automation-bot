import "server-only";

import { prisma } from "@/db/client";

export async function markEventDone(
  eventId: string,
  claimedLockedAt: Date
) {
  const result = await prisma.event.updateMany({
    where: {
      id: eventId,
      status: "PROCESSING",
      lockedAt: claimedLockedAt,
    },
    data: {
      status: "DONE",
      processedAt: new Date(),
      lockedAt: null,
      nextRetryAt: null,
      lastError: null,
    },
  });

  return result.count === 1;
}

export async function markEventSkipped(
  eventId: string,
  claimedLockedAt: Date,
  reason: string
) {
  const result = await prisma.event.updateMany({
    where: {
      id: eventId,
      status: "PROCESSING",
      lockedAt: claimedLockedAt,
    },
    data: {
      status: "SKIPPED",
      processedAt: new Date(),
      lockedAt: null,
      nextRetryAt: null,
      lastError: reason,
    },
  });

  return result.count === 1;
}

export async function markEventFailed(
  eventId: string,
  claimedLockedAt: Date,
  errorMessage: string
) {
  const result = await prisma.event.updateMany({
    where: {
      id: eventId,
      status: "PROCESSING",
      lockedAt: claimedLockedAt,
    },
    data: {
      status: "FAILED",
      processedAt: new Date(),
      lockedAt: null,
      nextRetryAt: null,
      lastError: errorMessage,
    },
  });

  return result.count === 1;
}
