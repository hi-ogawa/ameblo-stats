# ameblo-stats

practicing some scraping, plotting, etc...

```sh
# explore data
curl -sf https://ameblo.jp/juicejuice-official/entrylist.html > data/entrylist.html
curl -sf https://ameblo.jp/juicejuice-official/entrylist.html | python -c 'import re, sys; print(re.search("<script>window\.INIT_DATA=({.*?});", sys.stdin.read()).group(1))' | jq > data/test-init-data.json
curl -sf https://ameblo.jp/morningmusume-9ki/theme-10059757620.html > data/entrylist-by-theme.html
curl -sf https://ameblo.jp/morningmusume-9ki/theme-10059757620.html | python -c 'import re, sys; print(re.search("<script>window\.INIT_DATA=({.*?});", sys.stdin.read()).group(1))' | jq > data/test-init-data-by-theme.json

# scrape entries and reaction counts
poetry install
poetry shell

python scrape.py get_entries ocha-norma > data/ocha-norma.ndjson
python scrape.py get_entries juicejuice-official --parallel 50 > data/juicejuice-official.ndjson

# filter by theme
python scrape.py get_themes morningmusume-9ki
python scrape.py get_entries morningmusume-9ki --theme θ­δΉζθ > data/fukumura.ndjson

# visualize reaction counts with python notebook
# - see visualize.ipynb
```
