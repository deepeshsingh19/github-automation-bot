import Link from "next/link";

import LoginButton from "./LoginButton";

function getSafeCallbackUrl(value: unknown) {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
  ) {
    return value;
  }

  return "/dashboard";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string | string[];
  }>;
}) {
  const params = await searchParams;

  const callbackUrl =
    getSafeCallbackUrl(
      Array.isArray(params.callbackUrl)
        ? params.callbackUrl[0]
        : params.callbackUrl
    );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center sm:min-h-[calc(100vh-4rem)]">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/30 lg:min-h-[620px] lg:grid-cols-2">
          <section className="relative hidden overflow-hidden border-r border-white/10 p-10 lg:flex lg:flex-col lg:justify-between lg:p-12">
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/[0.04] blur-3xl" />

            <Link
              href="/"
              className="relative flex items-center gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xs font-bold text-slate-950">
                GH
              </div>

              <div>
                <p className="text-sm font-semibold">
                  GitHub Automation Bot
                </p>
                <p className="text-xs text-slate-600">
                  Event-driven workflows
                </p>
              </div>
            </Link>

            <div className="relative max-w-md">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-600">
                GitHub automation
              </p>

              <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.035em] text-white">
                Connect GitHub events to the actions your team already uses.
              </h1>

              <p className="mt-5 text-sm leading-6 text-slate-500">
                Define rules for issues and pull requests, run AI triage,
                update GitHub, and send Slack notifications from one place.
              </p>

              <div className="mt-8 space-y-3">
                {[
                  "Signed webhook processing",
                  "Durable retries and idempotency",
                  "Encrypted Slack credentials",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 text-sm text-slate-400"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/5 text-[10px] text-emerald-300">
                      ✓
                    </span>

                    {item}
                  </div>
                ))}
              </div>
            </div>

            <p className="relative text-xs text-slate-600">
              Authentication is handled through GitHub OAuth.
            </p>
          </section>

          <section className="flex items-center p-6 sm:p-10 lg:p-12">
            <div className="mx-auto w-full max-w-md">
              <div className="lg:hidden">
                <Link
                  href="/"
                  className="flex items-center gap-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xs font-bold text-slate-950">
                    GH
                  </div>

                  <div>
                    <p className="text-sm font-semibold">
                      GitHub Automation Bot
                    </p>
                    <p className="text-xs text-slate-600">
                      Event-driven workflows
                    </p>
                  </div>
                </Link>
              </div>

              <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white text-sm font-bold text-slate-950 lg:mt-0">
                GH
              </div>

              <p className="mt-8 text-xs font-medium uppercase tracking-[0.18em] text-slate-600">
                Sign in
              </p>

              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Welcome back.
              </h2>

              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                Sign in with GitHub to manage repositories, automation rules,
                and event processing.
              </p>

              <div className="mt-8">
                <LoginButton
                  callbackUrl={callbackUrl}
                />
              </div>

              <p className="mt-5 text-center text-xs leading-5 text-slate-600">
                Your GitHub password is never shared with this application.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
