---
layout: default
title: "配置与设置：环境变量、.gemini 目录与运行时策略"
---
# 配置与设置：环境变量、.gemini 目录与运行时策略

本文档分析 Gemini CLI 的配置系统，包括配置来源、优先级与运行时策略注入。

## 1. 配置体系概览

Gemini CLI 的配置由三层来源组成，优先级从高到低：

```
CLI 参数 (--model, --sandbox)
    ↓ 覆写
环境变量 (GEMINI_API_KEY, GOOGLE_AI_API_KEY)
    ↓ 覆写
~/.gemini/settings.json（用户全局）
    ↓ 覆写
.gemini/settings.json（项目级）
    ↓ 覆写
内置默认值
```

## 2. 配置目录结构

```
~/.gemini/                       # 全局用户配置目录
├── settings.json                # 全局设置（model, theme, sandbox...）
├── sessions/                    # 会话持久化目录
│   └── <session-id>/
│       └── conversation.json
└── memories/                    # 用户 Memory 存储（UserMemory）

.gemini/                         # 项目级配置目录（随代码库）
├── settings.json                # 项目设置（覆写全局）
└── GEMINI.md                    # 项目级系统提示注入
```

## 3. settings.json 主要字段

```json
{
  "model": "gemini-2.5-pro",
  "sandbox": false,
  "theme": "Default",
  "contextWindow": 1048576,
  "autoAcceptTools": false,
  "trustedFolders": ["/home/user/projects"],
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["my-mcp-server"],
      "trust": "untrusted"
    }
  }
}
```

### 关键字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `model` | string | 使用的 Gemini 模型 ID |
| `sandbox` | boolean | 是否启用沙箱隔离执行 |
| `autoAcceptTools` | boolean | 是否自动批准所有工具调用 |
| `trustedFolders` | string[] | 允许自动执行的目录白名单 |
| `mcpServers` | object | MCP 服务器配置（命令+参数+信任级别） |
| `contextWindow` | number | 上下文窗口大小上限（tokens） |

## 4. 环境变量

| 变量 | 说明 |
|------|------|
| `GEMINI_API_KEY` | Gemini API 密钥（优先） |
| `GOOGLE_AI_API_KEY` | 备用 API 密钥 |
| `GOOGLE_CLOUD_PROJECT` | GCP 项目 ID（Vertex AI 模式） |
| `GEMINI_MODEL` | 覆写模型选择 |
| `GEMINI_SANDBOX` | 覆写沙箱设置（`true`/`false`） |
| `DEBUG` | 调试日志开关 |

## 5. 配置加载流程

```typescript
// packages/cli/src/config/config.ts
export async function loadConfig(flags: CliFlags): Promise<GeminiConfig> {
  const globalSettings = await loadJsonFile('~/.gemini/settings.json');
  const projectSettings = await loadJsonFile('.gemini/settings.json');
  
  return deepMerge(
    DEFAULT_CONFIG,
    globalSettings,
    projectSettings,
    envOverrides(),      // 环境变量覆写
    flagOverrides(flags) // CLI 参数覆写（最高优先级）
  );
}
```

## 6. GEMINI.md 系统提示注入

项目根目录下的 `.gemini/GEMINI.md` 在每次会话启动时被自动注入为系统提示：

```
~/.gemini/GEMINI.md      → 全局系统提示（总是加载）
.gemini/GEMINI.md        → 项目级系统提示（追加到全局之后）
```

这是 Gemini CLI 的 Memory 系统与配置系统的交汇点：开发者可通过 `GEMINI.md` 定制 Agent 行为，类似 Claude Code 的 `CLAUDE.md`。

## 7. 与其他系统的对比

| 系统 | 配置文件 | 项目级覆写 | 环境变量优先级 |
|------|---------|-----------|-------------|
| **Gemini CLI** | `.gemini/settings.json` | ✅ | 高于配置文件 |
| **Claude Code** | `settings.json` + `CLAUDE.md` | ✅ | 支持 |
| **Codex** | `config.toml` | ✅ | 支持 |
| **OpenCode** | `.opencode/config` | ✅ | 支持 |

## 8. 运行时策略注入

`PolicyEngine` 在启动时读取配置，将 `autoAcceptTools`、`trustedFolders` 等字段转化为运行时权限策略，影响每次工具调用的审批决策。
