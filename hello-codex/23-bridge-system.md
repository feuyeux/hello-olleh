---
layout: content
title: "宿主桥接：app-server 协议与多宿主复用"
---
# 宿主桥接：`app-server` 协议与多宿主复用

本文分析 Codex 如何通过 `app-server-protocol` 将 Rust runtime 暴露给多种宿主（CLI、SDK、Web 服务），实现跨平台复用。


**目录**

- [1. 多宿主架构](#1-多宿主架构)
- [2. app-server-protocol 核心消息](#2-app-server-protocol-核心消息)
- [3. 三种宿主的接入方式](#3-三种宿主的接入方式)
- [4. 与 Claude Code Bridge 的对比](#4-与-claude-code-bridge-的对比)

---

## 1. 多宿主架构

```
┌──────────────────────────────────────────┐
│           宿主层（Host）                  │
│  CLI (codex-cli)  │  TS SDK  │ Web App  │
└─────────┬─────────┴────┬─────┴────┬─────┘
          │              │          │
          └──────────────┴──────────┘
                         │ app-server-protocol
                         ▼
          ┌──────────────────────────────┐
          │     Rust Runtime Core        │
          │  ThreadManager + Agent Loop  │
          └──────────────────────────────┘
```

所有宿主通过统一的 `app-server-protocol` 与 Rust 核心交互，核心逻辑不重复实现。

## 2. app-server-protocol 核心消息

```rust
// codex-rs/app-server-protocol/src/lib.rs

// 宿主 → 核心
pub enum HostToCore {
    CreateThread { config: ThreadConfig },
    ResumeThread { thread_id: ThreadId },
    SendMessage { thread_id: ThreadId, content: String },
    ApproveToolCall { call_id: String },
    DenyToolCall { call_id: String },
    Interrupt { thread_id: ThreadId },
    Shutdown,
}

// 核心 → 宿主
pub enum CoreToHost {
    ThreadStarted { thread_id: ThreadId },
    TokenStream { thread_id: ThreadId, token: String },
    ToolCallRequest { call_id: String, tool: String, input: Value },
    ToolCallResult { call_id: String, output: ToolOutput },
    ThreadComplete { thread_id: ThreadId, usage: TokenUsage },
    Error { code: ErrorCode, message: String },
}
```

## 3. 三种宿主的接入方式

### 3.1 CLI 宿主（直接 Rust 调用）

```rust
// codex-cli/src/main.rs
let core = CodexCore::new(config);
let thread = core.create_thread(thread_config).await?;
core.send_message(thread.id, user_input).await?;
// 直接监听 CoreToHost 消息流
```

### 3.2 TypeScript SDK 宿主（子进程 + JSON stdio）

```typescript
// sdk/typescript/src/exec.ts
const proc = spawn('codex', ['--experimental-json', ...args]);
// 写入 HostToCore JSON 到 stdin
proc.stdin.write(JSON.stringify({ type: 'SendMessage', content: prompt }));
// 从 stdout 读取 CoreToHost JSON 流
for await (const line of proc.stdout) {
    const event = JSON.parse(line);
    handleCoreEvent(event);
}
```

### 3.3 WebSocket 宿主（远程 app-server）

```rust
// codex-rs/app-server/src/main.rs
// 启动 WebSocket 服务，将 app-server-protocol 桥接到 WS 消息
ws_server.on_message(|msg| {
    let cmd: HostToCore = serde_json::from_str(&msg)?;
    core.dispatch(cmd).await
});
core.on_event(|event| {
    let json = serde_json::to_string(&event)?;
    ws_client.send(json).await
});
```

## 4. 与 Claude Code Bridge 的对比

| 特性 | Codex app-server | Claude Code Bridge |
|------|-----------------|-------------------|
| **协议** | app-server-protocol（自定义）| IPC + JSON |
| **传输** | 直接调用 / stdio / WebSocket | Unix socket / named pipe |
| **主要用途** | CLI、SDK、Web 多宿主 | IDE 插件（VS Code 等）|
| **双向通信** | ✅ | ✅ |
| **类型安全** | Rust enum（编译期）| TypeScript interface |

---

## 关键函数清单

| 函数/类型 | 文件 | 职责 |
|----------|------|------|
| `AgentBridge` | `codex-rs/core/src/bridge.rs` | TUI ↔ core 桥接：转发用户消息到 Codex engine，转回事件流 |
| `EventChannel` | `codex-rs/core/src/bridge.rs` | 异步 mpsc 通道：core 发布事件，TUI 订阅消费 |
| `BridgeCommand` enum | `codex-rs/core/src/bridge.rs` | 指令枚举：Send / Interrupt / Reset / SetConfig |
| `ProtocolAdapter` | `codex-rs/core/src/bridge.rs` | 协议适配器：将 core 的内部事件格式转换为 TUI 可渲染的展示格式 |
| `InterruptHandler` | `codex-rs/core/src/bridge.rs` | 处理 Ctrl-C 中断信号：终止当前流、复位 session 状态 |
| `HeadlessRunner` | `codex-rs/core/src/runner.rs` | 无 TUI 的 CLI 模式运行器：`--no-tui` 时直接输出 stdout |

---

## 代码质量评估

**优点**

- **桥接层解耦 UI 与 core**：`AgentBridge` 使得 TUI 和 headless 模式共享同一 core，无 UI 逻辑侵入业务层。
- **mpsc 通道天然线程安全**：Rust mpsc 通道保证 TUI 线程和 core 线程安全通信，无共享内存竞争。
- **`--no-tui` 模式支持脚本化**：`HeadlessRunner` 允许 CI/脚本直接调用 codex 输出文本，不依赖终端。

**风险与改进点**

- **BridgeCommand 枚举扩展成本高**：每添加新指令需同时修改 enum、发送端、处理端三处，无法插件化扩展。
- **EventChannel 背压处理缺失**：消费端（TUI）渲染慢时通道可能积压大量事件，内存占用无上限。
- **中断信号仅支持 Ctrl-C**：不支持 SIGTERM 等系统信号优雅退出，在容器环境中 pod 终止时可能丢失状态。
