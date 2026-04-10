---
layout: content
title: "配置与设置：config.toml、环境变量与运行时策略"
---
# 配置与设置：`config.toml`、环境变量与运行时策略

本文分析 Codex 的配置系统，包括配置文件结构、环境变量、优先级规则和运行时策略注入。


**目录**

- [1. 配置来源与优先级](#1-配置来源与优先级)
- [2. config.toml 完整结构](#2-configtoml-完整结构)
- [3. 主要配置字段说明](#3-主要配置字段说明)
- [4. 环境变量](#4-环境变量)
- [5. 配置加载流程](#5-配置加载流程)
- [6. 项目级配置（`.codex/` 目录）](#6-项目级配置codex-目录)
- [7. 与其他系统的对比](#7-与其他系统的对比)

---

## 1. 配置来源与优先级

```
CLI 参数 (--model, --sandbox, --approval-policy)
    ↓ 覆写（最高优先级）
环境变量 (CODEX_RS_MODEL, OPENAI_API_KEY, ...)
    ↓ 覆写
.codex/config.toml（项目级）
    ↓ 覆写
~/.config/codex/config.toml（用户全局）
    ↓ 覆写
内置默认值（最低优先级）
```

## 2. config.toml 完整结构

```toml
# ~/.config/codex/config.toml

[model]
name = "o3"                     # 使用的模型 ID
reasoning_effort = "medium"     # 推理强度：low / medium / high

[instructions]
user_instructions = """
你是一个专注于 Rust 开发的代码助手。
...
"""

[approval]
# 自动批准模式：suggest（建议）/ auto-edit（自动编辑）/ full-auto（全自动）
mode = "suggest"

# 细粒度工具审批控制
auto_approve_tools = ["read_file", "list_directory"]
require_approval_tools = ["write_file", "run_command"]

[sandbox]
enable = false                  # 是否启用沙箱隔离
# Linux 下使用 bubblewrap，macOS 下使用 sandbox-exec

[history]
persistence = "saveall"         # 历史持久化策略：saveall / never / ephemeral
max_turns = 100                 # 最大对话轮数

[[mcp_servers]]
name = "filesystem"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
```

## 3. 主要配置字段说明

### 3.1 模型配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `model.name` | string | OpenAI 模型 ID（如 `o3`, `o4-mini`）|
| `model.reasoning_effort` | string | 推理强度（影响 o3/o4 系列速度与质量）|

### 3.2 审批策略

| 模式 | 说明 |
|------|------|
| `suggest` | 仅建议，不执行任何工具（最保守）|
| `auto-edit` | 自动执行文件编辑，Shell 命令需审批 |
| `full-auto` | 自动执行所有工具（需要沙箱或信任环境）|

### 3.3 历史持久化

| 策略 | 说明 |
|------|------|
| `saveall` | 保存所有会话历史（可 resume）|
| `never` | 不保存（隐私优先）|
| `ephemeral` | 仅内存中保留，进程退出即丢失 |

## 4. 环境变量

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥（必填） |
| `OPENAI_BASE_URL` | 自定义 API endpoint（兼容 OpenAI 协议的服务）|
| `CODEX_RS_MODEL` | 覆写模型选择 |
| `CODEX_APPROVAL_MODE` | 覆写审批模式 |
| `RUST_LOG` | Rust 日志级别（如 `info`, `debug`, `trace`）|

## 5. 配置加载流程

```rust
// codex-rs/config/src/lib.rs
pub fn load_config(cli_flags: &CliFlags) -> Config {
    let global = read_toml("~/.config/codex/config.toml").unwrap_or_default();
    let project = read_toml(".codex/config.toml").unwrap_or_default();
    
    Config::default()
        .merge(global)
        .merge(project)
        .merge(env_overrides())
        .merge(cli_flag_overrides(cli_flags))
}
```

## 6. 项目级配置（`.codex/` 目录）

```
project/
├── .codex/
│   ├── config.toml    # 项目级配置覆写
│   └── instructions/  # 可选：结构化 AGENTS.md 分片
└── AGENTS.md          # 主项目指令文件
```

项目级 `config.toml` 通常只覆写少数字段，如：
```toml
# .codex/config.toml（项目级）
[approval]
mode = "full-auto"  # 在 CI 中使用全自动模式
```

## 7. 与其他系统的对比

| 系统 | 配置格式 | 项目级 | 层级数 | 主要特色 |
|------|---------|-------|--------|---------|
| **Codex** | TOML | `.codex/config.toml` | 4层 | 细粒度工具审批 |
| **Claude Code** | JSON | 项目 `settings.json` | 3层 | Managed Policy |
| **Gemini CLI** | JSON | `.gemini/settings.json` | 4层 | Trust 模型 |
| **OpenCode** | 多格式 | `.opencode/` | 3层 | Effect-ts 驱动 |

---

## 关键函数清单

| 函数/类型 | 文件 | 职责 |
|----------|------|------|
| `Config::load()` | `codex-rs/core/src/config.rs` | 配置加载入口：合并 global / project / env / CLI flags |
| `ConfigFile` | `codex-rs/core/src/config.rs` | `config.toml` 反序列化结构体，对应所有用户可配置字段 |
| `GlobalConfig` | `codex-rs/core/src/config.rs` | `~/.codex/config.toml` 的全局配置，最低优先级 |
| `ProjectConfig` | `codex-rs/core/src/config.rs` | `.codex/config.toml` 的项目级配置，覆盖 global |
| `env_override()` | `codex-rs/core/src/config.rs` | 从环境变量读取并覆盖特定配置项（如 `CODEX_MODEL`） |
| `CliOverrides` | `codex-rs/cli/src/args.rs` | CLI flag 解析结果：优先级最高，最终覆盖所有其他配置 |

---

## 代码质量评估

**优点**

- **四层优先级链清晰**：global → project → env → CLI 的覆盖顺序直觉友好，与 git config 等工具一致。
- **TOML 格式人类可读**：`config.toml` 比 JSON 更易读写，注释支持使配置自文档化。
- **项目级配置隔离**：`.codex/config.toml` 存于项目目录，可纳入版本控制，团队共享配置无需额外工具。

**风险与改进点**

- **配置 schema 无版本管理**：config.toml 格式变更时无兼容性检查，旧配置文件的失效字段被静默忽略。
- **env override 键名无前缀规范**：环境变量名不够 namespaced（如 `MODEL` 可能与其他工具冲突），建议统一 `CODEX_` 前缀。
- **CLI flag 与配置字段无双向映射文档**：用户难以知道哪些 CLI flag 对应哪个 config.toml 键，缺少自动生成的对照表。
