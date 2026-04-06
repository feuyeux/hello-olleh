---
layout: content
title: "调试指南"
---
# 调试指南

本文介绍 Claude Code 的调试方法。

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
