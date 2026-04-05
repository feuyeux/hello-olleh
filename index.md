---
layout: default
---


<div class="page-wrapper">
  <div class="harness-diagram">
    <img src="{{ 'hello-harness.png' | relative_url }}" alt="Harness Engineering Framework" />
  </div>
  <hr class="section-divider">

  <section>
    <div class="section-header">
      <h2>分析对象</h2>
      <p>四个 AI Coding CLI 的源码版本、语言栈与源码仓库入口</p>
    </div>
    <div class="source-links">
      <a class="source-link" href="{{ 'claude-code/' | relative_url }}">
        <span class="dot"></span>claude-code/
      </a>
      <a class="source-link" href="https://github.com/openai/codex.git" target="_blank" rel="noreferrer">
        <span class="dot"></span>github.com/openai/codex.git
      </a>
      <a class="source-link" href="https://github.com/google-gemini/gemini-cli.git" target="_blank" rel="noreferrer">
        <span class="dot"></span>github.com/google-gemini/gemini-cli.git
      </a>
      <a class="source-link" href="https://github.com/anomalyco/opencode.git" target="_blank" rel="noreferrer">
        <span class="dot"></span>github.com/anomalyco/opencode.git
      </a>
    </div>
    <div class="cli-grid">
      <a class="cli-card" href="{{ 'hello-claude-code/' | relative_url }}">
        <span class="chapter-number">01</span>
        <span class="cli-icon">&#x1F537;</span>
        <div>
          <div class="cli-name">Claude Code</div>
          <div class="cli-version">v2.1.87</div>
        </div>
      </a>
      <a class="cli-card" href="{{ 'hello-codex/' | relative_url }}">
        <span class="chapter-number">02</span>
        <span class="cli-icon">&#x1F536;</span>
        <div>
          <div class="cli-name">OpenAI Codex</div>
          <div class="cli-version">rust-v0.118.0</div>
        </div>
      </a>
      <a class="cli-card" href="{{ 'hello-gemini-cli/' | relative_url }}">
        <span class="chapter-number">03</span>
        <span class="cli-icon">&#x1F7E1;</span>
        <div>
          <div class="cli-name">Gemini CLI</div>
          <div class="cli-version">v0.36.0</div>
        </div>
      </a>
      <a class="cli-card" href="{{ 'hello-opencode/' | relative_url }}">
        <span class="chapter-number">04</span>
        <span class="cli-icon">&#x1F7E2;</span>
        <div>
          <div class="cli-name">OpenCode</div>
          <div class="cli-version">v1.3.2</div>
        </div>
      </a>
    </div>
  </section>

  <section>
    <div class="section-header">
      <h2>Harness Engineering 框架</h2>
      <p>十二个维度，透视可控性工程的源码证据</p>
    </div>
    <div class="chapter-grid">

      <a class="chapter-card" href="{{ 'hello-harness/01-framework/' | relative_url }}">
        <div class="chapter-number">01 / 12</div>
        <div class="chapter-title">理论框架总览</div>
        <div class="chapter-desc">Harness Engineering 的核心主张：可控性取决于工程师看见、影响、纠正 Agent 行为的能力。</div>
        <span class="chapter-arrow">&#8599;</span>
      </a>

      <a class="chapter-card" href="{{ 'hello-harness/02-control-plane/' | relative_url }}">
        <div class="chapter-number">02 / 12</div>
        <div class="chapter-title">控制平面</div>
        <div class="chapter-desc">Agent 主循环的调度结构、状态机设计与消息路由机制。</div>
        <span class="chapter-arrow">&#8599;</span>
      </a>

      <a class="chapter-card" href="{{ 'hello-harness/03-feedforward-controls/' | relative_url }}">
        <div class="chapter-number">03 / 12</div>
        <div class="chapter-title">前馈控制</div>
        <div class="chapter-desc">在 Agent 行动之前注入正确信息、约束与流程的机制。</div>
        <span class="chapter-arrow">&#8599;</span>
      </a>

      <a class="chapter-card" href="{{ 'hello-harness/04-feedback-controls/' | relative_url }}">
        <div class="chapter-number">04 / 12</div>
        <div class="chapter-title">反馈控制</div>
        <div class="chapter-desc">在 Agent 行动后检测问题并提供修正信号的自适应机制。</div>
        <span class="chapter-arrow">&#8599;</span>
      </a>

      <a class="chapter-card" href="{{ 'hello-harness/05-tool-governance/' | relative_url }}">
        <div class="chapter-number">05 / 12</div>
        <div class="chapter-title">工具治理</div>
        <div class="chapter-desc">工具注册、权限边界、版本管理与沙箱隔离的实现。</div>
        <span class="chapter-arrow">&#8599;</span>
      </a>

      <a class="chapter-card" href="{{ 'hello-harness/06-context-and-memory/' | relative_url }}">
        <div class="chapter-number">06 / 12</div>
        <div class="chapter-title">上下文与记忆</div>
        <div class="chapter-desc">工作内存、会话持久化、跨会话知识管理与 CLAUDE.md 体系。</div>
        <span class="chapter-arrow">&#8599;</span>
      </a>

      <a class="chapter-card" href="{{ 'hello-harness/07-harnessability/' | relative_url }}">
        <div class="chapter-number">07 / 12</div>
        <div class="chapter-title">可驾驭性</div>
        <div class="chapter-desc">Feature Flag、Debug 模式、可观测性与交互式干预接口。</div>
        <span class="chapter-arrow">&#8599;</span>
      </a>

      <a class="chapter-card" href="{{ 'hello-harness/08-entropy-management/' | relative_url }}">
        <div class="chapter-number">08 / 12</div>
        <div class="chapter-title">熵管理</div>
        <div class="chapter-desc">上下文膨胀治理、Prompt 压缩、会话截断与令牌预算控制。</div>
        <span class="chapter-arrow">&#8599;</span>
      </a>

      <a class="chapter-card" href="{{ 'hello-harness/09-multi-agent-verification/' | relative_url }}">
        <div class="chapter-number">09 / 12</div>
        <div class="chapter-title">多 Agent 验证</div>
        <div class="chapter-desc">子 Agent 协作、验证回路、共识机制与对抗性检查。</div>
        <span class="chapter-arrow">&#8599;</span>
      </a>

      <a class="chapter-card" href="{{ 'hello-harness/10-human-steering/' | relative_url }}">
        <div class="chapter-number">10 / 12</div>
        <div class="chapter-title">人工接管</div>
        <div class="chapter-desc">介入时机、接管协议、恢复路径与最小化中断机制。</div>
        <span class="chapter-arrow">&#8599;</span>
      </a>

      <a class="chapter-card" href="{{ 'hello-harness/11-extensibility/' | relative_url }}">
        <div class="chapter-number">11 / 12</div>
        <div class="chapter-title">扩展机制</div>
        <div class="chapter-desc">Plugin 系统、API 抽象层、第三方集成与协议兼容性。</div>
        <span class="chapter-arrow">&#8599;</span>
      </a>

      <a class="chapter-card" href="{{ 'hello-harness/12-synthesis/' | relative_url }}">
        <div class="chapter-number">12 / 12</div>
        <div class="chapter-title">综合裁定</div>
        <div class="chapter-desc">四象限定位图、评分卡与选型建议。</div>
        <span class="chapter-arrow">&#8599;</span>
      </a>

    </div>
  </section>
</div>

<footer class="site-footer page-wrapper">
  <div class="footer-links">
    <a href="https://github.com/feuyeux/hello-olleh">GitHub</a>
    <a href="{{ 'hello-harness/01-framework/' | relative_url }}">框架总览</a>
    <a href="{{ 'hello-harness/12-synthesis/' | relative_url }}">综合裁定</a>
  </div>
  <p>Hello Olleh &middot; AI Coding CLI 源码分析 &middot; 2025</p>
</footer>
