---
layout: content
title: "Skill 系统：Markdown 定义、命令总线注入与执行语义"
---
# Skill 系统：Markdown 定义、命令总线注入与执行语义

本文深度分析 Claude Code 的 Skill 系统，包括 Skill 的定义格式、加载机制、命令总线注入，以及执行语义。

> 另见：[06-extension-mcp](./06-extension-mcp.md) — Skill 在整个扩展体系中的位置概述


**目录**

- [1. Skill 是什么](#1-skill-是什么)
- [2. Skill 文件格式](#2-skill-文件格式)
- [触发条件](#触发条件)
- [操作步骤](#操作步骤)
- [输出格式](#输出格式)
- [3. Skill 加载机制](#3-skill-加载机制)
- [4. 注入命令总线](#4-注入命令总线)
- [5. Skill 执行语义](#5-skill-执行语义)
- [6. 实际使用示例](#6-实际使用示例)
- [7. Skills vs Plugins vs MCP](#7-skills-vs-plugins-vs-mcp)

---

## 1. Skill 是什么

Claude Code 的 Skill 是**以 Markdown 文件定义的自定义 Slash 命令**，包含：
- 命令触发词（`/skill-name`）
- 系统提示注入内容（Skill 描述 + 操作指导）
- 可选的参数模式

Skills 直接插入命令总线（Command Bus），与内置命令享有相同优先级。

## 2. Skill 文件格式

```markdown
---
# skill-name.md（位于 ~/.claude/skills/ 或项目 .claude/skills/）

# My Custom Skill
description: 这个 Skill 的简短描述

## 触发条件
当用户运行 /skill-name 时执行以下操作...

## 操作步骤
1. 首先读取 $ARGUMENTS 中指定的文件
2. 分析文件内容
3. 生成报告

## 输出格式
以 Markdown 表格输出结果
---
```

`$ARGUMENTS` 占位符会被替换为用户传入的参数。

## 3. Skill 加载机制

### 3.1 扫描路径

```typescript
// src/skills/loadSkillsDir.ts
const SKILL_PATHS = [
  '~/.claude/skills/',         // 用户全局 Skills
  '.claude/skills/',           // 项目级 Skills（相对于 cwd）
];

export async function loadSkillsDir(skillsDir: string): Promise<Skill[]> {
  const files = await glob('**/*.md', { cwd: skillsDir });
  return Promise.all(files.map(f => parseSkillFile(path.join(skillsDir, f))));
}
```

### 3.2 解析 Skill 文件

```typescript
// src/skills/parseSkill.ts
export function parseSkillFile(filePath: string): Skill {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content: body } = matter(content);
  
  return {
    name: path.basename(filePath, '.md'),
    description: frontmatter.description ?? '',
    systemPrompt: body,  // Markdown 正文作为系统提示注入
    filePath,
  };
}
```

## 4. 注入命令总线

Skills 加载后通过 `loadAllCommands()` 注入命令总线：

```typescript
// src/commands.ts
export async function loadAllCommands(cwd: string): Promise<Command[]> {
  const builtinCmds = COMMANDS();            // 内置命令
  const skillCmds = await loadSkillCommands(); // Skill 命令
  const pluginCmds = await loadPluginCommands(cwd); // 插件命令
  
  return [...builtinCmds, ...skillCmds, ...pluginCmds];
}
```

Skill 命令的结构与内置命令完全一致，用户无法区分 `/commit`（内置）和 `/my-skill`（自定义）。

## 5. Skill 执行语义

当用户输入 `/my-skill some arguments` 时：

```
1. CommandDispatcher 识别 /my-skill → 匹配到 Skill
2. 将 Skill.systemPrompt 注入为额外的系统消息
3. 将用户参数替换 $ARGUMENTS 占位符
4. 发送到主 query() 循环执行
```

Skill 的执行**不创建独立的 Agent 实例**，而是在当前会话上下文中注入额外指令，让模型遵循 Skill 的指导执行任务。

## 6. 实际使用示例

```
# 创建 Skill 文件
mkdir -p ~/.claude/skills/
cat > ~/.claude/skills/review.md << 'EOF'
---
description: 对指定文件进行代码审查
---
# 代码审查 Skill
审查 $ARGUMENTS 中指定的文件，检查：
1. 代码风格是否符合项目规范
2. 是否存在潜在的 bug
3. 是否有改进建议
EOF

# 使用 Skill
/review src/auth/login.ts
```

## 7. Skills vs Plugins vs MCP

| 特性 | Skill | Plugin | MCP |
|------|-------|--------|-----|
| **定义方式** | Markdown 文件 | JS/TS 模块 | 独立进程 |
| **贡献内容** | Slash 命令 | 命令+工具+Hooks | 工具+资源 |
| **实现复杂度** | 极低（纯文本）| 中（需编码）| 高（需服务器）|
| **运行方式** | 注入 Prompt | 嵌入主进程 | 独立进程 |
| **发现机制** | 文件扫描 | 文件扫描 | settings.json |

Skills 是 Claude Code 扩展体系中门槛最低的一层：不需要编写代码，只需创建 Markdown 文件。

---

## 关键函数清单

| 函数/类型 | 文件 | 职责 |
|----------|------|------|
| `CLAUDE.md` loader | `src/config/claudeMd.ts` | 从当前目录向上遍历查找 CLAUDE.md，加载 skill 规则到 system prompt |
| `loadSkillFiles()` | `src/config/claudeMd.ts` | 读取所有 CLAUDE.md 层级并合并规则 |
| skill injection | `src/prompt/system.ts` | 将 skill 内容追加到 system prompt 的 CLAUDE.md_content 占位符 |
| precedence resolver | `src/config/claudeMd.ts` | 解析 global / project / subdirectory 三层 CLAUDE.md 优先级 |
| `@import` directive handler | `src/config/claudeMd.ts` | 处理 CLAUDE.md 中的 `@import ./other.md` 导入指令 |
| skill hot-reload watcher | `src/config/claudeMd.ts` | 监听 CLAUDE.md 文件变化，触发 system prompt 重建 |

---

## 代码质量评估

**优点**

- **`@import` 指令支持模块化**：CLAUDE.md 可拆分为多个文件通过 `@import` 组合，大型项目 skill 规则可按功能模块分文件管理。
- **三层优先级直觉友好**：global → project → subdirectory 的优先级与 git config、editorconfig 等工具一致，用户学习成本低。
- **hot-reload 无需重启**：skill 文件变化时自动重载，开发调试 CLAUDE.md 规则时无需退出重进 session。

**风险与改进点**

- **skill 内容直接注入 system prompt**：CLAUDE.md 内容未经 sanitization 注入 prompt，恶意或格式错误的 CLAUDE.md 可产生 prompt injection 攻击。
- **多层合并策略不透明**：用户难以知道最终 system prompt 中 skill 内容的精确顺序和覆盖规则，调试时需打印完整 prompt。
- **`@import` 循环引用无检测**：CLAUDE.md A import B，B import A 时可能导致无限循环或堆栈溢出，缺少循环检测。
