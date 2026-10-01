import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { env } from "@/lib/env";
import { prisma } from "@/db/client";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return null;
  }

  const installations = await prisma.installation.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      githubId: true,
      accountLogin: true,
      active: true,
      suspended: true,
      createdAt: true,
    },
  });

  const installUrl = `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`;

  return (
    <main>
      <h1>GitHub Automation Bot</h1>

      <p>Signed in as @{session.user.githubLogin}</p>

      <p>
        <a href={installUrl}>Install GitHub App</a>
      </p>

      <h2>GitHub installations</h2>

      {installations.length === 0 ? (
        <p>No GitHub App installations connected.</p>
      ) : (
        <ul>
          {installations.map((installation) => (
            <li key={installation.id}>
              <strong>{installation.accountLogin}</strong>{" "}
              {installation.suspended
                ? "(suspended)"
                : installation.active
                  ? "(active)"
                  : "(inactive)"}
              {" — "}
              Installation ID: {installation.githubId.toString()}
            </li>
          ))}
        </ul>
      )}

      <nav>
        <Link href="/dashboard/repositories">Repositories</Link>
        {" | "}
        <Link href="/dashboard/rules">Rules</Link>
        {" | "}
        <Link href="/dashboard/events">Events</Link>
      </nav>
    </main>
  );
}
