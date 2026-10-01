export type ErrorKind =
  | "transient"
  | "permanent"
  | "ai";

export class ActionExecutionError extends Error {
  constructor(
    message: string,
    public readonly kind: ErrorKind,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ActionExecutionError";
  }
}

export function classifyHttpStatus(
  status: number
): ErrorKind {
  if (status === 429 || status >= 500) {
    return "transient";
  }

  if (status === 404 || status === 422) {
    return "permanent";
  }

  if (status >= 400 && status < 500) {
    return "permanent";
  }

  return "transient";
}

export function classifyUnknownError(
  error: unknown
): ErrorKind {
  if (error instanceof ActionExecutionError) {
    return error.kind;
  }

  if (error instanceof Error) {
    if (
      error.name === "AbortError" ||
      error.message.toLowerCase().includes("timeout") ||
      error.message.toLowerCase().includes("network")
    ) {
      return "transient";
    }
  }

  return "transient";
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
