# Codex 韧性机制：重试策略、错误归一化与恢复路径

本文档分析 Codex 的韧性系统，涵盖错误处理、重试策略与恢复机制。

## 1. 韧性在 Codex 里的定位

Codex 的韧性机制是一个完整的"把失败变成可调度状态"的系统：

1. **错误归一化**：统一错误类型体系
2. **重试策略**：智能退避而非盲目重试
3. **上下文溢出处理**：compaction 而非终止
4. **Sandbox 隔离**：安全执行边界

---

## 2. 统一错误类型体系

### 2.1 CodexErr 枚举

`core/src/error.rs` 定义了 27+ 错误变体：

| 分类 | 变体 | 含义 |
| --- | --- | --- |
| **连接/流** | `Stream(String, Option<Duration>)` | SSE 流断连（可选重试延迟）|
| | `ConnectionFailed` | 网络连接失败 |
| | `ResponseStreamFailed` | SSE 流失败 |
| | `Timeout` | 超时 |
| **模型/配额** | `ContextWindowExceeded` | 上下文窗口溢出 |
| | `UsageLimitReached` | 用量限制 |
| | `QuotaExceeded` | 配额耗尽 |
| | `ServerOverloaded` | 服务端过载 |
| **认证** | `RefreshTokenFailed` | Token 刷新失败 |
| **沙箱** | `Sandbox(SandboxErr)` | 沙箱错误 |
| **线程** | `ThreadNotFound` | 线程未找到 |
| | `AgentLimitReached` | Agent 数量上限 |
| **流程控制** | `TurnAborted` | 回合被中止 |
| | `Interrupted` | 被用户中断 |

### 2.2 错误归一化的价值

```mermaid
%%{init: {'theme': 'neutral'}}%%
flowchart LR
    A[Provider错误] --> B[fromError 映射]
    B --> C[CodexErr 统一错误]
    C --> D[processor 分支策略]
```

1. provider、网络、系统调用错误先被规约进统一语义
2. processor 后续只需要按错误类别做策略分支

---

## 3. 重试策略

### 3.1 可重试 vs 不可重试

**不可重试**（返回 false）：

| 变体 | 原因 |
| --- | --- |
| `TurnAborted`, `Interrupted` | 用户主动中止 |
| `Fatal`, `InvalidRequest` | 逻辑错误 |
| `ContextWindowExceeded` | 需要压缩而非重试 |
| `UsageLimitReached` | 配额问题 |
| `Sandbox(*)` | 安全策略 |
| `RefreshTokenFailed` | 认证失败 |
| `RetryLimit` | 已用尽重试预算 |

**可重试**（返回 true）：

| 变体 | 原因 |
| --- | --- |
| `Stream(*, *)` | 网络断连 |
| `Timeout` | 超时可恢复 |
| `UnexpectedStatus` | HTTP 暂时异常 |
| `ResponseStreamFailed` | SSE 流暂时中断 |
| `ConnectionFailed` | 网络暂时不可达 |
| `InternalServerError` | 服务端暂时异常 |

### 3.2 智能退避

Codex 不是固定 `2s -> 4s -> 8s`，而是尊重 provider 头信息：

1. `retry-after-ms`（最高优先级）
2. `retry-after`
3. HTTP 日期格式
4. 指数退避（兜底）

---

## 4. Sandbox 隔离机制

### 4.1 SandboxErr 类型

```rust
pub enum SandboxErr {
    Denied { output, network_policy_decision },
    SeccompInstall(seccompiler::Error),      // Linux only
    SeccompBackend,
    Timeout { output },
    Signal(i32),
    LandlockRestrict,
}
```

### 4.2 平台特定实现

| 平台 | 沙箱机制 |
| --- | --- |
| macOS | Seatbelt |
| Linux | Seccomp/Landlock |
| Windows | Restricted Token |

---

## 5. 与 OpenCode 的韧性对比

### 5.1 主要差异

| 特性 | Codex | OpenCode |
| --- | --- | --- |
| 错误归一化 | CodexErr 枚举 | MessageV2 错误类型 |
| 重试策略 | is_retryable() 判断 | retryable() + delay() |
| Context Overflow | 触发 compact | 软溢出/硬溢出双路径 |
| Revert | 无 | Snapshot + history 清理 |
| Permission | 工具级审批 | 独立 Permission 系统 |
| doom_loop | 无 | 连续同工具触发 |

### 5.2 OpenCode 更完整的韧性体系

OpenCode 的韧性包含四类机制：

1. **错误分类与重试**
2. **上下文溢出后的自愈**（compaction）
3. **revert/unrevert 回滚**
4. **permission/question/cancel 交互式阻塞**

---

## 6. 当前限制

### 6.1 Codex 缺少的机制

| 能力 | OpenCode 有 | Codex 状态 |
| --- | --- | --- |
| Compaction | 完整 | 无 |
| Revert | 文件快照 + history | 无 |
| Question 机制 | 完整 | 无 |
| doom_loop | 三次同工具检测 | 无 |

### 6.2 建议增强

1. **实现 Context Compaction**：当上下文窗口接近时自动压缩
2. **增加 Revert 机制**：支持文件快照和历史回滚
3. **Question 系统**：模型主动向用户提问

---

## 7. 关键源码锚点

| 主题 | 代码锚点 | 说明 |
| --- | --- | --- |
| 错误定义 | `core/src/error.rs` | CodexErr 枚举 |
| 重试判断 | `error.rs:197-232` | is_retryable() |
| Sandbox | `tools/sandboxing.rs` | 沙箱隔离实现 |
| 线程管理 | `core/src/thread_manager.rs` | ThreadManager |

---

## 8. 总结

Codex 的韧性机制相比 OpenCode 更为基础：

1. **错误归一化**：27+ 变体的统一错误类型体系
2. **重试策略**：基于 is_retryable() 的智能重试
3. **Sandbox 隔离**：平台特定的沙箱实现

缺少 OpenCode 的 compaction、revert、question 等高级韧性机制。对于基本场景，当前架构足以支撑。

---

> 关联阅读：[09-error-security.md](./09-error-security.md) 了解错误处理的更多细节。
