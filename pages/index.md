---
layout: default
permalink: /
---

<div class="page-wrapper">
  <section class="front-hero">
    <p class="front-kicker">Source Intelligence Review · 2026</p>
    <div class="front-masthead">
      <span>Hello</span>
      <span>AI Coding</span>
    </div>
    <p class="front-deck">
      <code>hello-olleh</code> 把 AI Coding CLI 的源码快照、专题分析和 Harness Engineering 框架研究
      组织成一份可翻阅的工程档案报，适合按主题、按仓库、按执行链路反复对照阅读。
    </p>
    <div class="front-meta">
      <span>4 个上游工程</span>
      <span>5 个专题入口</span>
      <span>源码快照 + 分析长文 + PDF ebook</span>
    </div>
  </section>

  <section class="front-grid">
    <article class="lead-story">
      <p class="story-kicker">Cover Story</p>
      <h1>把 AI Coding CLI 当作一张可以拆开的系统蓝图来阅读</h1>
      <p>
        这里不是产品说明页，而是工程版面。重点不在“它能做什么”，而在“它内部怎样跑起来”：
        从启动入口、Agent 决策链、Prompt 组装，到工具执行闭环、状态持久化、MCP 扩展与安全边界。
      </p>
      <p>
        你可以先从 Harness Engineering 读一遍总论，再去四个仓库的专题区横向比较；
        也可以直接跳进某个工程，像翻技术周刊一样连续浏览章节卡片。
      </p>
      <div class="lead-actions">
        <a class="editor-link" href="{{ 'hello-harness/' | relative_url }}">阅读 Harness 专刊</a>
        <a class="editor-link subtle" href="https://github.com/feuyeux/hello-olleh" target="_blank" rel="noreferrer">查看 GitHub 仓库</a>
      </div>
    </article>

    <aside class="news-briefs">
      <article class="brief-card">
        <p class="brief-label">Edition</p>
        <h2>分析对象</h2>
        <p>Claude Code、Codex、Gemini CLI、OpenCode，加上一份 Harness Engineering 综合框架。</p>
      </article>
      <article class="brief-card">
        <p class="brief-label">Method</p>
        <h2>阅读方式</h2>
        <p>保持上游快照不动，主要在 <code>hello-*</code> 目录沉淀结构化分析与可追溯证据。</p>
      </article>
      <article class="brief-card">
        <p class="brief-label">Output</p>
        <h2>交付形态</h2>
        <p>网页、Markdown 长文与 PDF ebook 共用一套内容骨架，便于在线读和离线归档。</p>
      </article>
    </aside>
  </section>

  <figure class="editorial-figure">
    <img src="{{ 'pages/hello-harness.png' | relative_url }}" alt="Harness Engineering Framework" />
    <figcaption>Harness Engineering Framework 作为总框架，用来统一解读四类 AI Coding 工程中的控制面、反馈面与扩展面。</figcaption>
  </figure>

  <section class="ticker-row">
    <span>Startup Flow</span>
    <span>Agent Loop</span>
    <span>Prompt System</span>
    <span>Tool Governance</span>
    <span>Context & Memory</span>
    <span>MCP / Plugin</span>
    <span>Sandbox & Approval</span>
    <span>Observability</span>
  </section>

  <hr class="section-divider">

  <section>
    <div class="section-header">
      <p class="section-kicker">Repository Desk</p>
      <h2>本期源码版图</h2>
      <p>版本、语言栈和资料来源，按报纸资料栏的方式整理。</p>
    </div>
    <div class="source-links">
      <span class="source-link">
        <span class="source-label">Claude Code</span>
        <span class="source-meta">TypeScript / React · v2.1.87 · 反编译版</span>
      </span>
      <a class="source-link" href="https://github.com/openai/codex.git" target="_blank" rel="noreferrer">
        <span class="source-label">OpenAI Codex</span>
        <span class="source-meta">Rust + TypeScript · rust-v0.118.0</span>
      </a>
      <a class="source-link" href="https://github.com/google-gemini/gemini-cli.git" target="_blank" rel="noreferrer">
        <span class="source-label">Gemini CLI</span>
        <span class="source-meta">TypeScript monorepo · v0.36.0</span>
      </a>
      <a class="source-link" href="https://github.com/anomalyco/opencode.git" target="_blank" rel="noreferrer">
        <span class="source-label">OpenCode</span>
        <span class="source-meta">Bun + Effect-ts · v1.3.2</span>
      </a>
    </div>
  </section>

  <hr class="section-divider">

  <section>
    <div class="section-header">
      <p class="section-kicker">Reading Rooms</p>
      <h2>五个专题入口</h2>
      <p>每个入口都是一组“专刊”，继续点进去就是分主题的章节卡片。</p>
    </div>
    <div class="cli-grid">
      <a class="cli-card" href="{{ 'hello-claude-code/' | relative_url }}">
        <span class="chapter-number">01</span>
        <div>
          <div class="cli-name">Claude Code</div>
          <div class="cli-version">TypeScript / React</div>
        </div>
      </a>
      <a class="cli-card" href="{{ 'hello-codex/' | relative_url }}">
        <span class="chapter-number">02</span>
        <div>
          <div class="cli-name">OpenAI Codex</div>
          <div class="cli-version">Rust + TypeScript</div>
        </div>
      </a>
      <a class="cli-card" href="{{ 'hello-gemini-cli/' | relative_url }}">
        <span class="chapter-number">03</span>
        <div>
          <div class="cli-name">Gemini CLI</div>
          <div class="cli-version">TypeScript monorepo</div>
        </div>
      </a>
      <a class="cli-card" href="{{ 'hello-opencode/' | relative_url }}">
        <span class="chapter-number">04</span>
        <div>
          <div class="cli-name">OpenCode</div>
          <div class="cli-version">Bun + Effect-ts</div>
        </div>
      </a>
      <a class="cli-card" href="{{ 'hello-harness/' | relative_url }}">
        <span class="chapter-number">05</span>
        <div>
          <div class="cli-name">Harness Engineering</div>
          <div class="cli-version">综合分析4个 AI Coding 工程</div>
        </div>
      </a>
    </div>
  </section>

</div>

<footer class="site-footer page-wrapper">
  <div class="footer-links">
    <a href="https://github.com/feuyeux/hello-olleh">GitHub</a>
    <a href="{{ 'hello-harness/' | relative_url }}">Harness 框架</a>
    <a href="{{ 'hello-claude-code/' | relative_url }}">Claude Code</a>
    <a href="{{ 'hello-codex/' | relative_url }}">Codex</a>
    <a href="{{ 'hello-gemini-cli/' | relative_url }}">Gemini CLI</a>
    <a href="{{ 'hello-opencode/' | relative_url }}">OpenCode</a>
  </div>
  <p>Hello AI Coding &middot; AI Coding 工程源码分析 &middot; 2026</p>
</footer>
