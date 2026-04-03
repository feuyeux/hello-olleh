# Gemini CLI 上下文管理：消息预算、工具输出与循环检测

本文档分析 Gemini CLI 的上下文管理机制。

## 1. 上下文管理在 Gemini CLI 里的定位

### 1.1 基本架构

Gemini CLI 的上下文管理包含三个核心部分：

1. **消息预算**：控制发送给模型的 token 数量
2. **工具输出控制**：限制工具返回的内容量
3. **循环检测**：防止同类型操作的无限循环

### 1.2 与其他项目的对比

| 特性 | Claude Code | Codex | OpenCode | Gemini CLI |
| --- | --- | --- | --- | --- |
| 上下文窗口 | 完整 | Thread 协议 | 200K | 32K/128K |
| 消息预算 | 完整 | 有限 | 完整 | 基础 |
| 工具输出截断 | 支持 | 支持 | 支持 | 基础 |
| 循环检测 | doom_loop | 无 | 完整 | 无 |

---

## 2. 消息预算

### 2.1 Budget 计算

```typescript
interface MessageBudget {
  maxTokens: number
  usedTokens: number
  remainingTokens: number
}

function calculateBudget(messages: Message[], model: string): MessageBudget {
  const maxTokens = getModelContextWindow(model)
  const usedTokens = messages.reduce((sum, m) => sum + countTokens(m), 0)

  return {
    maxTokens,
    usedTokens,
    remainingTokens: maxTokens - usedTokens
  }
}
```

### 2.2 预算警告

```typescript
function checkBudgetWarning(budget: MessageBudget): void {
  const usageRatio = budget.usedTokens / budget.maxTokens

  if (usageRatio > 0.9) {
    console.warn('⚠️ Context window at 90% capacity')
  } else if (usageRatio > 0.95) {
    console.error('🔴 Context window at 95% capacity - truncation imminent')
  }
}
```

### 2.3 预算溢出处理

| 策略 | 说明 |
| --- | --- |
| 截断历史 | 删除最早的 N 条消息 |
| 摘要压缩 | 用摘要替换长消息 |
| 拒绝继续 | 告知用户上下文已满 |

---

## 3. 工具输出控制

### 3.1 输出大小限制

```typescript
interface ToolOutputConfig {
  maxBytes: number       // 最大输出字节数
  maxLines: number       // 最大行数
  truncateSuffix: string  // 截断后缀
}

const DEFAULT_TOOL_OUTPUT_CONFIG: ToolOutputConfig = {
  maxBytes: 10 * 1024,   // 10KB
  maxLines: 500,
  truncateSuffix: '\n... (truncated)'
}
```

### 3.2 截断逻辑

```typescript
function truncateToolOutput(
  output: string,
  config: ToolOutputConfig = DEFAULT_TOOL_OUTPUT_CONFIG
): string {
  // 检查字节数
  if (output.length > config.maxBytes) {
    output = output.slice(0, config.maxBytes) + config.truncateSuffix
  }

  // 检查行数
  const lines = output.split('\n')
  if (lines.length > config.maxLines) {
    output = lines.slice(0, config.maxLines).join('\n') + config.truncateSuffix
  }

  return output
}
```

### 3.3 工具特定限制

| 工具 | maxBytes | maxLines |
| --- | --- | --- |
| Read | 50KB | 1000 |
| Glob | 10KB | 500 |
| Grep | 20KB | 500 |
| Bash | 无限制 | 无限制 |

---

## 4. 循环检测

### 4.1 检测类型

| 循环类型 | 检测方式 |
| --- | --- |
| 同工具连续调用 | 计数器 + 阈值 |
| 相同输出重复 | 哈希比较 |
| 模式重复 | n-gram 分析 |

### 4.2 同工具检测

```typescript
interface LoopDetection {
  toolCounts: Map<string, number>
  maxToolCalls: number  // 默认为 3
}

function detectToolLoop(tool: string, detection: LoopDetection): boolean {
  const count = detection.toolCounts.get(tool) || 0
  detection.toolCounts.set(tool, count + 1)

  if (count + 1 > detection.maxToolCalls) {
    return true  // 检测到循环
  }
  return false
}
```

### 4.3 处理策略

```typescript
function handleToolLoop(tool: string): string {
  return `我注意到你连续多次使用 ${tool}，这可能陷入了循环。
请确认你的意图，或提供更具体的指导。`
}
```

---

## 5. 上下文窗口

### 5.1 模型限制

| 模型 | 上下文窗口 | 最大输出 |
| --- | --- | --- |
| gemini-2.0-flash | 32,768 | 8,192 |
| gemini-2.0-flash-lite | 32,768 | 4,096 |
| gemini-1.5-pro | 128,000 | 8,192 |
| gemini-1.5-flash | 32,768 | 8,192 |

### 5.2 上下文组装

```typescript
function assembleContext(
  prompt: string,
  history: Message[],
  tools: Tool[],
  budget: MessageBudget
): Context {
  const context: Context = {
    system: buildSystemPrompt(tools),
    history: [],
    budget
  }

  // 从最新消息开始，优先保留最近的消息
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i]
    const msgTokens = countTokens(msg)

    if (context.budget.remainingTokens >= msgTokens) {
      context.history.unshift(msg)
      context.budget.remainingTokens -= msgTokens
    } else {
      break
    }
  }

  return context
}
```

---

## 6. 与 OpenCode 的上下文管理对比

### 6.1 主要差异

| 特性 | OpenCode | Gemini CLI |
| --- | --- | --- |
| 上下文窗口 | 200K | 32K-128K |
| 软溢出 | 支持 | 无 |
| 硬溢出 | 拒绝继续 | 简单截断 |
| 循环检测 | doom_loop | 无 |
| Compaction | 完整 | 无 |

### 6.2 OpenCode 的软/硬溢出

```typescript
// OpenCode 的溢出处理
if (contextUsage > softThreshold) {
  // 软溢出：触发 compaction
  context = await compactContext(context)
} else if (contextUsage > hardThreshold) {
  // 硬溢出：拒绝继续
  throw new ContextOverflowError()
}
```

---

## 7. 改进建议

### 7.1 短期增强

1. **软溢出机制**：接近阈值时触发压缩
2. **循环检测**：实现 doom_loop 检测
3. **智能截断**：保留关键上下文

### 7.2 长期规划

| 能力 | 实现建议 |
| --- | --- |
| Compaction | 实现消息摘要 |
| 分布式上下文 | 多模型共享上下文 |
| 智能预算分配 | 根据任务类型动态分配 |

---

## 8. 关键源码锚点

| 主题 | 代码锚点 | 说明 |
| --- | --- | --- |
| Budget | `packages/core/src/context/budget.ts` | 预算计算 |
| Truncation | `packages/core/src/context/truncation.ts` | 截断逻辑 |
| Loop | `packages/core/src/context/loop-detection.ts` | 循环检测 |
| 模型限制 | `packages/core/src/models.ts` | 模型配置 |

---

## 9. 总结

Gemini CLI 的上下文管理相比 OpenCode 较为基础：

1. **消息预算**：基于模型窗口的简单计算
2. **工具输出控制**：固定阈值的截断
3. **循环检测**：基础的同工具计数
4. **上下文组装**：从新到旧的贪婪填充

缺少 OpenCode 的软/硬溢出机制、compaction 和 doom_loop 高级检测。对于简单场景，当前架构足以支撑。

---

> 关联阅读：[03-agent-loop.md](./03-agent-loop.md) 了解 Agent 循环详情。
