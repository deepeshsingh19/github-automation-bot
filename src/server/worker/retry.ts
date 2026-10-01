import "server-only";

import { prisma } from "@/db/client";
import {
  MAX_EVENT_ATTEMPTS,
  RETRY_DELAYS_MS,
} from "./constants";

export async function scheduleRetry(
  eventId: string,
  claimedLockedAt: Date,
  errorMessage: string
) {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      status: "PROCESSING",
      lockedAt: claimedLockedAt,
    },
    select: {
      attempts: true,
    },
  });

  if (!event) {
    return false;
  }

  if (event.attempts >= MAX_EVENT_ATTEMPTS) {
    return markRetryAsFailed(
      eventId,
      claimedLockedAt,
      errorMessage
    );
  }

  const delayIndex = Math.min(
    event.attempts - 1,
    RETRY_DELAYS_MS.length - 1
  );

  const delay =
    RETRY_DELAYS_MS[Math.max(delayIndex, 0)];

  const result = await prisma.event.updateMany({
    where: {
      id: eventId,
      status: "PROCESSING",
      lockedAt: claimedLockedAt,
    },
    data: {
      status: "PENDING",
      nextRetryAt: new Date(Date.now() + delay),
      lockedAt: null,
      lastError: errorMessage,
    },
  });

  return result.count === 1;
}

async function markRetryAsFailed(
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
      nextRetryAt: null,
      processedAt: new Date(),
      lockedAt: null,
      lastError: errorMessage,
    },
  });

  return result.count === 1;
}
