---
layout: content
title: "14 - 源码分析质量横向评估"
---
<!-- markdownlint-disable MD060, MD024 -->

# 源码分析质量横向评估

本章评估 `hello-claude-code/`、`hello-codex/`、`hello-gemini-cli/`、`hello-opencode/` 对各自上游源码的分析质量。结论只用于完善文档结构，不替代单项目章节的源码细读。

## 1. 评价维度

| 维度 | 含义 | 合格标准 |
| --- | --- | --- |
| 覆盖度 | 是否覆盖启动、loop、工具、状态、Prompt、扩展、安全、UI/传输 | `01-25` 主题齐全 |
| 证据密度 | 关键判断是否能回链源码或单项目章节 | 每个核心结论至少有文件/函数/章节依据 |
| 链路完整性 | 是否能从用户输入追到模型、工具、状态和 UI 回传 | 有生命周期图和关键函数表 |
| 差异表达 | 是否说清“它和其他工具不同在哪里” | 有横向矩阵，而不是孤立项目摘要 |
| 维护性 | 后续版本升级时是否容易校验 | 使用稳定路径、少依赖漂移行号 |

## 1.1 新增门槛：源码锚点密度

后续主干章节按以下锚点标准维护：

| 章节类型 | 最低锚点要求 |
| --- | --- |
| `03` Agent loop | 至少覆盖 loop 入口、模型请求、工具回注、退出/继续判断 |
| `05` 工具系统 | 至少覆盖 registry、permission、execution、result 回注 |
| `11` Prompt 系统 | 至少覆盖 prompt 构造入口、项目指令、工具描述、模型请求注入点 |
| `15/20/21/23` 入口与传输 | 至少覆盖 UI/API route、event stream、外部协议入口 |
| `24` MCP | 至少覆盖 server config、连接/认证、tool discovery、tool call |
| `25` 调试 | 至少覆盖按症状定位的源码入口 |

锚点格式统一使用 repo-root 路径，例如 `opencode/packages/opencode/src/session/prompt.ts:162` 或 `claude-code/src/query.ts:241`。

## 2. 横向判断

| 项目 | 当前定位 | 强项 | 需要修正 |
| --- | --- | --- | --- |
| Claude Code | 深读型分析 | Prompt、memory、MCP、React TUI 与反编译风险意识强 | `03/05/11/15/23/24/25` 已补 repo-root 锚点；继续把“推断/反编译残留/源码确认”分开 |
| Codex | 工程均衡型分析 | Rust runtime、turn loop、sandbox、ghost snapshot 证据扎实 | `03/05/11/15/23/24/25` 已补源码锚点；后续继续补厚 `11-21` |
| Gemini CLI | 可追溯型分析 | 早期章节行号和函数锚点最密，工具调度链清楚 | `03/05/11/15/23/24/25` 已补源码锚点；后续继续补扩展、多代理、SDK 生命周期 |
| OpenCode | 体系化深挖型分析 | Durable state、session loop、processor、Effect-ts 深挖充分 | `03/05/11/15/23/24/25` 已补 repo-root 锚点；继续合并重复主线 |

## 2.1 质量评分矩阵

评分含义：`5` 表示该维度已可作为样板；`4` 表示主干达标但仍有局部补强点；`3` 表示可读但证据或链路不够稳定。

| 项目 | 覆盖度 | 证据密度 | 链路完整性 | 差异表达 | 维护性 | 综合判断 |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Code | 5 | 4 | 4 | 4 | 3 | 深读充分，但反编译快照需要持续标注证据等级 |
| Codex | 5 | 4 | 5 | 4 | 4 | Runtime 主线清楚，`11-21` 还可补字段级链路 |
| Gemini CLI | 5 | 5 | 4 | 4 | 4 | 源码锚点密，扩展、Bridge、多代理章节仍偏摘要 |
| OpenCode | 5 | 4 | 5 | 5 | 4 | 深挖最强，但需要控制 `03` 与 `27-29` 的重复 |

## 2.2 代表证据链

| 项目 | 代表章节 | 代表源码锚点 | 说明 |
| --- | --- | --- | --- |
| Claude Code | `hello-claude-code/03-agent-loop.md`, `05-tool-system.md`, `11-prompt-system.md` | `claude-code/src/query.ts:241`, `claude-code/src/Tool.ts:123`, `claude-code/src/constants/prompts.ts` | 覆盖 query 主链、工具上下文和 prompt 资产 |
| Codex | `hello-codex/03-agent-loop.md`, `05-tool-system.md`, `24-mcp-system.md` | `codex/codex-rs/core/src/codex.rs:4289`, `codex/codex-rs/core/src/tools/orchestrator.rs:111`, `codex/codex-rs/core/src/mcp_connection_manager.rs:183` | 覆盖 submission loop、工具治理和 MCP 连接 |
| Gemini CLI | `hello-gemini-cli/03-agent-loop.md`, `05-tool-system.md`, `11-prompt-system.md` | `gemini-cli/packages/core/src/core/client.ts:868`, `gemini-cli/packages/core/src/tools/tool-registry.ts:352`, `gemini-cli/packages/core/src/prompts/promptProvider.ts` | 覆盖 core turn、工具注册和 PromptProvider |
| OpenCode | `hello-opencode/03-agent-loop.md`, `11-prompt-system.md`, `27-session-loop.md` | `opencode/packages/opencode/src/session/prompt.ts:162`, `opencode/packages/opencode/src/session/prompt.ts:278`, `opencode/packages/opencode/src/session/processor.ts:46` | 覆盖 durable prompt、loop 和 stream processor |

## 2.3 本轮补强状态

| 项目 | 已补强范围 | 剩余风险 |
| --- | --- | --- |
| Claude Code | `03/05/11/15/23/24/25` 已补 repo-root 锚点，尤其补齐 `03-agent-loop.md` 的主循环证据 | 反编译快照仍需标注证据等级 |
| Codex | `03/05/11/15/23/24/25` 已补统一“源码锚点补强”表 | `12-21` 可继续深化字段级链路 |
| Gemini CLI | `03/05/11/15/23/24/25` 已补统一“源码锚点补强”表 | 多代理、Hook、Bridge 等章节仍偏摘要 |
| OpenCode | `03/05/11/15/23/24/25` 已补 repo-root 锚点，尤其补齐 `23-input-command-queue.md` 的 server/prompt/command 入口 | 继续避免 `03` 与 `27-29` 重复叙述 |

## 3. 证据等级

后续新增或重写章节时，建议在关键判断附近显式标注证据等级：

| 等级 | 用法 |
| --- | --- |
| 源码确认 | 有明确源码路径、函数、调用点或现有章节证据 |
| 运行链路推断 | 由多个调用点组合推出，正文说明推导路径 |
| 反编译风险 | 只适用于 Claude Code 反编译快照，需说明 stub、命名漂移或行号漂移 |
| 设计解读 | 对工程取舍的分析，不等同于源码事实 |

## 4. 目录级修正策略

| 目录 | 修正动作 |
| --- | --- |
| `hello-claude-code/` | 保留深读文字，补“关键源码锚点”表；反编译推断统一标注 |
| `hello-codex/` | 以 `03-agent-loop.md` 的证据密度为样板，扩展 `11-21` |
| `hello-gemini-cli/` | 保持短章节优势，但每章至少补“生命周期位置”和“关键函数清单” |
| `hello-opencode/` | `03` 保持总览，`27-29` 保持深挖，`36` 只做导航 |

## 5. 质量门禁

新增或合并文档后至少执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check_doc_refs.ps1 -DocDirs hello-claude-code,hello-codex,hello-gemini-cli,hello-opencode,hello-harness
cd pages
npm run build
```

允许 `openclaw/docs/start/showcase.md` 的 Liquid warning 保持为既有噪声；如果新增章节引入新的 broken link 或 Liquid error，需要先修复再合并。
