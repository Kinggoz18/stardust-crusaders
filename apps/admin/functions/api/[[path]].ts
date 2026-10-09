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

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}
