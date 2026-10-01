import "server-only";

const SUPPORTED_ACTIONS: Record<string, Set<string>> = {
  issues: new Set([
    "opened",
    "edited",
    "reopened",
  ]),

  pull_request: new Set([
    "opened",
    "edited",
    "reopened",
    "synchronize",
  ]),
};

export function isSupportedGithubTrigger(
  eventType: string,
  action: string | null
) {
  if (!action) {
    return false;
  }

  return (
    SUPPORTED_ACTIONS[eventType]?.has(action) ??
    false
  );
}
