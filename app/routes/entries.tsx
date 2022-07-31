import { LoaderFunction, json } from "@remix-run/server-runtime";
import { z } from "zod";
import { Entry, fetchEntries } from "../utils/ameblo";
import { parseQuery } from "../utils/loader-utils";

const REQ_SCHEME = z.object({
  amebaId: z.string(),
  themeId: z.string(),
});

export type EntriesResponse = Entry[];

export const loader: LoaderFunction = async ({ request }) => {
  const query = REQ_SCHEME.parse(parseQuery(request));
  const { amebaId, themeId } = query;
  const data: EntriesResponse = await fetchEntries(amebaId, themeId);
  return json(data);
};
