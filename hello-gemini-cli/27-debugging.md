---
layout: content
title: "调试指南"
---
# 调试指南

本文介绍 Gemini CLI 的调试方法。

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
