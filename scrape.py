import argparse
import asyncio
import json
import re
import sys
from typing import Any, Optional

import httpx


def parse_init_data(html: str) -> Any:
    match = re.search("<script>window\.INIT_DATA=({.*?});", html)
    assert match
    init_data_str = match.group(1)
    init_data = json.loads(init_data_str)
    return init_data


def main(ameba_id: str, parallel: int, limit_page: Optional[int]):
    # get blogId, max_page
    main_init_data = parse_init_data(
        httpx.get(f"https://ameblo.jp/{ameba_id}/entrylist.html").text
    )
    blogPageMap: dict = main_init_data["entryState"]["blogPageMap"]
    blogPageMap: dict = list(blogPageMap.values())[0]
    blogId = blogPageMap["blogId"]
    max_page_actual = blogPageMap["paging"]["max_page"]
    max_page = min(max_page_actual, limit_page or float("inf"))
    print(f":: {blogId = }, {max_page_actual = }", file=sys.stderr)

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
        init_data_res = await client.get(
            f"https://ameblo.jp/{ameba_id}/entrylist-{page}.html"
        )
        init_data = parse_init_data(init_data_res.text)
        entryMap: dict = init_data["entryState"]["entryMap"]
        entries: list[dict] = list(entryMap.values())

        # fetch reactions
        entryIds = "%2C".join(map(lambda e: str(e["entry_id"]), entries))
        reactions_res = await client.get(
            f"https://ameblo.jp/_api/blogEntryReactions;blogId={blogId};entryIds={entryIds}"
        )
        reactions: dict = reactions_res.json()

        # output
        for entry in entries:
            reaction = reactions[str(entry["entry_id"])]
            result = dict(entry=entry, reaction=reaction)
            print(json.dumps(result, ensure_ascii=False))

    asyncio.run(fetch_pages())


def main_cli():
    parser = argparse.ArgumentParser()
    parser.add_argument("ameba_id")
    parser.add_argument("--parallel", type=int, default=25)
    parser.add_argument("--limit-page", type=int)
    args = parser.parse_args()
    main(**args.__dict__)


if __name__ == "__main__":
    main_cli()
