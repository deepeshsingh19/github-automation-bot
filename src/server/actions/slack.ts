import "server-only";

import { prisma } from "@/db/client";
import { decryptSecret } from "@/server/crypto/encryption";
import { validateSlackWebhookUrl } from "@/server/slack/validate";
import type { NormalizedEventPayload } from "@/server/rules/engine";
import {
  ActionExecutionError,
  classifyHttpStatus,
} from "@/server/worker/errors";

const SLACK_TIMEOUT_MS = 15_000;

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

function buildSlackMessage(
  payload: NormalizedEventPayload,
  aiSummary: string | null,
  aiSuggestedLabel: string | null,
  aiPriority: string | null
) {
  const lines = [
    `*GitHub ${payload.item.number}: ${payload.item.title}*`,
    `Repository: ${payload.repository.fullName}`,
    `Author: ${payload.item.author}`,
    `Type: ${payload.item.htmlUrl.includes("/pull/") ? "Pull Request" : "Issue"}`,
    `URL: ${payload.item.htmlUrl}`,
  ];

  if (aiSummary) {
    lines.push(`AI Summary: ${aiSummary}`);
  }

  if (aiSuggestedLabel) {
    lines.push(
      `Suggested Label: ${aiSuggestedLabel}`
    );
  }

  if (aiPriority) {
    lines.push(
      `Priority: ${aiPriority}`
    );
  }

  return lines.join("\n");
}

export async function executeSlackAction(
  eventId: string,
  claimedLockedAt: Date
) {
  const event =
    await prisma.event.findUnique({
      where: {
        id: eventId,
      },
      include: {
        repository: true,
      },
    });

  if (!event) {
    throw new ActionExecutionError(
      "Event not found",
      "permanent"
    );
  }

  if (
    event.status !== "PROCESSING" ||
    !event.lockedAt ||
    event.lockedAt.getTime() !==
      claimedLockedAt.getTime()
  ) {
    throw new ActionExecutionError(
      "Event lease is no longer valid",
      "transient"
    );
  }

  if (
    !event.repository.active
  ) {
    throw new ActionExecutionError(
      "Repository is inactive",
      "permanent"
    );
  }

  if (
    !event.repository.slackWebhookEncrypted
  ) {
    throw new ActionExecutionError(
      "Slack webhook is not configured",
      "permanent"
    );
  }

  let webhookUrl: string;

  try {
    webhookUrl = decryptSecret(
      event.repository
        .slackWebhookEncrypted
    );
  } catch {
    throw new ActionExecutionError(
      "Unable to decrypt Slack webhook",
      "permanent"
    );
  }

  try {
    webhookUrl =
      validateSlackWebhookUrl(
        webhookUrl
      );
  } catch {
    throw new ActionExecutionError(
      "Stored Slack webhook is invalid",
      "permanent"
    );
  }

  const payload =
    parsePayload(event.payload);

  const message =
    buildSlackMessage(
      payload,
      event.aiSummary,
      event.aiSuggestedLabel,
      event.aiPriority
    );

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    SLACK_TIMEOUT_MS
  );

  timeout.unref?.();

  try {
    const response = await fetch(
      webhookUrl,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          text: message,
        }),
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const kind =
        classifyHttpStatus(
          response.status
        );

      throw new ActionExecutionError(
        `Slack request failed with status ${response.status}`,
        kind,
        response.status
      );
    }

    return {
      type: "slack",
      delivered: true,
    };
  } catch (error) {
    if (
      error instanceof ActionExecutionError
    ) {
      throw error;
    }

    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new ActionExecutionError(
        "Slack request timed out",
        "transient"
      );
    }

    throw new ActionExecutionError(
      "Slack request failed",
      "transient"
    );
  } finally {
    clearTimeout(timeout);
  }
}
