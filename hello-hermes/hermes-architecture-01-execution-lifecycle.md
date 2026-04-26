# Hermes 架构解析 (一)：流程篇 · 源代码执行全生命周期 (v2026.4.16)

本篇深度分析旨在系统性地解构 Hermes Agent 的核心架构与运行机制，重点探讨以下五个核心命题：

1. **入口逻辑**：请求是如何从外部触发并精准送达内核的？
2. **Turn 级初始化**：为何 `AIAgent` 选择按轮次（Turn）进行动态初始化？
3. **执行全生命周期**：`run_conversation()` 在运行过程中经历了哪些关键阶段？
4. **能力解耦**：上下文压缩、工具执行、持久化及后台复盘逻辑是如何分布的？
5. **设计权衡**：这套架构解决了哪些工程痛点，又在复杂性上做出了哪些妥协？

---

## 1. 阅读指引与核心范围

分析工作主要围绕以下核心模块展开：

| 模块           | 关键文件                                                                                                            | 核心关注点                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **入口与外壳** | `hermes`、`hermes_cli/main.py`、`cli.py`、`gateway/run.py`                                                          | 请求接入路径、统一会话模型的抽象与落地。              |
| **编排内核**   | `run_agent.py`                                                                                                      | Turn 主循环、工具执行流、上下文治理、状态持久化。     |
| **辅助能力层** | `agent/prompt_builder.py`、`agent/memory_manager.py`、`agent/context_compressor.py`、`agent/smart_model_routing.py` | Prompt 组装策略、记忆召回、上下文压缩、动态路由逻辑。 |
| **工具运行时** | `model_tools.py`、`tools/registry.py`、`tools/managed_tool_gateway.py`、`tools/skills_tool.py`                      | 工具分发机制（3 阶段发现）、Tool Gateway、技能生命周期。 |
| **持久化层**   | `hermes_state.py`（Schema v6）、`gateway/session.py`                                                                | SQLite 存储方案（WAL）、Session 日志、网关会话副本管理。 |

### 核心代码走读顺序建议

| 步骤 | 目标文件             | 关键方法 / 入口             | 逻辑要点                                              |
| :--- | :------------------- | :-------------------------- | :---------------------------------------------------- |
| `1`  | `hermes`             | launcher                    | 命令行指令如何转发至 Python 入口。                    |
| `2`  | `hermes_cli/main.py` | `main()`                    | 参数解析、子命令分发，默认进入 `chat` 模式。          |
| `3`  | `hermes_cli/main.py` | `cmd_chat()`                | 完成基础配置与技能同步后，移交控制权给 `cli.main()`。 |
| `4`  | `cli.py`             | `HermesCLI.__init__()` 等   | Turn 路由决策与延迟初始化逻辑。                       |
| `5`  | `run_agent.py`       | `AIAgent.__init__()`        | Provider、工具集、记忆组件与压缩器的装配。            |
| `6`  | `run_agent.py`       | `run_conversation()`        | 单次 Turn 执行的真实入口。                            |
| `7`  | `run_agent.py` 等    | `_build_system_prompt()` 等 | 稳定上下文（System Prompt）的构建策略。               |
| `8`  | `run_agent.py` 等    | `_compress_context()` 等    | Preflight 压缩机制与会话血缘（Lineage）维护。         |
| `9`  | `run_agent.py` 等    | `prefetch_all()` 等         | 易变内容（Memory）的瞬时注入。                        |
| `10` | `run_agent.py`       | `_execute_tool_calls()`     | 工具执行的批次处理（并发或串行）。                    |
| `11` | `model_tools.py` 等  | `handle_function_call()` 等 | 工具调用如何回落至全局注册表分发。                    |
| `12` | `run_agent.py` 等    | `_persist_session()` 等     | 状态持久化、预热机制及异步后台复盘。                  |

对于关注 **Gateway（网关）** 路径的读者，请将上述第 `2-4` 步替换为：

 | 目标文件         | 关键方法 / 入口                | 逻辑要点                                   |
 | :--------------- | :----------------------------- | :----------------------------------------- |
 | `gateway/run.py` | `start_gateway()`              | 网关启动、技能同步及 Runner 生命周期管理。 |
 | `gateway/run.py` | `GatewayRunner.__init__()`     | 平台适配器、Session 存储、Agent 缓存机制。 |
 | `gateway/run.py` | `_resolve_turn_agent_config()` | Gateway 复用 Turn 级路由逻辑。             |

---

## 2. 架构全景：从外壳到内核的六层演进

理解 Hermes 的关键在于把握其纵向分层的设计哲学。

```mermaid
flowchart LR
    %% 极致高对比度样式定义
    classDef nodeStyle fill:#ffffff,stroke:#000000,stroke-width:2px,color:#000000,font-weight:900,font-size:15px,font-family:sans-serif;
    classDef focusStyle fill:#e2e8f0,stroke:#000000,stroke-width:3px,color:#000000,font-weight:900,font-size:16px;
    classDef areaStyle fill:#f8fafc,stroke:#475569,stroke-width:2px,color:#000000,font-weight:bold,font-size:15px;

    %% 1. 入口层
    subgraph L1 [" ① 入口层 "]
        direction TB
        L1A["命令入口<br/>hermes / agent"]
    end

    %% 2. 控制层
    subgraph L2 [" ② 控制层 "]
        direction TB
        L2A["参数解析<br/>子命令分发"]
    end

    %% 3. 外壳层
    subgraph L3 [" ③ 外壳层 "]
        direction TB
        L3A["终端/平台输入"] --- L3B["会话 / 路由"]
    end

    %% 4. 编排层
    subgraph L4 [" ④ 编排层 · AIAgent "]
        direction TB
        L4A["Prompt 组装"] --> L4B["模型循环"]
        L4B --> L4C["工具执行"]
        L4C --> L4D["上下文治理"]
        L4D --> L4E["落盘保存"]
    end

    %% 5. 能力层
    subgraph L5 [" ⑤ 能力层 "]
        direction TB
        L5A["Prompt Builder"] --- L5B["Memory Manager"]
        L5C["Tool Registry"] --- L5D["Context Compressor"]
    end

    %% 6. 持久化层
    subgraph L6 [" ⑥ 持久化层 "]
        direction TB
        L6A[("Session DB")] --- L6B["JSONL Store"]
    end

    %% 严格的水平均进箭头
    L1 --> L2 --> L3 --> L4
    L4 -.-> L5
    L4 -.-> L6
    L5 ~~~ L6

    %% 样式应用
    class L1,L2,L3,L4,L5,L6 areaStyle;
    class L1A,L2A,L3A,L3B,L4A,L4C,L4D,L4E,L5A,L5B,L5C,L5D,L6B nodeStyle;
    class L4B focusStyle;
    class L6A nodeStyle;
```

### 层级职责详述

| 层级         | 核心模块                                | 职责定义                                                       |
| ------------ | --------------------------------------- | -------------------------------------------------------------- |
| **入口层**   | `pyproject.toml`（L117-120）、`hermes`    | 暴露 CLI 指令，确定系统的运行表面。                            |
| **控制层**   | `hermes_cli/main.py`                    | 环境预检、配置加载、多级子命令路由。                           |
| **外壳层**   | `cli.py`、`gateway/run.py`              | 差异化接入（终端/网关），封装为统一的 Session 模型。           |
| **编排层**   | `run_agent.py:AIAgent`（L535+）         | **系统心脏**：驱动 Prompt 组装、模型循环、上下文治理及 Responses API 归一化。 |
| **能力层**   | `agent/*`、`tools/*`                    | 记忆、技能、压缩、Tool Gateway、插件 Hook 等原子能力。         |
| **持久化层** | `hermes_state.py`、`gateway/session.py` | SQLite（Schema v6, WAL 模式）与 JSONL 增量日志的双重持久化。   |

**分层的工程价值：**

- **解耦接入与逻辑**：`AIAgent` 屏蔽了消息来源，无论是 CLI 还是 Gateway。
- **原子化能力演进**：记忆治理、上下文压缩等模块可独立迭代，互不干扰。
- **一致性保证**：Gateway 并非另一套内核，而是共享编排逻辑的另一种接入形式。

### v0.9.0 → v0.10.0 架构增量

自 v0.8.0 以来，六层架构的骨架未变，但各层能力均有显著扩展：

| 版本      | 新增能力                                                                                                                           | 影响层                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **v0.9.0**  | **Dashboard 插件系统**：Web Dashboard 支持插件 manifest、自定义 Tab、CSS/JS 注入（`window.__HERMES_PLUGINS__.register()`）；**Dashboard 主题系统**：主题预设与运行时切换（`web/src/themes/`） | 外壳层、能力层 |
| **v0.10.0** | **Tool Gateway**（核心特性）：Nous Portal 订阅者可直接使用托管的 Web 搜索、图片生成、TTS、浏览器自动化，无需额外 API Key。实现于 `tools/managed_tool_gateway.py` + `tools/tool_backend_helpers.py`，每个工具通过 `use_gateway` 配置按需启用 | 能力层、编排层 |
| **v0.10.0** | **Responses API 归一化层**：`AIAgent` 新增完整的 Responses API 支持（`_responses_tools`、`_chat_messages_to_responses_input`、`_normalize_codex_response`、`_run_codex_stream` 等，L3673-4699+），`api_mode` 扩展至 4 种：`chat_completions`、`codex_responses`、`anthropic_messages`、`bedrock_converse` | 编排层 |
| **v0.10.0** | **凭据轮转与 Fallback Provider**：运行时凭据池管理与 Provider 恢复子系统（L4307-4924）                                               | 编排层 |
| **v0.10.0** | **插件 Hook 管道**：`model_tools.py` 现在在工具执行前后触发 `pre_tool_call` / `post_tool_call` 插件 Hook                            | 能力层 |
| **v0.10.0** | **3 阶段工具发现**：内置工具（Registry）→ MCP 工具 → 插件工具；动态 Schema 重写（`execute_code` 根据沙箱能力自动调整）；工具参数类型自动强转 | 能力层 |
| **v0.10.0** | **新增内置 Provider**：Ollama Cloud（`OLLAMA_API_KEY` + `OLLAMA_BASE_URL`）、xAI Responses API（自动路由 `codex_responses` 模式）    | 编排层 |
| **v0.10.0** | **新增 Gateway 平台**：BlueBubbles/iMessage、WeCom 回调、Email、SMS、Home Assistant                                                 | 外壳层 |

**新增工具文件一览**：`managed_tool_gateway.py`、`tool_backend_helpers.py`、`clarify_tool.py`、`memory_tool.py`、`todo_tool.py`、`session_search_tool.py`、`send_message_tool.py`、`homeassistant_tool.py`、`cronjob_tools.py`、`browser_providers/*`、`xai_http.py`。

**新增 Toolset**：`hermes-acp`、`hermes-api-server`、`hermes-bluebubbles`、`hermes-weixin`、`hermes-wecom-callback`、`hermes-gateway`、`homeassistant`、`messaging`、`todo`、`memory`、`session_search`、`clarify`、`code_execution`、`delegation`。Toolset 现还支持插件/注册表定义的动态 Toolset。

**文件依赖链更新**：

```
tools/registry.py  (无依赖 — 被所有工具文件导入)
       ↑
tools/*.py  (各自在导入时调用 registry.register())
       ↑
model_tools.py  (导入 tools/registry + 触发 3 阶段发现: 内置 + MCP + 插件)
       ↑
run_agent.py, cli.py, batch_runner.py, environments/
```

---

## 3. 动态内核：为什么 `AIAgent` 按 Turn 初始化

在 `v2026.4.16` 中，`AIAgent`（L535+, `__init__` 起始于 L552）的生命周期并非与进程绑定，而是与 **Turn（对话轮次）** 强关联。

### CLI 调用链分析

```
hermes -> hermes_cli.main:main() 
  -> cmd_chat() 
    -> cli.main() 
      -> HermesCLI.__init__() 
        -> 轮次预检：_resolve_turn_agent_config()
        -> 内核重建：_init_agent()
          -> AIAgent(...)
```

**设计意图：Turn 级智能路由**

1. **实时洞察**：外壳层先捕获当前输入，由 `smart_model_routing.py` 计算路由指纹（Route Signature）。
2. **按需重建**：若路由指纹与当前 Agent 运行时（Runtime）不匹配，则触发 `_init_agent()` 销毁旧内核并重建。
3. **控制权交接**：路由锁定后，真正的控制权才交由 `AIAgent.run_conversation()`。

**这种设计的收益与代价：**

- **收益**：实现了极致的资源优化。简单任务走轻量模型，复杂逻辑动态切换至重型模型，避免资源长期闲置。
- **代价**：增加了状态管理的复杂性，需处理内核重建时的历史继承、缓存复用及断点恢复。

---

## 4. 单次 Turn 的时序解析

我们将 `run_conversation()` 视为系统主线，一次完整的 Turn 可拆解为 **四个阶段、六个步骤**。

```mermaid
flowchart LR
    classDef stage fill:#f8fafc,stroke:#475569,stroke-width:2px,color:#000000,font-weight:900,font-size:16px;
    classDef nodeStyle fill:#ffffff,stroke:#000000,stroke-width:2px,color:#000000,font-weight:900,font-size:14px,font-family:sans-serif;
    classDef loopStyle fill:#e2e8f0,stroke:#000000,stroke-width:3px,color:#000000,font-weight:900,font-size:15px;
    classDef toolStyle fill:#ffffff,stroke:#000000,stroke-width:2px,color:#000000,font-weight:900,font-size:14px;
    classDef storageStyle fill:#ffffff,stroke:#000000,stroke-width:2px,stroke-dasharray: 4 2,color:#000000,font-weight:900,font-size:14px;

    %% 阶段1: 路由与初始化 (强制纵向)
    subgraph S1 [" 阶段 I: 路由与初始化 "]
        direction TB
        A["A 用户输入<br/>(CLI / Gateway)"] --> B["B Turn 路由<br/>(resolve_turn_route)"]
        B --> C["C 重建 Agent<br/>(_init_agent)"]
    end

    %% 阶段2: 上下文准备
    subgraph S2 [" 阶段 II: 上下文准备 "]
        direction TB
        D["D 恢复 Runtime<br/>(复制历史/回填)"] --> E["E System Prompt 冻结<br/>(_cached_system_prompt)"]
        E --> F["F Preflight 压缩<br/>(_compress_context)"]
        F --> G["G 易变内容注入准备<br/>(Memory / Plugin / Prefill)"]
    end

    %% 阶段3: 核心推理循环
    subgraph S3 [" 阶段 III: 核心推理循环 "]
        direction TB
        H["H 组装 Payload<br/>(System+User 注入)"] --> I{"I 主循环<br/>(tool_calls?)"}

        subgraph ToolSet [" 工具分发执行 "]
            direction TB
            J["J Agent 特判<br/>(todo / memory / delegate)"]
            K["K 普通工具回落<br/>(Registry Dispatch)"]
        end

        I -- "是" --> ToolSet
        ToolSet --> L["L 结果回写 & 压缩<br/>(Message Sync)"]
        L --> H
    end

    %% 阶段4: 输出与复盘
    subgraph S4 [" 阶段 IV: 输出与复盘 "]
        direction TB
        M["M 生成最终响应"] --> N[("N 持久化<br/>(DB / Log / Trans)")]
        N --> O["O 主响应返回用户"]
        O -.-> P["P Post-turn 异步处理<br/>(Memory Sync / Prefetch)"]
    end

    %% 跨阶段连接
    C --> D
    G --> H
    I -- "否" --> S4

    %% 样式应用
    class S1,S2,S3,S4 stage;
    class A,B,C,D,E,F,G,H,L,M,O nodeStyle;
    class I loopStyle;
    class J,K toolStyle;
    class N,P storageStyle;
```

### 4.1 路由预处理 (A → B → C)

真正的编排开始前，外壳层必须确定当前轮次的路由配置：

- CLI 与 Gateway 分别通过各自的入口捕获输入。
- 共同调用 `resolve_turn_route()` 计算本轮路由指纹。
- 若指纹变更，立即执行 `_init_agent()` 重建 Runtime。

### 4.2 Runtime 状态恢复 (D)

进入 `run_conversation()` 后，系统首先执行 `_restore_primary_runtime()`，确保：

- Fallback Provider 状态归位，计数器清零，Iteration Budget（迭代预算）恢复。
- 深度复制会话历史，剥离非必要噪音信息。
- 必要时通过 `_hydrate_todo_store()` 恢复待办任务状态。

### 4.3 上下文治理：冻结与预压缩 (E → F)

在调用模型前，系统进行高强度的上下文治理：

1. **System Prompt 冻结**：检查缓存并决定是否调用 `_build_system_prompt()` 重新构建（包含身份、技能索引、上下文文件等）。
2. **Preflight 压缩**：在主循环开始前，粗估 Token 规模。若逼近阈值，立即触发 `ContextCompressor.compress()` 执行结构化压缩。v0.10.0 修正：压缩时始终保留最后一条用户消息在 tail 中，防止当前活跃任务信息丢失。

### 4.4 稳定与易变内容的差异化注入 (G → H)

Hermes 严格区分了两类上下文信息：

- **稳定内容**（如系统约束、技能索引）：注入 Cached System Prompt，追求最大化的 Prompt Cache 复用。
- **易变内容**（如 Memory Recall、插件 Hook 结果、临时 Prompt）：仅注入当前 API Payload，不直接写回长期历史，避免污染 Transcript。

### 4.5 模型驱动的工具回路 (H → I → J → K → L)

主循环的核心并非单次 API 调用，而是“模型回复驱动的工具循环”：

- **响应级治理**：流式处理、重试策略及 Token 使用情况统计。
- **工具调用清洗**：修正模型幻觉、JSON 校验及批量调用限制。
- **双轨执行路径**：
  - **内核特判工具**：如 `todo`、`delegate_task`，由内核直接拦截处理。
  - **普通注册工具**：回落至注册表，由 `ToolRegistry.dispatch()` 映射至具体处理器。
- **插件 Hook 管道**（v0.10.0）：每次工具调用前后分别触发 `pre_tool_call` / `post_tool_call`，插件可拦截、修改参数或后处理结果。

    **收敛条件**：循环直至无 `tool_calls` 产生，或触发迭代预算耗尽（此时会强制生成一次总结）。

#### 4.5.1 单轮如何结束

Hermes 是 **一个主循环 + 多种工具子拓扑**：

Hermes 在同一个 `run_conversation()` 中混合了多种闭环形态：**维护型、阻塞交互型、委派型、普通执行型**。这些工具都会延长当前 Turn，但延长方式和结束条件并不一样。这里需要特别区分：`run_conversation()` 的“多轮”是 **单个 Turn 内部的 API / Tool 编排循环**，不是用户视角的多轮会话。

| 工具类型       | 代表工具                                                                      | 在 Loop 中的拓扑                             | 单轮何时继续                                               | 单轮何时结束                                                                               |
| :------------- | :---------------------------------------------------------------------------- | :------------------------------------------- | :--------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| **普通执行型** | `terminal`、文件工具、Web/MCP/Registry 工具                                   | 标准 `assistant -> tool -> assistant` 回注环 | 工具结果写回 `messages` 后，模型再次产生 `tool_calls`      | 模型首次返回无 `tool_calls` 的可见内容；或预算/异常触发兜底结束                            |
| **维护型**     | `memory`、`todo`、`session_search`、`skill_manage`                            | 轻量 side-effect 环，不改变主循环结构        | 工具结果写回后继续下一次采样，通常用于让模型“补完最终回复” | 若下一次模型不给新工具调用，则 Turn 收敛；若前一轮已给正文，甚至可直接用该正文作为最终答复 |
| **阻塞交互型** | `clarify`；以及由 `terminal` / `skills_tool` 触发的 approval / secret capture | 当前迭代内部同步阻塞，等待人类输入           | 用户作答、超时、取消或拒绝后，工具返回结果，主循环继续     | 工具本身不会结束 Turn；只是在“人类响应返回”后，交还给主循环决定是否结束                    |
| **委派型**     | `delegate_task`                                                               | 父 loop 内嵌一个子 agent loop                | 子 agent 完成后结果回注父 loop，父 loop 再决定是否继续采样 | 子 agent 的结束不等于父 Turn 结束；父 Turn 仍需等模型消化委派结果并停止发新工具            |

从 `run_agent.py` 的真实实现看，单个 Turn 的结束条件主要有五类：

1. **正常收敛结束**：模型返回了可见文本，且本次响应不再携带 `tool_calls`，主循环直接 `break`，随后构造最终 assistant 消息并返回。
2. **工具回路继续**：只要响应中仍包含 `tool_calls`，当前 Turn 就不会结束，而是进入对应工具子拓扑，再回到主循环。
3. **正文提前交付但仍有维护型工具**：若 assistant 同时给出正文和维护型工具调用，Hermes 会先保留正文，再执行工具；后续若 follow-up 为空，可直接回退使用先前正文作为单轮结果。这是 Hermes 相比 `hello-harness` 中单一 follow-up loop 更细的一层优化。
4. **预算耗尽结束**：当 `while api_call_count < self.max_iterations and self.iteration_budget.remaining > 0` 不再满足时，本轮被强制收敛，并调用 `_handle_max_iterations()` 生成兜底总结。
5. **异常/中断/部分完成结束**：包括无效工具名重试失败、参数 JSON 连续损坏、流式中断、Provider 错误无法恢复、压缩重试耗尽等，这些路径会提前 `return` 一个 `completed=False` 或 `partial=True` 的结果。

因此，**单轮结束的判断权始终在 `run_conversation()` 内部**；工具只决定“这一轮要不要继续展开”，不决定最终何时收敛。

### 4.6 异步后处理与复盘 (M → N → O → P)

当最终响应构建完成（M）并落盘持久化（N）后，主响应即返回用户（O）。然而，Turn 级生命周期并未就此结束：

- **Memory 同步**：执行 `MemoryManager.sync_all()` 更新长期记忆。
- **预热机制**：为下一轮 Recall 执行 Prefetch。
- **后台复盘**：满足条件时，唤醒异步任务进行 `background_review`，实现系统的自我完善。

#### 4.6.1 多轮如何结束

如果把用户连续多次发送消息理解为“多轮会话”，那么它的结束点 **不在 `run_conversation()` 中**，而在更外层的 **Session 生命周期**。这也是 `hello-harness/13-agent-loop.md` 和 Hermes 源码对照后最值得强调的一点：**工具 loop 结束，不代表多轮会话结束。**

不同工具类型对“多轮是否结束”的影响如下：

| 工具类型       | 对多轮会话的影响                                                                 | 会不会天然切出新 Session                               |
| :------------- | :------------------------------------------------------------------------------- | :----------------------------------------------------- |
| **普通执行型** | 只影响当前 Turn，不决定多轮边界                                                  | 否                                                     |
| **维护型**     | 更新记忆、检索历史、整理 todo，但仍附着在当前 Session 上                         | 否                                                     |
| **阻塞交互型** | 让当前 Turn 暂停等待人类输入，本质上仍属于同一会话连续流                         | 否                                                     |
| **委派型**     | 会在父 Turn 内部派生子 agent / 子任务闭环，但父会话一般不因此结束                | 通常否；它更像局部派生执行，而不是用户会话切换         |
| **压缩型边界** | 上下文压缩会触发新的 `session_id`，但通过 `parent_session_id` 连续成一条 lineage | **是，但属于 lineage split，不是用户语义上的会话结束** |

真正决定多轮会话结束的，仍是外壳层 Session 边界：

1. **CLI 显式开新会话**：`cli.py:new_session()` 会清空 `conversation_history`，重置 agent 的 session 状态，并对旧 `session_id` 调用 `SessionDB.end_session(..., "new_session")`。
2. **CLI 退出当前会话**：CLI 关闭时会调用 `SessionDB.end_session(..., "cli_close")`，把这一整段多轮会话标记为结束。
3. **Gateway `/new` / `/reset`**：网关路径会先结束旧 session，再创建新 session，并发出 `session:end`、`session:reset` 等边界事件。
4. **自动会话边界**：Gateway 还存在基于 inactivity 或 daily reset 的自动重置；这类情况本质上也是“旧会话结束，新会话开始”。
5. **压缩分裂**：`_compress_context()` 会结束旧 session、创建新 session，并用 `parent_session_id` 串起 lineage。它在存储层算“新 session”，但在用户心智里更像“同一会话被压缩续写”。

因此，Hermes 至少有三层结束语义：

- **工具级结束**：单个工具返回结果，交还主循环。
- **Turn 结束**：`run_conversation()` 判断“这次请求是否已经收敛”。
- **Session 结束**：CLI / Gateway / SessionDB 判断“这一串历史是否还继续复用”。

---

## 5. 总结

Hermes Agent v2026.4.16（v0.10.0）的源代码揭示了一个高度模块化且具备强大韧性的 Agent 系统。通过将 **Turn 级路由** 提升至架构的第一优先级，它成功解决了长对话场景下的资源效率与模型匹配问题；而 **Preflight 压缩** 与 **差异化上下文注入** 的引入，则展示了其在 Token 预算治理上的前瞻性。

v0.9.0 至 v0.10.0 的演进进一步巩固了这一架构：**Tool Gateway** 将第三方 API 管理从用户侧下沉至平台侧；**Responses API 归一化层** 使编排内核同时适配 Chat Completions、Codex Responses、Anthropic Messages 和 Bedrock Converse 四种 API 模式；**3 阶段工具发现**（内置 → MCP → 插件）与 **插件 Hook 管道** 则让工具生态从封闭走向开放。`SessionDB` 升级至 Schema v6，引入 WAL 并发模式、计费/推理 Token 追踪及会话标题管理，`HermesCLI`（L1590+）也扩展了模型选择器、推理预览、快捷模式、皮肤系统及语音模式等交互能力。

这种设计虽然在 Runtime 状态管理上引入了更高的实现门槛，但其带来的收益是显著的：它不再是一个简单的 Prompt 包装器，而是一个具备完整生命周期感知、状态持久化保障及自我演化能力的 Agent 操作系统。对于开发者而言，理解这套”外壳-编排-能力”的六层模型，是掌握 Hermes 扩展与调优的关键。
