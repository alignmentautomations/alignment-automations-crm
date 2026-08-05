// Guards every /api/* route. The CRM frontend sends the user's password as the
// `x-app-secret` header (stored only in their browser, never in the bundle); this
// validates it against the APP_SECRET environment variable.
//
// Exceptions:
//   - /api/webhook/*  are public endpoints called from the marketing site's forms,
//     which run in the visitor's browser and so can't hold a secret. They guard
//     themselves instead — origin allowlist, honeypot, per-IP rate limit, and a
//     daily ceiling on outbound email. See functions/api/webhook/form-inquiry.js.
//   - OPTIONS (CORS preflight) is always allowed.

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") return next();
  if (url.pathname.startsWith("/api/webhook/")) return next();

  // If no APP_SECRET is configured, fail closed rather than leaving the API open.
  const expected = env.APP_SECRET;
  const provided = request.headers.get("x-app-secret");

  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return next();
}
