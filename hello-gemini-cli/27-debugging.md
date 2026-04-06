---
layout: content
title: "调试指南"
---
# 调试指南

本文介绍 Gemini CLI 的调试方法。


**目录**

- [1. 调试标志](#1-调试标志)
- [2. 沙箱调试](#2-沙箱调试)
- [3. 日志配置](#3-日志配置)
- [4. 关键源码](#4-关键源码)
- [5. IDE 调试](#5-ide-调试)
- [6. 常见调试技巧](#6-常见调试技巧)

---

## 1. 调试标志

| 标志 | 说明 |
|------|------|
| `--debug` / `-d` | 启用调试模式，打开调试控制台 |
| `DEBUG=1` | 在沙箱中启用调试 |
| `GEMINI_DEBUG_LOG_FILE=path` | 指定调试日志文件路径 |

## 2. 沙箱调试

```bash
# 沙箱中运行并启用调试
DEBUG=1 gemini -s -p "debug command"

# 指定日志文件
GEMINI_DEBUG_LOG_FILE=/tmp/gemini.log gemini
```

## 3. 日志配置

**日志文件**: 由 `GEMINI_DEBUG_LOG_FILE` 环境变量指定，默认为控制台输出

**日志格式**:
```
[2024-01-01T12:00:00.000Z] [DEBUG] message
[2024-01-01T12:00:00.000Z] [LOG] message
[2024-01-01T12:00:00.000Z] [WARN] message
[2024-01-01T12:00:00.000Z] [ERROR] message
```

## 4. 关键源码

| 文件 | 功能 |
|------|------|
| `packages/core/src/utils/debugLogger.ts` | `DebugLogger` 类实现 |
| `packages/core/src/core/logger.ts` | 会话日志记录器 |
| `packages/cli/src/config/config.ts:171-176` | CLI debug 选项定义 |

## 5. IDE 调试

### VS Code

gemini-cli 提供了完整的 `.vscode/launch.json` 配置：

1. **启动调试**: 按 `F5` 使用 "Build & Launch CLI" 配置
2. **Attach 调试**:
   ```bash
   npm run debug  # 启动并等待调试器连接
   ```
3. **测试文件调试**: 使用 "Debug Test File" 配置

### React DevTools

调试 UI 组件：
```bash
DEV=true npm start
npx react-devtools@6
```

## 6. 常见调试技巧

### 查看完整日志

```bash
# 输出到文件
GEMINI_DEBUG_LOG_FILE=/tmp/gemini.log gemini
tail -f /tmp/gemini.log
```

### 网络请求调试

```bash
DEBUG=1 gemini
```

### MCP 调试

```bash
# 测试 MCP 服务器
npm run test:mcp

# MCP 集成测试
npm test -- --testNamePattern="mcp"
```

---

*文档版本: 1.0*
*分析日期: 2026-04-06*

---

## 关键函数清单

| 函数/类型 | 文件 | 职责 |
|----------|------|------|
| `--debug` flag | CLI 入口 | 启用调试输出：打印 API 请求、工具调用详情 |
| `LOG_LEVEL` env var | 进程环境 | 控制日志详细程度（debug/info/warn/error）|
| `GEMINI_SANDBOX` env var | 进程环境 | 控制 sandbox 策略，设为 `none` 可跳过沙箱调试 |
| `inspector` / `--inspect-brk` | Node.js | Node.js debugger 入口，VS Code 附加调试 |
| `ChatRecordingService` | `packages/core/src/services/chatRecordingService.ts` | 对话录制兼调试日志：所有交互写入 JSON 文件可回放 |
| `LoopDetectionService.disable()` | `packages/core/src/services/loopDetectionService.ts` | 调试时临时禁用循环检测，避免干扰重复测试用例 |

---

## 代码质量评估

**优点**

- **`--debug` flag 全局启用**：一个 flag 切换到详细输出，无需修改代码或设置多个环境变量，调试上手快。
- **Conversation JSON 文件可回放**：`ChatRecordingService` 的 JSON 录制既是持久化机制也是调试快照，可以直接 `cat` 或 `jq` 分析。
- **沙箱策略可单独关闭**：`GEMINI_SANDBOX=none` 可以快速定位是否是沙箱策略导致的工具执行失败，调试 sandbox 边界问题便捷。

**风险与改进点**

- **无结构化调试日志格式**：`--debug` 输出是非结构化的 `console.log`，无法被 log 聚合工具（如 Elasticsearch/Loki）直接解析，生产问题排查成本高。
- **调试标志无持久化**：`--debug` 需要每次启动时手动添加，无法在配置文件中持久化，开发调试 session 重启后需要重新指定。
- **MCP server 调试无专用工具**：调试 MCP server 通信（stdio 协议）需要手动解析工具日志，缺少 MCP 专用 inspector 或协议录制工具。
