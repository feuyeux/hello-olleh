---
layout: content
title: "Hello Harness: 跨运行时上下文与记忆模块"
---

# Hello Harness: 跨运行时上下文与记忆模块

> 为 AI Coding Agent 设计的运行时无关抽象层

---

## 项目概述

Hello Harness 是一个可插拔的上下文管理和记忆系统设计，旨在让相同的业务逻辑能够在 **OpenCode**（TypeScript/Bun）和 **Hermes Agent**（Python）两个完全不同的运行时内核上无缝运行。

### 核心价值

1. **运行时无关性**：一次编写，多处运行
2. **可插拔架构**：压缩策略、记忆后端、存储层都可替换
3. **保持各自优势**：不强求统一，而是提供能力契约
4. **渐进式迁移**：可以先在一个系统实现，再移植到另一个

---

## 文档导航

### 核心设计文档

| 文档 | 内容 | 状态 |
|------|------|------|
| [40-pluggable-context-memory-module.md](40-pluggable-context-memory-module.md) | 统一抽象层设计、核心接口定义、适配器实现、使用示例 | ✅ 完成 |
| [42-runtime-comparison.md](42-runtime-comparison.md) | OpenCode vs Hermes Agent 详细对比分析 | ✅ 完成 |
| [pluggable-architecture.mermaid](pluggable-architecture.mermaid) | 分层架构可视化图表 | ✅ 完成 |

### 快速开始

1. **理解问题**：阅读 [42-runtime-comparison.md](42-runtime-comparison.md) 了解两个运行时的差异
2. **学习设计**：阅读 [40-pluggable-context-memory-module.md](40-pluggable-context-memory-module.md) 了解统一抽象层
3. **查看架构**：查看 [pluggable-architecture.mermaid](pluggable-architecture.mermaid) 理解分层关系

---

## 核心抽象

### 四大接口

```typescript
// 1. 上下文管理器
interface IContextManager {
  compileSystemPrompt(options: SystemPromptOptions): Promise<string>
  compileMessages(history: Message[], options: CompileOptions): Promise<Message[]>
  injectReminders(messages: Message[], context: RuntimeContext): Promise<Message[]>
  resolveInstructions(directory: string): Promise<Instruction[]>
}

// 2. 记忆提供者
interface IMemoryProvider {
  prefetch(query: string, sessionId: string): Promise<string>
  syncTurn(userContent: string, assistantContent: string, sessionId: string): Promise<void>
  write(target: string, content: string, metadata?: Record<string, any>): Promise<void>
  search(query: string, options?: SearchOptions): Promise<MemoryEntry[]>
}

// 3. 压缩引擎
interface ICompressionEngine {
  shouldCompress(messages: Message[], tokenCount: number): boolean
  compress(messages: Message[], options: CompressionOptions): Promise<Message[]>
  updateTokenUsage(usage: TokenUsage): void
}

// 4. 消息存储
interface IMessageStore {
  createSession(sessionId: string, metadata: SessionMetadata): Promise<void>
  writeMessage(sessionId: string, message: Message): Promise<string>
  readMessages(sessionId: string, options?: ReadOptions): Promise<Message[]>
  searchMessages(query: string, options?: SearchOptions): Promise<SearchResult[]>
}
```

---

## 架构概览

```
┌─────────────────────────────────────────┐
│     业务逻辑层（Runtime-Agnostic）        │
│  自定义压缩策略 / 记忆检索算法 / 优先级规则 │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│        统一抽象层（Unified Interfaces）   │
│  IContextManager / IMemoryProvider      │
│  ICompressionEngine / IMessageStore     │
└─────────────────────────────────────────┘
                    ↓
┌──────────────────┬──────────────────────┐
│  OpenCode 适配器  │  Hermes Agent 适配器  │
│  TypeScript/Bun  │  Python              │
└──────────────────┴──────────────────────┘
                    ↓
┌──────────────────┬──────────────────────┐
│  OpenCode 运行时  │  Hermes Agent 运行时  │
└──────────────────┴──────────────────────┘
```

---

## 关键设计决策

### 1. 消息模型

**决策**：使用扁平 Message 列表作为统一接口

**理由**：
- Hermes 的扁平模型更通用
- OpenCode 的 Part 粒度是实现细节
- 通过 `metadata` 保留细粒度信息

### 2. 上下文编译

**决策**：分离 system prompt 编译和 message 编译

**理由**：
- 两个系统的 system prompt 组装逻辑差异大
- Message 编译相对统一
- 分离后可以独立优化

### 3. 记忆系统

**决策**：使用 Provider 抽象，支持多个 provider 并行

**理由**：
- Hermes 的 MemoryManager 设计成熟
- OpenCode 可以扩展 session_diff
- 支持外部记忆后端

### 4. 压缩策略

**决策**：使用 Engine 抽象，支持可插拔策略

**理由**：
- 两个系统的压缩触发机制差异大
- Engine 抽象统一 token-based 和 agent-based
- 支持第三方策略（LCM / DAG）

---

## 实现路线图

### Phase 1: 接口定义与验证（2 周）

- [x] 完成核心接口定义
- [x] 编写接口文档和使用示例
- [ ] 在 OpenCode 上实现最小可行适配器
- [ ] 验证接口设计完整性

### Phase 2: OpenCode 完整适配（3 周）

- [ ] 实现 OpenCodeContextManager
- [ ] 实现 OpenCodeMemoryProvider
- [ ] 实现 OpenCodeCompressionEngine
- [ ] 实现 OpenCodeMessageStore
- [ ] 编写单元测试和集成测试

### Phase 3: Hermes Agent 完整适配（3 周）

- [ ] 实现 HermesContextManager
- [ ] 实现 HermesMemoryProvider
- [ ] 实现 HermesCompressionEngine
- [ ] 实现 HermesMessageStore
- [ ] 编写单元测试和集成测试

### Phase 4: 跨运行时验证（2 周）

- [ ] 实现自定义压缩策略并在两个运行时运行
- [ ] 实现自定义记忆提供者并在两个运行时运行
- [ ] 性能基准测试和优化
- [ ] 文档完善和示例代码

### Phase 5: 生态扩展（持续）

- [ ] 支持更多存储后端（PostgreSQL / Redis）
- [ ] 支持更多压缩策略（DAG / Sliding Window）
- [ ] 支持更多记忆提供者（Honcho / LangChain）
- [ ] 提供 CLI 工具用于配置和迁移

---

## 使用示例

### 在 OpenCode 中使用

```typescript
const contextManager = new OpenCodeContextManager(session, prompt)
const memoryProvider = new OpenCodeMemoryProvider(storage)
const compressionEngine = new OpenCodeCompressionEngine(session)

// 编译上下文
const systemPrompt = await contextManager.compileSystemPrompt({
  platform: 'cli',
  userSystem: config.user.system
})

const messages = await contextManager.compileMessages(history, {
  includeCompacted: false,
  maxTokens: 100000
})

// 检查压缩
if (compressionEngine.shouldCompress(messages, tokenCount)) {
  messages = await compressionEngine.compress(messages, {
    targetTokens: 80000,
    strategy: 'summary'
  })
}
```

### 在 Hermes Agent 中使用

```python
context_manager = HermesContextManager(prompt_builder, context_engine)
memory_provider = HermesMemoryProvider(memory_manager)
compression_engine = HermesCompressionEngine(context_engine)

# 预取记忆
memory_context = await memory_provider.prefetch(user_message, session_id)

# 编译上下文
system_prompt = await context_manager.compile_system_prompt(
    SystemPromptOptions(platform='telegram')
)

messages = await context_manager.compile_messages(history, CompileOptions())

# 检查压缩
if compression_engine.should_compress(messages, token_count):
    messages = await compression_engine.compress(messages, CompressionOptions())
```

---

## 贡献指南

### 如何贡献

1. **设计反馈**：在 Issues 中讨论接口设计
2. **实现适配器**：为 OpenCode 或 Hermes Agent 实现适配器
3. **自定义策略**：编写跨运行时的压缩策略或记忆提供者
4. **文档改进**：完善使用示例和最佳实践

### 开发环境

**OpenCode 环境**：
```bash
cd opencode
bun install
bun test
```

**Hermes Agent 环境**：
```bash
cd hermes-agent
uv venv venv --python 3.11
source venv/bin/activate
uv pip install -e ".[all,dev]"
python -m pytest tests/
```

---

## 相关资源

### 上游项目

- [OpenCode](https://github.com/stackblitz/opencode) - TypeScript/Bun AI coding agent
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) - Python AI agent with learning loop

### 参考文档

- [OpenCode Architecture](../hello-opencode/01-architecture.md)
- [OpenCode State & Memory](../hello-opencode/04-state-session-memory.md)
- [Hermes Agent README](../hermes-agent/README.md)

---

## 许可证

本设计文档遵循 MIT 许可证。

---

*文档版本: 1.0*  
*创建日期: 2026-04-17*  
*最后更新: 2026-04-17*  
*作者: Claude (Kiro)*

