import "server-only";

export class SlackWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlackWebhookError";
  }
}

export function validateSlackWebhookUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new SlackWebhookError("Slack webhook URL is required");
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    throw new SlackWebhookError("Invalid Slack webhook URL");
  }

  if (url.protocol !== "https:") {
    throw new SlackWebhookError(
      "Slack webhook must use HTTPS"
    );
  }

  if (url.hostname !== "hooks.slack.com") {
    throw new SlackWebhookError(
      "URL must use hooks.slack.com"
    );
  }

  if (url.port) {
    throw new SlackWebhookError(
      "Slack webhook URL must not specify a port"
    );
  }

  if (url.username || url.password) {
    throw new SlackWebhookError(
      "Slack webhook URL must not contain credentials"
    );
  }

  if (!url.pathname.startsWith("/services/")) {
    throw new SlackWebhookError(
      "Invalid Slack webhook path"
    );
  }

  return url.toString();
}
