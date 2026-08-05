/**
 * WebMCP Client - Browser-side MCP connection for Foldocs
 * Allows browsers to connect to MCP servers and access documentation tools.
 */

export interface WebMcpConfig {
  /** MCP server endpoint URL */
  readonly serverUrl: string
  /** Optional API key for authentication */
  readonly apiKey?: string
  /** Enable debug logging */
  readonly debug?: boolean
}

export interface McpTool {
  readonly name: string
  readonly description: string
  readonly inputSchema: Record<string, unknown>
}

export interface McpToolResult {
  readonly content: ReadonlyArray<{
    readonly type: 'text' | 'image' | 'resource'
    readonly text?: string
    readonly data?: string
    readonly mimeType?: string
  }>
}

export class WebMcpClient {
  private config: WebMcpConfig
  private tools: McpTool[] = []
  private connected = false

  constructor(config: WebMcpConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    if (this.connected) return

    try {
      const response = await fetch(this.config.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey !== undefined
            ? { Authorization: `Bearer ${this.config.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            clientInfo: {
              name: 'foldocs-webmcp',
              version: '0.1.0',
            },
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`MCP server returned ${response.status}`)
      }

      const data = await response.json() as {
        result?: { capabilities?: { tools?: unknown } }
      }
      if (data.result?.capabilities?.tools !== undefined) {
        await this.listTools()
      }

      this.connected = true
      if (this.config.debug) {
        console.log('[WebMCP] Connected to', this.config.serverUrl)
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('[WebMCP] Connection failed:', error)
      }
      throw error
    }
  }

  async listTools(): Promise<McpTool[]> {
    const response = await fetch(this.config.serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey !== undefined
          ? { Authorization: `Bearer ${this.config.apiKey}` }
          : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
    })

    if (!response.ok) {
      throw new Error(`MCP server returned ${response.status}`)
    }

    const data = await response.json() as {
      result?: { tools?: McpTool[] }
    }
    this.tools = data.result?.tools ?? []
    return this.tools
  }

  async callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<McpToolResult> {
    if (!this.connected) {
      await this.connect()
    }

    const response = await fetch(this.config.serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey !== undefined
          ? { Authorization: `Bearer ${this.config.apiKey}` }
          : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name,
          arguments: args,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`MCP server returned ${response.status}`)
    }

    const data = await response.json() as {
      result?: McpToolResult
      error?: { message?: string }
    }
    if (data.error !== undefined) {
      throw new Error(data.error.message ?? 'MCP tool call failed')
    }
    return data.result ?? { content: [] }
  }

  getTools(): McpTool[] {
    return this.tools
  }

  isConnected(): boolean {
    return this.connected
  }
}

export const createWebMcpClient = (config: WebMcpConfig): WebMcpClient => {
  return new WebMcpClient(config)
}
