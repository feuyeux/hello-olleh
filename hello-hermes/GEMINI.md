# Gemini-Specific Guidelines — Hello Hermes ☤

This file provides guidance to Gemini (Google AI Studio, Gemini Code Assist) when working with code in this repository.

## Quick Reference

**Identity for commits**:
```sh
git commit --author="Gemini <noreply@google.com>" \
  -m "Co-authored-by: Gemini <noreply@google.com>"
```

**Primary guidelines**: See `AGENTS.md` for comprehensive repository guidelines. This file contains Gemini-specific patterns and workflows.

## Project Overview

This workspace is dedicated to the development, analysis, and exploration of the **Hermes Agent** (specifically version `v0.10.0 / v2026.4.16`). It contains the core `hermes-agent` source code and high-level architectural analysis.

- **Purpose:** A self-improving AI agent system featuring built-in learning loops (memories/skills), multi-platform messaging (Telegram, Discord, etc.), and a powerful terminal interface.
- **Main Technologies:**
  - **Python 3.11+**: Primary language (AIAgent, CLI, Gateway)
  - **uv**: Fast Python package manager for environment and dependency management
  - **SQLite**: Underlying database for session and state persistence (`FTS5` enabled)
  - **Core Libs**: `pydantic` (schemas), `tenacity` (retries), `jinja2` (prompts), `fire` (CLI), `prompt_toolkit` (REPL)
  - **Optional Integrations**: `modal`, `daytona`, `mcp`, `faster-whisper`, `elevenlabs`
  - **Tools**: `exa-py`, `firecrawl-py`, `parallel-web`
  - **Node.js/Docusaurus**: Used for the documentation website

## Architecture Summary

Hermes is a layered agent system (6 layers):

```
Entry → Control → Shells → Core → Capabilities → State
```

1. **Entry Layer**: Entry points in `pyproject.toml`:
   - `hermes` → `hermes_cli.main:main` (Unified CLI)
   - `hermes-agent` → `run_agent:main` (Agent kernel)
   - `hermes-acp` → `acp_adapter.entry:main` (ACP adapter)

2. **Control Layer**: `hermes_cli/main.py` handles profiles, environments, and command distribution

3. **Shell Layer**: 
   - `cli.py` — Interactive REPL with `prompt_toolkit`
   - `gateway/run.py` — Messaging adapters (Telegram, Discord, etc.)

4. **Core Orchestrator**: `run_agent.py:AIAgent` (L433-1225) manages:
   - LLM loop and prompt building
   - Tool execution and dispatch
   - Memory and context management
   - Session persistence

5. **Capability Layer**:
   - `agent/` — Prompting, memory, context compression
   - `tools/` — Self-registering tools (via `registry.register()`)
   - `toolsets.py` — Logical grouping of tools

6. **Persistence Layer**: 
   - `hermes_state.py:SessionDB` — SQLite with FTS5 full-text search
   - JSON session log files in `~/.hermes/sessions/`

### Call Chain (REPL)
```
hermes → hermes_cli.main:main() → cmd_chat() → cli.main() → 
HermesCLI → AIAgent
```

## Development & Operations

### Building and Running
Always operate from the `hermes-agent/` directory for code-related tasks.

```sh
cd hermes-agent

# Setup environment
uv venv venv --python 3.11
source venv/bin/activate  # Windows: venv\Scripts\activate
uv pip install -e ".[all,dev]"

# Health check after installation
hermes doctor

# Run agent CLI locally
python -m hermes_cli.main

# Run agent kernel directly
python run_agent.py
```

### Testing
- **Test Runner**: `pytest` (configured in `pyproject.toml`)
- **Execution**: `python -m pytest tests/` (skips integration tests by default)
- **Conventions**: New features/fixes MUST include corresponding tests in `tests/`

```sh
# Run all tests
pytest tests/ -q --ignore=tests/integration --ignore=tests/e2e --tb=short -n auto

# Run specific test file
pytest tests/tools/test_approval.py -v

# Run with coverage
pytest tests/ --cov=agent --cov=tools --cov-report=html

# Run integration tests (explicit opt-in)
pytest tests/integration/ -v
```

### Documentation Development
```sh
cd website
npm install
npm run start           # Development server
npm run build           # Production build
npm run typecheck       # Type checking
npm run lint:diagrams   # Validate diagram references
```

### Coding Conventions
- **Style**: 4-space indentation, `snake_case` (functions/modules), `PascalCase` (classes)
- **Security**: Always use `shlex.quote()` for shell interpolation. Use `pathlib.Path` for cross-platform file handling
- **Commits**: Use Conventional Commits (`feat(cli): ...`, `fix(agent): ...`)
- **Documentation**: Match existing patterns in the module being edited
- **Type hints**: Encouraged for public APIs and complex functions
- **Error handling**: Use `tenacity` for retries, provide context in error messages
- **Cross-platform**: Never assume Unix-only modules (`termios`, `fcntl`)

### Key Design Patterns

**Self-registering tools**: Each `tools/*.py` module calls `registry.register()` at import time. Tool discovery happens in `model_tools._discover_tools()`.

**Toolset system**: Tools are grouped into toolsets (`web`, `terminal`, `file`, `browser`) that can be enabled/disabled per platform. See `toolsets.py`.

**Session persistence**: All conversations stored in SQLite via `SessionDB`. JSON logs go to `~/.hermes/sessions/`. Two-tier write: JSON first (debug), then SQLite (searchable).

**Ephemeral injection**: `ephemeral_system_prompt` and `prefill_messages` injected at API call time only — never persisted to database or logs.

**Context compression**: When approaching token limits, `ContextCompressor` does structured summarization with `Goal/Progress/Key Decisions/Relevant Files/Next Steps/Critical Context` handoff format.

**Memory system**: Three-tier architecture:
1. **Short-term**: Current conversation context (in-memory)
2. **Working memory**: Recent sessions (SQLite with FTS5)
3. **Long-term**: Skills and user memories (`~/.hermes/memories/`)

### Adding a New Tool (3-file pattern)
1. Create `tools/your_tool.py` with `registry.register()` call
2. Add import to `_modules` list in `model_tools.py`
3. Add to `toolsets.py` (`_HERMES_CORE_TOOLS` or new toolset)

### Skill vs Tool Decision
- **Skills**: Procedural memory, markdown-based, no code required
  - Use for: Workflows, best practices, domain knowledge
  - Location: `skills/` (bundled) or `optional-skills/`
- **Tools**: Python integration, API access, system operations
  - Use for: File I/O, web scraping, database queries, external APIs
  - Location: `tools/` directory

See `CONTRIBUTING.md` section "Should it be a Skill or a Tool?" for detailed guidance.

## Gemini-Specific Workflows

### Code Analysis Approach
1. **Understand context**: Read `AGENTS.md` and `CONTRIBUTING.md` first
2. **Map architecture**: Identify layers and component relationships
3. **Trace execution**: Follow call chains from entry points
4. **Analyze patterns**: Understand design patterns (self-registration, toolsets, etc.)
5. **Verify understanding**: Run code and tests

### Problem-Solving Strategy
1. **Define problem**: Clearly articulate what needs to be solved
2. **Research**: Read relevant source files and documentation
3. **Design solution**: Plan approach before coding
4. **Implement**: Write code following project conventions
5. **Test**: Add comprehensive tests
6. **Document**: Update docs and add comments for complex logic

### Refactoring Guidelines
1. **Preserve behavior**: Ensure all tests pass before and after
2. **Incremental changes**: Make small, reviewable commits
3. **Test coverage**: Add tests for edge cases
4. **Update documentation**: Keep docs in sync with code
5. **Review impact**: Check for breaking changes

### When to Use Sub-Agents
- **codebase_investigator**: For deep architecture mapping or bug root-cause analysis
- **generalist**: For high-volume batch refactoring or speculative research
- **custom-agent-creator**: For creating specialized agents

## Interaction Guidelines

### Commit Identity & Co-Authorship (MANDATORY)
When committing as Gemini, use the following identity:
```sh
git commit -m "<type>(<scope>): <message>" \
  --author="Gemini <noreply@google.com>" \
  -m "Co-authored-by: Gemini <noreply@google.com>"
```

When committing as Qoder, use the following identity:
```sh
git commit -m "<type>(<scope>): <message>" \
  --author="Qoder <noreply@qoder.com>" \
  -m "Co-authored-by: Qoder <noreply@qoder.com>"
```

**Examples**:
```sh
git commit -m "feat(tools): add web scraping with rate limiting" \
  --author="Gemini <noreply@google.com>" \
  -m "Co-authored-by: Gemini <noreply@google.com>"

git commit -m "fix(agent): resolve memory leak in context compression" \
  --author="Gemini <noreply@google.com>" \
  -m "Co-authored-by: Gemini <noreply@google.com>"
```

### Diagram Generation (Quality Rules)
When using diagram skills (especially `fireworks-tech-graph`), strictly follow `AGENTS.md` quality rules:

**CRITICAL Requirements**:
- **No Text Overflow**: Box width must be at least 2x text width; min 30px horizontal padding
- **Complete Arrows**: Path must extend at least 15px past marker refX
- **Stay in ViewBox**: Loopback paths must not be truncated at `y=0`
- **Rounded Connectors**: Use `C` or `Q` commands with `stroke-linejoin="round"`
- **Proper Spacing**: Minimum 80px between node edges
- **Clean Style**: White background, subtle gray containers, minimal decoration

See `AGENTS.md` "Diagram Generation" section for complete quality checklist.

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

## User Configuration

User config lives in `~/.hermes/` (not in the repo):
- `config.yaml` — settings (model, provider, toolsets)
- `.env` — API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, etc.)
- `skills/` — active skills
- `memories/` — MEMORY.md, USER.md (long-term context)
- `state.db` — SQLite session database
- `sessions/` — JSON session logs

## Key Reference Files
- `README.md`: High-level project intro and quick start
- `AGENTS.md`: **CRITICAL** — Detailed repository guidelines, commit rules, and diagram standards (applies to all AI assistants)
- `CLAUDE.md`: Claude-specific patterns and workflows (also useful for Gemini)
- `GEMINI.md`: This file — Gemini-specific guidance
- `hermes-agent v2026.4.16 源代码分析.md`: Deep-dive architectural mapping (Chinese)
- `hermes-agent/CONTRIBUTING.md`: Full guide for Tool/Skill authoring and contribution process
- `hermes-agent/.plans/`: Design documents for upcoming features
- `hermes-agent/docs/specs/`: Technical specifications

## Best Practices Summary

### DO
✅ Read `AGENTS.md` and `CONTRIBUTING.md` before making changes  
✅ Follow Conventional Commits format  
✅ Add tests for all new features and bug fixes  
✅ Use `shlex.quote()` for shell command interpolation  
✅ Handle cross-platform differences (Windows, macOS, Linux)  
✅ Update documentation when changing behavior  
✅ Use proper commit identity (Gemini <noreply@google.com>)  
✅ Run `hermes doctor` after setup changes  
✅ Test locally before committing  

### DON'T
❌ Assume Unix-only modules are available  
❌ Hardcode file paths (use `pathlib.Path`)  
❌ Skip tests for "simple" changes  
❌ Commit without proper author attribution  
❌ Introduce new dependencies without discussion  
❌ Break existing tests  
❌ Ignore security best practices  
❌ Commit API keys or secrets  
❌ Make breaking changes without migration path  

## Getting Help

- **Architecture questions**: Read `AGENTS.md`, `CONTRIBUTING.md`, and source code comments
- **Tool/Skill authoring**: See `CONTRIBUTING.md` "Should it be a Skill or a Tool?"
- **Testing issues**: Check `pytest` configuration in `pyproject.toml`
- **Documentation**: Browse `hermes-agent/website/docs/`
- **Design decisions**: Review `.plans/` and `docs/specs/`
