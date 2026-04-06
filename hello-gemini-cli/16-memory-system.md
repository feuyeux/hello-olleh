---
layout: content
title: "Gemini CLI Memory 系统：`GEMINI.md` 分层记忆与 `save_memory` 工具"
---
# Gemini CLI Memory 系统：`GEMINI.md` 分层记忆与 `save_memory` 工具

当前 Gemini CLI 的 memory 机制，核心并不是一个通用的 JSON KV 存储，而是围绕 `GEMINI.md` 体系、层级发现和显式记忆写入工具展开。


**目录**

- [1. 记忆的主载体是 `GEMINI.md`](#1-记忆的主载体是-geminimd)
- [2. 当前 memory 是分层的](#2-当前-memory-是分层的)
- [3. 记忆是怎么被发现的](#3-记忆是怎么被发现的)
- [4. Memory 如何进入对话](#4-memory-如何进入对话)
- [5. `save_memory` 不是抽象数据库写入，而是改文件](#5-save_memory-不是抽象数据库写入而是改文件)
- [6. `/memory` 命令只是对底层能力的包装](#6-memory-命令只是对底层能力的包装)
- [7. 当前没有的能力](#7-当前没有的能力)
- [8. 关键源码锚点](#8-关键源码锚点)

---

## 1. 记忆的主载体是 `GEMINI.md`

从 `packages/core/src/tools/memoryTool.ts` 可以看到，默认上下文文件名是：

- `DEFAULT_CONTEXT_FILENAME = 'GEMINI.md'`

同时这个文件名还能通过 `setGeminiMdFilename()` 被改写，所以源码并不假定永远只有一个固定文件名。

## 2. 当前 memory 是分层的

`packages/core/src/config/memory.ts` 定义了 `HierarchicalMemory`：

- `global`
- `extension`
- `project`

`ContextManager` 会把发现到的记忆内容分别放进这三层，而不是简单拼成一大段字符串后到处传递。

## 3. 记忆是怎么被发现的

核心逻辑在 `packages/core/src/utils/memoryDiscovery.ts`。

它会负责：

- 扫描 `GEMINI.md` 及其别名
- 区分 global / project 路径来源
- 读取文件内容
- 做文件身份去重，避免大小写路径或符号链接导致重复加载
- 处理 import 场景

在此基础上，`ContextManager.refresh()` 会把结果整理成：

- global memory
- extension memory
- project memory

如果开启 JIT context，`discoverContext()` 还会在访问某个具体路径时，再按需加载该路径向上到项目根目录之间的补充记忆。

## 4. Memory 如何进入对话

这部分逻辑在 `packages/core/src/config/config.ts` 里非常明确：

- `getSystemInstructionMemory()`：提供给 system prompt 的记忆
- `getSessionMemory()`：提供给首条会话上下文注入的记忆
- `getUserMemory()`：对外暴露当前完整记忆视图

当 JIT context 打开时：

- 只有 **global memory** 进 system prompt
- **extension + project memory** 会被包进 `<loaded_context>`、`<extension_context>`、`<project_context>` 这类标签中，作为会话内容注入

这点和“所有记忆统一塞到 system prompt”是不同的。

## 5. `save_memory` 不是抽象数据库写入，而是改文件

`packages/core/src/tools/memoryTool.ts` 的实现很直接：

- 读取当前全局 memory 文件
- 在 `## Gemini Added Memories` 段落下追加条目
- 需要时展示 diff 并请求确认
- 最终把结果写回磁盘

写入内容也会做简单清洗，例如把换行压成单行，避免把任意 markdown 结构直接注进去。

所以更准确的描述应该是：

- Gemini CLI 有**显式的记忆写入工具**
- 它的存储目标默认是全局 `GEMINI.md` 类文件
- 它不是一个独立的 `memory.json` 键值数据库

## 6. `/memory` 命令只是对底层能力的包装

`packages/core/src/commands/memory.ts` 提供了四类操作：

- `showMemory`
- `addMemory`
- `refreshMemory`
- `listMemoryFiles`

其中：

- `/memory add ...` 最终会转成 `save_memory` 工具调用
- `/memory refresh` 会重新扫描 memory 文件并更新 system instruction
- `/memory list` 会列出当前实际生效的 memory 文件路径

这说明 memory 不是“启动时读一次就结束”，而是支持运行时刷新和显式追加。

## 7. 当前没有的能力

和很多“长期记忆系统”想象图不同，当前 Gemini CLI 没有在这里实现：

- 向量检索
- 语义搜索
- 结构化 KV 记忆库
- 自动总结再写回 memory

目前的核心仍然是“层级 markdown 记忆 + 显式工具写入 + 运行时重新装载”。

## 8. 关键源码锚点

| 主题 | 代码锚点 | 说明 |
| --- | --- | --- |
| 记忆结构 | `packages/core/src/config/memory.ts` | `HierarchicalMemory` 定义 |
| 记忆发现 | `packages/core/src/utils/memoryDiscovery.ts` | 扫描、去重、分类 `GEMINI.md` |
| 记忆装载 | `packages/core/src/services/contextManager.ts` | 管理 global / extension / project memory |
| 配置侧注入 | `packages/core/src/config/config.ts` | system memory 与 session memory 分流 |
| 记忆写入工具 | `packages/core/src/tools/memoryTool.ts` | `save_memory` 的真实实现 |
| Slash 命令包装 | `packages/core/src/commands/memory.ts` | `/memory` 系列命令 |

---

## 代码质量评估

**优点**

- **`GEMINI.md` 是主载体**：记忆直接存入 Markdown 文件，版本控制友好，human-readable，无需专用数据库。
- **分层记忆优先级可控**：global → extension → project 三层，项目记忆可覆盖全局记忆，开发者可针对项目定制 AI 行为。
- **`save_memory` 工具语义透明**：Agent 调用 `save_memory` 本质是修改 `GEMINI.md` 文件，用户可直接读写该文件，无"隐藏"状态。

**风险与改进点**

- **无长期记忆归纳机制**：`GEMINI.md` 会随使用不断增长，无自动归纳/压缩旧记忆的机制，长期使用会形成 token 消耗日益增大的问题。
- **记忆写操作无冲突检测**：多个并发会话同时修改同一个 `GEMINI.md` 时，无文件锁或合并机制，可能产生写覆盖。
- **记忆与对话历史是两套存储**：`GEMINI.md` 记忆和 `ChatRecordingService` 的 conversation JSON 互不感知，记忆召回完全依赖 system prompt 注入，不能按 session 作用域隔离。
