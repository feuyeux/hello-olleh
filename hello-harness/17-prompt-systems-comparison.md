---
layout: content
title: "17 - Prompt 系统横向对比"
---
<!-- markdownlint-disable MD060, MD024 -->

# Prompt 系统横向对比

对应项目章节：

- `hello-claude-code/11-prompt-system.md`
- `hello-codex/11-prompt-system.md`
- `hello-gemini-cli/11-prompt-system.md`
- `hello-opencode/11-prompt-system.md`

## 1. 一句话结论

| 项目 | Prompt 设计取向 |
| --- | --- |
| Claude Code | Prompt 是产品人格、工具协议、缓存稳定性和 agent 能力的核心资产 |
| Codex | Prompt 是 runtime 输入编译结果，重点在 AGENTS.md、工具声明和 turn context |
| Gemini CLI | PromptProvider 负责片段组合，现代/旧模型、技能、计划模式按运行时状态切换 |
| OpenCode | Prompt 阶段先生成 durable user message，文件、agent、resource 会被编译成 part |

## 2. 注入面矩阵

| 注入面 | Claude | Codex | Gemini | OpenCode |
| --- | --- | --- | --- | --- |
| System prompt | 静态+动态边界，强 cache 意识 | build prompt 时合成 | PromptProvider 片段组合 | LLM.stream 前组装 |
| 项目指令 | CLAUDE.md/user context | AGENTS.md | GEMINI.md/settings | `.opencode`/command/prompt |
| 工具 prompt | 工具本身携带微 prompt | tool spec 描述 | tool declaration | tool schema + system |
| Skill | Markdown/command 注入 | skills dependency | discover then activate | skill/config command |
| 文件上下文 | 工具读取或 user context | thread/context manager | config/tool 读取 | prompt 阶段编译为 part |

## 3. 关键差异

Claude Code 的文档最需要保留细节，因为它把 prompt 当成产品行为的主要控制面。Codex 的文档需要补强，因为它目前更像流程摘要，应补足 prompt 与 sandbox/tool specs/thread context 的关系。Gemini CLI 的文档要突出 `PromptProvider` 是构造器而不是最终注入点。OpenCode 要持续强调：用户输入不是直接进模型，而是先编译并持久化。

## 4. 代表源码证据

| 项目 | Prompt 构造 / 注入点 | 项目指令 | 工具 / Skill 注入 |
| --- | --- | --- | --- |
| Claude Code | `claude-code/src/constants/prompts.ts`, `claude-code/src/query.ts:365` | `claude-code/src/context.ts` | `claude-code/src/tools/AgentTool/built-in/exploreAgent.ts`, `claude-code/src/skills/loadSkillsDir.ts` |
| Codex | `codex/codex-rs/core/src/session/turn.rs`, `codex/codex-rs/core/src/client.rs` | `codex/codex-rs/core/src/agents_md.rs` | `codex/codex-rs/core/src/tools/spec.rs:32`, `codex/codex-rs/core/src/compact.rs` |
| Gemini CLI | `gemini-cli/packages/core/src/core/prompts.ts`, `gemini-cli/packages/core/src/prompts/promptProvider.ts` | `gemini-cli/packages/core/src/prompts/snippets.ts` | `gemini-cli/packages/core/src/tools/activate-skill.ts`, `gemini-cli/packages/core/src/tools/tool-registry.ts:635` |
| OpenCode | `opencode/packages/opencode/src/session/prompt.ts:162`, `opencode/packages/opencode/src/session/prompt.ts:2013` | `opencode/packages/opencode/src/session/prompt.ts:986` | `opencode/packages/opencode/src/session/prompt.ts:1304`, `opencode/packages/opencode/src/command/index.ts:117` |

## 5. 建议统一章节结构

每个 `11-prompt-system.md` 建议按以下顺序整理：

1. Prompt 的最终注入点。
2. System prompt 的静态/动态组成。
3. 项目指令和用户记忆如何进入。
4. 工具、MCP、skill、agent 的 prompt 化方式。
5. 缓存、token budget 和版本漂移风险。
6. 关键源码锚点和质量评估。

## 6. 横向结论

Prompt 系统不是“字符串模板”问题，而是每个工具的前馈控制系统。谁能更稳定地把规则、上下文、工具能力和风险边界注入模型，谁的 agent 行为就更可预测。

