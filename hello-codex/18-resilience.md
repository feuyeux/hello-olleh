---
layout: content
title: "Codex 韧性机制：重试策略、错误归一化与恢复路径"
---
# Codex 韧性机制：重试策略、错误归一化与恢复路径

本文档分析 Codex 的韧性系统，涵盖错误处理、重试策略与恢复机制。

## 1. 韧性在 Codex 里的定位

Codex 的韧性机制可以概括为一套“把失败继续收束回线程状态”的系统：

1. **错误归一化**：统一错误类型体系
2. **重试策略**：智能退避而非盲目重试
3. **上下文溢出处理**：pre-turn / auto / remote compaction，而不是直接终止
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
| Context Overflow | 触发 manual / pre-turn / auto / remote compaction | 软溢出/硬溢出双路径 |
| Revert | 无 | Snapshot + history 清理 |
| Permission | 工具级审批 | 独立 Permission 系统 |
| doom_loop | 无 | 连续同工具触发 |

### 5.2 对比时要注意的边界

如果只看“是否有 compaction”，两者其实都实现了上下文超限后的自愈；差别主要在于：

1. **Codex** 把 compaction 更紧地嵌进 turn 执行和 rollout 重建。
2. **OpenCode** 把 revert、permission、question 等阻塞分支做成了更显式的独立状态机。
3. **Codex** 的强项在统一错误语义、provider 重试和沙箱升级路径。

---

## 6. 当前限制

### 6.1 Codex 缺少的机制

| 能力 | OpenCode 有 | Codex 状态 |
| --- | --- | --- |
| Compaction | 完整 | 已实现：manual / pre-turn / auto / remote compaction |
| Revert | 文件快照 + history | 没有 OpenCode 那样独立的 snapshot/revert 子系统 |
| Question 机制 | 完整 | 没有对等的独立澄清状态机，更多通过工具/协议能力收束 |
| doom_loop | 三次同工具检测 | 未看到与 OpenCode 对等的显式 doom_loop 防护 |

### 6.2 建议增强

1. **补强可观测性**：把 compaction 触发原因和恢复结果暴露得更直观。
2. **增加显式回滚能力**：如果要追平 OpenCode，仍需要独立的 snapshot / revert 设计。
3. **补齐交互式阻塞语义**：把澄清、取消和恢复路径做得更可见。

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

Codex 的韧性机制并不只停留在“重试 + 沙箱”：

1. **错误归一化**：27+ 变体的统一错误类型体系
2. **重试策略**：基于 is_retryable() 的智能重试
3. **上下文自愈**：已经具备 compaction 路径
4. **Sandbox 隔离**：平台特定的沙箱实现

与 OpenCode 相比，差距主要在显式 revert、question 和更完整的交互式阻塞状态机，而不是 compaction 本身。对于本地代理场景，当前架构已经具备较强的恢复能力。

---

> 关联阅读：[07-error-security.md](./07-error-security.md) 了解错误处理与沙箱边界的更多细节。
