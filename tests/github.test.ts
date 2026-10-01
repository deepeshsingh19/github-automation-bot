import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@octokit/auth-app", () => ({
  createAppAuth: vi.fn(() => {
    return vi.fn(async () => ({
      token: "test-installation-token",
      expiresAt: new Date(
        Date.now() + 60 * 60 * 1000
      ).toISOString(),
    }));
  }),
}));

import {
  executeGithubAction,
} from "@/server/actions/github";

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

afterEach(() => {
  vi.unstubAllGlobals();
});

type Payload = {
  repository: {
    id: string;
    owner: string;
    name: string;
    fullName: string;
  };
  item: {
    number: number;
    title: string;
    body: string;
    author: string;
    labels: string[];
    htmlUrl: string;
  };
};

const payload: Payload = {
  repository: {
    id: "123",
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
    labels: [],
    htmlUrl:
      "https://github.com/deepeshsingh19/test-repo/issues/42",
  },
};

function mockFetch(
  implementation: FetchImplementation
) {
  vi.stubGlobal("fetch", implementation);
}

describe("GitHub action executor", () => {
  it("adds a label", async () => {
    const fetchMock = vi.fn<FetchImplementation>(
      async () =>
        new Response(
          JSON.stringify([
            {
              name: "bug",
            },
          ]),
          {
            status: 200,
            headers: {
              "content-type":
                "application/json",
            },
          }
        )
    );

    mockFetch(
      fetchMock as unknown as FetchImplementation
    );

    const result =
      await executeGithubAction({
        eventId: "event-1",
        actionKey:
          "rule:rule-1:add_label:bug",
        installationId: "12345",
        payload,
        ruleActions: [
          {
            type: "addLabel",
            label: "bug",
          },
        ],
        actionType: "ADD_LABEL",
      });

    expect(result).toEqual({
      type: "github",
      action: "addLabel",
      label: "bug",
    });

    expect(
      fetchMock
    ).toHaveBeenCalledTimes(1);

    const [url, options] =
      fetchMock.mock.calls[0];

    expect(String(url)).toBe(
      "https://api.github.com/repos/deepeshsingh19/test-repo/issues/42/labels"
    );

    expect(
      (
        options?.headers as Record<
          string,
          string
        >
      ).Authorization
    ).toBe(
      "Bearer test-installation-token"
    );

    expect(options?.method).toBe("POST");

    expect(options?.body).toBe(
      JSON.stringify({
        labels: ["bug"],
      })
    );
  });

  it("does not duplicate a comment when the marker already exists", async () => {
    const marker =
      "<!-- bot:event-2:rule:rule-2:comment -->";

    const fetchMock = vi.fn<FetchImplementation>(
      async () =>
        new Response(
          JSON.stringify([
            {
              id: 555,
              body: `Thanks.\n\n${marker}`,
            },
          ]),
          {
            status: 200,
            headers: {
              "content-type":
                "application/json",
            },
          }
        )
    );

    mockFetch(
      fetchMock as unknown as FetchImplementation
    );

    const result =
      await executeGithubAction({
        eventId: "event-2",
        actionKey:
          "rule:rule-2:comment",
        installationId: "12345",
        payload,
        ruleActions: [
          {
            type: "comment",
            body: "Thanks.",
          },
        ],
        actionType: "COMMENT",
      });

    expect(result).toEqual({
      type: "github",
      action: "comment",
      commentId: "555",
      deduplicated: true,
    });

    expect(
      fetchMock
    ).toHaveBeenCalledTimes(1);
  });

  it("creates a comment when the marker does not exist", async () => {
    const responses = [
      new Response(
        JSON.stringify([]),
        {
          status: 200,
          headers: {
            "content-type":
              "application/json",
          },
        }
      ),
      new Response(
        JSON.stringify({
          id: 999,
          html_url:
            "https://github.com/deepeshsingh19/test-repo/issues/42#issuecomment-999",
        }),
        {
          status: 201,
          headers: {
            "content-type":
              "application/json",
          },
        }
      ),
    ];

    const fetchMock = vi.fn<FetchImplementation>(
      async () => {
        const response =
          responses.shift();

        if (!response) {
          throw new Error(
            "Unexpected fetch"
          );
        }

        return response;
      }
    );

    mockFetch(
      fetchMock as unknown as FetchImplementation
    );

    const result =
      await executeGithubAction({
        eventId: "event-3",
        actionKey:
          "rule:rule-3:comment",
        installationId: "12345",
        payload,
        ruleActions: [
          {
            type: "comment",
            body: "Thanks.",
          },
        ],
        actionType: "COMMENT",
      });

    expect(result).toEqual({
      type: "github",
      action: "comment",
      commentId: "999",
      htmlUrl:
        "https://github.com/deepeshsingh19/test-repo/issues/42#issuecomment-999",
    });

    expect(
      fetchMock
    ).toHaveBeenCalledTimes(2);

    const [, options] =
      fetchMock.mock.calls[1];

    expect(options?.method).toBe(
      "POST"
    );

    expect(options?.body).toBe(
      JSON.stringify({
        body:
          "Thanks.\n\n<!-- bot:event-3:rule:rule-3:comment -->",
      })
    );
  });

  it("follows comment pagination", async () => {
    const firstPage = new Response(
      JSON.stringify([
        {
          id: 100,
          body: "unrelated comment",
        },
      ]),
      {
        status: 200,
        headers: {
          "content-type":
            "application/json",
          link:
            '<https://api.github.com/repos/deepeshsingh19/test-repo/issues/42/comments?per_page=100&page=2>; rel="next"',
        },
      }
    );

    const secondPage = new Response(
      JSON.stringify([
        {
          id: 777,
          body:
            "hello\\n\\n<!-- bot:event-4:rule:rule-4:comment -->",
        },
      ]),
      {
        status: 200,
        headers: {
          "content-type":
            "application/json",
        },
      }
    );

    let callCount = 0;

    const fetchMock = vi.fn<FetchImplementation>(
      async (
        input: RequestInfo | URL,
        options?: RequestInit
      ) => {
        callCount += 1;

        if (callCount === 1) {
          return firstPage;
        }

        if (callCount === 2) {
          expect(String(input)).toContain(
            "page=2"
          );

          void options;

          return secondPage;
        }

        throw new Error(
          "Unexpected fetch call"
        );
      }
    );

    mockFetch(
      fetchMock as unknown as FetchImplementation
    );

    const result =
      await executeGithubAction({
        eventId: "event-4",
        actionKey:
          "rule:rule-4:comment",
        installationId: "12345",
        payload,
        ruleActions: [
          {
            type: "comment",
            body: "hello",
          },
        ],
        actionType: "COMMENT",
      });

    expect(result).toEqual({
      type: "github",
      action: "comment",
      commentId: "777",
      deduplicated: true,
    });

    expect(
      fetchMock
    ).toHaveBeenCalledTimes(2);
  });
});

describe("GitHub action error handling", () => {
  it("classifies a 429 as transient", async () => {
    const fetchMock = vi.fn<FetchImplementation>(
      async () =>
        new Response(
          JSON.stringify({
            message: "rate limited",
          }),
          {
            status: 429,
            headers: {
              "content-type":
                "application/json",
            },
          }
        )
    );

    mockFetch(
      fetchMock as unknown as FetchImplementation
    );

    await expect(
      executeGithubAction({
        eventId: "event-5",
        actionKey:
          "rule:rule-5:add_label:bug",
        installationId: "12345",
        payload,
        ruleActions: [
          {
            type: "addLabel",
            label: "bug",
          },
        ],
        actionType: "ADD_LABEL",
      })
    ).rejects.toMatchObject({
      kind: "transient",
      status: 429,
    });
  });

  it("classifies a 404 as permanent", async () => {
    const fetchMock = vi.fn<FetchImplementation>(
      async () =>
        new Response(
          JSON.stringify({
            message: "not found",
          }),
          {
            status: 404,
            headers: {
              "content-type":
                "application/json",
            },
          }
        )
    );

    mockFetch(
      fetchMock as unknown as FetchImplementation
    );

    await expect(
      executeGithubAction({
        eventId: "event-6",
        actionKey:
          "rule:rule-6:add_label:bug",
        installationId: "12345",
        payload,
        ruleActions: [
          {
            type: "addLabel",
            label: "bug",
          },
        ],
        actionType: "ADD_LABEL",
      })
    ).rejects.toMatchObject({
      kind: "permanent",
      status: 404,
    });
  });
});
