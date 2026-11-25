import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const issuer = Deno.env.get("CLERK_ISSUER_URL")?.replace(/\/+$/, "");

if (!supabaseUrl || !serviceRoleKey || !issuer) {
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and CLERK_ISSUER_URL for this function.",
  );
}

const jwks = createRemoteJWKSet(
  new URL(`${issuer}/.well-known/jwks.json`),
);
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

type PushRequest =
  | { eventType: "join"; groupId: string }
  | { eventType: "message"; groupId: string; messageId: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Remove anything that looks like a JWT or Expo push token before logging. */
function redactSensitive(value: string): string {
  return value
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[redacted-jwt]",
    )
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/ExponentPushToken\[[^\]]+\]/g, "[redacted-push-token]")
    .slice(0, 500);
}

/** Describe an error with safe diagnostics (no tokens or secrets). */
function describeError(error: unknown) {
  if (error && typeof error === "object") {
    const candidate = error as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    return {
      code:
        typeof candidate.code === "string"
          ? candidate.code
          : undefined,
      message:
        typeof candidate.message === "string"
          ? redactSensitive(candidate.message)
          : "Unknown error",
      details:
        typeof candidate.details === "string"
          ? redactSensitive(candidate.details)
          : undefined,
      hint:
        typeof candidate.hint === "string"
          ? redactSensitive(candidate.hint)
          : undefined,
    };
  }
  return { message: redactSensitive(String(error)) };
}

Deno.serve(async (request) => {
  let stage = "request";

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  stage = "clerk-auth";
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse(
      { error: "A Clerk session token is required.", stage },
      401,
    );
  }

  let senderId: string;
  try {
    const { payload } = await jwtVerify(
      authorization.slice("Bearer ".length),
      jwks,
      { issuer },
    );
    if (typeof payload.sub !== "string" || !payload.sub) {
      return jsonResponse(
        { error: "Clerk token is missing its sub claim.", stage },
        401,
      );
    }
    // The Clerk session token does not always include a `role` claim. A valid
    // signature, issuer, and sub are sufficient here; authorization is
    // enforced below by group-membership and message-ownership checks.
    if (payload.role !== "authenticated") {
      console.warn(
        "[send-push-notification] Clerk token has no role=authenticated claim; continuing with the verified sub.",
      );
    }
    senderId = payload.sub;
  } catch (error) {
    console.error(
      `[send-push-notification] failed at stage=${stage}`,
      describeError(error),
    );
    return jsonResponse(
      { error: "Clerk session token is invalid.", stage },
      401,
    );
  }

  stage = "request-body";
  let payload: PushRequest;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      { error: "Request body must be valid JSON.", stage },
      400,
    );
  }

  stage = "event-validation";
  if (
    !payload ||
    (payload.eventType !== "join" && payload.eventType !== "message") ||
    typeof payload.groupId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      payload.groupId,
    ) ||
    (payload.eventType === "message" &&
      (typeof payload.messageId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          payload.messageId,
        )))
  ) {
    return jsonResponse(
      { error: "Invalid group notification request.", stage },
      400,
    );
  }

  try {
    stage = "group-lookup";
    const { data: group, error: groupError } = await admin
      .from("groups")
      .select("id, title, host_id")
      .eq("id", payload.groupId)
      .maybeSingle();
    if (groupError) throw groupError;
    if (!group) {
      return jsonResponse({ error: "Hangout not found.", stage }, 404);
    }

    let recipientIds: string[];
    let type: string;
    let title: string;
    let body: string;

    if (payload.eventType === "message") {
      stage = "message-lookup";
      const { data: message, error: messageError } = await admin
        .from("messages")
        .select("id, sender_id")
        .eq("id", payload.messageId)
        .eq("group_id", payload.groupId)
        .maybeSingle();
      if (messageError) throw messageError;
      if (!message || message.sender_id !== senderId) {
        return jsonResponse(
          { error: "Message is not owned by the authenticated sender.", stage },
          403,
        );
      }

      stage = "member-lookup";
      const { data: members, error: membersError } = await admin
        .from("group_members")
        .select("user_id")
        .eq("group_id", payload.groupId)
        .eq("status", "joined");
      if (membersError) throw membersError;
      const memberIds = (members ?? []).map((member) => member.user_id);
      if (!memberIds.includes(senderId)) {
        return jsonResponse(
          { error: "Sender is not a joined member.", stage },
          403,
        );
      }
      recipientIds = memberIds.filter((memberId) => memberId !== senderId);
      type = "message";
      title = `New message in ${group.title}`;
      body = "A group member sent a message.";
    } else {
      stage = "membership-check";
      const { data: membership, error: membershipError } = await admin
        .from("group_members")
        .select("id")
        .eq("group_id", payload.groupId)
        .eq("user_id", senderId)
        .eq("status", "joined")
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) {
        return jsonResponse(
          { error: "Sender is not a joined member.", stage },
          403,
        );
      }
      recipientIds = group.host_id === senderId ? [] : [group.host_id];
      type = "join";
      title = `New member in ${group.title}`;
      body = "Someone joined your hangout.";
    }

    if (recipientIds.length === 0) {
      return jsonResponse({ sent: 0, reason: "No notification recipients." });
    }

    stage = "recipient-token-lookup";
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, notification_token")
      .in("id", recipientIds);
    if (profilesError) throw profilesError;

    stage = "notification-insert";
    const notifications = recipientIds.map((userId) => ({
      user_id: userId,
      type,
      title,
      body,
      related_group_id: group.id,
      related_user_id: senderId,
    }));
    const { error: insertError } = await admin
      .from("notifications")
      .insert(notifications);
    if (insertError) throw insertError;

    const recipients = (profiles ?? []).filter(
      (profile) =>
        profile.notification_token &&
        /^(Expo|Exponent)PushToken\[.+\]$/.test(profile.notification_token),
    );
    if (recipients.length === 0) {
      return jsonResponse({
        sent: 0,
        inAppNotifications: notifications.length,
        reason: "No recipient has a registered Expo push token.",
      });
    }

    stage = "expo-push";
    let sent = 0;
    const invalidTokens: string[] = [];
    const ticketErrors = new Map<string, number>();

    for (let offset = 0; offset < recipients.length; offset += 100) {
      const batch = recipients.slice(offset, offset + 100);
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          batch.map((profile) => ({
            to: profile.notification_token,
            sound: "default",
            title,
            body,
            data: { groupId: group.id, eventType: payload.eventType },
          })),
        ),
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        console.error(
          `[send-push-notification] failed at stage=${stage}: Expo Push API returned HTTP ${response.status}`,
          redactSensitive(errorBody),
        );
        return jsonResponse(
          {
            error: "Expo could not accept push notifications.",
            stage,
            inAppNotifications: notifications.length,
            details: { status: response.status },
          },
          502,
        );
      }

      const rawBody = await response.text();
      let result: { data?: unknown } = {};
      try {
        result = JSON.parse(rawBody);
      } catch {
        console.error(
          `[send-push-notification] stage=${stage}: Expo returned non-JSON response`,
        );
      }

      const tickets = Array.isArray(result.data) ? result.data : [];
      tickets.forEach(
        (
          ticket: { status?: string; details?: { error?: string } },
          index: number,
        ) => {
          if (ticket.status === "ok") {
            sent += 1;
            return;
          }

          const code = ticket.details?.error ?? "UnknownPushError";
          ticketErrors.set(code, (ticketErrors.get(code) ?? 0) + 1);
          if (code === "DeviceNotRegistered" && batch[index]) {
            invalidTokens.push(batch[index].id);
          }
        },
      );
    }

    if (ticketErrors.size > 0) {
      console.warn(
        `[send-push-notification] stage=${stage}: Expo ticket errors`,
        Object.fromEntries(ticketErrors),
      );
    }

    stage = "invalid-token-cleanup";
    for (const profileId of invalidTokens) {
      const { error } = await admin
        .from("profiles")
        .update({ notification_token: null })
        .eq("id", profileId);
      if (error) console.error("Could not clear an invalid push token:", error);
    }

    if (sent === 0 && recipients.length > 0) {
      return jsonResponse(
        {
          error: "Expo rejected every push notification.",
          stage: "expo-push",
          inAppNotifications: notifications.length,
          details: {
            failed: recipients.length,
            codes: Object.fromEntries(ticketErrors),
          },
        },
        502,
      );
    }

    return jsonResponse({
      sent,
      failed: recipients.length - sent,
      inAppNotifications: notifications.length,
    });
  } catch (error) {
    const details = describeError(error);
    console.error(
      `[send-push-notification] failed at stage=${stage}`,
      details,
    );
    return jsonResponse(
      {
        error: "Could not process push notification.",
        stage,
        details,
      },
      500,
    );
  }
});
