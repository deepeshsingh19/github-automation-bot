import "server-only";

import {
  RuleEventType,
} from "@prisma/client";

import { prisma } from "@/db/client";
import {
  evaluateRules,
  type NormalizedEventPayload,
  type RuleForEvaluation,
} from "@/server/rules/engine";
import { executeAction } from "@/server/actions/executor";
import {
  getErrorMessage,
  classifyUnknownError,
} from "./errors";
import {
  claimAction,
  createEventActions,
  getEventActions,
  markActionFailed,
  markActionPending,
  markActionSuccess,
  resetProcessingActions,
} from "./actions";
import { sortActions } from "./action-order";
import {
  markEventDone,
  markEventFailed,
  markEventSkipped,
} from "./completion";
import { scheduleRetry } from "./retry";

type ClaimedEventInput = {
  id: string;
  lockedAt: Date;
  attempts: number;
};

function parsePayload(
  payload: unknown
): NormalizedEventPayload {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new Error("Event payload is invalid");
  }

  return payload as NormalizedEventPayload;
}

function getRuleEventType(
  eventType: string
): RuleEventType {
  if (eventType === "issues") {
    return RuleEventType.ISSUES;
  }

  if (eventType === "pull_request") {
    return RuleEventType.PULL_REQUEST;
  }

  throw new Error(
    `Unsupported event type: ${eventType}`
  );
}

export async function processEvent(
  claimedEvent: ClaimedEventInput
) {
  const event = await prisma.event.findUnique({
    where: {
      id: claimedEvent.id,
    },
    include: {
      repository: {
        include: {
          installation: true,
        },
      },
    },
  });

  if (!event) {
    return;
  }

  if (
    event.status !== "PROCESSING" ||
    !event.lockedAt ||
    event.lockedAt.getTime() !==
      claimedEvent.lockedAt.getTime()
  ) {
    return;
  }

  if (
    !event.repository.active ||
    !event.repository.installation.active ||
    event.repository.installation.suspended
  ) {
    await markEventSkipped(
      event.id,
      claimedEvent.lockedAt,
      "Repository or installation is inactive"
    );

    return;
  }

  try {
    const payload = parsePayload(event.payload);
    const ruleEventType = getRuleEventType(
      event.eventType
    );

    let actions = await getEventActions(event.id);

    if (actions.length === 0) {
      const rules = await prisma.rule.findMany({
        where: {
          repositoryId: event.repositoryId,
          enabled: true,
        },
        select: {
          id: true,
          eventType: true,
          matchField: true,
          matchOperator: true,
          matchValue: true,
          enabled: true,
          actions: true,
        },
      });

      const plannedActions = evaluateRules(
        rules satisfies RuleForEvaluation[],
        ruleEventType,
        payload
      );

      await createEventActions(
        event.id,
        plannedActions
      );

      actions = await getEventActions(event.id);
    }

    await resetProcessingActions(
      event.id,
      claimedEvent.lockedAt
    );

    if (actions.length === 0) {
      await markEventDone(
        event.id,
        claimedEvent.lockedAt
      );

      return;
    }

    for (const action of sortActions(actions)) {
      if (action.status === "SUCCESS") {
        continue;
      }

      if (action.status === "FAILED") {
        await markEventFailed(
          event.id,
          claimedEvent.lockedAt,
          action.error ??
            "Action previously failed"
        );

        return;
      }

      const claimed = await claimAction(
        action.id,
        event.id,
        claimedEvent.lockedAt
      );

      if (!claimed) {
        return;
      }

      try {
        const response = await executeAction({
          eventId: event.id,
          action: {
            id: action.id,
            actionType: action.actionType,
            actionKey: action.actionKey,
            rule: action.rule
              ? {
                  actions: action.rule.actions,
                }
              : null,
          },
        });

        const fenced = await markActionSuccess(
          action.id,
          event.id,
          claimedEvent.lockedAt,
          response
        );

        if (!fenced) {
          return;
        }
      } catch (error) {
        const message = getErrorMessage(error);
        const kind = classifyUnknownError(error);

        if (kind === "permanent") {
          const fenced = await markActionFailed(
            action.id,
            event.id,
            claimedEvent.lockedAt,
            message
          );

          if (!fenced) {
            return;
          }

          await markEventFailed(
            event.id,
            claimedEvent.lockedAt,
            message
          );

          return;
        }

        const reset = await markActionPending(
          action.id,
          event.id,
          claimedEvent.lockedAt,
          message
        );

        if (!reset) {
          return;
        }

        await scheduleRetry(
          event.id,
          claimedEvent.lockedAt,
          message
        );

        return;
      }
    }

    const finalActions = await getEventActions(
      event.id
    );

    if (
      finalActions.every(
        (action) => action.status === "SUCCESS"
      )
    ) {
      await markEventDone(
        event.id,
        claimedEvent.lockedAt
      );
    }
  } catch (error) {
    const message = getErrorMessage(error);
    const kind = classifyUnknownError(error);

    if (kind === "permanent") {
      await markEventFailed(
        event.id,
        claimedEvent.lockedAt,
        message
      );

      return;
    }

    await scheduleRetry(
      event.id,
      claimedEvent.lockedAt,
      message
    );
  }
}
