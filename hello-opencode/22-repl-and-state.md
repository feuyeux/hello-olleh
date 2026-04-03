---
layout: default
title: "REPL 与交互层：多表面入口与统一 Server Contract"
---
# REPL 与交互层：多表面入口与统一 Server Contract

本文分析 OpenCode 的交互层设计，包括多表面（CLI/TUI/Web/Desktop）共享同一 Server 协议的架构，以及用户输入处理流程。

## 1. 多表面架构

OpenCode 是四个系统中交互层最丰富的：

```
用户界面
  ├── CLI（命令行，非交互）
  ├── TUI（终端 UI，Bun + 自定义渲染）
  ├── Web UI（浏览器，React）
  └── Desktop App（Tauri 封装）
         │
         │ 统一协议（HTTP SSE + WebSocket）
         ▼
    OpenCode Server（src/server/）
         │
         ▼
    Session Loop（src/session/）
```

所有表面连接到同一个 OpenCode Server，无论是本地 TUI 还是远程 Web UI，都通过相同的 API 协议交互。

## 2. Server Contract

```typescript
// src/server/routes.ts
// 核心 API 路由
POST /session                    → 创建新会话
POST /session/:id/prompt         → 发送用户消息
GET  /session/:id/events         → SSE 事件流（流式输出）
GET  /session/:id                → 获取会话状态
POST /session/:id/abort          → 中断当前执行
GET  /workspace                  → 获取工作区信息
```

## 3. TUI 模式

OpenCode TUI 是基于 Bun 的自定义终端渲染器：

```typescript
// src/tui/index.ts
const tui = new TUI({
  onInput: async (input) => {
    await fetch(`/session/${sessionId}/prompt`, {
      method: 'POST',
      body: JSON.stringify({ content: input }),
    });
  },
  onEvent: (event) => {
    switch (event.type) {
      case 'message.part': tui.appendContent(event.content); break;
      case 'tool.start': tui.showToolIndicator(event.name); break;
      case 'session.complete': tui.showComplete(event.usage); break;
    }
  },
});

// 连接 SSE 流
const es = new EventSource(`/session/${sessionId}/events`);
es.onmessage = (e) => tui.onEvent(JSON.parse(e.data));
```

## 4. Web UI

Web UI 使用 React，通过相同的 SSE API 接收流式事件：

```typescript
// web/src/hooks/useSession.ts
function useSession(sessionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  
  useEffect(() => {
    const es = new EventSource(`/session/${sessionId}/events`);
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === 'message.part') {
        setMessages(prev => appendToLast(prev, event.content));
      }
    };
    return () => es.close();
  }, [sessionId]);
  
  return messages;
}
```

## 5. 非交互（CLI）模式

```bash
# 直接执行并等待结果
opencode run "修复 src/ 目录下的所有 TypeScript 错误"

# 管道输入
cat error.log | opencode run "分析这些错误并给出修复方案"
```

## 6. 与其他系统的对比

| 特性 | OpenCode | Claude Code | Codex | Gemini CLI |
|------|---------|-------------|-------|-----------|
| **UI 框架** | 自定义 TUI + React Web | Ink | ratatui | Ink |
| **多表面** | ✅（CLI/TUI/Web/Desktop）| ❌（仅 TUI）| ❌（仅 TUI）| ❌（仅 TUI）|
| **统一协议** | HTTP SSE | 无（内嵌）| app-server-protocol | 无（内嵌）|
| **远程访问** | ✅（Web UI）| ❌ | 部分 | ❌ |

OpenCode 的多表面架构是四个系统中最开放的，Server 协议使得任意客户端（甚至第三方）都能接入。
