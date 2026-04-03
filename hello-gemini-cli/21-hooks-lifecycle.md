---
layout: default
title: "Hooks 与生命周期：Gemini CLI 的事件回调与扩展点"
---
# Hooks 与生命周期：Gemini CLI 的事件回调与扩展点

本文分析 Gemini CLI 的生命周期事件体系与扩展点设计。

## 1. Gemini CLI 生命周期概览

```
进程启动
  → 解析 CLI 参数（parseArgs）
  → 加载配置（loadConfig）
  → 初始化 GeminiAgent
  → 启动 Ink TUI 或非交互模式
      → 用户输入 → GeminiAgent.run()
          → buildPrompt()
          → GeminiClient.sendMessageStream()
          → 流式接收 → 工具调用
          → ToolExecutor.execute()
          → 工具结果回传
          → 循环直到完成
  → 会话结束 → 持久化
```

## 2. 可扩展的事件点

### 2.1 工具调用生命周期

```typescript
// packages/core/src/tools/tool-executor.ts
export class ToolExecutor {
  async execute(toolCall: ToolCall): Promise<ToolResult> {
    // 前置：权限检查
    const approved = await this.policyEngine.check(toolCall);
    if (!approved) return { error: 'denied' };
    
    // 执行
    const result = await this.tools[toolCall.name].execute(toolCall.args);
    
    // 后置：输出蒸馏（大输出截断）
    return this.distillationService.process(result);
  }
}
```

### 2.2 MessageBus 事件

Gemini CLI 的 `MessageBus` 是轻量级事件总线，TUI 组件通过它监听 Agent 状态变化：

```typescript
// packages/core/src/utils/message-bus.ts
type GeminiEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_start'; tool: string }
  | { type: 'tool_end'; tool: string; duration_ms: number }
  | { type: 'turn_complete'; usage: TokenUsage }
  | { type: 'error'; error: Error };

messageBus.on('tool_start', (e) => updateUI(e));
messageBus.on('turn_complete', (e) => saveSession(e));
```

### 2.3 Session 生命周期

```typescript
// 会话开始
SessionManager.create() → 分配 session_id → 加载历史

// 每轮结束
SessionManager.save(turn) → 序列化到磁盘

// 会话结束
SessionManager.finalize() → 写入最终状态
```

## 3. 与 Claude Code Hooks 的对比

| 特性 | Gemini CLI | Claude Code |
|------|------------|-------------|
| **Hook 配置** | 无用户级 Hook 配置 | settings.json hooks 字段 |
| **事件总线** | MessageBus（内部）| 无独立事件总线 |
| **工具前后拦截** | PolicyEngine（内置）| PreToolCall/PostToolCall Hook |
| **用户可扩展** | 通过 MCP 间接扩展 | ✅ 直接配置 Shell Hook |

Gemini CLI 目前没有向用户暴露类似 Claude Code `hooks` 的配置接口。事件回调主要服务于内部 TUI 更新和 Session 持久化，扩展能力通过 MCP 工具实现。
