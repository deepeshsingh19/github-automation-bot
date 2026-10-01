import "server-only";

import { claimEvents } from "./claim-events";
import { processEvent } from "./process-event";

let running = false;

export async function runOnce() {
  if (running) {
    return {
      claimed: 0,
      processed: 0,
      skipped: true,
    };
  }

  running = true;

  try {
    const claimedEvents = await claimEvents();

    let processed = 0;

    for (const event of claimedEvents) {
      try {
        await processEvent(event);
        processed += 1;
      } catch {
        processed += 1;
      }
    }

    return {
      claimed: claimedEvents.length,
      processed,
      skipped: false,
    };
  } finally {
    running = false;
  }
}
