import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { createClerkSupabaseClient } from "../clerkSupabase";

type GroupPushEvent =
  | { eventType: "join"; groupId: string }
  | { eventType: "message"; groupId: string; messageId: string };

const MAX_ERROR_DETAILS = 500;

/** Remove anything that looks like a JWT or Expo push token before logging. */
function redactSensitive(value: string): string {
  return value
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[redacted-jwt]",
    )
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/ExponentPushToken\[[^\]]+\]/g, "[redacted-push-token]")
    .slice(0, MAX_ERROR_DETAILS);
}

async function readErrorResponse(response: Response): Promise<string | null> {
  try {
    const text = await response.clone().text();
    const trimmed = text.trim();
    return trimmed ? redactSensitive(trimmed) : null;
  } catch {
    return null;
  }
}

function summarizeResponseBody(body: string | null): string {
  if (!body) return "";

  try {
    const parsed = JSON.parse(body) as {
      stage?: unknown;
      error?: unknown;
      code?: unknown;
      message?: unknown;
      details?: { code?: unknown; message?: unknown; hint?: unknown };
    };

    const parts: string[] = [];
    const add = (label: string, value: unknown) => {
      if (typeof value === "string" && value.length > 0) {
        parts.push(`${label}${value}`);
      }
    };

    add("stage=", parsed.stage);
    add("", parsed.error);
    add("code=", parsed.code);
    add("", parsed.message);
    if (parsed.details) {
      add("db=", parsed.details.code);
      add("", parsed.details.message);
      add("hint=", parsed.details.hint);
    }

    if (parts.length > 0) return parts.join(" | ");
  } catch {
    // Not JSON; fall back to the already-redacted raw body.
  }

  return body;
}

function httpStatusOf(error: unknown): number | null {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) return context.status;
  if (context && typeof context === "object" && "status" in context) {
    const status = (context as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return null;
}

export async function sendGroupPushNotification(
  event: GroupPushEvent,
  accessToken: string,
) {
  const supabase = createClerkSupabaseClient(accessToken);
  const { data, error } = await supabase.functions.invoke(
    "send-push-notification",
    { body: event },
  );

  if (error) {
    const status = httpStatusOf(error);
    const context = (error as { context?: unknown } | null)?.context;
    const responseBody =
      context instanceof Response ? await readErrorResponse(context) : null;
    const summary = summarizeResponseBody(responseBody);
    const suffix = summary ? `: ${summary}` : ".";

    if (
      error instanceof FunctionsHttpError
      || error?.name === "FunctionsHttpError"
    ) {
      throw new Error(
        `Push notification failed (HTTP ${status ?? "unknown"})${suffix}`,
      );
    }

    if (
      error instanceof FunctionsRelayError
      || error?.name === "FunctionsRelayError"
    ) {
      throw new Error(
        `Push notification relay error (HTTP ${status ?? "unknown"})${suffix}`,
      );
    }

    if (
      error instanceof FunctionsFetchError
      || error?.name === "FunctionsFetchError"
    ) {
      throw new Error(
        `Push notification network error: ${redactSensitive(
          String(error?.message ?? "could not reach the Edge Function"),
        )}`,
      );
    }

    throw new Error(
      `Push notification request failed: ${
        redactSensitive(String(error?.message ?? "unknown error"))
      }${suffix}`,
    );
  }

  if (data?.sent === 0) {
    console.warn(
      "Push notification was not delivered:",
      data.reason ?? "No recipient push tokens were registered.",
    );
  }

  if (typeof data?.failed === "number" && data.failed > 0) {
    console.warn(
      `Push notification partially failed: ${data.failed} ticket(s) were rejected.`,
    );
  }

  return data;
}
