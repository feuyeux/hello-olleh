---
layout: content
title: "OpenCode 的状态、会话与记忆系统"
---
# OpenCode 的状态、会话与记忆系统

> 基于 `opencode` `v1.3.2`（tag `v1.3.2`，commit `0dcdf5f529dced23d8452c9aa5f166abb24d8f7c`）源码校对

本章将三个紧密协作的子系统合并讲解：**状态管理**（Durable State 写入与持久化）、**上下文管理**（从输入重写到模型消息投影）、**记忆系统**（Session 级别文件变更追踪与摘要管理）。三者共同构成 OpenCode 的"认知基础设施"——状态管理负责把每一轮对话可靠地写进 SQLite；上下文管理负责在每次调用模型前把这些持久化数据编译成正确的 prompt；记忆系统则在 session 结束或压缩时把文件变更差分持久化，供后续 session 恢复和前端展示使用。

---

**目录**

- [1. 概述：三个子系统如何协同工作](#1-概述三个子系统如何协同工作)
- [2. 实现机制](#2-实现机制)
  - [2.1 状态管理](#21-状态管理)
  - [2.2 上下文管理](#22-上下文管理)
  - [2.3 记忆系统](#23-记忆系统)
- [3. 实际使用模式](#3-实际使用模式)
- [4. 代码示例](#4-代码示例)
- [5. 关键函数清单](#5-关键函数清单)
- [6. 代码质量评估](#6-代码质量评估)

---

## 1. 概述：三个子系统如何协同工作

OpenCode 的运行时可以用一句话概括：**"先写库，再发事件，最后编译上下文"**。三个子系统分别负责这条链路的不同阶段：

| 子系统 | 核心职责 | 主要代码位置 |
|--------|---------|------------|
| 状态管理 | 把每轮对话的 message/part 可靠写入 SQLite，并通过 Bus 广播事件 | `session/index.ts`、`storage/db.ts`、`message-v2.ts` |
| 上下文管理 | 在调用模型前，把持久化历史、指令文件、运行时提醒编译成 `ModelMessage[]` | `session/prompt.ts`、`session/system.ts`、`session/llm.ts` |
| 记忆系统 | 在 compaction/session 结束时，从 step 快照边界计算文件 diff，写回 durable state | `session/summary.ts`、`snapshot/index.ts` |

三者的协作顺序如下：

1. 每轮 LLM 流事件到来 → **状态管理**把 message/part 写进 SQLite
2. 下一轮开始前 → **上下文管理**从 SQLite 读出历史，叠加指令和提醒，编译成 prompt
3. compaction 触发时 → **记忆系统**从 step 快照计算 diff，写回 session_diff 和 session summary

---

## 2. 实现机制

### 2.1 状态管理

#### 2.1.1 Durable State 写入口

`session/index.ts:686-789` 集中了三组写入口：

| API | 语义 | 代码坐标 |
|-----|------|---------|
| `Session.updateMessage()` | upsert message 头 | `686-706` |
| `Session.updatePart()` | upsert part 快照 | `755-776` |
| `Session.updatePartDelta()` | 发布 part 增量事件（不写库）| `778-789` |

#### 2.1.2 SQLite 三张核心表

| 表 | 关键列 | 存什么 |
|---|--------|-------|
| `SessionTable` | `project_id / workspace_id / parent_id / directory / title / summary / revert / permission` | session 边界 |
| `MessageTable` | `session_id / time_created / data(json)` | message header |
| `PartTable` | `message_id / session_id / time_created / data(json)` | part 体 |

**关键设计**：`MessageTable.data` 和 `PartTable.data` 只存 `Omit<Info, 'id' | 'sessionID'>` 的 JSON，ID 和外键列走关系型列。

#### 2.1.3 `Database.effect()` 保证"先写库再发事件"

`storage/db.ts:121-146` 通过 `Database.effect()` 机制确保副作用（Bus 事件）在 SQLite 写入完成后才执行，消除"已通知但未持久化"的窗口。

#### 2.1.4 Message 与 Part 的关系

| 层 | 职责 |
|---|------|
| message header | 轮次边界：role / agent / model / tokens / cost / finish |
| part | 轮次内部节点：text / reasoning / tool / step / patch |
| durable 写入 | message 和 part 分开存 |
| 实时渲染 | 主要消费 part |
| 回放时组装 | `hydrate()` 把 message + parts[] 组装成 `WithParts` |

`MessageV2.WithParts[]` = message + parts[]，是 durable history 回放的基本单位。

#### 2.1.5 三条消费链

OpenCode 的事件流分三条独立消费链：

- **实时链**：`LLM.stream()` → `SessionProcessor.process()` → `Session.update*()` → `Bus.publish()` → SSE → UI
- **跨实例聚合链**：`Bus.publish()` → `GlobalBus.emit()` → `/global/event` → GlobalSDK SSE → 按 directory 分发
- **Durable 回放链**：`Session.update*()` → SQLite → `MessageV2.stream() / hydrate()` → `toModelMessages()` → 下一轮 loop

#### 2.1.6 MessageV2 关键函数

| 函数 | 文件坐标 | 功能 |
|------|---------|------|
| `MessageV2.stream()` | `message-v2.ts:827-849` | 按"新到旧"产出消息 |
| `MessageV2.filterCompacted()` | `message-v2.ts:882-898` | 过滤已压缩历史，返回活动历史 |
| `MessageV2.hydrate()` | `message-v2.ts:533-557` | 把 message rows 与 part rows 组装成 `WithParts` |
| `MessageV2.toModelMessages()` | `message-v2.ts:559-792` | 把 durable history 投影成 AI SDK `ModelMessage[]` |
| `MessageV2.page()` | `message-v2.ts:794-813` | 分页读取，按 `time_created desc` |

#### 2.1.7 并发占位机制

**assistant skeleton 先写**：`session/prompt.ts:591-620` 在 normal round 开始前，先 `Session.updateMessage(assistant skeleton)` 创建一条空的 assistant message。processor 不是"先拿到流，再决定往哪里写"，而是"先拿到一条 durable assistant 宿主，再把流事件持续写进去"。

**reasoning / text 占位 part**：`processor.ts:63-80`、`291-304` 在流事件到来时，先创建空 part 占位，再增量更新。

#### 2.1.8 SessionStatus 与 Durable State 的区别

| 对象 | 存储位置 | 语义 |
|------|---------|------|
| `Session.Info` | SQLite `SessionTable` | durable 执行边界 |
| `MessageV2.Info` | SQLite `MessageTable` | durable 轮次边界 |
| `MessageV2.Part` | SQLite `PartTable` | durable 轮次内部节点 |
| `SessionStatus` | 内存 `Map<SessionID, Info>` | 运行态（busy/retry/idle）|

`SessionStatus` 存在内存中，不进 SQLite，因为它不适合持久化回放。

#### 2.1.9 Snapshot 与 Diff

- **Snapshot 记录**：`snapshot/index.ts` 在每个 step 开始时记录快照 ID
- **Diff 计算**：`session/summary.ts:144-169` 从 message history 中找最早和最晚的 step 快照，调用 `Snapshot.diffFull(from, to)` 计算 diff，写进 `Storage.write(["session_diff", sessionID])`
- **Compaction 中的 Diff**：`session/compaction.ts` 在 replay 时把旧 replay parts 复制回来，media 附件降级成文本提示

---

### 2.2 上下文管理

#### 2.2.1 六个上下文来源

在 `v1.3.2` 中，送进模型的上下文主要来自 6 个来源：

| 来源 | 代码坐标 | 在哪一层进入 |
|------|---------|------------|
| 用户原始输入 | `session/prompt.ts:986-1386` | `createUserMessage()` 编译 part |
| 文件/MCP/agent 附件展开 | `prompt.ts:1000-1325` | 仍属于 user message 编译阶段 |
| provider/agent 基础提示 | `session/system.ts:18-26`、`session/llm.ts:70-82` | `LLM.stream()` 组 system |
| 环境/技能/指令文件 | `system.ts:28-67`、`instruction.ts:72-142` | `prompt.ts:675-685` |
| 运行时提醒 | `prompt.ts:1389-1527`、`655-668` | `insertReminders()` 与 queued user reminder |
| durable history 投影 | `message-v2.ts:559-792` | `toModelMessages()` |

OpenCode 的上下文不是"message string + system string"，而是一份 runtime 编译产物。

#### 2.2.2 输入侧改写

**文件展开成 synthetic text**：`createUserMessage()` 对 file part 的处理：

1. 文本文件会主动跑 `ReadTool`，把内容或片段变成 synthetic text
2. 目录会被列出条目再写成 synthetic text
3. MCP resource 会先被读取再写成 synthetic text
4. 二进制文件和图片/PDF 会保留为 file attachment

因此 durable history 里记录的不是"用户附了个路径"，而是"系统如何理解这个附件"。

**`@agent` 改写成上下文提示**：`1303-1325` 不直接执行子任务，而是写入一条 synthetic text，明确告诉模型：上面那段上下文要被拿去生成 subtask prompt、应调用 `task` 工具、subagent 类型是什么。这本质上是把 orchestration hint 编译进上下文。

#### 2.2.3 指令系统三种读取方式

**system 级指令**：`instruction.ts:72-142` 的 `systemPaths()` / `system()` 会搜集：
1. 工程内向上查找的 `AGENTS.md` / `CLAUDE.md` / `CONTEXT.md`
2. 全局配置目录里的 `AGENTS.md`
3. `~/.claude/CLAUDE.md`
4. `config.instructions` 里声明的额外本地文件和 URL

**read tool 触发的局部指令发现**：`InstructionPrompt.resolve()` 在 `168-190` 会围绕某个被读取的文件路径，向上查找尚未加载、也未被当前 message claim 过的 instruction 文件。调用点在 `tool/read.ts:118`，因此当 agent 读取一个深层文件时，OpenCode 还能补发现该子目录局部的 `AGENTS.md`/`CLAUDE.md`。

**loaded/claim 机制避免重复灌上下文**：`InstructionPrompt.loaded(messages)` 会从历史里的 `read` 工具结果 metadata 中提取已经加载过的 instruction 路径；`claim/clear` 用于避免同一 message 内重复注入。

#### 2.2.4 system prompt 真实组装顺序

普通推理分支里，`prompt.ts:675-685` 先准备好：环境 prompt、技能说明、指令文件内容；随后 `llm.ts:70-82` 再做最后组合：

1. `agent.prompt` 或 provider prompt（底座）
2. 上面这批运行时 system 片段（中层）
3. `user.system`（顶层补丁）

因此如果看到某条 system prompt 很长，很可能是 runtime 多层合并的结果，而不是来自单个模板文件。

#### 2.2.5 运行时提醒

**plan/build reminder**：`prompt.ts:1389-1527` 会根据当前 agent、上轮 agent 和实验 flag：
1. 给 `plan` agent 注入 plan mode 限制说明
2. 从 `plan` 切回 `build` 时插入 build-switch 提醒
3. 在实验 plan mode 下把计划文件路径和工作流规则写进 synthetic text

plan/build 切换不是 UI 状态，而是被 durable/synthetic context 明确告知模型。

**queued user message reminder**：`655-668` 会把上轮 assistant 之后插入的新 user 文本临时包成 `<system-reminder>`，提醒模型优先处理后来的消息。这一步不回写数据库，但会影响本轮模型感知到的对话顺序和优先级。

#### 2.2.6 Durable history 投影

`MessageV2.toModelMessages()` 负责把 durable history 转成 AI SDK `ModelMessage[]`。

**user 侧投影规则**：
- `text` → user text part
- 非文本 file → user file part
- `compaction` → `"What did we do so far?"`
- `subtask` → `"The following tool was executed by the user"`

**assistant 侧投影规则**：
- `text`、`reasoning`、`tool-call` / `tool-result` / `tool-error`、`step-start`
- 未完成的 tool call 会被补成 `"Tool execution was interrupted"` 的 error result，避免 provider 看到悬挂的 tool_use 块

**media-in-tool-result 兼容**：若 provider 不支持 tool result 里带 media，`703-778` 会把图片/PDF 附件抽出来，再额外注入一条 user file message。这是模型上下文兼容层，不是 UI 行为。

#### 2.2.7 工具集合裁剪

OpenCode 当前的工具上下文有两层裁剪：

1. `SessionPrompt.resolveTools()` 先构造本地工具、插件工具、MCP 工具，并挂上 metadata/permission/plugin hooks
2. `LLM.resolveTools()` 再根据 agent/session/user 的 permission 规则删掉禁用工具

模型看到的 tool set 是"当前轮次 + 当前 agent + 当前权限上下文"下的最终结果，不是静态注册表快照。

---

### 2.3 记忆系统

#### 2.3.1 SessionSummary 三个导出函数

`packages/opencode/src/session/summary.ts` 当前导出三个函数：

| 函数 | 代码位置 | 做什么 |
|------|---------|-------|
| `summarize` | `71-89` | 对指定 message 触发 session 摘要和 message 摘要两条计算 |
| `diff` | `123-142` | 读取/规范化 session_diff，返回 `FileDiff[]` |
| `computeDiff` | `144-169` | 从 message history 的 step-start/step-finish 快照中计算 diff |

#### 2.3.2 `summarize` 完整流程

`71-89` 的 `summarize` 实际上调用两条并行计算路径：

```ts
await Promise.all([
  summarizeSession({ sessionID, messages: all }),
  summarizeMessage({ sessionID, messages: all }),
])
```

**`summarizeSession`（`91-106`）**：写 session 级聚合，做四件事：
1. `computeDiff(messages)` 得到 `FileDiff[]`
2. 把 `additions/deletions/files` 总计数写回 `Session.setSummary()`
3. 把完整 `FileDiff[]` 写入 `Storage` 的 `session_diff` 路径
4. 通过 `Bus` 发布 `Session.Event.Diff`

**`summarizeMessage`（`108-121`）**：写 message 级细粒度 diff：
1. 找到指定 `messageID` 对应的 user message 及其后续 assistant 兄弟节点
2. 只对这个子区间调用 `computeDiff()`
3. 把结果合并进 `userMsg.summary.diffs`

每个 compaction summary message 携带的 diff 是"到这个 message 为止的增量"，而不是全量 session diff。

#### 2.3.3 Diff 计算起点与终点

`computeDiff()`（`144-169`）的核心逻辑是**从 message history 中找最早和最晚的 step 快照**：

1. **找起点**：遍历所有 part，第一个遇到 `step-start.snapshot` 就记下
2. **找终点**：遍历所有 part，所有 `step-finish.snapshot` 都更新，最后一个就是终点
3. 如果起点和终点都找到，调用 `Snapshot.diffFull(from, to)`

关键推论：
- diff 不来自"编辑器保存"或"git diff"，而来自 `step-start/step-finish` 快照边界
- 如果一轮 session 内没有任何 step（纯对话），`computeDiff` 返回空数组
- 快照本身存放在 `Snapshot` 服务里

#### 2.3.4 `diff` 函数读取端

`diff()`（`123-142`）是读取侧：
1. 先从 `Storage.read(["session_diff", sessionID])` 拿缓存的 diff
2. 对每个条目的 `file` 字段做 Git 路径规范化（处理 `"..."` 这种 octal-escaped 格式）
3. 如果规范化后发现有变化（文件名变了），回写更新后的列表
4. 返回最终 `FileDiff[]`

Git 内部存储路径时会做 octal escape，读取时需要规范化才能给用户看可读的路径。

#### 2.3.5 为什么是"记忆"而不是"摘要"

一般的"摘要"只指"压缩后的文本描述"。OpenCode 的实现要具体得多：

| 维度 | 说明 |
|------|------|
| 文件级 | 每轮 step 的开始/结束快照构成一个可差分的版本链 |
| 变更级 | `FileDiff` 包含 `additions/deletions/changes`，不是模糊文字 |
| 持久化级 | diff 数据存在 `Storage`（JSON 文件）里，不是内存态 |
| 传播级 | 通过 `Bus.publish` 实时推给前端，不是轮询 |

`SessionSummary` 更准确的定位是：**session 级别的文件变更追踪系统**，而"摘要"只是这个追踪系统的一个聚合投影。

#### 2.3.6 和 Compaction 的关系

compaction 会触发 `summary` agent 生成 summary message，触发链路是：

```
CompactionTask → summary agent → SessionProcessor.process()
  → 生成 summary assistant message
  → SessionSummary.summarize() 被调用
  → 写 session_diff + Session.setSummary()
```

`SessionSummary` 既是 compaction 的消费者（compaction 调用它），也是 summary 数据的持久化层（它把计算结果写回 durable state）。

---

## 3. 实际使用模式

三个子系统在实际场景中的协同方式如下：

### 3.1 普通对话轮次

```
用户输入
  → 上下文管理：createUserMessage() 编译 user message/parts（文件展开、@agent 改写）
  → 状态管理：Session.updateMessage(user) 写入 SQLite
  → 上下文管理：prompt.ts 叠加 system prompt（provider + 环境 + 指令文件 + 运行时提醒）
  → 上下文管理：toModelMessages() 把 durable history 投影成 ModelMessage[]
  → LLM.stream() 调用模型
  → 状态管理：assistant skeleton 先写（updateMessage），流事件持续写 part（updatePart/updatePartDelta）
  → Bus 广播 SSE 事件 → UI 实时渲染
```

### 3.2 Session Resume（跨实例恢复）

```
新实例启动
  → 状态管理：MessageV2.stream() 从 SQLite 按时间顺序读出全量消息
  → 状态管理：MessageV2.filterCompacted() 过滤已压缩历史
  → 上下文管理：toModelMessages() 重新投影成 ModelMessage[]
  → 继续对话，模型感知到完整历史
```

### 3.3 Compaction 触发时

```
历史超过阈值
  → CompactionTask 触发 summary agent
  → summary agent 生成 summary assistant message
  → 记忆系统：SessionSummary.summarize() 被调用
    → summarizeSession：computeDiff() → 写 session_diff + Session.setSummary() + Bus.publish
    → summarizeMessage：对子区间 computeDiff() → 写 userMsg.summary.diffs
  → 状态管理：旧历史标记为 compacted，filterCompacted() 后续过滤掉
  → 上下文管理：compaction part 在 toModelMessages() 中投影为 "What did we do so far?"
```

### 3.4 工具调用与文件变更追踪

```
agent 执行 write/patch 工具
  → step-start 时：Snapshot.track() 记录快照 ID
  → 工具执行，文件发生变更
  → step-finish 时：记录终点快照 ID
  → 记忆系统：computeDiff(from, to) 计算 FileDiff[]
  → 写入 Storage["session_diff", sessionID]
  → Bus.publish(Session.Event.Diff) → 前端 diff 面板实时更新
```

---

## 4. 代码示例

### 4.1 Durable State 写入口流程

```mermaid
flowchart LR
    Event["流事件"]
    Msg["Session.updateMessage()"]
    Part["Session.updatePart()"]
    Delta["Session.updatePartDelta()"]
    MsgTable["MessageTable"]
    PartTable["PartTable"]
    BusMsg["message.updated"]
    BusPart["message.part.updated"]
    BusDelta["message.part.delta"]

    Event --> Msg
    Event --> Part
    Event --> Delta
    Msg --> MsgTable
    Msg --> BusMsg
    Part --> PartTable
    Part --> BusPart
    Delta --> BusDelta
```

### 4.2 `Database.effect()` 保证"先写库再发事件"

```mermaid
sequenceDiagram
    participant Caller as Session.update*
    participant DB as Database.use()
    participant Effect as effects[]
    participant Bus as Bus.publish()
    participant SQL as SQLite

    Caller->>DB: 进入 Database.use(...)
    DB->>SQL: insert / upsert
    Caller->>Effect: Database.effect(fn)
    DB-->>DB: 回调结束
    DB->>Effect: 依次执行 effects
    Effect->>Bus: publish(...)
```

### 4.3 实时消费链

```mermaid
flowchart LR
    LLM["LLM.stream()"]
    Proc["SessionProcessor.process()"]
    Update["Session.update*()"]
    Bus["Bus.publish()"]
    Event["/event SSE"]
    UI["TUI / CLI / App"]

    LLM --> Proc --> Update --> Bus --> Event --> UI
```

### 4.4 跨实例聚合链

```mermaid
flowchart LR
    Bus["Bus.publish()"]
    Global["GlobalBus.emit()"]
    Route["/global/event"]
    SDK["GlobalSDK SSE"]
    Store["按 directory 分发"]

    Bus --> Global --> Route --> SDK --> Store
```

### 4.5 Durable 回放链

```mermaid
flowchart LR
    Write["Session.update*()"]
    DB["SQLite"]
    Read["MessageV2.stream() / hydrate()"]
    Project["toModelMessages()"]
    Loop["loop 下一轮"]

    Write --> DB --> Read --> Project --> Loop
```

### 4.6 SessionSummary 并行计算

```ts
// session/summary.ts:71-89
await Promise.all([
  summarizeSession({ sessionID, messages: all }),
  summarizeMessage({ sessionID, messages: all }),
])
```

---

## 5. 关键函数清单

### 5.1 状态管理

| 函数 | 文件坐标 | 功能 |
|------|---------|------|
| `Session.updateMessage()` | `session/index.ts:686-706` | upsert message 头 |
| `Session.updatePart()` | `session/index.ts:755-776` | upsert part 快照 |
| `Session.updatePartDelta()` | `session/index.ts:778-789` | 发布 part 增量事件（不写库）|
| `Database.use()` | `storage/db.ts:121-146` | 提供 DB 上下文，封装 transaction/effect |
| `Database.effect()` | `storage/db.ts:140-146` | 延迟执行副作用（先写库，再发事件）|
| `MessageV2.stream()` | `message-v2.ts:827-849` | 按"新到旧"产出消息 |
| `MessageV2.filterCompacted()` | `message-v2.ts:882-898` | 过滤已压缩历史 |
| `MessageV2.hydrate()` | `message-v2.ts:533-557` | 组装 message + parts[] |
| `MessageV2.toModelMessages()` | `message-v2.ts:559-792` | 投影成 AI SDK ModelMessage[] |
| `MessageV2.page()` | `message-v2.ts:794-813` | 分页读取，按 `time_created desc` |
| `Snapshot.track()` | `snapshot/index.ts` | 记录文件快照 |

### 5.2 上下文管理

| 函数/类型 | 文件 | 职责 |
|----------|------|------|
| `resolvePromptParts()` | `session/prompt.ts` | 将模板引用预编译成具体 part（file/agent/text）|
| `createUserMessage()` | `session/prompt.ts:986-1386` | 编译 user message/parts，处理文件展开和 @agent 改写 |
| `insertReminders()` | `session/prompt.ts:1389-1527` | 注入 plan/build 运行时提醒 |
| `system.ts` 层叠器 | `session/system.ts:18-67` | 组装 system prompt：provider + environment + instructions + skill 四层 |
| `InstructionPrompt.systemPaths()` | `instruction.ts:72-142` | 搜集所有 AGENTS.md/CLAUDE.md 路径 |
| `InstructionPrompt.resolve()` | `instruction.ts:168-190` | 围绕读取路径向上发现局部指令文件 |
| `SessionPrompt.resolveTools()` | `session/prompt.ts` | 构造本地/插件/MCP 工具集合 |
| `LLM.resolveTools()` | `session/llm.ts` | 按权限规则裁剪工具集合 |
| `DurableHistory.filterCompacted()` | `session/index.ts` | 过滤已 compact 的历史，仅向模型投影有效消息 |

### 5.3 记忆系统

| 函数/类型 | 文件 | 职责 |
|----------|------|------|
| `SessionSummary.summarize()` | `session/summary.ts:71-89` | 主入口：并行触发 session 级和 message 级摘要 |
| `summarizeSession()` | `session/summary.ts:91-106` | 写 session 级聚合 diff 和计数 |
| `summarizeMessage()` | `session/summary.ts:108-121` | 写 message 级细粒度 diff |
| `SessionSummary.diff()` | `session/summary.ts:123-142` | 读取/规范化 session_diff，返回 `FileDiff[]` |
| `SessionSummary.computeDiff()` | `session/summary.ts:144-169` | 从 step-start/step-finish 快照边界计算 diff |
| `Snapshot.diffFull()` | `snapshot/index.ts` | 计算两个快照之间的完整文件 diff |
| `Compaction.compact()` | `session/compact.ts` | 将旧历史压缩为 compact session，以 summary 替换原始消息 |

---

## 6. 代码质量评估

### 优点

**状态管理**

- **Durable State 模式**：所有可观测状态以 SQLite 为单一事实来源，UI 通过 SSE 投影实时订阅，不存在"内存状态和持久化状态不一致"的经典问题。
- **事件溯源设计**：`MessageV2.stream()` 能按时间顺序回放全量消息，`filterCompacted()` 按需过滤，使 session resume 和 compaction 都能精确重建。
- **副作用延迟执行**：`Database.effect()` 先写库再发事件，保证 SSE 订阅方看到的是已持久化的状态，不会出现"已通知但未持久化"的窗口。

**上下文管理**

- **多层叠加管线清晰**：user input → plugin 改写 → part 编译 → system prompt 叠加 → durable 写盘，每层职责明确，可独立调试。
- **`DurableHistory` 过滤 compact 历史**：`filterCompacted()` 确保模型不会看到已被 summary 替换的旧消息，context 始终连贯。
- **运行时提醒在模型调用前注入**：最后一刻的 reminder/override 在进入 `LLM.stream()` 前再次改写历史，保证模型感知到最新约束。

**记忆系统**

- **Summary 是 durable 对象而非元数据**：`SessionSummary` 本身写入 durable history，可重放、可 fork，不依赖内存中的临时状态。
- **Diff 功能支持增量摘要**：不需要每次重新 summarize 全量历史，从上次 summary 位置继续 diff，降低 LLM 调用成本。
- **Compaction 与 summarize 职责分离**：`summarize()` 生成记忆内容，`compact()` 负责历史裁剪和替换，两者独立可测。

### 风险与改进点

**状态管理**

- **SQLite 写放大**：每个 stream event 都触发单次写入，高频 token 场景下写请求量大；若未启用 WAL 模式，读写锁竞争可能显著影响 UI SSE 响应延迟。
- **`toModelMessages()` 体量大**：`message-v2.ts:559-792` 超过 230 行，承载了消息类型判断、tool_use 组装、图片 base64 转码等多条分支，单元测试的用例矩阵复杂。
- **Snapshot 接口无版本管理**：`Snapshot.track()`、`Snapshot.revert()` 等方法未见 schema 版本字段，文件快照格式升级时需全量迁移，风险较高。
- **`computeDiff()` 计算开销**：每次都重新计算 session 差分，在长会话场景下可能产生性能热点，缺少增量计算或缓存策略。

**上下文管理**

- **`AGENTS.md` 层叠无冲突解析**：多层 `AGENTS.md` 追加合并，若不同层的指令存在矛盾，模型需要自行取舍，行为不确定。
- **Part 编译无全局 token 预算**：file/agent/skill part 展开后总 token 量无上限检查，大量引用时可能超出模型 context 窗口。
- **compaction 不恢复 `ToolPart` 状态**：compact 后历史被 summary 替换，resumed session 中已完成工具调用的详细状态（如具体修改了哪些文件）从 context 中消失。

**记忆系统**

- **Summarize 结果依赖 LLM 语义理解**：摘要质量完全依赖模型，LLM 可能遗漏关键技术细节（如具体文件修改、工具调用结果），导致 resumed session 丢失重要上下文。
- **Compact 不可逆**：历史一旦被 summary 替换，原始消息从活跃 durable 中移除，无法在当前 session 中恢复原始 turn 级别的工具调用详情。
- **Diff 计算起点依赖上次 summary 的精确 message_id**：若 summary 写入失败或被删除，diff 的起点会退化为全量重计算，LLM 调用成本急剧上升。
