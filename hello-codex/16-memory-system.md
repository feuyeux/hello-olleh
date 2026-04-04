---
layout: content
title: "Memory 系统：轻量记忆管道与 AGENTS.md 的长期记忆"
---
# Memory 系统：轻量记忆管道与 `AGENTS.md` 的长期记忆

本文分析 Codex 的 Memory 机制，涵盖会话内轻量记忆（memories pipeline）和跨会话长期记忆（`AGENTS.md` + 人工维护）。

## 1. Memory 在 Codex 中的两种形式

| 类型 | 实现 | 生命周期 | 控制方式 |
|------|------|---------|---------|
| **会话内 Memory** | `memories pipeline`（自动提取） | 单次会话 | 自动 |
| **跨会话 Memory** | `AGENTS.md`（手动维护） | 永久 | 用户手动更新 |

## 2. 会话内记忆管道（memories pipeline）

### 2.1 自动记忆提取

每个 turn 结束后，Codex 会从当前 rollout（执行历史）中自动提取"值得记住"的信息：

```rust
// codex-rs/core/src/memories/extractor.rs
pub async fn extract_memories(rollout: &[ThreadItem]) -> Vec<RawMemory> {
    // 使用轻量模型从 rollout 中识别关键信息
    // 例如：用户偏好、项目约定、错误模式
    let prompt = build_extraction_prompt(rollout);
    llm_extract(prompt).await
}
```

### 2.2 两阶段 Consolidation

```
新会话 memories
    ↓ 阶段一：去重与合并
合并后的 memories
    ↓ 阶段二：重要性评分与筛选
精简 memory 列表
    ↓ 注入当前 Prompt
模型可见的 memory 上下文
```

```rust
// codex-rs/core/src/memories/consolidator.rs
pub async fn consolidate(
    existing: Vec<Memory>,
    new_memories: Vec<RawMemory>,
) -> Vec<Memory> {
    let merged = deduplicate(existing, new_memories);
    rank_by_importance(merged).truncate(MAX_MEMORY_COUNT)
}
```

### 2.3 Memory 注入 Prompt

筛选后的 memories 作为特殊上下文块注入到系统消息：

```
System Prompt:
  [内置指令]
  [AGENTS.md 内容]
  [Memory 块]
    - 用户偏好使用 snake_case 命名
    - 项目使用 PostgreSQL 14 数据库
    - 上次修复的 auth bug 相关路径：src/auth/token.rs
```

## 3. 跨会话长期记忆：AGENTS.md

Codex 没有自动化的跨会话 Memory 存储。长期记忆由用户通过 `AGENTS.md` 手动维护：

```markdown
# AGENTS.md（跨会话知识库）

## 项目约定
- 使用 sqlx 进行数据库操作（不使用 diesel）
- 错误类型统一定义在 `src/errors.rs`
- 所有公开 API 需要集成测试

## 已知问题
- `src/auth/refresh.rs` 中的 token 刷新逻辑在并发场景下有竞争条件
- 测试数据库连接池配置参见 `tests/conftest.py`

## 重要路径
- 配置加载入口：`src/config/mod.rs`
- 数据库 migration：`migrations/`
```

用户可以让 Codex 主动将重要信息写入 `AGENTS.md`：
```
用户：请把我们今天发现的这个架构决策记录到 AGENTS.md 中
```

## 4. 与其他系统的对比

| 特性 | Codex | Claude Code | Gemini CLI | OpenCode |
|------|-------|-------------|-----------|---------|
| **会话内 Memory** | memories pipeline（自动） | 无独立机制 | 分层 `GEMINI.md` + JIT context | 无独立机制 |
| **跨会话 Memory** | `AGENTS.md`（手动） | `CLAUDE.md` + memory files | 全局/项目 `GEMINI.md` + `save_memory` | Memory 系统 |
| **自动持久化** | 部分（会话内提取） | 无 | 部分（文件持久化，非自动总结） | 是（SQLite） |
| **用户控制** | `AGENTS.md` 手动编辑 | `CLAUDE.md` 手动编辑 | `/memory` + `GEMINI.md` | 配置驱动 |

## 5. 设计权衡

**Codex 的 Memory 设计偏向简洁**：
- 自动 memories 仅存在于当前会话，降低"幽灵记忆"风险
- 跨会话知识通过显式的 `AGENTS.md` 管理，用户完全可见、可控
- 无需维护单独的 Memory 数据库，降低复杂度

**局限**：
- 缺乏自动跨会话 Memory（需用户手动维护 `AGENTS.md`）
- 会话内 memories 消耗额外 LLM 调用
- 大规模项目的 `AGENTS.md` 可能变得难以维护
