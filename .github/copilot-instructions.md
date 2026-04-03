# hello-olleh 工作区指南

本工作区是一个多 CLI Agent 工具的**源码分析对比工程**，不是被分析工具本身。主要任务是：阅读各子目录中的源码，按照 `hello.txt` 的模板要求输出 Markdown 分析文档到对应的 `hello-*` 目录。

## 项目结构

| 目录           | 内容                                                     | 对应分析输出目录     |
| -------------- | -------------------------------------------------------- | -------------------- |
| `claude-code/` | Claude Code CLI 反编译源码 `2.1.87`                      | `hello-claude-code/` |
| `codex/`       | OpenAI Codex CLI（Rust + TS） `rust-v0.119.0-alpha.5`    | `hello-codex/`       |
| `gemini-cli/`  | Google Gemini CLI（TypeScript mono） `v0.37.0-preview.1` | `hello-gemini-cli/`  |
| `opencode/`    | Anomaly OpenCode（Bun + TypeScript） `v1.3.2`            | `hello-opencode/`    |

每个 `hello-*` 目录都是已完成的分析文档集合，可作为写新分析时的格式参考。

## 分析文档规范

所有分析文档均遵循 `hello.txt` 的提示词要求，核心要求如下：

- **格式**：Markdown，含清晰目录导航，每个主题独立成篇
- **Mermaid 图**：关键流程必须附带流程图或顺序图，使用 `neutral` 主题，尽量左右布局
- **关键函数清单**：每个核心模块列出关键函数及功能描述
- **代码引用**：引用源码时，注明文件路径和行号，例如 `codex/codex-rs/cli/src/main.rs:88-152`
- **章节顺序**：架构全景 → 启动链路 → 核心执行循环 → 工具调用机制 → 状态管理 → 扩展性

参考格式范例：[hello-codex/](../hello-codex/)、[hello-gemini-cli/](../hello-gemini-cli/)

## 分析任务流程

新增分析目标时：

1. 在对应源码目录下先查看 `package.json`/`Cargo.toml`/`go.mod` 确认版本和依赖
2. 找项目入口点（`main.ts`、`main.rs`、`cli.tsx` 等）
3. 按 `hello.txt` 八大主题逐一输出，文件名格式：`NN-kebab-case.md`（如 `01-architecture.md`）
4. 第一个文件（`00-*_ko.md`）为 Kickoff 索引，列出全部子篇的超链接和最短源码阅读路线
5. 写完后更新 README.md 中的版本标注（若有 tag 变化）

## 分析提示词

完整提示词在 [`hello.txt`](../hello.txt) 中。分析新工程时直接使用该文件内容作为 system prompt，对准对应源码目录。

## 不要做的事

- 不要修改 `claude-code/`、`codex/`、`gemini-cli/`、`opencode/` 中的任何源码文件
- 不要在源码目录下新建文件；所有输出写入对应的 `hello-*` 目录
- 这些子目录均处于 detached HEAD（切换到了对应 tag），不要执行 `git commit` 或 `git push`
