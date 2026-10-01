import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

import { env } from "@/lib/env";
import { runOnce } from "@/server/worker/run-once";

export const runtime = "nodejs";

function safeSecretCompare(
  expected: string,
  received: string | null
) {
  if (!received) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}

export async function GET(request: Request) {
  const receivedSecret = request.headers.get(
    "x-sweep-secret"
  );

  if (
    !safeSecretCompare(
      env.SWEEP_SECRET,
      receivedSecret
    )
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const stats = await runOnce();

  return NextResponse.json({
    ok: true,
    ...stats,
  });
}
