import { range, sortBy } from "lodash";
import { z } from "zod";
import { tinyassert } from "./tinyassert";

//
// schema
//

const INIT_DATA_SCHEMA = z.object({
  entryState: z.object({
    entryMap: z.record(
      z.object({
        entry_id: z.number(),
        // strip out properties which are no use to save some payload
        // theme_id: z.number(),
        // theme_name: z.string(),
        entry_title: z.string(),
        entry_created_datetime: z.string(),
        image_url: z.string().optional(),
      })
    ),
    // only for urls such as https://ameblo.jp/<amebaId>/entrylist.html
    blogPageMap: z
      .record(
        z.object({
          blogId: z.number(),
          paging: z.object({
            max_page: z.number(),
          }),
        })
      )
      .optional(),
  }),
  themesState: z.object({
    themeMap: z.record(
      z.object({
        theme_id: z.string(),
        theme_name: z.string(),
        entry_cnt: z.number(),
      })
    ),
    // only for urls such as https://ameblo.jp/<amebaId>/theme-<themeId>.html
    themePageMap: z
      .record(
        z.object({
          paging: z.object({
            max_page: z.number(),
          }),
        })
      )
      .optional(),
  }),
});

const REACTIONS_API_SCHEMA = z.record(
  z.object({
    commentCnt: z.number(),
    // reblogCnt: z.number(),
    iineCnt: z.number(),
  })
);

type InitData = z.infer<typeof INIT_DATA_SCHEMA>;

export type ThemeDataRaw = InitData["themesState"]["themeMap"][string];

export type ThemeData = ThemeDataRaw & { amebaId: string };

type EntryDataRaw = InitData["entryState"]["entryMap"][string];

type ReactionsApiData = z.infer<typeof REACTIONS_API_SCHEMA>;

type Reactions = ReactionsApiData[string];

export type Entry = EntryDataRaw & Reactions;

export const COUNT_TYPES = ["commentCnt", "iineCnt"] as const;
export const COUNT_TYPE_TO_NAME = {
  commentCnt: "comment",
  iineCnt: "like",
} as const;
export type CountType = typeof COUNT_TYPES[number];

//
// fetching
//

const INIT_DATA_RE = /<script>window\.INIT_DATA=({.*?});/;

function parseInitData(html: string): InitData {
  const match = html.match(INIT_DATA_RE);
  tinyassert(match);
  const initDataStr = match[1];
  return INIT_DATA_SCHEMA.parse(JSON.parse(initDataStr));
}

async function fetchInitData(url: string): Promise<InitData> {
  const res = await fetch(url);
  tinyassert(res.ok);
  const html = await res.text();
  return parseInitData(html);
}

async function fetchBlogEntryReactions(
  blogId: number,
  entryIds: number[]
): Promise<ReactionsApiData> {
  const entryIdsEsc = entryIds.join("%2C");
  const url = `https://ameblo.jp/_api/blogEntryReactions;blogId=${blogId};entryIds=${entryIdsEsc}`;
  const res = await fetch(url);
  tinyassert(res.ok);
  const resJson = await res.json();
  return REACTIONS_API_SCHEMA.parse(resJson);
}

export async function getThemes(amebaId: string): Promise<ThemeData[]> {
  const url = `https://ameblo.jp/${amebaId}/entrylist.html`;
  const initData = await fetchInitData(url);
  let results = Object.values(initData.themesState.themeMap);
  return results.map((result) => ({ amebaId, ...result }));
}

export async function fetchEntries(
  amebaId: string,
  themeId: string
): Promise<Entry[]> {
  const baseInitData = await fetchInitData(
    `https://ameblo.jp/${amebaId}/entrylist.html`
  );

  // find blogId
  tinyassert(baseInitData.entryState.blogPageMap);
  const blogPageMap = Object.values(baseInitData.entryState.blogPageMap);
  tinyassert(blogPageMap.length > 0);
  const blogId = blogPageMap[0].blogId;

  // find maxPage
  const themeInitData = await fetchInitData(
    `https://ameblo.jp/${amebaId}/theme-${themeId}.html`
  );
  tinyassert(themeInitData.themesState.themePageMap);
  const themePageMap = Object.values(themeInitData.themesState.themePageMap);
  tinyassert(themePageMap.length > 0);
  const maxPage = themePageMap[0].paging.max_page;

  // fetch in-parallel
  let results: Entry[] = [];
  await runInParallel(50, range(1, maxPage + 1), async (page) => {
    const resultsByPage = await fetchByPage(amebaId, blogId, themeId, page);
    results.push(...resultsByPage);
  });
  results = sortBy(results, "entry_created_datetime");
  results.reverse();
  return results;
}

async function fetchByPage(
  amebaId: string,
  blogId: number,
  themeId: string,
  page: number
): Promise<Entry[]> {
  const url = `https://ameblo.jp/${amebaId}/theme${page}-${themeId}.html`;
  const initData = await fetchInitData(url);
  const entriesRaw = Object.values(initData.entryState.entryMap);
  const entryIds = entriesRaw.map((e) => e.entry_id);
  const reactions = await fetchBlogEntryReactions(blogId, entryIds);
  const entries = entriesRaw.map((entryRaw) => {
    const reaction = reactions[entryRaw.entry_id];
    tinyassert(reaction);
    return { ...entryRaw, ...reaction };
  });
  return entries;
}

async function runInParallel<T>(
  parallel: number,
  args: T[],
  run: (arg: T) => Promise<void>
): Promise<void> {
  tinyassert(parallel > 0);

  args = [...args];

  async function consumer() {
    while (true) {
      const arg = args.shift();
      if (!arg) {
        break;
      }
      await run(arg);
    }
  }

  await Promise.all(range(parallel).map(() => consumer()));
}
