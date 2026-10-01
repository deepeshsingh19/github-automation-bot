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

export default function RepositoryManager({
  groups,
}: {
  groups: InstallationGroup[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [slackUrls, setSlackUrls] = useState<Record<string, string>>({});

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
      <div>
        <h2>No GitHub installations</h2>
        <p>Install the GitHub App before connecting repositories.</p>
      </div>
    );
  }

  return (
    <div>
      {error && <p>{error}</p>}

      {groups.map((group) => (
        <section key={group.installation.id}>
          <h2>{group.installation.accountLogin}</h2>

          {group.installation.suspended ? (
            <p>This installation is suspended.</p>
          ) : group.repositories.length === 0 ? (
            <p>No accessible repositories found.</p>
          ) : (
            <ul>
              {group.repositories.map((repository) => (
                <li key={repository.githubRepoId}>
                  <div>
                    <strong>{repository.fullName}</strong>{" "}
                    {repository.private ? "(private)" : "(public)"}
                  </div>

                  <div>
                    Permission:{" "}
                    {repository.canConnect
                      ? "push/admin"
                      : "insufficient"}
                  </div>

                  {repository.connected ? (
                    <div>
                      <p>
                        <strong>Connected</strong>
                      </p>

                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          handleDisconnect(repository.databaseId)
                        }
                      >
                        Disconnect
                      </button>

                      <div>
                        <p>
                          Slack:{" "}
                          {repository.slackConfigured
                            ? "Configured"
                            : "Not configured"}
                        </p>

                        {repository.slackConfigured ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              handleSlackRemove(
                                repository.databaseId
                              )
                            }
                          >
                            Remove Slack
                          </button>
                        ) : (
                          <div>
                            <input
                              type="url"
                              placeholder="https://hooks.slack.com/services/..."
                              value={
                                slackUrls[repository.databaseId ?? ""] ??
                                ""
                              }
                              onChange={(event) =>
                                setSlackUrls((current) => ({
                                  ...current,
                                  [repository.databaseId ?? ""]:
                                    event.target.value,
                                }))
                              }
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
                            >
                              Save Slack
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        isPending || !repository.canConnect
                      }
                      onClick={() =>
                        handleConnect(
                          group.installation.id,
                          repository.githubRepoId
                        )
                      }
                    >
                      Connect
                    </button>
                  )}

                  <a
                    href={repository.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on GitHub
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
