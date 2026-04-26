# Hello Hermes Agent ☤

This is a workspace for exploring and analyzing [Hermes Agent](https://github.com/nousresearch/hermes-agent) `v0.10.0 (v2026.4.16)` `1dd6b5d5`.

> ## Pronunciation
>
> Note: The "Hermes" in this project refers to the Greek deity.
>
> ✔️ **Hermes**: `/ˈhɜːrmiːz/` — The Greek god of language and writing, and messenger of the gods.
>
> ✖️ **Hermès**: `/ɛʁ.mɛs/` — French luxury brand.

## 1 Hermes Agent Source Code Analysis

```sh
git clone --depth 1 --branch v2026.4.16 https://github.com/nousresearch/hermes-agent
```

| Focus Area | Recommended Reading |
|------------|---------------------|
| 🚀 Quick Start | Part 1 (Flow) |
| 🗄️ Data Persistence | Part 2 (Data) |
| 🔧 Developing New Tools/Plugins | Part 3 (Extension) |
| 🐛 Debugging & Troubleshooting | Part 4 (Debugging) |
| 🏗️ Understanding System Design | Part 5 (Class Relationships) |
| 📝 Prompt Engineering | Part 6 (Prompt Catalog) |


## 2 Hermes Agent Usage

### Installation

```sh
# Linux / macOS / WSL2 / Android (Termux)
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
# Windows
powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; irm https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.ps1 | iex"
```

### Update

```sh
hermes update
hermes version
```

### Configuration

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

### Usage
```sh
# Start interactive chat
hermes
```

## 3 Hermes Agent Breakpoint Debugging (PyCharm)

### 1. Build

```sh
cd hermes-agent
rm -rf venv
uv venv venv --python 3.14.3
# macOS: source venv/bin/activate
# Windows: venv\Scripts\activate
uv pip install -e ".[dev,cli,pty,mcp]"
```

### 2. `.run/` Directory

Example configurations are in the root `.run/` directory

| `.run/` File | Corresponding `.idea/` Location | Purpose |
|---|---|---|
| `main.run.xml` | _(stays in `.run/`)_ | Shared Run Configuration |
| `workspace.xml` | `workspace.xml` | Local RunManager example |
| `misc.xml` | `misc.xml` | Interpreter binding example |
| `modules.xml` | `modules.xml` | Module registration example |
| `hello-hermes.iml` | `hello-hermes.iml` | SDK binding example |

> **Common Confusion**: `.run/main.run.xml` corresponds to `RunManager > configuration name="main"` in `.idea/workspace.xml`, not a same-named file copied to `.idea/`. If you need to copy to `.idea/`, use `.run/workspace.xml`.

### 3. Breakpoint Debugging

1. Backup `.idea/`, copy same-named files from `.run/` to it
2. Replace the following placeholders with your local values:

```xml
<env name="HERMES_HOME" value="<YOUR_HERMES_HOME>" />
<env name="PYTHONPATH" value="<YOUR_PROJECT_DIR>\hermes-agent" />
<option name="WORKING_DIRECTORY" value="<YOUR_PROJECT_DIR>\hermes-agent" />
<option name="PARAMETERS" value='chat --quiet -q "<YOUR_DEBUG_PROMPT>"' />
<option name="sdkName" value="<YOUR_PYCHARM_SDK_NAME>" />
<orderEntry type="jdk" jdkName="<YOUR_PYCHARM_SDK_NAME>" jdkType="Python SDK" />
```

<img src="images/pycharm-debug.png" alt="pycharm-debug" style="height:500px; display: block; margin-left: 0;"/>

| Item | Value |
|---|---|
| Entry Point | `$PROJECT_DIR$/hermes-agent/hermes_cli/main.py` |
| Working Directory | `<YOUR_PROJECT_DIR>/hermes-agent` |
| Default Parameters | `chat --quiet -q "<YOUR_DEBUG_PROMPT>"` |
| Environment Variables | `HERMES_HOME`, `PYTHONPATH`, `PYTHONIOENCODING=utf-8`, `PYTHONUNBUFFERED=1` |

`chat --quiet -q` uses the one-shot path, avoiding the interactive TUI to prevent `NoConsoleScreenBufferError` in PyCharm's Run window. `HERMES_HOME` is explicitly specified to reuse local configuration and keys; `PYTHONPATH` / `WORKING_DIRECTORY` are fixed to `hermes-agent/` to match the actual command-line environment.

To debug other requests, just change `PARAMETERS`:

```sh
chat --quiet -q "Read the current repo and explain the startup flow"
chat --quiet -q "Return only JSON: {status, summary}"
chat --quiet --toolsets web,terminal -q "Check the latest Python release and write notes to notes/python.md"
```

For a complete walkthrough of the one-shot request's full call chain, startup chain, tool branches, and state persistence paths, refer to: [Hermes Architecture Analysis (Part 4): Debugging · Complete Link Walkthrough](./Hermes%20架构解析%20(四)：调试篇%20·%20完整链路走查.md)

### 4 Multi-turn Session Debugging

When running full multi-turn conversations, use the `--resume` / `-r` parameter to resume previous sessions and maintain full context:

```sh
# Turn 1: Initial request (returns session_id)
python hermes-agent/hermes_cli/main.py chat --quiet -q "Summarize the repository structure in 5 bullets"
# Output: session_id: 20260413_194556_5aebb2

# Turn 2: Resume session, continue asking
python hermes-agent/hermes_cli/main.py chat --quiet --resume 20260413_194556_5aebb2 -q "Based on your summary, what are the main entry points?"

# Turn 3: Resume the same session again
python hermes-agent/hermes_cli/main.py chat --quiet -r 20260413_194556_5aebb2 -q "How would I add a new tool to the system?"
```

**Session Management**:

| Command | Effect |
|---|---|
| `-r <SESSION_ID>` / `--resume <SESSION_ID>` | Resume specific session |
| `-c` / `--continue` | Resume most recent CLI session |
| `-c "session name"` | Resume by name (requires prior naming with `hermes sessions rename`) |
| `hermes sessions list` | View all sessions |
| `hermes sessions export output.jsonl --session-id <ID>` | Export specific session |

---

## 4 Hermes Agent Resources

- **Official Repository**: <https://github.com/nousresearch/hermes-agent>
- **Official Website**: <https://hermes-agent.nousresearch.com>
- **Quickstart Documentation**: <https://hermes-agent.nousresearch.com/docs/getting-started/quickstart>

<img src="images/hello-hermes.png" alt="hello-hermes" style="height:800px; display: block; margin-left: 0;" />
