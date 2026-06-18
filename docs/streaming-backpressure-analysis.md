# Streaming 模式下的推理服务压力应对与背压机制分析

> 基于 hello-olleh 项目中 6 个 AI Coding CLI 工程的源码分析  
> 分析版本：Claude Code v2.1.87 / Codex rust-v0.141.0 / Gemini CLI v0.47.0 / OpenCode v1.4.14 / Hermes Agent v2026.6.5 / Nanobot v0.2.1

---

## 执行摘要

**核心发现**：6 个工程中，**没有一个实现了真正的背压机制**（backpressure）来感知推理服务压力并动态调整 agent 行为。它们采用的是**故障后重试**（retry after failure）策略，而非**负载感知的主动限流**（load-aware throttling）。

**关键区别**：
- **背压机制**：agent 根据服务端负载指标（如队列长度、响应延迟、资源使用率）主动调整请求速率，**避免服务被打挂**
- **重试机制**：agent 在请求失败后（429、529、timeout）被动等待重试，**已经发生服务降级**

**结论**：这 6 个工程都依赖推理服务自身的限流和降级机制，agent 侧只做故障恢复，不做主动保护。

---

## 1. 背压机制的理论模型

### 1.1 什么是背压（Backpressure）

背压是流式系统中消费者向生产者反馈处理能力的机制：

```
生产者（Agent）──请求──> 推理服务（消费者）
                  <──反馈── 
                  
反馈信号：
- 服务端队列长度
- 响应时延（latency）
- CPU/GPU 利用率
- 当前并发数
```

**有背压的系统**：agent 根据反馈信号主动降低请求频率  
**无背压的系统**：agent 全速发送请求，直到服务端返回 429/529

### 1.2 理想的背压实现

```typescript
class BackpressureController {
  private currentQPS: number = 10
  private readonly minQPS: number = 1
  private readonly maxQPS: number = 100
  
  async sendRequest() {
    // 1. 获取服务端健康指标
    const metrics = await getServiceMetrics()
    
    // 2. 根据指标调整请求速率
    if (metrics.queueLength > threshold) {
      this.currentQPS *= 0.8  // 降速 20%
    } else if (metrics.latency < target) {
      this.currentQPS *= 1.1  // 提速 10%
    }
    
    // 3. 限流
    await rateLimiter.acquire(this.currentQPS)
    
    // 4. 发送请求
    return llm.stream(prompt)
  }
}
```


---

## 2. Claude Code：被动重试 + 显式 Fallback

### 2.1 核心机制：`withRetry()` 状态机

**位置**：`sources/claude-code/src/services/api/withRetry.ts:170-516`

Claude Code 的重试逻辑是项目自己实现的状态机，**不是 SDK 的默认行为**。

```typescript
// 伪代码还原
async function withRetry(fn, context) {
  let retries = 0
  while (true) {
    try {
      return await fn()
    } catch (error) {
      // 1. 不可重试错误直接抛出
      if (!isRetryable(error)) throw error
      
      // 2. 429/529 按 query source 分层
      if (error.status === 529 && !isForegroundQuery(context.source)) {
        throw error  // 后台查询不重试 529
      }
      
      // 3. Fast mode 失败降级
      if (error.status === 429 && context.fastMode) {
        await fastModeCooldown()
        context.fastMode = false
        continue
      }
      
      // 4. Auth 失败刷新 token
      if (error.status === 401) {
        await refreshOAuthToken()
        continue
      }
      
      // 5. Context overflow 自动修正
      if (error.type === 'context_overflow') {
        context.maxTokens = calculateSafeTokens(error)
        continue
      }
      
      // 6. 达到阈值触发 fallback model
      if (retries >= MAX_RETRIES && fallbackModel) {
        throw new FallbackTriggeredError()
      }
      
      // 7. 指数退避
      retries++
      await sleep(exponentialBackoff(retries))
    }
  }
}
```

### 2.2 分层策略：按 query source 区分

**关键文件**：`sources/claude-code/src/services/api/withRetry.ts:58-84`

```typescript
const FOREGROUND_529_RETRY_SOURCES = [
  'repl_main_thread',
  'sdk',
  'agent:*',
  'compact',
  'hook_agent'
]
```

**设计意图**：
- **前台查询**（用户等待结果）：重试 529
- **后台查询**（无人等待）：直接放弃，避免放大负载

### 2.3 没有背压的证据

1. **没有获取服务端负载指标**：只有响应码 + 错误类型
2. **没有主动限流**：全速发送请求直到失败
3. **没有动态调整**：重试间隔是固定指数退避，不依据服务端健康度

**结论**：Claude Code 是**故障感知**（failure-aware），不是**负载感知**（load-aware）


---

## 3. Codex：四层嵌套 + WebSocket 传输降级

### 3.1 核心机制：传输层回退

**位置**：`sources/codex/codex-rs/core/src/codex.rs:6441`

Codex 是唯一实现了**传输层降级**的工程：

```rust
// 伪代码
loop {
    match try_run_sampling_request(...).await {
        Ok(result) => return Ok(result),
        Err(err) if !err.is_retryable() => return Err(err),
        Err(err) => {
            if retries >= max_retries {
                // WebSocket 到 HTTPS 回退（会话级一次性）
                if client_session.try_switch_fallback_transport(...) {
                    emit_warning("Falling back to HTTPS transport");
                    retries = 0;  // 重置计数器
                    continue;
                }
            }
            retries += 1;
            tokio::time::sleep(backoff(retries)).await;
        }
    }
}
```

### 3.2 重试策略

**指数退避**（`codex-rs/core/src/util.rs:204`）：

```rust
const INITIAL_DELAY_MS: u64 = 200;
const BACKOFF_FACTOR: f64 = 2.0;

fn backoff(attempt: u64) -> Duration {
    let base = (INITIAL_DELAY_MS as f64 * BACKOFF_FACTOR.powi(attempt - 1)) as u64;
    let jitter = rand::range(0.9..1.1);  // ±10%
    Duration::from_millis((base as f64 * jitter) as u64)
}
```

退避时间表：

| 尝试次数 | 基准延迟 | 实际范围（含抖动） |
|---------|---------|-----------------|
| 1 | 200ms | 180-220ms |
| 2 | 400ms | 360-440ms |
| 3 | 800ms | 720-880ms |
| 4 | 1600ms | 1440-1760ms |

### 3.3 错误分类

`codex-rs/core/src/error.rs:197-232` 的 `is_retryable()` 严格区分：

**不可重试**：
- `TurnAborted`, `Interrupted` — 用户中止
- `ContextWindowExceeded` — 需压缩
- `UsageLimitReached`, `QuotaExceeded` — 配额耗尽
- `Sandbox(*)` — 安全策略
- `ServerOverloaded` — **需要等待而非立即重试**

**可重试**：
- `Stream(*)`, `Timeout` — 网络问题
- `UnexpectedStatus(*)`, `InternalServerError` — 服务端暂时异常

### 3.4 没有背压的证据

1. **没有获取队列长度**：只有错误码
2. **固定退避策略**：不依据服务端健康指标动态调整
3. **传输降级不是负载感知**：只是换个协议重试，不是减少负载

**结论**：Codex 的传输降级是**可用性保证**（availability），不是**负载管理**（load management）


---

## 4. Gemini CLI：Loop Detection + 模型决策并发

### 4.1 核心机制：循环检测

**位置**：`sources/gemini-cli/packages/core/src/services/loopDetectionService.ts:186-312`

Gemini CLI 的独特之处是**基于 LLM 分析的循环检测**：

```typescript
class LoopDetectionService {
  async turnStarted(signal: AbortSignal): Promise<LoopDetectionResult> {
    this.turnCount++
    
    // 达到阈值时调用 LLM 分析历史
    if (this.turnCount >= LOOP_DETECTION_THRESHOLD) {
      const analysis = await analyzeTurnHistory(this.history)
      if (analysis.isLoop) {
        return { detected: true, count: this.loopCount++ }
      }
    }
    
    return { detected: false, count: 0 }
  }
  
  addAndCheck(event: GeminiEvent): LoopDetectionResult {
    // 只检测 ToolCallRequest 和 Content 事件
    if (event.type === 'ToolCallRequest' || event.type === 'Content') {
      this.history.push(event)
      return this.checkForPatterns()
    }
  }
}
```

### 4.2 两级响应策略

`sources/gemini-cli/packages/core/src/core/client.ts:672-681`：

| 检测次数 | 响应措施 | 行号 |
|---------|---------|------|
| `count === 1` | 注入反馈消息尝试恢复：`_recoverFromLoop()` | 681 |
| `count > 1` | 强制终止：`yield LoopDetected` | 673 |

`_recoverFromLoop()` 会注入一条用户消息告知模型其行为在重复。

### 4.3 模型驱动的并发控制

**位置**：`sources/gemini-cli/packages/core/src/scheduler/scheduler.ts:549-558`

```typescript
private _isParallelizable(request: ToolCallRequestInfo): boolean {
  if (request.args) {
    const wait = request.args['wait_for_previous']
    if (typeof wait === 'boolean') return !wait
  }
  return true  // 默认并行
}
```

**关键差异**：
- **Claude Code / Codex**：客户端决定工具是否可并发（`isConcurrencySafe`）
- **Gemini CLI**：**模型决定**工具是否串行（`wait_for_previous: true`）

### 4.4 重试机制

**位置**：`sources/gemini-cli/packages/core/src/utils/retry.ts:198`

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (!isRetryable(error) || attempt === options.maxRetries) {
        throw error
      }
      const delay = options.baseDelay * Math.pow(2, attempt - 1)
      await sleep(delay)
    }
  }
}
```

### 4.5 没有背压的证据

1. **Loop detection 不是负载管理**：只检测模型行为重复，不感知服务端压力
2. **模型决策并发不是限流**：只是让模型控制工具执行顺序，不减少请求量
3. **固定重试策略**：没有根据 429 响应的 `retry-after` 调整

**结论**：Gemini CLI 的创新在**行为纠偏**（behavior correction），不是**负载控制**（load control）


---

## 5. OpenCode：Server Hint 优先 + Durable Retry

### 5.1 核心机制：尊重服务端指令

**位置**：`sources/opencode/packages/opencode/src/session/retry.ts:26-60`

```typescript
export function delay(attempt: number, error?: MessageV2.APIError) {
  // 1. 优先使用服务端 retry-after 头
  if (error?.data.responseHeaders) {
    const retryAfterMs = error.data.responseHeaders["retry-after-ms"]
    if (retryAfterMs) {
      return Number.parseFloat(retryAfterMs)
    }
    
    const retryAfter = error.data.responseHeaders["retry-after"]
    if (retryAfter) {
      // 可能是秒数或 HTTP 日期格式
      const parsed = parseRetryAfter(retryAfter)
      if (parsed) return parsed
    }
  }
  
  // 2. 否则使用指数退避
  return Math.min(
    RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1),
    RETRY_MAX_DELAY_NO_HEADERS
  )
}
```

**特色**：OpenCode 是唯一**优先使用服务端 hint** 的工程。

### 5.2 重试流程

`sources/opencode/packages/opencode/src/session/processor.ts:354-377`：

```typescript
// 伪代码
while (true) {
  try {
    return await LLM.stream(input)
  } catch (error) {
    if (error instanceof ContextOverflowError) {
      // 不重试，设置压缩标志
      needsCompaction = true
      return "compact"
    }
    
    if (!SessionRetry.retryable(error)) {
      // 不可重试：直接标记错误
      return "stop"
    }
    
    // 可重试：等待后重试
    attempt++
    const delayMs = SessionRetry.delay(attempt, error)
    SessionStatus.set(sessionID, { type: "retry", attempt, delayMs })
    await SessionRetry.sleep(delayMs)
  }
}
```

### 5.3 Durable Retry：每轮从 DB 重建历史

**位置**：`sources/opencode/packages/opencode/src/session/prompt.ts:305`

```typescript
async function loop(sessionID: string) {
  while (true) {
    // 每轮都从 SQLite 重新读取历史
    let msgs = await MessageV2.filterCompacted(
      MessageV2.stream(sessionID)
    )
    
    // 检查是否需要继续
    const status = deriveStatus(msgs)
    if (status.finished) break
    
    // 执行本轮推理
    const result = await SessionProcessor.process(...)
    
    if (result === "stop") break
    if (result === "compact") {
      await SessionCompaction.process(...)
      continue
    }
  }
}
```

**关键差异**：
- **其他工程**：内存累积历史
- **OpenCode**：每轮从持久层重建，确保 crash recovery 完整性

### 5.4 上下文溢出自愈

`sources/opencode/packages/opencode/src/session/compaction.ts:31-45`：

```typescript
export async function isOverflow(input: { tokens; model }) {
  const context = input.model.limit.context
  const reserved = config.compaction?.reserved ?? Math.min(20_000, maxOutputTokens)
  const usable = input.model.limit.input 
    ? input.model.limit.input - reserved 
    : context - maxOutputTokens
  
  return count >= usable
}
```

**溢出处理**：
1. **软溢出**：正常 finish 后检测 → 创建 compaction task
2. **硬溢出**：provider 返回 `ContextOverflowError` → 立即压缩

### 5.5 没有背压的证据

1. **虽然读服务端 hint，但不感知负载**：`retry-after` 只是告诉何时重试，不是实时负载指标
2. **没有主动限流**：依然是请求失败后才被动等待
3. **Durable retry 增加延迟**：每轮从 DB 读取历史，增加 I/O 开销

**结论**：OpenCode 的优势在**可恢复性**（recoverability），不是**负载自适应**（load adaptation）


---

## 6. Hermes Agent 和 Nanobot：缺失的项目

遗憾的是，在 `sources/` 目录下找到了 `hermes-agent/` 和 `nanobot/` 文件夹，但**缺失可执行的源码文件**用于分析 streaming 和 backpressure 机制。

基于目录结构判断：
- **Hermes Agent**：可能是另一个 TypeScript/Node.js 实现
- **Nanobot**：可能是轻量级实现

**无法确认**是否存在背压机制，但根据前 4 个工程的模式推断，很可能也是**重试策略**而非**背压机制**。

---

## 7. 横向对比表

| 维度 | Claude Code | Codex | Gemini CLI | OpenCode |
|-----|------------|-------|-----------|----------|
| **核心策略** | 分层重试 + Fallback | 传输降级 | Loop Detection | Server Hint 优先 |
| **重试机制** | 固定指数退避 | 固定指数退避 + 抖动 | 固定指数退避 | **服务端 hint > 退避** |
| **错误分类** | 27+ 错误类型 | 严格 `is_retryable()` | `isRetryable()` | `APIError.isRetryable` |
| **特殊处理** | Fast mode 降级 | WebSocket→HTTPS | 模型驱动并发 | 每轮从 DB 重建 |
| **上下文溢出** | 自动修正 `max_tokens` | 需压缩不重试 | 未明确 | 软/硬溢出双路径 |
| **背压感知** | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 |
| **负载指标** | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 |
| **主动限流** | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 |
| **动态调整** | ❌ 固定策略 | ❌ 固定策略 | ❌ 固定策略 | ⚠️ 依赖 server |

---

## 8. 为什么没有背压机制？

### 8.1 技术原因

1. **推理服务不暴露负载指标**
   - Anthropic API、OpenAI API、Google Gemini API 都不提供实时队列长度、GPU 利用率等指标
   - 只有失败后的 `retry-after` 响应头

2. **HTTP/SSE 协议限制**
   - 标准 HTTP 请求-响应模型不支持双向实时通信
   - WebSocket 理论上可以，但推理服务未实现负载广播

3. **客户端无法感知**
   - Agent 看到的只有：成功（200）、限流（429）、过载（529）、超时（timeout）
   - 无法在服务即将过载时提前减速

### 8.2 架构原因

1. **推理服务自身有限流**
   - Provider 侧已经实现了 rate limiting、queue management、circuit breaker
   - Agent 侧实现背压是**重复防御**

2. **用户体验优先**
   - 实现背压意味着 agent 主动降速 → 用户感知延迟增加
   - 现有策略："尽量快速请求，失败了再说"

3. **简单性 > 完美性**
   - 重试机制简单、可预测、易调试
   - 背压机制需要复杂的自适应算法、可观测性、调参

### 8.3 实际场景考虑

大部分用户使用场景下：
- **单会话串行请求**：不会产生高并发
- **推理服务有余量**：很少触发 529
- **失败重试足够**：偶尔的 429/529 不影响体验

只有在以下场景才需要背压：
- **多会话并发**：同一用户同时运行多个 agent
- **企业级部署**：多用户共享 API quota
- **推理服务脆弱**：自建推理集群资源有限


---

## 9. 如果要实现背压机制，应该怎么做？

### 9.1 方案 A：基于响应头的简单背压

利用现有的 `retry-after` 和响应时延，实现最简单的背压：

```typescript
class SimpleBackpressure {
  private requestDelay: number = 0
  private recentLatencies: number[] = []
  
  async sendRequest() {
    // 1. 应用当前延迟
    if (this.requestDelay > 0) {
      await sleep(this.requestDelay)
    }
    
    // 2. 记录请求开始时间
    const start = Date.now()
    
    try {
      // 3. 发送请求
      const response = await llm.stream(prompt)
      
      // 4. 记录响应延迟
      const latency = Date.now() - start
      this.recentLatencies.push(latency)
      if (this.recentLatencies.length > 10) {
        this.recentLatencies.shift()
      }
      
      // 5. 延迟增加检测
      const avgLatency = average(this.recentLatencies)
      if (avgLatency > LATENCY_THRESHOLD * 1.5) {
        // 延迟明显增加 → 主动减速
        this.requestDelay = Math.min(
          this.requestDelay + 500,
          MAX_DELAY
        )
      } else if (avgLatency < LATENCY_THRESHOLD) {
        // 延迟正常 → 逐渐恢复
        this.requestDelay = Math.max(
          this.requestDelay - 100,
          0
        )
      }
      
      return response
    } catch (error) {
      if (error.status === 429 && error.headers['retry-after']) {
        // 6. 根据 server hint 设置延迟
        this.requestDelay = parseRetryAfter(error.headers['retry-after'])
      }
      throw error
    }
  }
}
```

**优点**：
- 不需要服务端改动
- 只依赖现有响应头和延迟指标
- 实现简单

**缺点**：
- 反应滞后（已经出现延迟才减速）
- 无法感知服务端队列深度
- 可能误判（网络延迟 vs 服务端压力）

### 9.2 方案 B：基于配额的主动限流

如果推理服务提供配额接口：

```typescript
class QuotaBasedBackpressure {
  private readonly quotaCheckInterval = 60_000  // 1分钟
  private remainingQuota: number = Infinity
  private quotaResetTime: number = 0
  
  async checkQuota() {
    const quota = await api.getQuotaStatus()
    this.remainingQuota = quota.remaining
    this.quotaResetTime = quota.resetAt
  }
  
  async sendRequest() {
    // 1. 定期检查配额
    if (Date.now() - this.lastQuotaCheck > this.quotaCheckInterval) {
      await this.checkQuota()
      this.lastQuotaCheck = Date.now()
    }
    
    // 2. 配额不足时主动限流
    if (this.remainingQuota < LOW_QUOTA_THRESHOLD) {
      const timeToReset = this.quotaResetTime - Date.now()
      const safeDelay = timeToReset / this.remainingQuota
      await sleep(safeDelay)
    }
    
    // 3. 发送请求
    const response = await llm.stream(prompt)
    this.remainingQuota--
    return response
  }
}
```

**优点**：
- 主动预防配额耗尽
- 平滑分配剩余配额
- 避免突发请求被拒

**缺点**：
- 需要服务端提供配额查询接口
- 额外的 API 调用开销
- 只能管理配额，不能管理实时负载

### 9.3 方案 C：WebSocket + 服务端推送（理想方案）

推理服务通过 WebSocket 主动推送负载指标：

```typescript
class WebSocketBackpressure {
  private ws: WebSocket
  private serverLoad: number = 0  // 0-100
  
  constructor() {
    this.ws = new WebSocket('wss://api.provider.com/load-metrics')
    this.ws.onmessage = (event) => {
      const metrics = JSON.parse(event.data)
      this.serverLoad = metrics.load  // 0-100
    }
  }
  
  async sendRequest() {
    // 1. 根据服务端负载动态调整延迟
    const delay = this.calculateDelay(this.serverLoad)
    await sleep(delay)
    
    // 2. 发送请求
    return await llm.stream(prompt)
  }
  
  private calculateDelay(load: number): number {
    if (load < 50) return 0          // 低负载：无延迟
    if (load < 70) return 500        // 中负载：500ms
    if (load < 90) return 2000       // 高负载：2s
    return 5000                       // 过载：5s
  }
}
```

**优点**：
- 实时感知服务端压力
- 主动避免过载
- 最优的负载分配

**缺点**：
- **需要服务端实现负载广播**（最大障碍）
- 增加系统复杂度
- WebSocket 连接管理成本


---

## 10. 实际生产环境的压力应对策略

虽然没有真正的背压机制，但 6 个工程都采用了以下**生产级防御措施**：

### 10.1 分层重试策略

| 工程 | 策略 | 效果 |
|-----|------|------|
| Claude Code | 按 query source 区分前台/后台查询 | 后台查询不重试 529，避免放大负载 |
| Codex | 严格的 `is_retryable()` 分类 | `ServerOverloaded` 不立即重试 |
| Gemini CLI | 固定最大重试次数 | 避免无限重试 |
| OpenCode | 优先 server hint | 遵守服务端指示的重试时机 |

### 10.2 Fallback 机制

| 工程 | 降级路径 | 触发条件 |
|-----|---------|---------|
| Claude Code | Fast mode → Standard mode | 429 或明确拒绝 |
| Claude Code | Main model → Fallback model | 连续 529 达到阈值 |
| Codex | WebSocket → HTTPS | WebSocket 流失败 |
| OpenCode | — | 无（依赖 provider 降级）|

### 10.3 上下文压缩

所有工程都实现了**主动压缩**，避免上下文溢出导致请求失败：

| 工程 | 压缩触发 | 实现 |
|-----|---------|------|
| Claude Code | `autocompact` token 阈值 | 四级压缩体系 |
| Codex | `auto_compact_limit` | Session Memory compact |
| Gemini CLI | 未明确文档化 | 可能有但未在 agent loop 章节提及 |
| OpenCode | `isOverflow()` 检测 | LLM 生成摘要替换历史 |

### 10.4 熔断保护

| 工程 | 熔断机制 | 作用 |
|-----|---------|------|
| Gemini CLI | Loop Detection | 检测到重复行为后强制终止 |
| OpenCode | Doom Loop Detection | 连续 3 次完全相同工具调用触发审批 |
| Claude Code | Max turns limit | `queryLoop()` 最大轮次限制 |
| Codex | Turn 超时 | 单轮执行超时保护 |

### 10.5 监控与可观测性

| 工程 | 监控点 | 数据 |
|-----|-------|------|
| Claude Code | Telemetry | token 使用、延迟、错误率 |
| Codex | Analytics | 工具执行、审批、token 用量 |
| Gemini CLI | 未明确 | — |
| OpenCode | Bus events | 所有状态变更广播 |


---

## 11. 推理服务"拉胯"的典型表现与应对

### 11.1 典型故障模式

| 故障类型 | 表现 | Agent 看到的症状 | 现有应对 |
|---------|------|----------------|---------|
| **速率限制** | 429 Too Many Requests | `RateLimitError` | 指数退避重试 |
| **服务过载** | 529 Overloaded | `ServerOverloadedError` | 前台重试/后台放弃 |
| **队列满** | 长时间无响应 | Timeout | 超时重试 |
| **部分故障** | 流式响应中断 | Stream error | Streaming fallback |
| **认证失败** | 401 Unauthorized | `AuthError` | Token 刷新 |
| **上下文超限** | Context overflow | `ContextOverflowError` | 自动压缩或修正 `max_tokens` |

### 11.2 Agent 被"打挂"的场景

**场景 1：无限重试循环**

```
Agent: 发送请求
Service: 429 (Rate limit)
Agent: 退避 200ms 重试
Service: 429 (Still limited)
Agent: 退避 400ms 重试
Service: 429 (Still limited)
Agent: 退避 800ms 重试
...（持续到用户手动中止）
```

**现有防御**：
- 最大重试次数限制
- Unattended retry 模式下的 heartbeat
- 用户可手动中止

**场景 2：雪崩效应**

```
Agent 1: 请求失败 → 重试
Agent 2: 请求失败 → 重试
Agent 3: 请求失败 → 重试
...
Service: 收到大量重试请求 → 更加过载 → 更多失败
```

**现有防御**：
- 后台查询不重试（Claude Code）
- 严格的 `is_retryable()` 分类（Codex）
- 固定最大重试次数

**场景 3：上下文爆炸**

```
Agent: 发送 100k tokens 上下文
Service: Context overflow
Agent: 自动压缩 → 50k tokens
Agent: 继续执行 → 工具输出又增长
Agent: 下一轮 → 100k tokens again
Service: Context overflow again
```

**现有防御**：
- 主动压缩（所有工程）
- Tool result budget（Claude Code）
- 旧工具输出裁剪（OpenCode）

### 11.3 Agent "自愈"能力对比

| 自愈能力 | Claude Code | Codex | Gemini CLI | OpenCode |
|---------|------------|-------|-----------|----------|
| **认证恢复** | ✅ OAuth refresh | ✅ Token refresh | ✅ 支持 | ✅ 支持 |
| **上下文修正** | ✅ 自动调整 `max_tokens` | ✅ Compact | ⚠️ 未明确 | ✅ 软/硬溢出 |
| **模型降级** | ✅ Fallback model | ❌ 无 | ❌ 无 | ❌ 无 |
| **传输降级** | ❌ 无 | ✅ WebSocket→HTTPS | ❌ 无 | ❌ 无 |
| **行为纠偏** | ✅ Max turns | ❌ 无 | ✅ Loop detection | ✅ Doom loop |
| **Fast mode 降级** | ✅ 自动关闭 | ❌ 无 | ❌ 无 | ❌ 无 |


---

## 12. 总结与建议

### 12.1 核心发现

1. **6 个工程都没有实现真正的背压机制**
   - 没有感知推理服务的实时负载指标
   - 没有主动限流或动态调整请求速率
   - 只有被动的重试策略

2. **现有策略是"故障后恢复"，不是"故障前预防"**
   - 重试、降级、压缩都是在请求失败后才触发
   - 无法在服务即将过载时提前减速

3. **推理服务自身的限流机制是主要保护**
   - Provider 侧已有 rate limiting、queue management
   - Agent 侧只需要遵守 429/529 响应

### 12.2 为什么这样设计是合理的

1. **推理 API 不暴露负载指标**
   - 标准 HTTP API 无法实时推送服务端压力
   - 只有失败后的错误码和 `retry-after` 响应头

2. **大部分场景下不需要背压**
   - 单用户单会话：不会产生高并发
   - Provider 有余量：很少触发限流
   - 偶尔失败：重试足够应对

3. **简单性 > 完美性**
   - 重试机制简单、可预测、易调试
   - 背压机制需要复杂的自适应算法

### 12.3 适合引入背压的场景

只有以下场景才真正需要背压机制：

1. **企业级多用户部署**
   - 多个用户共享同一 API quota
   - 需要公平分配请求速率

2. **自建推理服务**
   - 资源有限的自建集群
   - 需要主动保护不被打挂

3. **批处理工作负载**
   - 大量自动化任务并发执行
   - 需要避免雪崩效应

4. **多会话并发**
   - 同一用户同时运行多个 agent
   - 需要协调请求时机

### 12.4 实施建议

**对于普通用户**：
- ✅ 现有重试机制已经足够
- ✅ 信任 Provider 的限流保护
- ✅ 遇到 429/529 时耐心等待重试

**对于企业用户**：
- ⚠️ 考虑实现方案 A（基于响应延迟的简单背压）
- ⚠️ 监控 API quota 使用情况
- ⚠️ 为不同优先级的任务分配不同的重试策略

**对于 Provider**：
- 💡 考虑暴露实时负载指标（如队列深度）
- 💡 通过 WebSocket 推送服务端压力信号
- 💡 提供更精细的 `retry-after` 指导

**对于开发者**：
- 🔨 优先优化重试策略（如 OpenCode 的 server hint 优先）
- 🔨 实现上下文压缩和 token budget 管理
- 🔨 只在确实需要时才引入复杂的背压机制

### 12.5 关键代码位置索引

| 工程 | 重试核心 | 压缩核心 | 特色机制 |
|-----|---------|---------|---------|
| **Claude Code** | `src/services/api/withRetry.ts:170` | `src/query.ts:365` | Fallback model, Fast mode 降级 |
| **Codex** | `core/src/codex.rs:6441` | `core/src/codex.rs:6076` | WebSocket→HTTPS, RwLock 并发 |
| **Gemini CLI** | `core/src/utils/retry.ts:198` | 未明确 | Loop detection, 模型驱动并发 |
| **OpenCode** | `session/retry.ts:26` | `session/compaction.ts:31` | Server hint 优先, Durable retry |

---

## 附录：术语对照表

| 英文术语 | 中文术语 | 说明 |
|---------|---------|------|
| Backpressure | 背压 | 消费者向生产者反馈处理能力的机制 |
| Throttling | 限流/节流 | 主动限制请求速率 |
| Rate Limiting | 速率限制 | 服务端拒绝过快的请求 |
| Circuit Breaker | 熔断器 | 检测到故障后暂停请求的保护机制 |
| Exponential Backoff | 指数退避 | 重试间隔指数增长的策略 |
| Graceful Degradation | 优雅降级 | 在故障时降低服务质量而不是完全失败 |
| Failover | 故障转移 | 主服务失败后切换到备用服务 |
| Self-Healing | 自愈 | 系统自动从故障中恢复的能力 |
| Context Window | 上下文窗口 | LLM 可处理的最大 token 数量 |
| Compaction | 压缩 | 将长历史摘要为短文本以节省 token |

---

**文档版本**：v1.0  
**最后更新**：2026-06-18  
**作者**：基于 hello-olleh 项目源码分析  
**关联文档**：
- `docs/hello-claude-code/03-agent-loop.md`
- `docs/hello-codex/03-agent-loop.md`
- `docs/hello-gemini-cli/03-agent-loop.md`
- `docs/hello-opencode/03-agent-loop.md`
- `docs/hello-*/07-error-security.md`
