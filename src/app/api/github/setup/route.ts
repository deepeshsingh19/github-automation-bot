import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { env } from "@/lib/env";
import { prisma } from "@/db/client";
import { getGithubAuthContext } from "@/server/auth/github-token-context";
import { verifyGithubInstallation } from "@/server/github/installations";

function buildDashboardRedirect(error?: string) {
  const dashboardUrl = new URL("/dashboard", env.APP_URL);

  if (error) {
    dashboardUrl.searchParams.set("githubError", error);
  }

  return NextResponse.redirect(dashboardUrl);
}

export async function GET(request: NextRequest) {
  const setupAction = request.nextUrl.searchParams.get("setup_action");
  const installationId = request.nextUrl.searchParams.get("installation_id");

  if (!installationId || !/^\d+$/.test(installationId)) {
    return buildDashboardRedirect("invalid_installation");
  }

  const auth = await getGithubAuthContext(request);

  if (!auth) {
    const reauth = request.nextUrl.searchParams.get("reauth");

    if (reauth === "1") {
      return NextResponse.json(
        { error: "GitHub authentication expired" },
        { status: 401 }
      );
    }

    const loginUrl = new URL("/login", env.APP_URL);

    const callbackUrl = new URL(
      "/api/github/setup",
      env.APP_URL
    );

    callbackUrl.searchParams.set("installation_id", installationId);

    if (setupAction) {
      callbackUrl.searchParams.set("setup_action", setupAction);
    }

    loginUrl.searchParams.set(
      "callbackUrl",
      `${callbackUrl.pathname}${callbackUrl.search}`
    );
    loginUrl.searchParams.set("reauth", "1");

    return NextResponse.redirect(loginUrl);
  }

  if (setupAction === "request") {
    return buildDashboardRedirect("installation_pending");
  }

  if (setupAction && setupAction !== "install") {
    return buildDashboardRedirect("unsupported_setup_action");
  }

  let installation;

  try {
    installation = await verifyGithubInstallation(
      auth.accessToken,
      installationId
    );
  } catch {
    return buildDashboardRedirect("installation_verification_failed");
  }

  if (!installation) {
    return buildDashboardRedirect("installation_not_accessible");
  }

  const existing = await prisma.installation.findUnique({
    where: {
      githubId: BigInt(installation.id),
    },
  });

  if (existing && existing.userId !== auth.userId) {
    return buildDashboardRedirect("installation_already_claimed");
  }

  if (existing) {
    await prisma.installation.update({
      where: {
        id: existing.id,
      },
      data: {
        accountLogin: installation.account.login,
        active: true,
        suspended: Boolean(installation.suspended_at),
      },
    });
  } else {
    await prisma.installation.create({
      data: {
        githubId: BigInt(installation.id),
        userId: auth.userId,
        accountLogin: installation.account.login,
        active: true,
        suspended: Boolean(installation.suspended_at),
      },
    });
  }

  return buildDashboardRedirect();
}