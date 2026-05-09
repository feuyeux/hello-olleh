---
name: github-pages-link-fix
description: Fix hardcoded /hello-olleh/ baseurl links in index.md files
type: project
---

# GitHub Pages 链接修复方案

## 问题

5 个 `hello-*/index.md` 导航页的 footer 中的"返回首页"链接使用硬编码 `href="/hello-olleh/"`，导致本地预览时链接失效。

## 修复方案

将所有硬编码链接改为 Liquid 模板语法：

```diff
- <a href="/hello-olleh/">返回首页</a>
+ <a href="{{ '/' | relative_url }}">返回首页</a>
```

## 涉及文件

| 文件 | 行号 |
|------|------|
| `hello-claude-code/index.md` | 60 |
| `hello-codex/index.md` | 59 |
| `hello-gemini-cli/index.md` | 58 |
| `hello-opencode/index.md` | 86 |
| `hello-harness/index.md` | 44 |

## 验证

修复后：
- 本地预览（`baseurl: ""`）→ `/` ✅
- GitHub Pages（`baseurl: "/hello-olleh"`）→ `/hello-olleh/` ✅