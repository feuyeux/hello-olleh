---
layout: content
title: "宿主桥接：app-server 协议与多宿主复用"
---
# 宿主桥接：`app-server` 协议与多宿主复用

本文分析 Codex 如何通过 `app-server-protocol` 将 Rust runtime 暴露给多种宿主（CLI、SDK、Web 服务），实现跨平台复用。

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
