# Gemini CLI Project Context (hello-olleh)

This repository is a meta-workspace for source-backed analysis of AI Coding CLI systems. It is not the product code for a single CLI; it is the research, documentation, and publishing workspace around several CLIs.

## Current Scope

- **Claude Code:** `claude-code/` source snapshot and `hello-claude-code/` analysis
- **OpenAI Codex:** `codex/` source snapshot and `hello-codex/` analysis
- **Gemini CLI:** `gemini-cli/` source snapshot and `hello-gemini-cli/` analysis
- **OpenCode:** `opencode/` source snapshot and `hello-opencode/` analysis
- **Harness Framework:** `hello-harness/` synthesis and comparison framework
- **Pages Site:** `pages/` Jekyll presentation layer for homepage, chapter browsing, and PDF export

**Current upstream versions:**
- Claude Code: v2.1.87 (decompiled snapshot)
- Codex: rust-v0.118.0
- Gemini CLI: v0.36.0
- OpenCode: v1.3.2

## Workspace Model

- **Vendored upstreams:** Use as analysis inputs. Treat them as read-only unless the task explicitly requires a source-level change and validation inside that upstream.
- **Analysis directories (`hello-*`):** Primary authoring targets. These contain structured Markdown chapters and indexes.
- **Publishing layer (`pages/`):** Jekyll site with a custom editorial / newspaper-inspired visual design. Changes here affect the public browsing experience and PDF output.
- **Root instructions:** `README.md`, `AGENTS.md`, and `prompts/hello.txt` define scope, repository rules, and the baseline analysis brief.

## Practical Workflow

1. Read the relevant upstream source with fast text search.
2. Map the architecture or execution flow you need to explain.
3. Write or revise source-backed Markdown in the corresponding `hello-*` directory.
4. If the task affects site presentation, update `pages/` and validate from there.

## Conventions

- Follow existing ordered prefix patterns such as `01-architecture.md`, `06-extension-mcp.md`, `25-input-command-queue.md`, or `38-mainline-index.md`.
- Keep sections concrete and evidence-driven.
- Match the language already used in the target directory or file.
- Preserve Mermaid diagrams and code references unless the task requires revising them.

## Key Commands

- `git status --short`: inspect current workspace state
- `rg --files hello-*`: list analysis files quickly
- `bash ./sync_repos.sh`: refresh upstream clones
- `cd pages && npm run serve`: local site preview
- `cd pages && npm run build`: Jekyll production build
- `cd pages && npm run pdf`: generate the combined PDF ebook

## Pages-Specific Notes

- Jekyll is configured from `pages/_config.yml` with `source: ..`, so the site renders content from the repository root.
- The active visual shell lives mainly in `pages/_layouts/default.html`, `pages/_layouts/content.html`, `pages/index.md`, and `pages/style.css`.
- Preserve `relative_url` usage for internal links.
- A successful build may still show pre-existing Liquid warnings from `openclaw/docs/start/showcase.md`; treat those as unrelated unless you touched that content.

## Agent Mandates

- Prioritize changes in `hello-*` and `pages/` over edits to vendored source trees.
- Avoid committing accidental snapshot drift or sync noise.
- Re-check `AGENTS.md` before major edits so repository-wide rules stay aligned.
- If Gemini makes a commit, use:

```bash
git commit -m "<type>: <message>" \
  --author="Gemini <noreply@google.com>" \
  -m "Co-authored-by: Gemini <noreply@google.com>"
```
