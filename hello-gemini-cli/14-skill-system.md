---
layout: content
title: "Gemini CLI Skill 系统：SKILL.md、加载优先级与 `activate_skill`"
---
# Gemini CLI Skill 系统：SKILL.md、加载优先级与 `activate_skill`

Gemini CLI 当前的 skill 机制很明确：skill 是一个带 frontmatter 的 `SKILL.md`，先被发现，再由模型按需激活。它不是关键词自动匹配器，也不是独立的插件 DSL。


**目录**

- [1. Skill 文件的真实格式](#1-skill-文件的真实格式)
- [2. Skill 从哪些位置被发现](#2-skill-从哪些位置被发现)
- [3. Skill 不是自动触发，而是工具激活](#3-skill-不是自动触发而是工具激活)
- [4. `activate_skill` 真正做了什么](#4-activate_skill-真正做了什么)
- [5. Prompt 系统如何感知 skill](#5-prompt-系统如何感知-skill)
- [6. 当前边界](#6-当前边界)
- [7. 关键源码锚点](#7-关键源码锚点)

---

## 1. Skill 文件的真实格式

Skill 解析逻辑在 `packages/core/src/skills/skillLoader.ts`。

当前 loader 只强依赖两项 frontmatter：

- `name`
- `description`

正文部分会被完整保存在 `body` 字段中，供后续激活时直接注入。

### 1.1 文件命名规则

loader 默认扫描：

- `SKILL.md`
- `*/SKILL.md`

也就是说，skill 目录通常是一层文件夹一个 skill，而不是随便扫所有 markdown 文件。

### 1.2 loader 做了哪些处理

`loadSkillFromFile()` 会：

- 解析 YAML frontmatter
- 在 YAML 失败时回退到简单 key-value 解析
- 对 skill 名称做文件名安全化处理
- 把正文保存在 `body`

因此，当前实现并没有单独的 trigger、examples、tools 白名单等强制元数据字段。

## 2. Skill 从哪些位置被发现

`packages/core/src/skills/skillManager.ts` 中的 `SkillManager.discoverSkills()` 会按优先级加载 skill：

1. 内建 skill
2. extension 提供的 skill
3. 用户级 skill
4. workspace 级 skill

具体目录包括：

- `packages/core/src/skills/builtin/`
- `~/.gemini/skills/`
- `~/.agents/skills/`
- `<project>/.gemini/skills/`
- `<project>/.agents/skills/`

其中 workspace 级 skill 只有在目录被信任时才会启用。

同名 skill 的覆盖规则也写在 `SkillManager` 里：后加载的来源会覆盖前面的定义，因此 workspace skill 可以覆盖 user skill，user skill 也可以覆盖内建 skill。

## 3. Skill 不是自动触发，而是工具激活

这是当前实现最容易被旧文档写错的地方。

Gemini CLI 并没有一个“按关键词自动命中 skill”的中心注册器。实际流程是：

1. `PromptProvider` 在 system prompt 中列出可用 skills
2. 模型需要更细的专用指令时，调用 `activate_skill`
3. `activate_skill` 把 skill 正文和资源目录结构返回给模型

激活逻辑在 `packages/core/src/tools/activate-skill.ts`。

## 4. `activate_skill` 真正做了什么

激活一个 skill 时，工具会：

- 根据 skill 名称从 `SkillManager` 里取定义
- 对非内建 skill 请求确认
- 把 skill 所在目录加入 workspace context，允许读取资源
- 返回 `<activated_skill>` 包裹的正文 instructions
- 一并返回 skill 目录结构，方便模型继续读取附带资源

`SkillManager` 还会记录 active skill 名称，但“激活”的核心效果仍然是把 skill body 显式塞回上下文，而不是切换一套隐藏状态机。

## 5. Prompt 系统如何感知 skill

`packages/core/src/prompts/promptProvider.ts` 会从 `SkillManager.getSkills()` 拉取可用 skill 列表，再交给 `renderAgentSkills()` 写入 system prompt。

所以在当前实现里：

- **发现** 由 `SkillManager` 完成
- **暴露给模型** 由 `PromptProvider` 完成
- **真正启用** 由 `activate_skill` 工具完成

三步职责是分开的。

## 6. 当前边界

从源码看，Gemini CLI 的 skill 系统目前有几个明确边界：

- 没有内建的关键词触发 DSL
- 没有版本、作者、标签等强制元数据
- 没有单独的“skill registry 协议层”
- 复杂行为主要靠 skill 正文和同目录资源文件实现

这让它更像“可加载的专家指令包”，而不是一个重型插件框架。

## 7. 关键源码锚点

| 主题 | 代码锚点 | 说明 |
| --- | --- | --- |
| Skill 解析 | `packages/core/src/skills/skillLoader.ts` | 解析 frontmatter 与正文 |
| Skill 管理 | `packages/core/src/skills/skillManager.ts` | 发现、覆盖、禁用、激活状态 |
| 激活工具 | `packages/core/src/tools/activate-skill.ts` | 把 skill 正文与资源注入上下文 |
| Prompt 接入 | `packages/core/src/prompts/promptProvider.ts` | 在 system prompt 中列出可用 skill |

---

## 代码质量评估

**优点**

- **文件即技能**：`.md` 文件即 skill 定义，版本管理友好，任何具备 Markdown 写作能力的人都可以贡献 skill，无需编写代码。
- **两步激活模型**：先在 system prompt 中列出所有可用 skill 名称，再通过 `activate_skill` 工具按需激活，避免全量 skill  内容一次性注入消耗 token。
- **多级 `SKILL.md` 发现**：支持 global、extension、project 三层来源，项目级 skill 可覆盖 global skill，优先级可控。

**风险与改进点**

- **`activate_skill` 无 token 预算检查**：激活 skill 时会把完整 skill 指令注入 `<activated_skill>` 标签，若 skill 文件过大，可能推低当前轮可用 context 窗口。
- **技能发现无并发保护**：多个会话同时扫描技能目录时，若目录被写入，可能读到部分更新的 skill 文件。
- **`SKILL.md` 格式无 schema 校验**：skill 文件格式纯粹约定俗成，无 lint 工具，错误格式在运行时才被发现，调试成本高。
