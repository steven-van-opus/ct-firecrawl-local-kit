# Worked Creators Toolbox runs

These fixtures use fictional creator products. They are expected outputs, not live scrape results. Replace the `.example` URLs in `config/changelogs.json` before a real run. The script rejects them to prevent an accidental baseline of an error page.

## Changelog watch for Scout

Input list: FrameKit and ClipNest's public changelog URLs. First FrameKit markdown:

```markdown
# FrameKit updates
## November 12
- Export captions as SRT.
```

First run: `BASELINE <FrameKit changelog URL>`. A markdown file, empty `.diff`, and source metadata are saved in `state/changelogs/`. First runs establish a baseline; they do not manufacture news.

Next run adds these lines:

```markdown
## November 19
- Search transcripts by speaker.
```

Expected output: `CHANGED <FrameKit changelog URL>` and a unified `.md.diff` containing the two added lines. The `.md` baseline now contains both releases. A third identical run prints UNCHANGED and clears the diff. A failed scrape prints an error, exits nonzero, and retains the last successful baseline for that URL. Other URLs continue independently.

Editorial use: draft a Scout item titled "FrameKit adds speaker search" and link the source for review. Do not automatically publish the diff as news; navigation and date changes can also create diffs.

## Pricing snapshot for a creator guide

Input: a fictional FrameKit pricing page that scrapes to this explicit table:

```markdown
| Plan | Price | Currency | Billing |
| --- | --- | --- | --- |
| Starter | 0 | USD | monthly |
| Studio | 18 | USD | monthly |
| Team | Contact sales | | |
```

Run `node --env-file=.env examples/pricing-snapshot.mjs <real-pricing-URL> output/framekit.json` after replacing the URL. Expected `plans` value:

```json
[
  {"name":"Starter","price":"0","currency":"USD","billing":"monthly"},
  {"name":"Studio","price":"18","currency":"USD","billing":"monthly"},
  {"name":"Team","price":"Contact sales","currency":null,"billing":null}
]
```

The snapshot also records sourceUrl, capturedAt, and extractionMode. Prices remain strings so qualifiers and sales-only plans survive. Currency is not guessed from an ambiguous dollar sign. The output is checked against the fields and types in `pricing.schema.json`; malformed data never replaces a previous snapshot.

Local table mode intentionally stops on unsupported page layouts. On a separately configured full self-hosted API with a model provider, `--server-json` sends that schema to Firecrawl and validates the result. Firecrawl Local itself skips JSON formats, so do not use that flag against Local and expect extraction to work.
