# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

`hello-olleh` is a source-backed analysis workspace for AI Coding CLI tools. It combines:

- Upstream source snapshots used as analysis input
- Generated analysis chapters in `hello-*` directories
- A Jekyll-based GitHub Pages site in `pages/`
- A PDF ebook pipeline driven from the built site

**Current upstream versions:**
- Claude Code: v2.1.87 (decompiled snapshot)
- Codex: rust-v0.118.0
- Gemini CLI: v0.36.0
- OpenCode: v1.3.2

The current published site uses an editorial / newspaper-like visual system rather than a default docs theme. When editing `pages/`, preserve that direction unless the task explicitly asks for a redesign.

## Primary Directories

| Path | Purpose |
|------|---------|
| `claude-code/`, `codex/`, `gemini-cli/`, `opencode/` | Upstream source snapshots; usually treat as read-only vendor trees |
| `hello-claude-code/`, `hello-codex/`, `hello-gemini-cli/`, `hello-opencode/` | Structured analysis output |
| `hello-harness/` | Harness Engineering framework analysis |
| `prompts/` | Generator / evaluator prompts and analysis briefs |
| `pages/` | Jekyll site layouts, CSS, homepage, scripts |
| `pages/scripts/` | PDF generation and site utility scripts |
| `.github/` | CI workflows and Copilot instructions |

## Site and Build Commands

Run site commands from `pages/`:

```bash
# Local preview
cd pages && npm run serve

# Production build
cd pages && npm run build

# Generate combined PDF ebook
cd pages && npm run pdf
```

Important details:

- `pages/_config.yml` sets `source: ..`, so Jekyll builds from the repository root while using `pages/_layouts/`.
- Built output goes to `pages/_site/`.
- Site URL is `https://feuyeux.github.io/hello-olleh/`.
- Base URL is `/hello-olleh`.

## Pages Architecture

The active presentation layer is centered on:

- `pages/_layouts/default.html`: site shell, navigation, Mermaid bootstrap
- `pages/_layouts/content.html`: long-form content-page wrapper
- `pages/index.md`: homepage content and section structure
- `pages/style.css`: global design system and responsive behavior

Use `{{ '...' | relative_url }}` for internal site links and assets. Do not hardcode `/hello-olleh/` into page templates unless the file already requires it for a specific reason.

## Analysis Workflow

1. Read the relevant source under `claude-code/`, `codex/`, `gemini-cli/`, or `opencode/`.
2. Use `prompts/hello.txt` as the baseline analysis brief.
3. Write or revise the analysis in the matching `hello-*` directory.
4. Follow existing filename conventions such as `01-architecture.md`, `10-session-resume.md`, `28-ghost-snapshot.md`, or `38-mainline-index.md`.
5. If the change affects how the content is presented on the site or in PDF, validate from `pages/`.

### Analysis Document Expectations

- Markdown with clear sectioning and source-backed claims
- Mermaid diagrams for key flows, using the neutral theme
- Key function lists per module where appropriate
- Concrete file-path references with line numbers when citing code
- Chapter structure that stays aligned with the surrounding directory conventions

## Important Rules

- Do not modify vendored upstream code unless the task explicitly requires it.
- Prefer editing `hello-*` outputs over changing source snapshots.
- If you change `pages/`, keep the editorial layout system coherent across homepage and content pages.
- Known non-blocking Jekyll warnings currently come from `openclaw/docs/start/showcase.md`; do not treat them as regressions unless you touched that area.
- If you make a commit, use the correct repository identity:

```bash
git commit -m "<type>: <message>" \
  --author="Claude <noreply@anthropic.com>" \
  -m "Co-authored-by: Claude <noreply@anthropic.com>"
```

## Practical Defaults

- Start with `README.md`, `AGENTS.md`, and `prompts/hello.txt`.
- Check `git status --short` before and after edits.
- Use `rg --files hello-*` or `rg -n` to navigate the analysis corpus quickly.
- When updating documentation instructions, keep `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md` aligned.
