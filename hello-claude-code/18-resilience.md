---
layout: content
title: "韧性机制：重试策略、Provider 故障转移与长会话稳定性"
---
# 韧性机制：重试策略、Provider 故障转移与长会话稳定性

本文分析 Claude Code 的韧性系统，包括 API 层重试、Provider 故障转移、Token 溢出自愈，以及长会话稳定性保障。

> 另见：[07-error-security](./07-error-security.md) — 错误类型分类与安全边界  
> 另见：[08-performance](./08-performance.md) — Prompt Cache 与长会话性能

## 1. 韧性体系层次

Claude Code 的韧性机制分布在三个层次：

| 层次 | 关键机制 | 实现位置 |
|------|---------|---------|
| **API 层** | 重试、退避、Provider 切换 | `api-provider-retry-errors` |
| **Session 层** | Context 压缩、Token 自愈 | `performance-cache-context` |
| **存储层** | Transcript 持久化、会话恢复 | `session-storage-and-resume` |

## 2. API 层重试策略

### 2.1 指数退避重试

```typescript
// src/services/api/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 30000 } = options;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetriable(error) || attempt === maxRetries) throw error;
      
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000, // jitter
        maxDelay
      );
      await sleep(delay);
    }
  }
}
```

### 2.2 可重试错误类型

| HTTP 状态码 | 错误类型 | 重试策略 |
|------------|---------|---------|
| `429` | Rate Limit | 指数退避，尊重 `Retry-After` 头 |
| `500`, `502`, `503` | 服务器错误 | 指数退避 |
| `529` | API Overloaded | 指数退避，最长等待 30s |
| `408` | 请求超时 | 立即重试 1 次 |
| `400`, `401`, `403` | 客户端错误 | **不重试** |

## 3. Provider 故障转移

Claude Code 支持配置多个 API Provider，当主 Provider 失败时自动切换：

```json
// settings.json
{
  "apiProviders": [
    { "type": "anthropic", "priority": 1 },
    { "type": "bedrock", "region": "us-east-1", "priority": 2 },
    { "type": "vertex", "project": "my-gcp-project", "priority": 3 }
  ]
}
```

故障转移逻辑：
```typescript
// 主 Provider 失败 → 按优先级尝试备用 Provider
const providers = sortByPriority(config.apiProviders);
for (const provider of providers) {
  try {
    return await provider.complete(request);
  } catch (err) {
    if (isFatalError(err)) throw err; // 不可恢复错误不尝试切换
    log.warn(`Provider ${provider.type} failed, trying next...`);
  }
}
throw new AllProvidersFailedError();
```

## 4. Context 溢出自愈

当上下文接近 Token 上限时，Claude Code 自动触发 Compaction：

```
上下文使用量
  ↓ 超过阈值（约 70%）
自动触发 /compact
  ↓
生成上下文摘要（调用 LLM）
  ↓
用摘要替换详细历史
  ↓
释放 Token 空间，继续会话
```

这个机制确保长会话不会因 Token 溢出而中断。

## 5. Transcript 持久化（存储层韧性）

每条消息实时写入 Transcript 文件，保障进程崩溃后可恢复：

```typescript
// 每个 turn 结束后立即持久化
await transcriptStorage.append(sessionId, {
  turn_id: turnId,
  role: 'assistant',
  content: response,
  tool_calls: toolCalls,
  tool_results: toolResults,
  timestamp: Date.now(),
});
```

进程崩溃后用户可通过 `claude --resume <session-id>` 从上次状态继续。

## 6. 工具超时保护

```typescript
// src/tools/timeout.ts
const TOOL_TIMEOUTS = {
  Bash: 120_000,      // 2 分钟
  Read: 30_000,        // 30 秒
  WebFetch: 30_000,    // 30 秒
  default: 60_000,     // 1 分钟
};

async function executeWithTimeout(tool: Tool, input: unknown): Promise<unknown> {
  return Promise.race([
    tool.execute(input),
    sleep(TOOL_TIMEOUTS[tool.name] ?? TOOL_TIMEOUTS.default).then(() => {
      throw new ToolTimeoutError(`${tool.name} timed out`);
    }),
  ]);
}
```

## 7. 与其他系统的对比

| 机制 | Claude Code | Codex | Gemini CLI | OpenCode |
|------|------------|-------|-----------|---------|
| **重试** | 指数退避 + jitter | `retry_config` | `retryWithBackoff` | Effect-ts `retry` |
| **Provider 切换** | 多 Provider 故障转移 | 不支持 | 不支持 | 不支持 |
| **Context 自愈** | 自动 `/compact` | 手动 compact | `ToolOutputDistillationService` | Effect-ts compaction |
| **持久化** | JSONL Transcript | Thread 持久化 | Session JSON | SQLite durable |
| **工具超时** | 按工具类型差异化 | 全局 timeout | 无内置超时 | Effect-ts timeout |
