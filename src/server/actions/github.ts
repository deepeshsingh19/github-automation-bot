import "server-only";

import {
  ruleActionsSchema,
  type RuleAction,
} from "@/server/rules/action-schema";
import type { NormalizedEventPayload } from "@/server/rules/engine";
import { githubAppRequest } from "@/server/github/client";

type GithubActionContext = {
  eventId: string;
  actionKey: string;
  installationId: string;
  payload: NormalizedEventPayload;
  ruleActions: unknown;
  actionType: "ADD_LABEL" | "COMMENT";
};

type GithubComment = {
  id: number;
  body: string | null;
};

function getValidatedActions(
  actions: unknown
): RuleAction[] {
  const parsed =
    ruleActionsSchema.safeParse(actions);

  if (!parsed.success) {
    throw new Error(
      "Stored rule actions are invalid"
    );
  }

  return parsed.data;
}

function getActionDefinition(
  actionType: "ADD_LABEL" | "COMMENT",
  actionKey: string,
  actions: unknown
): RuleAction {
  const parsedActions =
    getValidatedActions(actions);

  if (actionType === "ADD_LABEL") {
    const match =
      parsedActions.find(
        (action) =>
          action.type === "addLabel" &&
          actionKey.endsWith(
            `:add_label:${action.label}`
          )
      );

    if (!match) {
      throw new Error(
        "Add-label action definition not found"
      );
    }

    return match;
  }

  const commentAction =
    parsedActions.find(
      (action) =>
        action.type === "comment"
    );

  if (!commentAction) {
    throw new Error(
      "Comment action definition not found"
    );
  }

  return commentAction;
}

function encodePathSegment(
  value: string
) {
  return encodeURIComponent(value);
}

function repositoryPath(
  payload: NormalizedEventPayload
) {
  return `/repos/${encodePathSegment(
    payload.repository.owner
  )}/${encodePathSegment(
    payload.repository.name
  )}`;
}

function issuePath(
  payload: NormalizedEventPayload
) {
  return `${repositoryPath(
    payload
  )}/issues/${payload.item.number}`;
}

function commentMarker(
  eventId: string,
  actionKey: string
) {
  return `<!-- bot:${eventId}:${actionKey} -->`;
}

function getNextLink(
  linkHeader: string | null
) {
  if (!linkHeader) {
    return null;
  }

  const links = linkHeader.split(",");

  for (const link of links) {
    const rel = link.match(
      /;\s*rel="next"/
    );

    if (!rel) {
      continue;
    }

    const start = link.indexOf("<");
    const end = link.indexOf(">");

    if (
      start === -1 ||
      end === -1 ||
      end <= start + 1
    ) {
      return null;
    }

    return link.slice(
      start + 1,
      end
    );
  }

  return null;
}

async function findExistingComment(
  installationId: string,
  payload: NormalizedEventPayload,
  marker: string
) {
  let nextUrl =
    `${issuePath(
      payload
    )}/comments?per_page=100&page=1`;

  for (let page = 1; page <= 20; page += 1) {
    const result =
      await githubAppRequest<GithubComment[]>(
        installationId,
        nextUrl
      );

    const existing =
      result.data.find(
        (comment) =>
          typeof comment.body === "string" &&
          comment.body.includes(marker)
      );

    if (existing) {
      return existing;
    }

    const nextLink =
      getNextLink(
        result.headers.get("link")
      );

    if (!nextLink) {
      return null;
    }

    const nextUrlObject =
      new URL(nextLink);

    if (
      nextUrlObject.origin !==
      "https://api.github.com"
    ) {
      throw new Error(
        "GitHub pagination URL has an invalid origin"
      );
    }

    nextUrl =
      nextUrlObject.toString();
  }

  throw new Error(
    "GitHub comments pagination limit exceeded"
  );
}

async function addLabel(
  context: GithubActionContext,
  label: string
) {
  await githubAppRequest(
    context.installationId,
    `${issuePath(
      context.payload
    )}/labels`,
    {
      method: "POST",
      body: JSON.stringify({
        labels: [label],
      }),
    }
  );

  return {
    type: "github",
    action: "addLabel",
    label,
  };
}

async function addComment(
  context: GithubActionContext,
  body: string
) {
  const marker =
    commentMarker(
      context.eventId,
      context.actionKey
    );

  const existing =
    await findExistingComment(
      context.installationId,
      context.payload,
      marker
    );

  if (existing) {
    return {
      type: "github",
      action: "comment",
      commentId: String(
        existing.id
      ),
      deduplicated: true,
    };
  }

  const commentBody =
    `${body}\n\n${marker}`;

  const result =
    await githubAppRequest<{
      id: number;
      html_url?: string;
    }>(
      context.installationId,
      `${issuePath(
        context.payload
      )}/comments`,
      {
        method: "POST",
        body: JSON.stringify({
          body: commentBody,
        }),
      }
    );

  return {
    type: "github",
    action: "comment",
    commentId: String(
      result.data.id
    ),
    htmlUrl:
      result.data.html_url ??
      null,
  };
}

export async function executeGithubAction(
  context: GithubActionContext
) {
  const definition =
    getActionDefinition(
      context.actionType,
      context.actionKey,
      context.ruleActions
    );

  if (
    definition.type ===
    "addLabel"
  ) {
    return addLabel(
      context,
      definition.label
    );
  }

  if (
    definition.type ===
    "comment"
  ) {
    return addComment(
      context,
      definition.body
    );
  }

  throw new Error(
    "Invalid GitHub action definition"
  );
}
