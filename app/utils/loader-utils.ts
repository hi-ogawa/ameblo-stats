import qs from "qs";

export function parseQuery(request: Request): any {
  return qs.parse(new URL(request.url).search, {
    allowDots: true,
    ignoreQueryPrefix: true,
  });
}
