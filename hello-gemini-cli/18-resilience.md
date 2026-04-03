---
layout: default
title: "韧性机制：重试策略、错误归一化与自愈路径"
---
# 韧性机制：重试策略、错误归一化与自愈路径

本文档分析 Gemini CLI 的韧性系统，涵盖重试策略、错误归一化与会话层自愈。

## 1. 韧性在 Gemini CLI 中的定位

Gemini CLI 的韧性机制分散在三个层次：

| 层次 | 位置 | 关键机制 |
|------|------|---------|
| **网络/API 层** | `GeminiClient.generateContent()` | 指数退避重试、速率限制降级 |
| **Agent 层** | `GeminiAgent.run()` | 工具执行失败自愈、坏流恢复 |
| **会话层** | `SessionManager` | 会话持久化、断线续接 |

## 2. API 层重试策略

### 2.1 `retryWithBackoff`

```typescript
// packages/core/src/core/client.ts
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetriable(error) || attempt === maxRetries) throw error;
      await sleep(baseDelayMs * Math.pow(2, attempt));
    }
  }
}
```

- **429（Rate Limit）**：触发指数退避，最多重试 3 次
- **5xx 服务错误**：同样纳入重试范围
- **4xx 客户端错误**（非 429）：不重试，直接抛出

### 2.2 流式响应修复

`GeminiChat.sendMessageStream()` 对截断/无效的模型输出进行实时纠偏：
- 检测 JSON 解析失败 → 尝试修复并重新解码
- 检测 Tool Call 格式异常 → 转为文本消息继续

## 3. Agent 层工具失败处理

### 3.1 工具执行失败不终止循环

```typescript
// packages/core/src/core/gemini-agent.ts
const result = await this.toolExecutor.execute(toolCall);
if (result.error) {
  // 将错误信息作为 tool result 返回给模型，让模型决定如何处理
  return { success: false, error: result.error };
}
```

工具失败的结果会以 `tool_result` 形式回传给模型，由模型决定：
- 换一个工具重试
- 调整参数后重试
- 跳过并继续任务

### 3.2 循环检测（Loop Detection）

`LoopDetector` 监控 Agent 行为，防止无限重复同一操作：

```typescript
// packages/core/src/utils/loop-detector.ts
class LoopDetector {
  private history: string[] = [];
  check(action: string): boolean {
    if (this.history.filter(h => h === action).length >= MAX_REPEAT) {
      return true; // 触发循环检测
    }
    this.history.push(action);
    return false;
  }
}
```

## 4. 会话层韧性

### 4.1 会话持久化防数据丢失

每轮 turn 结束后，`SessionManager` 将会话状态序列化到磁盘：

```
~/.gemini/sessions/<session-id>/conversation.json
```

即使进程崩溃，用户也可以用 `gemini --resume <session-id>` 恢复。

### 4.2 工具输出落盘（大输出韧性）

当工具返回超大输出时（如读取大文件），`ToolOutputDistillationService` 会：
1. 将完整输出写入临时文件
2. 向模型只提供摘要 + 引用路径
3. 防止单次超大输出导致上下文溢出崩溃

## 5. 与其他系统的对比

| 系统 | 重试机制 | 工具失败处理 | 会话韧性 |
|------|---------|------------|---------|
| **Gemini CLI** | `retryWithBackoff`（3次） | 错误回传模型 | 磁盘持久化 |
| **Claude Code** | Provider 级多重重试 | 工具错误作为结果 | Transcript 持久化 |
| **Codex** | `retry_config` + 指数退避 | Rust `Result<>` 类型安全 | Thread 持久化 |
| **OpenCode** | Effect-ts `retry` operator | 错误归一化 + 自愈 | SQLite durable |

## 6. 当前局限性

- 无全局超时机制：单次 Agent 循环可能无限运行
- 无跨会话重试编排（不支持 workflow-level retry）
- 网络分区场景下缺乏主动恢复逻辑
