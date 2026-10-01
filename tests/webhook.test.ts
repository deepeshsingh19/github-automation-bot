import { createHmac } from "crypto";

import { describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import { verifyGithubWebhookSignature } from "@/server/github/webhook-security";

function sign(body: string) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET!;

  return `sha256=${createHmac(
    "sha256",
    secret
  )
    .update(body, "utf8")
    .digest("hex")}`;
}

function makeRequest(
  body: string,
  event: string,
  deliveryId: string,
  signature = sign(body)
) {
  return new Request(
    "http://localhost:3000/api/webhooks/github",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": event,
        "x-github-delivery": deliveryId,
        "x-hub-signature-256": signature,
      },
      body,
    }
  );
}

async function postWebhook(
  body: string,
  event: string,
  deliveryId: string,
  signature = sign(body)
) {
  const { POST } = await import(
    "@/app/api/webhooks/github/route"
  );

  return POST(
    makeRequest(
      body,
      event,
      deliveryId,
      signature
    )
  );
}

function issuePayload(
  repositoryId: number,
  installationId: number
) {
  return {
    action: "opened",
    installation: {
      id: installationId,
    },
    repository: {
      id: repositoryId,
      name: "test-repo",
      full_name: "deepeshsingh19/test-repo",
      owner: {
        login: "deepeshsingh19",
      },
    },
    issue: {
      number: 10,
      title: "Bug: login fails",
      body: "Login is broken.",
      html_url:
        "https://github.com/deepeshsingh19/test-repo/issues/10",
      user: {
        login: "deepesh",
      },
      labels: [
        {
          name: "bug",
        },
      ],
    },
  };
}

async function createRepository() {
  const user = await prisma.user.create({
    data: {
      githubId: "github-test-user",
      githubLogin: "deepeshsingh19",
    },
  });

  const installation = await prisma.installation.create({
    data: {
      githubId: BigInt(9000001),
      userId: user.id,
      accountLogin: "deepeshsingh19",
    },
  });

  const repository = await prisma.repository.create({
    data: {
      githubRepoId: BigInt(8000001),
      installationId: installation.id,
      owner: "deepeshsingh19",
      name: "test-repo",
      fullName: "deepeshsingh19/test-repo",
    },
  });

  return {
    user,
    installation,
    repository,
  };
}

describe("GitHub webhook security", () => {
  it("ignores events for a disconnected repository", async () => {
  const { installation, repository } =
    await createRepository();

  await prisma.repository.update({
    where: {
      id: repository.id,
    },
    data: {
      active: false,
    },
  });

  const body = JSON.stringify(
    issuePayload(
      Number(repository.githubRepoId),
      Number(installation.githubId)
    )
  );

  const response = await postWebhook(
    body,
    "issues",
    "delivery-disconnected-repo"
  );

  expect(response.status).toBe(200);

  const event = await prisma.event.findUnique({
    where: {
      githubDeliveryId: "delivery-disconnected-repo",
    },
  });

  expect(event).toBeNull();
});

  it("accepts a valid signature", () => {
    const body = JSON.stringify({
      hello: "world",
    });

    expect(
      verifyGithubWebhookSignature(
        body,
        sign(body)
      )
    ).toBe(true);
  });

  it("rejects a forged signature", () => {
    const body = JSON.stringify({
      hello: "world",
    });

    expect(
      verifyGithubWebhookSignature(
        body,
        "sha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      )
    ).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(
      verifyGithubWebhookSignature(
        "{}",
        null
      )
    ).toBe(false);
  });
});

describe("GitHub webhook route", () => {
  it("ignores issue label events", async () => {
    const { installation, repository } =
      await createRepository();

    const body = JSON.stringify({
      ...issuePayload(
        Number(repository.githubRepoId),
        Number(installation.githubId)
      ),
      action: "labeled",
    });

    const response = await postWebhook(
      body,
      "issues",
      "delivery-labeled-1"
    );

    expect(response.status).toBe(200);

    const result = await response.json();

    expect(result).toEqual({
      ok: true,
      ignored: true,
    });

    const event = await prisma.event.findUnique({
      where: {
        githubDeliveryId:
          "delivery-labeled-1",
      },
    });

    expect(event).toBeNull();
  });

  it("ignores pull request label events", async () => {
    const { installation, repository } =
      await createRepository();

    const body = JSON.stringify({
      action: "labeled",
      installation: {
        id: Number(installation.githubId),
      },
      repository: {
        id: Number(repository.githubRepoId),
        name: "test-repo",
        full_name:
          "deepeshsingh19/test-repo",
        owner: {
          login: "deepeshsingh19",
        },
      },
      pull_request: {
        number: 11,
        title: "Feature test",
        body: "Test PR",
        html_url:
          "https://github.com/deepeshsingh19/test-repo/pull/11",
        user: {
          login: "deepesh",
        },
        labels: [],
      },
    });

    const response = await postWebhook(
      body,
      "pull_request",
      "delivery-pr-labeled-1"
    );

    expect(response.status).toBe(200);

    const result = await response.json();

    expect(result).toEqual({
      ok: true,
      ignored: true,
    });

    const event = await prisma.event.findUnique({
      where: {
        githubDeliveryId:
          "delivery-pr-labeled-1",
      },
    });

    expect(event).toBeNull();
  });

  it("rejects a forged webhook without creating an event", async () => {
    const body = JSON.stringify({
      hello: "world",
    });

    const response = await postWebhook(
      body,
      "issues",
      "delivery-forged",
      "sha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );

    expect(response.status).toBe(401);

    const event = await prisma.event.findUnique({
      where: {
        githubDeliveryId: "delivery-forged",
      },
    });

    expect(event).toBeNull();
  });

  it("queues a valid issue event", async () => {
    const { installation, repository } =
      await createRepository();

    const body = JSON.stringify(
      issuePayload(
        Number(repository.githubRepoId),
        Number(installation.githubId)
      )
    );

    const response = await postWebhook(
      body,
      "issues",
      "delivery-issue-1"
    );

    expect(response.status).toBe(200);

    const event = await prisma.event.findUnique({
      where: {
        githubDeliveryId: "delivery-issue-1",
      },
    });

    expect(event).not.toBeNull();
    expect(event?.repositoryId).toBe(repository.id);
    expect(event?.status).toBe("PENDING");
    expect(event?.eventType).toBe("issues");
    expect(event?.action).toBe("opened");

    expect(event?.payload).toEqual({
      repository: {
        id: String(repository.githubRepoId),
        owner: "deepeshsingh19",
        name: "test-repo",
        fullName: "deepeshsingh19/test-repo",
      },
      item: {
        number: 10,
        title: "Bug: login fails",
        body: "Login is broken.",
        author: "deepesh",
        labels: ["bug"],
        htmlUrl:
          "https://github.com/deepeshsingh19/test-repo/issues/10",
      },
    });
  });

  it("does not create a duplicate event", async () => {
    const { installation, repository } =
      await createRepository();

    const body = JSON.stringify(
      issuePayload(
        Number(repository.githubRepoId),
        Number(installation.githubId)
      )
    );

    const first = await postWebhook(
      body,
      "issues",
      "delivery-duplicate-1"
    );

    const second = await postWebhook(
      body,
      "issues",
      "delivery-duplicate-1"
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const count = await prisma.event.count({
      where: {
        githubDeliveryId: "delivery-duplicate-1",
      },
    });

    expect(count).toBe(1);
  });

  it("acknowledges an unknown repository without creating an event", async () => {
    const body = JSON.stringify(
      issuePayload(99999999, 99999998)
    );

    const response = await postWebhook(
      body,
      "issues",
      "delivery-unknown-repo"
    );

    expect(response.status).toBe(200);

    const count = await prisma.event.count();

    expect(count).toBe(0);
  });

  it("acknowledges ping", async () => {
    const body = JSON.stringify({
      zen: "Keep it logically awesome.",
    });

    const response = await postWebhook(
      body,
      "ping",
      "delivery-ping"
    );

    expect(response.status).toBe(200);

    const result = await response.json();

    expect(result).toEqual({
      ok: true,
      event: "ping",
    });
  });
});
