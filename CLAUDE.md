# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`hello-olleh` is a source code analysis workspace for AI Coding CLI tools. It contains:
- Upstream source code snapshots (read-only)
- Generated analysis documents in `hello-*/` directories
- Jekyll-based GitHub Pages site at `pages/`

## Directory Structure

| Path | Purpose |
|------|---------|
| `claude-code/`, `codex/`, `gemini-cli/`, `opencode/` | Upstream source code (read-only) |
| `hello-claude-code/`, `hello-codex/`, `hello-gemini-cli/`, `hello-opencode/` | Analysis output |
| `hello-harness/` | Harness Engineering framework analysis |
| `prompts/` | Generator/evaluator prompts |
| `pages/scripts/` | Build and PDF generation scripts |
| `pages/` | Jekyll/GitHub Pages site (layouts, CSS, content) |
| `.github/workflows/` | GitHub Actions workflows |

## Jekyll/GitHub Pages Commands

All Jekyll commands run from the `pages/` directory:

```bash
# Install dependencies (requires Ruby)
cd pages && bundle install

# Local preview
cd pages && bundle exec jekyll serve

# Build for production
cd pages && bundle exec jekyll build --source . --destination ./_site

# Build with verbose output
cd pages && bundle exec jekyll build --source . --destination ./_site --trace
```

Site URL: `https://feuyeux.github.io/hello-olleh/`
Base URL: `/hello-olleh`

## GitHub Pages Configuration

Jekyll site files are located in `pages/`:
- Layouts: `pages/_layouts/`
- CSS: `pages/style.css`
- Index: `pages/index.md`
- 404: `pages/404.html`
- Config: `pages/_config.yml`

CSS links use `{{ 'style.css' | relative_url }}` for correct base URL resolution.

## Analysis Workflow

1. Read source in `claude-code/`/`codex/`/`gemini-cli/`/`opencode/`
2. Use `prompts/hello.txt` as system prompt template
3. Output analysis to corresponding `hello-*/` directory
4. Follow naming convention: `NN-topic-slug.md` (e.g., `01-architecture.md`)

### Analysis Document Requirements

- Markdown format with clear navigation
- Mermaid diagrams for key flows (use `neutral` theme)
- Key function lists per module
- Code references: `file/path:line-range` format
- Chapters: Architecture → Startup → Core Loop → Tool System → State → Extensibility

## Important Rules

- **Do NOT modify** files in `claude-code/`, `codex/`, `gemini-cli/`, `opencode/`
- **Do NOT commit** to source code subdirectories (they may be in detached HEAD state)
- All analysis output goes to `hello-*/` directories, not source directories
- Upstream repos (codex, gemini-cli, opencode, openclaw, zeroclaw) are gitignored

## Git Ignore

Excluded from version control:
- Jekyll build output: `pages/_site/`, `pages/.jekyll-cache/`, `pages/.sass-cache/`
- Ruby artifacts: `pages/Gemfile.lock`, `pages/.bundle/`, `pages/vendor/`
- IDE files: `.idea/`, `.vscode/`
- System files: `.DS_Store`
- Upstream source: `codex/`, `gemini-cli/`, `opencode/`, etc.
