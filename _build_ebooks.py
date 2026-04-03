#!/usr/bin/env python3
"""
Build merged markdown source files for 5 ebooks from hello-olleh content.
Usage: python _build_ebooks.py [--epub]
Requires: pandoc (for PDF/EPUB output)
"""

import os
import re
import argparse
from pathlib import Path

BASE = Path(__file__).parent

BOOKS = [
    {
        "id": "harness",
        "title": "Harness Engineering 框架",
        "subtitle": "AI Coding CLI 源码分析：前馈与反馈、计算型与推断型",
        "author": "feuyeux",
        "dir": BASE / "hello-harness",
        "files": [
            "01-framework",
            "02-control-plane",
            "03-feedforward-controls",
            "04-feedback-controls",
            "05-tool-governance",
            "06-context-and-memory",
            "07-harnessability",
            "08-entropy-management",
            "09-multi-agent-verification",
            "10-human-steering",
            "11-extensibility",
            "12-synthesis",
        ],
        "exclude_ko": True,
    },
    {
        "id": "claude-code",
        "title": "Claude Code 源码深度解析",
        "subtitle": "基于 Claude Code v2.1.87（反编译版）",
        "author": "feuyeux",
        "dir": BASE / "hello-claude-code",
        "files": [
            "01-architecture",
            "02-startup-flow",
            "03-repl-and-state",
            "04-state-management",
            "05-input-command-queue",
            "06-query-and-request",
            "07-context-management",
            "08-tools-and-permissions",
            "09-extension-skills-plugins-mcp",
            "10-mcp-system",
            "11-hooks-lifecycle-and-runtime",
            "12-settings-policy-and-env",
            "13-session-storage-and-resume",
            "14-prompt-system",
            "15-memory-system",
            "16-performance-cache-context",
            "17-queryengine-sdk",
            "18-api-provider-retry-errors",
            "19-transport-system",
            "20-bridge-system",
            "21-agents-tasks-remote",
        ],
        "exclude_ko": False,
    },
    {
        "id": "codex",
        "title": "OpenAI Codex 源码深度解析",
        "subtitle": "基于 Codex rust-v0.119.0-alpha.5",
        "author": "feuyeux",
        "dir": BASE / "hello-codex",
        "files": [
            "01-repo-shape",
            "02-architecture",
            "03-startup-and-runtime",
            "04-agent-loop",
            "05-tool-system",
            "06-thread-state-and-protocol",
            "07-packaging-sdk-and-shell-layer",
            "08-extension-mcp",
            "09-error-security",
            "10-performance",
            "11-project-init-analysis",
        ],
        "exclude_ko": False,
    },
    {
        "id": "gemini-cli",
        "title": "Gemini CLI 源码深度解析",
        "subtitle": "基于 Gemini CLI v0.37.0-preview.1",
        "author": "feuyeux",
        "dir": BASE / "hello-gemini-cli",
        "files": [
            "01-architecture",
            "02-startup-flow",
            "03-agent-loop",
            "04-tool-system",
            "05-state-management",
            "06-extension-mcp",
            "07-error-security",
            "08-performance",
        ],
        "exclude_ko": False,
    },
    {
        "id": "opencode",
        "title": "OpenCode 源码深度解析",
        "subtitle": "基于 OpenCode v1.3.2（Bun + Effect-ts）",
        "author": "feuyeux",
        "dir": BASE / "hello-opencode",
        "files": [
            "01-architecture",
            "02-startup-flow",
            "03-agent-loop",
            "04-tool-system",
            "05-state-management",
            "06-extension-mcp",
            "07-error-security",
            "08-performance",
            "10-mainline-index",
            "11-entry-transports",
            "12-server-routing",
            "13-prompt-compilation",
            "14-session-loop",
            "15-stream-processor",
            "16-llm-request",
            "17-durable-state",
            "20-model",
            "21-context",
            "22-orchestration",
            "23-resilience",
            "24-infra",
            "25-observability",
            "26-lsp",
            "27-startup-config",
            "28-extension-surface",
            "29-skill-system",
            "30-worktree-sandbox",
            "31-memory",
            "32-mcp",
            "33-design-philosophy",
            "34-prompt-diff",
            "35-debugging",
            "36-plugin-system",
            "37-project-init-analysis",
        ],
        "exclude_ko": False,
    },
]


def strip_frontmatter(text):
    """Remove Jekyll YAML frontmatter."""
    if text.startswith("---"):
        end = text.find("\n---\n", 4)
        if end != -1:
            return text[end + 5 :]
        end = text.find("\n---")
        if end != -1:
            return text[end + 4 :]
    return text


def strip_html(text):
    """Remove raw HTML comment and HTML-like content from body."""
    text = re.sub(r"<!--[\s\S]*?-->", "", text)
    text = re.sub(r"<div class=\"hero[\\s\S]*?</div>", "", text)
    text = re.sub(r"<footer[\s\S]*?</footer>", "", text)
    return text


def clean_markdown(text):
    """Remove Jekyll Liquid tags and HTML remnants."""
    text = re.sub(r"{%[\s\S]*?%}", "", text)
    text = re.sub(r"\{\{[\s\S]*?\}\}", "", text)
    return text


def extract_h1(text):
    """Extract first # heading from markdown text."""
    m = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    return m.group(1).strip() if m else None


def file_title(path):
    """Extract title from file path or content."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        fm_stripped = strip_frontmatter(content)
        h1 = extract_h1(fm_stripped)
        if h1:
            return h1
    except Exception:
        pass
    return path.stem.replace("-", " ").replace("_", " ")


def build_book(book):
    """Build merged markdown for one book."""
    lines = []
    lines.append(f"% {book['title']}")
    lines.append(f"% {book['subtitle']}")
    lines.append(f"% {book['author']}")
    lines.append("")
    lines.append(f"# {book['title']}")
    lines.append("")
    lines.append(f"*{book['subtitle']}*")
    lines.append("")
    lines.append("---")
    lines.append("")

    dir_path = book["dir"]

    for i, file_key in enumerate(book["files"]):
        md_file = dir_path / f"{file_key}.md"
        if not md_file.exists():
            print(f"  SKIP (not found): {md_file}")
            continue

        with open(md_file, "r", encoding="utf-8") as f:
            raw = f.read()

        # Skip HTML-only index pages
        if "<div class=" in raw or "<section" in raw:
            print(f"  SKIP (HTML): {md_file.name}")
            continue

        # Skip _ko files
        if book.get("exclude_ko") and "_ko" in md_file.name:
            print(f"  SKIP (_ko): {md_file.name}")
            continue

        content = strip_frontmatter(raw)
        content = clean_markdown(content).strip()
        if not content:
            continue

        # Remove mdxlint comments at top
        content = re.sub(r"^<!-- markdownlint[\s\S]*?-->\n", "", content)

        # Extract heading
        h1 = extract_h1(content)
        if h1 and h1 != book["title"]:
            # Normalize heading format
            chapter_num = i + 1
            lines.append(f"\n## {h1}\n")
        else:
            lines.append(f"\n## Chapter {i + 1}: {file_key}\n")

        lines.append(content)
        lines.append("")
        print(f"  + {md_file.name}")

    out_path = BASE / f"{book['id']}.md"
    final = "\n".join(lines)
    # Clean up duplicate/adjacent headings
    final = re.sub(r"\n{3,}", "\n\n", final)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(final)
    print(f"  => {out_path.name} ({len(final)} chars)")
    return out_path


def main():
    parser = argparse.ArgumentParser(description="Build ebook markdown sources")
    parser.add_argument("--books", nargs="+", default=["harness", "claude-code", "codex", "gemini-cli", "opencode"],
                        help="Book IDs to build (default: all)")
    args = parser.parse_args()

    book_map = {b["id"]: b for b in BOOKS}
    for bid in args.books:
        if bid not in book_map:
            print(f"Unknown book: {bid}")
            continue
        book = book_map[bid]
        print(f"\nBuilding {book['title']}...")
        build_book(book)

    print("\n\nDone. To generate PDF/EPUB, install pandoc then run:")
    print("  pandoc harness.md -o harness.epub --epub-chapter-level=2 --toc")
    print("  pandoc claude-code.md -o claude-code.epub --epub-chapter-level=2 --toc")
    print("  pandoc codex.md -o codex.epub --epub-chapter-level=2 --toc")
    print("  pandoc gemini-cli.md -o gemini-cli.epub --epub-chapter-level=2 --toc")
    print("  pandoc opencode.md -o opencode.epub --epub-chapter-level=2 --toc")
    print("\nFor PDF: add '--pdf-engine=xelatex' (requires TeX Live/MiKTeX)")


if __name__ == "__main__":
    main()
