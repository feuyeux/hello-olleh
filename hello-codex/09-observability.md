---
layout: content
title: "Codex 可观测性：日志、追踪与监控"
---
# Codex 可观测性：日志、追踪与监控

本文档分析 Codex 的可观测性基础设施。


**目录**

- [1. 可观测性在 Codex 里的现状](#1-可观测性在-codex-里的现状)
- [2. 日志系统](#2-日志系统)
- [3. 线程状态追踪](#3-线程状态追踪)
- [4. 日志数据库](#4-日志数据库)
- [5. 与 OpenCode 的完整可观测性对比](#5-与-opencode-的完整可观测性对比)
- [6. 改进建议](#6-改进建议)
- [7. 关键源码锚点](#7-关键源码锚点)
- [8. 总结](#8-总结)

---

## 1. 可观测性在 Codex 里的现状

### 1.1 基本架构

Codex 的可观测性相比 OpenCode 较为基础，主要依赖：

- **tracing 日志**：Rust 的 structured logging
- **线程事件**：Thread/Turn/ThreadItem 状态变化
- **数据库日志**：SQLite logs 表

### 1.2 与 OpenCode 的对比

| 特性 | OpenCode | Codex |
| --- | --- | --- |
| 结构化日志 | Log + 文件轮转 | tracing crate |
| 事件总线 | Bus + GlobalBus | 无专用事件总线 |
| 状态追踪 | SessionStatus | ThreadState |
| 可配置观测 | 丰富 | 基础 |

---

## 2. 日志系统

### 2.1 tracing crate

Codex 使用 Rust 的 `tracing` crate：

```rust
tracing::info!("Starting thread");
tracing::debug!("Processing turn");
tracing::warn!("Retry attempt {}", attempt);
tracing::error!("Connection failed: {}", error);
```

### 2.2 日志输出

| 输出目标 | 说明 |
| --- | --- |
| stderr | 开发调试输出 |
| logs DB | SQLite logs 表持久化 |

### 2.3 双数据库日志

OpenCode 有，但 Codex 没有专门的日志轮转机制。

---

## 3. 线程状态追踪

### 3.1 ThreadState 枚举

```rust
pub enum ThreadState {
    Idle,
    Running,
    WaitingForPermission,
    WaitingForQuestion,
    WaitingForContinue,
}
```

### 3.2 状态变化事件

| 事件 | 触发时机 |
| --- | --- |
| `ThreadStarted` | 新线程启动 |
| `TurnStarted` | 回合开始 |
| `TurnCompleted` | 回合完成 |
| `ToolCallStarted` | 工具调用开始 |
| `ToolCallCompleted` | 工具调用完成 |
| `ThreadEnded` | 线程结束 |

---

## 4. 日志数据库

### 4.1 Logs DB Schema

```sql
CREATE TABLE logs (
    id INTEGER PRIMARY KEY,
    ts INTEGER NOT NULL,
    level TEXT NOT NULL,
    target TEXT NOT NULL,
    message TEXT NOT NULL,
    module_path TEXT,
    file TEXT,
    line INTEGER
);
```

### 4.2 日志分区

每 10 MiB 一个分区，按 thread_id 桶分。

---

## 5. 与 OpenCode 的完整可观测性对比

### 5.1 OpenCode 的三支柱

OpenCode 有更完整的可观测性：

1. **结构化日志**：`util/log.ts` 带 service tag、时间差、文件轮转
2. **实例内事件总线**：`Bus` 按 instance scope 的 typed pub/sub
3. **进程级全局广播**：`GlobalBus` 跨 instance 传递事件

### 5.2 Codex 缺少的机制

| 能力 | OpenCode 有 | Codex 状态 |
| --- | --- | --- |
| 专用事件总线 | Bus + GlobalBus | 无 |
| 日志文件轮转 | 10 个文件保留 | 无 |
| SessionStatus | idle/busy/retry 状态机 | 无 |
| 实时事件订阅 | SSE/WebSocket | 无 |
| Structured Logging | 带 service tag | tracing 基础 |

---

## 6. 改进建议

### 6.1 短期增强

1. **增加日志文件轮转**：防止日志无限增长
2. **实现基本事件总线**：支持状态变化的实时通知
3. **增强 ThreadState**：添加 WaitingForPermission 等更多状态

### 6.2 长期规划

| 能力 | 实现建议 |
| --- | --- |
| 事件总线 | 参考 OpenCode Bus 实现 |
| 日志轮转 | 实现 10 文件保留策略 |
| 运行时指标 | 接入 OpenTelemetry |
| 分布式追踪 | 实现 trace context |

---

## 7. 关键源码锚点

| 主题 | 代码锚点 | 说明 |
| --- | --- | --- |
| 错误定义 | `core/src/error.rs` | 错误枚举 |
| 线程状态 | `core/src/thread.rs` | ThreadState |
| 日志数据库 | `state/log_db.rs` | LogDbLayer |
| tracing | `Cargo.toml` | tracing crate |

---

## 8. 总结

Codex 的可观测性相比 OpenCode 较为基础：

1. **tracing 日志**：Rust 标准日志 crate
2. **线程状态**：ThreadState 枚举追踪
3. **SQLite 日志**：持久化到 logs 表

缺少 OpenCode 的专用事件总线（Bus/GlobalBus）、日志文件轮转、SessionStatus 状态机等高级机制。对于基础调试场景，当前架构足以支撑。

---

> 关联阅读：[05-state-management.md](./05-state-management.md) 了解线程状态、持久化与回放链路。

---

## 代码质量评估

**优点**

- **`tracing` crate 结构化日志**：Rust 端使用 `tracing` 提供 span/event 层级日志，可接入 OpenTelemetry collector，远优于 `console.log` 型日志。
- **日志 SQLite 持久化**：事件持久化到数据库而非纯文件，支持时间戳索引查询，长期调试可回溯历史事件。
- **线程状态追踪内置**：`ThreadState`/`TurnState` 是核心运行时对象，状态变更路径有记录，Thread 生命周期可追踪。

**风险与改进点**

- **JS 层日志与 Rust 层 tracing 不统一**：JS 侧使用 `console.log`，Rust 侧使用 `tracing`，跨边界的调试需要同时看两套日志，关联困难。
- **`tracing` 输出默认不暴露给用户**：开发者需主动配置 subscriber 才能看到 trace 输出，默认 release 构建中 trace 信息被编译优化掉，生产调试能力弱。
- **无全局 Trace ID**：单次请求跨越 JS→Rust 边界、submission_loop、多工具并发时，没有统一的 trace_id 关联所有事件，多层调试需手动对齐时间戳。
