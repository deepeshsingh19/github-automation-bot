import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";

function GithubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path d="M12 .7a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.06c-3.34.73-4.04-1.41-4.04-1.41-.55-1.4-1.34-1.77-1.34-1.77-1.09-.74.08-.73.08-.73 1.2.09 1.83 1.23 1.83 1.23 1.07 1.82 2.8 1.3 3.48.99.11-.77.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.4 11.4 0 0 1 6-.02c2.29-1.55 3.29-1.23 3.29-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.47 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .7Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path
        d="M5 12h13M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function HomePage() {
  const session = await getServerSession(
    authOptions
  );

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_38%)]" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-950">
            <GithubIcon />
          </div>

          <div>
            <p className="text-sm font-semibold">
              GitHub Automation Bot
            </p>
            <p className="text-[10px] text-slate-600">
              Event-driven workflows
            </p>
          </div>
        </Link>

        {session ? (
          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Open dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Sign in
          </Link>
        )}
      </nav>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:pb-28 lg:pt-28">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Durable event processing
          </div>

          <h1 className="mt-7 text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
            Turn GitHub events into
            <span className="block text-slate-500">
              automated workflows.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            Connect repositories, define deterministic rules,
            triage issues with AI, and notify your team in Slack.
            Built around durable events, retries, and idempotent actions.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            {session ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Open dashboard
                <ArrowIcon />
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Continue with GitHub
                <ArrowIcon />
              </Link>
            )}

            <a
              href="#how-it-works"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              See how it works
            </a>
          </div>
        </div>

        <div
          id="how-it-works"
          className="mt-20 grid gap-4 md:grid-cols-3"
        >
          {[
            {
              number: "01",
              title: "Connect GitHub",
              text: "Install the GitHub App and connect repositories you can manage.",
            },
            {
              number: "02",
              title: "Define rules",
              text: "Match issues and pull requests using simple, predictable conditions.",
            },
            {
              number: "03",
              title: "Automate actions",
              text: "Apply labels, post comments, run AI triage, or notify Slack.",
            },
          ].map((item) => (
            <div
              key={item.number}
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-6"
            >
              <p className="text-xs font-semibold tracking-[0.18em] text-slate-600">
                {item.number}
              </p>
              <h2 className="mt-5 text-lg font-semibold text-white">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
