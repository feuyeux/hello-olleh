---
layout: content
title: "调试指南"
---
# 调试指南

本文介绍 Claude Code 的调试方法。


**目录**

- [1. 调试标志](#1-调试标志)
- [2. 日志级别控制](#2-日志级别控制)
- [3. 日志配置](#3-日志配置)
- [4. 关键源码](#4-关键源码)
- [5. IDE 调试](#5-ide-调试)
- [6. 常见调试技巧](#6-常见调试技巧)

---

## 1. 调试标志

| 标志 | 说明 |
|------|------|
| `--debug` / `-d` | 启用调试模式 |
| `--debug=pattern` | 按类别过滤（如 `--debug=api,hooks`） |
| `--debug-file[=path]` | 将调试输出写入指定文件 |
| `--debug-to-stderr` / `-d2e` | 将调试输出重定向到 stderr |
| `DEBUG=1` | 环境变量启用调试 |
| `DEBUG_SDK=1` | 环境变量启用 SDK 调试 |

**会话内启用调试**: 输入 `/debug` 命令可在运行时启用调试日志。

## 2. 日志级别控制

```bash
CLAUDE_CODE_DEBUG_LOG_LEVEL=verbose claude  # 包含高容量诊断信息
CLAUDE_CODE_DEBUG_LOG_LEVEL=debug claude    # 默认级别
```

## 3. 日志配置

**日志文件位置**: `~/.claude/debug/<session-id>.txt`
**最新日志符号链接**: `~/.claude/debug/latest`

**日志格式** (JSONL):
```
2024-01-01T12:00:00.000Z [DEBUG] message content
2024-01-01T12:00:00.000Z [INFO] message content
2024-01-01T12:00:00.000Z [WARN] message content
2024-01-01T12:00:00.000Z [ERROR] message content
```

## 4. 关键源码

| 文件 | 功能 |
|------|------|
| `src/utils/debug.ts:44-57` | `isDebugMode()` 函数检测调试状态 |
| `src/utils/debug.ts:203-228` | `logForDebugging()` 日志写入 |
| `src/utils/telemetry/logger.ts` | OpenTelemetry 诊断日志 |

## 5. IDE 调试

### VS Code

需要手动配置 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Claude Code",
      "runtimeExecutable": "node",
      "runtimeArgs": ["--inspect", "dist/index.js"],
      "cwd": "${workspaceFolder}",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Chrome DevTools

```bash
node --inspect dist/index.js
# 然后在 Chrome 浏览器打开 chrome://inspect
```

## 6. 常见调试技巧

### 过滤调试输出

```bash
# 按类别过滤
claude --debug=api,hooks "your prompt"

# 排除特定类别
claude --debug=!mcp,!file "your prompt"
```

### 查看完整日志

```bash
tail -f ~/.claude/debug/latest
```

### 网络请求调试

```bash
DEBUG=1 claude --debug
```

---

*文档版本: 1.0*
*分析日期: 2026-04-06*

---

## 关键函数清单

| 函数/类型 | 文件 | 职责 |
|----------|------|------|
| `DEBUG` env var | `src/utils/debug.ts` | 控制详细日志输出：`DEBUG=claude-code:*` 开启全模块日志 |
| `Logger` | `src/utils/logger.ts` | 结构化日志工具：按模块 namespace 分类，支持级别过滤 |
| `--debug` flag | `src/cli.ts` | CLI 调试标志：启用详细模式，打印完整 system prompt 和 API 请求 |
| `DebugPanel` | `src/ui/components/DebugPanel.tsx` | TUI 调试面板：实时显示 token 使用、工具调用队列、API 状态 |
| `SessionDumper.dump()` | `src/debug/sessionDumper.ts` | 将当前 session 状态（messages/tools/config）导出为 JSON 文件 |
| `/doctor` command | `src/commands/doctor.ts` | 诊断命令：检查 API key、MCP 连接、配置合法性并报告问题 |

---

## 代码质量评估

**优点**

- **`/doctor` 一键诊断**：`/doctor` 命令覆盖 API key 验证、MCP 连接状态、配置格式三类常见问题，用户无需手动逐一排查。
- **`--debug` 完整 prompt 输出**：调试标志打印完整 system prompt 和 API 请求体，开发者可精确验证 prompt 组装结果是否符合预期。
- **DebugPanel 实时状态**：TUI 内嵌调试面板提供 token 使用和工具调用的实时数据，无需开单独终端看日志。

**风险与改进点**

- **`--debug` 输出包含 API key 片段**：完整 API 请求 dump 可能包含 Authorization header，错误粘贴到 issue 时存在 key 泄漏风险。
- **日志无结构化查询支持**：日志为纯文本，大量调试输出中定位特定问题依赖手动 grep，缺少如 jq 可查询的结构化格式。
- **`SessionDumper` 访问权限无控制**：任何能执行命令的用户都可 dump session，完整历史包含可能敏感的对话内容。
