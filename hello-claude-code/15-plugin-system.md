---
layout: content
title: "Plugin 系统：JS/TS 插件的加载、命令贡献与 Hooks 注册"
---
# Plugin 系统：JS/TS 插件的加载、命令贡献与 Hooks 注册

本文深度分析 Claude Code 的 Plugin 系统，包括插件加载机制、插件可以贡献的能力（命令、工具、Hooks），以及与 Skill 和 MCP 的边界区分。

> 另见：[06-extension-mcp](./06-extension-mcp.md) — Plugin 在整个扩展体系中的位置

## 1. Plugin 是什么

Claude Code 的 Plugin 是**以 JavaScript/TypeScript 编写的扩展模块**，可以贡献：
- 新的 Slash 命令
- 新的工具
- Lifecycle Hooks
- 子 Agent 定义

Plugin 比 Skill 更强大（可编程），比 MCP 更轻量（同进程运行）。

## 2. Plugin 文件格式

```typescript
// .claude/plugins/my-plugin/index.js
module.exports = {
  name: 'my-plugin',
  version: '1.0.0',
  
  // 贡献命令
  commands: [
    {
      name: 'deploy',
      description: '部署应用到生产环境',
      handler: async ({ args, tools }) => {
        const result = await tools.bash(`./deploy.sh ${args}`);
        return result;
      },
    },
  ],
  
  // 贡献工具
  tools: [
    {
      name: 'get_jira_ticket',
      description: '获取 Jira 工单信息',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } } },
      handler: async ({ id }) => {
        return await jiraClient.getIssue(id);
      },
    },
  ],
  
  // 注册 Hooks
  hooks: {
    preToolCall: async ({ tool, input }) => {
      console.log(`About to call tool: ${tool}`);
    },
    postToolCall: async ({ tool, result }) => {
      await auditLog.record(tool, result);
    },
  },
};
```

## 3. Plugin 加载机制

### 3.1 扫描路径

```typescript
// src/utils/plugins/loadPluginCommands.ts
const PLUGIN_PATHS = [
  '~/.claude/plugins/',      // 用户全局插件
  '.claude/plugins/',        // 项目级插件
];

export async function loadPlugins(cwd: string): Promise<Plugin[]> {
  const dirs = await findPluginDirs(cwd);
  return Promise.all(dirs.map(dir => loadPlugin(dir)));
}
```

### 3.2 插件隔离

Plugin 在**主进程**中运行（非独立进程），通过沙箱化的 `tools` API 与 Claude Code 交互，而非直接调用内部 API：

```typescript
// 插件只能访问受限的 tools API
interface PluginTools {
  bash(cmd: string): Promise<string>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  // 不能访问内部 state、session 等
}
```

## 4. 插件贡献的能力

### 4.1 命令贡献

Plugin 命令与内置命令、Skill 命令共享同一命令总线，用户通过相同方式调用：

```bash
/deploy production  # 由插件提供的命令
/commit             # 内置命令
/review file.ts     # 由 Skill 提供
```

### 4.2 工具贡献

Plugin 贡献的工具与内置工具同等优先级，模型可以直接调用：

```json
{
  "type": "tool_call",
  "name": "get_jira_ticket",  // 插件工具
  "input": { "id": "PROJ-123" }
}
```

### 4.3 Hooks 注册

Plugin 可以在工具调用生命周期中注入逻辑：

| Hook | 触发时机 | 典型用途 |
|------|---------|---------|
| `preToolCall` | 工具调用前 | 审计日志、权限检查 |
| `postToolCall` | 工具调用后 | 结果后处理、通知 |
| `onSessionStart` | 会话开始 | 环境初始化 |
| `onSessionEnd` | 会话结束 | 清理、统计 |

## 5. 与 Skill、MCP 的边界

| 特性 | Plugin | Skill | MCP |
|------|--------|-------|-----|
| **实现语言** | JS/TS | Markdown | 任意 |
| **运行位置** | 主进程 | 主进程（Prompt 注入）| 独立进程 |
| **贡献命令** | ✅ | ✅ | ❌ |
| **贡献工具** | ✅ | ❌ | ✅ |
| **注册 Hooks** | ✅ | ❌ | ❌ |
| **访问内部 API** | 受限 | 无 | 无 |
| **进程隔离** | 无（同进程）| 无 | 有 |
| **崩溃影响** | 影响主进程 | 无 | 不影响主进程 |

**何时选择 Plugin**：
- 需要编程逻辑（条件判断、API 调用）
- 需要贡献工具到模型工具表
- 需要 Hooks 监听生命周期事件
- 不需要进程隔离（信任代码）

**何时选择 MCP**：
- 需要进程隔离（不信任代码/第三方服务）
- 需要跨 AI 工具共享工具实现
- 需要支持多语言实现
