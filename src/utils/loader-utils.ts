import qs from "qs";

export function parseQuery(request: Request): any {
  return qs.parse(new URL(request.url).search, {
    allowDots: true,
    ignoreQueryPrefix: true,
  });
}

export function json(data: any, init: any = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}
