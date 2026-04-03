# Gemini CLI 插件系统：MCP 集成、JSON-RPC 协议与信任校验

本文档分析 Gemini CLI 的插件扩展机制。

## 1. 插件系统在 Gemini CLI 里的定位

### 1.1 基本架构

Gemini CLI 的插件系统基于 MCP（Model Context Protocol）：

- MCP Server 作为插件提供工具
- 通过 JSON-RPC 与 Server 通信
- McpClientManager 负责生命周期管理

### 1.2 与其他项目的对比

| 特性 | Claude Code | Codex | OpenCode | Gemini CLI |
| --- | --- | --- | --- | --- |
| 插件协议 | MCP | MCP | MCP | MCP |
| 工具映射 | 完整 | 完整 | 完整 | 基础 |
| 资源访问 | 支持 | 支持 | 支持 | 无 |
| 提示注入 | 支持 | 支持 | 支持 | 无 |

---

## 2. McpClientManager

### 2.1 架构

```typescript
class McpClientManager {
  private clients: Map<string, McpClient> = new Map()

  async initialize(config: McpConfig): Promise<void> {
    for (const [name, serverConfig] of Object.entries(config.servers)) {
      const client = await this.createClient(name, serverConfig)
      this.clients.set(name, client)
    }
  }

  async createClient(
    name: string,
    config: ServerConfig
  ): Promise<McpClient> {
    const client = new McpClient({
      command: config.command,
      args: config.args,
      env: config.env
    })

    await client.connect()
    return client
  }

  getClient(name: string): McpClient | undefined {
    return this.clients.get(name)
  }
}
```

### 2.2 生命周期

```mermaid
%%{init: {'theme': 'neutral'}}%%
flowchart LR
    A[启动] --> B[加载配置]
    B --> C[启动 Server 进程]
    C --> D[建立 stdio 连接]
    D --> E[握手认证]
    E --> F[就绪]
    F --> G[工具调用]
    G --> H[关闭时清理]
```

---

## 3. MCP JSON-RPC 协议

### 3.1 通信格式

MCP 使用 JSON-RPC 2.0 over stdio：

```typescript
// 请求
interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: any
}

// 响应
interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: any
  error?: JsonRpcError
}
```

### 3.2 核心方法

| 方法 | 说明 | 对应功能 |
| --- | --- | --- |
| `initialize` | 初始化连接 | 握手 |
| `tools/list` | 列出可用工具 | 工具发现 |
| `tools/call` | 调用工具 | 工具执行 |
| `resources/list` | 列出资源 | 资源访问 |
| `resources/read` | 读取资源 | 资源获取 |

### 3.3 工具调用示例

```typescript
// 1. 列出工具
const listRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
}

// 2. 调用工具
const callRequest = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'read_file',
    arguments: { path: '/tmp/test.txt' }
  }
}

// 3. 响应
const response = {
  jsonrpc: '2.0',
  id: 2,
  result: {
    content: [{ type: 'text', text: 'file contents' }]
  }
}
```

---

## 4. 信任校验

### 4.1 校验层级

| 层级 | 说明 |
| --- | --- |
| 启动校验 | Server 签名、权限 |
| 工具校验 | 工具名称、参数 |
| 运行时校验 | 调用频率、资源 |

### 4.2 安全配置

```typescript
interface SecurityConfig {
  allowedTools?: string[]       // 只允许的工具
  blockedTools?: string[]       // 禁止的工具
  maxCallsPerMinute?: number    // 调用频率限制
  requireApproval?: string[]    // 需要审批的工具
}

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxCallsPerMinute: 60,
  requireApproval: ['Bash', 'Write', 'Delete']
}
```

### 4.3 审批流程

```typescript
async function approveToolCall(
  tool: string,
  params: any
): Promise<boolean> {
  const security = this.config.security

  // 检查是否需要审批
  if (!security.requireApproval?.includes(tool)) {
    return true
  }

  // 发送审批请求
  const result = await this.messageBus.emitAsync('approval:required', {
    tool,
    params
  })

  return result.approved
}
```

---

## 5. MCP Server 配置

### 5.1 配置文件

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": {}
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git"],
      "env": {}
    }
  }
}
```

### 5.2 环境变量

```typescript
function buildServerEnv(
  serverConfig: ServerConfig,
  processEnv: NodeJS.ProcessEnv
): Record<string, string> {
  return {
    ...processEnv,
    ...serverConfig.env
  }
}
```

---

## 6. 与 OpenCode 的 MCP 对比

### 6.1 主要差异

| 特性 | OpenCode | Gemini CLI |
| --- | --- | --- |
| MCP 版本 | 完整 | 基础 |
| 资源访问 | 完整 | 无 |
| 提示注入 | 支持 | 无 |
| 采样 | 支持 | 无 |
| 工具过滤 | 完整 | 基础 |

### 6.2 OpenCode 的 MCP 能力

```typescript
// OpenCode 的 MCP 完整能力
interface McpClient {
  // 工具
  listTools(): Promise<Tool[]>
  callTool(name: string, args: any): Promise<ToolResult>

  // 资源
  listResources(): Promise<Resource[]>
  readResource(uri: string): Promise<ResourceContent>

  // 提示
  listPrompts(): Promise<Prompt[]>
  getPrompt(name: string, args?: any): Promise<PromptResult>

  // 采样
  createSamplingRequest(): Promise<SamplingResult>
}
```

---

## 7. 改进建议

### 7.1 短期增强

1. **资源访问**：实现 resources/list 和 resources/read
2. **提示注入**：支持 prompts/* 方法
3. **工具过滤**：增强安全配置

### 7.2 长期规划

| 能力 | 实现建议 |
| --- | --- |
| 完整 MCP | 支持所有 MCP 能力 |
| 采样 | 实现 sampling/createMessage |
| 工具市场 | MCP Server 发现 |

---

## 8. 关键源码锚点

| 主题 | 代码锚点 | 说明 |
| --- | --- | --- |
| McpClientManager | `packages/core/src/tools/mcp-client-manager.ts` | MCP 客户端管理 |
| JSON-RPC | `packages/core/src/tools/mcp-json-rpc.ts` | JSON-RPC 协议 |
| 安全配置 | `packages/core/src/config/security.ts` | 安全配置 |
| 审批流程 | `packages/core/src/tools/approval.ts` | 工具审批 |

---

## 9. 总结

Gemini CLI 的插件系统相比 OpenCode 较为基础：

1. **MCP 客户端**：基础的 McpClientManager
2. **JSON-RPC**：stdio 通信
3. **信任校验**：基础的工具审批
4. **配置**：JSON 配置文件

缺少 OpenCode 的资源访问、提示注入、采样等完整 MCP 能力。对于基础的 MCP 工具调用，当前架构足以支撑。

---

> 关联阅读：[06-extension-mcp.md](./06-extension-mcp.md) 了解 MCP 扩展详情。
