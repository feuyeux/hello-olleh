---
layout: default
title: "Hooks 与生命周期：Effect-ts 驱动的事件流与扩展点"
---
# Hooks 与生命周期：Effect-ts 驱动的事件流与扩展点

本文分析 OpenCode 基于 Effect-ts 的生命周期管理与事件扩展机制。

## 1. OpenCode 生命周期概览

```
进程启动
  → Effect.runMain() 启动运行时
  → Server 初始化（HTTP/WebSocket）
  → Workspace 加载（项目目录扫描）
  → 等待客户端连接（CLI/TUI/Web）
      → 收到 Session.prompt() 请求
          → Session Loop 启动
              → 历史回放 → LLM 请求
              → StreamProcessor 处理事件流
              → Tool 执行 → Durable 写回
              → Bus 广播 → 前端更新
          → Session 完成
  → 等待下一个请求
```

## 2. Effect-ts Layer 作为生命周期边界

OpenCode 用 Effect-ts 的 `Layer` 系统管理资源生命周期，每个 Layer 有明确的 acquire/release：

```typescript
// src/session/index.ts
const SessionLayer = Layer.scoped(
  Session,
  Effect.gen(function* () {
    const db = yield* Database;
    const bus = yield* Bus;
    
    // acquire：初始化会话资源
    const session = yield* createSession(db);
    
    // 注册 finalizer（release）
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        yield* session.flush();          // 确保写回完成
        yield* bus.publish({ type: 'session_ended', id: session.id });
      })
    );
    
    return session;
  })
);
```

## 3. Bus 事件系统

`Bus` 是 OpenCode 的核心事件总线，驱动前端投影和 Hook 触发：

```typescript
// src/bus/index.ts
type BusEvent =
  | { type: 'message.part'; sessionId: string; content: string }
  | { type: 'tool.start'; toolId: string; name: string }
  | { type: 'tool.complete'; toolId: string; result: unknown }
  | { type: 'session.complete'; sessionId: string; usage: Usage }
  | { type: 'error'; code: string; message: string };

// 订阅所有工具调用事件
Bus.subscribe('tool.*', (event) => auditLog.record(event));
```

## 4. 工具调用生命周期 Hook

```typescript
// src/tool/index.ts
const executeWithHooks = (tool: Tool, input: unknown) =>
  Effect.gen(function* () {
    yield* Bus.publish({ type: 'tool.start', toolId, name: tool.name });
    
    const result = yield* tool.execute(input).pipe(
      Effect.timeout(tool.timeout ?? Duration.seconds(60)),
      Effect.retry(tool.retryPolicy),
    );
    
    yield* Bus.publish({ type: 'tool.complete', toolId, result });
    yield* Database.saveToolResult(toolId, result);  // Durable 写回
    
    return result;
  });
```

## 5. 与 Claude Code Hooks 的对比

| 特性 | OpenCode | Claude Code |
|------|---------|-------------|
| **Hook 机制** | Effect-ts Layer + Bus 事件 | settings.json hooks（Shell 命令）|
| **生命周期管理** | Effect.addFinalizer（编译期安全）| 进程信号处理 |
| **事件总线** | Bus（类型化）| 无独立总线 |
| **用户可配置** | 无 Shell Hook | ✅ 配置驱动 |
| **错误传播** | Effect 类型安全传播 | Shell 退出码 |

OpenCode 的生命周期完全由 Effect-ts 类型系统保证，资源泄漏在编译期即可发现；Claude Code 的 Hooks 则面向用户配置，更易扩展但运行时保证较弱。
