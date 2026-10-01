import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { env } from "@/lib/env";
import { prisma } from "@/db/client";

function statusLabel(status: string) {
  switch (status) {
    case "DONE":
      return "Completed";
    case "PROCESSING":
      return "Processing";
    case "FAILED":
      return "Failed";
    case "SKIPPED":
      return "Skipped";
    default:
      return "Queued";
  }
}

function statusClass(status: string) {
  switch (status) {
    case "DONE":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "PROCESSING":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "FAILED":
      return "border-rose-400/20 bg-rose-400/10 text-rose-300";
    case "SKIPPED":
      return "border-slate-400/20 bg-slate-400/10 text-slate-300";
    default:
      return "border-sky-400/20 bg-sky-400/10 text-sky-300";
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return null;
  }

  const [
    installations,
    repositories,
    rules,
    events,
    recentEvents,
  ] = await Promise.all([
    prisma.installation.count({
      where: {
        userId: session.user.id,
        active: true,
      },
    }),
    prisma.repository.count({
      where: {
        installation: {
          userId: session.user.id,
        },
        active: true,
      },
    }),
    prisma.rule.count({
      where: {
        repository: {
          installation: {
            userId: session.user.id,
          },
        },
        enabled: true,
      },
    }),
    prisma.event.count({
      where: {
        repository: {
          installation: {
            userId: session.user.id,
          },
        },
      },
    }),
    prisma.event.findMany({
      where: {
        repository: {
          installation: {
            userId: session.user.id,
          },
        },
      },
      orderBy: {
        receivedAt: "desc",
      },
      take: 6,
      select: {
        id: true,
        eventType: true,
        action: true,
        status: true,
        receivedAt: true,
        repository: {
          select: {
            fullName: true,
          },
        },
      },
    }),
  ]);

  const installUrl =
    `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-transparent p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Event-driven automation is running
          </div>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Automate GitHub work without babysitting it.
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Connect repositories, define rules, and let the worker
            handle issues and pull requests with durable retries and
            idempotent actions.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/dashboard/repositories"
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Manage repositories
            </Link>

            <Link
              href="/dashboard/rules"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Create a rule
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Installations",
            value: installations,
            description: "Active GitHub App installs",
          },
          {
            label: "Repositories",
            value: repositories,
            description: "Connected repositories",
          },
          {
            label: "Active rules",
            value: rules,
            description: "Automation rules enabled",
          },
          {
            label: "Events processed",
            value: events,
            description: "Events recorded by the bot",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
          >
            <p className="text-sm text-slate-500">
              {stat.label}
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
              {stat.value}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {stat.description}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Recent activity
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Latest webhook events received by the bot.
              </p>
            </div>

            <Link
              href="/dashboard/events"
              className="text-xs font-medium text-slate-300 transition hover:text-white"
            >
              View all
            </Link>
          </div>

          {recentEvents.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-slate-300">
                No events yet
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Connect a repository and trigger a GitHub issue or PR.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {recentEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/dashboard/events/${event.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-200">
                        {event.repository.fullName}
                      </p>
                      <span className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                        {event.eventType}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      {event.action || "event"} ·{" "}
                      {event.receivedAt.toLocaleString()}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClass(event.status)}`}
                  >
                    {statusLabel(event.status)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Quick setup
          </p>

          <h2 className="mt-3 text-lg font-semibold text-white">
            Get your first automation running.
          </h2>

          <div className="mt-6 space-y-4">
            {[
              ["01", "Install the GitHub App"],
              ["02", "Connect a repository"],
              ["03", "Create an automation rule"],
            ].map(([number, label]) => (
              <div
                key={number}
                className="flex items-center gap-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-slate-400">
                  {number}
                </span>
                <span className="text-sm text-slate-300">
                  {label}
                </span>
              </div>
            ))}
          </div>

          <a
            href={installUrl}
            className="mt-7 block rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Install GitHub App
          </a>
        </div>
      </section>
    </div>
  );
}
