import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const issuer = Deno.env.get("CLERK_ISSUER_URL")?.replace(/\/+$/, "");
const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");

if (!issuer || !cloudName || !apiKey || !apiSecret) {
  throw new Error(
    "Set CLERK_ISSUER_URL, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET for this function.",
  );
}

const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

const ALLOWED_FOLDERS = new Set(["avatars", "hangouts", "general"]);
const encoder = new TextEncoder();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha1Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "A Clerk session token is required." }, 401);
  }

  try {
    const { payload } = await jwtVerify(
      authorization.slice("Bearer ".length),
      jwks,
      { issuer },
    );
    if (typeof payload.sub !== "string" || !payload.sub) {
      return jsonResponse(
        { error: "Clerk token is missing its sub claim." },
        401,
      );
    }
    if (payload.role !== "authenticated") {
      return jsonResponse(
        {
          error:
            "Configure Clerk session tokens with role=authenticated and enable Clerk as a Supabase Third-Party Auth provider.",
        },
        403,
      );
    }
  } catch (error) {
    console.error("Clerk JWT verification failed:", error);
    return jsonResponse({ error: "Clerk session token is invalid." }, 401);
  }

  let body: { folder?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const folder = body?.folder;
  if (typeof folder !== "string" || !ALLOWED_FOLDERS.has(folder)) {
    return jsonResponse(
      { error: "Folder must be one of: avatars, hangouts, general." },
      400,
    );
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stringToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = await sha1Hex(stringToSign);

  return jsonResponse({
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
  });
});
