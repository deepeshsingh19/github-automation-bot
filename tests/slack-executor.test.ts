import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const prismaMock = vi.hoisted(() => ({
  event: {
    findUnique: vi.fn(),
  },
}));

const decryptMock = vi.hoisted(() => ({
  decryptSecret: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  prisma: prismaMock,
}));

vi.mock("@/server/crypto/encryption", () => ({
  decryptSecret:
    decryptMock.decryptSecret,
}));

import {
  executeSlackAction,
} from "@/server/actions/slack";

const lockedAt =
  new Date("2026-10-01T10:00:00.000Z");

const payload = {
  repository: {
    id: "repo-1",
    owner: "deepeshsingh19",
    name: "test-repo",
    fullName:
      "deepeshsingh19/test-repo",
  },
  item: {
    number: 42,
    title: "Bug in login",
    body: "Login fails.",
    author: "deepeshsingh19",
    labels: ["bug"],
    htmlUrl:
      "https://github.com/deepeshsingh19/test-repo/issues/42",
  },
};

const webhookUrl =
  "https://hooks.slack.com/services/T000/B000/secret";

function mockEvent(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: "event-1",
    status: "PROCESSING",
    lockedAt,
    payload,
    aiSummary: null,
    aiSuggestedLabel: null,
    aiPriority: null,
    repository: {
      active: true,
      slackWebhookEncrypted:
        "encrypted-secret",
    },
    ...overrides,
  };
}

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

function mockSlack(
  status = 200,
  body = "ok"
) {
  const fetchMock = vi.fn<FetchImplementation>(
    async () =>
      new Response(body, { status })
  );

  vi.stubGlobal(
    "fetch",
    fetchMock
  );

  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Slack action executor", () => {
  it("delivers a Slack notification", async () => {
    prismaMock.event.findUnique.mockResolvedValue(
      mockEvent()
    );

    decryptMock.decryptSecret.mockReturnValue(
      webhookUrl
    );

    const fetchMock =
      mockSlack();

    const result =
      await executeSlackAction(
        "event-1",
        lockedAt
      );

    expect(result).toEqual({
      type: "slack",
      delivered: true,
    });

    expect(
      fetchMock
    ).toHaveBeenCalledTimes(1);

    const [url, options] =
      fetchMock.mock.calls[0];

    expect(url).toBe(
      webhookUrl
    );

    expect(options?.method).toBe(
      "POST"
    );

    expect(
      options?.headers
    ).toEqual({
      "Content-Type":
        "application/json",
    });

    const body = JSON.parse(
      String(options?.body)
    );

    expect(body.text).toContain(
      "GitHub 42: Bug in login"
    );

    expect(body.text).toContain(
      "Repository: deepeshsingh19/test-repo"
    );

    expect(body.text).toContain(
      "Author: deepeshsingh19"
    );

    expect(body.text).toContain(
      "https://github.com/deepeshsingh19/test-repo/issues/42"
    );
  });

  it("includes cached AI triage in the Slack message", async () => {
    prismaMock.event.findUnique.mockResolvedValue(
      mockEvent({
        aiSummary:
          "Authentication fails for valid users.",
        aiSuggestedLabel:
          "bug",
        aiPriority:
          "high",
      })
    );

    decryptMock.decryptSecret.mockReturnValue(
      webhookUrl
    );

    const fetchMock =
      mockSlack();

    await executeSlackAction(
      "event-1",
      lockedAt
    );

    const [, options] =
      fetchMock.mock.calls[0];

    const body = JSON.parse(
      String(options?.body)
    );

    expect(body.text).toContain(
      "AI Summary: Authentication fails for valid users."
    );

    expect(body.text).toContain(
      "Suggested Label: bug"
    );

    expect(body.text).toContain(
      "Priority: high"
    );
  });

  it("rejects an inactive repository", async () => {
    prismaMock.event.findUnique.mockResolvedValue(
      mockEvent({
        repository: {
          active: false,
          slackWebhookEncrypted:
            "encrypted-secret",
        },
      })
    );

    const fetchMock =
      mockSlack();

    await expect(
      executeSlackAction(
        "event-1",
        lockedAt
      )
    ).rejects.toMatchObject({
      kind: "permanent",
    });

    expect(
      fetchMock
    ).not.toHaveBeenCalled();

    expect(
      decryptMock.decryptSecret
    ).not.toHaveBeenCalled();
  });

  it("rejects a missing Slack webhook", async () => {
    prismaMock.event.findUnique.mockResolvedValue(
      mockEvent({
        repository: {
          active: true,
          slackWebhookEncrypted: null,
        },
      })
    );

    const fetchMock =
      mockSlack();

    await expect(
      executeSlackAction(
        "event-1",
        lockedAt
      )
    ).rejects.toMatchObject({
      kind: "permanent",
    });

    expect(
      fetchMock
    ).not.toHaveBeenCalled();
  });

  it("rejects an invalid stored Slack webhook", async () => {
    prismaMock.event.findUnique.mockResolvedValue(
      mockEvent()
    );

    decryptMock.decryptSecret.mockReturnValue(
      "https://evil.example.com/hooks/test"
    );

    const fetchMock =
      mockSlack();

    await expect(
      executeSlackAction(
        "event-1",
        lockedAt
      )
    ).rejects.toMatchObject({
      kind: "permanent",
    });

    expect(
      fetchMock
    ).not.toHaveBeenCalled();
  });

  it("classifies Slack rate limiting as transient", async () => {
    prismaMock.event.findUnique.mockResolvedValue(
      mockEvent()
    );

    decryptMock.decryptSecret.mockReturnValue(
      webhookUrl
    );

    mockSlack(429);

    await expect(
      executeSlackAction(
        "event-1",
        lockedAt
      )
    ).rejects.toMatchObject({
      kind: "transient",
      status: 429,
    });
  });

  it("classifies Slack client errors as permanent", async () => {
    prismaMock.event.findUnique.mockResolvedValue(
      mockEvent()
    );

    decryptMock.decryptSecret.mockReturnValue(
      webhookUrl
    );

    mockSlack(404);

    await expect(
      executeSlackAction(
        "event-1",
        lockedAt
      )
    ).rejects.toMatchObject({
      kind: "permanent",
      status: 404,
    });
  });

  it("classifies an aborted request as transient", async () => {
    prismaMock.event.findUnique.mockResolvedValue(
      mockEvent()
    );

    decryptMock.decryptSecret.mockReturnValue(
      webhookUrl
    );

    const abortError =
      new Error("Request aborted");

    abortError.name =
      "AbortError";

    const fetchMock = vi.fn(
      async () => {
        throw abortError;
      }
    );

    vi.stubGlobal(
      "fetch",
      fetchMock
    );

    await expect(
      executeSlackAction(
        "event-1",
        lockedAt
      )
    ).rejects.toMatchObject({
      kind: "transient",
    });
  });

  it("does not send when the worker lease is lost", async () => {
    prismaMock.event.findUnique.mockResolvedValue(
      mockEvent({
        lockedAt: new Date(
          lockedAt.getTime() + 1000
        ),
      })
    );

    const fetchMock =
      mockSlack();

    await expect(
      executeSlackAction(
        "event-1",
        lockedAt
      )
    ).rejects.toMatchObject({
      kind: "transient",
    });

    expect(
      fetchMock
    ).not.toHaveBeenCalled();
  });
});
