---
layout: default
title: "Agent Loop 闭环拓扑：四大 AI Coding 工具的设计哲学对比"
---

# Agent Loop 闭环拓扑：四大 AI Coding 工具的设计哲学对比

> 这篇文章来自对 Claude Code、Codex、Gemini CLI、OpenCode 四款 AI Coding 工具源码的深度拆解。如果你曾好奇"AI 是怎么一步步帮我写代码的"——本文将从最核心的执行闭环讲起，揭开每款工具背后的设计哲学。

---

## 序：一个 Agent 是怎么"思考"的？

你让 AI 帮你写一段代码，它"思考"了一会儿，调用了 `Read` 工具读取了你的文件，又调用了 `Edit` 工具修改了代码，然后继续"思考"，再调用工具……这个过程循环往复，直到任务完成。

这个"思考→工具调用→结果回注→再思考"的循环，就是 **Agent Loop**——**Agent 执行闭环**。

听起来简单，但四款顶级工具的实现路径截然不同。有的追求极致低延迟，有的追求企业级安全治理，有的追求可恢复性，有的追求跨模型兼容。今天我们就从源码层面，逐行拆解这四种完全不同的设计思路。

---

## 一、从一个生活比喻开始

在深入代码之前，先用一个比喻帮你建立直觉：

> **Claude Code** 像一个全能的私人助理——所有事情都在脑子里转，你说什么他马上做决定，反应最快，但如果你打断他问"你刚才做了什么"，他可能已经忘了中间步骤。
>
> **Codex** 像一个分工明确的项目组——有项目经理（事件分发层）、技术负责人（Turn 编排层）、资深工程师（重试层）、执行者（工具层），每层各司其职，信息通过内部沟通记录（Session）传递。
>
> **Gemini CLI** 像一个需要你盯着看的半自助工具——它自己做一些决定，但每次执行危险操作都要经过你的 TUI 确认，做完了要你点"继续"，循环的一部分交给你控制。
>
> **OpenCode** 像一个每次开会都做会议纪要的团队——所有讨论内容都实时写入共享文档（SQLite），任何人随时可以查看记录，断了也能从上次记录继续。

这四种哲学，映射到代码里，就是四种完全不同的 Agent Loop 拓扑。

---

## 二、四种闭环拓扑总览

```
┌─────────────────────────────────────────────────────────────────┐
│                     Claude Code — 单核闭环                      │
│                                                                 │
│   queryLoop (while true)                                        │
│       │                                                         │
│       ├── callModel() ─── 流式消费 SSE                         │
│       │                                                         │
│       ├── 工具检测 + StreamingToolExecutor                      │
│       │                                                         │
│       └── 工具结果直接拼接进 messages[] → 回到 callModel         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     Codex — 四层分治                             │
│                                                                 │
│   submission_loop() ← 事件分发（Op::UserInput / Op::Approval）   │
│       │                                                         │
│       └── run_turn() ← Turn 生命周期                            │
│               │                                                 │
│               └── run_sampling_request() ← 重试 + 传输降级       │
│                       │                                         │
│                       └── try_run_sampling_request()            │
│                           └── FuturesOrdered 并发工具执行        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  Gemini CLI — 跨层事件驱动                      │
│                                                                 │
│   sendMessageStream()  ←─ 编排入口（AsyncGenerator）             │
│       │                                                         │
│       ├── processTurn() ← Turn 前置检查（loop 检测、token 检查） │
│       │    │                                                     │
│       │    └── Turn.run() ← 模型流事件解析                      │
│       │                                                         │
│       └── useGeminiStream hook（UI 层！）                        │
│                │                                                 │
│                └── handleCompletedTools()                        │
│                    └── submitQuery(isContinuation) → 回到顶层   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  OpenCode — 持久化状态驱动                       │
│                                                                 │
│   loop() (while true)                                           │
│       │                                                         │
│       ├── 从 SQLite 重建消息历史（每轮！）                        │
│       │                                                         │
│       └── SessionProcessor.process()                            │
│               │                                                 │
│               ├── LLM.stream() ← Vercel AI SDK                  │
│               │                                                 │
│               └── 工具结果写入 SQLite → 回到 loop()              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

四者的核心差异一目了然：

| 维度 | Claude Code | Codex | Gemini CLI | OpenCode |
|------|-------------|-------|------------|----------|
| **循环层数** | 1 层 | 4 层 | 3 层 + UI | 2 层 |
| **状态存储** | 内存 | Session + ContextManager | 事件流 | SQLite |
| **退出判定** | `return` 显式退出 | 通道关闭 | 生成器结束 | `lastAssistant.finish` |

---

## 三、Claude Code：单核极简主义的极致

### 3.1 一切在一千五百行里

Claude Code 的所有闭环逻辑，浓缩在 `src/query.ts` 的 `queryLoop()` 函数里——这个函数长达约 1500 行。这意味着什么？

**好处**：路径极短。没有跨函数跳转，没有异步通道传递，所有状态一目了然。调试时你只需要盯这一个文件。

**代价**：上下文压缩、工具编排、错误恢复、模型调用、退出条件——所有横切关注点全耦合在一起。改一行可能影响全局。

### 3.2 工具结果怎么"回到脑子里"？

Claude Code 的答案优雅而直接——**内存拼接**：

```typescript
// query.ts:1710-1720
const next: State = {
  messages: [...messagesForQuery, ...assistantMessages, ...toolResults],
  //          ↑ 上一轮消息  ↑ 助手回复  ↑ 工具执行结果
  toolUseContext: toolUseContextWithQueryTracking,
  turnCount: nextTurnCount,
  transition: { reason: 'next_turn' },
}
state = next  // 回到循环顶部，messages 里已经包含工具结果
```

工具结果就像便利贴，直接贴在当前消息列表末尾，下一轮模型调用时自然就"看到"了。没有数据库写入，没有事件总线，**最快的回注方式**。

### 3.3 流式推理与工具执行"流水线并行"

这是 Claude Code 最精彩的设计之一。

传统方式是等模型**完全输出**一个工具调用后再执行。但 Claude Code 的 `StreamingToolExecutor` 可以在模型还在**一个字一个字输出**时，就检测到完整的 `tool_use` 块并立即开始执行：

```typescript
// StreamingToolExecutor.ts:137-143
private canExecuteTool(isConcurrencySafe: boolean): boolean {
  const executingTools = this.tools.filter(t => t.status === 'executing')
  return (
    executingTools.length === 0 ||
    (isConcurrencySafe && executingTools.every(t => t.isConcurrencySafe))
    // ↑ 只有当前全是只读工具时才允许并发
  )
}
```

模型还在"说话"，工具已经在"干活"了。推理和执行像流水线一样并行，延迟显著降低。

### 3.4 四级上下文压缩

Claude Code 的上下文压缩是四款工具中最复杂的：

| 级别 | 触发时机 | 机制 |
|------|----------|------|
| **History Snip** | 特性门控 | 历史裁剪 |
| **Microcompact** | **每轮迭代** | 轻量压缩 |
| **Autocompact** | token 接近上限 | 主动摘要 |
| **Reactive Compact** | API 返回 `prompt_too_long` | 被动兜底 |

每轮迭代都运行 Microcompact——这是 Claude Code 对上下文管理的"强迫症"。好处是不容易触发硬上限，坏处是每轮都有额外开销。

---

## 四、Codex：四层分治的工程美学

### 4.1 7000 行的单文件，不是一种罪

Codex 的核心逻辑全在 `codex.rs` 里——超过 7000 行，四个工程中最集中的。

第一眼看去这很吓人，但细看之后你会发现它的美感：**每层职责极其清晰**。

```
Layer 1: submission_loop()       ← 谁发来了什么操作？（事件分发）
Layer 2: run_turn()              ← 这一轮对话要做什么？（Turn 编排）
Layer 3: run_sampling_request()  ← 调用模型失败了怎么办？（重试封装）
Layer 4: try_run_sampling_request() ← 模型在说什么？（流消费 + 工具派发）
```

### 4.2 审批不在循环里轮询——异步注入

大多数 AI Agent 的安全审批需要在循环里检查"现在有没有待审批项"，这会拖慢正常执行路径。

Codex 的做法是**异步通道注入**：

```rust
// codex.rs:4289-4475
while let Ok(sub) = rx_sub.recv().await {
    match sub.op.clone() {
        Op::UserInput { .. } | Op::UserTurn { .. } => {
            handlers::user_input_or_turn(...).await;
        }
        Op::ExecApproval { id, decision } => {
            handlers::exec_approval(...).await;  // ← 审批不在主循环内轮询！
        }
        Op::Interrupt => { handlers::interrupt(&sess).await; }
        Op::Shutdown => { return; }  // ← 唯一退出点
    }
}
```

审批操作通过独立的通道 `rx_sub` 发送。当审批到达时，`submission_loop` 直接处理——正常对话流完全不受影响。这是一个**非阻塞插入**的设计。

### 4.3 RwLock：并发控制的最优雅实现

Codex 的工具并发控制是我见过最简洁的实现：

```rust
// tools/parallel.rs:105-121
let _guard = if supports_parallel {
    Either::Left(lock.read().await)   // 读锁 → 多个只读工具并发
} else {
    Either::Right(lock.write().await) // 写锁 → 独占执行
};
```

只读工具（如 `Read`、`Glob`）获取**读锁**——可以多个同时执行。写入型工具（如 `Edit`、`Bash`）获取**写锁**——自动互斥。

不需要预先分区，不需要批处理编排，锁竞争本身完成了排序。

### 4.4 传输层降级：WebSocket 挂了走 HTTPS

```rust
// codex.rs:6363-6510
if retries >= max_retries
   && client_session.try_switch_fallback_transport(...)
{
    // WebSocket → HTTPS 传输层降级
    retries = 0;
    continue;
}
```

Codex 是唯一一个实现了**传输层降级**的工具。当模型调用连续失败时，它会尝试从 WebSocket 降级到 HTTPS——这是一个被大多数实现忽视的细节。

---

## 五、Gemini CLI：跨层闭环与 Loop 检测

### 5.1 最独特的设计：闭环在 UI 层闭合

Gemini CLI 是四者中唯一一个**闭环跨越 core 和 UI 两个包**的工具：

```
Core 层                          UI 层
sendMessageStream()
      │
      ├── processTurn()  ←───→  useGeminiStream hook
      │                           │
      └── Turn.run()              │
              │                    │
              │ (ToolCallRequest)  │ handleCompletedTools()
              │                    │        │
              ▼                    │        ▼
        Scheduler                  │  submitQuery(isContinuation)
                                      回到 sendMessageStream()
```

注意闭合点 `handleCompletedTools()` 在 UI 层——当工具执行完毕后，由 UI hook 重新调用 `submitQuery()` 回到 core 层。这使得 **TUI 可以完全控制循环的延续时机**。

### 5.2 业界独一份：Loop Detection

当 AI 陷入反复调用同一个工具的死循环时，怎么检测并恢复？

Gemini CLI 实现了**两级响应机制**：

```typescript
// client.ts:629-641
const loopResult = await this.loopDetector.turnStarted(signal);
if (loopResult.count > 1) {
  yield { type: GeminiEventType.LoopDetected };
  return turn;  // 第二次还循环 → 强制停止
} else if (loopResult.count === 1) {
  return yield* this._recoverFromLoop(...);  // 第一次循环 → 注入反馈恢复
}
```

- **第一次检测到循环**：注入一条 meta 消息反馈给模型，尝试自我纠正
- **第二次仍然循环**：强制停止

其他三个工程都没有这种主动循环检测，依赖的都是 token 上限或轮次上限来被动终止。

### 5.3 工具并发：把决定权交给模型

```typescript
// scheduler.ts:549-558
private _isParallelizable(request: ToolCallRequestInfo): boolean {
  if (request.args) {
    const wait = request.args['wait_for_previous'];
    if (typeof wait === 'boolean') return !wait;
    // ↑ 模型可以在工具参数中声明 wait_for_previous: true
  }
  return true;  // 默认并行
}
```

Gemini CLI 把并发控制权交给了**模型端**——模型可以在工具参数中通过 `wait_for_previous: true` 声明"我要等前一个工具完成"。这是一种有趣的架构选择：让 AI 决定自己需要串行还是并行。

---

## 六、OpenCode：持久化优先的工程哲学

### 6.1 每轮迭代从数据库重建历史

这是 OpenCode 与其他三者最本质的区别：

```typescript
// prompt.ts:799-804
while (true) {
    // 每轮迭代都从 SQLite 重新读取完整历史！
    let msgs = await MessageV2.filterCompacted(MessageV2.stream(sessionID))

    let lastUser, lastAssistant, lastFinished
    for (let i = msgs.length - 1; i >= 0; i--) { /* 查找最后的用户/助手消息 */ }

    // 退出条件：助手完成且不是 tool-calls
    if (lastAssistant?.finish
        && !["tool-calls", "unknown"].includes(lastAssistant.finish)
        && lastUser.id < lastAssistant.id) {
      break
    }
}
```

其他工具每次迭代是在内存中累积消息，OpenCode 每次迭代是从 SQLite **重建**消息。这带来了几个关键优势：

- **Crash Recovery 无损**：进程被 kill？重启后从 SQLite 读取历史，无任何状态丢失
- **外部可观察**：TUI、LSP 客户端、外部工具可以随时查询对话状态
- **Event Replay**：所有事件都有记录，支持回放

代价是每轮都有数据库 I/O 开销，且数据一致性需要自己做。

### 6.2 SQLite Schema 的精妙设计

```
SessionTable ─── MessageTable ──── PartTable
    id (PK)     │    id (PK)     │    id (PK)
  project_id    │  session_id    │  message_id
    title       │  data (JSON)   │  session_id
  permission    │  time_created  │  data (JSON)
  time_created  │                │  time_created
```

三个表覆盖了会话、消息、消息片段（文本、工具调用、工具结果）的完整生命周期。特别值得注意的是：**文本增量只通过 Bus 推送，不写 DB**——这是性能和持久性之间的精确折中。

### 6.3 Vercel AI SDK：一次实现，接入所有模型

OpenCode 使用 Vercel AI SDK 的 `streamText()` + `tool()` 原语注册工具：

```typescript
// prompt.ts:931-943
tools[item.id] = tool({
  description: item.description,
  inputSchema: jsonSchema(schema),
  async execute(args, options) {
    await Plugin.trigger("tool.execute.before", { tool: item.id }, { args })
    const result = await item.execute(args, ctx)
    await Plugin.trigger("tool.execute.after", { tool: item.id }, result)
    return result
  }
})
```

工具执行由 AI SDK 自动调度，模型返回 `tool_use` 时 SDK 自动调用注册的 `execute` 函数。这意味着 OpenCode 可以通过替换底层的 `LLM.stream()` 同时支持 Anthropic、OpenAI、Google 等多个 provider。

---

## 七、横向对比：没有银弹

### 7.1 工具结果回注方式

| 工程 | 回注方式 | 延迟 | 可恢复性 |
|------|----------|------|----------|
| Claude Code | 内存拼接 | **最低** | 无 |
| Codex | ContextManager 记录 | 中 | Session 可查询 |
| Gemini CLI | UI 层 `submitQuery` | 中 | 生成器状态 |
| OpenCode | SQLite 写入 | **最高** | **最强** |

### 7.2 并发控制策略

| 工程 | 策略 | 决策方 | 优雅度 |
|------|------|--------|--------|
| Claude Code | 分批 + `isConcurrencySafe` | 客户端 | 中 |
| Codex | **RwLock 读写锁** | 客户端 | **最高** |
| Gemini CLI | 模型端 `wait_for_previous` | 模型 | 有趣但依赖模型 |
| OpenCode | AI SDK 内置 | SDK | 透明但黑盒 |

### 7.3 错误恢复能力

| 工程 | 重试 | Context 溢出 | 传输降级 |
|------|------|-------------|----------|
| Claude Code | Fallback 模型 | 四级压缩 | 无 |
| Codex | 指数退避 | auto compact | **WebSocket→HTTPS** |
| Gemini CLI | 生成器事件 | compress + mask | 无 |
| OpenCode | retry-after header 感知 | compaction | 无 |

---

## 八、选型指南：你的场景适合哪一款？

```
需要极致低延迟的交互式编码？
  → Claude Code
  理由：单核 loop 无跨层跳转，工具结果直接在内存拼接，路径最短

需要企业级安全合规和审计？
  → Codex
  理由：四层分治有天然的控制点插入位置；异步审批通道 + RwLock 并发 + Thread Rollback

需要丰富的 TUI 交互和灵活插桩？
  → Gemini CLI
  理由：闭环在 UI 层闭合，确认框/提示/loop detection 呈现自然

需要 crash recovery 和跨模型兼容？
  → OpenCode
  理由：SQLite durable state 任意时刻可 resume；Vercel AI SDK 抽象所有 provider
```

---

## 九、结语：四种哲学，一个目标

拆解完四款工具的 Agent Loop，有一件事变得无比清晰——**没有完美的设计，只有适合场景的选择**。

Claude Code 用单核换取最低延迟，代价是复杂度全压在一个文件里。Codex 用四层分治换取可治理性，代价是调用栈深、调试成本高。Gemini CLI 用跨层闭环换取 UI 灵活性，代价是 core 无法独立运行。OpenCode 用 SQLite 换取可恢复性，代价是每轮都有数据库开销。

当你设计自己的 Agent 系统时，首先要问的不是"哪个框架最好"，而是：

> **我的核心矛盾是什么？——是延迟还是可观测性？是吞吐量还是可恢复性？**

答案决定了你的 Loop 应该长什么样。

---

*本文源码分析基于 hello-harness 工程，涵盖 Claude Code (query.ts)、Codex (codex.rs)、Gemini CLI (client.ts/turn.ts/scheduler.ts)、OpenCode (prompt.ts/processor.ts) 四个工程的公开源码。*
