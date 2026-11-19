# Creators Toolbox Firecrawl Local Kit

Original Node examples for collecting product changes and pricing evidence for [Creators Toolbox](https://creatorstoolbox.com). Firecrawl runs separately on your machine. This kit sends HTTP requests to it and saves small text snapshots.

No Firecrawl source is copied or vendored. The examples use Node's built-in fetch, so package.json has no runtime dependencies and no npm install is needed for them. The optional MCP configuration runs Firecrawl's own external npm package.

## Run Firecrawl locally

Source check: 2026-11-19. The [root README](https://github.com/firecrawl/firecrawl#readme) links to [Firecrawl Local](https://github.com/firecrawl/firecrawl/tree/main/apps/local), whose README supplies the actual local-run command: `firecrawl-local serve`. Use that Local README as the source of truth, rather than assuming the full Docker stack is required.

If the binary is already installed, run:

```bash
FIRECRAWL_CLOUD=off firecrawl-local serve
```

It listens on loopback port 3002. In another terminal, check `curl http://127.0.0.1:3002/health`. Local scraping needs no API key by default. Setting FIRECRAWL_CLOUD=off on the server disables its cloud handoff, including blocked-page fallback. Search and other cloud-only tools will then be unavailable.

For a later installation, Firecrawl's documented command is `cargo install firecrawl-local`, with Rust and a C compiler required. Chrome or Chromium enables JavaScript rendering; Node 22 or newer supports its MCP bridge. Installation and compilation can use significant disk space. This kit does not perform them. Check the current [Local installation instructions](https://github.com/firecrawl/firecrawl/tree/main/apps/local#install) before running that command.

The [full self-hosting guide](https://docs.firecrawl.dev/contributing/self-host) and [SELF_HOST.md](https://github.com/firecrawl/firecrawl/blob/main/SELF_HOST.md) describe a separate server deployment. Use those instructions if you need AI-backed JSON extraction. Firecrawl Local's current limits explicitly say local scrape skips JSON and summary formats. We do not assume advertised speed or memory improvements apply to your workload.

## Configure these examples

Use Node 22 or newer. From this kit's root:

```bash
cp .env.example .env
```

The examples read FIRECRAWL_API_URL as a base origin, defaulting to `http://127.0.0.1:3002`. Do not append `/v2`. Leave FIRECRAWL_API_KEY empty for the default Local server; set it when your chosen API requires a bearer token. Keep `.env` untracked.

This variable belongs to our HTTP client and the separate firecrawl-mcp process. In the firecrawl-local binary itself, FIRECRAWL_API_URL configures the cloud upstream. Do not source this kit's `.env` into the shell launching that binary. Start the binary with the server command above and load the client env only through the Node commands below.

If you choose an SDK later, pass its apiUrl option explicitly to the same origin. SDKs do not necessarily read this kit's environment variables automatically. See the current [Local SDK examples](https://github.com/firecrawl/firecrawl/tree/main/apps/local#run-the-firecrawl-api-locally).

## Watch product changelogs

Replace the fictional URLs in [config/changelogs.json](./config/changelogs.json) with public changelogs for products listed on creatorstoolbox.com. The sample domains are rejected until replaced.

```bash
node --env-file=.env examples/changelog-watch.mjs config/changelogs.json
```

Each URL is scraped sequentially to markdown. The first run records a baseline. Later runs write a unified diff against the previous successful scrape, then advance that baseline. Identical runs clear the diff. Failures retain the previous successful snapshot for the failed URL and set a nonzero exit code. Outputs live in ignored `state/changelogs/`, named with hostname plus URL hash. Run one watcher at a time per state directory. There is no automatic scheduler or publisher.

Review the diff before drafting a Scout post or newsletter item. A timestamp or navigation change is not a product launch. Respect the source site's access rules and choose a reasonable schedule outside this kit.

## Snapshot pricing

For a page that returns an explicit Plan and Price markdown table, run:

```bash
node --env-file=.env examples/pricing-snapshot.mjs https://your-product.example/pricing output/product-pricing.json
```

Replace the example URL. Local table mode extracts exact strings and optional Currency and Billing columns. It follows [examples/pricing.schema.json](./examples/pricing.schema.json) and validates the result before writing. It cannot infer plan structure from arbitrary cards. If no supported table is present, it stops with an actionable error and keeps any previous output. It never treats an absent price as free.

For a full self-hosted API that supports the JSON format and has a model provider configured, point FIRECRAWL_API_URL at that server and add `--server-json`. This mode submits the same JSON schema to `/v2/scrape` using the documented [JSON format](https://docs.firecrawl.dev/features/scrape#json). Provider availability, credentials, and charges are governed by that deployment. The Local binary does not implement this format; a missing JSON response is an error.

The saved snapshot includes source URL, capture time, extraction mode, plan names, literal prices, and any stated billing or currency. It is evidence for an editor, not an authoritative pricing database. See [worked runs](./examples/worked-runs.md) for two concrete Creators Toolbox scenarios and expected outputs.

## Connect an MCP client

Start the Local server first. [mcp/claude-code-cursor.json](./mcp/claude-code-cursor.json) contains an entry for Claude Code's project `.mcp.json` or Cursor's project `.cursor/mcp.json`. [mcp/codex.toml](./mcp/codex.toml) contains an entry to merge into Codex's `config.toml` MCP configuration. Merge only the named entry; preserve other servers. These snippets are examples and have not been installed on your machine.

The snippets launch external `firecrawl-mcp@3.40.0` over stdio and set FIRECRAWL_API_URL to the running local instance. That version is the one shown in the [current Firecrawl local MCP documentation](https://docs.firecrawl.dev/mcp-server/local). `npx` may download the package on first use. The MCP process is a bridge; starting it alone does not start the Firecrawl API. If your server requires authentication, add FIRECRAWL_API_KEY through your client's local secret configuration.

Alternatively, Firecrawl's Local README documents registering `firecrawl-local mcp` directly. That command starts its own loopback API and bridge. Its `init` command can edit several clients' configuration; review `firecrawl-local init --dry-run` before using it. The supplied snippets use the existing `serve` instance so the API target stays explicit. Restart your client and request one public-page scrape to check the connection; client setup was not exercised while writing this kit.

## Checks

```bash
node --test tests/examples.test.mjs
```

Tests use a loopback mock API and temporary files. They check baseline changes, preserved snapshots after failures, table extraction, server-schema requests, and rejected malformed output. They do not start Firecrawl or measure live scraping quality.

## Credit

Inspired by [Firecrawl Local](https://github.com/firecrawl/firecrawl/tree/main/apps/local) and the [Firecrawl announcement](https://x.com/firecrawl/status/2123096169630912637). The announcement was not retrievable during source review; commands and limits were checked against Firecrawl's repository and documentation. Not affiliated with Firecrawl.

## License

MIT, copyright Creators Toolbox. See [LICENSE](./LICENSE). This covers our starter files only. [Firecrawl](https://github.com/firecrawl/firecrawl) and its Local crate are AGPL-3.0 external software. Firecrawl's repository notes that some SDK and UI directories use MIT; the separate [MCP server](https://github.com/firecrawl/firecrawl-mcp-server) is MIT. Their licenses remain their own. No Firecrawl implementation code is included here.
