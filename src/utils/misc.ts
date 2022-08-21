import { tinyassert } from "./tinyassert";

export async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  tinyassert(res.ok);
  const contentType = res.headers.get("content-type");
  tinyassert(contentType?.startsWith("application/json"));
  const resJson = await res.json();
  return resJson;
}

// convenient typing for array.filter(isTruthy)
export const isTruthy = Boolean as any as <T>(
  x: T
) => x is Exclude<T, false | null | undefined>;
