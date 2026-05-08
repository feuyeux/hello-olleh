---
layout: content
title: "18 - 扩展与 MCP 横向对比"
---
<!-- markdownlint-disable MD060, MD024 -->

# 扩展与 MCP 横向对比

对应项目章节：

- `hello-claude-code/06-extension-mcp.md`, `13-skill-system.md`, `14-plugin-system.md`, `24-mcp-system.md`
- `hello-codex/06-extension-mcp.md`, `13-skill-system.md`, `14-plugin-system.md`, `24-mcp-system.md`
- `hello-gemini-cli/06-extension-mcp.md`, `13-skill-system.md`, `14-plugin-system.md`, `24-mcp-system.md`
- `hello-opencode/06-extension-mcp.md`, `13-skill-system.md`, `14-plugin-system.md`, `24-mcp-system.md`, `33-mcp-details.md`

## 1. 扩展面分层

| 层级 | 作用 | 典型对象 |
| --- | --- | --- |
| 指令层 | 改变模型行为，但不直接执行代码 | AGENTS.md、CLAUDE.md、GEMINI.md、skill markdown |
| 命令层 | 把用户动作编译成 prompt 或工作流 | slash command、custom command |
| 工具层 | 给模型可调用的本地/远程能力 | built-in tool、MCP tool、plugin tool |
| 生命周期层 | 在事件前后插入控制逻辑 | hooks、plugin hook、session hook |
| 传输层 | 连接外部服务或远程宿主 | MCP stdio/http/sse、websocket、server API |

## 2. 项目差异

| 项目 | 主要扩展入口 | 设计特征 |
| --- | --- | --- |
| Claude Code | Skill、plugin、MCP、hooks | 扩展面丰富，但反编译快照需要区分真实链路和残留 |
| Codex | MCP、AGENTS.md、skills、hooks | 以 Rust runtime 为核心，扩展要进入统一 approval/sandbox 体系 |
| Gemini CLI | MCP、PromptProvider、tool registry | TypeScript monorepo 可读性好，扩展路径较直接 |
| OpenCode | Plugin、MCP、Command、Skill、custom tool | 扩展最终落到 durable session 和 server contract |

## 3. 代表源码证据

| 项目 | 配置 / 入口 | 连接 / 发现 | Tool / Resource 调用 |
| --- | --- | --- | --- |
| Claude Code | `claude-code/src/services/mcp/config.ts`, `claude-code/src/services/mcp/client.ts` | `claude-code/src/services/mcp/mcpHub.ts`, `claude-code/src/services/mcp/auth.ts:847` | `claude-code/src/services/mcp/mcpHub.ts` |
| Codex | `codex/codex-rs/config/src/mcp_types.rs:118` | `codex/codex-rs/core/src/mcp_connection_manager.rs:183`, `codex/codex-rs/core/src/mcp_connection_manager.rs:579` | `codex/codex-rs/core/src/mcp_tool_call.rs`, `codex/codex-rs/core/src/tools/handlers/mcp.rs` |
| Gemini CLI | `gemini-cli/packages/core/src/tools/mcp-client-manager.ts`, `gemini-cli/packages/core/src/tools/mcp-client.ts` | `gemini-cli/packages/core/src/mcp/auth-provider.ts`, `gemini-cli/packages/core/src/mcp/oauth-provider.ts` | `gemini-cli/packages/core/src/tools/mcp-client.ts`, `gemini-cli/packages/core/src/tools/tool-registry.ts` |
| OpenCode | `opencode/packages/opencode/src/mcp/index.ts:28`, `opencode/packages/opencode/src/config/config.ts:565` | `opencode/packages/opencode/src/cli/cmd/mcp.ts:55`, `opencode/packages/opencode/src/cli/cmd/mcp.ts:140` | `opencode/packages/opencode/src/tool/registry.ts:155`, `opencode/packages/opencode/src/command/index.ts:117` |

## 4. 合并策略

`06-extension-mcp.md` 应作为扩展总览；`13` 写 skill；`14` 写 plugin；`24` 写 MCP 细节。不要在四篇里反复解释同一套概念，而是让每篇只回答一个问题：

| 章节 | 应回答的问题 |
| --- | --- |
| 06 | 这个项目有哪些扩展入口，谁是主入口 |
| 13 | skill 如何发现、注入、激活、失效 |
| 14 | plugin 如何加载、注册 hook/tool/command |
| 24 | MCP server 如何连接、发现 tool/resource/prompt、执行和回收 |

## 5. 文档缺口

Claude Code 需要把 `24b-mcp-deep.md` 中 OAuth/XAA 和权限细节回链到 `24`。Codex 需要补 MCP 与 sandbox approval 的交叉点。Gemini CLI 需要补 MCP 生命周期和错误恢复。OpenCode 需要把 `33-mcp-details.md` 的深挖定位为 `24` 的附录，避免双主线。

