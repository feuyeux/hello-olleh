---
layout: default
title: "OpenCode 源码分析"
---

<section class="hero page-wrapper">
  <p class="hero-kicker">Source Code Analysis</p>
  <h1 class="hero-title">🟢 OpenCode</h1>
  <p class="hero-subtitle">基于 OpenCode v1.3.2（Bun + Effect-ts）源码的分层阅读索引</p>
  <div class="hero-badges">
    <span class="hero-badge"><span class="dot"></span>v1.3.2</span>
  </div>
</section>

<div class="page-wrapper">
  <hr class="section-divider">

  <h2>01-08 核心总览</h2>
  <div class="chapter-grid">
    <a class="chapter-card" href="01-architecture/"><div class="chapter-number">01</div><div class="chapter-title">架构全景：目录结构、分层模型与核心抽象</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="02-startup-flow/"><div class="chapter-number">02</div><div class="chapter-title">启动链路：多表面入口如何收束到同一套 server contract</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="03-agent-loop/"><div class="chapter-number">03</div><div class="chapter-title">核心执行循环：`prompt -&gt; loop -&gt; processor -&gt; llm`</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="04-tool-system/"><div class="chapter-number">04</div><div class="chapter-title">工具系统：注册、权限控制、执行闭环与写回</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="05-state-management/"><div class="chapter-number">05</div><div class="chapter-title">状态管理：Durable State、并发占位与历史回放</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="06-extension-mcp/"><div class="chapter-number">06</div><div class="chapter-title">扩展系统：MCP、Plugin、Skill 与新增工具接入点</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="07-error-security/"><div class="chapter-number">07</div><div class="chapter-title">错误处理与安全性：重试、自愈、认证与权限边界</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="08-performance/"><div class="chapter-number">08</div><div class="chapter-title">性能与代码质量：流式传输、SSE 与架构代价</div><span class="chapter-arrow">&#8599;</span></a>
  </div>

  <h2>09-20 共享主题（与 Claude Code / Codex / Gemini CLI 对齐）</h2>
  <div class="chapter-grid">
    <a class="chapter-card" href="09-observability/"><div class="chapter-number">09</div><div class="chapter-title">可观测性：日志、Bus 事件与运行时状态追踪</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="10-session-resume/"><div class="chapter-number">10</div><div class="chapter-title">Durable State 写回：数据库、Bus 与前端投影的衔接</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="11-context-management/"><div class="chapter-number">11</div><div class="chapter-title">上下文工程：从输入重写到模型消息投影</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="12-prompt-system/"><div class="chapter-number">12</div><div class="chapter-title">输入编译：`SessionPrompt.prompt()` 如何落 durable user message</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="13-multi-agent/"><div class="chapter-number">13</div><div class="chapter-title">高级编排：Subagent、Command、Compaction 怎样落回同一条主线</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="14-skill-system/"><div class="chapter-number">14</div><div class="chapter-title">Skill 系统</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="15-plugin-system/"><div class="chapter-number">15</div><div class="chapter-title">Plugin 系统深挖</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="16-memory-system/"><div class="chapter-number">16</div><div class="chapter-title">Memory</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="17-sdk-transport/"><div class="chapter-number">17</div><div class="chapter-title">入口与传输适配：CLI/TUI/Web/Desktop 怎样共享同一协议</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="18-resilience/"><div class="chapter-number">18</div><div class="chapter-title">韧性机制：重试、溢出自愈、回滥清理与交互式阻塞</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="19-settings-config/"><div class="chapter-number">19</div><div class="chapter-title">启动与配置加载：从全局目录到 .opencode 覆写</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="20-lsp-integration/"><div class="chapter-number">20</div><div class="chapter-title">LSP：代码理解、符号定位与诊断反馈是怎样接进主链路的</div><span class="chapter-arrow">&#8599;</span></a>
  </div>

  <h2>21-24 扩展专题</h2>
  <div class="chapter-grid">
    <a class="chapter-card" href="21-hooks-lifecycle/"><div class="chapter-number">21</div><div class="chapter-title">Hooks 与生命周期：Effect-ts 驱动的事件流与扩展点</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="22-repl-and-state/"><div class="chapter-number">22</div><div class="chapter-title">REPL 与交互层：多表面入口与统一 Server Contract</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="23-bridge-system/"><div class="chapter-number">23</div><div class="chapter-title">扩展面：Plugin、MCP、Command、Skill 与 Custom Tool 怎样挂进固定骨架</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="24-project-init-analysis/"><div class="chapter-number">24</div><div class="chapter-title">项目初始化分析报告</div><span class="chapter-arrow">&#8599;</span></a>
  </div>

  <h2>25-36 OpenCode 深度专题</h2>
  <div class="chapter-grid">
    <a class="chapter-card" href="25-mainline-index/"><div class="chapter-number">25</div><div class="chapter-title">执行主线索引：OpenCode 运行主线深度解析</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="26-server-routing/"><div class="chapter-number">26</div><div class="chapter-title">Server 与路由边界：请求如何获得 Workspace 与 Instance</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="27-session-loop/"><div class="chapter-number">27</div><div class="chapter-title">Session Loop：历史回放、分支判断与并发闸门</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="28-stream-processor/"><div class="chapter-number">28</div><div class="chapter-title">流事件处理：SessionProcessor.process() 如何写回状态</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="29-llm-request/"><div class="chapter-number">29</div><div class="chapter-title">模型请求：上下文、工具与 provider 的晚绑定</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="30-model/"><div class="chapter-number">30</div><div class="chapter-title">Durable State 与对象模型</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="31-infra/"><div class="chapter-number">31</div><div class="chapter-title">基础设施：SQLite、Storage、Bus、Instance 与事件投影</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="32-worktree-sandbox/"><div class="chapter-number">32</div><div class="chapter-title">Worktree 与 Sandbox 机制</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="33-mcp-details/"><div class="chapter-number">33</div><div class="chapter-title">MCP：Model Context Protocol 扩展系统的全部实现细节</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="34-design-philosophy/"><div class="chapter-number">34</div><div class="chapter-title">设计哲学：固定骨架与晚绑定策略</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="35-prompt-diff/"><div class="chapter-number">35</div><div class="chapter-title">提示词三文件对比分析</div><span class="chapter-arrow">&#8599;</span></a>
    <a class="chapter-card" href="36-debugging/"><div class="chapter-number">36</div><div class="chapter-title">断点调试指南</div><span class="chapter-arrow">&#8599;</span></a>
  </div>
</div>

<footer class="site-footer page-wrapper">
  <div class="footer-links">
    <a href="https://github.com/feuyeux/hello-olleh">GitHub</a>
    <a href="/hello-olleh/">返回首页</a>
  </div>
</footer>
