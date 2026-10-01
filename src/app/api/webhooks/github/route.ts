import { NextResponse } from "next/server";

import { prisma } from "@/db/client";
import {
  getGithubInstallationId,
  normalizeGithubEvent,
} from "@/server/github/webhook-payload";
import { verifyGithubWebhookSignature } from "@/server/github/webhook-security";
import { handleGithubLifecycleEvent } from "@/server/github/webhook-lifecycle";
import { isSupportedGithubTrigger } from "@/server/github/webhook-events";


export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();

  const signature = request.headers.get(
    "x-hub-signature-256"
  );

  if (!verifyGithubWebhookSignature(rawBody, signature)) {
    return NextResponse.json(
      {
        error: "Invalid webhook signature",
      },
      {
        status: 401,
      }
    );
  }

  const deliveryId = request.headers.get(
    "x-github-delivery"
  );

  const eventType = request.headers.get(
    "x-github-event"
  );

  if (!deliveryId || !eventType) {
    return NextResponse.json(
      {
        error: "Missing GitHub webhook headers",
      },
      {
        status: 400,
      }
    );
  }

  if (eventType === "ping") {
    return NextResponse.json({
      ok: true,
      event: "ping",
    });
  }

  let payload: Record<string, unknown>;

  try {
    const parsed = JSON.parse(rawBody);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return NextResponse.json(
        {
          error: "Invalid webhook payload",
        },
        {
          status: 400,
        }
      );
    }

    payload = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid webhook JSON",
      },
      {
        status: 400,
      }
    );
  }

  const actionValue = payload.action;
  const action =
    typeof actionValue === "string"
      ? actionValue
      : null;

  const lifecycleResult =
    await handleGithubLifecycleEvent(
      eventType,
      action,
      payload
    );

  if (lifecycleResult.handled) {
    return NextResponse.json({
      ok: true,
      handled: true,
    });
  }

  if (
    (eventType === "issues" ||
      eventType === "pull_request") &&
    !isSupportedGithubTrigger(
      eventType,
      action
    )
  ) {
    return NextResponse.json({
      ok: true,
      ignored: true,
    });
  }

  if (
    eventType !== "issues" &&
    eventType !== "pull_request"
  ) {
    return NextResponse.json({
      ok: true,
      ignored: true,
    });
  }

  const normalized = normalizeGithubEvent(
    eventType,
    payload
  );

  if (!normalized) {
    return NextResponse.json(
      {
        error: "Malformed supported webhook payload",
      },
      {
        status: 400,
      }
    );
  }

  const installationId =
    getGithubInstallationId(payload);

  if (!installationId) {
    return NextResponse.json(
      {
        error: "Missing installation ID",
      },
      {
        status: 400,
      }
    );
  }

  const githubRepoId = BigInt(
    normalized.normalizedPayload.repository.id
  );

  const repository = await prisma.repository.findFirst({
    where: {
      githubRepoId,
      active: true,
      installation: {
        githubId: BigInt(installationId),
        active: true,
        suspended: false,
      },
    },
    select: {
      id: true,
    },
  });

  if (!repository) {
    return NextResponse.json({
      ok: true,
      ignored: true,
    });
  }

  const result = await prisma.event.createMany({
  data: [
    {
      repositoryId: repository.id,
      githubDeliveryId: deliveryId,
      eventType,
      action,
      payload: normalized.normalizedPayload,
      status: "PENDING",
    },
  ],
  skipDuplicates: true,
});

if (result.count === 0) {
  return NextResponse.json({
    ok: true,
    duplicate: true,
  });
}

return NextResponse.json({
  ok: true,
  queued: true,
});

  return NextResponse.json({
    ok: true,
    queued: true,
  });
}
