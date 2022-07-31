import { LoaderFunction, json } from "@remix-run/server-runtime";
import { z } from "zod";
import { ThemeData, getThemes } from "../utils/ameblo";
import { parseQuery } from "../utils/loader-utils";

const REQ_SCHEME = z.object({
  amebaId: z.string(),
});

export type ThemesResponse = ThemeData[];

export const loader: LoaderFunction = async ({ request }) => {
  const query = REQ_SCHEME.parse(parseQuery(request));
  const data: ThemesResponse = await getThemes(query.amebaId);
  return json(data);
};
