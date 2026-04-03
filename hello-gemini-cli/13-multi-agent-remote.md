# Gemini CLI 多代理与远程模式：单 Agent 架构与工具级并行

本文档分析 Gemini CLI 的多代理支持与远程执行能力。

## 1. 多代理在 Gemini CLI 里的定位

### 1.1 基本架构

Gemini CLI 当前采用**单 Agent 架构**：

- 只有一个 Gemini 模型实例
- 工具调用通过 Turn 编排
- 不支持真正的多 Agent 协作

### 1.2 与其他项目的对比

| 特性 | Claude Code | Codex | OpenCode | Gemini CLI |
| --- | --- | --- | --- | --- |
| 多 Agent | Agents API | Thread 协议 | 多 Session | 无 |
| 工具并行 | 完整 | 有限 | 完整 | 基础 |
| 远程执行 | Bridge | app-server | HTTP/WS | 无 |
| Headless | 支持 | 支持 | 支持 | 支持 |

---

## 2. 单 Agent 架构

### 2.1 Agent 结构

```typescript
interface Agent {
  id: string
  model: string
  config: AgentConfig
  tools: Tool[]
}

class SingleAgent {
  constructor(
    private client: GeminiClient,
    private tools: ToolRegistry,
    private config: Config
  ) {}

  async run(request: Request): Promise<Response> {
    const context = this.assembleContext(request)
    const result = await this.client.sendMessage(context)
    return this.processResult(result)
  }
}
```

### 2.2 工具级并行

```typescript
async function executeToolsParallel(
  toolCalls: ToolCall[]
): Promise<ToolResult[]> {
  const results = await Promise.all(
    toolCalls.map(call => this.toolExecutor.execute(call))
  )
  return results
}
```

### 2.3 限制

| 限制 | 说明 |
| --- | --- |
| 单模型 | 只有一个 Gemini 实例 |
| 串行工具 | 按序执行工具调用 |
| 无子 Agent | 不支持 Agent 分叉 |

---

## 3. Headless 模式

### 3.1 Headless CLI

`packages/cli/src/non-interactive-cli.ts`：

```typescript
async function runNonInteractive(
  prompt: string,
  options: NonInteractiveOptions
): Promise<string> {
  const config = await initializeApp(options)
  const agent = new SingleAgent(
    new GeminiClient(config),
    new ToolRegistry(config),
    config
  )

  const response = await agent.run({
    message: prompt,
    history: []
  })

  return response.text
}
```

### 3.2 使用场景

| 场景 | 命令 |
| --- | --- |
| CI/CD | `gemini --non-interactive --prompt "..."` |
| 脚本自动化 | 通过 stdout 获取结果 |
| 管道集成 | 与其他工具组合 |

### 3.3 Headless vs TUI

| 模式 | 交互方式 | 使用场景 |
| --- | --- | --- |
| TUI | 交互式 | 开发调试 |
| Headless | 非交互 | 自动化脚本 |

---

## 4. 远程执行

### 4.1 当前状态

Gemini CLI **不支持远程执行**：

- 无 app-server
- 无 Bridge System
- 无 SDK 抽象层

### 4.2 远程架构缺失

```
Claude Code 的远程架构：
┌─────────┐     ┌─────────┐
│  CLI    │────▶│ Bridge  │────▶ Cloud
└─────────┘     └─────────┘

Gemini CLI 的当前架构：
┌─────────┐
│  CLI    │───▶ Gemini API
└─────────┘
```

### 4.3 与其他项目的对比

| 能力 | Claude Code | Codex | OpenCode | Gemini CLI |
| --- | --- | --- | --- | --- |
| 远程 CLI | Bridge | app-server | HTTP Server | 无 |
| SDK | QueryEngine | TypeScript SDK | HTTP API | 无 |
| Web | 支持 | 支持 | 支持 | 无 |
| Desktop | 支持 | 支持 | 支持 | 无 |

---

## 5. 工具级并行

### 5.1 工具执行策略

```typescript
interface ToolExecutionStrategy {
  // 串行执行
  sequential(calls: ToolCall[]): Promise<ToolResult[]>

  // 并行执行
  parallel(calls: ToolCall[]): Promise<ToolResult[]>

  // 依赖执行
  dependencyGraph(calls: ToolCall[]): Promise<ToolResult[]>
}
```

### 5.2 并行执行示例

```typescript
// 场景：用户请求读取多个文件
// 当前：串行执行
async function readMultipleFiles(paths: string[]): Promise<string[]> {
  const results = []
  for (const path of paths) {
    results.push(await readFile(path))
  }
  return results
}

// 理想：并行执行
async function readMultipleFilesParallel(paths: string[]): Promise<string[]> {
  return Promise.all(paths.map(path => readFile(path)))
}
```

### 5.3 依赖分析

```typescript
function analyzeDependencies(calls: ToolCall[]): DependencyGraph {
  const graph = new DependencyGraph()

  for (const call of calls) {
    // 检查输入是否依赖其他工具输出
    for (const prev of calls) {
      if (call.dependsOn(prev.id)) {
        graph.addEdge(call.id, prev.id)
      }
    }
  }

  return graph
}
```

---

## 6. 与 OpenCode 的多代理对比

### 6.1 OpenCode 的多代理

OpenCode 通过 Session 协议支持多代理：

```typescript
// OpenCode 的多代理结构
interface MultiAgentSystem {
  sessions: Map<string, Session>
  agents: Map<string, Agent>
  messageBus: GlobalBus
}

// Agent 间通信
agentA.sendMessage({ to: 'agentB', content: '...' })
```

### 6.2 主要差异

| 特性 | OpenCode | Gemini CLI |
| --- | --- | --- |
| 多 Agent | 完整 | 无 |
| Agent 通信 | GlobalBus | 无 |
| 并行工具 | 完整 | 基础 |
| 远程执行 | HTTP Server | 无 |

---

## 7. 改进建议

### 7.1 短期增强

1. **工具并行**：实现无依赖工具的并行执行
2. **Headless 增强**：支持更多 CLI 参数
3. **会话管理**：增强 Session 管理

### 7.2 长期规划

| 能力 | 实现建议 |
| --- | --- |
| 多 Agent | 实现 Agent 协议 |
| 远程 CLI | 开发轻量级 app-server |
| SDK | 封装 GeminiClient |

---

## 8. 关键源码锚点

| 主题 | 代码锚点 | 说明 |
| --- | --- | --- |
| Agent | `packages/core/src/agent.ts` | 单 Agent 实现 |
| Headless | `packages/cli/src/non-interactive-cli.ts` | 非交互 CLI |
| ToolExecutor | `packages/core/src/tools/tool-executor.ts` | 工具执行 |
| 工具注册 | `packages/core/src/tools/tool-registry.ts` | 工具注册表 |

---

## 9. 总结

Gemini CLI 的多代理与远程能力相比 OpenCode 非常基础：

1. **单 Agent**：只有一个 Gemini 实例
2. **串行工具**：按序执行工具调用
3. **Headless**：支持非交互执行
4. **远程**：不支持

缺少 OpenCode 的多 Agent、GlobalBus、HTTP Server 等机制。对于单人本地使用，当前架构足以支撑。

---

> 关联阅读：[03-agent-loop.md](./03-agent-loop.md) 了解 Agent 循环详情。
