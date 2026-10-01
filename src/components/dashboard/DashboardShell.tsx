import Link from "next/link";
import type { ReactNode } from "react";

import ProfileMenu from "@/components/dashboard/ProfileMenu";

const navigation = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-11h6V4h-6v5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/repositories",
    label: "Repositories",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v14H7.5A2.5 2.5 0 0 0 5 19.5v-14ZM5 19.5A2.5 2.5 0 0 1 7.5 17H20M9 7h7M9 11h5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/rules",
    label: "Rules",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 7h14M5 12h14M5 17h14M9 5v4M15 10v4M11 15v4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/events",
    label: "Events",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 5h12M8 13h3M8 16h6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function GithubMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .7a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.06c-3.34.73-4.04-1.41-4.04-1.41-.55-1.4-1.34-1.77-1.34-1.77-1.09-.74.08-.73.08-.73 1.2.09 1.83 1.23 1.83 1.23 1.07 1.82 2.8 1.3 3.48.99.11-.77.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.4 11.4 0 0 1 6-.02c2.29-1.55 3.29-1.23 3.29-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.47 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .7Z" />
    </svg>
  );
}

export default function DashboardShell({
  children,
  githubLogin,
}: {
  children: ReactNode;
  githubLogin: string;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-slate-950/80 px-4 py-6 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-950">
              <GithubMark />
            </div>

            <div>
              <p className="text-sm font-semibold tracking-tight">
                Automation Bot
              </p>
              <p className="text-xs text-slate-500">
                GitHub workflows
              </p>
            </div>
          </div>

          <nav className="mt-10 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                <span className="h-5 w-5">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-medium text-slate-500">
              Connected account
            </p>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-950">
                {githubLogin
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-200">
                  @{githubLogin}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  GitHub account
                </p>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="lg:hidden">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-950">
                    <GithubMark />
                  </div>

                  <span className="text-sm font-semibold">
                    Automation Bot
                  </span>
                </Link>
              </div>

              <div className="hidden lg:block">
                <p className="text-sm text-slate-400">
                  GitHub Automation
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 sm:flex sm:items-center sm:gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-medium text-emerald-300">
                    Worker active
                  </span>
                </div>

                <ProfileMenu
                  githubLogin={githubLogin}
                />
              </div>
            </div>

            <nav className="overflow-x-auto border-t border-white/5 px-4 py-2 lg:hidden">
              <div className="flex min-w-max gap-1">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          </header>

          <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
