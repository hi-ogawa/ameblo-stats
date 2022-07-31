import { LoaderFunction, json } from "@remix-run/server-runtime";
import { z } from "zod";
import { getThemes } from "../utils/ameblo";
import { parseQuery } from "../utils/loader-utils";

const REQ_SCHEME = z.object({
  amebaId: z.string(),
});

export const loader: LoaderFunction = async ({ request }) => {
  const query = REQ_SCHEME.parse(parseQuery(request));
  const themes = await getThemes(query.amebaId);
  return json(themes);
};
