---
layout: content
title: "06 - 上下文与记忆"
---
# 上下文与记忆工程对比

Agent 的判断质量取决于它在当前时刻能看到什么。这个"能看到什么"——即上下文——不是固定的，而是由工程设计决定的。如果上下文设计得好，Agent 在每次响应时都能访问到相关的历史决策、项目规则、用户偏好；如果设计得差，Agent 每次都从一张白纸开始，反复犯同样的错误，或者在不相关的信息里迷失方向。

记忆工程的核心挑战是一个矛盾：上下文窗口是有限的，而有价值的信息是无限累积的。解决这个矛盾的策略——什么该保留、什么该压缩、什么该丢弃——直接决定了 Agent 的长期可靠性。这是"上下文与记忆"这个维度被单独分析的原因：它不只是技术细节，它决定了 Agent 能否跨 session 持续地、可靠地学习和改进。

---

## 1. Context 分层治理

Context 分层是指：把不同来源、不同时效、不同权威性的信息分别组织，而不是把所有信息混合成一个大的文本块。分层的价值在于：工程师可以预测哪类信息在哪个位置，Agent 可以通过信息的"位置"推断其权威性，系统可以按层次分别更新和失效信息。

### Claude Code

`claude-code/src/context.ts:116-189` 把 context 分为 System Context 和 User Context 两层：

```typescript
export const getSystemContext = memoize(async (): Promise<{ [k: string]: string }> => {
  // gitStatus — 当前 git 仓库状态
  // cacheBreaker — 仅 Anthropic 内部（ant-only）
})

export const getUserContext = memoize(async (): Promise<{ [k: string]: string }> => {
  // claudeMd — CLAUDE.md 文件内容
  // currentDate — 当前日期
})
```

两层都使用 `memoize()` 缓存，生命周期是整个 conversation。这意味着：CLAUDE.md 内容在 conversation 期间不会重新读取，即使文件在 conversation 中被修改。这是一个有意识的性能优化，但也意味着实时规则变更无法在当前 session 里立即生效。

### Codex

Codex 的 Context 分层更复杂，因为它是跨 session 的。`stage_one_system.md` 的 Phase 1 每次从 rollout 历史里提取结构化上下文，`consolidation.md` 的 Phase 2 把多次 Phase 1 的输出整合成全局记忆。这意味着 Codex 的"当前上下文"不只是当前 session 的信息，而是包含了历史 session 的提炼。从控制论角度看，这是跨 session 的状态持久化——是四个工程里唯一真正实现了这一点的。

### Gemini CLI

`gemini-cli/packages/core/src/config/memory.ts` 的 `HierarchicalMemory` 接口定义了三层：

```typescript
export interface HierarchicalMemory {
  global?: string      // 全局配置，所有项目共享
  extension?: string   // 扩展级配置
  project?: string     // 项目级配置，最高优先级
}
```

三层的分离使不同的责任方可以控制不同层次的规则：全局层由系统管理员或用户偏好设置，project 层由项目团队维护。这是典型的关注点分离在记忆系统里的实现。

### OpenCode

`opencode/packages/opencode/src/skill/index.ts:143-157` 通过 `Config.directories()` 扫描目录来发现 Skill 文件。Context 分层不是显式定义的，而是通过目录结构隐式表达的：越靠近项目的目录里的 Skill，优先级越高。这是声明式的分层，但对不熟悉约定的工程师来说，需要先理解目录扫描逻辑才能推断优先级。

---

## 2. Compact/裁剪策略

当对话历史超过上下文窗口时，必须有一套机制来决定保留什么、丢弃什么。这个决策——Compact 策略——比表面看起来更重要：丢弃错误的信息会让 Agent 失去关键上下文，而不丢弃任何信息会让 Agent 很快无法继续工作。Compact 策略的质量，决定了 Agent 长会话的可靠性上限。

**Claude Code**：Compact 触发点是 `/clear` 和 `/compact` 命令（`systemPromptSections.ts:60-68`），清理操作是 `clearSystemPromptSections()`。这是显式触发、完整清理的策略——用户手动发起，清理结果是缓存归零，下一次请求重新从磁盘读取所有信息。这个策略简单可靠，但没有"智能"成分——它无法判断哪些记忆值得保留，哪些已经过时。

**Codex**：`codex/codex-rs/core/templates/compact/prompt.md` 的压缩 prompt 在上下文超限时触发，通过生成 summary 来替代完整的对话历史，以 `summary_prefix.md` 的固定前缀开头。这比 Claude Code 的缓存清理更精细：它尝试保留信息的语义，而不是简单地清空。

**Gemini CLI**：`promptProvider.ts:267-281` 的 `getCompressionPrompt()` 根据当前模型（modern vs legacy）选择不同的 compression prompt。这是根据推断引擎能力自适应的压缩策略——现代模型可能有更长的上下文窗口，需要不同的压缩触发阈值和策略。

**OpenCode**：无可见的 Compact 策略。这是 OpenCode 最明显的上下文工程缺失：当对话历史増长，没有机制来优雅地管理上下文大小，只能依赖模型自身的上下文截断行为（通常会丢弃最早的信息）。

---

## 3. 知识作为系统记录

知识版本化（Knowledge as System Record）是指：把 Agent 使用的规则、偏好、历史决策作为可审计的系统记录，而不是散落在对话历史里、无法追溯的临时信息。版本化的知识可以在不同 session 间传递、在代码审查中可见、在规则变更时有迹可循。

**Claude Code**：`claude-code/src/utils/claudemd.ts:790-1074` 的 `getMemoryFiles()` 发现并加载四层 CLAUDE.md 文件：

```
Managed (/etc/claude-code/CLAUDE.md) — 系统管理员管理
User (~/.claude/CLAUDE.md) — 用户全局记忆
Project (CLAUDE.md, .claude/CLAUDE.md, .claude/rules/*.md) — 项目记忆
Local (CLAUDE.local.md) — 本地私有记忆（通常 .gitignore）
```

`@include` 指令支持从一个 CLAUDE.md 引用另一个文件，实现知识复用。Project 层的 CLAUDE.md 进入 Git 版本控制，意味着规则变更有完整的历史记录和变更原因。

**Codex**：`codex/codex-rs/core/templates/memories/consolidation.md` 的 Phase 2 产物包括 `raw_memories.md`（原始记忆合并）和 `rollout_summaries/`（每次 rollout 的摘要）。这些产物存储在 DB 里，有时间戳和 usage_count，支持基于使用频率的知识衰减（`max_unused_days` 窗口）。Codex 的知识版本化最完整：不只是"文件在 Git 里"，而是"知识有时间戳、有使用统计、有主动遗忘机制"。

**Gemini CLI**：`gemini-cli/packages/core/src/tools/memoryTool.ts` 实现了 Memory Tool，Agent 可以通过工具调用来读写记忆（`getAllGeminiMdFilenames()` 发现所有 GEMINI.md 文件）。记忆存储在文件系统里，通过 Git 版本化。Agent 可访问记忆工具，意味着它可以主动写入记忆，而不只是被动读取规则——这是 Gemini CLI 记忆系统的独特能力。

**OpenCode**：`opencode/packages/opencode/src/skill/index.ts:71-102` 的 Skill 解析通过 Zod Schema 验证 frontmatter 结构：

```typescript
const parsed = Info.pick({ name: true, description: true }).safeParse(md.data)
```

Skill 文件是知识的主要载体，存储在文件系统里。没有 DB 层的时间戳或使用统计，知识版本化完全依赖文件系统 + Git。

---

## 4. Progressive Disclosure 实现

Progressive Disclosure（渐进式揭示）在 UX 设计里指"只在需要时显示复杂信息"，在 Agent 上下文工程里，它指"Agent 只在需要时加载相关信息，而不是一次性把所有知识塞进上下文"。实现好的 Progressive Disclosure 能降低上下文噪音、提高 Agent 的响应精度，并延长在给定上下文窗口内可以维持的有效对话长度。

**Claude Code**：`claudemd.ts:1-26` 的注释指出文件按"优先级倒序加载"（后加载的优先级更高）。但这是一次性全量加载——所有 CLAUDE.md 文件的内容都被加入 System Prompt，没有延迟加载或按需加载。1166 行的单文件实现也暗示了一种百科全书式的思维：把一切都放在一起，让 Agent 自己从里面找相关部分。这是 Progressive Disclosure 的反模式。

**Codex**：`default.md` 的 276 行按节（Personality → AGENTS.md spec → Planning → Task execution → Validating）组织。每个节负责不同的任务阶段，这是一种隐式的 Progressive Disclosure：不同阶段的 Agent 关注不同的节，而不是每次都处理整个文档。节与节之间有清晰的边界，Agent 可以通过节标题快速定位相关规则。

**Gemini CLI**：`snippets.ts:123-151` 的 `getCoreSystemPrompt()` 通过条件渲染（`options.planningWorkflow ? renderPlanningWorkflow : renderPrimaryWorkflows`）实现了真正的 Progressive Disclosure：不同的 Agent 模式激活不同的 Snippet 组合，不相关的 Snippet 不被包含。这使 System Prompt 的内容和当前任务模式高度相关，减少了噪音。

**OpenCode**：Skill 系统在 `sign()` 函数里（`skill/index.ts`）把 Skill 定义分散在多处（`skill/index.ts`、`permission/index.ts`、`config/config.ts`）。这是适度的分散，不是 Progressive Disclosure 的积极实现，但至少避免了百科全书式的单点聚合。

---

## Agent 可访问信息边界

理解"Agent 能看到什么"和"Agent 不能看到什么"，对治理 Agent 行为至关重要。信息边界定义了 Agent 决策的数据基础，也定义了 Agent 不应该期望自己知道什么。

所有四个工程的 Agent 都无法感知超出其工具和上下文之外的信息：Slack 消息、Google Docs 内容、人脑里的隐性知识——这些对 Agent 不存在，除非被显式地工具化并注入上下文。这个边界对 harness 设计的含义是：任何团队想让 Agent 考虑的信息，都必须通过可见渠道（文件、工具、上下文）明确传递，而不能假设 Agent "自然会知道"。

| 工程 | 上下文组成 | 信息边界 |
|------|-----------|---------|
| Claude Code | System/User Context + CLAUDE.md 四层 | git status, date, CLAUDE.md 内容 |
| Codex | 当前 session + Phase 1/2 记忆整合 | rollout 历史提炼 + 当前任务 |
| Gemini CLI | GEMINI.md 三层 + Tool 调用结果 | 文件系统 + 工具返回值 |
| OpenCode | Skill 文件 + Config + Permission | 目录内 Skill + 配置 |

---

## 总结对比表

| 维度 | Claude Code | Codex | Gemini CLI | OpenCode |
|------|-------------|-------|------------|----------|
| Context 分层 | System/User 两层，memoize 缓存 | Phase 1/2 跨 session 分离，最深 | Global/Ext/Project 三层 | 目录堆栈，隐式分层 |
| Compact 策略 | 手动触发，全量清理 | 摘要生成，语义压缩 | 模型自适应 compression prompt | 缺失 |
| 知识版本化 | Git + 文件系统（四层） | DB + 时间戳 + 使用统计，最完整 | 文件系统 + Agent 可主动写入 | 文件系统（无使用统计） |
| Progressive Disclosure | 反模式（百科全书全量加载） | 节结构（任务阶段映射） | 条件 Snippet 渲染，最主动 | 适度分散（无积极实现） |
| 综合评分 (1-5) | **3** | **4** | **3** | **2** |

上下文与记忆工程的分析揭示了一个关键差异：Codex 是唯一把记忆当作工程系统设计（有 DB、时间戳、使用统计、遗忘机制）的工程，其他三个都把记忆视为文件系统操作。这个差异在[熵管理](./08-entropy-management.md)这个维度会体现得更明显——记忆系统的工程化程度，直接决定了知识库腐烂的速度。接下来先看[可驾驭性](./07-harnessability.md)，它从代码库结构的角度回答"这个工程是否本身就容易被 harness"。