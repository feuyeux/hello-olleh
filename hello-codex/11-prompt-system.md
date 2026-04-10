---
layout: content
title: "Prompt 系统：build_prompt()、AGENTS.md 与系统消息拼装"
---
# Prompt 系统：`build_prompt()`、`AGENTS.md` 与系统消息拼装

本文分析 Codex 的 Prompt 构建机制，重点关注系统消息的组成、`AGENTS.md` 的注入方式，以及 `build_prompt()` 如何把所有上下文组装为模型输入。


**目录**

- [1. Prompt 组装的三层结构](#1-prompt-组装的三层结构)
- [2. `AGENTS.md` 的加载规则](#2-agentsmd-的加载规则)
- [3. 系统消息组装](#3-系统消息组装)
- [4. `build_prompt()` 主函数](#4-build_prompt-主函数)
- [5. 工具描述注入](#5-工具描述注入)
- [6. 与其他系统的对比](#6-与其他系统的对比)
- [7. 设计特点](#7-设计特点)

---

## 1. Prompt 组装的三层结构

Codex 的 Prompt 构建在 `codex-rs/core/src/` 下实现，由三层信息叠加：

| 层次 | 来源 | 代码位置 |
|------|------|---------|
| **系统消息（System Prompt）** | 内置指令 + `AGENTS.md` | `project_doc.rs` |
| **工具描述（Tool Spec）** | 注册的工具定义 | `tool_defs.rs` |
| **会话历史（History）** | ThreadItem 序列 | `context_manager/history.rs` |

## 2. `AGENTS.md` 的加载规则

```
# 搜索路径（从最具体到最通用）
<working_dir>/AGENTS.md          → 项目级指令（最高优先级）
<working_dir>/../AGENTS.md       → 父目录（向上递归，直到 home）
~/.config/codex/AGENTS.md        → 用户全局指令
~/.codex/AGENTS.md               → 备用全局路径
```

```rust
// codex-rs/core/src/project_doc.rs
pub fn load_agents_md(working_dir: &Path) -> Option<String> {
    walk_up_to_home(working_dir)
        .filter_map(|dir| read_to_string(dir.join("AGENTS.md")).ok())
        .next()
}
```

所有找到的 `AGENTS.md` 内容**按从通用到具体的顺序**拼接，项目级内容追加在最后（覆写语义：具体覆盖通用）。

## 3. 系统消息组装

```rust
// codex-rs/core/src/codex.rs (简化)
fn build_system_prompt(config: &Config, agents_md: Option<&str>) -> String {
    let mut parts = vec![
        BUILT_IN_SYSTEM_PROMPT,           // 内置核心指令
        &config.user_instructions,        // 用户自定义指令（config.toml）
    ];
    if let Some(md) = agents_md {
        parts.push(md);                   // AGENTS.md 内容
    }
    parts.join("\n\n---\n\n")
}
```

内置系统提示包含：工具使用规则、沙箱边界说明、代码生成约定等。

## 4. `build_prompt()` 主函数

```rust
fn build_prompt(
    system: &str,
    history: &[ContextItem],
    tools: &[Tool],
) -> CreateMessageRequest {
    CreateMessageRequest {
        model: self.model.clone(),
        system: vec![ContentBlock::Text { text: system.to_string() }],
        messages: history.iter().map(|item| item.to_message()).collect(),
        tools: tools.to_vec(),
        max_tokens: self.max_tokens,
        stream: true,
        ..Default::default()
    }
}
```

### Token 预算控制

在调用 `build_prompt()` 前，`ContextManager` 会对历史进行裁剪：

```rust
// codex-rs/core/src/context_manager/history.rs
pub fn truncate_to_budget(&mut self, max_tokens: usize) {
    while self.estimated_tokens() > max_tokens {
        // 优先丢弃最旧的 user/assistant turn
        // 保留 system prompt 和最近 N 轮
        self.items.remove(oldest_removable_index());
    }
}
```

## 5. 工具描述注入

所有注册工具的 JSON Schema 描述在 `build_prompt()` 时作为 `tools` 字段传入，模型根据这些描述决定调用哪个工具。

```rust
// codex-rs/core/src/tool_defs.rs
pub fn all_tools(config: &Config) -> Vec<Tool> {
    let mut tools = vec![
        shell_tool(),
        apply_patch_tool(),
        // ...更多内置工具
    ];
    tools.extend(mcp_tools(config)); // MCP 工具动态追加
    tools
}
```

## 6. 与其他系统的对比

| 特性 | Codex | Claude Code | Gemini CLI | OpenCode |
|------|-------|-------------|-----------|---------|
| **项目级提示** | `AGENTS.md` | `CLAUDE.md` | `GEMINI.md` | 无专用文件 |
| **系统提示层数** | 3层（内置+用户+项目） | 多层（内置+memory+项目） | 2层（全局+项目） | 配置驱动 |
| **工具注入方式** | tools 字段 | tools 字段 | tools 字段 | tools 字段 |
| **Token 预算控制** | `ContextManager.truncate_to_budget()` | `buildSystemPrompt()` | `ToolOutputDistillationService` | Effect-ts 流式控制 |

## 7. 设计特点

- **确定性**：`build_prompt()` 是纯函数，相同输入产生相同输出
- **分层合并**：通用→具体的覆写语义使项目级配置优先级最高
- **紧凑型**：无专用 Prompt 编译管道（对比 OpenCode 的 `SessionPrompt.prompt()`），直接在调用点组装

---

## 关键函数清单

| 函数/类型 | 文件 | 职责 |
|----------|------|------|
| `build_prompt()` | `codex-rs/core/src/codex.rs` | 主 prompt 组装器：system + tools + history 三层收束 |
| `load_agents_md()` | `codex-rs/core/src/prompt/` | 加载并层叠 `AGENTS.md`（当前目录 → 层层向上 → HOME）|
| `assemble_system_message()` | `codex-rs/core/src/prompt/` | 组装 system message：AGENTS.md + instructions + 工具描述 |
| `format_tool_description()` | `codex-rs/core/src/tools/` | 将 ToolSpec 格式化为 prompt 中的工具描述文本 |
| `ToolOrchestrator::get_declarations()` | `codex-rs/core/src/orchestrator.rs` | 导出所有注册工具的 schema 供 model 使用 |

---

## 代码质量评估

**优点**

- **`AGENTS.md` 分层加载清晰**：从当前目录向上查找，层层叠加，项目级指令覆盖全局，与 Git 仓库结构天然对齐，不需要额外配置文件指定层级。
- **Prompt 确定性强**：`build_prompt()` 函数式组合，相同输入产生相同输出，无隐式全局状态影响 prompt 内容，调试和测试友好。
- **工具描述合并进 prompt**：工具 schema 作为 prompt 的一部分传给模型，而不是额外参数，兼容不原生支持 function calling 的模型。

**风险与改进点**

- **`AGENTS.md` 层叠规则仅做追加合并**：不同层的 instructions 简单拼接，若全局和项目 `AGENTS.md` 存在语义冲突，模型需要自行判断优先级，行为不确定。
- **工具声明无 token 预算隔离**：工具描述随注册工具数量增长，无独立的 tool-declarations token budget，大量 MCP 工具时可能显著压缩可用 context。
- **无 Prompt 版本管理**：`AGENTS.md` 内容变更对会话历史的影响不可知，session resume 时使用新 prompt 可能与历史对话产生语义不连贯。
