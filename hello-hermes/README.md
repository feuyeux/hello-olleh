# Hello Hermes Agent ☤

这是一个用于分析 [Hermes Agent](https://github.com/nousresearch/hermes-agent) `v0.10.0 (v2026.4.16)` `1dd6b5d5` 的工作区。

> ## 正确发音
>
> 注意：本项目中的 “Hermes” 指的是希腊神话中的神。
>
> ✔️ **Hermes**: `/ˈhɜːrmiːz/` — 希腊神话中的语言、文字之神，众神的使者（赫尔墨斯）。
>
> ✖️ **Hermès**: `/ɛʁ.mɛs/` — 法国奢侈品牌（爱马仕）。

## 1 Hermes Agent 源代码分析

```sh
git clone --depth 1 --branch v2026.4.16 https://github.com/nousresearch/hermes-agent
```

| 关注点 | 推荐阅读 |
|--------|----------|
| 🚀 快速上手 | 第一篇 (流程篇) |
| 🗄️ 数据持久化 | 第二篇 (数据篇) |
| 🔧 开发新工具/插件 | 第三篇 (扩展篇) |
| 🐛 调试与问题排查 | 第四篇 (调试篇) |
| 🏗️ 理解系统设计 | 第五篇 (类关系篇) |
| 📝 提示词工程 | 第六篇 (提示词全谱篇) |


## 2 Hermes Agent 使用

### 安装

```sh
# Linux / macOS / WSL2 / Android (Termux)
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
# Windows
powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; irm https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.ps1 | iex"
```

### 更新

```sh
hermes update
hermes version
```

### 配置

```sh
# Run the setup wizard
hermes setup

# View/edit configuration
code ~/.hermes/
```

```yaml
model:
  default: kr/claude-sonnet-4.5
  provider: custom
  base_url: http://localhost:20128/v1
```

### 配置
```sh
# Start interactive chat
hermes
```

## 3 Hermes Agent 断点调试(PyCharm)

### 1. 编译

```sh
cd hermes-agent
rm -rf venv
uv venv venv --python 3.14.3
# macOS: source venv/bin/activate
# Windows: venv\Scripts\activate
uv pip install -e ".[dev,cli,pty,mcp]"
```

### 2. `.run/` 

示例配置在根目录 `.run/`

| `.run/` 文件 | 对应 `.idea/` 位置 | 作用 |
|---|---|---|
| `main.run.xml` | _(留在 `.run/`)_ | 共享 Run Configuration |
| `workspace.xml` | `workspace.xml` | 本地 RunManager 示例 |
| `misc.xml` | `misc.xml` | 解释器绑定示例 |
| `modules.xml` | `modules.xml` | 模块注册示例 |
| `hello-hermes.iml` | `hello-hermes.iml` | SDK 绑定示例 |

> **易混淆**：`.run/main.run.xml` 对应 `.idea/workspace.xml` 中 `RunManager > configuration name="main"`，不是复制到 `.idea/` 的同名文件。如需复制到 `.idea/`，请用 `.run/workspace.xml`。

### 3. 断点调试

1. 备份 `.idea/`，将 `.run/` 中同名文件复制过去
2. 替换以下占位符为本机值：

```xml
<env name="HERMES_HOME" value="<YOUR_HERMES_HOME>" />
<env name="PYTHONPATH" value="<YOUR_PROJECT_DIR>\hermes-agent" />
<option name="WORKING_DIRECTORY" value="<YOUR_PROJECT_DIR>\hermes-agent" />
<option name="PARAMETERS" value='chat --quiet -q "<YOUR_DEBUG_PROMPT>"' />
<option name="sdkName" value="<YOUR_PYCHARM_SDK_NAME>" />
<orderEntry type="jdk" jdkName="<YOUR_PYCHARM_SDK_NAME>" jdkType="Python SDK" />
```

<img src="images/pycharm-debug.png" alt="pycharm-debug" style="height:500px; display: block; margin-left: 0;"/>

| 项 | 值 |
|---|---|
| 启动入口 | `$PROJECT_DIR$/hermes-agent/hermes_cli/main.py` |
| 工作目录 | `<YOUR_PROJECT_DIR>/hermes-agent` |
| 默认参数 | `chat --quiet -q "<YOUR_DEBUG_PROMPT>"` |
| 环境变量 | `HERMES_HOME`、`PYTHONPATH`、`PYTHONIOENCODING=utf-8`、`PYTHONUNBUFFERED=1` |

`chat --quiet -q` 走 one-shot 路径，不进交互式 TUI，避免 PyCharm Run 窗口触发 `NoConsoleScreenBufferError`。`HERMES_HOME` 显式指定以复用本机配置和密钥；`PYTHONPATH` / `WORKING_DIRECTORY` 固定到 `hermes-agent/` 贴近命令行实际环境。

调试其他请求只需改 `PARAMETERS`：

```sh
chat --quiet -q "Read the current repo and explain the startup flow"
chat --quiet -q "Return only JSON: {status, summary}"
chat --quiet --toolsets web,terminal -q "Check the latest Python release and write notes to notes/python.md"
```

进一步查看这条 one-shot 请求的完整调用链、启动链、工具分支与状态持久化路径，可直接参考：[Hermes 架构解析 (四)：调试篇 · 完整链路走查](./Hermes%20架构解析%20(四)：调试篇%20·%20完整链路走查.md)

### 4 多轮会话调试

运行完整的多轮对话时，用 `--resume` / `-r` 参数恢复以前的 session，保持完整的上下文：

```sh
# 第 1 轮：初始请求（返回 session_id）
python hermes-agent/hermes_cli/main.py chat --quiet -q "Summarize the repository structure in 5 bullets"
# Output: session_id: 20260413_194556_5aebb2

# 第 2 轮：恢复 session，继续提问
python hermes-agent/hermes_cli/main.py chat --quiet --resume 20260413_194556_5aebb2 -q "Based on your summary, what are the main entry points?"

# 第 3 轮：再次恢复同一 session
python hermes-agent/hermes_cli/main.py chat --quiet -r 20260413_194556_5aebb2 -q "How would I add a new tool to the system?"
```

**Session 管理**：

| 命令 | 效果 |
|---|---|
| `-r <SESSION_ID>` / `--resume <SESSION_ID>` | 恢复特定 session |
| `-c` / `--continue` | 恢复最近一次的 CLI session |
| `-c "会话名称"` | 按名称恢复（需先用 `hermes sessions rename` 命名） |
| `hermes sessions list` | 查看所有 session |
| `hermes sessions export output.jsonl --session-id <ID>` | 导出特定 session |

---

## 4 Hermes Agent 资源

- **官方仓库**: <https://github.com/nousresearch/hermes-agent>
- **官方网站**: <https://hermes-agent.nousresearch.com>
- **快速入门文档**: <https://hermes-agent.nousresearch.com/docs/getting-started/quickstart>

<img src="images/hello-hermes.png" alt="hello-hermes" style="height:800px; display: block; margin-left: 0;" />
