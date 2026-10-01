import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { env } from "@/lib/env";
import { getGithubAuthContextFromCurrentRequest } from "@/server/auth/github-token-context";
import { getDashboardRepositories } from "@/server/repositories/dashboard";
import RepositoryManager from "./RepositoryManager";

export default async function RepositoriesPage() {
  const session =
    await getServerSession(authOptions);

  if (!session?.user.id) {
    return null;
  }

  const githubAuth =
    await getGithubAuthContextFromCurrentRequest();

  if (
    !githubAuth ||
    githubAuth.userId !== session.user.id
  ) {
    return null;
  }

  const groups =
    await getDashboardRepositories(
      session.user.id,
      githubAuth.accessToken
    );

  const repositoryCount =
    groups.reduce(
      (total, group) =>
        total + group.repositories.length,
      0
    );

  const connectedCount =
    groups.reduce(
      (total, group) =>
        total +
        group.repositories.filter(
          (repository) =>
            repository.connected
        ).length,
      0
    );

  const slackCount =
    groups.reduce(
      (total, group) =>
        total +
        group.repositories.filter(
          (repository) =>
            repository.slackConfigured
        ).length,
      0
    );

  const installUrl =
    `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-white/[0.03] blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-500">
              GitHub connections
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Repositories
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
              Choose which repositories your automation bot can process.
              Slack credentials are encrypted and never exposed in the UI.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/dashboard/rules"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Configure rules
              </Link>

              <a
                href={installUrl}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Install / manage GitHub App
              </a>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              ["Accessible", repositoryCount],
              ["Connected", connectedCount],
              ["Slack ready", slackCount],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="min-w-24 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3"
              >
                <p className="text-[11px] text-slate-600">
                  {label}
                </p>

                <p className="mt-1.5 text-xl font-semibold text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RepositoryManager groups={groups} />
    </div>
  );
}
