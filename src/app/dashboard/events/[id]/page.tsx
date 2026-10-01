import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { prisma } from "@/db/client";

function statusClass(status: string) {
  switch (status) {
    case "DONE":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "PROCESSING":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "FAILED":
      return "border-rose-400/20 bg-rose-400/10 text-rose-300";
    case "SKIPPED":
      return "border-slate-400/20 bg-slate-400/10 text-slate-400";
    default:
      return "border-sky-400/20 bg-sky-400/10 text-sky-300";
  }
}

function actionClass(status: string) {
  switch (status) {
    case "SUCCESS":
      return "text-emerald-300";
    case "FAILED":
      return "text-rose-300";
    case "PROCESSING":
      return "text-amber-300";
    default:
      return "text-slate-400";
  }
}

function formatEventType(eventType: string) {
  return eventType === "pull_request"
    ? "Pull request"
    : "Issue";
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    notFound();
  }

  const { id } = await params;

  const event = await prisma.event.findFirst({
    where: {
      id,
      repository: {
        installation: {
          userId: session.user.id,
        },
      },
    },
    select: {
      id: true,
      eventType: true,
      action: true,
      status: true,
      attempts: true,
      nextRetryAt: true,
      lastError: true,
      payload: true,
      aiSummary: true,
      aiSuggestedLabel: true,
      aiPriority: true,
      receivedAt: true,
      processedAt: true,
      repository: {
        select: {
          fullName: true,
          owner: true,
          name: true,
        },
      },
      actions: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          actionType: true,
          actionKey: true,
          status: true,
          error: true,
          response: true,
          createdAt: true,
          completedAt: true,
          rule: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!event) {
    notFound();
  }

  const payload =
    typeof event.payload === "object" &&
    event.payload !== null
      ? (event.payload as {
          item?: {
            number?: number;
            title?: string;
            body?: string;
            author?: string;
            labels?: string[];
            htmlUrl?: string;
          };
        })
      : null;

  const item = payload?.item;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/events"
          className="text-xs font-medium text-slate-500 transition hover:text-white"
        >
          ← Back to events
        </Link>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {formatEventType(event.eventType)}
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {event.action || "webhook"}
              </span>

              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusClass(
                  event.status
                )}`}
              >
                {event.status}
              </span>
            </div>

            <h1 className="mt-4 break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {item?.title || "GitHub event"}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {event.repository.fullName}
              {item?.number
                ? ` · #${item.number}`
                : ""}
            </p>
          </div>

          {item?.htmlUrl && (
            <a
              href={item.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              Open on GitHub ↗
            </a>
          )}
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Received", event.receivedAt.toLocaleString()],
            [
              "Processed",
              event.processedAt
                ? event.processedAt.toLocaleString()
                : "Not processed",
            ],
            ["Attempts", String(event.attempts)],
            [
              "Actions",
              String(event.actions.length),
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3"
            >
              <p className="text-[11px] text-slate-600">
                {label}
              </p>
              <p className="mt-1.5 truncate text-sm font-medium text-slate-300">
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 px-5 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-white">
              Action execution
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Durable actions created for this event.
            </p>
          </div>

          {event.actions.length === 0 ? (
            <div className="px-5 py-10 text-center sm:px-6">
              <p className="text-sm text-slate-400">
                No matching actions were created.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {event.actions.map((action, index) => (
                <div
                  key={action.id}
                  className="px-5 py-5 sm:px-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-slate-500">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-200">
                            {action.actionType}
                          </p>

                          <p className="mt-1 break-all font-mono text-[11px] text-slate-600">
                            {action.actionKey}
                          </p>
                        </div>

                        <span
                          className={`text-xs font-medium ${actionClass(
                            action.status
                          )}`}
                        >
                          {action.status}
                        </span>
                      </div>

                      {action.rule && (
                        <p className="mt-3 text-xs text-slate-500">
                          Rule:{" "}
                          <span className="text-slate-400">
                            {action.rule.name}
                          </span>
                        </p>
                      )}

                      {action.error && (
                        <div className="mt-3 rounded-xl border border-rose-400/15 bg-rose-400/5 px-3 py-2 text-xs leading-5 text-rose-300">
                          {action.error}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-600">
                        <span>
                          Created{" "}
                          {action.createdAt.toLocaleString()}
                        </span>

                        {action.completedAt && (
                          <span>
                            Completed{" "}
                            {action.completedAt.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6">
          {event.aiSummary && (
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
                AI triage
              </p>

              <h2 className="mt-2 text-lg font-semibold text-white">
                Triage result
              </h2>

              <p className="mt-4 text-sm leading-6 text-slate-400">
                {event.aiSummary}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {event.aiSuggestedLabel && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                    {event.aiSuggestedLabel}
                  </span>
                )}

                {event.aiPriority && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                    Priority: {event.aiPriority}
                  </span>
                )}
              </div>
            </section>
          )}

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
              Event payload
            </p>

            <div className="mt-5 space-y-4">
              {[
                ["Author", item?.author || "Unknown"],
                [
                  "Labels",
                  item?.labels?.length
                    ? item.labels.join(", ")
                    : "None",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[11px] text-slate-600">
                    {label}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {item?.body && (
              <div className="mt-5 border-t border-white/10 pt-5">
                <p className="text-[11px] text-slate-600">
                  Body
                </p>

                <div className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-slate-400">
                  {item.body}
                </div>
              </div>
            )}

            {event.lastError && (
              <div className="mt-5 border-t border-white/10 pt-5">
                <p className="text-[11px] text-slate-600">
                  Last error
                </p>

                <p className="mt-2 rounded-xl border border-rose-400/15 bg-rose-400/5 px-3 py-2.5 text-xs leading-5 text-rose-300">
                  {event.lastError}
                </p>
              </div>
            )}

            {event.nextRetryAt && (
              <div className="mt-5 border-t border-white/10 pt-5">
                <p className="text-[11px] text-slate-600">
                  Next retry
                </p>

                <p className="mt-1 text-sm text-slate-300">
                  {event.nextRetryAt.toLocaleString()}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
