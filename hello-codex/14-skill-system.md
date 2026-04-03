---
layout: default
title: "Skill 系统：Codex 的能力扩展与自定义指令机制"
---
# Skill 系统：Codex 的能力扩展与自定义指令机制

本文分析 Codex 与"Skill"概念的关系，以及 Codex 如何通过 `AGENTS.md` 和工具扩展达成类似 Skill 的能力定制。

## 1. Codex 没有独立的 Skill 子系统

与 Claude Code（Skills via Markdown）、Gemini CLI（`skills/` 目录）、OpenCode（Skill 注册表）不同，**Codex 没有专门的 Skill 系统**。

其能力扩展路径为：

```
AGENTS.md（自定义指令）
    + MCP 工具（新增工具能力）
    + config.toml user_instructions（全局行为调节）
    ≈ 等价于其他系统的 "Skill"
```

## 2. AGENTS.md 作为 Skill 的载体

`AGENTS.md` 是 Codex 实现 Skill 类功能的核心机制。通过在 `AGENTS.md` 中编写结构化指令，用户可以定义 Agent 的专项能力：

```markdown
# AGENTS.md（项目级）

## Skill: 代码审查
当用户要求代码审查时，按以下步骤执行：
1. 读取所有被修改的文件
2. 检查以下规则：
   - 函数长度 < 50 行
   - 变量命名采用 snake_case
   - 每个公开函数都有文档注释
3. 输出结构化审查报告

## Skill: 测试生成
为每个新函数自动生成单元测试，测试框架为 pytest。
```

## 3. config.toml 的 user_instructions

```toml
# ~/.config/codex/config.toml
[model]
name = "o3"

[instructions]
user_instructions = """
你是一个专注于 Rust 系统编程的代码助手。
- 所有代码建议优先考虑内存安全
- 使用 Result<> 进行错误处理，不使用 panic!
- 提供详细的 unsafe 块说明
"""
```

`user_instructions` 作为全局 Skill 配置，对所有会话生效。

## 4. MCP 工具作为 Skill 扩展点

通过 MCP（Model Context Protocol），用户可以为 Codex 添加专项工具能力：

```toml
# config.toml
[[mcp_servers]]
name = "security-scanner"
command = "npx"
args = ["@security/codex-mcp"]
```

这相当于为 Codex 安装了"安全扫描 Skill"，模型可以通过这个 MCP 工具进行专项安全分析。

## 5. 与其他系统 Skill 的功能对照

| 功能 | Codex 实现 | 对应 Claude Code | 对应 Gemini CLI | 对应 OpenCode |
|------|-----------|-----------------|----------------|--------------|
| **自定义行为** | `AGENTS.md` | `CLAUDE.md` + Skills | `GEMINI.md` | Skill 注册 |
| **专项工具** | MCP 扩展 | MCP + 内置 Skills | MCP | Skill + MCP |
| **全局配置** | `config.toml` user_instructions | settings.json | settings.json | 配置文件 |
| **发现机制** | 无 Skill 目录 | `~/.claude/skills/` | `skills/` 目录 | 注册表 |
| **版本管理** | 无 | 文件系统 | 文件系统 | 注册表 |

## 6. 评估与展望

**优势**：
- 无需学习专门的 Skill API，`AGENTS.md` 是普通 Markdown
- 项目级 `AGENTS.md` 可随代码库版本化管理（git 追踪）
- MCP 生态提供丰富的专项工具

**局限**：
- 无统一 Skill 发现/安装机制（需手动配置 `AGENTS.md`）
- 不同 Skill 之间没有依赖管理
- 缺乏 Skill 的测试与验证框架

Codex 的这种设计体现了"配置即代码"（Configuration as Code）的哲学：Skills 作为 `AGENTS.md` 文档存在于代码库中，与代码一起版本化、审查和共享。
