import "server-only";

import { createAppAuth } from "@octokit/auth-app";

import { env } from "@/lib/env";

type CachedToken = {
  token: string;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
};

const tokenCache = new Map<string, CachedToken>();

const REFRESH_BUFFER_MS = 60_000;

const appAuth = createAppAuth({
  appId: Number(env.GITHUB_APP_ID),
  privateKey: env.GITHUB_APP_PRIVATE_KEY,
});

function validateInstallationId(installationId: string) {
  if (!/^\d+$/.test(installationId)) {
    throw new Error("Invalid installation ID");
  }
}

export async function getInstallationAccessToken(
  installationId: string
) {
  validateInstallationId(installationId);

  const cached = tokenCache.get(installationId);

  if (
    cached &&
    Date.now() < cached.expiresAt - REFRESH_BUFFER_MS
  ) {
    return cached.token;
  }

  if (cached) {
    clearTimeout(cached.timer);
    tokenCache.delete(installationId);
  }

  const authentication = await appAuth({
    type: "installation",
    installationId: Number(installationId),
  });

  const expiresAt = new Date(
    authentication.expiresAt
  ).getTime();

  const ttl = Math.max(
    expiresAt - Date.now() - REFRESH_BUFFER_MS,
    1_000
  );

  const timer = setTimeout(() => {
    const current = tokenCache.get(
      installationId
    );

    if (current?.token === authentication.token) {
      tokenCache.delete(installationId);
    }
  }, ttl);

  timer.unref?.();

  tokenCache.set(installationId, {
    token: authentication.token,
    expiresAt,
    timer,
  });

  return authentication.token;
}
