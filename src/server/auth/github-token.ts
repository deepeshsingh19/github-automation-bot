import "server-only";

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

import { env } from "@/lib/env";

export async function getGithubAccessToken(
  request: NextRequest
): Promise<string | null> {
  const token = await getToken({
    req: request,
    secret: env.AUTH_SECRET,
  });

  if (!token?.githubAccessToken) {
    return null;
  }

  const expiresAt = token.githubAccessTokenExpiresAt;

  if (expiresAt && Date.now() >= expiresAt) {
    return null;
  }

  return token.githubAccessToken;
}
