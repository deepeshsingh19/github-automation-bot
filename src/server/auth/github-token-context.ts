import "server-only";

import { headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

import { env } from "@/lib/env";

export type GithubAuthContext = {
  userId: string;
  githubId: string;
  githubLogin: string;
  accessToken: string;
};

export async function getGithubAuthContext(
  request: NextRequest
): Promise<GithubAuthContext | null> {
  const token = await getToken({
    req: request,
    secret: env.AUTH_SECRET,
  });

  if (
    !token?.userId ||
    !token.githubId ||
    !token.githubLogin ||
    !token.githubAccessToken
  ) {
    return null;
  }

  const expiresAt = token.githubAccessTokenExpiresAt;

  if (expiresAt && Date.now() >= expiresAt) {
    return null;
  }

  return {
    userId: token.userId,
    githubId: token.githubId,
    githubLogin: token.githubLogin,
    accessToken: token.githubAccessToken,
  };
}

export async function getGithubAuthContextFromCurrentRequest() {
  const requestHeaders = await headers();

  const request = new NextRequest("http://localhost", {
    headers: requestHeaders,
  });

  return getGithubAuthContext(request);
}
