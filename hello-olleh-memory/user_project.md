---
name: user_project
description: User's hello-olleh multi-tool source analysis project
type: user
---

User is a senior software engineer working on **hello-olleh**, a source code analysis workspace for AI Coding CLI tools (Claude Code, Codex, Gemini CLI, OpenCode).

## Project structure
- Upstream source snapshots: `claude-code/`, `codex/`, `gemini-cli/`, `opencode/` (gitignored, read-only)
- Analysis output: `hello-claude-code/`, `hello-codex/`, `hello-gemini-cli/`, `hello-opencode/`
- Jekyll GitHub Pages site at `pages/`, built from `hello-*/` directories

## Analysis conventions
- Chapters numbered NN-topic-slug.md
- OpenCode uses A/B/C prefix convention for chapter categories
- All analysis documents use `layout: content` frontmatter
- Mermaid diagrams use `neutral` theme
- Key insight format: real source code references + line numbers
- Cross-directory comparison sections in each chapter

## Recent work
- Created `hello-opencode/40-effect-ts.md` — Effect-ts DI chapter (Service/Layer/Effect patterns, InstanceState, ManagedRuntime)
- Created `hello-claude-code/27-growthbook.md` — GrowthBook remote feature flag system (tengu_* flags, 4 read APIs, 3-layer overrides)
- Created `hello-opencode/39-durable-state-comparison.md` — Cross-tool state comparison (all 4 tools)
- Created `hello-codex/28-ghost-snapshot.md` — GhostSnapshot mechanism
- Created `hello-claude-code/26b-mcp-deep.md` — MCP deep dive (OAuth/XAA)
- All index files updated to include new chapters

## User preferences (from feedback)
- No summaries at the end of responses
- Concise, direct answers
- Use facts, not filler
