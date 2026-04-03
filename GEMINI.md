# Gemini CLI Project Context (hello-olleh)

This workspace is a meta-repository dedicated to the source-backed analysis and architectural comparison of several AI agent projects.

## Project Overview

- **Purpose:** Analyze and document the inner workings of leading AI agent frameworks to understand their design patterns, lifecycle management, and tool execution strategies.
- **Scope:**
    - **Claude Code:** `claude-code/` (Source) | `hello-claude-code/` (Analysis)
    - **OpenAI Codex:** `codex/` (Source) | `hello-codex/` (Analysis)
    - **Gemini CLI:** `gemini-cli/` (Source) | `hello-gemini-cli/` (Analysis)
    - **OpenCode:** `opencode/` (Source) | `hello-opencode/` (Analysis)

## Workspace Structure

- **Vendored Upstreams:** Local source snapshots of the targeted projects. These should generally be treated as **read-only vendor trees** unless an explicit directive requires source modification or testing.
- **Analysis Directories (`hello-*`):** The primary workspace for contributors. These directories contain structured Markdown files documenting the architectural analysis.
- **Root Documentation:**
    - `README.md`: Records the current versions of upstream snapshots and the project's high-level goal.
    - `AGENTS.md`: Detailed repository guidelines, module organization, and coding standards.

## Development & Analysis Conventions

- **Analysis Workflow:**
    1.  **Research:** Use `grep_search` and `read_file` to explore a vendored project's source code.
    2.  **Strategize:** Map out the architecture (e.g., startup flow, state management, tool system).
    3.  **Execute:** Document findings in the corresponding `hello-*` folder using source-backed sections.
- **Naming & Formatting:**
    - Follow existing ordered prefix patterns for filenames (e.g., `01-repo-shape.md`, `A00-mainline-index.md`).
    - Prefer short, concrete headings and concise sections.
    - Maintain the established language and style of the directory being edited (often bilingual or specifically English/Chinese).
- **Tool Usage:**
    - When analyzing vendored code, use native tools (e.g., `npm` for `claude-code`, `cargo` for `codex`) within their respective subdirectories to verify assumptions or run tests.

## Key Commands

- **List Analysis Files:** `rg --files hello-*`
- **Check Workspace State:** `git status --short`
- **Sync Repositories:** `bash ./sync_repos.sh` (if present, to refresh clones)

## Agent Mandates

- **Focus:** Prioritize updates to the `hello-*` analysis outputs.
- **Integrity:** Avoid committing "sync noise" or accidental changes to the vendored source trees.
- **Documentation:** Always check `AGENTS.md` before initiating a new analysis task for specific stylistic requirements.
