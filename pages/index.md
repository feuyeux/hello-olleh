---
layout: default
permalink: /
---

<div class="page-wrapper">
  <div class="section-header">
    <h1>Hello AI Coding</h1>
  </div>

  <section>
    <p style="text-align:center">
      <code>hello-olleh</code> 是一个面向 AI Coding 工程的源码阅读与对比分析工作区。
      通过保存上游源码快照和对应的分析产物，深入理解不同工具在启动链路、Agent 调度、工具系统、状态管理与扩展机制上的实现差异。
      本工程采用 Harness Engineering 框架，从可控性工程的视角透视四款主流 AI Coding 工程的源码证据。
    </p>
    <img style="display:block;margin:0 auto" src="{{ 'pages/hello-harness.png' | relative_url }}" alt="Harness Engineering Framework" />
  </section>

  <hr class="section-divider">

  <section>
    <div class="section-header">
      <h2>源代码仓库</h2>
      <p>四个 AI Coding 工程的源码版本、语言栈与源码仓库入口</p>
    </div>
    <div class="source-links">
      <span class="source-link">
        <span class="dot"></span>claude-code (v2.1.87, 反编译版)
      </span>
      <a class="source-link" href="https://github.com/openai/codex.git" target="_blank" rel="noreferrer">
        <span class="dot"></span>codex (rust-v0.118.0)
      </a>
      <a class="source-link" href="https://github.com/google-gemini/gemini-cli.git" target="_blank" rel="noreferrer">
        <span class="dot"></span>gemini-cli.git (v0.36.0)
      </a>
      <a class="source-link" href="https://github.com/anomalyco/opencode.git" target="_blank" rel="noreferrer">
        <span class="dot"></span>opencode.git (v1.3.2)
      </a>
    </div>
  </section>

  <hr class="section-divider">

  <section>
    <div class="section-header">
      <h2>源代码分析</h2>
      <p>五个 hello-* 目录的源码分析文档</p>
    </div>
    <div class="cli-grid">
      <a class="cli-card" href="{{ 'hello-claude-code/' | relative_url }}">
        <span class="chapter-number">01</span>
        <span class="cli-icon">&#x1F537;</span>
        <div>
          <div class="cli-name">Claude Code</div>
          <div class="cli-version">TypeScript / React</div>
        </div>
      </a>
      <a class="cli-card" href="{{ 'hello-codex/' | relative_url }}">
        <span class="chapter-number">02</span>
        <span class="cli-icon">&#x1F536;</span>
        <div>
          <div class="cli-name">OpenAI Codex</div>
          <div class="cli-version">Rust + TypeScript</div>
        </div>
      </a>
      <a class="cli-card" href="{{ 'hello-gemini-cli/' | relative_url }}">
        <span class="chapter-number">03</span>
        <span class="cli-icon">&#x1F7E1;</span>
        <div>
          <div class="cli-name">Gemini CLI</div>
          <div class="cli-version">TypeScript monorepo</div>
        </div>
      </a>
      <a class="cli-card" href="{{ 'hello-opencode/' | relative_url }}">
        <span class="chapter-number">04</span>
        <span class="cli-icon">&#x1F7E2;</span>
        <div>
          <div class="cli-name">OpenCode</div>
          <div class="cli-version">Bun + Effect-ts</div>
        </div>
      </a>
      <a class="cli-card" href="{{ 'hello-harness/' | relative_url }}">
        <span class="chapter-number">05</span>
        <span class="cli-icon">&#x2699;&#xFE0F;</span>
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
