"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  configureSlackWebhook,
  connectRepository,
  disconnectRepository,
} from "./actions";

type Repository = {
  databaseId: string | null;
  githubRepoId: string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  canConnect: boolean;
  connected: boolean;
  active: boolean;
  slackConfigured: boolean;
};

type InstallationGroup = {
  installation: {
    id: string;
    githubId: string;
    accountLogin: string;
    suspended: boolean;
  };
  repositories: Repository[];
};

function GithubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M12 .7a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.06c-3.34.73-4.04-1.41-4.04-1.41-.55-1.4-1.34-1.77-1.34-1.77-1.09-.74.08-.73.08-.73 1.2.09 1.83 1.23 1.83 1.23 1.07 1.82 2.8 1.3 3.48.99.11-.77.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.4 11.4 0 0 1 6-.02c2.29-1.55 3.29-1.23 3.29-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.47 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .7Z" />
    </svg>
  );
}

function RepoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4H20v15H7.5A2.5 2.5 0 0 0 5 21.5v-15ZM5 21.5A2.5 2.5 0 0 1 7.5 19H20M9 8h7M9 12h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SlackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path
        d="M9 4.5A2.5 2.5 0 1 1 6.5 7H4.5A2.5 2.5 0 1 1 9 4.5Zm0 0v10a2.5 2.5 0 1 1-2.5 2.5H4.5A2.5 2.5 0 1 1 4.5 12H9Zm6 15A2.5 2.5 0 1 1 17.5 17H19.5A2.5 2.5 0 1 1 15 19.5Zm0 0V9.5a2.5 2.5 0 1 1 2.5-2.5h2A2.5 2.5 0 1 1 19.5 12H15Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function RepositoryManager({
  groups,
}: {
  groups: InstallationGroup[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [slackUrls, setSlackUrls] = useState<Record<string, string>>(
    {}
  );

  function handleConnect(
    installationId: string,
    githubRepoId: string
  ) {
    setError(null);

    startTransition(async () => {
      const result = await connectRepository(
        installationId,
        githubRepoId
      );

      if (!result.success) {
        setError(result.error ?? "Unable to connect repository.");
        return;
      }

      router.refresh();
    });
  }

  function handleDisconnect(databaseId: string | null) {
    if (!databaseId) {
      setError("Connected repository record was not found.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await disconnectRepository(databaseId);

      if (!result.success) {
        setError(result.error ?? "Unable to disconnect repository.");
        return;
      }

      router.refresh();
    });
  }

  function handleSlackSave(repositoryId: string | null) {
    if (!repositoryId) {
      setError("Connected repository record was not found.");
      return;
    }

    setError(null);

    const value = slackUrls[repositoryId] ?? "";

    startTransition(async () => {
      const result = await configureSlackWebhook(
        repositoryId,
        value
      );

      if (!result.success) {
        setError(result.error ?? "Unable to configure Slack.");
        return;
      }

      setSlackUrls((current) => ({
        ...current,
        [repositoryId]: "",
      }));

      router.refresh();
    });
  }

  function handleSlackRemove(repositoryId: string | null) {
    if (!repositoryId) {
      setError("Connected repository record was not found.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await configureSlackWebhook(
        repositoryId,
        ""
      );

      if (!result.success) {
        setError(result.error ?? "Unable to remove Slack.");
        return;
      }

      router.refresh();
    });
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400">
          <GithubIcon />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-white">
          No GitHub installations
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Install the GitHub App before connecting repositories.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {groups.map((group) => (
        <section
          key={group.installation.id}
          className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                GitHub installation
              </p>
              <div className="mt-2 flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">
                  @{group.installation.accountLogin}
                </h2>

                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    group.installation.suspended
                      ? "border-rose-400/20 bg-rose-400/10 text-rose-300"
                      : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                  }`}
                >
                  {group.installation.suspended
                    ? "Suspended"
                    : "Active"}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-500">
              {group.repositories.length} accessible{" "}
              {group.repositories.length === 1
                ? "repository"
                : "repositories"}
            </div>
          </div>

          {group.installation.suspended ? (
            <div className="px-5 py-12 text-center sm:px-6">
              <p className="text-sm font-medium text-slate-300">
                This installation is suspended.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Resume the GitHub App installation to manage repositories.
              </p>
            </div>
          ) : group.repositories.length === 0 ? (
            <div className="px-5 py-12 text-center sm:px-6">
              <RepoIcon />
              <p className="mt-4 text-sm font-medium text-slate-300">
                No accessible repositories found.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {group.repositories.map((repository) => (
                <div
                  key={repository.githubRepoId}
                  className="p-5 transition hover:bg-white/[0.02] sm:p-6"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400">
                          <RepoIcon />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-white">
                              {repository.fullName}
                            </h3>

                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                              {repository.private
                                ? "Private"
                                : "Public"}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-slate-500">
                            {repository.canConnect
                              ? "You have push/admin access."
                              : "You do not have enough permission to connect this repository."}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {repository.connected ? (
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                          Connected
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={
                              isPending ||
                              !repository.canConnect
                            }
                            onClick={() =>
                              handleConnect(
                                group.installation.id,
                                repository.githubRepoId
                              )
                            }
                            className="rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isPending
                              ? "Working..."
                              : "Connect"}
                          </button>

                        </>
                      )}

                      <a
                        href={repository.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                      >
                        <GithubIcon />
                        GitHub
                      </a>
                    </div>
                  </div>

                  {repository.connected && (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <SlackIcon />
                            <p className="text-sm font-medium text-slate-200">
                              Slack notifications
                            </p>

                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                repository.slackConfigured
                                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                  : "border-slate-400/20 bg-slate-400/10 text-slate-400"
                              }`}
                            >
                              {repository.slackConfigured
                                ? "Configured"
                                : "Not configured"}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-slate-500">
                            Store an encrypted Slack incoming webhook for rule notifications.
                          </p>
                        </div>

                        {repository.slackConfigured ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              handleSlackRemove(
                                repository.databaseId
                              )
                            }
                            className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-3.5 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-400/10 disabled:opacity-40"
                          >
                            Remove webhook
                          </button>
                        ) : (
                          <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
                            <input
                              type="url"
                              placeholder="https://hooks.slack.com/services/..."
                              value={
                                slackUrls[
                                  repository.databaseId ?? ""
                                ] ?? ""
                              }
                              onChange={(event) =>
                                setSlackUrls((current) => ({
                                  ...current,
                                  [repository.databaseId ?? ""]:
                                    event.target.value,
                                }))
                              }
                              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-white/25 focus:bg-white/[0.07]"
                            />

                            <button
                              type="button"
                              disabled={
                                isPending ||
                                !repository.databaseId
                              }
                              onClick={() =>
                                handleSlackSave(
                                  repository.databaseId
                                )
                              }
                              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-40"
                            >
                              Save
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {repository.connected && (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          handleDisconnect(
                            repository.databaseId
                          )
                        }
                        className="text-xs font-medium text-slate-500 transition hover:text-rose-300 disabled:opacity-40"
                      >
                        Disconnect repository
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
