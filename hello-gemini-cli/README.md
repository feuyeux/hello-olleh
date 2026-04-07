---
layout: default
title: "Gemini CLI 源码分析"
---

<section class="hero page-wrapper">
  <p class="hero-kicker">Source Code Analysis</p>
  <h1 class="hero-title">🟡 Gemini CLI</h1>
  <p class="hero-subtitle">基于 Gemini CLI v0.36.0（TypeScript monorepo）源码的深度解析</p>
  <div class="hero-badges">
    <span class="hero-badge"><span class="dot"></span>v0.36.0</span>
  </div>
</section>

<div class="page-wrapper">
  <hr class="section-divider">
  <h2>01-08 主线文档</h2>
  <div class="chapter-grid">
    <a class="chapter-card" href="01-architecture/"><div class="chapter-number">01</div><div class="chapter-title">架构全景：Gemini CLI 的分层模型与核心抽象</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="02-startup-flow/"><div class="chapter-number">02</div><div class="chapter-title">启动链路：从入口到运行模式的分发</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="03-agent-loop/"><div class="chapter-number">03</div><div class="chapter-title">核心执行循环：Agent 决策链与 LLM 调用</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="04-tool-system/"><div class="chapter-number">04</div><div class="chapter-title">工具调用机制：Tool 注册、权限策略与执行闭环</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="05-state-management/"><div class="chapter-number">05</div><div class="chapter-title">状态管理：会话持久化与并发控制</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="06-extension-mcp/"><div class="chapter-number">06</div><div class="chapter-title">扩展性：MCP 与扩展机制的加载与隔离</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="07-error-security/"><div class="chapter-number">07</div><div class="chapter-title">错误处理与安全性：Agent 的自愈与边界防护</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="08-performance/"><div class="chapter-number">08</div><div class="chapter-title">性能与代码质量：大仓库处理与架构评估</div><span class="chapter-arrow">&#8599;</span></a>
  </div>

  <h2>09-17 共享主题补齐</h2>
  <div class="chapter-grid">
    <a class="chapter-card" href="09-observability/"><div class="chapter-number">09</div><div class="chapter-title">可观测性：日志、MessageBus 与 UI 状态追踪</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="10-session-resume/"><div class="chapter-number">10</div><div class="chapter-title">会话恢复：Session 持久化与历史重建</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="11-context-management/"><div class="chapter-number">11</div><div class="chapter-title">上下文管理：消息预算、工具输出与循环检测</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="12-prompt-system/"><div class="chapter-number">12</div><div class="chapter-title">Prompt 系统：PromptProvider 与上下文组装</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="13-multi-agent/"><div class="chapter-number">13</div><div class="chapter-title">多代理与远程：本地子代理、A2A 远程代理与调度器</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="14-skill-system/"><div class="chapter-number">14</div><div class="chapter-title">Skill 系统：Markdown 定义与 Prompt 注入</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="15-plugin-system/"><div class="chapter-number">15</div><div class="chapter-title">插件系统：MCP 集成与信任校验</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="16-memory-system/"><div class="chapter-number">16</div><div class="chapter-title">Memory 系统：UserMemory 与项目上下文</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="17-sdk-transport/"><div class="chapter-number">17</div><div class="chapter-title">SDK 与传输：GeminiClient 与 Headless 模式</div><span class="chapter-arrow">&#8599;</span></a>
  </div>

  <hr class="section-divider">
  <h2>阅读顺序</h2>
  <p>
    建议先读 <a href="01-architecture/">01</a> 到 <a href="08-performance/">08</a>，
    先把"架构 - 启动 - Agent 循环 - 工具系统 - 状态管理 - MCP 扩展 - 错误处理 - 性能"这条主线打通；
    再读 <a href="09-observability/">09</a> 到 <a href="17-sdk-transport/">17</a>，
    补齐可观测性、会话恢复、上下文管理、Prompt 系统、多代理、Skill、插件、Memory 和 SDK 传输等主题。
  </p>

  <h2>核心心智模型</h2>
  <p>
    把 Gemini CLI 看成"以 Config 为中心、围绕 Turn.run() 事件流构建的 TypeScript monorepo"。
    Config 是组合根；Turn.run() 是事件生成器；Scheduler 是工具编排器；PolicyEngine 是权限闸门；
    GeminiClient 是模型适配器；McpClientManager 是扩展桥梁。
  </p>

  <h2>共享主题对照</h2>
  <p>
    如果要把 Gemini CLI 与另外三套文档横着对读，优先对照
    <a href="09-observability/">09</a>、
    <a href="10-session-resume/">10</a>、
    <a href="11-context-management/">11</a>、
    <a href="12-prompt-system/">12</a>、
    <a href="16-memory-system/">16</a>。
    这五篇分别补齐了"可观测性""session/resume""context""prompt""memory"五个在原主线里相对分散、
    但在 Claude Code / Codex / OpenCode 中都很显式的主题。
  </p>
</div>

<footer class="site-footer page-wrapper">
  <div class="footer-links">
    <a href="https://github.com/feuyeux/hello-olleh">GitHub</a>
    <a href="/hello-olleh/">返回首页</a>
  </div>
</footer>
