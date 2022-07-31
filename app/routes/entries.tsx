import { LoaderFunction, json } from "@remix-run/server-runtime";
import { z } from "zod";
import { fetchEntries } from "../utils/ameblo";
import { parseQuery } from "../utils/loader-utils";

const REQ_SCHEME = z.object({
  amebaId: z.string(),
  themeId: z.string(),
});

export const loader: LoaderFunction = async ({ request }) => {
  const query = REQ_SCHEME.parse(parseQuery(request));
  const { amebaId, themeId } = query;
  const entries = await fetchEntries(amebaId, themeId);
  return json(entries);
};
