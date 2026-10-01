import "server-only";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { runOnce } from "./run-once";
import { WORKER_INTERVAL_MS } from "./constants";

type WorkerState = {
  started?: boolean;
  timer?: ReturnType<typeof setInterval>;
};

const globalForWorker = globalThis as unknown as {
  githubAutomationWorker?: WorkerState;
};

export function startWorker() {
  if (!env.WORKER_ENABLED) {
    return;
  }

  if (globalForWorker.githubAutomationWorker?.started) {
    return;
  }

  const state: WorkerState = {
    started: true,
  };

  globalForWorker.githubAutomationWorker = state;

  const tick = async () => {
    try {
      await runOnce();
    } catch (error) {
      logger.error("Worker iteration failed", {
        error:
          error instanceof Error
            ? error.message
            : "unknown",
      });
    }
  };

  void tick();

  state.timer = setInterval(
    () => {
      void tick();
    },
    WORKER_INTERVAL_MS
  );
}
