---
layout: content
title: "调试指南"
---
# 调试指南

本文介绍 Codex 的调试方法。

## 1. 调试标志

| 标志 | 说明 |
|------|------|
| `RUST_LOG=level` | 设置 Rust 日志级别 (error, warn, info, debug, trace) |
| `RUST_LOG=crate=level` | 按 crate 设置日志级别 |
| `--debug` | 子命令: `codex debug` |

**可用子命令**:
```bash
codex debug app-server        # 调试 app server
codex debug clear-memories    # 清除本地记忆状态
```

## 2. 日志配置

Codex 使用 `tracing_subscriber` 进行日志管理。

**默认日志级别**:
```
codex_core=info,codex_tui=info,codex_rmcp_client=info
```

**自定义日志级别**:
```bash
# 所有 crate 设为 debug
RUST_LOG=debug codex

# 特定 crate
RUST_LOG=codex_core=debug,codex_tui=trace codex

# 模式匹配
RUST_LOG=codex_tui::app=debug codex
```

**日志文件**: `~/.codex/logs/codex-tui.log`

## 3. 关键源码

| 文件 | 功能 |
|------|------|
| `codex-rs/tui/src/lib.rs:822-840` | `tracing_subscriber` 配置 |
| `codex-rs/cli/src/main.rs:163-176` | Debug 子命令定义 |
| `codex-rs/core/src/otel_init.rs` | OpenTelemetry 初始化 |

## 4. IDE 调试

### Rust (LLDB/GDB)

```bash
# 开发模式运行
cargo run --bin codex

# 调试模式
RUST_LOG=debug cargo run --bin codex
```

### VS Code (Rust Analyzer)

- 安装 rust-analyzer 扩展
- 使用 "Cargo: Run (debug)" 任务

### Bazel 调试

```bash
# 构建
bazel build //cli:codex

# 运行
bazel run //cli:codex -- --debug
```

## 5. 常见调试技巧

### 过滤日志

```bash
# 只看核心模块 debug
RUST_LOG=codex_core::client=debug codex

# 查看所有 trace
RUST_LOG=trace codex
```

### 查看日志文件

```bash
tail -f ~/.codex/logs/codex-tui.log
```

### 沙箱调试

```bash
codex sandbox macos -- your command
codex sandbox linux -- your command
```

---

*文档版本: 1.0*
*分析日期: 2026-04-06*
