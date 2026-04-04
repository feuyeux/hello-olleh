---
layout: content
title: "Gemini CLI Prompt 系统：PromptProvider、片段组合与技能注入"
---
# Gemini CLI Prompt 系统：PromptProvider、片段组合与技能注入

当前 Gemini CLI 的 Prompt 系统，核心不是一组静态模板文件，而是 `PromptProvider` 按运行时配置拼出最终 system prompt，再把记忆与模式相关内容附到末尾。

## 1. 入口只有一个：`PromptProvider`

`packages/core/src/core/prompts.ts` 本身非常薄，真正的工作都在 `packages/core/src/prompts/promptProvider.ts`：

- `getCoreSystemPrompt()` 生成主 system prompt
- `getCompressionPrompt()` 生成上下文压缩专用 prompt

也就是说，聊天 prompt 和压缩 prompt 是两套不同的输出，并不是同一份模板改参数。

## 2. Prompt 是按运行时状态动态拼出来的

`PromptProvider.getCoreSystemPrompt()` 会先解析当前运行态，再决定要拼哪些片段。主要输入包括：

- 当前模型，以及该模型是否支持 modern features
- 交互模式 / 非交互模式
- approval mode，尤其是 plan mode / yolo mode
- 已发现的 skills
- 已注册的 subagents
- task tracker、sandbox、git repo 等运行能力
- 当前允许使用的记忆文件名
- 已批准计划文件路径

因此，这里的 Prompt 不是“固定角色设定 + 几段说明”，而是显式依赖 `Config`、`ToolRegistry`、`AgentRegistry`、`SkillManager` 的动态产物。

## 3. `snippets.ts` 才是主模板来源

### 3.1 现代模型与旧模型用不同模板集

`PromptProvider` 会根据 `supportsModernFeatures(resolveModel(...))` 选择：

- `packages/core/src/prompts/snippets.ts`
- `packages/core/src/prompts/snippets.legacy.ts`

这意味着 Prompt 结构会随模型能力切换，而不是所有模型共用一份模板。

### 3.2 片段级拼装，而不是“大段字符串替换”

在 `snippets.ts` 里，system prompt 由多个 renderer 拼起来，例如：

- `renderPreamble`
- `renderCoreMandates`
- `renderSubAgents`
- `renderAgentSkills`
- `renderPrimaryWorkflows`
- `renderPlanningWorkflow`
- `renderOperationalGuidelines`
- `renderSandbox`
- `renderGitRepo`

最后再由 `renderFinalShell()` 追加 memory 内容。

## 4. 记忆、技能、子代理如何进入 Prompt

### 4.1 记忆不是硬编码文本

`renderFinalShell()` 会把 `userMemory` 追加到主 prompt 末尾。这里的 `userMemory` 既可能是字符串，也可能是 `HierarchicalMemory` 结构。

### 4.2 Skill 的进入方式有两步

先是**列出可用 skill**：

- `PromptProvider` 从 `SkillManager.getSkills()` 取到可用 skill
- `renderAgentSkills()` 把 skill 名称、描述、位置写进 system prompt

再是**按需激活具体 skill**：

- 激活工具：`packages/core/src/tools/activate-skill.ts`
- 激活结果：返回 `<activated_skill>` 包裹的 instructions 与资源目录结构

也就是说，当前实现不是“根据关键词自动触发 skill prompt”，而是先让模型知道有哪些 skill，再通过 `activate_skill` 精确启用。

### 4.3 Subagent 也会写入 prompt

`PromptProvider` 会从 `AgentRegistry` 取出所有可用 agent 定义，并通过 `renderSubAgents()` 写入 system prompt，让主代理知道有哪些可委派的子代理。

## 5. Plan mode 会切换一整套提示词片段

如果 approval mode 是 `PLAN`，`PromptProvider` 不再渲染普通工作流，而是改走 `planningWorkflow` 分支：

- 展示 plan mode 可用工具列表
- 告知 plans 目录位置
- 注入已批准计划路径

这也是为什么 Gemini CLI 的 prompt 不能只看一份静态快照，必须结合运行模式一起读。

## 6. 支持用环境变量覆盖系统 Prompt

`PromptProvider` 支持读取 `GEMINI_SYSTEM_MD`：

- 可以显式指定一个自定义 `system.md`
- 也可以通过开关关闭默认行为的一部分

如果指定了自定义文件，`PromptProvider` 会先读取文件，再做 substitutions，而不是完全跳过技能、配置等运行时信息。

## 7. 不要把它和 `PromptRegistry` 混淆

仓库里还存在 prompt registry 的概念，但那主要服务于 MCP prompt 注册。Gemini CLI 的核心 system prompt 生成链路，仍然是：

`core/prompts.ts` -> `PromptProvider` -> `snippets.ts` / `snippets.legacy.ts`

## 8. 关键源码锚点

| 主题 | 代码锚点 | 说明 |
| --- | --- | --- |
| Prompt 总入口 | `packages/core/src/core/prompts.ts` | 对外暴露 system/compression prompt 接口 |
| 核心拼装器 | `packages/core/src/prompts/promptProvider.ts` | 根据运行态构造 prompt |
| 现代模板片段 | `packages/core/src/prompts/snippets.ts` | system prompt 主模板 |
| 旧模型模板片段 | `packages/core/src/prompts/snippets.legacy.ts` | 兼容旧能力模型 |
| Skill 激活 | `packages/core/src/tools/activate-skill.ts` | 把 skill 指令显式注入上下文 |
| 记忆结构 | `packages/core/src/config/memory.ts` | `HierarchicalMemory` 与 flatten 逻辑 |
