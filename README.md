<!-- markdownlint-disable MD060 -->
# hello-olleh

`hello-olleh` 是一个面向 AI Coding CLI 的源码阅读与对比分析工作区。仓库同时保存上游源码快照和对应的分析产物，用于理解不同工具在启动链路、Agent 调度、工具系统、状态管理与扩展机制上的实现差异。

## 分析对象

| 工程 | 版本 | 语言/框架 | 架构特点 |
|:-----|:-----|:----------|:---------|
| [claude-code](sources/claude-code) | v2.1.87（反编译） | TypeScript / React | src/ 目录，React TUI，REPL 交互，Hooks 生命周期 |
| [codex](https://github.com/openai/codex.git) | rust-v0.118.0 | **Rust**（86 crate）+ TypeScript SDK | Rust workspace 为运行时中心，TS 只做分发/封装 |
| [gemini-cli](https://github.com/google-gemini/gemini-cli.git) | v0.36.0 | TypeScript monorepo | packages/core 内核 + packages/cli（TUI/Ink）+ SDK + A2A server |
| [opencode](https://github.com/anomalyco/opencode.git) | v1.3.2 | **Bun** + Effect-ts | Hono Server + SQLite Durable State，A/B/C 三层文档结构 |

![](pages/hello-harness.png)

## 目录说明

| 路径 | 用途 |
|:-----|:-----|
| `sources/` | 上游源码快照目录 |
| `sources/claude-code/`, `sources/codex/`, `sources/gemini-cli/`, `sources/opencode/` | 各项目源码，分析输入 |
| `docs/` | 分析输出目录 |
| `docs/hello-claude-code/`, `docs/hello-codex/`, `docs/hello-gemini-cli/`, `docs/hello-opencode/` | 按主题拆分的 Markdown 分析文档 |
| `docs/hello-harness/` | Harness Engineering 框架分析 |
| `scripts/check_doc_refs.ps1` | 校验 Markdown 中的 `path:line` 源码锚点是否能解析到本地快照 |

## 附录

- `Claude Code` + `claude-opus-4.6[1m]`
- `OpenAI Codex` + `gpt-5.4` `xhigh` `fast`
- `Gemini CLI` + `gemini-3.1-pro-preview`
- `OpenCode` + `MiniMax-M2.7`
