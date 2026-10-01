import "server-only";

import { getInstallationAccessToken } from "@/server/github/installation-token";
import {
  ActionExecutionError,
  classifyHttpStatus,
} from "@/server/worker/errors";

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";
const REQUEST_TIMEOUT_MS = 15_000;

type GithubRequestResult<T> = {
  data: T;
  headers: Headers;
};

function resolveGithubUrl(input: string) {
  const url = new URL(input, GITHUB_API_URL);

  if (url.origin !== GITHUB_API_URL) {
    throw new Error(
      "GitHub request URL has an invalid origin"
    );
  }

  return url;
}

export async function githubAppRequest<T>(
  installationId: string,
  input: string,
  init: RequestInit = {}
): Promise<GithubRequestResult<T>> {
  const url = resolveGithubUrl(input);

  const token =
    await getInstallationAccessToken(
      installationId
    );

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      url.toString(),
      {
        ...init,
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
        headers: {
          Accept:
            "application/vnd.github+json",
          "Content-Type":
            "application/json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version":
            GITHUB_API_VERSION,
          ...(init.headers ?? {}),
        },
      }
    );

    const body =
      await response.text();

    if (!response.ok) {
      throw new ActionExecutionError(
        `GitHub API request failed with status ${response.status}`,
        classifyHttpStatus(
          response.status
        ),
        response.status
      );
    }

    if (!body) {
      return {
        data: undefined as T,
        headers: response.headers,
      };
    }

    try {
      return {
        data: JSON.parse(body) as T,
        headers: response.headers,
      };
    } catch {
      throw new ActionExecutionError(
        "GitHub API returned invalid JSON",
        "permanent"
      );
    }
  } catch (error) {
    if (
      error instanceof ActionExecutionError
    ) {
      throw error;
    }

    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new ActionExecutionError(
        "GitHub API request timed out",
        "transient"
      );
    }

    throw new ActionExecutionError(
      error instanceof Error
        ? error.message
        : "GitHub API request failed",
      "transient"
    );
  } finally {
    clearTimeout(timeout);
  }
}
