# Repository Guidelines for AI Coding Assistants

This document provides comprehensive guidelines for AI coding assistants (Claude, Gemini, Codex, Qoder, etc.) working with this repository.

## Project Structure & Module Organization

This repository is a workspace around the upstream Hermes Agent source. Do most development inside `hermes-agent/`. Core Python packages live in `hermes-agent/agent`, `hermes-agent/tools`, `hermes-agent/hermes_cli`, `hermes-agent/gateway`, `hermes-agent/cron`, and `hermes-agent/acp_adapter`. Tests are under `hermes-agent/tests`, grouped by subsystem such as `tests/cli`, `tests/gateway`, and `tests/tools`. Documentation code lives in `hermes-agent/website`, while repo-level notes like `README.md`, `images/`, and `hermes-agent源代码分析.md` are reference material, not the main product.

### Directory Structure
```
hermes-agent/
├── agent/              # Core agent logic (prompting, memory, compression)
├── tools/              # Self-registering tool modules
├── hermes_cli/         # CLI entry point and command handlers
├── gateway/            # Messaging platform adapters
├── cron/               # Scheduled task system
├── acp_adapter/        # Agent Communication Protocol adapter
├── tests/              # Test suite (mirrors source structure)
├── website/            # Docusaurus documentation site
└── skills/             # Bundled skill definitions
```

## Build, Test, and Development Commands

Run commands from `hermes-agent/` unless you are editing root-level notes.

### Environment Setup
```sh
cd hermes-agent
uv venv venv --python 3.11
source venv/bin/activate  # On Windows: venv\Scripts\activate
uv pip install -e ".[all,dev]"
npm install  # For website development
```

### Testing
```sh
# Run all tests (excludes integration/e2e by default)
python -m pytest tests/ -q --ignore=tests/integration --ignore=tests/e2e --tb=short -n auto

# Run specific test file
pytest tests/tools/test_approval.py -v

# Run with coverage
pytest tests/ --cov=agent --cov=tools --cov-report=html
```

### Running Hermes
```sh
# Health check after installation
hermes doctor

# Run CLI locally
python -m hermes_cli.main

# Run agent kernel directly
python run_agent.py
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

## Coding Style & Naming Conventions

Python is the primary language. Follow existing style: 4-space indentation, `snake_case` for functions and modules, `PascalCase` for classes, and concise docstrings where behavior is not obvious. Match nearby patterns instead of introducing a new formatter style; no repo-wide Black or Ruff config is checked in here. Keep modules focused by subsystem and place new tests beside the affected area. In `website/`, keep TypeScript and Docusaurus files consistent with the existing naming and directory structure.

### Python Style Guidelines
- **Indentation**: 4 spaces (no tabs)
- **Naming**:
  - Functions/variables: `snake_case`
  - Classes: `PascalCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Private members: `_leading_underscore`
- **Imports**: Group stdlib, third-party, local (separated by blank lines)
- **Docstrings**: Use for non-obvious behavior; keep concise
- **Type hints**: Encouraged but not required everywhere

### Security Best Practices
- **Shell commands**: Always use `shlex.quote()` when interpolating user input
- **Path handling**: Use `pathlib.Path` for cross-platform compatibility
- **Symlinks**: Resolve with `os.path.realpath()` before security checks
- **Secrets**: Never log or print API keys, tokens, or credentials

### Cross-Platform Considerations
- Never assume Unix-only modules (`termios`, `fcntl`)
- Handle encoding errors gracefully (Windows `.env` files)
- Test path separators work on Windows
- Use `sys.platform` checks when platform-specific code is unavoidable

## Testing Guidelines

Pytest is the test runner, with `pytest-xdist` enabled by default and `integration` tests excluded unless explicitly targeted. Name tests `test_*.py`, mirroring the package under test, for example `tests/cli/test_cli_init.py`. Add or update tests for every behavior change, especially around CLI flow, tool dispatch, config migration, and cross-platform file or process handling.

### Test Organization
- Mirror source structure: `agent/foo.py` → `tests/agent/test_foo.py`
- Group related tests in classes: `class TestFooFeature:`
- Use descriptive test names: `test_should_handle_empty_input_gracefully`

### Test Categories
- **Unit tests**: Fast, isolated, no external dependencies
- **Integration tests**: `tests/integration/` (requires explicit opt-in)
- **E2E tests**: `tests/e2e/` (full system tests, slow)

### Testing Best Practices
- **Fixtures**: Use pytest fixtures for common setup
- **Mocking**: Mock external APIs, file I/O, and network calls
- **Parametrize**: Use `@pytest.mark.parametrize` for multiple test cases
- **Coverage**: Aim for >80% coverage on new code
- **CI/CD**: All tests must pass before merging

## Architecture Overview

Hermes is a layered agent system with 6 distinct layers:

```
Entry → Control → Shells → Core → Capabilities → State
```

### Layer Breakdown

1. **Entry Layer**: Entry points defined in `pyproject.toml`:
   - `hermes` → `hermes_cli.main:main` (unified CLI)
   - `hermes-agent` → `run_agent:main` (agent kernel direct)
   - `hermes-acp` → `acp_adapter.entry:main` (ACP adapter)

2. **Control Layer**: `hermes_cli/main.py` handles profiles, environments, command routing

3. **Shell Layer**: 
   - `cli.py` — Interactive REPL with `prompt_toolkit`
   - `gateway/run.py` — Messaging platform adapters

4. **Core Orchestrator**: `run_agent.py:AIAgent` (L433-1225)
   - Prompt building, model loops, tool dispatch
   - Context compression, session persistence

5. **Capability Layer**:
   - `agent/` — Prompting, memory, compression logic
   - `tools/` — Self-registering tool modules
   - `model_tools.py` — Tool discovery and orchestration

6. **Persistence Layer**:
   - `hermes_state.py:SessionDB` — SQLite with FTS5 full-text search
   - JSON session logs in `~/.hermes/sessions/`

### Call Chain (CLI to Agent)
```
hermes → hermes_cli.main:main() → cmd_chat() → cli.main() → 
HermesCLI.__init__() → _init_agent() → AIAgent.__init__()
```

### Key Design Patterns

**Self-registering tools**: Each `tools/*.py` module calls `registry.register()` at import time. Tool discovery happens in `model_tools._discover_tools()`.

**Toolset system**: Tools are grouped into toolsets (`web`, `terminal`, `file`, `browser`) that can be enabled/disabled per platform. See `toolsets.py`.

**Session persistence**: All conversations stored in SQLite via `SessionDB`. JSON logs go to `~/.hermes/sessions/`. Two-tier write: JSON first (debug), then SQLite (searchable).

**Ephemeral injection**: `ephemeral_system_prompt` and `prefill_messages` injected at API call time only — never persisted to database or logs.

**Provider abstraction**: Works with any OpenAI-compatible API (OpenRouter, Nous Portal, custom endpoints). Provider resolution at init time.

**Context compression**: When approaching token limits, `ContextCompressor` does structured summarization with `Goal/Progress/Key Decisions/Relevant Files/Next Steps/Critical Context` handoff format.

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



## Commit & Pull Request Guidelines

The active history in `hermes-agent/` uses Conventional Commits such as `fix(process): ...` and `feat(cli): ...`; continue that pattern. PRs should follow `.github/PULL_REQUEST_TEMPLATE.md`: link the issue, summarize the change, provide clear reproduction or verification steps, and note documentation or config updates. Include screenshots or logs when UI, CLI output, or docs rendering changes.

### Conventional Commit Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`

**Scopes**: `cli`, `agent`, `tools`, `gateway`, `cron`, `acp`, `website`, `tests`

**Examples**:
- `feat(tools): add web scraping tool with rate limiting`
- `fix(agent): resolve memory leak in context compression`
- `docs(website): update installation guide for Windows`
- `test(cli): add integration tests for profile switching`

### AI Tool Commit Identity

When committing as an AI tool, the commit author and `Co-authored-by` MUST both match the tool identity making the commit.

| Committing Tool | Author | Co-authored-by |
| :-------------- | :----- | :------------- |
| Claude | `Claude <noreply@anthropic.com>` | `Co-authored-by: Claude <noreply@anthropic.com>` |
| Codex | `Codex <noreply@openai.com>` | `Co-authored-by: Codex <noreply@openai.com>` |
| Gemini | `Gemini <noreply@google.com>` | `Co-authored-by: Gemini <noreply@google.com>` |
| Qoder | `Qoder <noreply@qoder.com>` | `Co-authored-by: Qoder <noreply@qoder.com>` |
| OpenCode | `OpenCode <opencode@ai.local>` | `Co-authored-by: OpenCode <opencode@ai.local>` |

```sh
git commit -m "<type>(<scope>): <message>" \
  --author="<ToolName> <noreply@xxx.com>" \
  -m "Co-authored-by: <ToolName> <noreply@xxx.com>"
```

### Pull Request Guidelines
- **Title**: Concise, under 70 characters, follows conventional commit format
- **Description**: Use the PR template
  - Link related issues
  - Summarize changes and motivation
  - List verification steps
  - Note breaking changes or migration requirements
- **Screenshots**: Include for UI/CLI changes
- **Tests**: All new features must include tests
- **Documentation**: Update relevant docs in `website/` or inline docstrings

## Diagram Generation (fireworks-tech-graph Skill)

When generating diagrams using the `fireworks-tech-graph` skill, **strictly observe these quality rules**:

### Line & Arrow Quality (CRITICAL - Negative Examples Observed)

- **路径必须连接到形状边界，不能停在半空**: When a path goes from a decision node to a box, the curve must terminate on the target shape boundary, not at an intermediate control point.
  - Wrong: `d="M 594 836 C 520 836 480 836 448 836"` when the target box actually starts at `x=124`
  - Correct: `d="M 588 836 C 420 836 180 836 124 857"` so the endpoint lands on the box edge
- **垂直延伸必须到达下一个形状**: When routing downward with a smooth path, the endpoint must still reach the next shape boundary. Example: from a diamond at `y=1372` to a box at `y=1516`, the path should end at `y=1516`, not stop midway.
- **向上走的 loopback 路径不能在 viewBox 边界截断**: When a path loops upward, keep the entire rounded arc visible inside the viewBox. Do not send a control point or turn above `y=0`.
- **使用圆角路径，不要使用直角折线**: Prefer rounded connectors built with `C` or `Q` commands and `stroke-linejoin="round"`. Avoid Manhattan-style `L` corner chains unless there is no reasonable curved alternative.
- **所有箭头必须完整**: All arrowheads must be fully rendered. The path must extend **at least 15px past** the marker reference point (refX). Truncated arrows are unacceptable.

### Text & Box Sizing (CRITICAL - Negative Examples Observed)

- **文字绝对不能超出框**: Every `<text>` element must fit entirely within its parent `<rect>`. This is non-negotiable.
  - Box width must be **at least 2x the text width** (measured in px at the given font-size), not 1.5x
  - Add horizontal padding of **at least 30px** inside the box (not 20px)
  - If a label is 100px wide in a 12px font, the box must be at least 230px wide
- **手动设置 text-anchor**: Always set `text-anchor="middle"` for centered labels and position `x` at the box center.
- **文字换行**: For multi-word labels, use `<tspan>` for line breaks, or split into separate `<text>` elements. Never let text overflow the box boundary.

### Coordinate & Spacing Rules

- **节点间距 ≥ 80px**: Minimum 80px between node edges (increased from 60px) for proper arrow routing.
- **对齐网格**: Snap node centers to 120px horizontal intervals and 80px vertical intervals.
- **Group padding**: Add `transform="translate(x, y)"` to `<g>` groups, never hardcode absolute coordinates on child elements.

### Visual Style

- **简约风格优先**: Prefer a clean documentation style with white background, subtle gray containers, and one restrained accent color for arrows.
- **避免装饰性视觉元素**: No drop shadows, gradients, icons, or heavy fills unless the user explicitly asks for them.
- **圆角节点**: Use rounded rectangles and soft container corners so the visual language matches the rounded connectors.

### Output Format

- **只生成 SVG**: Always output the `.svg` file only. Do NOT run `rsvg-convert` or generate PNG files.
- **SVG 直接可用**: The SVG must be valid, openable in browsers, and have correct `viewBox`, `xmlns`, and embedded styles.
- **字体嵌入**: Use `<style>` with inline font-family (no `@import`) for cross-browser compatibility.

### Example of Correct vs Incorrect Sizing

```xml
<!-- WRONG: text overflows box — THIS CAUSES VISUAL GLITCHES -->
<rect x="0" y="0" width="80" height="30"/>
<text x="40" y="20" font-size="12">A very long label</text>

<!-- CORRECT: box is 2x wider than text, proper padding -->
<rect x="0" y="0" width="240" height="50" rx="6"/>
<text x="120" y="29" text-anchor="middle" font-size="12">A very long label</text>
```

### Quality Checklist Before Saving

- [ ] All arrows have complete arrowheads with sufficient path extension past refX
- [ ] No text element overflows its parent box
- [ ] All connecting lines have adequate length (not truncated due to space constraints)
- [ ] Loopback paths stay within viewBox bounds
- [ ] Box padding is at least 30px horizontal
- [ ] Connector turns are rounded; no hard right-angle corners remain
- [ ] Overall look stays minimal and documentation-friendly

### Output

- Default output: `./images/[derived-name].svg` in the current working directory.
- Custom path: user specifies with `--output /path/`.
