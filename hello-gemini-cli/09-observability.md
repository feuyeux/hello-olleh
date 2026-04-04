# Gemini CLI 可观测性：日志、MessageBus 与 UI 状态追踪

本文档分析 Gemini CLI 的可观测性基础设施。

## 1. 可观测性在 Gemini CLI 里的定位

### 1.1 三支柱架构

Gemini CLI 的可观测性围绕三个核心机制：

1. **日志**：结构化日志输出
2. **MessageBus**：状态广播事件总线
3. **UIStateContext**：UI 层的状态投影

### 1.2 与其他项目的对比

| 特性 | Claude Code | Codex | OpenCode | Gemini CLI |
| --- | --- | --- | --- | --- |
| 结构化日志 | Logger | tracing | Log + 轮转 | console 基础 |
| 事件总线 | 专用 Bus | 无 | Bus + GlobalBus | MessageBus |
| 状态追踪 | SessionStatus | ThreadState | SessionStatus | UIStateContext |
| 实时订阅 | 支持 | 无 | 支持 | React Context |

---

## 2. 日志系统

### 2.1 console 日志

Gemini CLI 使用标准 console 输出：

```typescript
console.log('Starting initialization')
console.error('Failed to connect:', error)
console.warn('Retry attempt:', attempt)
```

### 2.2 Ink 组件的日志

TUI 使用 Ink 组件渲染日志：

```typescript
import { Text } from 'ink'

<Text color="green">✓ Initialized</Text>
<Text color="red">✗ Error: {message}</Text>
```

---

## 3. MessageBus 事件总线

### 3.1 MessageBus 架构

`packages/core/src/confirmation-bus/message-bus.ts`：

```typescript
class MessageBus extends EventEmitter {
  emit(event: string, data: any): boolean
  on(event: string, listener: (...args: any[]) => void): this
  off(event: string, listener: (...args: any[]) => void): this
}
```

### 3.2 事件类型

| 事件 | 触发时机 | 数据 |
| --- | --- | --- |
| `turn:start` | 回合开始 | `{ turnId }` |
| `turn:end` | 回合结束 | `{ turnId, result }` |
| `tool:call` | 工具调用 | `{ tool, params }` |
| `tool:result` | 工具返回 | `{ tool, result }` |
| `error` | 错误发生 | `{ error }` |
| `approval:required` | 需要审批 | `{ tool, params }` |

### 3.3 使用场景

```typescript
// 监听工具调用
messageBus.on('tool:call', ({ tool, params }) => {
  console.log(`Calling ${tool}:`, params)
})

// 监听回合结束
messageBus.on('turn:end', ({ turnId, result }) => {
  updateUI({ turnId, result })
})
```

---

## 4. UIStateContext 状态管理

### 4.1 React Context 架构

```typescript
const UIStateContext = React.createContext<UIState>({
  currentTurn: null,
  messages: [],
  tools: [],
  status: 'idle'
})
```

### 4.2 状态投影

| 状态字段 | 类型 | 说明 |
| --- | --- | --- |
| `currentTurn` | `Turn \| null` | 当前回合 |
| `messages` | `Message[]` | 消息历史 |
| `tools` | `Tool[]` | 可用工具 |
| `status` | `'idle' \| 'running' \| 'waiting'` | 运行状态 |

### 4.3 与 MessageBus 的协作

```typescript
// MessageBus 事件 → UIState 更新
messageBus.on('turn:end', ({ result }) => {
  setUIState(prev => ({
    ...prev,
    messages: [...prev.messages, result]
  }))
})
```

---

## 5. Storage 持久化

### 5.1 Storage 接口

```typescript
interface Storage {
  saveSession(session: Session): Promise<void>
  loadSession(id: string): Promise<Session | null>
  listSessions(): Promise<SessionSummary[]>
  deleteSession(id: string): Promise<void>
}
```

### 5.2 JSON 文件存储

```typescript
class JsonStorage implements Storage {
  async saveSession(session: Session): Promise<void> {
    const path = `${this.dir}/${session.id}.json`
    await writeFile(path, JSON.stringify(session))
  }
}
```

### 5.3 与 MessageBus 的集成

```typescript
// 回合结束后自动保存
messageBus.on('turn:end', async ({ turnId, result }) => {
  const session = buildSessionFromHistory()
  await storage.saveSession(session)
})
```

---

## 6. 与 OpenCode 的完整可观测性对比

### 6.1 主要差距

| 能力 | OpenCode | Gemini CLI |
| --- | --- | --- |
| 结构化日志 | Log + 文件轮转 | console 基础 |
| 事件总线 | Bus + GlobalBus | MessageBus (local) |
| 日志持久化 | 10 文件保留策略 | JSON 文件 |
| 实时订阅 | SSE/WebSocket | React Context |
| 分布式追踪 | OpenTelemetry | 无 |

### 6.2 缺失的机制

1. **日志文件轮转**：无自动清理
2. **全局事件广播**：MessageBus 仅本地
3. **结构化日志**：无 service tag
4. **OpenTelemetry**：无分布式追踪

---

## 7. 改进建议

### 7.1 短期增强

1. **增强日志格式**：添加 timestamp、level、service tag
2. **实现日志轮转**：防止日志无限增长
3. **GlobalBus**：跨进程事件广播

### 7.2 长期规划

| 能力 | 实现建议 |
| --- | --- |
| 结构化日志 | 使用 pino 或 winston |
| 日志轮转 | 实现 10 文件保留策略 |
| 分布式追踪 | 接入 OpenTelemetry |
| 全局广播 | 实现 GlobalBus 机制 |

---

## 8. 关键源码锚点

| 主题 | 代码锚点 | 说明 |
| --- | --- | --- |
| MessageBus | `packages/core/src/confirmation-bus/message-bus.ts` | 事件总线 |
| UIStateContext | `packages/cli/src/ui/contexts/UIStateContext.tsx` | UI 状态 |
| Storage | `packages/core/src/config/storage.ts` | 持久化根目录与路径接口 |
| TUI 渲染 | `packages/cli/src/ui/App.tsx` | Ink 组件 |

---

## 9. 总结

Gemini CLI 的可观测性相比 OpenCode 较为基础：

1. **日志**：console 基础输出
2. **MessageBus**：本地 EventEmitter 事件总线
3. **UIStateContext**：React Context 状态管理
4. **Storage**：JSON 文件持久化

相比 OpenCode 的 Log + Bus + GlobalBus 三支柱，Gemini CLI 缺少日志轮转、全局广播和结构化日志。对于本地开发调试，当前架构足以支撑。

---

> 关联阅读：[05-state-management.md](./05-state-management.md) 了解 Storage 详情。
