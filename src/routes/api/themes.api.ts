import { RequestContext } from "rakkasjs";
import { z } from "zod";
import { getThemes, ThemeData } from "../../utils/ameblo";
import { json, parseQuery } from "../../utils/loader-utils";

const REQ_SCHEME = z.object({
  amebaId: z.string(),
});

export type ThemesResponse = ThemeData[];

export async function get(ctx: RequestContext) {
  const query = REQ_SCHEME.parse(parseQuery(ctx.request));
  const data: ThemesResponse = await getThemes(query.amebaId);
  return json(data);
}
