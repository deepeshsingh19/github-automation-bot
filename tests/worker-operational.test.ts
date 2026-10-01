import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const claimEventsMock = vi.hoisted(() =>
  vi.fn()
);

const processEventMock = vi.hoisted(() =>
  vi.fn()
);

vi.mock("@/server/worker/claim-events", () => ({
  claimEvents: claimEventsMock,
}));

vi.mock("@/server/worker/process-event", () => ({
  processEvent: processEventMock,
}));

vi.mock("@/lib/env", () => ({
  env: {
    SWEEP_SECRET: "test-sweep-secret",
  },
}));

import { runOnce } from "@/server/worker/run-once";
import { GET as sweepGET } from "@/app/api/internal/sweep/route";
import { GET as healthGET } from "@/app/api/health/route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("runOnce", () => {
  it("claims and processes events", async () => {
    const events = [
      {
        id: "event-1",
        lockedAt: new Date(
          "2026-10-01T10:00:00.000Z"
        ),
        attempts: 1,
      },
      {
        id: "event-2",
        lockedAt: new Date(
          "2026-10-01T10:00:01.000Z"
        ),
        attempts: 1,
      },
    ];

    claimEventsMock.mockResolvedValue(
      events
    );

    processEventMock.mockResolvedValue(
      undefined
    );

    const result = await runOnce();

    expect(result).toEqual({
      claimed: 2,
      processed: 2,
      skipped: false,
    });

    expect(
      claimEventsMock
    ).toHaveBeenCalledTimes(1);

    expect(
      processEventMock
    ).toHaveBeenCalledTimes(2);

    expect(
      processEventMock
    ).toHaveBeenNthCalledWith(
      1,
      events[0]
    );

    expect(
      processEventMock
    ).toHaveBeenNthCalledWith(
      2,
      events[1]
    );
  });

  it("prevents overlapping worker runs", async () => {
    let releaseClaim!: () => void;

    const blockedClaim =
      new Promise<unknown[]>((resolve) => {
        releaseClaim = () =>
          resolve([]);
      });

    claimEventsMock.mockImplementationOnce(
      () => blockedClaim
    );

    const firstRun =
      runOnce();

    while (
      claimEventsMock.mock.calls.length === 0
    ) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1)
      );
    }

    const secondRun =
      await runOnce();

    expect(secondRun).toEqual({
      claimed: 0,
      processed: 0,
      skipped: true,
    });

    releaseClaim();

    const firstResult =
      await firstRun;

    expect(firstResult).toEqual({
      claimed: 0,
      processed: 0,
      skipped: false,
    });
  });

  it("releases the worker lock after an iteration", async () => {
    claimEventsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const first =
      await runOnce();

    const second =
      await runOnce();

    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(false);

    expect(
      claimEventsMock
    ).toHaveBeenCalledTimes(2);
  });
});

describe("sweep route", () => {
  it("rejects a request with no sweep secret", async () => {
    const request = new Request(
      "https://example.com/api/internal/sweep"
    );

    const response =
      await sweepGET(request);

    expect(response.status).toBe(401);

    expect(
      await response.json()
    ).toEqual({
      error: "Unauthorized",
    });

    expect(
      claimEventsMock
    ).not.toHaveBeenCalled();
  });

  it("rejects an incorrect sweep secret", async () => {
    const request = new Request(
      "https://example.com/api/internal/sweep",
      {
        headers: {
          "x-sweep-secret":
            "wrong-secret",
        },
      }
    );

    const response =
      await sweepGET(request);

    expect(response.status).toBe(401);

    expect(
      await response.json()
    ).toEqual({
      error: "Unauthorized",
    });

    expect(
      claimEventsMock
    ).not.toHaveBeenCalled();
  });

  it("runs the worker with the correct sweep secret", async () => {
    claimEventsMock.mockResolvedValue([
      {
        id: "event-1",
        lockedAt: new Date(),
        attempts: 1,
      },
    ]);

    processEventMock.mockResolvedValue(
      undefined
    );

    const request = new Request(
      "https://example.com/api/internal/sweep",
      {
        headers: {
          "x-sweep-secret":
            "test-sweep-secret",
        },
      }
    );

    const response =
      await sweepGET(request);

    expect(response.status).toBe(200);

    expect(
      await response.json()
    ).toMatchObject({
      ok: true,
      claimed: 1,
      processed: 1,
      skipped: false,
    });
  });
});

describe("health route", () => {
  it("returns a healthy response", async () => {
    const response =
      await healthGET();

    expect(response.status).toBe(200);

    expect(
      await response.json()
    ).toEqual({
      ok: true,
    });
  });
});
