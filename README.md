# ameblo-stats

practicing some scraping, pandas, plotting, etc...

```sh
# explore data
curl -sf https://ameblo.jp/juicejuice-official/entrylist.html > data/entrylist.html
curl -sf https://ameblo.jp/juicejuice-official/entrylist.html | python -c 'import re, sys; print(re.search("<script>window\.INIT_DATA=({.*?});", sys.stdin.read()).group(1))' | jq > data/test-init-data.json

# scrape entries and reaction counts
python scrape.py ocha-norma > data/ocha-norma.ndjson
python scrape.py juicejuice-official --limit-page 200 > data/juicejuice-official.ndjson

# visualize reaction counts with python notebook
# - see visualize.ipynb
```
