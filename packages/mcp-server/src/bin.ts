import { startFoldocsMcpServer } from './index.js'

const serverUrl = process.env.FOLDOCS_MCP_SERVER_URL
const manifestPath = process.env.FOLDOCS_MCP_MANIFEST_PATH

if (serverUrl === undefined) {
  console.error(
    'Error: FOLDOCS_MCP_SERVER_URL environment variable is required.',
  )
  console.error(
    'Usage: FOLDOCS_MCP_SERVER_URL=https://docs.example.com foldocs-mcp',
  )
  process.exit(1)
}

await startFoldocsMcpServer({
  baseUrl: serverUrl,
  manifestPath,
})
