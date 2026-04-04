---
layout: content
title: "Skill 系统：Markdown 定义、命令总线注入与执行语义"
---
# Skill 系统：Markdown 定义、命令总线注入与执行语义

本文深度分析 Claude Code 的 Skill 系统，包括 Skill 的定义格式、加载机制、命令总线注入，以及执行语义。

> 另见：[06-extension-mcp](./06-extension-mcp.md) — Skill 在整个扩展体系中的位置概述

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
