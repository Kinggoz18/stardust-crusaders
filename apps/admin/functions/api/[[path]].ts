/**
 * Cloudflare Pages Function: thin edge proxy to the VPS API.
 * Browser never holds API service credentials — only the session cookie.
 */

interface Env {
  API_BASE_URL: string;
  ADMIN_PROXY_TOKEN: string;
}

interface PagesContext {
  request: Request;
  env: Env;
  params: { path?: string | string[] };
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env, params } = context;
  const pathParts = params.path;
  const suffix = Array.isArray(pathParts) ? pathParts.join("/") : pathParts ?? "";
  const url = new URL(request.url);
  const target = `${env.API_BASE_URL.replace(/\/$/, "")}/${suffix}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set("x-admin-proxy-token", env.ADMIN_PROXY_TOKEN);
  headers.delete("host");

  // CSRF: mutating calls from the browser must include matching header + cookie pair.
  if (request.method !== "GET" && request.method !== "HEAD") {
    const csrfHeader = headers.get("x-csrf-token");
    const cookie = headers.get("cookie") ?? "";
    const csrfCookie = cookie.match(/(?:^|;\s*)stardust_csrf=([^;]+)/)?.[1];
    if (csrfHeader && csrfCookie && csrfHeader !== decodeURIComponent(csrfCookie)) {
      return new Response(JSON.stringify({ error: { code: "csrf", message: "Retry the action." } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const responseHeaders = new Headers(upstream.headers);
  // Ensure Set-Cookie from API reaches the browser on the Pages origin.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
