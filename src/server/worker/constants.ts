export const WORKER_BATCH_SIZE = 10;

export const MAX_EVENT_ATTEMPTS = 5;

export const STALE_LOCK_MS = 10 * 60 * 1000;

export const WORKER_INTERVAL_MS = 30 * 1000;

export const RETRY_DELAYS_MS = [
  1 * 60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
];
