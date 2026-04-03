# Repository Guidelines

## Project Structure & Module Organization
`claude-code/`, `codex/`, `gemini-cli/`, and `opencode/` are local upstream source snapshots used as analysis inputs. Treat them as vendor trees unless a task explicitly requires source edits. The `hello-claude-code/`, `hello-codex/`, `hello-gemini-cli/`, and `hello-opencode/` folders hold generated Markdown analysis and should receive most contributor changes. Root files are lightweight: [`README.md`](README.md) records scope and upstream versions, [`hello.txt`](hello.txt) defines the analysis brief, and [`sync_repos.sh`](sync_repos.sh) refreshes local clones.

## Build, Test, and Development Commands
There is no single root build or test pipeline. Use repository-level utility commands instead:

- `bash ./sync_repos.sh`: clone or refresh the upstream repositories listed in the script.
- `git status --short`: confirm your change set is limited to the intended docs or snapshots.
- `rg --files hello-*`: list generated analysis files quickly before adding a new note.

If you edit code inside a vendored repo, run that repo's native checks from its own directory and record the exact command in your PR.

## Coding Style & Naming Conventions
Prefer short, source-backed Markdown sections with concrete headings. Follow existing filename patterns with ordered prefixes, for example `01-repo-shape.md`, `06-final-mental-model.md`, or `A00-mainline-index.md`. Keep one major topic per file and place new notes in the matching `hello-*` directory. Preserve the language already used in the file or folder you edit instead of mixing styles casually.

## Testing Guidelines
For documentation changes, manually verify headings, relative links, referenced paths, and rendered Mermaid blocks when present. There is no root coverage target. For source changes inside `claude-code/`, `codex/`, `gemini-cli/`, or `opencode/`, rely on the upstream project's own lint and test commands and summarize the results in the PR.

## Commit & Pull Request Guidelines
Recent commits use short, imperative English subjects such as `Add Claude Code documentation and resources`. Keep commits focused on one analysis area or one snapshot update. PRs should mention the upstream repo and version affected, list changed directories, and note any validation commands you ran. Include screenshots only when visual artifacts such as diagrams or rendered docs materially changed.

## Agent Notes
Start with the root [`README.md`](README.md) and [`hello.txt`](hello.txt) before generating new analysis. Prefer editing `hello-*` outputs over modifying vendored source trees, and avoid committing sync noise unless the snapshot update is intentional.
