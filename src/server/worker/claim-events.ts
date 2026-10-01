import "server-only";

import { prisma } from "@/db/client";
import {
  MAX_EVENT_ATTEMPTS,
  STALE_LOCK_MS,
  WORKER_BATCH_SIZE,
} from "./constants";

export type ClaimedEvent = {
  id: string;
  lockedAt: Date;
  attempts: number;
};

export async function claimEvents(
  batchSize = WORKER_BATCH_SIZE
): Promise<ClaimedEvent[]> {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("Invalid worker batch size");
  }

  const staleLockMinutes = Math.floor(
    STALE_LOCK_MS / 60_000
  );

  return prisma.$queryRaw<ClaimedEvent[]>`
    WITH candidates AS (
      SELECT "id"
      FROM "Event"
      WHERE
        (
          "status" = 'PENDING'
          AND (
            "nextRetryAt" IS NULL
            OR "nextRetryAt" <= CURRENT_TIMESTAMP
          )
        )
        OR
        (
          "status" = 'PROCESSING'
          AND "lockedAt" IS NOT NULL
          AND "lockedAt" <= CURRENT_TIMESTAMP
            - (${staleLockMinutes} * INTERVAL '1 minute')
        )
      ORDER BY "receivedAt"
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    ),
    poisoned AS (
      UPDATE "Event" e
      SET
        "status" = 'FAILED',
        "lastError" = 'Maximum retry attempts exceeded',
        "processedAt" = CURRENT_TIMESTAMP,
        "lockedAt" = NULL,
        "nextRetryAt" = NULL
      WHERE e."id" IN (
        SELECT c."id"
        FROM candidates c
        WHERE e."attempts" >= ${MAX_EVENT_ATTEMPTS}
      )
      RETURNING e."id"
    ),
    claimable AS (
      SELECT c."id"
      FROM candidates c
      WHERE NOT EXISTS (
        SELECT 1
        FROM poisoned p
        WHERE p."id" = c."id"
      )
    ),
    claimed AS (
      UPDATE "Event" e
      SET
        "status" = 'PROCESSING',
        "attempts" = e."attempts" + 1,
        "lockedAt" = CURRENT_TIMESTAMP,
        "nextRetryAt" = NULL,
        "lastError" = NULL
      WHERE e."id" IN (
        SELECT "id"
        FROM claimable
      )
      RETURNING
        e."id",
        e."lockedAt",
        e."attempts"
    )
    SELECT
      "id",
      "lockedAt",
      "attempts"
    FROM claimed
  `;
}
