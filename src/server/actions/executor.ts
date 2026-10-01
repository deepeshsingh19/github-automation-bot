import "server-only";

import { prisma } from "@/db/client";
import { executeAiAction } from "@/server/actions/ai";
import { executeGithubAction } from "@/server/actions/github";
import {
  ActionExecutionError,
} from "@/server/worker/errors";
import type { NormalizedEventPayload } from "@/server/rules/engine";

export type ExecuteActionContext = {
  eventId: string;
  claimedLockedAt: Date;
  action: {
    id: string;
    actionType:
      | "ADD_LABEL"
      | "COMMENT"
      | "SLACK"
      | "AI";
    actionKey: string;
    rule: {
      actions: unknown;
    } | null;
  };
};

function parsePayload(
  payload: unknown
): NormalizedEventPayload {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new ActionExecutionError(
      "Event payload is invalid",
      "permanent"
    );
  }

  return payload as NormalizedEventPayload;
}

export async function executeAction(
  context: ExecuteActionContext
): Promise<unknown> {
  const event =
    await prisma.event.findUnique({
      where: {
        id: context.eventId,
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
    throw new ActionExecutionError(
      "Event not found",
      "permanent"
    );
  }

  switch (
    context.action.actionType
  ) {
    case "AI":
      return executeAiAction(
        event.id,
        context.claimedLockedAt
      );

    case "ADD_LABEL":
    case "COMMENT": {
      if (!context.action.rule) {
        throw new ActionExecutionError(
          "GitHub action is missing its rule",
          "permanent"
        );
      }

      const payload =
        parsePayload(event.payload);

      const installationId =
        event.repository.installation.githubId.toString();

      return executeGithubAction({
        eventId: event.id,
        actionKey:
          context.action.actionKey,
        installationId,
        payload,
        ruleActions:
          context.action.rule.actions,
        actionType:
          context.action.actionType,
      });
    }

    case "SLACK":
      throw new ActionExecutionError(
        "Slack executor is not configured yet",
        "permanent"
      );
  }
}
