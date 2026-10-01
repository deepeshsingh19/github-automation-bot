import Link from "next/link";
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

function eventLabel(
  eventType: string
) {
  return eventType === "pull_request"
    ? "Pull request"
    : "Issue";
}

export default async function EventsPage() {
  const session =
    await getServerSession(
      authOptions
    );

  if (!session?.user.id) {
    return null;
  }

  const events =
    await prisma.event.findMany({
      where: {
        repository: {
          installation: {
            userId:
              session.user.id,
          },
        },
      },
      orderBy: {
        receivedAt: "desc",
      },
      take: 100,
      select: {
        id: true,
        eventType: true,
        action: true,
        status: true,
        attempts: true,
        lastError: true,
        receivedAt: true,
        processedAt: true,
        repository: {
          select: {
            fullName: true,
          },
        },
      },
    });

  const completed =
    events.filter(
      (event) =>
        event.status === "DONE"
    ).length;

  const failed =
    events.filter(
      (event) =>
        event.status === "FAILED"
    ).length;

  const processing =
    events.filter(
      (event) =>
        event.status === "PROCESSING"
    ).length;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Event stream
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Events
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Inspect webhook deliveries, processing state, retries, and failures.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-[11px] text-slate-500">
              Done
            </p>
            <p className="mt-1 text-lg font-semibold text-emerald-300">
              {completed}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-[11px] text-slate-500">
              Active
            </p>
            <p className="mt-1 text-lg font-semibold text-amber-300">
              {processing}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-[11px] text-slate-500">
              Failed
            </p>
            <p className="mt-1 text-lg font-semibold text-rose-300">
              {failed}
            </p>
          </div>
        </div>
      </section>

      {events.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-14 text-center">
          <p className="text-sm font-medium text-slate-300">
            No events recorded yet.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Trigger an issue or pull request in a connected repository.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          <div className="hidden grid-cols-[minmax(0,1.5fr)_140px_140px_120px] gap-4 border-b border-white/10 px-5 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-600 md:grid">
            <span>Repository</span>
            <span>Event</span>
            <span>Received</span>
            <span>Status</span>
          </div>

          <div className="divide-y divide-white/5">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/dashboard/events/${event.id}`}
                className="grid gap-3 px-5 py-4 transition hover:bg-white/[0.03] md:grid-cols-[minmax(0,1.5fr)_140px_140px_120px] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {event.repository.fullName}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-600">
                    {event.action || "webhook event"}
                    {event.lastError
                      ? ` · ${event.lastError}`
                      : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-400">
                    {eventLabel(
                      event.eventType
                    )}
                  </span>
                </div>

                <div className="text-xs text-slate-500">
                  {event.receivedAt.toLocaleString()}
                </div>

                <div>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClass(
                      event.status
                    )}`}
                  >
                    {event.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
