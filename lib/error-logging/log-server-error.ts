import type { NextRequest } from "next/server";
import { parseUnknownError } from "./parse-error";
import { recordError } from "./record-error";

type LogServerErrorOptions = {
  request?: NextRequest;
  endpoint: string;
  user?: { id?: string; email?: string | null } | null;
  statusCode?: number;
  metadata?: Record<string, unknown>;
};

export async function logServerError(error: unknown, options: LogServerErrorOptions): Promise<void> {
  const parsed = parseUnknownError(error);
  const userAgent = options.request?.headers.get("user-agent") ?? undefined;

  await recordError({
    source: "server",
    errorName: parsed.name,
    message: parsed.message,
    stackTrace: parsed.stack,
    endpoint: options.endpoint,
    statusCode: options.statusCode ?? 500,
    userEmail: options.user?.email ?? null,
    userId: options.user?.id ?? null,
    metadata: {
      ...(options.metadata ?? {}),
      ...(userAgent ? { userAgent } : {}),
    },
  });
}
