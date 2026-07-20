export type ParsedError = {
  name: string;
  message: string;
  stack: string | null;
};

export function parseUnknownError(error: unknown): ParsedError {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "Unknown error",
      stack: error.stack ?? null,
    };
  }

  if (typeof error === "string") {
    return { name: "Error", message: error, stack: null };
  }

  if (error && typeof error === "object" && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    return {
      name: "Error",
      message: typeof maybeMessage === "string" ? maybeMessage : "Unknown error",
      stack: null,
    };
  }

  return { name: "Error", message: "Unknown error", stack: null };
}
