---
layout: content
title: "Hooks 与生命周期：Codex 的事件拦截与扩展点"
---
# Hooks 与生命周期：Codex 的事件拦截与扩展点

本文分析 Codex 的生命周期事件体系与 Hook 扩展机制。


**目录**

- [1. Codex 生命周期概览](#1-codex-生命周期概览)
- [2. Op 事件总线](#2-op-事件总线)
- [3. 可扩展的拦截点](#3-可扩展的拦截点)
- [4. 与 Claude Code Hooks 的对比](#4-与-claude-code-hooks-的对比)

---

## 1. Codex 生命周期概览

Codex 的执行生命周期由 `submission_loop` 统一编排，关键阶段如下：

```
进程启动
  → config 加载 & MCP 工具发现
  → ThreadManager 初始化
  → TUI/非交互模式选择
  → submission_loop 进入
      → 接收 Op::UserInput
      → run_turn()
          → run_sampling_request()
          → 工具执行
          → 结果写回
      → 循环等待下一个 Op
  → Op::Shutdown → 清理退出
```

## 2. Op 事件总线

Codex 用 `Op` 枚举作为生命周期事件的统一载体：

```rust
// codex-rs/core/src/codex.rs
pub enum Op {
    UserInput(String),
    ToolResult { call_id: String, result: ToolOutput },
    Interrupt,
    Shutdown,
    McpToolsReady(Vec<Tool>),
    ChildAgentResult(ChildAgentResult),
}
```

`submission_loop` 对每个 Op 分派处理，这是 Codex 的核心事件驱动点。

## 3. 可扩展的拦截点

### 3.1 工具调用前后

通过 `ToolRouter` 的包装层可以注入前后处理逻辑：

```rust
// 工具执行前：权限审批
let approved = approval_handler.check(&tool_call)?;
if !approved { return ToolOutput::denied(); }

// 工具执行
let result = tool.execute(input).await?;

// 工具执行后：结果审计/日志
audit_log.record(&tool_call, &result);
```

### 3.2 Turn 边界

每个 `run_turn()` 结束时触发 memories 提取和 Thread 状态持久化：

```rust
// run_turn 结束后
if config.memories.enabled {
    let mems = extract_memories(&turn_rollout).await;
    thread.add_memories(mems);
}
thread.persist().await?;
```

### 3.3 会话边界

`Op::Shutdown` 触发时执行清理：
```rust
Op::Shutdown => {
    thread_manager.flush_all().await;
    mcp_clients.close_all().await;
    break;
}
```

## 4. 与 Claude Code Hooks 的对比

| 特性 | Codex | Claude Code |
|------|-------|-------------|
| **Hook 注册方式** | 代码级（Rust trait）| 配置级（settings.json hooks 字段）|
| **触发事件** | Op 枚举 | PreToolCall / PostToolCall / 等 |
| **用户可配置** | 否（需修改源码）| 是（JSON 配置）|
| **执行位置** | 同进程 | Shell 命令（独立进程）|

Codex 的生命周期拦截是代码层面的扩展点，适合二次开发；Claude Code 的 Hooks 则是配置驱动的用户扩展。

---

## 关键函数清单

| 函数/类型 | 文件 | 职责 |
|----------|------|------|
| `HookRunner::run_before()` | `codex-rs/core/src/hook.rs` | 执行工具调用前置钩子：验证权限或修改参数 |
| `HookRunner::run_after()` | `codex-rs/core/src/hook.rs` | 执行工具调用后置钩子：审计日志、结果转换 |
| `LifecycleHook` enum | `codex-rs/core/src/hook.rs` | 钩子类型枚举：BeforeTool / AfterTool / SessionStart / SessionEnd |
| `HookConfig` | `codex-rs/core/src/config.rs` | config.toml 中钩子命令配置：trigger → command 映射 |
| `SessionLifecycle::on_start()` | `codex-rs/core/src/lifecycle.rs` | session 启动时触发：初始化沙盒、加载 skill、建立 LSP |
| `SessionLifecycle::on_end()` | `codex-rs/core/src/lifecycle.rs` | session 结束时触发：持久化历史、清理沙盒、关闭 LSP |

---

## 代码质量评估

**优点**

- **明确的四类生命周期点**：BeforeTool/AfterTool/SessionStart/SessionEnd 覆盖了用户最常需要介入的关键节点，不过多不过少。
- **外部命令钩子可编程**：钩子执行外部可执行文件，用户无需修改 codex 源码即可扩展生命周期行为。
- **Session 启动/关闭资源管理清晰**：start/end 钩子保证沙盒和 LSP 的生命周期与 session 对齐，无泄漏风险。

**风险与改进点**

- **钩子执行无超时限制**：钩子命令执行时间无上限，长时间阻塞的钩子会导致整个 session 暂停。
- **钩子失败策略不明确**：前置钩子失败时是继续执行还是中止工具调用，策略未文档化，用户需测试才知道行为。
- **无钩子间通信机制**：多个钩子按顺序执行，后置钩子无法获取前置钩子的输出，限制了复杂钩子链的实现。
