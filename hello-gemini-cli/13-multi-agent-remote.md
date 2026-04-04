# Gemini CLI 多代理与远程模式：本地子代理、A2A 远程代理与调度器

旧版文档把 Gemini CLI 概括成“单 Agent CLI”，这已经明显过时。当前仓库里不仅有本地子代理，也有远程代理与对应的调度、认证、进度回传链路。

## 1. Agent 不是一个，而是一套注册表

多代理能力的入口是 `packages/core/src/agents/registry.ts` 中的 `AgentRegistry`。

它会加载四类 agent：

- 内建 agent
- 用户级 agent
- 项目级 agent
- extension 提供的 agent

当前内建项至少包括：

- `CodebaseInvestigatorAgent`
- `CliHelpAgent`
- `GeneralistAgent`
- `BrowserAgentDefinition`
- `MemoryManagerAgent`（按配置启用）

所以，Gemini CLI 现在的真实情况是“主代理 + 可注册子代理”，而不是“完全没有多代理”。

## 2. 子代理会被暴露成普通工具

`packages/core/src/agents/subagent-tool.ts` 里的 `SubagentTool` 会把 agent definition 包装成一个普通 declarative tool：

- 名称沿用 agent 名称
- 输入参数来自 agent 的 JSON Schema
- 调用前会做 schema 校验
- 执行时通过 `SubagentToolWrapper` 继续分派到本地或远程实现

这也是为什么在主循环里，子代理看起来像是“一个工具调用”，但内部其实已经切换到另一套执行上下文。

## 3. 本地子代理有独立执行环境

本地 agent 的真正执行者是 `packages/core/src/agents/local-executor.ts`。

它不是简单复用主代理状态，而是显式创建隔离环境：

- 独立的 `ToolRegistry`
- 独立的 `PromptRegistry`
- 独立的 `ResourceRegistry`
- 派生后的 `MessageBus`
- 单独的 chat recording，`kind` 标记为 `subagent`

同时它还会做几件关键事情：

- 从父级 registry 里挑选允许使用的工具
- 阻止 agent 再调用其他 agent，避免递归套娃
- 支持 agent 自己挂载 MCP server
- 通过 `scheduleAgentTools()` 接入调度器
- 在长会话里继续复用压缩、恢复、超时与恢复逻辑

换句话说，本地子代理并不是“主代理切换一个 prompt 继续跑”，而是真正隔离出一套执行回路。

## 4. 远程代理通过 A2A 调用

Gemini CLI 也并非完全没有远程代理。远程分支在 `packages/core/src/agents/remote-invocation.ts`：

- 使用 `A2AClientManager` 连接远端 agent
- 支持认证 provider
- 维护 `contextId` / `taskId`
- 流式接收远端执行进度
- 把远端活动重新组装成可显示的 `SubagentProgress`

当前实现里，远程 agent 调用默认仍要求确认，这一点在 `getConfirmationDetails()` 中写得很明确。

因此更准确的表述是：

- **没有 Codex / OpenCode 那种通用 app-server 宿主**
- **但已经有 A2A 形式的远程 agent 调用能力**

## 5. 并行能力也不只停留在设想里

Gemini CLI 的并行不只是“未来可以做”，当前就已经有相当明确的调度实现：

- 主线调度器：`packages/core/src/scheduler/scheduler.ts`
- 子代理调度入口：`packages/core/src/agents/agent-scheduler.ts`
- 并行测试：`packages/core/src/scheduler/scheduler_parallel.test.ts`

这说明当前仓库已经具备工具级并行的真实实现基础，而不是纯串行执行模型。

## 6. 当前边界在哪里

虽然多代理能力已经存在，但它的边界也很清楚：

- 主产品形态仍然是 CLI / TUI，而不是独立 server
- 子代理主要以“工具化调用”的方式接入，而不是长期常驻会话
- 本地子代理默认不允许互相递归调用
- 远程代理集中走 A2A，不是统一的浏览器/桌面桥接协议

## 7. 关键源码锚点

| 主题 | 代码锚点 | 说明 |
| --- | --- | --- |
| Agent 注册 | `packages/core/src/agents/registry.ts` | 发现并注册本地/远程 agent |
| 子代理工具封装 | `packages/core/src/agents/subagent-tool.ts` | 把 agent 暴露成普通工具 |
| 本地子代理执行 | `packages/core/src/agents/local-executor.ts` | 隔离 registry、message bus 与执行循环 |
| 远程代理调用 | `packages/core/src/agents/remote-invocation.ts` | A2A 远程 agent 流式调用 |
| 子代理调度 | `packages/core/src/agents/agent-scheduler.ts` | 把 agent 工具调用接入调度器 |
| 主调度器 | `packages/core/src/scheduler/scheduler.ts` | 主/子代理共用的调度基础设施 |
