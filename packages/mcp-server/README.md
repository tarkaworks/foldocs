# Foldocs MCP Server

Read a deployed Foldocs site's `agent-readability.json` through a local Model
Context Protocol server.

## Workspace build

```bash
pnpm --filter @foldocs/mcp-server build
```

## Usage

```bash
FOLDOCS_MCP_SERVER_URL=https://docs.example.com foldocs-mcp
```

The stdio server exposes `search_docs` (ranked full-text search over the
site's published `search-index.json`, the same index and relevance ranking
the site's own search box uses), `get_page`, `list_sections` (an orientation
view of pages grouped by top-level navigation section), and `get_site_info`.
Set `FOLDOCS_MCP_MANIFEST_PATH` when the manifest is not served at
`/agent-readability.json`.

This package is private to the Foldocs monorepo. `ai.mcp` discovery can point
at a separately deployed Streamable HTTP implementation.

## Documentation

[Read the Foldocs documentation](https://foldocs.vercel.app/en/docs/core/agent-readability#mcp-server).

## License

[MIT](https://github.com/tarkaworks/foldocs/blob/main/LICENSE)
