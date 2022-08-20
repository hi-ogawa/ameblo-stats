import qs from "qs";

export function parseQuery(request: Request): any {
  return qs.parse(new URL(request.url).search, {
    allowDots: true,
    ignoreQueryPrefix: true,
  });
}

export function json(data: any): Response {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  });
}
