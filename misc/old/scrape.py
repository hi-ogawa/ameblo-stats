import argparse
import asyncio
import json
import re
import sys
from typing import Any, Callable, Optional

import httpx


def parse_init_data(html: str) -> Any:
    match = re.search("<script>window\.INIT_DATA=({.*?});", html)
    assert match
    init_data_str = match.group(1)
    init_data = json.loads(init_data_str)
    return init_data


def fetch_init_data(url: str) -> Any:
    return parse_init_data(httpx.get(url).text)


async def fetch_init_data_async(url: str, client: httpx.AsyncClient) -> Any:
    return parse_init_data((await client.get(url)).text)


def main_get_entries(
    ameba_id: str,
    parallel: int,
    theme: Optional[str],
):
    main_init_data = fetch_init_data(f"https://ameblo.jp/{ameba_id}/entrylist.html")

    # extract blog id
    blogPageMap: dict = main_init_data["entryState"]["blogPageMap"]
    blogPageMap: dict = list(blogPageMap.values())[0]
    blog_id = blogPageMap["blogId"]

    # extract max_page
    max_page = None
    theme_id = None
    page_to_url: Callable[[str], str]
    if theme:
        # extract theme_id
        themeMap: dict[str, dict] = main_init_data["themesState"]["themeMap"]
        for k, v in themeMap.items():
            if v["theme_name"] == theme:
                theme_id = int(k)
                break
        else:
            raise RuntimeError(f"theme not found ({theme})")
        theme_init_data = fetch_init_data(
            f"https://ameblo.jp/{ameba_id}/theme-{theme_id}.html"
        )
        themePageMap: dict = theme_init_data["themesState"]["themePageMap"]
        themePageMap: dict = list(themePageMap.values())[0]
        max_page = themePageMap["paging"]["max_page"]
        page_to_url = (
            lambda page: f"https://ameblo.jp/{ameba_id}/theme{page}-{theme_id}.html"
        )

    else:
        max_page = blogPageMap["paging"]["max_page"]
        page_to_url = lambda page: f"https://ameblo.jp/{ameba_id}/entrylist-{page}.html"

    print(f":: {blog_id = }, {theme_id = }, {max_page = }", file=sys.stderr)

    # fetch pages in parallel
    async def fetch_pages() -> None:
        queue = asyncio.Queue()
        for page in range(1, max_page + 1):
            await queue.put(page)

        async def consumer() -> None:
            async with httpx.AsyncClient() as client:
                while not queue.empty():
                    page = await queue.get()
                    print(f":: fetch_by_page [{page}/{max_page}]", file=sys.stderr)
                    await fetch_by_page(client, page)

        await asyncio.gather(*[consumer() for _ in range(parallel)])

    # get entries and reactions
    async def fetch_by_page(client: httpx.AsyncClient, page: int) -> None:
        # fetch entries
        init_data_res = await client.get(page_to_url(page))
        init_data = parse_init_data(init_data_res.text)
        entryMap: dict = init_data["entryState"]["entryMap"]
        entries: list[dict] = list(entryMap.values())

        # fetch reactions
        entryIds = "%2C".join(map(lambda e: str(e["entry_id"]), entries))
        reactions_res = await client.get(
            f"https://ameblo.jp/_api/blogEntryReactions;blogId={blog_id};entryIds={entryIds}"
        )
        reactions: dict = reactions_res.json()

        # output
        for entry in entries:
            reaction = reactions[str(entry["entry_id"])]
            result = dict(entry=entry, reaction=reaction)
            print(json.dumps(result, ensure_ascii=False))

    asyncio.run(fetch_pages())


def main_get_themes(ameba_id: str) -> None:
    main_init_data = parse_init_data(
        httpx.get(f"https://ameblo.jp/{ameba_id}/entrylist.html").text
    )
    themeMap: dict[str, dict] = main_init_data["themesState"]["themeMap"]
    result = {k: v["theme_name"] for k, v in themeMap.items()}
    print(json.dumps(result, ensure_ascii=False))


def main_cli():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command")

    sub1 = subparsers.add_parser("get_entries")
    sub1.add_argument("ameba_id")
    sub1.add_argument("--parallel", type=int, default=50)
    sub1.add_argument("--theme", type=str)

    sub2 = subparsers.add_parser("get_themes")
    sub2.add_argument("ameba_id")

    args = parser.parse_args().__dict__
    command = args.pop("command")
    globals()[f"main_{command}"](**args)


if __name__ == "__main__":
    main_cli()
