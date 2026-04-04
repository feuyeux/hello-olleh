---
layout: default
title: "多代理与并行：Codex 的单代理架构与 child-agents 机制"
---
# 多代理与并行：Codex 的单代理架构与 child-agents 机制

本文分析 Codex 在多代理（Multi-Agent）方向的设计，包括其以单代理为核心的架构取向，以及通过 child-agents 实现任务分派的机制。

## 1. 架构取向：单代理为主

Codex 的核心设计围绕**单线程 Agent 执行循环**（`submission_loop` → `run_turn`）展开，强调：
- 执行的可预期性（Predictability）
- 状态管理的简洁性（Thread 作为统一边界）
- 调试的可追溯性（线程历史完整保留）

这与 Claude Code 的"子代理（subagents）"和 OpenCode 的"Subagent 工具"形成对比。

## 2. Child-Agents 机制

尽管以单代理为主，Codex 支持通过 **child-agents** 机制实现局部任务并行：

### 2.1 触发方式

模型可以通过特定 tool call 启动 child-agent：

```json
{
  "type": "tool_call",
  "name": "spawn_child_agent",
  "args": {
    "task": "分析并修复 src/auth 目录下的类型错误",
    "working_dir": "/path/to/project",
    "max_turns": 10
  }
}
```

### 2.2 执行隔离

每个 child-agent 运行在独立的 `Thread` 上下文中：
- 独立的历史记录（不共享父 agent 的对话历史）
- 独立的工具权限（继承父 agent 的 approval policy）
- 独立的沙箱隔离（如果启用）

### 2.3 结果回收

child-agent 执行结束后，其结果（`final_response`）以 `tool_result` 形式回传给父 agent：

```rust
// codex-rs/core/src/codex.rs
fn handle_child_agent_result(
    parent_thread: &mut Thread,
    child_result: ChildAgentResult,
) {
    parent_thread.add_tool_result(
        child_result.tool_call_id,
        child_result.final_response,
    );
}
```

## 3. 工具级并行

对于不需要子代理的场景，Codex 支持**单轮内多工具并行**：

```rust
// codex-rs/core/src/codex.rs
async fn execute_tool_calls(
    tool_calls: Vec<ToolCall>,
) -> Vec<ToolResult> {
    // 并行执行同一轮的多个工具调用
    join_all(tool_calls.iter().map(|tc| self.execute_single(tc))).await
}
```

同一模型响应中的多个 tool_call 可以并发执行，适合：
- 同时读取多个文件
- 同时搜索多个目录
- 同时运行多个独立的 shell 命令

## 4. 与其他系统的对比

| 特性 | Codex | Claude Code | Gemini CLI | OpenCode |
|------|-------|-------------|-----------|---------|
| **多代理模式** | Child-agents（可选） | Sub-agents（内置） | 本地/远程子代理 | Subagent 工具 |
| **并行方式** | 单轮多工具并行 | Task 后台并行 | 子代理 + 工具并行 | 多工具并行 |
| **代理间通信** | Thread 结果传递 | 消息传递 | tool result / 进度事件回传 | Bus 事件 |
| **隔离边界** | Thread（独立状态） | Session（独立）| 独立 agent context | Instance |
| **主要使用场景** | 大规模代码任务分解 | 后台长任务 | 卸载长任务、远程代理协作 | 结构化任务编排 |

## 5. 设计权衡

**Codex 为什么以单代理为主**：

1. **状态一致性**：多代理协调引入竞争条件风险
2. **调试友好**：单线程执行路径更易追踪问题
3. **资源可控**：避免并发代理争用 token 预算
4. **Rust 安全**：Rust 类型系统保障单线程逻辑的内存安全

**child-agents 的适用场景**：
- 明确可分解的子任务（如"独立分析每个模块"）
- 需要隔离执行（一个 child 失败不影响父 agent）
- 任务结果之间无强依赖关系
