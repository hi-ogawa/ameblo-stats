import { RequestContext } from "rakkasjs";
import { z } from "zod";
import { Entry, fetchEntries } from "../../utils/ameblo";
import { json, parseQuery } from "../../utils/loader-utils";

const REQ_SCHEME = z.object({
  amebaId: z.string(),
  themeId: z.string(),
});

export type EntriesResponse = Entry[];

export async function get(ctx: RequestContext) {
  const query = REQ_SCHEME.parse(parseQuery(ctx.request));
  const { amebaId, themeId } = query;
  const data: EntriesResponse = await fetchEntries(amebaId, themeId);
  return json(data);
}
