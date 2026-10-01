import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

import { env } from "@/lib/env";

export function verifyGithubWebhookSignature(
  rawBody: string,
  signature: string | null
) {
  if (!signature) {
    return false;
  }

  if (!/^sha256=[a-f0-9]{64}$/.test(signature)) {
    return false;
  }

  const expected = `sha256=${createHmac(
    "sha256",
    env.GITHUB_WEBHOOK_SECRET
  )
    .update(rawBody, "utf8")
    .digest("hex")}`;

  const receivedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
