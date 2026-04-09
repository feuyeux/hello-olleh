# Repository Guidelines

## Project Structure & Module Organization
`hello-olleh` is a comparison-and-analysis workspace for AI Coding CLI projects. The primary upstream source snapshots are `claude-code/`, `codex/`, `gemini-cli/`, and `opencode/`; treat them as vendor trees unless a task explicitly requires source edits inside one of them. The main authored output lives in `hello-claude-code/`, `hello-codex/`, `hello-gemini-cli/`, `hello-opencode/`, and `hello-harness/`, where analysis is split into topic-focused Markdown chapters.

**Current upstream versions:**
- Claude Code: v2.1.87 (decompiled snapshot)
- Codex: rust-v0.118.0
- Gemini CLI: v0.36.0
- OpenCode: v1.3.2

`pages/` contains the Jekyll-based GitHub Pages site. The site is built from the repo root via `pages/_config.yml` with `source: ..`, so content in `hello-*` is rendered into the site without being copied into `pages/`. The active presentation layer is concentrated in `pages/_layouts/default.html`, `pages/_layouts/content.html`, `pages/index.md`, and `pages/style.css`; those files currently define an editorial / newspaper-inspired reading experience. Root files remain lightweight: [`README.md`](README.md) records scope and upstream versions, [`prompts/hello.txt`](prompts/hello.txt) defines the baseline analysis brief, and [`sync_repos.sh`](sync_repos.sh) refreshes local clones.

PDF ebook generation is automated by `.github/workflows/ebook.yml` and can also be run locally through the `pages/` package scripts.

## Build, Test, and Development Commands
There is no single monorepo build. Use the command that matches the area you changed.

- `bash ./sync_repos.sh`: clone or refresh the upstream repositories listed in the script.
- `git status --short`: confirm your change set is limited to the intended docs, pages, or snapshot updates.
- `rg --files hello-*`: list generated analysis files before adding a new note or index.
- `cd pages && npm run serve`: run the local Jekyll preview server.
- `cd pages && npm run build`: build the GitHub Pages site into `pages/_site`.
- `cd pages && npm run pdf`: generate the combined PDF ebook from the built site.

If you edit code inside a vendored repo, run that repo's native checks from its own directory and record the exact command in your PR or task summary.

## Coding Style & Naming Conventions
Prefer short, source-backed Markdown sections with concrete headings. Follow existing filename patterns with ordered prefixes such as `01-architecture.md`, `06-context-and-memory.md`, `28-ghost-snapshot.md`, or `38-mainline-index.md`. Keep one major topic per file and place new notes in the matching `hello-*` directory. Preserve the language already used in the file or folder you edit instead of mixing styles casually.

For `pages/` work, preserve the current editorial visual direction instead of reverting to generic documentation styling. Use the existing layouts and CSS tokens, keep `relative_url`-based links intact, and remember that style changes affect both the homepage and all rendered `hello-*` content pages.

## Testing Guidelines
For documentation changes, manually verify headings, relative links, referenced paths, and rendered Mermaid blocks when present. For `pages/` changes, run `cd pages && npm run build` and check that the site still renders with the expected layout and navigation. The current build may emit Liquid warnings from `openclaw/docs/start/showcase.md`; treat them as pre-existing unless your task explicitly touches that area.

There is no root coverage target. For source changes inside `claude-code/`, `codex/`, `gemini-cli/`, or `opencode/`, rely on the upstream project's own lint and test commands and summarize the results in the PR.

## Commit & Pull Request Guidelines
Recent commits use short, imperative English subjects such as `Add Claude Code documentation and resources` or `docs: refresh pages editorial style`. Keep commits focused on one analysis area, one site/theme change, or one snapshot update. PRs should mention the upstream repo and version affected, list changed directories, and note any validation commands you ran. Include screenshots when visual artifacts such as the Pages homepage, content layout, diagrams, or PDF presentation materially changed.

## Commit Identity & Co-Authorship Rules

**Rule: The tool identity that makes the commit MUST match the Co-authored-by.**

### Identity Table

| Committing Tool | Author | Co-authored-by |
|:----------------|:-------|:---------------|
| Claude | `Claude <noreply@anthropic.com>` | `Co-authored-by: Claude <noreply@anthropic.com>` |
| Codex | `Codex <noreply@openai.com>` | `Co-authored-by: Codex <noreply@openai.com>` |
| Gemini | `Gemini <noreply@google.com>` | `Co-authored-by: Gemini <noreply@google.com>` |
| OpenCode | `OpenCode <opencode@ai.local>` | `Co-authored-by: OpenCode <opencode@ai.local>` |

### Commit Template

```bash
git commit -m "<type>: <message>" \
  --author="<ToolName> <noreply@xxx.com>" \
  -m "Co-authored-by: <ToolName> <noreply@xxx.com>"
```

### Examples

```bash
# When Claude makes the commit
git commit -m "docs: update architecture" \
  --author="Claude <noreply@anthropic.com>" \
  -m "Co-authored-by: Claude <noreply@anthropic.com>"

# When Codex makes the commit
git commit -m "docs: update architecture" \
  --author="Codex <noreply@openai.com>" \
  -m "Co-authored-by: Codex <noreply@openai.com>"
```

### Git Config (Repository-level)

```bash
# Set for this repo only (not global)
git config --local user.name "Codex"
git config --local user.email "noreply@openai.com"
```

## Agent Notes
Start with [`README.md`](README.md) and [`prompts/hello.txt`](prompts/hello.txt) before generating new analysis. If the task touches the website, review `pages/_layouts/default.html`, `pages/_layouts/content.html`, `pages/index.md`, and `pages/style.css` before editing. Prefer editing `hello-*` outputs and `pages/` presentation over modifying vendored source trees, and avoid committing sync noise unless the snapshot update is intentional.
