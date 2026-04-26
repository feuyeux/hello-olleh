# Claude-Specific Guidelines

This file provides guidance to Claude (claude.ai, Claude Code, Kiro) when working with code in this repository.

## Quick Reference

**Identity for commits**:
```sh
git commit --author="Claude <noreply@anthropic.com>" \
  -m "Co-authored-by: Claude <noreply@anthropic.com>"
```

**Primary guidelines**: See `AGENTS.md` for comprehensive repository guidelines. This file contains Claude-specific patterns and workflows.

## Project Overview

This is a workspace for analyzing [Hermes Agent](https://github.com/nousresearch/hermes-agent) v0.10.0 (v2026.4.16). The actual source lives in `hermes-agent/`. The root contains reference documentation and analysis notes.

### Technology Stack
- **Python 3.11+**: Core language
- **uv**: Fast Python package manager
- **SQLite**: Session persistence with FTS5 full-text search
- **Core Libraries**: `pydantic`, `tenacity`, `jinja2`, `fire`, `prompt_toolkit`
- **Optional**: `modal`, `daytona`, `mcp`, `faster-whisper`, `elevenlabs`
- **Tools**: `exa-py`, `firecrawl-py`, `parallel-web`
- **Node.js/Docusaurus**: Documentation website

## Development Commands

```sh
cd hermes-agent

# Setup
uv venv venv --python 3.11
source venv/bin/activate  # Windows: venv\Scripts\activate
uv pip install -e ".[all,dev]"

# Health check
hermes doctor

# Run tests (exclude integration tests)
pytest tests/ -q --ignore=tests/integration --ignore=tests/e2e --tb=short -n auto

# Single test file
pytest tests/tools/test_approval.py -v

# Run with coverage
pytest tests/ --cov=agent --cov=tools --cov-report=html

# Run hermes locally
python -m hermes_cli.main

# Direct agent kernel
python run_agent.py

# Lint/typecheck website
cd website && npm install && npm run typecheck
```

## Architecture

Hermes is a layered agent system with 6 distinct layers:

```
Entry → Control (hermes_cli/main.py) → Shells (cli.py, gateway/run.py) → 
Core (run_agent.py AIAgent) → Capabilities (agent/, tools/, model_tools.py) → 
State (hermes_state.py, gateway/session.py)
```

**Entry points** (defined in `pyproject.toml:99-102`):
- `hermes` → `hermes_cli.main:main` — unified CLI
- `hermes-agent` → `run_agent:main` — agent kernel direct
- `hermes-acp` → `acp_adapter.entry:main` — ACP adapter

**Call chain to AIAgent**:
```
hermes script → hermes_cli.main:main() → cmd_chat() → cli.main() → 
HermesCLI.__init__() → _init_agent() → AIAgent.__init__()
```

**Core components**:
- `run_agent.py:AIAgent` (L433-1225) — central orchestrator: prompt building, model loops, tool dispatch, compression, session persistence
- `cli.py:HermesCLI` — interactive TUI with prompt_toolkit
- `model_tools.py` — tool discovery and orchestration (imports `tools/*.py` which self-register via `registry.register()`)
- `hermes_state.py:SessionDB` — SQLite with FTS5 full-text search
- `gateway/run.py:GatewayRunner` — messaging platform lifecycle

**File dependency chain:**
```
tools/registry.py  (no deps — imported by all tool files)
       ↑
tools/*.py  (each calls registry.register() at import time)
       ↑
model_tools.py  (imports tools/registry + triggers tool discovery)
       ↑
run_agent.py, cli.py, batch_runner.py, environments/
```

## Key Design Patterns

**Self-registering tools**: Each `tools/*.py` module calls `registry.register()` at import time. Tool discovery happens in `model_tools._discover_tools()`.

**Toolset system**: Tools are grouped into toolsets (`web`, `terminal`, `file`, `browser`, etc.) that can be enabled/disabled per platform. See `toolsets.py`.

**Session persistence**: All conversations stored in SQLite via `SessionDB`. JSON logs go to `~/.hermes/sessions/`. Two-tier write: JSON first (debug), then SQLite (searchable).

**Ephemeral injection**: `ephemeral_system_prompt` and `prefill_messages` injected at API call time only — never persisted to database or logs.

**Provider abstraction**: Works with any OpenAI-compatible API (OpenRouter, Nous Portal, custom endpoints). Provider resolution at init time.

**Context compression**: When approaching token limits, `ContextCompressor` does structured summarization with `Goal/Progress/Key Decisions/Relevant Files/Next Steps/Critical Context` handoff format.

**Adding a tool (3-file pattern)**:
1. Create `tools/your_tool.py` with `registry.register()` call
2. Add import to `_modules` list in `model_tools.py`
3. Add to `toolsets.py` (`_HERMES_CORE_TOOLS` or new toolset)

**Memory system**: Three-tier memory architecture:
1. **Short-term**: Current conversation context (in-memory)
2. **Working memory**: Recent sessions (SQLite with FTS5)
3. **Long-term**: Skills and user memories (`~/.hermes/memories/`)

**Skill execution**: Skills are markdown files with embedded shell scripts. The agent can read, modify, and execute skills dynamically.

## Important Conventions

- **Skill vs Tool**: Most capabilities should be skills (procedural memory). Tools require custom Python integration or API key management. See `CONTRIBUTING.md` section "Should it be a Skill or a Tool?".
- **Bundled skills** go in `skills/`, official optional skills in `optional-skills/`. Skills are `SKILL.md` + optional `scripts/` directory.
- **Cross-platform**: Never assume Unix. `termios`/`fcntl` are Unix-only. Use `pathlib.Path`. Handle encoding errors for Windows `.env` files.
- **Security**: Always use `shlex.quote()` when interpolating user input into shell commands. Resolve symlinks with `os.path.realpath()` before path checks.
- **Commit style**: Conventional Commits — `fix(cli):`, `feat(gateway):`, `test(tools):`, etc.
- **Type hints**: Encouraged for public APIs and complex functions
- **Error handling**: Use `tenacity` for retries, log errors with context
- **Configuration**: User config in `~/.hermes/`, never in repo

## Claude-Specific Workflows

### Code Analysis Approach
1. **Start broad**: Read architecture docs (`AGENTS.md`, `CONTRIBUTING.md`)
2. **Identify entry points**: Check `pyproject.toml` for CLI commands
3. **Trace execution**: Follow call chains from entry to core logic
4. **Map dependencies**: Understand import relationships
5. **Test understanding**: Run code with test inputs

### Debugging Strategy
1. **Reproduce**: Create minimal test case
2. **Isolate**: Identify the failing component
3. **Inspect**: Read relevant source files
4. **Hypothesize**: Form theory about root cause
5. **Verify**: Test fix with unit tests
6. **Document**: Add comments explaining non-obvious fixes

### Refactoring Guidelines
1. **Preserve behavior**: Ensure tests pass before and after
2. **Small steps**: Make incremental changes
3. **Test coverage**: Add tests for edge cases
4. **Document changes**: Update docstrings and comments
5. **Review impact**: Check for breaking changes

### When to Use Sub-Agents (Kiro)
- **context-gatherer**: For deep codebase exploration or bug investigation
- **general-task-execution**: For isolated subtasks that don't need main context
- **custom-agent-creator**: For creating specialized agents

## User Configuration

User config lives in `~/.hermes/` (not in the repo):
- `config.yaml` — settings (model, provider, toolsets)
- `.env` — API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
- `skills/` — active skills
- `memories/` — MEMORY.md, USER.md (long-term context)
- `state.db` — SQLite session database
- `sessions/` — JSON session logs

## Repository Structure Notes

- `hermes-agent/AGENTS.md` — development guide for AI coding assistants (important for prompt engineering context)
- `hermes-agent/CONTRIBUTING.md` — full contributing guide with architecture overview and tool/skill authoring patterns
- Root-level `hermes-agent v2026.4.16 源代码分析.md` — Chinese-language architecture analysis (reference material)
- `hermes-agent/website/` — Docusaurus documentation site
- `hermes-agent/.plans/` — Design documents for upcoming features
- `hermes-agent/docs/specs/` — Technical specifications

## Common Tasks

### Adding a New Tool
```python
# tools/my_tool.py
from tools.registry import register

@register(
    name="my_tool",
    description="Does something useful",
    parameters={
        "input": {"type": "string", "description": "Input parameter"}
    }
)
def my_tool(input: str) -> dict:
    """Implementation here."""
    return {"result": "success"}
```

Then add to `model_tools.py` and `toolsets.py`.

### Creating a Skill
```markdown
# skills/my-skill/SKILL.md
# My Skill

## Description
What this skill does.

## Usage
How to use it.

## Scripts
- `scripts/helper.sh` — Helper script
```

### Running Integration Tests
```sh
pytest tests/integration/ -v --tb=short
```

### Building Documentation
```sh
cd website
npm run build
npm run serve  # Preview production build
```

## Commit Identity & Co-Authorship Rules

Follow the canonical commit identity rules in `AGENTS.md`.

**For Claude**:
```sh
git commit -m "feat(tools): add new web scraping tool" \
  --author="Claude <noreply@anthropic.com>" \
  -m "Co-authored-by: Claude <noreply@anthropic.com>"
```

**For Qoder**:
```sh
git commit -m "feat(tools): add new web scraping tool" \
  --author="Qoder <noreply@qoder.com>" \
  -m "Co-authored-by: Qoder <noreply@qoder.com>"
```
