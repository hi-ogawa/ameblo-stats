import re
import json
import sys
from typing import Any, Optional
import urllib.request
import argparse

# TODO: parallel fetch with async httpx


def fetch(url: str) -> str:
    req = urllib.request.Request(url)
    res: bytes = urllib.request.urlopen(req).read()
    return res.decode("utf-8")


def parse_init_data(html: str) -> Any:
    match = re.search("<script>window\.INIT_DATA=({.*?});", html)
    assert match
    init_data_str = match.group(1)
    init_data = json.loads(init_data_str)
    return init_data


def main(ameba_id: str, limit_page: Optional[int]):
    base_url = f"https://ameblo.jp/{ameba_id}"

    # get blogId, max_page
    main_init_data = parse_init_data(fetch(f"{base_url}/entrylist.html"))
    blogPageMap: dict = main_init_data["entryState"]["blogPageMap"]
    blogPageMap: dict = list(blogPageMap.values())[0]
    blogId = blogPageMap["blogId"]
    max_page_actual = blogPageMap["paging"]["max_page"]
    print(f":: {blogId = }, {max_page_actual = }", file=sys.stderr)

    # get entries and reactions
    max_page = min(max_page_actual, limit_page or float("inf"))
    for i in range(1, max_page + 1):
        if i % 10 == 1 or i == max_page:
            print(f":: progress ({i}/{max_page})", file=sys.stderr)

        # fetch entries
        init_data = parse_init_data(fetch(f"{base_url}/entrylist-{i}.html"))
        entryMap: dict = init_data["entryState"]["entryMap"]
        entries: list[dict] = list(entryMap.values())

        # fetch reactions
        entryIds = "%2C".join(map(lambda e: str(e["entry_id"]), entries))
        reactions: dict = json.loads(
            fetch(
                f"https://ameblo.jp/_api/blogEntryReactions;blogId={blogId};entryIds={entryIds}"
            )
        )

        # output
        for entry in entries:
            reaction = reactions[str(entry["entry_id"])]
            print(json.dumps(dict(entry=entry, reaction=reaction), ensure_ascii=False))


def main_cli():
    parser = argparse.ArgumentParser()
    parser.add_argument("ameba_id")
    parser.add_argument("--limit-page", type=int)
    args = parser.parse_args()
    main(**args.__dict__)


if __name__ == "__main__":
    main_cli()
