import "server-only";

import type { RuleEventType } from "@prisma/client";

import type { NormalizedEventPayload } from "@/server/rules/engine";

type GithubWebhookPayload = Record<string, unknown>;

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function getUserLogin(value: unknown) {
  const object = asObject(value);
  return asString(object?.login) ?? "unknown";
}

function getLabels(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((label) => {
      const object = asObject(label);
      return asString(object?.name);
    })
    .filter((name): name is string => Boolean(name));
}

function getInstallationId(payload: GithubWebhookPayload) {
  const installation = asObject(payload.installation);
  const id = installation?.id;

  if (typeof id === "number" && Number.isSafeInteger(id)) {
    return String(id);
  }

  if (typeof id === "string" && /^\d+$/.test(id)) {
    return id;
  }

  return null;
}

export function getGithubInstallationId(
  payload: GithubWebhookPayload
) {
  return getInstallationId(payload);
}

export function normalizeGithubEvent(
  eventType: string,
  payload: GithubWebhookPayload
): {
  ruleEventType: RuleEventType;
  normalizedPayload: NormalizedEventPayload;
} | null {
  const repository = asObject(payload.repository);

  if (!repository) {
    return null;
  }

  const repositoryId = repository.id;

  if (
    typeof repositoryId !== "number" &&
    typeof repositoryId !== "string"
  ) {
    return null;
  }

  const owner = asObject(repository.owner);
  const ownerLogin = asString(owner?.login);

  const repositoryName = asString(repository.name);
  const fullName = asString(repository.full_name);

  if (!ownerLogin || !repositoryName || !fullName) {
    return null;
  }

  if (eventType === "issues") {
    const issue = asObject(payload.issue);

    if (!issue) {
      return null;
    }

    const number = asNumber(issue.number);
    const title = asString(issue.title);
    const body = asString(issue.body) ?? "";
    const htmlUrl = asString(issue.html_url);

    if (
      number === null ||
      title === null ||
      htmlUrl === null
    ) {
      return null;
    }

    return {
      ruleEventType: "ISSUES",
      normalizedPayload: {
        repository: {
          id: String(repositoryId),
          owner: ownerLogin,
          name: repositoryName,
          fullName,
        },
        item: {
          number,
          title,
          body,
          author: getUserLogin(issue.user),
          labels: getLabels(issue.labels),
          htmlUrl,
        },
      },
    };
  }

  if (eventType === "pull_request") {
    const pullRequest = asObject(payload.pull_request);

    if (!pullRequest) {
      return null;
    }

    const number = asNumber(pullRequest.number);
    const title = asString(pullRequest.title);
    const body = asString(pullRequest.body) ?? "";
    const htmlUrl = asString(pullRequest.html_url);

    if (
      number === null ||
      title === null ||
      htmlUrl === null
    ) {
      return null;
    }

    return {
      ruleEventType: "PULL_REQUEST",
      normalizedPayload: {
        repository: {
          id: String(repositoryId),
          owner: ownerLogin,
          name: repositoryName,
          fullName,
        },
        item: {
          number,
          title,
          body,
          author: getUserLogin(pullRequest.user),
          labels: getLabels(pullRequest.labels),
          htmlUrl,
        },
      },
    };
  }

  return null;
}
