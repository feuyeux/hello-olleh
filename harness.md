% Harness Engineering 框架
% AI Coding CLI 源码分析：前馈与反馈、计算型与推断型
% feuyeux

# Harness Engineering 框架

*AI Coding CLI 源码分析：前馈与反馈、计算型与推断型*

---

## Harness Engineering 理论框架在四工程中的映射

﻿---
layout: default
title: "01 - 理论框架总览"
---
<!-- markdownlint-disable MD060, MD024 -->

# Harness Engineering 理论框架在四工程中的映射

Harness Engineering 是一个观察 Agent 系统**可控性**的分析框架。它的核心主张是：一个 AI 编程工具能走多远，不取决于它的模型有多强，而取决于工程师能在多大程度上**看见、影响、纠正**它的行为。框架借用控制论的两个轴来组织这种观察：前馈（Feedforward）与反馈（Feedback）是第一个轴，描述干预发生的时机；计算型（Computational）与推断型（Inferential）是第二个轴，描述传感器的工作方式。

这两个轴之所以被选中，是因为它们覆盖了 Agent 可控性的全部空间，而不重叠冗余。前馈是"在 Agent 行动之前给它正确的约束和知识"，反馈是"在行动之后检测问题并纠正路径"；计算型传感器是"用代码机械执行的规则"，推断型传感器是"用语言或模型判断"。四个象限之间没有对错，只有不同工程选择的组合。本文档的任务，就是把四个真实工程的源码事实映射到这个框架，看清楚每个工程到底站在哪里。

---

## 2. 前馈（Feedforward）与反馈（Feedback）二元

前馈控制的逻辑是：与其等 Agent 犯错再纠正，不如提前把正确的信息、约束、流程注入它的上下文。反馈控制的逻辑恰好相反：接受 Agent 会犯错的现实，在它犯错后尽快检测并提供修正信号。两种策略都必要，因为前馈无法穷举所有情况，而纯反馈的代价又太高。

我们关注这个维度，是因为一个工程在前馈/反馈上的选择，直接决定了它的 Steering Loop 是主动还是被动、是结构化的还是临时性的。下面看四个工程各自的证据。

### Claude Code

Claude Code 的前馈控制中枢是 `claude-code/src/utils/systemPrompt.ts:41-123` 中的 `buildEffectiveSystemPrompt()` 函数。这个函数定义了四个优先级层次，并按照"后加载的内容对模型影响更大"的原则组合。真正值得注意的是 `claude-code/src/utils/claudemd.ts:790-1074` 中的 `getMemoryFiles()` 实现：它把磁盘上的 CLAUDE.md 文件分四层加载（Managed → User → Project → Local），并支持 `@include` 指令做跨文件引用。这是一套完整的前馈知识分发体系。

反馈方面，Claude Code 的主循环在 `claude-code/src/query.ts` 里，工具调用的结果直接回传模型，没有独立的结构化报告层。`claude-code/src/utils/hooks/postSamplingHooks.ts` 提供了采样后 Hook，但触发条件和实际在生产中的状态需要结合 feature flag 系统来判断（详见下文 §10）。

### Codex

Codex 的前馈控制完全依赖 Markdown 模板文件。`codex/codex-rs/protocol/src/prompts/base_instructions/default.md:1-276` 是一份 276 行的结构化行为规范，涵盖人格、AGENTS.md 语义、规划流程、验证要求等。这与 Claude Code 的 TypeScript 硬编码形成对比：Codex 的前馈内容是版本化的、可差量审查的、对人类工程师透明的。

反馈方面，Codex 最重要的机制是两阶段记忆管道。`codex/codex-rs/core/templates/memories/stage_one_system.md` 的 Phase 1 并行提取每次 rollout 的结构化输出，`consolidation.md` 的 Phase 2 整合这些输出并维护一个带 `max_unused_days` 窗口的知识库。这不是普通的"工具返回值注入上下文"，而是主动的、跨 session 的反馈回路。

### Gemini CLI

Gemini CLI 的前馈控制通过 `gemini-cli/packages/core/src/prompts/promptProvider.ts:38-265` 的 `getCoreSystemPrompt()` 以函数组合方式构建。每个片段（preamble、coreMandates、hookContext 等）都是独立的 snippet 函数，这使得 prompt 内容本身成为可以单元测试的代码。这是四个工程里最接近"prompt-as-code"理念的实现。

反馈方面，`gemini-cli/packages/core/src/hooks/hookSystem.ts:259-305` 实现了完整的 BeforeModel/AfterModel 生命周期，且 `hookOutput?.shouldStopExecution()` 提供了显式的执行阻断路径。更重要的是，Gemini CLI 拥有 29+ 个 eval 文件（`gemini-cli/evals/*.eval.ts`），这意味着它的反馈机制不仅在运行时生效，还在开发期以自动化测试的形式存在。

### OpenCode

OpenCode 的前馈控制通过 `opencode/packages/opencode/src/skill/index.ts:1-262` 实现的 Skill 系统传递。Skill 文件通过 SKILL.md + Zod Schema 定义结构，由 `Config.directories()` 决定扫描路径。这是声明式的前馈：规则不写在代码里，写在目录里。

反馈方面，`opencode/packages/opencode/src/permission/index.ts:1-322` 的 Permission 系统通过 `ask()` 方法暂停执行并等待用户判断。这是一种人工参与的反馈，而非自动化反馈。Effect-ts 的 `Deferred.await()` 模型保证了不会有竞争条件，但也意味着每次反馈都需要人类在场。

### 横向对比：前馈/反馈的时序质量

四个工程都有某种形式的前馈，但质量差异显著。Codex 的前馈是最透明的（Markdown 文件，可审查），Claude Code 的前馈是最完备的（四层文件体系），Gemini CLI 的前馈是最"可测试"的（snippet 函数可单元测试），OpenCode 的前馈是最声明式的（目录扫描）。

反馈的差异更大：只有 Codex 实现了**跨 session** 的主动反馈（Phase 1/2 记忆管道），其余三个工程的反馈都是 within-session 的被动响应。这个差距，是后续熵管理评分（§08）的主要来源。

---

## 3. 计算型与推断型两轴

这里的区分关系到一个核心问题：当 Agent 产生了有问题的输出，谁来发现它？如果是编译器或 Linter 发现，那是计算型传感器——快速、确定性、无歧义。如果是另一个模型或提示词规则来判断，那是推断型传感器——灵活、可以处理复杂场景，但有概率出错，且成本更高。我们分析两轴的分布，是因为过度依赖推断型传感器的工程，其控制质量会随着使用规模的增长而退化。

### Claude Code

Claude Code 的计算型传感器理论上应该是 TypeScript 类型系统。但 `claude-code/tsconfig.json` 的实际状态揭示了一个重要事实：反编译过程留下了约 1341 个 tsc 错误，导致类型系统作为前馈控制基本失效。这不是工程设计的问题，而是反编译副作用的现实。工具注册在 `claude-code/src/tools.ts:193-250` 的 `getAllBaseTools()` 里是静态枚举，作为计算型约束是有效的。

推断型传感器方面，`claude-code/src/services/toolUseSummary/toolUseSummaryGenerator.ts` 通过 LLM 生成工具使用摘要，这是典型的推断型传感器。

### Codex

Codex 的计算型传感器是四个工程里最强的：Rust 的 borrow checker 在编译期强制内存安全，`codex/codex-rs/core/src/config/schema.md` 的配置 Schema 在启动时强制配置合规。这些传感器的特点是零成本（不需要在运行时执行任何额外逻辑）且确定性（编译通过 = 不会出现整类错误）。

推断型传感器以 `codex/codex-rs/core/templates/memories/stage_one_system.md` 为代表：Phase 1 的任务是从 rollout 历史里"提取记忆"，这是一个需要模型理解和判断的任务，无法用机械规则替代。

### Gemini CLI

Gemini CLI 的计算型传感器包括工具注册表 `gemini-cli/packages/core/src/tools/tool-registry.ts` 和确认策略测试 `gemini-cli/packages/core/src/tools/confirmation-policy.test.ts`。测试作为计算型传感器是一个值得注意的设计选择：测试能在 CI 阶段机械地检测出行为退化，而不需要人类观察每次 Agent 运行。

推断型传感器以 `gemini-cli/packages/core/src/hooks/hookPlanner.ts` 为代表，以及 29+ eval 文件里的 LLM-as-Judge 模式。

### OpenCode

OpenCode 的计算型传感器主要是 Zod Schema 验证，见 `opencode/packages/opencode/src/permission/index.ts:19-24` 和 `opencode/packages/opencode/src/skill/index.ts:28-34`。Zod 验证是运行时的，不是编译期的，这是与 Rust/TypeScript strict 的本质区别。Effect-ts 的类型系统提供了一定的编译期保证，但 `z.record(z.string(), z.any())` 这类宽松 schema 削弱了其有效性。

### 横向对比：计算型/推断型的成本与可靠性

计算型传感器的优势是可靠性和零成本，推断型的优势是处理复杂场景的能力。Codex 向计算型倾斜最重（Rust borrow checker），OpenCode 向运行时推断型倾斜（Zod + Effect），Claude Code 的计算型传感器因反编译失效而实际偏低，Gemini CLI 用测试套件量化了推断型传感器的覆盖范围。后续的可驾驭性评分（§07）直接来自这里的观察。

---

## 4. 三类 Regulation 维度

Harness Engineering 借鉴软件质量保证的分层概念，把控制行为分为三类：Maintainability（维护性，代码库能被修改而不引入错误）、Architecture Fitness（架构适配性，系统能在演进中保持约束）、Behaviour（行为性，Agent 在运行时按预期行事）。我们记录这三个维度，是为了区分"写代码时的哈内斯"和"运行时的哈内斯"——两者都必要，但很多工程只有其中一个。

### Claude Code

| 维度 | 实现 | 证据 |
|------|------|------|
| Maintainability | 分层 CLAUDE.md + .claude/rules/ 目录 | `claude-md.ts:1-26` |
| Architecture Fitness | feature flag 系统 | `claude-code/src/tools.ts:14-135`（但 feature() 始终 false） |
| Behaviour | VerifyPlanExecutionTool | `process.env.CLAUDE_CODE_VERIFY_PLAN === 'true'`（反编译环境下不触发） |

### Codex

| 维度 | 实现 | 证据 |
|------|------|------|
| Maintainability | Rust 类型系统 + clippy | `codex-rs/Cargo.toml` |
| Architecture Fitness | approval policy 四模式 | `unless_trusted.md`、`on_failure.md` |
| Behaviour | 两阶段记忆管道 + outcome 标签 | `stage_one_system.md:1-569` |

### Gemini CLI

| 维度 | 实现 | 证据 |
|------|------|------|
| Maintainability | vitest 测试 + 29+ eval 文件 | `gemini-cli/evals/*.eval.ts` |
| Architecture Fitness | 模型选择约束 + Snippet 函数边界 | `config.ts`、`models.ts` |
| Behaviour | Hook System BeforeModel/AfterModel | `hookSystem.ts:149-444` |

### OpenCode

| 维度 | 实现 | 证据 |
|------|------|------|
| Maintainability | Bun + TypeScript strict | `opencode/tsconfig.json` |
| Architecture Fitness | Effect-ts Layer 模式 | `permission/index.ts:138` |
| Behaviour | Permission 即代码（allow/deny/ask） | `permission/index.ts:292-307` |

这个对比揭示了一个模式：Codex 和 Gemini CLI 在三个维度上都有可观察的实现，Claude Code 的 Architecture Fitness 和 Behaviour 维度因反编译副作用而失效，OpenCode 的 Maintainability 和 Architecture Fitness 强，但 Behaviour 维度过度依赖人工决策。

---

## 5. 质量左移的时序分布

"左移"（Shift-Left）是说：越早发现问题，修复成本越低。我们把质量检查线分为三个层次：Level 1 是启动时/编译时（成本最低），Level 2 是测试时/CI 时，Level 3 是运行时的持续监控（成本最高，但能捕捉运行时漂移）。一个成熟的 Harness 工程应该在三个层次都有覆盖，而非只依赖运行时观察。

### Claude Code

- **Level 1（启动时）**: `claude-code/src/utils/claudemd.ts:537` — MAX_INCLUDE_DEPTH = 5，防止 @include 循环引用。这是一个有效的启动时检测，但范围非常窄。
- **Level 2（测试时）**: 无原生 CI 配置可见，依赖上游构建系统。
- **Level 3（运行时持续监控）**: 无后台 GC 机制。memoize 缓存一旦建立不会自动失效，文档漂移无法被检测。

### Codex

- **Level 1（启动时）**: `codex/codex-rs/protocol/src/prompts/permissions/approval_policy/unless_trusted.md:1` — 默认拒绝策略在启动时即生效，无需运行 Agent 才能确立安全边界。
- **Level 2（测试时）**: Phase 1/2 记忆管道本身是一种测试：每次 rollout 后，记忆提取结果都会被验证结构化合规。
- **Level 3（运行时持续监控）**: 持续记忆整合是唯一实现 Level 3 的工程。`consolidation.md` 的 `max_unused_days` 窗口使知识库能被主动清理。

### Gemini CLI

- **Level 1（启动时）**: `gemini-cli/packages/core/src/tools/confirmation-policy.test.ts` — 测试即文档，覆盖确认策略的所有边界情况。
- **Level 2（测试时）**: `gemini-cli/evals/` 完整 eval 套件，对 Agent 行为做端到端验证。
- **Level 3（运行时持续监控）**: `hookSystem.ts:230-237` 的 `fireSessionEndEvent` 提供运行时清理钩子，但无主动漂移扫描。

### OpenCode

- **Level 1（启动时）**: `permission/index.ts:292-307` — `Permission.disabled()` 在服务初始化时静态过滤工具列表。
- **Level 2（测试时）**: Effect-ts 的编译时类型验证覆盖了服务依赖图的合法性。
- **Level 3（运行时持续监控）**: 无持续漂移检测。这是 OpenCode 最明显的工程欠债之一。

---

## 6. 可驾驭性（Harnessability）

可驾驭性衡量的是：假设我想在这个工程上添加一个新的控制点（比如一个 Lint 传感器，或一条权限规则），需要修改多少文件、触碰多少核心路径、承担多少风险？可驾驭性越高，团队就越能持续迭代 harness，而不是把它当成一次性的配置。

### Claude Code

Claude Code 的 `src/tools/<ToolName>/` 独立目录结构给工具开发提供了清晰的物理隔离，这是高可驾驭性的信号。但由于 TypeScript 类型系统（隐式传感器）已经失效（~1341 错误），向代码库插入新工具时，编辑器无法给出可靠的类型提示，增加了错误引入的风险。

### Codex

Rust crate 边界（`codex/codex-rs/app-server/src/lib.rs`）是编译期强制的模块隔离，这是最强的可驾驭性保证。任何违反 crate 边界的变更都会在编译期被阻断，而不是在运行时才暴露。代价是：Rust 的学习曲线和编译时间，使驾驭速度慢于 TypeScript 工程。

### Gemini CLI

`gemini-cli/packages/core/src/tools/tool-registry.ts` 的注册表模式依赖约定（你必须知道要向注册表注册），但注册逻辑本身是高度解耦的。TypeScript 类型系统提供了中等程度的隐式传感器，能在 IDE 中给出合理的错误提示。

### OpenCode

`opencode/packages/opencode/src/permission/index.ts:138` 的 Effect Layer 模式强制依赖注入，这意味着：任何需要 Permission 服务的代码都必须通过 `ServiceMap` 声明这个依赖，而不能静默地使用全局状态。这是一个强大的架构约束，但对不熟悉 Effect-ts 的工程师来说，门槛相当高。

---

## 7. Ashby 定律与拓扑承诺

Ashby 的必要多样性定律说：控制系统必须具备至少与被控系统同等的复杂度，才能有效控制它。放在 Agent 语境里，这意味着：如果你的 harness 规则只有 5 条，但 Agent 的行为空间有 500 种情况，那 harness 必然覆盖不全。

我们观察各工程在"限制 Agent 操作空间"上投入了多少，是因为**有意识地约束空间，本身就是一种控制策略**。

- **Claude Code**：`claude-code/src/constants/tools.ts:36-112` 的 Allowlist 机制通过精确列出允许/禁止的工具集合来限制空间，这是一种朴素但有效的拓扑承诺。feature flag 系统（即使当前失效）的设计意图是通过条件启用来进一步划定子空间。
- **Codex**：`codex/codex-rs/protocol/src/prompts/permissions/approval_policy/` 的四种 policy 变体，加上 `execpolicy` 对 shell 命令的约束，形成了两层正交的空间限制。
- **Gemini CLI**：`gemini-cli/packages/core/src/core/prompts.ts:20-40` 的组合式 prompt 构建器通过条件渲染（plan mode vs primary workflows）来切换子空间，而 `models.ts` 的模型约束限制了推断引擎的选择空间。
- **OpenCode**：`opencode/packages/opencode/src/config/config.ts` 定义了配置 schema，间接约束了 Agent 可以读取的操作参数空间。但当前缺少对工具调用空间的系统性限制。

---

## 8. Agent 可读性（Agent Legibility）

一个对 Agent 可读（Legible）的工程，意味着：当工程师翻开代码，能清晰看出 Agent 的行为从哪里来、受什么约束、何时会失控。这不是一个美学问题——低可读性的 harness 是技术债务，因为无法被工程师维护的控制系统，迟早不再被维护。

### Claude Code

`claude-code/src/utils/claudemd.ts:1-26` 的文件类型注释清晰地解释了每种 CLAUDE.md 的语义，这使文件体系对工程师可读。但 `claude-code/src/constants/systemPromptSections.ts:20-24` 的记忆化 Snippet 在反编译代码里散落多处，全局状态难以追溯。

### Codex

`codex/codex-rs/protocol/src/prompts/base_instructions/default.md` 的结构（Personality → AGENTS.md spec → Responsiveness → Planning → Task execution → Validating）是线性的、对人类工程师可读的。`codex/codex-rs/core/templates/memories/stage_one_system.md` 的 NO-OP 门控逻辑也有明确的注释说明触发条件，这是高可读性的实现。

### Gemini CLI

`gemini-cli/packages/core/src/prompts/snippets.ts:188-191` 里有一处关键的权衡注释：`// ⚠️ IMPORTANT: the Context Efficiency changes strike a delicate balance...`。这类注释对工程师极其有价值——它告诉维护者为什么这段代码必须保持现在的形态，如果改动需要先跑哪些基准测试。这是可读性工程的最佳实践。

### OpenCode

`opencode/packages/opencode/src/permission/index.ts:19-24` 的 Zod Schema 定义和 `opencode/packages/opencode/src/skill/index.ts:28-34` 的 Skill.Info Schema，为 AI 和人类提供了相同的机器可读规范。这是 OpenCode 最突出的可读性优势。

---

## 9. 熵管理（Entropy Management / GC）

熵管理这个维度问的是：当 Agent 持续运行、不断积累上下文和记忆时，这些积累会不会自然走向腐烂？知识积累的必然结局是"过时信息污染新的判断"，除非工程主动设计了清理机制。

- **Claude Code**：`claude-code/src/utils/claudemd.ts:790` 的 `memoize()` 缓存一旦建立就不会主动过期，这意味着 CLAUDE.md 内容的漂移（比如项目规则被废弃但文件未删除）无法被自动检测。这是明确的缺失。
- **Codex**：两阶段管道（Phase 1 并行提取 + Phase 2 整合）是四个工程里唯一真正实现后台 GC 的工程。`consolidation.md` 的 `max_unused_days` 窗口和 usage_count 排序，是在 Agent 运行时自动淘汰过时知识的机制。
- **Gemini CLI**：`hookSystem.ts:226-237` 的 `fireSessionEndEvent` 提供了 session 结束时的清理钩子，但清理行为由 Hook 实现者决定，框架本身没有强制的 GC 策略。
- **OpenCode**：Effect-ts 的 Finalizer 机制（`permission/index.ts:151-160`）保证了资源在 Effect 作用域结束时被清理，但这是 runtime 资源清理，不是知识库漂移检测。无熵管理设计是 OpenCode 的另一个主要工程欠债。

---

## 10. 两种驯化路线

在把前九个维度的观察汇总之后，可以清楚地看到四个工程分别选择了不同的"驯化路线"（Taming Strategy）。理解路线，比理解单个实现细节更重要，因为路线决定了工程的扩展方向和适合的使用场景。

**Claude Code — Runtime-first**：主循环围绕 `claude-code/src/query.ts` 的 query 函数展开；系统提示构建依赖运行时条件（`systemPrompt.ts:41-123`）。这条路线的优势是灵活——可以根据会话状态动态调整行为；风险是隐式约定多，模块级单例状态难以追踪。

**Codex — Control-plane-first**：行为规则写在 Markdown 文件里（`protocol/src/prompts/permissions/approval_policy/`），记忆模板版本化管理。这条路线的优势是行为可预测、变更可审查；代价是团队需要先建立制度（写好 Approval policy），才能享受控制带来的收益。

**Gemini CLI — 混合路线**：Hook System 是推断型控制平面（`hooks/hookSystem.ts`），Snippet 函数是计算型前馈（`prompts/promptProvider.ts`），两者协同工作。这是兼顾灵活性和可测试性的设计，但也意味着调试时需要两个心智模型同时在线。

**OpenCode — Runtime-first（Effect-driven）**：Permission 是运行时 Effect（`permission/index.ts`），Skill 通过 `load()` 异步初始化（`skill/index.ts:126-176`）。Effect-ts 的 Service Layer 理论上提供了很强的可组合性，但当前实现中，各 Service 之间的依赖图尚未被充分利用来建立控制链。

---

## 11. 验证必须独立

验证的独立性是 Harness Engineering 的核心原则之一。如果验证在与执行相同的上下文中进行，验证者会看到和执行者相同的前提假设，确认偏差（Confirmation Bias）就无法被对冲。真正的验证需要在不同的上下文、不同的权限集、甚至不同的代理角色中完成。

- **Claude Code**：`VerifyPlanExecutionTool` 的存在表明有这个设计意图，但 `process.env.CLAUDE_CODE_VERIFY_PLAN === 'true'` 在反编译环境下不触发，实际上是一个死代码路径。主循环在 `query.ts` 里同一上下文内处理工具调用和验证，无对抗确认偏差的机制。
- **Codex**：`consolidation.md` 里的 Phase 2 验证子代理运行在严格限制的环境下（`no approvals, no network, local write access only`，且禁用 collab 防止递归委派）。这是四个工程里唯一真正实现验证隔离的实现。
- **Gemini CLI**：`hookSystem.ts:259-305` 的 BeforeModel/AfterModel 分离使 Hook 链独立于 Agent 执行——Hook 可以在 Agent 运行结果已知之前或之后介入，而不共享 Agent 的决策上下文。29+ eval 文件则在测试层面提供了独立验证覆盖。
- **OpenCode**：Effect-ts 的 ServiceMap 模式在理论上支持角色分离，`Service` 定义（`permission/index.ts:138`）在隔离的 Effect 作用域中运行。但当前架构是单代理，没有多代理验证链。

---

## 12. 团队落地的制度化

一个 Harness Engineering 框架，如果只能由创始工程师维护，那它的价值是脆弱的。我们观察各工程在"团队规模化使用"方面的制度化投入，是因为 Agent 工具的真实挑战往往不在个人使用阶段，而在团队协作与规则继承阶段。

- **Claude Code**：`claude-code/src/utils/claudemd.ts:1-26` 定义了清晰的文件发现顺序和优先级，`.claude/rules/*.md` 的条件规则使团队可以按文件路径分配不同规则集。这是完整的团队治理层级，但缺少 lifecycle 约定文档（何时审查规则、何时清理废弃规则）。
- **Codex**：`codex/docs/agents_md.md` 是专门给团队工程师阅读的 AGENTS.md 规范，`protocol/src/prompts/base_instructions/default.md:17-27` 里的 AGENTS.md 语义给出了嵌套优先规则。这是对团队制度化投入最高的工程。
- **Gemini CLI**：`gemini-cli/packages/core/src/config/memory.ts` 的 `HierarchicalMemory` 接口（global / extension / project 三层）提供了清晰的规则来源层次，每层可由不同角色管理。
- **OpenCode**：`opencode/packages/opencode/src/skill/index.ts:143-157` 的 `Config.directories()` 和 `permission/index.ts:278-290` 的 `Permission.fromConfig()` 提供了配置驱动的制度化路径，但团队协作规范（谁写 Skill、谁审批 Permission 规则）需要团队自行建立。

## 控制平面对比

﻿---
layout: default
title: "02 - 控制平面"
---
<!-- markdownlint-disable MD060, MD024 -->
# 控制平面对比

在分析一个 Agent 工程的 Harness 成熟度时，控制平面是最先必须理解的部分，原因很直接：**所有其他控制机制——Skill、Hook、Permission、工具约束——都必须经过控制平面才能触达 Agent**。如果控制平面自身不清晰，后面的一切精细化投入都可能被吞没在混乱的优先级里。

控制平面的核心问题有三个：指令从哪里来、如何组合、冲突时谁赢。回答清楚这三个问题，就能知道一个工程的控制可预测性有多高，以及团队在它上面建立规则的成本有多低。

---

## 1. System Prompt 分层组织

System Prompt 是 Agent 最持久的控制信号源——它在每次请求时都存在，优先级通常高于对话历史。一个设计良好的 System Prompt 体系，能让工程师通过修改文件来改变 Agent 行为，而不必修改代码或重启服务。我们分析 System Prompt 的分层方式，是为了判断"加一条规则需要改多少地方"以及"规则来源对团队是否可见"。

### Claude Code

Claude Code 的 `buildEffectiveSystemPrompt()`（`claude-code/src/utils/systemPrompt.ts:41-123`）定义了四个互斥的组合路径：最高优先级的 `overrideSystemPrompt` 直接替换所有其他内容，其下是 Coordinator 模式专用 prompt，再下是内置/自定义 Agent prompt，最底层是标准 `defaultSystemPrompt`。

```typescript
// claude-code/src/utils/systemPrompt.ts:56-57
if (overrideSystemPrompt) {
  return asSystemPrompt([overrideSystemPrompt])
}
```

这个结构的设计意图是清晰的：不同的运行模式（REPL、协调器、子 Agent）用不同的 prompt 路径，互不干扰。但这也意味着系统提示的内容分散在 TypeScript 代码里，不是独立的文本文件——改一条行为规则，你需要找对代码位置，而不是只编辑一个 Markdown 文档。

### Codex

Codex 的 System Prompt 完全由 Markdown 模板文件承载，这是一个根本性的设计差异。`codex/codex-rs/protocol/src/prompts/base_instructions/default.md:1-276` 是主规范，276 行全部是可读的结构化文本。协作模式通过独立目录（`collaboration_mode/pair_programming.md`、`plan.md`、`execute.md`）分类管理，压缩 prompt 也有独立文件（`compact/prompt.md`）。

这个架构的含义是：行为规则是可版本化的代码仓库文件，任何 diff 都能被代码审查过程捕捉。工程师不需要懂 TypeScript 就能修改 Agent 行为，也不需要重新编译就能看到变更效果。代价是：没有类型检查来保证 prompt 格式的合法性。

### Gemini CLI

Gemini CLI 的 `getCoreSystemPrompt()`（`gemini-cli/packages/core/src/prompts/promptProvider.ts:38-265`）代表了第三种路线：prompt 作为函数组合。每个维度（preamble、coreMandates、hookContext、planningWorkflow 等）都是独立的 snippet 函数，最终结果是所有 snippet 的拼接：

```typescript
// snippets.ts:123-150
export function getCoreSystemPrompt(options: SystemPromptOptions): string {
  return `
${renderPreamble(options.preamble)}
${renderCoreMandates(options.coreMandates)}
${renderSubAgents(options.subAgents)}
${renderAgentSkills(options.agentSkills)}
${renderHookContext(options.hookContext)}
${options.planningWorkflow ? renderPlanningWorkflow(options.planningWorkflow) : renderPrimaryWorkflows(options.primaryWorkflows)}
${options.taskTracker ? renderTaskTracker(options.taskTracker) : ''}
${renderOperationalGuidelines(options.operationalGuidelines)}
${renderInteractiveYoloMode(options.interactiveYoloMode)}
${renderSandbox(options.sandbox)}
${renderGitRepo(options.gitRepo)}
`.trim();
}
```

这种方式的优势是：每个 snippet 函数可以单独测试，条件渲染逻辑（如 `planningWorkflow` 二选一）有明确的 TypeScript 类型约束。劣势是：最终 prompt 的内容需要运行代码才能看到，不如 Codex 的 Markdown 文件直观。

### OpenCode

OpenCode 的 System Prompt 是 Effect-ts 驱动的动态构建，配置定义在 `opencode/packages/opencode/src/config/config.ts`。与其说它有固定的控制平面，不如说它的控制平面是 Effect 服务网络运行时的涌现结果。这在理论上提供了极高的组合灵活性，但也意味着从代码到最终 prompt 的推导路径不是线性的，需要追踪 Effect 执行图才能理解。

### 横向对比

四种方式代表了控制平面显式性的光谱：Codex（Markdown 文件，最显式）→ Gemini CLI（Snippet 函数，次显式）→ Claude Code（TypeScript 硬编码，需要读代码）→ OpenCode（Effect 运行时，需要追踪执行图）。显式性越高，团队治理成本越低，但灵活性也相应降低。

---

## 2. 指令文件体系

除了 System Prompt 本身，各工程还提供了让用户在磁盘上放置指令文件来影响 Agent 行为的机制。这个机制是 Harness Engineering 里"团队规则版本化"的关键路径：把 Agent 行为写进普通文件，纳入 Git 版本控制，就能在代码审查过程中讨论和治理 Agent 行为。

### Claude Code

Claude Code 的指令文件系统（`claude-code/src/utils/claudemd.ts:1-26`）是四个工程里最完备的：

```
1. Managed memory (/etc/claude-code/CLAUDE.md) — 全局策略（系统管理员管理）
2. User memory (~/.claude/CLAUDE.md) — 用户全局指令
3. Project memory (CLAUDE.md, .claude/CLAUDE.md, .claude/rules/*.md) — 代码库指令
4. Local memory (CLAUDE.local.md) — 私有项目指令（不应提交 Git）
```

`@include` 指令（`claude-code/src/utils/claudemd.ts:448-535`）支持从一个 CLAUDE.md 引用另一个文件，实现规则复用，且有循环引用检测（MAX_INCLUDE_DEPTH = 5）。`.claude/rules/` 目录还支持条件规则（通过 frontmatter `paths` 字段按文件路径生效），实现"只对后端代码生效的规则"这类精细控制。

这套体系的问题不在设计，而在维护文化：如果团队没有定期审查和清理废弃规则的惯例，四层文件体系就会随时间积累大量过时内容，而 Agent 仍然会读取它们。

### Codex

Codex 把 AGENTS.md 的语义直接写进了 Agent 行为规范（`codex/codex-rs/protocol/src/prompts/base_instructions/default.md:17-27`）：

```markdown
# AGENTS.md spec
- Repos often contain AGENTS.md files
- Instructions in AGENTS.md files:
    - The scope of an AGENTS.md file is the entire directory tree rooted at the folder that contains it
    - For every file you touch in the final patch, you must obey instructions in any AGENTS.md file whose scope includes that file
    - More-deeply-nested AGENTS.md files take precedence in the case of conflicting instructions
```

这里有一个重要的设计决策：不是"Agent 会读取这些文件"，而是"Agent 必须遵守这些文件，针对它触碰的每个文件"。范围绑定（`scope = 包含该目录的树`）和优先级规则（更深嵌套越优先）都被明确量化，减少了歧义。

### Gemini CLI

Gemini CLI 的 GEMINI.md 体系通过 `memory.ts` 的 `HierarchicalMemory` 接口（global / extension / project 三层）组织。上下文文件的发现通过 `getAllGeminiMdFilenames()`（`promptProvider.ts:73`）触发，结果被注入 System Prompt 的 hookContext 部分。Skill 渲染在 `snippets.ts:107-115` 中进行，与记忆加载是解耦的两条路径。

### OpenCode

OpenCode 的 Skill 系统（`opencode/packages/opencode/src/skill/index.ts:21-27`）使用三种 glob 模式：

```typescript
const EXTERNAL_SKILL_PATTERN = "skills/**/SKILL.md"
const OPENCODE_SKILL_PATTERN = "{skill,skills}/**/SKILL.md"
const SKILL_PATTERN = "**/SKILL.md"
```

这允许 Skill 文件存放在多种约定路径下，并支持从远程 URL 拉取（`skill/index.ts:126-176` 的 `load()` 方法）。这是四个工程里唯一支持远程 Skill 拉取的实现，意味着 Skill 库可以和代码库分离存储和版本化。

---

## 3. 指令优先级与覆盖规则

规则冲突是团队使用 Agent 时不可避免的问题：用户规则和项目规则冲突时谁赢？新指令和旧记忆冲突时呢？如果工程没有明确的冲突解决规则，Agent 的行为就会变得不可预测，团队无法信任它在边界情况下的选择。

### Claude Code

Claude Code 的加载顺序遵循"后加载的优先"原则（`claude-code/src/utils/claudemd.ts:9`）：

```
Local > Project > User > Managed（优先级从高到低）
```

路径条件规则有额外的基准点规则：Managed/User 规则相对于 original CWD 生效，Project 规则相对于包含 `.claude/` 的目录生效。这意味着一个全局工具规则和一个项目特定规则在路径计算上的基准点是不同的，工程师需要记住这个细节才能正确预测行为。

### Codex

Codex 的冲突解决遵循两条明确原则：深嵌套 AGENTS.md 优先，直接系统/开发者/用户指令（作为 prompt 的一部分）优先于 AGENTS.md 指令（`default.md:26`）。这意味着：如果你在会话里直接说"忽略 AGENTS.md 里的 X 规则"，Agent 应该服从。这是一个有意识的设计选择，把直接指令的优先级置于文件规则之上，避免静态文件阻断动态需求。

### Gemini CLI

Gemini CLI 的覆盖通过 Snippet 函数的条件渲染实现：`planningWorkflow` 和 `primaryWorkflows` 是两选一，`interactiveYoloMode` 在 YOLO 模式下会覆盖标准交互指南。这是隐式优先级——你必须读源码才能知道哪个 snippet 在哪种模式下会被哪个覆盖。

### OpenCode

OpenCode 的 Permission 规则通过 `merge()` 函数叠加（`permission/index.ts:292-294`）：

```typescript
export function merge(...rulesets: Ruleset[]): Ruleset {
  return rulesets.flat()
}
```

规则集的平铺意味着后来的规则不覆盖早先的，而是并列存在，由 `disabled()` 函数的逻辑决定最终效果。这比"后加载优先"的 Claude Code 更复杂，但也更灵活——你可以组合多个规则集而不担心它们相互覆盖。

---

## 4. Prompt 作为控制平面而非人格装饰

这是一个分析角度，不是一个代码实现层面的维度。我们通过它来判断：各工程的 Prompt 工程师是否意识到 System Prompt 是**工程控制信号**，而不只是"让 AI 说话更礼貌的地方"。只有当 Prompt 被当作控制平面设计时，它才能有效承担 Harness 职能。

**Claude Code** 的 `overrideSystemPrompt` 直接替换所有其他内容（`systemPrompt.ts:56-57`），这表明系统设计者清楚地知道某些情况下需要完全重置控制信号，而不是叠加修补。Coordinator 模式使用专用 prompt（`systemPrompt.ts:67-75`），而非在默认 prompt 上打补丁，也表现出相同的工程意识。

**Codex** 的行为规范（`default.md:131-144`）里的 Validating 章节：

```markdown
## Validating your work
If the codebase has tests or the ability to build or run, consider using them to verify that your work is complete.
```

这不是在描述 Claude 的"个性"，而是在规定 Agent 在任务完成后必须执行的检查流程。这是控制平面视角的典型写法。

**Gemini CLI** 的 `snippets.ts:188-191` 里有一处不寻常的工程注释：

```typescript
// ⚠️ IMPORTANT: the Context Efficiency changes strike a delicate balance...
// You must run the major benchmarks, such as SWEBench, prior to committing any changes...
```

这条注释的存在说明：这段 Prompt 代码的设计者不认为它是文案，而是认为它是影响基准测试分数的工程代码，修改之前需要先跑测试。这是把 Prompt 当控制平面的最直接体现。

**OpenCode** 的 `Permission.Action`（`permission/index.ts:22-25`）把权限决策建模为一个强类型枚举（allow/deny/ask），而非一段自然语言描述。这意味着权限控制的粒度是机械执行的，不依赖 Agent 对自然语言规则的理解。这是控制平面设计而非人格装饰的最纯粹形式。

---

## 总结对比表

| 维度 | Claude Code | Codex | Gemini CLI | OpenCode |
|------|-------------|-------|------------|----------|
| Prompt 来源 | TypeScript 硬编码 + 模板片段 | Markdown 模板文件 | Snippet 函数组合 | Effect-ts 配置 |
| 文件发现 | 向上遍历 CWD，四层优先级 | AGENTS.md 语义（范围绑定） | GEMINI.md 三层层级 | Skill 目录扫描 + URL pull |
| 优先级规则 | Local > Project > User > Managed | 嵌套优先 + Direct 最高 | Snippet 条件组合 | Permission merge 叠加 |
| 覆盖机制 | overrideSystemPrompt 完全替换 | Direct 指令优先于文件指令 | interactiveYoloMode 覆盖 | Effect 层叠（非覆盖） |
| 控制平面显式度 | 高（4 层明确，有文档） | 高（AGENTS.md 规范完备） | 中（需读源码理解条件组合） | 中（Schema 清晰，执行图复杂） |

**一句话判断**：Codex 的控制平面对团队工程师最透明（Markdown 文件 + 规范文档），Claude Code 的控制平面最完备（四层文件体系），Gemini CLI 的控制平面最可测试（snippet 函数），OpenCode 的控制平面在 Effect-ts 架构下最灵活但可读性最低。

理解控制平面之后，我们才能有意义地讨论前馈控制（[03-feedforward-controls](./03-feedforward-controls.md)）——因为所有前馈信号都要经过控制平面才能进入 Agent。

## 前馈控制横向对比

# 前馈控制横向对比

前馈控制的核心逻辑是：**不要等 Agent 犯错再纠正，而是在行动之前把正确的约束、知识和流程注入它的上下文**。这里有一个隐含假设：如果你能预测哪类错误会发生，就能提前设计机制来防止它。这个假设不总是成立，但在编程 Agent 的场景里，很多错误是系统性的——跳过测试、变更未指定的文件、使用废弃 API——这些都可以通过前馈机制显著降低发生率。

我们把前馈控制分成计算型和推断型两个轴来分析，原因是它们的可靠性截然不同。计算型前馈（类型系统、Linter、Allowlist）是机械执行的，违反规则就会被拒绝；推断型前馈（AGENTS.md、Skill、Prompt 规范）依赖语言模型去理解并遵守，存在被忽略或误解的概率。一个成熟的 harness 应该先用计算型覆盖高风险操作，再用推断型处理计算型无法表达的复杂约束。

---

## 计算型前馈控制

### 类型系统严格度

类型系统是最便宜的计算型前馈：它在你编写工具代码时实时约束你，而不需要为此运行任何测试。一个严格的类型系统能让工程师在为 harness 添加新功能时，立刻发现接口不兼容或空值传播的问题。我们考察各工程的类型系统状况，是因为类型系统的有效性直接决定了 harness 的维护摩擦——类型系统失效的工程，每次改动都需要更多的手动验证。

#### Claude Code

`claude-code/tsconfig.json` 是 Claude Code 类型系统状态的唯一真相来源，而这里的真相令人警醒：整个项目有约 1341 个 tsc 错误。这是反编译副作用造成的——源码在分发前被混淆和打包，反编译过程无法完美恢复类型信息。

运行时工具是 Bun，Bun 对类型错误比 tsc 更宽容，所以 Claude Code 能正常运行。但这意味着：类型系统作为前馈控制，在这个工程里已经实际失效。工程师向 Claude Code 添加新工具时，编辑器和编译器都无法提供可靠的类型安全保证。这是分析 Claude Code 时必须记住的基础事实，它的影响会渗透到后续所有维度的评估中。

#### Codex

`codex/codex-rs/Cargo.toml` 声明了完整的 Rust 依赖树。Rust 的 borrow checker 是此次对比中最强的类型系统：它在编译期强制内存安全（无空指针、无数据竞争），这些保证不需要任何运行时代价，也不依赖测试覆盖率。

Rust 类型系统作为前馈控制的有效性是毋庸置疑的：如果一段代码能够通过 `cargo build`，它就不会产生整类型的运行时错误。这不是"减少了一些风险"，而是"在类型系统能覆盖的范围内，完全消除了这类风险"。代价是编译时间和学习曲线，但对 harness 的可靠性贡献是实质性的。

#### Gemini CLI

`gemini-cli/packages/core/src/tools/tool-registry.ts` 的工具注册表用 TypeScript 接口定义了工具契约。TypeScript strict mode 在正常项目里是有效的前馈控制，但其有效性取决于两个条件：tsconfig 里严格标志是否全部开启，以及代码里有多少 `as any` 和 `@ts-ignore` 绕过了类型检查。总体评价是中等有效：比无类型更好，但比 Rust 的编译期保证弱得多。

#### OpenCode

OpenCode 使用 Zod 进行运行时验证，见 `opencode/packages/opencode/src/permission/index.ts:19-24`。Zod 的关键区别在于：它是**运行时**验证，不是编译期验证。这意味着类型不合法的数据在被 Zod 检测到之前，仍然可以在代码里流动。Effect-ts 的类型系统提供了一定的编译期保证，但 `z.record(z.string(), z.any())` 这类宽松 schema 在实践中削弱了严格性。

**横向对比**：类型系统严格度排序为 Codex（Rust，编译期保证）> Gemini CLI（TypeScript，中等）≈ OpenCode（Zod，运行时）>> Claude Code（TypeScript 失效，~1341 错误）。这个排序向后渗透：越靠前的工程，harness 代码的维护摩擦越低。

### Linter 配置

Linter 是编辑期/提交期的计算型前馈：它在代码进入版本库之前，通过静态分析捕捉风格违规、潜在 bug 和反模式。对 harness 工程来说，Linter 的意义在于：它让 harness 代码本身保持一致性，降低"harness 代码变成 harness 负担"的风险。

**Claude Code**：无可见的独立 ESLint 或 Biome 配置。`tools.ts:14-135` 的条件导入（通过 feature flag）使静态分析更难有效工作，因为 Linter 无法知道哪些分支实际会执行。Linter 覆盖缺失，这与类型系统失效共同构成了计算型前馈工具链的双重缺失。

**Codex**：Rust 生态的 Clippy（通过 `cargo clippy`）提供超越标准 Lint 的语义分析，能检测常见 Rust 错误模式（如不必要的 clone、错误的迭代器使用）。Clippy 在 CI 里默认运行，覆盖质量在各语言生态里属于顶级。

**Gemini CLI**：无独立 Linter 配置可见。`confirmation-policy.test.ts` 等测试文件部分替代了 Linter 的角色——通过测试来保证行为边界正确，而不是通过静态分析来保证代码形式合规。测试和 Linter 不是等价的，但在实际效果上有部分重叠。

**OpenCode**：Bun 工具链包含基本格式化，但无独立 Linter。`ConfigMarkdown.parse()` 在 `skill/index.ts:72-102` 里对 Skill 文件 frontmatter 进行结构验证，是领域特定的结构 Lint，不覆盖通用代码质量。

### Pre-commit Hooks

四个工程都没有可见的 pre-commit hooks 配置。这个发现本身是有意义的：所有四个工程都没有在代码提交前强制执行最后一道计算型检查。在 harness 工程里，pre-commit hooks 的价值在于防止格式错误的规则文件进入版本库并成为 Agent 的有效输入。这是四个成熟 Agent 工具工程共同的盲区，也是最容易以低成本补充的前馈机制。

### 架构依赖约束

超出 Lint 之外，工程是否对模块间依赖关系有机械执行的架构约束？如果有，工程师在错误的位置调用服务时能立刻发现；如果没有，架构腐烂只能靠代码审查和人工约定来防止。

#### Claude Code

**证据**: `claude-code/src/constants/tools.ts:36-112` — 工具 Allowlist

```typescript
export const ALL_AGENT_DISALLOWED_TOOLS = new Set([
  TASK_OUTPUT_TOOL_NAME,
  EXIT_PLAN_MODE_V2_TOOL_NAME,
  // ...
])
export const ASYNC_AGENT_ALLOWED_TOOLS = new Set([
  FILE_READ_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME,
  // ...
])
```

这是工具级边界约束——有效且直接，但粒度较粗。模块间的服务依赖关系（哪个 Service 可以调哪个 Service）没有机械执行的保证，完全依赖约定。

#### Codex

`codex/codex-rs/protocol/src/prompts/permissions/approval_policy/` 的四种 approval policy 文件（`never.md`、`on_failure.md`、`on_request_rule_request_permission.md`、`unless_trusted.md`），加上 `execpolicy` 对 shell 命令的约束，构成两层正交约束：approval policy 管"何时需要人工批准"，exec policy 管"允许执行哪些命令"。两层不冗余，合在一起才覆盖完整的工具执行决策树。这是四个工程里架构依赖约束最系统化的实现。

#### Gemini CLI

`gemini-cli/packages/core/src/core/prompts.ts:20-40` 的系统 prompt 组合是 prompt 级约束，不是代码级机械执行。工具调用的约束依赖 prompt 里的规则描述，而非代码层面的拦截机制。架构依赖约束中等。

#### OpenCode

`opencode/packages/opencode/src/permission/index.ts:292-307` 的 `Permission.disabled()` 函数静态分析工具列表，是 OpenCode 里最接近机械执行的架构约束，但粒度限于工具级，不覆盖模块服务依赖。

---

## 推断型前馈控制

推断型前馈依赖 Agent 读取自然语言规则并主动遵守它们。这不是弱控制，而是概率性控制——在大多数情况下有效，但不能在单次执行层面保证。它的优势是能表达计算型前馈无法量化的复杂约束（如"在重构前先理解代码意图"）。推断型前馈的质量，很大程度上取决于规则的写法：模糊的规则会产生模糊的遵守，这就是为什么结构化的规则文档比散文式文档更有价值。

### Skills/How-to 机制

Skill 是推断型前馈的核心载体：它告诉 Agent"遇到这类任务要这样做"，把团队的最佳实践注入 Agent 的任务执行流程，而不是依赖 Agent 从零开始推断。Skill 的存在意义在于：经验可以被显式化、版本化、复用，而不是只活在工程师的头脑里。

**Claude Code**：`src/tools/SkillTool/` 实现了 Skill 工具，在 `tools.ts:212` 注册。Skill 通过 CLAUDE.md 的 @include 引用链注入，没有独立的版本化管理机制。Skill 和普通上下文文件耦合在同一套加载体系里，无法单独审计 Skill 覆盖范围。

**Codex**：`codex/.codex/skills/` 目录提供基于 frontmatter 的结构化 Skill 定义（`codex/codex-rs/skills/src/assets/samples/skill-installer/SKILL.md`）。frontmatter 定义了 Skill 的元数据（名称、触发条件、版本），使 Skill 库的管理有结构可循，比自由格式更规范。Skill 文件是独立的版本化资产。

**Gemini CLI**：`activate-skill.ts` 的 `ActivateSkillTool` 把 Skill 建模为"Agent 可主动激活的工具"，而不是"隐式注入的上下文"（`snippets.ts:107-115`）。这要求 Agent 先识别需要哪个 Skill 再调用 `ActivateSkillTool`，增加了一层推断，但也让 Skill 的使用在对话记录里更可见、可审计。

**OpenCode**：`skill/index.ts:1-262` 是四个工程里最完整的 Skill 系统实现：Zod Schema 验证结构合法性，glob 目录扫描支持多种约定路径，URL 远程拉取支持跨仓库 Skill 共享，且有失效回退逻辑（`add()` 函数里的 try-catch）。URL pull 是特别值得注意的能力：它允许团队把 Skill 库独立维护在另一个仓库，实现 Skill 版本化和跨项目复用。

### AGENTS.md 的 ToC vs 百科全书结构

规则文件的结构影响 Agent 对它的遵守质量——这不是抽象的，而是可以量化的：一份有清晰目录、每条规则独立成段的文档，Agent 从中提取和遵守规则的准确率高于散文式长文档。我们分析各工程的规则文件结构，是因为"文件写了什么"和"Agent 从文件里能提取出什么"之间有一个执行摩擦，这个摩擦可以通过结构改善。

**Claude Code**：实现代码 `claudemd.ts` 是 1166 行单文件，体现了一种百科全书式的文化倾向。实际的 CLAUDE.md 文件没有强制结构约定，内容质量完全取决于写作者的意识。对 Agent 来说，从无结构的长文档提取规则比从有目录的分节文档提取的准确率更低。这是 Claude Code 推断型前馈质量的隐性短板。

**Codex**：`default.md` 的 276 行按主题分节（Personality → AGENTS.md spec → Responsiveness → Planning → Task execution → Validating），每个节都有明确的 `##` 标题。Agent 可以通过标题快速定位相关规则，而不必解析整个文档。这是四个工程里规则文档最结构化的实现。

**Gemini CLI**：`snippets.ts` 的 Snippet 函数组合是更激进的 ToC 结构：每个主题是独立的函数，有独立参数类型。不同主题的规则在代码层面完全隔离，可以独立修改和测试。这是"把 prompt 当代码"的极致实现。

**OpenCode**：Skill 文件有强制的 frontmatter 结构（由 Zod Schema 验证），保证了基本格式一致性。但 Skill 文件内容结构没有约定，工程师仍然可以写成散文格式。

### 文档即规约的完备程度

推断型前馈的最终效果，取决于规则文档的规约完备性：是否清楚地说明了期望的行为、不期望的行为、判断的优先级？规约不完备的文档，会让 Agent 在边界情况下产生难以预测的行为。

**Claude Code**：规约完备程度高（四层文件体系有详细加载语义），但组织形式是百科全书式——大量规则混在一起，缺少优先级标记，Agent 在边界情况下需要自行推断哪条规则优先。

**Codex**：`codex/docs/agents_md.md` 是给工程师读的 AGENTS.md 规范，`default.md` 里的 AGENTS.md spec 是给 Agent 读的同一套规范。两个受众的文档分开维护——这是规约完备性最高的实现，也是其他三个工程应该借鉴的模式。

**Gemini CLI**：`snippets.ts:188-191` 的关键权衡注释（`// ⚠️ IMPORTANT: the Context Efficiency changes strike a delicate balance...`）解释了为什么这段代码必须保持现状，以及改动的前置条件。这是部分规约——覆盖了"为什么"，但没有专门的规约文档。

**OpenCode**：`permission/index.ts` 的 Zod Schema 和类型定义把规约写进了代码里，避免了文档和代码不同步的问题。但对不熟悉 Effect-ts 的工程师来说，读代码比读文档更难快速理解规约的全貌。

---

## 横向对比表：三维前馈覆盖评分

| 工程 | Maintainability | Architecture Fitness | Behaviour |
|------|-----------------|---------------------|-----------|
| Claude Code | **3** — 分层文件体系完整，但类型系统失效，百科全书结构削弱规约清晰度 | **3** — Feature flag + 工具 Allowlist，但 feature() 始终 false | **2** — VerifyPlanExecutionTool 存在但 feature-flagged |
| Codex | **4** — Rust 类型 + Clippy + AGENTS.md 规范完备 | **4** — Approval policy + Exec policy 双层机械执行 | **4** — 两阶段记忆管道 + outcome 标签实现持续行为约束 |
| Gemini CLI | **4** — vitest + 29+ eval 文件全覆盖 | **3** — Snippet 函数边界清晰，但无跨模块机械执行约束 | **3** — Hook System 提供生命周期约束 |
| OpenCode | **3** — Effect-ts + Zod 结构验证 | **3** — Effect Layer 强制依赖注入，Permission Schema 清晰 | **3** — Permission 即代码，但无持续漂移检测 |

**核心发现**：前馈机制的有效性上限由[控制平面](./02-control-plane.md)的显式度决定。Codex 控制平面最透明，四个前馈维度都有实质性实现；Claude Code 控制平面的 feature flag 体系因反编译失效，直接导致 Behaviour 维度的前馈评分最低。接下来的[反馈控制](./04-feedback-controls.md)，关注的是当前馈防线被穿透之后，工程如何发现和纠正。

## 反馈控制横向对比

# 反馈控制横向对比

如果说前馈控制是在行动之前建立约束，那反馈控制就是在行动之后检测偏差并提供修正信号。两者共同构成控制论意义上的闭环。在 Agent 系统里，反馈控制格外重要，因为 Agent 的行动空间极大，前馈无法穷举所有情况——Agent 总会在某些前馈没有覆盖到的地方做出意想不到的事情。

反馈控制的质量可以从三个维度衡量：**速度**（多快能检测到偏差）、**精度**（检测的误报率是多少）、**可操作性**（检测到问题后有没有清晰的纠正路径）。我们分析四个工程的反馈控制，就是为了看清楚这三个维度上的差距，以及谁建立了真正的闭环，谁只有单向的信号发送。

---

## 计算型反馈控制

计算型反馈控制的优势和前馈类似：机械执行、确定性、低误报。在反馈语境里，计算型意味着"通过代码检测偏差"，而不是通过人的观察或模型的判断。

### 测试结果回注入 Agent Context

测试是软件工程里最经典的反馈机制：写代码、运行测试、看结果、修正。在 Agent 编程里，同样的循环需要被设计进 Agent 的工作流，而不是等人类在外部观察测试结果后再手动告诉 Agent。我们看各工程是否把测试结果作为结构化信号回传给 Agent，而不只是让 Agent 看到原始的命令行输出。

**Claude Code**：`claude-code/src/query.ts` 的主查询循环处理工具调用的返回值，把 tool result 直接注入对话历史。这意味着如果 Agent 运行了测试，测试输出会被注入上下文，Agent 可以看到它。但这是非结构化的——测试输出是原始文本，没有被解析成结构化的"失败/通过/未覆盖"信号。Agent 需要自己从原始文本里推断测试结果，这是推断型反馈而非计算型。

**Codex**：`codex/codex-rs/core/templates/memories/stage_one_system.md:42-51` 定义了 Phase 1 的结构化输出格式（`raw_memory`、`rollout_summary`、`rollout_slug`）。这不是"测试输出",而是把整个任务执行过程——包括测试结果——提炼成结构化的记忆记录。通过 outcome 标签（success/partial/uncertain/fail）量化任务质量，这是计算型反馈信号的典型实现。

**Gemini CLI**：`gemini-cli/packages/core/src/hooks/hookSystem.ts:259-305` 的 `fireAfterModelEvent`，以及 `gemini-cli/evals/test-helper.ts` 的测试辅助工具，共同提供了事件化反馈。Hook System 使得外部测试结果可以在 AfterModel 事件里被注入并影响下一轮决策。29+ eval 文件为 Agent 行为提供了自动化的反馈覆盖。

**OpenCode**：`opencode/packages/opencode/src/permission/index.ts:260-264` 的 `Permission.list()` 返回待处理的权限请求列表。这是有限的结构化反馈：它告诉调用者"有哪些权限决策在等待"，但不提供任务执行质量的反馈。

### Lint 报告 Remediation 指令

一个优秀的反馈控制不只是"发现问题"，还要"告诉 Agent 如何修正"。Lint 报告如果能附带 remediation 指令，Agent 就不需要从零推断如何修复，而是可以直接按照建议执行——这大幅降低了修复的推断成本。

**Claude Code**：无原生 Linter 配置，因此也没有结构化的 Lint Remediation 指令流程。测试/Lint 失败后，Agent 只能从原始输出里推断修复方向。

**Codex**：`codex/codex-rs/apply-patch/apply_patch_tool_instructions.md` 包含验证要求和使用说明，这是部分 remediation 指令——它告诉 Agent 如何正确使用 patch 工具，减少因工具误用导致的失败。但它不是动态的"基于当前 Lint 结果的修复建议"。

**Gemini CLI**：无独立 Linter，但 eval 套件的失败报告是结构化的（`evalTest` 函数返回断言结果），可以通过 Hook 注入具体的修复上下文。

**OpenCode**：`opencode/packages/opencode/src/permission/index.ts:83-103` 定义了三种错误类型（`RejectedError`、`CorrectedError`、`DeniedError`）。`CorrectedError` 特别有意义：它携带了"应该是什么"的信息，而不只是"不对"的信号——这是 remediation 指令的一种形式。

### Hooks 的阻断与回调机制

Hook 是反馈控制里最直接的干预机制：它允许在 Agent 执行流程的特定点上注入检查逻辑，如果检查失败，可以阻断执行或修改参数。Hook 机制存在与否，决定了反馈控制是"观察型"还是"干预型"——前者只能事后发现，后者可以在问题造成损害前阻断。

**Claude Code**：`claude-code/src/utils/hooks/postSamplingHooks.ts` 提供了采样后 Hook，`claude-code/src/utils/hooks.js` 是 Hook 执行入口。Hook 机制存在，但实际在生产中的触发状态需要结合 feature flag 系统判断——由于 feature() 始终返回 false，依赖 feature flag 的 Hook 分支可能不实际运行。

**Codex**：`codex/codex-rs/core/templates/memories/stage_one_system.md:15-26` 定义了 Phase 1 的 NO-OP 门控：如果没有足够的信号，Phase 1 返回空，不入库。这是一种"阻断"的反馈逻辑——不是所有执行都会产生记忆，只有通过信号门控的才会。这比"把所有输出都写进记忆库"更克制，也更正确。

**Gemini CLI**：`hookSystem.ts:259-305` 的 `fireBeforeModelEvent` 包含显式的 `hookOutput?.shouldStopExecution()` 阻断路径。BeforeModel/AfterModel 的分离使 Hook 可以在 Agent 决策前（预防性阻断）或决策后（后验性修正）两个时间点介入。这是四个工程里 Hook 机制最完整的实现。

**OpenCode**：`opencode/packages/opencode/src/permission/index.ts:166-201` 的 `ask()` 方法通过 `Deferred.await()` 挂起执行，等待用户决策。这本质上是一个"挂起 + 回调"的 Hook 模式，由 Effect-ts 管理竞争条件。区别在于：这是人工审批型 Hook，不是自动化检查型 Hook。

---

## 推断型反馈控制

推断型反馈控制的核心是：用语言模型来判断 Agent 的输出质量，并产生修正信号。这类控制比计算型更灵活——它能评估代码可读性、设计合理性、注释清晰度等无法机械量化的质量维度。代价是：推断型判断本身也可能出错，且成本更高。

### 代码审查 Agent 作为独立角色

让 Agent 自我审查是一种天然的直觉：Agent 写完代码后，再让同一个或另一个 Agent 来审查。问题在于：如果审查者和执行者共享上下文（包括相同的前提假设、记忆、偏见），审查的独立性就大打折扣。独立的审查 Agent 需要在不同的上下文里工作。

**Claude Code**：无独立审查 Agent。主循环在 `query.ts` 里同一上下文内处理工具调用和任务验证，确认偏差无法被对冲。

**Codex**：`codex/codex-rs/core/templates/review/history_message_completed.md` 和 `history_message_interrupted.md` 把审查设计成独立的阶段，有专属的模板。审查阶段有自己的提示词，引导审查者从执行记录里推断任务结果，而不是继承执行者的主观判断。

**Gemini CLI**：`gemini-cli/packages/core/src/agents/generalist-agent.ts` 是 Agent 实现，但无专用审查 Agent。审查功能通过 Hook System（BeforeModel/AfterModel）部分实现，但 Hook 和执行共享同一个 Agent 实例。

**OpenCode**：无审查 Agent。单代理架构，所有决策在同一上下文内完成。

### 自纠正循环的轮数限制

Agent 自纠正循环（Agent 遇到失败 → 分析失败 → 尝试修复 → 再次检查）是反馈控制里最常见的模式。但无限的自纠正循环会变成死循环——Agent 在同一个错误上反复尝试，消耗大量 token 和时间而不产生进展。显式的轮数限制是一种终止条件，防止反馈循环变成资源消耗。

**Claude Code**：`claude-code/src/query.ts` 主循环无明确的自纠正轮数限制可见。Agent 可以在工具调用失败后无限次重试，直到 token 耗尽或用户中断。这是一个显著的设计缺失。

**Codex**：`stage_one_system.md:559-565` 的 Phase 1 工作流定义了固定的步骤序列（Apply minimum-signal gate → Triage outcome → Read rollout → Return structured output），这个序列是有限的，不存在无限重试路径。每次 rollout 都会产生一个结果（即使是空结果），不会死循环。

**Gemini CLI**：`hookSystem.ts:267-273` 的 `shouldStopExecution()` 提供了显式的终止路径。当 Hook 判断执行应该停止时，循环可以被主动终止，而不是等待 token 耗尽。

**OpenCode**：`permission/index.ts:166-201` 的 `ask()` 等待用户响应，把终止决策交给人类。这是有终止条件的（用户总会最终回应），但终止的时机和原因完全由人类控制，不是自动化的。

### LLM-as-Judge 质量打分

LLM-as-Judge 是一种推断型反馈：用另一个模型调用来评估当前模型的输出质量，产生结构化的质量分数或标签。这类评估能覆盖无法机械量化的质量维度，但需要额外的推断成本，且评估结果本身也是概率性的。

**Claude Code**：无可见的 LLM-as-Judge 实现。质量判断完全依赖工具执行结果（成功/失败）和用户的主观反馈。

**Codex**：`stage_one_system.md:150-201` 的 Task Outcome Triage 是最接近 LLM-as-Judge 的实现：Phase 1 的 Agent 读取 rollout 历史，为每次任务打上 outcome 标签（success/partial/uncertain/fail），并提取 preference evidence（Agent 的行为偏好证据）。这不是一个独立的 Judge 模型，而是让同一个模型在不同的上下文（Phase 1 的 system prompt）里充当评估者。

**Gemini CLI**：`gemini-cli/evals/validation_fidelity.eval.ts` 的验证保真度 eval，通过 eval 框架对 Agent 行为做定量评估。Eval 框架是 LLM-as-Judge 的一种形式：用预定义的断言对 Agent 输出做判断。29+ eval 文件提供了广泛的覆盖。

**OpenCode**：无 LLM-as-Judge 机制可见。质量判断完全依赖人工审批（Permission.ask()）。

---

## Shift-Left 分布分析

Shift-Left 是质量管理的核心原则：越早发现问题，修复成本越低。在反馈控制里，我们把检测时机分为三个层次，并观察各工程在每个层次上的覆盖情况。这个分析之所以重要，是因为一个只有 L3（运行时持续监控）的工程，每次问题发现时损失已经发生；而一个 L1（提交前检查）覆盖全面的工程，大多数问题在造成损害前就被阻断了。

| Level | Claude Code | Codex | Gemini CLI | OpenCode |
|-------|-------------|-------|------------|----------|
| **L1（自纠正/提交前）** | **2** — MAX_INCLUDE_DEPTH = 5 是仅有的提交前检查 | **4** — Approval policy 在执行前生效，无需到 CI 才触发 | **3** — 测试套件覆盖提交前行为 | **3** — `Permission.disabled()` 静态过滤在初始化时生效 |
| **L2（CI Pipeline）** | **1** — 无原生 CI 配置 | **4** — Phase 1/2 记忆管道提供持续集成质量记录 | **4** — 29+ eval 文件提供 CI 级别的行为验证 | **2** — Effect-ts 编译期检查有限 |
| **L3（持续漂移检测）** | **1** — 无后台 GC 机制，无持续监控 | **4** — Phase 2 Consolidation 持续整合，遗忘机制主动清理 | **2** — SessionEnd 事件驱动，无主动扫描 | **1** — 无熵管理机制 |

**关键观察**：Claude Code 在所有三个层次的反馈控制上都是最弱的，这直接来自两个根因：一是 feature flag 体系的失效（本应存在的 Hook 和验证工具不实际运行），二是无熵管理设计（没有 L3 的存在基础）。Codex 是唯一在三个层次都有实质性实现的工程，这使它的反馈控制真正形成了闭环，而不只是单向的信号发送。

反馈控制的分析揭示了前馈控制的局限——无论前馈多完善，反馈都是必要的补偿。接下来我们转向[工具治理](./05-tool-governance.md)，它是 Agent 与外部世界交互的唯一通道，也是反馈控制最直接的作用对象。

## 工具治理对比

# 工具治理对比

工具是 Agent 与外部世界交互的唯一通道。一个 Agent 能读文件、写代码、运行命令、调用 API，全部通过工具实现——没有工具，Agent 只能输出文字，不能做任何事情。这个事实使工具治理成为 Harness Engineering 里最直接的安全杠杆：如果你能控制工具，你就能控制 Agent 能做什么。

工具治理的四个核心问题是：工具怎么注册（谁能加工具、工具的 Schema 是否类型安全）、权限粒度有多细（是工具级还是操作级）、高危操作有没有额外隔离（沙箱）、并发场景下是否安全。这四个问题的答案，共同决定了一个 Agent 工程在开放部署时的安全边界宽度。

---

## 1. 工具注册与 Schema 化方式

工具注册的方式决定了两件事：谁可以向 Agent 添加工具（扩展性），以及工具的输入输出契约是否在开发期被类型系统强制（可靠性）。一个运行时动态注册的工具系统灵活但脆弱；一个静态类型强制的系统可靠但扩展成本高。

### Claude Code

`claude-code/src/tools.ts:193-250` 的 `getAllBaseTools()` 以静态枚举的方式列出所有工具：

```typescript
export function getAllBaseTools(): Tools {
  return [
    AgentTool,
    TaskOutputTool,
    BashTool,
    ...(hasEmbeddedSearchTools() ? [] : [GlobTool, GrepTool]),
    ExitPlanModeV2Tool,
    FileReadTool,
    FileEditTool,
    // ... 30+ 工具
  ]
}
```

`claude-code/src/Tool.ts` 定义了 Tool 接口，每个工具声明 `name`、`description`、`inputSchema`（JSON Schema）。工具 Schema 是运行时对象，不是编译期类型——这意味着如果一个工具的 `inputSchema` 和它实际接受的 TypeScript 类型不一致，TypeScript 编译器不会报错，Bug 只在运行时暴露。

### Codex

`codex/codex-rs/app-server/src/message_processor.rs` 的消息处理器以 Rust 类型系统作为工具 Schema 的基础。Rust 的 trait 系统强制工具实现特定的接口，而接口合规性在编译期验证。这使 Codex 的工具 Schema 是静态的、编译期保证的，这是四个工程里最强的工具注册可靠性。

### Gemini CLI

`gemini-cli/packages/core/src/tools/tool-registry.ts:1-50` 的 `ToolRegistry` 是一个运行时注册表：

```typescript
export class ToolRegistry {
  getAllTools(): Tool[]
  getToolByName(name: string): Tool | undefined
  getAllToolNames(): string[]
}
```

`gemini-cli/packages/core/src/tools/tool-names.ts` 定义了工具名称常量，防止字符串硬编码引入的拼写错误。这是一个务实的设计：注册表本身是运行时的，但工具名称常量提供了编译期的名称安全性。

### OpenCode

`opencode/packages/opencode/src/permission/index.ts:296-307` 通过 Permission 系统过滤工具列表，而不是直接管理工具注册：

```typescript
const EDIT_TOOLS = ["edit", "write", "apply_patch", "multiedit"]

export function disabled(tools: string[], ruleset: Ruleset): Set<string> {
  const result = new Set<string>()
  for (const tool of tools) {
    const permission = EDIT_TOOLS.includes(tool) ? "edit" : tool
    // ...
  }
  return result
}
```

OpenCode 的架构把工具注册和权限过滤分离——工具注册在其他模块，Permission 系统只决定哪些工具在当前上下文里被允许。这是关注点分离的良好实践，但也意味着工具 Schema 的定义散落在多处。

---

## 2. 权限模型的粒度

权限模型的粒度决定了"你能以多精细的方式表达访问策略"。粗粒度的权限（如"允许/禁止这个工具"）简单但不灵活；细粒度的权限（如"允许读文件但不允许写系统目录"）表达力更强但管理复杂度更高。选择哪种粒度，取决于团队对安全边界精细程度的需求，以及他们愿意投入的管理成本。

### Claude Code

`claude-code/src/constants/tools.ts:36-112` 使用工具级 Allowlist：`ALL_AGENT_DISALLOWED_TOOLS`（禁用工具集合）和 `ASYNC_AGENT_ALLOWED_TOOLS`（异步 Agent 允许工具集合）。这是粗粒度的权限模型——要么允许整个工具，要么禁止整个工具，无法表达"允许读文件但不允许写特定目录"这类中间状态。

权限规则硬编码在 TypeScript 文件里，对用户不透明——团队无法在不修改源码的情况下调整权限边界。

### Codex

`codex/codex-rs/protocol/src/prompts/permissions/approval_policy/` 的四种 Approval Policy 代表了四种不同的人工审批策略：

- `never.md` — 从不请求人工审批，完全自主
- `on_failure.md` — 仅在操作失败时请求审批
- `on_request_rule_request_permission.md` — 按需请求审批
- `unless_trusted.md` — 除非已被信任，否则请求审批

这四种 policy 不只是"允许/禁止"，而是定义了不同的信任升级路径。更重要的是，`on_request_rule_request_permission.md:29-34` 里的命令分段评估（每个 shell 控制操作符将命令分段，每段独立评估）使 Codex 能以命令段而非工具为单位执行权限检查。这是四个工程里权限粒度最细的实现。

### Gemini CLI

`gemini-cli/packages/core/src/tools/confirmation-policy.test.ts` 的确认策略测试覆盖了三种 ApprovalMode（DEFAULT / PLAN / YOLO）。Tool + Confirmation 的粒度：每个工具可以独立配置是否需要确认，而不是全局统一。YOLO 模式下所有确认都被跳过，这对熟悉 Agent 行为的高级用户是有意义的——但也意味着安全边界可以被完全绕过。

### OpenCode

`opencode/packages/opencode/src/permission/index.ts:19-24` 的 `Action` 枚举（allow/deny/ask）加上路径模式匹配，提供了细粒度的权限表达：

```typescript
export const Action = z.enum(["allow", "deny", "ask"]).meta({
  ref: "PermissionAction",
})
```

`ask` 的存在是 OpenCode 权限模型的独特之处：它不是简单的二元判断，而是允许"悬停"状态——权限决策被延迟到运行时，由实际执行上下文决定。这通过 `Deferred.await()` 实现（`permission/index.ts:166-201`），保证了 ask 状态下不会有竞争条件。

---

## 3. 沙箱隔离强度

权限模型控制"何时允许执行"，沙箱隔离控制"执行在什么环境里发生"。两者正交——一个没有沙箱的工程，即使有精细的权限模型，Agent 的操作也在完整的系统权限下执行；一个有沙箱的工程，即使权限模型相对粗糙，沙箱也能提供额外的失控保护层。

**Claude Code**：`claude-code/src/tools/BashTool/` 无沙箱实现可见。BashTool 运行在完整的系统权限下，只有操作系统层面的权限限制。这意味着如果 Agent 在某个上下文里被允许运行 BashTool，它能执行任何当前用户有权限执行的命令——包括删除文件、修改系统配置等高危操作。

**Codex**：`unless_trusted.md:1` 中提到："Approvals are your mechanism to get user consent to run shell commands without the sandbox." 这句话的含义是：Codex 默认在沙箱内运行 shell 命令，只有获得明确批准才能在沙箱外执行。沙箱有三种模式（macos-seatbelt / generic / outside），分别对应不同的隔离强度。这是四个工程里唯一实现了系统级沙箱隔离的工程。

**Gemini CLI**：`gemini-cli/packages/core/src/prompts/snippets.ts:88-93` 定义了 `SandboxMode`：

```typescript
export type SandboxMode = 'macos-seatbelt' | 'generic' | 'outside';

export interface SandboxOptions {
  mode: SandboxMode;
  toolSandboxingEnabled: boolean;
}
```

沙箱模式的类型定义存在，说明 Gemini CLI 有明确的沙箱意识，且沙箱状态是提示词的一部分（会被注入 Agent 上下文，让 Agent 知道自己在什么隔离环境里运行）。

**OpenCode**：无沙箱实现可见。工具在无隔离的环境里执行，安全边界完全依赖 Permission 系统的决策。

---

## 4. 工具调度纪律（并发安全）

当 Agent 并发调用多个工具时，工具系统的并发安全性决定了是否会出现竞争条件。在实际的 Agent 工作流里，并发工具调用是常见的（如同时读取多个文件），工具系统需要保证并发调用不会相互干扰。

**Claude Code**：`tools.ts:325-326` 的工具列表过滤基于 `isEnabled()` 检查，是同步的简单过滤。没有显式的并发控制机制，并发安全依赖底层 Bun 运行时。

**Codex**：Rust 的 Arc<Mutex<>> 等并发原语在编译期强制线程安全。Rust 的 Send 和 Sync trait 使得任何违反线程安全约束的代码都无法通过编译。这是最强的并发安全保证，完全依赖于语言层面的机械执行。

**Gemini CLI**：无独立的并发控制机制可见，依赖底层 Node.js 事件循环（单线程模型）的安全性。在 Node.js 里，同步代码不会产生数据竞争，但异步操作的顺序性依然需要注意。

**OpenCode**：`permission/index.ts:123-131` 的 State 接口使用 `Map<PermissionID, PendingEntry>` 加 `Deferred`，通过 Effect-ts 管理并发权限请求：

```typescript
interface State {
  pending: Map<PermissionID, PendingEntry>
  approved: Ruleset
}
```

Effect-ts 的设计保证了 Fiber 之间的并发安全：同一个 Permission 请求不会被重复处理，多个并发请求会被独立追踪。这是通过函数式并发模型实现的并发安全，不依赖锁。

---

## 5. 高危工具约束密度

不是所有工具都是等危险的。`git commit`、`rm -rf`、写入系统目录——这些操作一旦执行就难以恢复，需要额外的约束。高危工具约束密度衡量的是：工程是否对这类操作有超出标准权限模型之外的专门约束。

**Claude Code**：`claude-code/src/tools.ts:197` 的 BashTool 是核心工具，但没有针对高危命令（如 git commit/push/amend）的专门约束。所有 bash 命令在同一个权限层面执行，仅靠 Agent 的 prompt 规则来避免危险操作。约束密度低。

**Codex**：`on_request_rule_request_permission.md:29-34` 的命令分段评估对高危操作提供了细粒度约束：

```markdown
## Command segmentation reminder
The command string is split into independent command segments at shell control operators...
Each segment is evaluated independently for sandbox restrictions and approval requirements.
```

每个命令段独立评估意味着：即使一个复合命令（`cp file.txt backup/ && rm file.txt`）的整体意图是合理的，其中的高危部分（`rm file.txt`）也会被独立检查。这是四个工程里高危工具约束密度最高的实现。

**Gemini CLI**：无针对高危命令的专门约束可见，依赖 prompt 规则和 ApprovalMode 设置。中等约束密度。

**OpenCode**：`permission/index.ts:270-276` 的路径扩展（`~/` 展开为 home 目录）是一种间接的安全措施，防止路径注入。对高危命令本身没有专门约束。中等约束密度。

---

## 总结对比表

| 维度 | Claude Code | Codex | Gemini CLI | OpenCode |
|------|-------------|-------|------------|----------|
| 工具注册方式 | 运行时对象，JSON Schema | 静态类型，编译期验证 | 运行时注册表 + 名称常量 | Permission 过滤，关注点分离 |
| 权限粒度 | 粗（工具级 Allowlist，硬编码） | 细（Policy + 命令分段） | 中（Tool + Confirmation 模式） | 细（Action + Pattern + Deferred） |
| 沙箱强度 | 无沙箱 | 三层沙箱（macos-seatbelt/generic/outside） | 有沙箱类型定义，toolSandboxingEnabled 配置 | 无沙箱 |
| 并发安全 | 简单同步过滤 | Rust 编译期线程安全保证 | 依赖 Node.js 单线程模型 | Effect-ts Fiber 并发管理 |
| 高危约束密度 | **低** — 无分级，依赖 prompt 规则 | **高** — 命令级分段评估，独立约束 | **中** — 确认模式分级 | **中** — 路径规范化 + Deferred 审批 |
| 综合评分 (1-5) | **2** | **4** | **3** | **3** |

工具治理的核心发现与前馈、反馈评估一致：Codex 的系统性最强（沙箱 + 命令分段 + policy 层次），Claude Code 的约束密度最低（无沙箱、硬编码 Allowlist）。工具治理的分析为我们理解下一个维度——[上下文与记忆工程](./06-context-and-memory.md)——奠定了基础：工具帮助 Agent 行动，上下文决定 Agent 能看到什么来做出决定。

## 上下文与记忆工程对比

# 上下文与记忆工程对比

Agent 的判断质量取决于它在当前时刻能看到什么。这个"能看到什么"——即上下文——不是固定的，而是由工程设计决定的。如果上下文设计得好，Agent 在每次响应时都能访问到相关的历史决策、项目规则、用户偏好；如果设计得差，Agent 每次都从一张白纸开始，反复犯同样的错误，或者在不相关的信息里迷失方向。

记忆工程的核心挑战是一个矛盾：上下文窗口是有限的，而有价值的信息是无限累积的。解决这个矛盾的策略——什么该保留、什么该压缩、什么该丢弃——直接决定了 Agent 的长期可靠性。这是"上下文与记忆"这个维度被单独分析的原因：它不只是技术细节，它决定了 Agent 能否跨 session 持续地、可靠地学习和改进。

---

## 1. Context 分层治理

Context 分层是指：把不同来源、不同时效、不同权威性的信息分别组织，而不是把所有信息混合成一个大的文本块。分层的价值在于：工程师可以预测哪类信息在哪个位置，Agent 可以通过信息的"位置"推断其权威性，系统可以按层次分别更新和失效信息。

### Claude Code

`claude-code/src/context.ts:116-189` 把 context 分为 System Context 和 User Context 两层：

```typescript
export const getSystemContext = memoize(async (): Promise<{ [k: string]: string }> => {
  // gitStatus — 当前 git 仓库状态
  // cacheBreaker — 仅 Anthropic 内部（ant-only）
})

export const getUserContext = memoize(async (): Promise<{ [k: string]: string }> => {
  // claudeMd — CLAUDE.md 文件内容
  // currentDate — 当前日期
})
```

两层都使用 `memoize()` 缓存，生命周期是整个 conversation。这意味着：CLAUDE.md 内容在 conversation 期间不会重新读取，即使文件在 conversation 中被修改。这是一个有意识的性能优化，但也意味着实时规则变更无法在当前 session 里立即生效。

### Codex

Codex 的 Context 分层更复杂，因为它是跨 session 的。`stage_one_system.md` 的 Phase 1 每次从 rollout 历史里提取结构化上下文，`consolidation.md` 的 Phase 2 把多次 Phase 1 的输出整合成全局记忆。这意味着 Codex 的"当前上下文"不只是当前 session 的信息，而是包含了历史 session 的提炼。从控制论角度看，这是跨 session 的状态持久化——是四个工程里唯一真正实现了这一点的。

### Gemini CLI

`gemini-cli/packages/core/src/config/memory.ts` 的 `HierarchicalMemory` 接口定义了三层：

```typescript
export interface HierarchicalMemory {
  global?: string      // 全局配置，所有项目共享
  extension?: string   // 扩展级配置
  project?: string     // 项目级配置，最高优先级
}
```

三层的分离使不同的责任方可以控制不同层次的规则：全局层由系统管理员或用户偏好设置，project 层由项目团队维护。这是典型的关注点分离在记忆系统里的实现。

### OpenCode

`opencode/packages/opencode/src/skill/index.ts:143-157` 通过 `Config.directories()` 扫描目录来发现 Skill 文件。Context 分层不是显式定义的，而是通过目录结构隐式表达的：越靠近项目的目录里的 Skill，优先级越高。这是声明式的分层，但对不熟悉约定的工程师来说，需要先理解目录扫描逻辑才能推断优先级。

---

## 2. Compact/裁剪策略

当对话历史超过上下文窗口时，必须有一套机制来决定保留什么、丢弃什么。这个决策——Compact 策略——比表面看起来更重要：丢弃错误的信息会让 Agent 失去关键上下文，而不丢弃任何信息会让 Agent 很快无法继续工作。Compact 策略的质量，决定了 Agent 长会话的可靠性上限。

**Claude Code**：Compact 触发点是 `/clear` 和 `/compact` 命令（`systemPromptSections.ts:60-68`），清理操作是 `clearSystemPromptSections()`。这是显式触发、完整清理的策略——用户手动发起，清理结果是缓存归零，下一次请求重新从磁盘读取所有信息。这个策略简单可靠，但没有"智能"成分——它无法判断哪些记忆值得保留，哪些已经过时。

**Codex**：`codex/codex-rs/core/templates/compact/prompt.md` 的压缩 prompt 在上下文超限时触发，通过生成 summary 来替代完整的对话历史，以 `summary_prefix.md` 的固定前缀开头。这比 Claude Code 的缓存清理更精细：它尝试保留信息的语义，而不是简单地清空。

**Gemini CLI**：`promptProvider.ts:267-281` 的 `getCompressionPrompt()` 根据当前模型（modern vs legacy）选择不同的 compression prompt。这是根据推断引擎能力自适应的压缩策略——现代模型可能有更长的上下文窗口，需要不同的压缩触发阈值和策略。

**OpenCode**：无可见的 Compact 策略。这是 OpenCode 最明显的上下文工程缺失：当对话历史増长，没有机制来优雅地管理上下文大小，只能依赖模型自身的上下文截断行为（通常会丢弃最早的信息）。

---

## 3. 知识作为系统记录

知识版本化（Knowledge as System Record）是指：把 Agent 使用的规则、偏好、历史决策作为可审计的系统记录，而不是散落在对话历史里、无法追溯的临时信息。版本化的知识可以在不同 session 间传递、在代码审查中可见、在规则变更时有迹可循。

**Claude Code**：`claude-code/src/utils/claudemd.ts:790-1074` 的 `getMemoryFiles()` 发现并加载四层 CLAUDE.md 文件：

```
Managed (/etc/claude-code/CLAUDE.md) — 系统管理员管理
User (~/.claude/CLAUDE.md) — 用户全局记忆
Project (CLAUDE.md, .claude/CLAUDE.md, .claude/rules/*.md) — 项目记忆
Local (CLAUDE.local.md) — 本地私有记忆（通常 .gitignore）
```

`@include` 指令支持从一个 CLAUDE.md 引用另一个文件，实现知识复用。Project 层的 CLAUDE.md 进入 Git 版本控制，意味着规则变更有完整的历史记录和变更原因。

**Codex**：`codex/codex-rs/core/templates/memories/consolidation.md` 的 Phase 2 产物包括 `raw_memories.md`（原始记忆合并）和 `rollout_summaries/`（每次 rollout 的摘要）。这些产物存储在 DB 里，有时间戳和 usage_count，支持基于使用频率的知识衰减（`max_unused_days` 窗口）。Codex 的知识版本化最完整：不只是"文件在 Git 里"，而是"知识有时间戳、有使用统计、有主动遗忘机制"。

**Gemini CLI**：`gemini-cli/packages/core/src/tools/memoryTool.ts` 实现了 Memory Tool，Agent 可以通过工具调用来读写记忆（`getAllGeminiMdFilenames()` 发现所有 GEMINI.md 文件）。记忆存储在文件系统里，通过 Git 版本化。Agent 可访问记忆工具，意味着它可以主动写入记忆，而不只是被动读取规则——这是 Gemini CLI 记忆系统的独特能力。

**OpenCode**：`opencode/packages/opencode/src/skill/index.ts:71-102` 的 Skill 解析通过 Zod Schema 验证 frontmatter 结构：

```typescript
const parsed = Info.pick({ name: true, description: true }).safeParse(md.data)
```

Skill 文件是知识的主要载体，存储在文件系统里。没有 DB 层的时间戳或使用统计，知识版本化完全依赖文件系统 + Git。

---

## 4. Progressive Disclosure 实现

Progressive Disclosure（渐进式揭示）在 UX 设计里指"只在需要时显示复杂信息"，在 Agent 上下文工程里，它指"Agent 只在需要时加载相关信息，而不是一次性把所有知识塞进上下文"。实现好的 Progressive Disclosure 能降低上下文噪音、提高 Agent 的响应精度，并延长在给定上下文窗口内可以维持的有效对话长度。

**Claude Code**：`claudemd.ts:1-26` 的注释指出文件按"优先级倒序加载"（后加载的优先级更高）。但这是一次性全量加载——所有 CLAUDE.md 文件的内容都被加入 System Prompt，没有延迟加载或按需加载。1166 行的单文件实现也暗示了一种百科全书式的思维：把一切都放在一起，让 Agent 自己从里面找相关部分。这是 Progressive Disclosure 的反模式。

**Codex**：`default.md` 的 276 行按节（Personality → AGENTS.md spec → Planning → Task execution → Validating）组织。每个节负责不同的任务阶段，这是一种隐式的 Progressive Disclosure：不同阶段的 Agent 关注不同的节，而不是每次都处理整个文档。节与节之间有清晰的边界，Agent 可以通过节标题快速定位相关规则。

**Gemini CLI**：`snippets.ts:123-151` 的 `getCoreSystemPrompt()` 通过条件渲染（`options.planningWorkflow ? renderPlanningWorkflow : renderPrimaryWorkflows`）实现了真正的 Progressive Disclosure：不同的 Agent 模式激活不同的 Snippet 组合，不相关的 Snippet 不被包含。这使 System Prompt 的内容和当前任务模式高度相关，减少了噪音。

**OpenCode**：Skill 系统在 `sign()` 函数里（`skill/index.ts`）把 Skill 定义分散在多处（`skill/index.ts`、`permission/index.ts`、`config/config.ts`）。这是适度的分散，不是 Progressive Disclosure 的积极实现，但至少避免了百科全书式的单点聚合。

---

## Agent 可访问信息边界

理解"Agent 能看到什么"和"Agent 不能看到什么"，对治理 Agent 行为至关重要。信息边界定义了 Agent 决策的数据基础，也定义了 Agent 不应该期望自己知道什么。

所有四个工程的 Agent 都无法感知超出其工具和上下文之外的信息：Slack 消息、Google Docs 内容、人脑里的隐性知识——这些对 Agent 不存在，除非被显式地工具化并注入上下文。这个边界对 harness 设计的含义是：任何团队想让 Agent 考虑的信息，都必须通过可见渠道（文件、工具、上下文）明确传递，而不能假设 Agent "自然会知道"。

| 工程 | 上下文组成 | 信息边界 |
|------|-----------|---------|
| Claude Code | System/User Context + CLAUDE.md 四层 | git status, date, CLAUDE.md 内容 |
| Codex | 当前 session + Phase 1/2 记忆整合 | rollout 历史提炼 + 当前任务 |
| Gemini CLI | GEMINI.md 三层 + Tool 调用结果 | 文件系统 + 工具返回值 |
| OpenCode | Skill 文件 + Config + Permission | 目录内 Skill + 配置 |

---

## 总结对比表

| 维度 | Claude Code | Codex | Gemini CLI | OpenCode |
|------|-------------|-------|------------|----------|
| Context 分层 | System/User 两层，memoize 缓存 | Phase 1/2 跨 session 分离，最深 | Global/Ext/Project 三层 | 目录堆栈，隐式分层 |
| Compact 策略 | 手动触发，全量清理 | 摘要生成，语义压缩 | 模型自适应 compression prompt | 缺失 |
| 知识版本化 | Git + 文件系统（四层） | DB + 时间戳 + 使用统计，最完整 | 文件系统 + Agent 可主动写入 | 文件系统（无使用统计） |
| Progressive Disclosure | 反模式（百科全书全量加载） | 节结构（任务阶段映射） | 条件 Snippet 渲染，最主动 | 适度分散（无积极实现） |
| 综合评分 (1-5) | **3** | **4** | **3** | **2** |

上下文与记忆工程的分析揭示了一个关键差异：Codex 是唯一把记忆当作工程系统设计（有 DB、时间戳、使用统计、遗忘机制）的工程，其他三个都把记忆视为文件系统操作。这个差异在[熵管理](./08-entropy-management.md)这个维度会体现得更明显——记忆系统的工程化程度，直接决定了知识库腐烂的速度。接下来先看[可驾驭性](./07-harnessability.md)，它从代码库结构的角度回答"这个工程是否本身就容易被 harness"。

## 可驾驭性对比

# 可驾驭性对比

可驾驭性（Harnessability）是一个元级别的维度：它不问"这个工程目前有哪些控制机制"，而问"这个工程有多容易被继续改善"。换句话说，如果我们把 Harness Engineering 视为一个持续过程（而不是一次性配置），可驾驭性决定了这个过程的摩擦有多高。

这个维度之所以值得单独分析，是因为一个 harness 工程的当前状态和其未来演进能力往往不相关。一个当前有精细控制机制的工程，如果语言选择或架构设计使得继续添加控制点代价极高，它的可驾驭性就很低；反过来，一个当前控制较少的工程，如果代码库结构使得添加新控制点代价很低，其可驾驭性就很高。

---

## 1. 语言/框架的 Ambient Affordances

Ambient Affordance（环境承载能力）是一个借自认知科学的概念，在这里指：某种语言或框架天然提供的、不需要额外工作就能获得的控制属性。Rust 的 borrow checker 是一种 Ambient Affordance——你不需要为了得到内存安全而专门写测试，写 Rust 代码本身就创造了内存安全。这类"免费自带"的控制属性，是可驾驭性的重要来源。

### Claude Code

TypeScript 的 Ambient Affordance 包括类型系统（发现接口不兼容）和 IDE 集成（实时错误提示）。但 `claude-code/tsconfig.json` 的 ~1341 tsc 错误让这些 Affordance 全部失效：当整个项目都有大量类型错误时，IDE 的错误提示失去了信号噪声比，工程师无法区分"这个新的类型错误是我引入的问题"还是"这是反编译留下的旧问题"。

**结论**：TypeScript 本应提供的 Ambient Affordance 在反编译副作用下归零。Claude Code 的可驾驭性因此严重受损——每次修改都需要承担无类型安全保证的风险。

### Codex

Rust 的 Ambient Affordance 是此次对比中最强的：
- **Borrow checker**：编译期空指针检测，无需运行程序就能发现整类错误
- **数据竞争检测**：编译期强制线程安全，并发 Bug 在运行前被消除
- **所有权系统**：资源生命周期在编译期明确，无内存泄漏可能性

这些 Affordance 使 Codex 的 harness 代码维护者能够以更高的信心添加新的控制点。当你为 Codex 添加一个新工具时，Rust 编译器会帮你验证这个工具不会引入内存问题或线程问题，而不需要运行时测试来发现这类错误。

### Gemini CLI

`gemini-cli/packages/core/src/tools/tool-registry.ts` 的 TypeScript 中等严格度提供了有效的 Ambient Affordance：接口定义、返回类型标注、null 检查，这些在 IDE 里都是实时反馈。中等程度意味着：比没有类型好，但比 Rust 的编译期保证弱得多。特别是，TypeScript 的类型系统是可以被 `as any` 和 `@ts-ignore` 逃脱的，而 Rust 不允许这种逃逸。

### OpenCode

`opencode/packages/opencode/src/permission/index.ts:14` 的 `import z from "zod"` 表明 OpenCode 选择了运行时验证而非编译期验证。Zod 的 Ambient Affordance 是运行时的——它在数据实际传入时才检测不合规，而不是在代码编写时。Effect-ts 的类型系统提供了一定的编译期保证，但总体上，OpenCode 的 Ambient Affordance 强度处于运行时验证的水平。

---

## 2. 模块边界的机械执行程度

一个工程的模块边界是否被机械执行（而不只是约定遵守），决定了它的可驾驭性是否会随着代码库增长而退化。如果模块边界只靠约定，随着贡献者增加、时间流逝，边界会自然腐烂——人们为了便利会越过边界，架构约束逐渐失效。如果模块边界被编译器或运行时强制，违反边界的代码会在进入版本库前就被拒绝。

### Claude Code

`claude-code/src/tools.ts:193-250` 的 `getAllBaseTools()` 显示工具按 `src/tools/<ToolName>/` 目录组织，这是好的物理隔离设计。但这只是约定，没有机械执行——任何代码都可以直接 import 另一个工具的内部实现，TypeScript 不会阻止这类跨边界引用（特别是在类型系统失效的情况下）。

**结论**：模块边界依赖约定，无机械执行。可驾驭性低。

### Codex

`codex/codex-rs/app-server/src/lib.rs` 的 crate 边界是编译期强制的：

```rust
pub mod app_server_tracing;
pub mod bespoke_event_handling;
pub mod codex_message_processor;
```

在 Rust 里，`pub` 决定了哪些 API 可以跨 crate 边界访问，而这是编译器强制的——你不能从外部 crate 访问另一个 crate 的私有实现，编译器会拒绝。这使 Codex 的模块边界是真正的边界，而不只是建议性的目录组织。任何违反 crate 边界的代码都无法通过 `cargo build`，这是最强的机械执行。

### Gemini CLI

`gemini-cli/packages/core/src/tools/tool-registry.ts` 的注册表模式依赖约定（你需要知道要向注册表注册工具，而不是直接使用工具实现）。TypeScript 的 `export/import` 系统提供了一定的边界控制（只有 export 的符号才能被外部访问），但 `export *` 和动态 import 等逃逸路径使这个控制不是完全机械的。

**结论**：注册表模式 + TypeScript export 边界，中等机械执行。

### OpenCode

`opencode/packages/opencode/src/permission/index.ts:138` 的 Effect Layer 定义：

```typescript
export class Service extends ServiceMap.Service<Service, Interface>()("@opencode/Permission") {}
```

Effect-ts 的 ServiceMap 模式强制依赖注入：任何需要 Permission Service 的代码都必须通过 `ServiceMap` 声明这个依赖，而不能静默使用全局变量。这是一种运行时的模块边界执行：违反依赖注入规则的代码不会在编译期报错，但会在 Effect 运行时产生明确的错误。

**结论**：Effect Layer 强制依赖注入，运行时执行，强度介于约定和编译期之间。

---

## 3. Harness Templates 潜力

Harness Templates 是指：工程里是否有可以被复用和扩展的模板机制，使得建立新的控制点不需要从零开始？一个好的 Template 系统让 harness 工程师可以"填空"而不是"从白纸写起"，大幅降低扩展成本。

### Claude Code

`systemPromptSections.ts:20-24` 的 `systemPromptSection()` 函数是一个轻量级的模板机制：

```typescript
export function systemPromptSection(
  name: string,
  compute: ComputeFn,
): SystemPromptSection {
  return { name, compute, cacheBreak: false }
}
```

这允许新的 Prompt 片段以统一的方式注册，而不需要修改核心 Prompt 构建逻辑。但 feature flag 系统（`feature()` 始终返回 false）限制了条件性 Template 的有效性——你可以定义新的 feature-gated Template，但无法在反编译环境下激活它。

### Codex

`codex/codex-rs/core/templates/` 目录是四个工程里最丰富的 Template 系统：

```
templates/
  agents/orchestrator.md
  collaboration_mode/
    default.md
    execute.md
    pair_programming.md
    plan.md
  compact/
    prompt.md
    summary_prefix.md
  memories/
    consolidation.md
    stage_one_input.md
    stage_one_system.md
```

每个目录对应一个功能域（协作模式、压缩、记忆），每个文件是该功能域的一个变体。添加新的协作模式，只需在 `collaboration_mode/` 添加新的 Markdown 文件——不需要修改任何代码。这是 Template 系统最大化可驾驭性的核心设计。

### Gemini CLI

`gemini-cli/packages/core/src/prompts/snippets.ts` 的 Snippet 函数组合是 Template 系统的代码化实现。每个 Snippet 函数（如 `renderPreamble`、`renderCoreMandates`）都是独立的 Template，可以独立测试和修改。Snippet 函数的组合模式使得添加新的 Prompt Section 只需写一个新函数和一个测试，然后在 `getCoreSystemPrompt()` 里调用它。

### OpenCode

无独立的 Template 目录或 Template 机制可见。Skill 系统提供了部分 Template 功能（可重用的任务定义），但和 Codex 的系统级 Template 相比，缺少框架性的组织。添加新的控制点需要理解 Effect-ts 的 Service 系统，对不熟悉这个框架的工程师来说学习曲线相当高。

---

## 4. Ashby 定律视角

Ashby 的必要多样性定律（Law of Requisite Variety）说：一个控制系统必须具备至少与被控系统同等复杂度的内部多样性，才能有效控制它。在 Agent 语境里，这意味着：如果你的 harness 规则只有 5 条，但 Agent 的行为空间有 500 种情况，harness 必然覆盖不全。

Ashby 定律在工程实践里有一个推论：**有意识地约束操作空间本身就是一种有效的控制策略**——让 Agent 能做的事情更少，比建立覆盖所有情况的规则更可靠。我们观察各工程在约束 Agent 操作空间上投入了多少。

**Claude Code**：`claude-code/src/constants/tools.ts:36-112` 的 Allowlist 通过精确列出允许/禁止的工具集合来约束操作空间。这是直接的拓扑承诺：通过减少 Agent 的工具选择，减少了 harness 需要覆盖的行为空间。

**Codex**：`protocol/src/prompts/permissions/approval_policy/` 的四种 policy 变体，加上 `execpolicy` 的 shell 命令约束，形成了两层正交的空间限制。Policy 模式的多样性恰好是 Ashby 定律意义上的"必要多样性"：不同的团队使用场景（从不审批 vs. 除非信任才不审批）需要不同的控制策略，四种 policy 覆盖了这个变体空间。

**Gemini CLI**：`getCoreSystemPrompt()` 的条件渲染（`planningWorkflow` 二选一）通过模式切换来约束 Agent 在特定阶段的行为空间，而 `models.ts` 的模型约束限制了推断引擎的选择空间。

**OpenCode**：`config/config.ts` 的配置 Schema 间接约束了 Agent 可以读取的操作参数空间。但当前缺少对工具调用空间的系统性限制，Agent 的行为空间仍然相对开放。

---

## 总结对比表

| 维度 | Claude Code | Codex | Gemini CLI | OpenCode |
|------|-------------|-------|------------|----------|
| 隐式传感器强度 | **1** — 类型系统因反编译失效，归零 | **5** — Rust borrow checker，编译期内存安全 | **3** — TypeScript 中等严格度，有效但可逃逸 | **2** — Zod 运行时验证，非编译期 |
| 模块边界执行 | **1** — 仅目录约定，无机械执行 | **5** — Rust crate 边界，编译期强制 | **2** — TypeScript export + 注册表，可逃逸 | **4** — Effect Layer 强制依赖注入，运行时执行 |
| Template 潜力 | **3** — Snippet 机制存在，但 feature flag 体系失效 | **5** — 丰富模板目录，添加功能只需加文件 | **4** — Snippet 函数组合，可独立测试 | **1** — 无模板系统，每个控制点需从零建立 |
| 拓扑承诺程度 | **3** — 工具 Allowlist 有效约束行为空间 | **4** — Policy 四变体 + execpolicy 双层约束 | **3** — 模式切换 + 模型约束 | **2** — 配置 Schema 间接约束，无系统性工具约束 |
| **综合评分 (1-5)** | **2** | **4.75** | **3** | **2.25** |

**核心发现**：可驾驭性的差距比任何其他单一维度都更根本，因为它影响的不是当前状态，而是未来演进能力。Codex 在 Rust 语言选择上的可驾驭性优势是结构性的——它不能通过添加文档或配置来"补偿"，而是嵌入在语言选择里。Claude Code 的可驾驭性损失同样是结构性的：反编译副作用使类型系统失效，这不是一个可以通过"修复几行代码"来解决的问题。

可驾驭性分析到这里给了我们一个预测：Codex 的 harness 最容易持续改善，Claude Code 的改善成本最高。接下来的[熵管理](./08-entropy-management.md)会看到这个预测在持续运行场景里如何体现。

## 熵管理对比

# 熵管理对比

熵（Entropy）在这里不是物理意义上的，而是信息工程意义上的：随着 Agent 持续运行、不断积累上下文和记忆，这些积累会不会自然走向腐烂？知识积累的必然结局是"过时信息污染新的判断"，除非工程主动设计了清理机制。

这个维度是 Harness Engineering 里最容易被忽视的，因为熵管理的缺失不会立刻产生可见的故障——Agent 今天仍然运行良好，只是明天的判断会比今天略差，下个月的判断会比这个月略差。这种"慢性退化"在没有监控的情况下很难被察觉，直到某次错误让工程师回顾历史才会发现问题早在数周前就埋下了。

---

## 1. 后台 GC 机制

GC（Garbage Collection）机制在记忆工程里，指的是：工程是否有主动的、不需要人工触发的机制来识别和清理过时信息？主动 GC 和被动清理（如用户手动执行 /clear）的区别在于：主动 GC 能在问题严重化之前介入，而被动清理依赖人类发现问题并采取行动。

### Claude Code

`claude-code/src/utils/claudemd.ts:790` 的 `getMemoryFiles()` 使用 `memoize()` 缓存——缓存一旦建立，在 conversation 期间不会主动过期。这意味着：如果 CLAUDE.md 里有一条规则在三个月前已经过时（比如"使用旧 API X"），Agent 仍然会在每次 session 里读取并遵守它，直到工程师手动删除那条规则。

没有后台任务定期扫描知识库、识别陈旧内容、提示工程师审查。这是明确的 GC 缺失。结合反编译副作用导致的类型系统失效，Claude Code 在长期运行下的可靠性退化风险是四个工程里最高的。

### Codex

Codex 是四个工程里唯一实现了真正意义上的后台 GC 的工程。`stage_one_system.md` 的 Phase 1 定义了每次 rollout 后自动触发的记忆提取流程：

```markdown
What it does:
- claims a bounded set of rollout jobs from the state DB
- filters rollout content down to memory-relevant response items
- sends each rollout to a model (in parallel)
- expects structured output containing:
  - a detailed raw_memory
  - a compact rollout_summary
  - an optional rollout_slug
```

Phase 1 的 NO-OP 门控（如果没有足够信号，返回空，不入库）防止了记忆库被噪音污染。Phase 2（`consolidation.md`）在 Phase 1 产物基础上做全局整合，关键是其遗忘机制：`prunes stale rollout summaries that are no longer retained`。这个机制通过 `max_unused_days` 窗口自动淘汰长期未被引用的知识，是四个工程里唯一实现"知识自动遗忘"的。

### Gemini CLI

`hookSystem.ts:226-237` 的 `fireSessionEndEvent` 提供了 session 结束时的清理钩子：

```typescript
async fireSessionEndEvent(
  reason: SessionEndReason,
): Promise<AggregatedHookResult | undefined> {
  return this.hookEventHandler.fireSessionEndEvent(reason)
}
```

这是事件驱动的清理机制——当 session 结束时，注册了 `SessionEnd` Hook 的处理器会被调用。但"事件驱动"和"主动GC"之间有一个关键差别：事件驱动依赖 session 正常结束来触发，如果 session 因异常中断就可能丢失清理机会；且清理的具体内容由 Hook 实现者决定，框架本身没有强制的 GC 策略。

### OpenCode

`opencode/packages/opencode/src/permission/index.ts:151-160` 的 Finalizer 机制：

```typescript
yield* Effect.addFinalizer(() =>
  Effect.gen(function* () {
    for (const item of state.pending.values()) {
      yield* Deferred.fail(item.deferred, new RejectedError())
    }
    state.pending.clear()
  }),
)
```

Finalizer 是 Effect 作用域结束时的资源清理，这是运行时资源回收，不是知识库的 GC。OpenCode 没有任何主动扫描知识库、识别陈旧内容的机制。无熵管理是 OpenCode 最显著的工程欠债之一，特别是考虑到其 Skill 系统可以加载大量 Skill 文件这一事实。

---

## 2. 文档腐烂检测方式

文档腐烂（Documentation Rot）是指：规则文件的内容随着时间推移变得过时、错误或互相矛盾，但没有任何机制来检测或提示这个情况。在 Agent 工程里，腐烂的规则比没有规则更危险：没有规则时 Agent 会自己推断（往往合理），而错误的规则会积极地引导 Agent 做错误的事情。

**Claude Code**：`claudemd.ts:80-82` 仅有路径清理（防止路径注入），没有对文档内容的腐烂检测。如果一条规则引用了一个已经废弃的 API，Claude Code 不会警告工程师——它会把这条规则注入 Agent 上下文，Agent 会尝试使用废弃的 API，然后失败。检测不到 = 腐烂不可见。

**Codex**：`consolidation.md` 的 Phase 2 包含一个隐式的腐烂检测机制：通过 `usage_count` 和 `max_unused_days` 窗口，长期未被引用的知识会被标记为"候选淘汰"。这不是直接的"文档内容是否仍然正确"的检测，但通过使用频率代理了相关性——一条从未被模型使用过的规则，很可能已经过时或不再适用。

**Gemini CLI**：无文档腐烂检测机制。GEMINI.md 文件的内容会被原样注入上下文，没有时效性检查。29+ eval 文件提供了行为层面的回归测试，如果规则腐烂导致 Agent 行为退化，eval 测试可能会捕捉到——但这是行为层面的间接检测，不是文档层面的直接检测。

**OpenCode**：无文档腐烂检测。Skill 文件的 Zod Schema 验证保证了格式合法性，但不验证内容的时效性。

---

## 3. 质量评分与漂移追踪

量化 Agent 输出质量，并追踪这个质量随时间的变化趋势，是熵管理的主动形式。如果质量分数持续下降，工程师能看到趋势并介入；如果没有质量追踪，质量退化只能在某次严重错误发生后才被发现。

**Claude Code**：无质量评分或漂移追踪机制。Agent 输出质量的评估完全依赖用户的主观判断，没有结构化的历史记录。

**Codex**：`stage_one_system.md:150-201` 的 Task Outcome Triage 为每次任务输出打结构化标签：

- `outcome = success` — 任务完成
- `outcome = partial` — 部分完成
- `outcome = uncertain` — 结果不确定
- `outcome = fail` — 任务失败

加上 preference evidence（行为偏好证据，带引号原文）和 failure mode（失败模式分类）。这些标签在 Phase 2 整合时被聚合，理论上可以追踪一段时间内的任务成功率趋势。这是四个工程里唯一有结构化质量历史记录的实现。

**Gemini CLI**：`gemini-cli/evals/` 的 eval 测试套件提供了静态的质量基准。`evalTest("USUALLY_PASSES", ...)` 这类标注表明，某些测试是概率性通过的，而不是确定性通过的——这是对模型不确定性的诚实承认，也是质量评分的一种形式。但 eval 是静态测试，不是实时漂移追踪。

**OpenCode**：无质量评分或漂移追踪。

---

## 4. Golden Principles 显式程度

Golden Principles（黄金原则）是指：工程是否有一套核心的、高优先级的行为规范，这些规范在任何情况下都优先于其他规则？显式的 Golden Principles 能在发生规则冲突时给 Agent 提供清晰的仲裁依据，防止 Agent 因规则优先级模糊而做出错误的权衡。

**Claude Code**：`claude-code/CLAUDE.md` 提供了项目指南，但这是非结构化的文档，没有明确标注哪些是"黄金原则"（必须遵守）vs. 哪些是"建议"（可以忽略）。Agent 需要自行判断规则的相对重要性，这是引入不确定性的地方。

**Codex**：`default.md` 包含显式的 Core Mandates 章节：

```markdown
## Core Mandates
- Credential Protection: Never log, print, or commit secrets
- Source Control: Do not stage or commit changes unless requested
```

这些 Mandate 用命令式语言（Never、Do not）表达，明确区别于建议性语言（should、consider）。层级上的显式程度是四个工程里最高的。

**Gemini CLI**：`snippets.ts:195-197` 的 Security & System Integrity 节使用了和 Codex 类似的命令式语言：

```typescript
// Credential Protection: Never log, print, or commit secrets...
// Source Control: Do not stage or commit changes unless specifically requested...
```

不同的是，这些规则在 Gemini CLI 里表达为 TypeScript 注释字符串，而不是 Markdown 文档——这使规则的修改需要修改代码，而不只是编辑文本文件。

**OpenCode**：`permission/index.ts` 的 Permission Action（allow/deny/ask）是最机械化的 Golden Principles 实现形式：权限规则不是自然语言，而是枚举值，没有被 Agent 误解的空间。但这个机械化的代价是：权限规则无法表达复杂的上下文相关逻辑，只能表达静态的 allow/deny/ask 决策。

---

## 总结对比表

| 维度 | Claude Code | Codex | Gemini CLI | OpenCode |
|------|-------------|-------|------------|----------|
| 后台 GC | **1** — 无，memoize 无过期策略 | **5** — Phase 1/2 两阶段，usage 遗忘机制 | **2** — SessionEnd 事件触发，被动 | **1** — 无，仅 Effect Finalizer（资源清理） |
| 文档腐烂检测 | **1** — 路径清理，无内容检测 | **4** — usage_count 代理相关性，间接检测 | **2** — eval 行为回归（间接） | **1** — Zod 格式验证，无时效性检测 |
| 质量评分 | **1** — 无 | **4** — outcome 标签 + preference evidence | **3** — eval 静态基准（非实时） | **1** — 无 |
| Golden Principles | **2** — 存在但非结构化 | **4** — Core Mandates 节，命令式语言 | **3** — 命令式规则（代码注释形式） | **3** — 机械化 Permission Action（最无歧义） |
| **综合评分 (1-5)** | **1.25** | **4.25** | **2.5** | **1.5** |

**核心发现**：熵管理是所有维度里四个工程差距最大的。Codex 的两阶段管道实现了真正意义上的"Agent 工程的知识 GC"，而 Claude Code 和 OpenCode 在这个维度上几乎空白。Gemini CLI 的 eval 套件提供了静态的质量基准，但无法追踪运行时的动态漂移。

没有熵管理的 Agent 工程会面临一个不可见的技术债的积累——每次新的规则被添加而旧规则没有被清理，每次知识库被更新而过时内容没有被淘汰，Agent 的可靠性就在悄悄退化。这个退化不会触发任何警报，直到某次明显的错误让工程师回头检查历史才会发现。认识到这个维度，是在选择 Agent 工程时需要直面的一个现实。

## 多代理与验证隔离对比

# 多代理与验证隔离对比

单代理系统的根本性局限是确认偏差（Confirmation Bias）：当同一个 Agent 既执行任务又验证任务结果时，它的验证会受到它自己对任务的理解和期望的影响。一个 Agent 在写完一段代码后去"审查"这段代码，往往会看到它期望看到的，而不是代码实际有的问题。

这不是 Agent 智能不够的问题，而是认知结构的问题——即使是人类专家，自我审查的可靠性也远低于同行审查。解决方案是引入独立的验证角色：另一个 Agent（或人类）在不共享执行者上下文的情况下对结果进行检验。

这个维度我们关注的是：各工程是否意识到了确认偏差的问题，并设计了缓解机制。

---

## 1. Agent 委派模型

多代理系统的第一个前提是：有能力把任务委派给子 Agent，并让子 Agent 在相对独立的上下文里工作。没有委派能力的工程只能是单代理，验证独立性自然无从谈起。

### Claude Code

`claude-code/src/tools/AgentTool/` 实现了子 Agent 委派，在 `tools.ts:195` 注册为 `AgentTool`。但 `claude-code/src/constants/tools.ts:40-41` 指出 AgentTool 对非 Anthropic 内部（non-ant）用户禁用。这意味着：多代理委派能力在源码层面存在，但对外部用户不可用，状态隔离机制也没有显式设计。委派存在，但是私有、无隔离的。

### Codex

`codex/codex-rs/core/templates/agents/orchestrator.md` 的 Orchestrator 模板定义了协调者角色：Orchestrator 负责把任务分配给 workers，状态通过 DB 共享（Phase 1 提取结果 → Phase 2 整合）。这是一个完整的多代理架构：有角色分工、有共享状态机制、有任务分配协议。

### Gemini CLI

`gemini-cli/packages/core/src/agents/generalist-agent.ts` 实现了 `GeneralistAgent`，`subagent-tool-wrapper.test.ts` 对子 Agent 工具包装做了专门测试。多代理能力通过注册表模式组织，子 Agent 是一等公民，有专门的 API 和测试覆盖。

### OpenCode

无多代理架构可见。OpenCode 是单代理系统，所有任务在同一个 Agent 实例里完成。这是当前最主要的架构限制——不是功能上的欠缺，而是设计范式的选择，且这个选择使验证独立性无法在代码层面实现。

---

## 2. 验证阶段的独立性

知道"有多代理"和"多代理之间有有效的验证隔离"是两件不同的事。隔离需要在三个层面同时成立：上下文隔离（验证者不继承执行者的决策历史）、权限隔离（验证者不能修改它正在验证的内容）、递归隔离（验证者不能再委派给执行者，形成循环）。

### Claude Code

`claude-code/src/tools/VerifyPlanExecutionTool/` 的存在表明有验证的设计意图：

```typescript
// claude-code/src/tools.ts:91-95
const VerifyPlanExecutionTool =
  process.env.CLAUDE_CODE_VERIFY_PLAN === 'true'
    ? require('./tools/VerifyPlanExecutionTool/VerifyPlanExecutionTool.js')
        .VerifyPlanExecutionTool
    : null
```

但 `feature()` 始终返回 false 的反编译副作用意味着 `CLAUDE_CODE_VERIFY_PLAN` 永不为 true。验证工具存在于代码里，但在实际运行时是一个死代码路径。主循环在 `query.ts` 里同一上下文内处理工具调用和验证，无实际的确认偏差对冲机制。

### Codex

`consolidation.md` 的 Phase 2 子代理运行条件是四个工程里最严格的验证隔离实现：

- **独立子代理**：Phase 2 生成一个与 Phase 1 独立的子代理
- **no approvals**：验证阶段不能发起新的审批请求
- **no network**：验证阶段无网络访问
- **local write access only**：只有本地写访问
- **collab disabled**：禁止再次委派，防止递归

这五个约束共同构成了一个真正的验证隔离环境。验证子代理不继承 Phase 1 的上下文（它只看到 Phase 2 prompt 和整合后的 diff），不能修改它之外的资源，也不能把任务再次外包。

### Gemini CLI

`hookSystem.ts:259-305` 的 BeforeModel/AfterModel 分离使 Hook 链独立于 Agent 执行：

```typescript
async fireBeforeModelEvent(llmRequest): Promise<BeforeModelHookResult> {
  const result = await this.hookEventHandler.fireBeforeModelEvent(llmRequest)
  const hookOutput = result.finalOutput

  if (hookOutput?.shouldStopExecution()) {
    return { blocked: true, stopped: true }
  }
  // ...
}
```

Hook 在 Agent 决策前介入，且有独立的上下文（Hook 处理器不共享 Agent 的对话历史）。这是中等程度的隔离：Hook 是独立的代码路径，但 Hook 和 Agent 共享同一个 process 环境，不是真正的进程级隔离。

### OpenCode

`permission/index.ts` 的 Permission Service 在独立的 Effect Layer 里运行，这是代码级的隔离。但 OpenCode 是单代理，Permission Service 的隔离是对"人在回路"决策的隔离，而不是"Agent 验证 Agent 行为"的隔离。

---

## 3. 自我审查循环的可信度

当工程要求或允许 Agent 审查自己的输出时，这个自我审查有多少可信度？在什么情况下自我审查是有价值的，在什么情况下会产生虚假的安全感？

自我审查的可信度取决于两个条件：审查者能看到的信息是否与执行者不同（不同的视角），以及审查者是否有从不同角度真正质疑执行者的动机（对抗性角色）。满足其中一个能提高可信度，两个都满足才能实现真正有价值的自我审查。

**Claude Code**：主循环在 `query.ts` 里同一上下文处理一切。Agent 审查自己的输出时，使用与执行时相同的上下文、相同的假设、相同的偏见——可信度低。

**Codex**：`stage_one_system.md:561-565` 的 Phase 1 工作流引入了结构化的自我审查协议：

```markdown
Workflow:
0. Apply the minimum-signal gate（先过信号门控，无信号不处理）
1. Triage outcome using the common rules（按既定规则分类，避免主观判断）
2. Read the rollout carefully（仔细阅读执行记录，不跳过细节）
3. Return rollout_summary, rollout_slug, and raw_memory（输出结构化结果）
```

NO-OP 门控防止了"全部通过"的偏见（无信号时返回空，而不是强制生成记忆）。Outcome 标签的三值系统（success/partial/uncertain/fail）强制审查者在不确定时承认不确定（而不是默认成功）。Preference evidence 要求引号原文而非摘要，防止事后合理化。这些设计共同提高了自我审查的可信度，但仍然不如独立的外部审查。

**Gemini CLI**：没有专门的自我审查循环，审查通过 Hook System 部分实现。可信度依赖 Hook 实现的质量。

**OpenCode**：没有自我审查循环。质量判断完全依赖人工审批。

---

## 4. Ralph Wiggum Loop 实现

Ralph Wiggum Loop 是一个概念性描述，指的是全自动化的 PR-审查-合并循环：Agent 创建 PR → Agent（或另一个 Agent）审查 PR → Agent 响应审查意见 → Agent 合并。这是 Agent 自主工作流的理想形态，也是验证独立性要求最高的场景。

分析各工程对这个循环的支持，是为了判断它们在何种程度上支持"Agent 在最小人工干预情况下完成完整工作流"的使用场景。

**Claude Code**：无可见的 PR 流程自动化支持。AgentTool 理论上可以被用来构建类似的循环，但需要外部编排，且 AgentTool 对外部用户禁用。

**Codex**：记忆管道（Phase 1 提取 → Phase 2 整合）从逻辑上覆盖了 Wiggum Loop 的部分阶段：Phase 1 相当于"提交工作成果"，Phase 2 相当于"独立审查"，结果入 DB 相当于"合并"。但这是记忆管道的类比，不是代码 PR 流程的实现。真正的 PR 流程（git PR、GitHub API）没有内置支持。

**Gemini CLI**：无 PR 流程内置支持。MCP 接入理论上可以调用 GitHub API 来实现，但需要外部配置和编排。

**OpenCode**：无 PR 流程实现。单代理架构使这个循环需要完全依赖外部编排。

---

## 总结对比表

| 维度 | Claude Code | Codex | Gemini CLI | OpenCode |
|------|-------------|-------|------------|----------|
| 委派模型 | **2** — AgentTool 存在但外部用户禁用，无状态隔离 | **4** — Orchestrator + DB 共享状态，角色分工明确 | **3** — GeneralistAgent + 子 Agent API，有测试覆盖 | **1** — 单代理，无委派 |
| 验证独立性 | **1** — VerifyPlanExecutionTool feature-flagged，实际死代码 | **5** — Phase 2 五重隔离（无审批、无网络、仅本地写、无递归） | **3** — Hook 独立代码路径，非进程级隔离 | **2** — Effect Layer 隔离，但单代理、验证即人工 |
| 自我审查可信度 | **1** — 同一上下文，无对抗机制 | **4** — NO-OP 门控 + outcome 标签 + 引号证据要求 | **2** — Hook 部分对冲，无专门协议 | **1** — 无自我审查循环 |
| Wiggum Loop | **1** — 无支持 | **3** — 记忆管道类比（非代码 PR） | **2** — MCP 理论上可接，需外部编排 | **1** — 单代理，无支持 |
| **综合评分 (1-5)** | **1.25** | **4** | **2.5** | **1.25** |

**核心发现**：多代理验证隔离是 Agent 工程成熟度的高水位线。目前仅有 Codex 实现了足够严格的验证隔离（Phase 2 的五重约束），其他三个工程要么是单代理（OpenCode），要么是验证工具存在但不可用（Claude Code），要么是隔离不完整（Gemini CLI 的 Hook 共享进程）。

接下来的[人类引导机制](./10-human-steering.md)，关注的是当自动化验证不足时，人类如何介入并且代价有多高。

## 人类引导机制对比

# 人类引导机制对比

无论自动化控制机制多么完善，人类始终是 Harness Engineering 里的终极仲裁者。Harness 的目标不是消除人类参与，而是让人类参与发生在正确的时刻、以正确的代价、产生正确的效果。

人类引导机制的质量取决于两个因素的平衡：一方面，如果审批门槛太高、操作太繁琐，人类会选择不参与（批准所有请求而不真正审查，或者完全绕过），导致实质性的控制丧失；另一方面，如果没有审批机制，人类只能在事后发现问题，修复成本更高。理想的引导机制是"在真正重要的决策上要求人类参与，在低风险操作上不打扰"。

---

## 1. 审批门槛的粒度与透明度

审批门槛定义了"什么样的 Agent 操作需要人类明确同意"。门槛太低（几乎所有操作都需要批准）会让人类疲于应对，最终产生习惯性批准；门槛太高（几乎什么都不需要批准）使人类无法有效干预危险操作。透明度则决定了人类能否看懂自己在批准什么——不透明的审批请求往往会被默认批准，而不是真正被审查。

### Claude Code

`claude-code/src/constants/tools.ts:36-112` 的工具 Allowlist 把权限管理硬编码在 TypeScript 文件里。人类用户看到的是工具的允许/禁止结果，但不能看到也不能修改审批的规则本身（除非修改源码）.

**粒度**：工具级——要么整个工具被允许，要么整个工具被禁止。没有"允许这个工具但不允许这个参数组合"的表达能力。
**透明度**：低。用户知道某个工具会被允许或拒绝，但不知道原因是什么规则导致的，也无法查看完整的权限规则列表。

### Codex

`codex/codex-rs/protocol/src/prompts/permissions/approval_policy/` 的四种 policy 文件是人类可读的 Markdown 文档。团队可以直接读取这些文件，理解当前的审批策略是什么，以及为什么这样设计。

- `never.md` — 从不请求人工审批（完全信任 Agent）
- `on_failure.md` — 仅在操作失败时请求审批
- `on_request_rule_request_permission.md` — 按照显式规则决定是否请求审批
- `unless_trusted.md` — 除非 Agent 已被明确信任，否则请求审批

**粒度**：Policy + 命令分段（每个 shell 控制操作符生成的段独立评估）。
**透明度**：高。规则是 Markdown 文件，可读、可审查、可版本化。

### Gemini CLI

`confirmation-policy.test.ts` 覆盖了三种 ApprovalMode（DEFAULT / PLAN / YOLO）。三个模式之间的区别是明确的：DEFAULT 是标准交互，PLAN 是计划审查后执行，YOLO 是跳过所有确认。这个模式选择系统对用户透明——你选择了什么模式，你就知道会发生什么。

**粒度**：模式级——在同一模式内，所有工具的审批行为一致。
**透明度**：中。模式的含义是清晰的，但具体哪个操作触发确认、哪个不触发，需要了解各工具的确认策略实现。

### OpenCode

`opencode/packages/opencode/src/permission/index.ts:19-24` 的 `Action` 枚举（allow/deny/ask）加上路径模式匹配，提供了最细粒度的权限表达：每条权限规则明确对应一个路径模式和一个操作类型。`ask` 状态把决策权推给用户，但用户在决策时有具体的上下文（"你要求读取 `/etc/passwd`，是否允许？"），而不是模糊的"工具 X 请求权限"。

**粒度**：细，Pattern + Action 的组合。
**透明度**：中。Schema 定义清晰，但运行时的审批请求是否携带足够上下文取决于实现。

---

## 2. 中断与恢复的设计

当人类需要中断一个正在进行的 Agent 任务时，中断后能否恢复到有意义的状态？这个问题决定了人类干预的代价：如果中断意味着所有进度丢失、必须从头开始，人类会在"该中断时不愿中断"，导致失控任务被允许继续运行。

**Claude Code**：`/clear` 命令触发 `clearSystemPromptSections()`（`systemPromptSections.ts:60-68`），清理缓存状态。这是简单中断，无结构化恢复路径——中断后 session 重置，之前的进度不能被直接续接。中断代价高，对用户形成"不到万不得已不要中断"的心理压力。

**Codex**：`codex/codex-rs/core/templates/review/history_message_interrupted.md` 专门为中断情况提供了模板。当任务被中断时，审查模板引导模型从执行记录里推断任务在中断前的进度，并生成合理的恢复建议。状态 DB 支持跨 session 恢复——Codex 的有状态架构使中断后能从接近中断点的位置继续，而不必从头开始。

**Gemini CLI**：`hookSystem.ts:220-225` 的 `fireSessionStartEvent` 在每次 session 开始时触发，这为恢复逻辑提供了注入点——Hook 实现者可以在 SessionStart 里检查是否有未完成的任务，并相应地恢复上下文。这是事件化的中断恢复：框架提供了钩子，具体恢复能力取决于 Hook 实现。

**OpenCode**：`permission/index.ts:151-160` 的 Finalizer 在 Effect 作用域结束时清理 pending 权限请求，防止未处理的权限请求永久阻塞。但没有显式的任务状态恢复机制——中断意味着 pending 请求被标记为 RejectedError，任务从这里无法续接。

---

## 3. 团队级治理文件体系

单用户使用 Agent 和团队协作使用 Agent 面临完全不同的治理挑战。在团队场景里，规则冲突（不同成员设置了互相矛盾的规则）、规则覆盖责任（谁能修改哪些规则）、规则可见性（团队成员能否看到彼此的规则设置）都成为需要解决的问题。

**Claude Code**：`claudemd.ts:1-26` 的四层文件体系（Managed → User → Project → Local）天然映射了团队责任分工：系统管理员管理 Managed 层，个人用户管理 User 和 Local 层，团队共同维护 Project 层（通过 Git）。`.claude/rules/*.md` 的条件规则使团队可以按文件路径分配不同规则集，实现"这条规则只对这个目录下的文件生效"的精细控制。

**Codex**：`codex/docs/agents_md.md` 是专门给团队工程师阅读的 AGENTS.md 规范文档，解释了规则的语义、优先级和冲突解决方式。`default.md:17-27` 里的嵌套优先规则（更深嵌套的 AGENTS.md 优先级更高）提供了可预测的冲突解决机制。这是四个工程里团队治理规范最完整的实现——既有给工程师的文档，又有给 Agent 的规范。

**Gemini CLI**：`HierarchicalMemory` 的三层接口（global / extension / project）提供了清晰的责任分工框架：global 由组织配置，extension 由扩展维护，project 由项目团队协作维护。每层的来源和权威性是明确的。

**OpenCode**：`skill/index.ts:143-157` 的 `Config.directories()` 扫描和 `permission/index.ts:278-290` 的 `Permission.fromConfig()` 提供了配置驱动的治理路径。但团队协作规范（谁写 Skill、谁审批 Permission 规则、如何解决规则冲突）需要团队自行建立，没有内置的引导。

---

## 4. Steering Loop 操作成本

Steering Loop 是人类发现问题、调整 Agent 行为、验证调整效果的完整循环。这个循环的操作成本（时间、认知负担）决定了团队实际使用引导机制的频率——成本越低，引导越频繁，Agent 行为越贴近团队预期。

**Claude Code**：Steering Loop 路径是：发现问题 → 找到相关 CLAUDE.md 文件 → 编辑规则 → 测试验证 → 确认效果。问题在于：如果相关规则散落在 1166 行的单文件或多个 CLAUDE.md 里（四层体系），"找到相关规则"本身就是高成本操作。高认知负担。

**Codex**：Steering Loop 路径是：发现问题 → 确定是哪个 template 文件负责 → 编辑对应文件 → 验证。模板按功能域组织在 `templates/` 目录里，"找到相关 template"的成本远低于 Claude Code——你知道问题出在 collaboration 模式，就去 `collaboration_mode/` 目录找。中等成本。

**Gemini CLI**：Steering Loop 路径是：发现问题 → 确定是哪个 Snippet 或 Hook 负责 → 编辑 → 运行 eval 验证。Snippet 函数化意味着"找到相关代码"可以通过 grep 函数名快速完成，eval 套件提供了即时的反馈验证。中等成本，且验证成本低于其他工程（eval 直接运行，不需要 session 级的手动测试）。

**OpenCode**：Steering Loop 路径是：发现问题 → 修改 Permission Schema 或添加 Skill → Effect 层重新加载。Effect-ts 的 Layer 模式理论上支持热加载（不需要重启服务），这能显著降低验证成本。但 Permission Schema 的修改需要了解 Effect-ts，学习曲线是额外成本。

---

## 总结对比表

| 维度 | Claude Code | Codex | Gemini CLI | OpenCode |
|------|-------------|-------|------------|----------|
| 审批门槛粒度 | **粗**（工具级 Allowlist） | **细**（Policy + 命令分段） | **中**（模式级，三种 ApprovalMode） | **细**（Pattern + Action + Deferred） |
| 审批透明度 | **低**（硬编码，用户不可见） | **高**（Markdown 文件，可读可审查） | **中**（模式语义清晰，细节需读代码） | **中**（Schema 清晰，运行时上下文依赖实现） |
| 中断恢复 | **无**（/clear 全清，不可续接） | **有**（中断模板 + DB 状态支持） | **事件化**（SessionStart Hook 注入点，恢复靠实现） | **有限**（Finalizer 清理 pending，无续接路径） |
| 团队治理完整度 | **高**（四层体系 + 条件规则，但缺少规范文档） | **最高**（工程师文档 + Agent 规范 + 嵌套优先规则） | **中**（三层接口清晰，责任分工明确） | **中**（配置驱动，但无协作规范） |
| Steering Loop 成本 | **高**（百科全书结构，找规则难） | **中**（模板按功能域组织，定位容易） | **中低**（函数化 + eval 验证，定位和验证都快） | **低**（理论热加载，但 Effect-ts 学习曲线） |
| **综合评分 (1-5)** | **2.5** | **4** | **3** | **3** |

**核心洞察**：人类引导机制质量的终极指标，不是"有多少控制点"，而是"团队实际上会不会使用这些控制点"。Claude Code 的引导机制存在（四层文件体系、工具 Allowlist），但高成本低透明度使实际使用频率可能不高；Codex 的引导机制设计得最正式（文档化、规范化），长期来看维护成本最低。

## 扩展性与 Harness 生态对比

# 扩展性与 Harness 生态对比

没有任何分析框架能覆盖所有控制维度，没有任何初始配置能预见团队未来的所有需求。扩展性衡量的是：当团队需要添加新的控制点（一个新工具、一个新权限规则、一个新的验证机制）时，代价有多高？这个代价是一次性的学习成本，还是每次扩展都要承担的结构性成本？

扩展性差的工程面临一个残酷的现实：随着团队对 Agent 行为的理解加深，他们会发现越来越多需要控制的边界情况，而如果每次添加控制点都需要大量工程工作，这些控制点最终会被放弃——不是因为不重要，而是因为成本太高。

---

## 1. MCP Server 接入方式

MCP（Model Context Protocol）是 AI 工具生态里的一个重要标准，它定义了 Agent 如何接入外部服务（数据库、代码仓库、通信工具等）。MCP 接入能力决定了工程师能否通过扩展工具集合来控制 Agent 的行为范围，而不必修改核心代码。

**Claude Code**：`claude-code/src/tools/McpTool/` 实现了 MCP 工具，在 `tools.ts:245-246` 注册 `ListMcpResourcesTool` 和 `ReadMcpResourceTool`。MCP 接入是运行时的——Agent 可以在运行时发现和调用 MCP Server 提供的工具，不需要修改代码来接入新的 MCP Server。

**Codex**：`codex-rs/app-server/src/codex_message_processor/plugin_mcp_oauth.rs` 的 MCP OAuth 实现表明 Codex 通过插件架构接入 MCP Server。OAuth 支持意味着 Codex 能接入需要认证的企业级 MCP Server（如 GitHub Enterprise、Jira、Confluence），这对团队级别的工具集成有实际价值。

**Gemini CLI**：`gemini-cli/packages/core/src/tools/mcp-client.ts` 的 `McpClient` 和 `mcp-client-manager.ts` 的 `McpClientManager` 构成了完整的 MCP 客户端。Client Manager 负责管理多个 MCP Server 连接的生命周期，这是四个工程里 MCP 接入最完整的实现—— MCP 不只是"能用"，而是有完整的连接管理和生命周期控制。

**OpenCode**：`opencode/packages/opencode/src/mcp/index.ts` 的 `MCP` 命名空间提供了 MCP 支持。实现存在，但没有 Gemini CLI 的 Manager 层，多个 MCP Server 的连接管理需要调用方自行处理。

---

## 2. Skills/Plugin 的加载与版本化

Skills 和 Plugin 是推断型前馈的主要扩展机制：通过添加新的 Skill 文件，团队可以在不修改代码的情况下扩展 Agent 的行为指导。版本化能力决定了 Skill 库能否被当作一个独立的资产来维护和演进。

**Claude Code**：SkillTool 在工具列表里（`tools.ts:212`），通过 CLAUDE.md 的 @include 引用链加载 Skill。无版本锁定机制——Skill 内容随 CLAUDE.md 文件一起更新，没有独立的版本管理。

**Codex**：`codex/.codex/skills/` 目录的 Skill 文件用 frontmatter 定义元数据，`skill-installer/SKILL.md` 的格式示例展示了结构化 Skill 的写法。frontmatter 包含版本信息，这意味着 Skill 库可以有版本化的演进路径，不同项目可以锁定到不同版本的 Skill。

**Gemini CLI**：`activate-skill.ts` 的 `ActivateSkillTool` 把 Skill 激活建模为工具调用，`snippets.ts:107-115` 负责 Skills 渲染到 System Prompt。Skill 的版本化依赖文件系统，无独立版本锁定。

**OpenCode**：`skill/index.ts:104-117` 的 `scan()` 函数支持 glob 目录扫描和 URL 远程拉取：

```typescript
const scan = async (state: State, root: string, pattern: string, opts?) => {
  return Glob.scan(pattern, {
    cwd: root,
    absolute: true,
    include: "file",
    symlink: true,
    dot: opts?.dot,
  }).then((matches) => Promise.all(matches.map((match) => add(state, match))))
}
```

URL pull 是 OpenCode Skill 系统的独特能力：团队可以把 Skill 库放在独立仓库（甚至 CDN），通过 URL 引用，实现 Skill 库的独立版本化和跨项目共享。这是四个工程里 Skill 扩展能力最强的实现。

---

## 3. 新增自定义 Lint 传感器的最小修改点

这是一个具体的扩展场景测试：如果我想为 Agent 添加一个自定义的代码质量检查工具（Lint 传感器），我需要修改哪些文件，是否需要改动核心代码？这个测试揭示了工程的扩展成本结构。

**Claude Code**：最小修改点为 3 处：
1. `src/tools/<NewLintTool>/` — 创建新工具目录和实现
2. `src/tools.ts` — 在 `getAllBaseTools()` 注册新工具
3. （如需条件启用）相关的 feature flag — 但 feature() 始终 false，等于无效

核心路径不需要修改，工具系统是解耦的。但类型系统失效使开发过程缺乏安全保证。整体中等成本。

**Codex**：最小修改点深入 Rust 代码：
1. `codex-rs/app-server/src/` — 新工具的 Rust 实现
2. `codex-rs/protocol/src/prompts/` — 如需修改 Prompt 以说明新工具的使用

Rust 的学习曲线和编译时间是实质性的成本。任何 Rust 代码修改都需要完整的编译流程（可能需要数分钟），这使迭代周期相对较长。高成本，但稳定性最高。

**Gemini CLI**：最小修改点仅 2 处：
1. `packages/core/src/tools/<NewLintTool>.ts` — 新工具实现
2. `packages/core/src/tools/tool-registry.ts` — 注册（如需要，部分工具通过自动发现注册）

不改核心，完全模块化。TypeScript 的修改-编译-测试循环比 Rust 快得多，且 eval 套件提供了即时的回归测试。低成本。

**OpenCode**：最小修改点也是 2 处：
1. `packages/opencode/src/permission/index.ts` — 新 Permission 规则（如果新工具需要特殊权限）
2. `packages/opencode/src/skill/index.ts` — 新 Skill 定义（如果新工具需要说明指令）

在 Effect-ts Layer 模式下，新工具通常不需要修改核心代码，只需在正确的 Layer 添加实现。但 Effect-ts 的概念（Fiber、Layer、ServiceMap、Effect）是额外的学习成本，对不熟悉的工程师来说入门门槛高。低成本（熟悉 Effect-ts 后）或高成本（学习期）。

---

## 4. Harness 资产的跨工程迁移可行性

当团队从一个 Agent 工程迁移到另一个时，他们积累的 Harness 资产（规则文件、Skill、Policy）能否被复用？迁移可行性高的工程使团队不必"从零开始"，能保留他们在旧工程里的控制机制投入。

**Claude Code**：CLAUDE.md 文件和 `.claude/rules/*.md` 可以直接迁移（它们是普通 Markdown 文件）。但 feature flag 系统（Anthropic 内部）不可迁移，依赖 feature flag 的控制机制在迁移后失效。百科全书式的 CLAUDE.md 在迁移到结构化要求更严格的工程时需要重组。中等迁移性。

**Codex**：`templates/` 目录下的所有 Markdown 文件、AGENTS.md 文件、approval policy .md 文件，几乎可以完整迁移到任何支持 AGENTS.md 规范的工程。Codex 的格式（Markdown + YAML frontmatter for Skill）是通用格式，与工程自身的技术栈无耦合。最高迁移性。

**Gemini CLI**：GEMINI.md 文件可以迁移，但 Snippet 函数（TypeScript 代码）需要目标工程也使用 TypeScript 环境。如果迁移目标是非 TypeScript 工程，Snippet 的形式价值消失（需要重写为目标环境的格式）。中等迁移性（取决于目标技术栈）。

**OpenCode**：Skill 文件（Markdown + frontmatter）可以迁移。Permission Schema（TypeScript + Zod）和 Effect-ts Layer 深度绑定 OpenCode 的架构，无法直接迁移。中等迁移性（Skill 可迁，架构绑定不可迁）。

---

## 总结对比表

| 维度 | Claude Code | Codex | Gemini CLI | OpenCode |
|------|-------------|-------|------------|----------|
| MCP 接入 | **3** — 运行时接入，简单实用 | **3** — Plugin + OAuth，企业级认证支持 | **4** — 完整 MCP Client Manager，连接生命周期管理 | **3** — MCP 命名空间，无 Manager 层 |
| Skill 版本化 | **1** — 无独立版本管理 | **3** — frontmatter 版本化，可锁定版本 | **1** — 依赖文件系统，无版本锁定 | **2** — URL pull 支持独立仓库，但无锁定机制 |
| 扩展最小成本 | **3** — 中等（TypeScript + 注册，类型不安全） | **2** — 高（Rust 编译 + 学习曲线） | **4** — 低（模块化 TypeScript，eval 快速验证） | **3** — 低（熟悉 Effect-ts 后）或高（学习期） |
| 迁移可行性 | **3** — Markdown 资产易迁，feature flag 不可迁 | **5** — Markdown 格式通用，几乎完整迁移 | **3** — Markdown 易迁，Snippet TS 绑定 | **3** — Skill 易迁，架构层不可迁 |
| 热加载 | **1** — 无热加载，所有变更需重启 session | **1** — 无热加载 | **1** — 无热加载 | **2** — Effect Layer 理论支持，实践取决于实现 |
| **综合评分 (1-5)** | **2.2** | **2.8** | **2.6** | **2.6** |

**观察**：扩展性这个维度里，四个工程的差距没有其他维度那么大。这是因为所有工程都基于类似的"注册工具 + 编辑规则文件"的扩展模式，差别主要在执行成本（Rust vs TypeScript）和资产可移植性（Markdown 格式的通用性）。Codex 在迁移可行性上的优势（纯 Markdown 格式）是实质性的——它使 harness 资产成为工程无关的可复用资产，而不是绑定在特定技术栈里的专有配置。

扩展性分析完毕后，我们具备了评估所有维度的完整证据。[综合裁定](./12-synthesis.md)将这些证据汇合成最终的定位图、评分卡和选型建议。

## 综合裁定

# 综合裁定

经过前十一个维度的分析，我们已经积累了足够多的源码层面的证据。这里不做重复罗列，而是把这些证据汇合成三个层次的结论：四象限定位图（Where are they?）、评分卡（How do they compare?）、选型建议（Who should use what?）。

每一个判断都基于可观察的代码实现，不基于宣传文档或功能描述。评分的标准是"当前实现的实际效果"，而不是"设计意图的质量"。

---

## 1. 四象限定位图

横轴：**运行时连续性成熟度**（Agent 能否跨 session 积累知识、维持一致性）
纵轴：**控制平面显式化程度**（规则是否对团队透明、可审查、可版本化）

```mermaid
%%{init:{'theme':'neutral'}}%%
quadrantChart
    title Harness Engineering 四工程定位
    x-axis 运行时连续性成熟度 (Runtime Continuity) --> 高
    y-axis 控制平面显式化程度 (Control Plane Explicitness) --> 高
    quadrant Runtime-first 高控制
    quadrant Runtime-first 低控制
    quadrant Control-plane-first 高控制
    quadrant Control-plane-first 低控制
    point "Claude Code": [0.3, 0.4]
    point "Codex": [0.7, 0.85]
    point "Gemini CLI": [0.6, 0.65]
    point "OpenCode": [0.35, 0.35]
```

### 定位说明

**Codex (0.7, 0.85)** — 右上象限：控制平面优先 + 高运行时连续性

Codex 到达右上象限的路径是清晰的：两阶段记忆管道（Phase 1/2）实现了四个工程里唯一的跨 session 知识积累，推动它在横轴上处于最右；Markdown 模板文件 + AGENTS.md 规范 + approval policy 体系使控制规则对团队全透明，推动它在纵轴上处于最高。Rust borrow checker 的编译期保证是这个定位的底层基础——它使 harness 代码的可靠性比其他工程高出一个量级。

**Gemini CLI (0.6, 0.65)** — 中右象限：运行时与控制平面的平衡

Gemini CLI 的 Hook System（BeforeModel/AfterModel 完整生命周期）和 29+ eval 文件提供了较高的运行时连续性（横轴 0.6），而 Snippet 函数组合的控制平面虽然不如 Codex 的 Markdown 文件直观，但比 Claude Code 的 TypeScript 硬编码更透明（纵轴 0.65）。Gemini CLI 是四个工程里唯一真正平衡了两个轴的工程。

**Claude Code (0.3, 0.4)** — 左中象限：运行时优先 + 低控制

Claude Code 的低运行时连续性（横轴 0.3）来自两个根因：无 GC 机制（知识不会被主动整理和更新），以及 feature flag 体系因反编译失效（本应存在的连续性特性不实际运行）。控制平面的显式度（纵轴 0.4）被 TypeScript 硬编码的规则和 1341 个 tsc 错误拖低——规则存在，但团队看到和修改的成本高。

**OpenCode (0.35, 0.35)** — 左下象限：运行时优先 + 低控制

OpenCode 的定位反映了它当前的开发阶段：单代理架构（无多代理验证）、无熵管理机制、Permission Schema 清晰但孤岛化。Effect-ts 的理论可治理性（Layer 模式、ServiceMap 依赖注入）是潜力，而不是当前实现的现实。

---

## 2. Harness Engineering 评分卡

以下评分基于源码可观察实现，每个维度满分 5 分。括号内的来源是关键证据的引用。

| 维度 | Claude Code | Codex | Gemini CLI | OpenCode |
|------|:-----------:|:-----:|:----------:|:--------:|
| **前馈控制** | 2 | 4 | 3 | 3 |
| — 证据 | `claudemd.ts` 分层加载，但百科全书结构 + 类型系统失效 | `base_instructions/default.md` 276 行结构化 AGENTS.md 规范 | `snippets.ts:123-151` Snippet 函数组合 | `permission/index.ts:19-24` Zod Schema |
| **反馈控制** | 2 | 4 | 3 | 2 |
| — 证据 | `query.ts` 无结构化反馈，Hook feature-flagged | `stage_one_system.md:150-201` outcome 标签 + NO-OP 门控 | `hookSystem.ts:259-305` BeforeModel/AfterModel + 29+ eval | `permission/index.ts:260-264` pending list，无自动闭环 |
| **工具治理** | 2 | 4 | 3 | 3 |
| — 证据 | `tools.ts:36-112` 工具级 Allowlist，硬编码，无沙箱 | `approval_policy/` Policy + 命令分段 + 三层沙箱 | `confirmation-policy.test.ts` 三种 ApprovalMode + 完整 MCP Client | `permission/index.ts:292-307` 细粒度 Action + Pattern |
| **上下文工程** | 3 | 4 | 3 | 2 |
| — 证据 | `claudemd.ts:790-1074` 四层分层加载 | Phase 1/2 跨 session + `consolidation.md` usage-based 遗忘 | `HierarchicalMemory` 三层 + Agent 可主动写记忆 | `skill/index.ts` 目录扫描，无 Compact 策略 |
| **可驾驭性** | 2 | 5 | 3 | 2 |
| — 证据 | `tsconfig.json` ~1341 错误，类型系统归零 | Rust borrow checker 编译期保证 + crate 边界强制 | TypeScript 中等严格度 + 注册表模式 | Zod 运行时验证 + Effect Layer（非编译期） |
| **熵管理** | 1 | 5 | 2 | 1 |
| — 证据 | 无 GC，memoize 无过期 | Phase 1/2 两阶段 + usage-count 遗忘 + outcome 质量标签 | `hookSystem.ts:226-237` SessionEnd 事件（被动） | 无熵管理，仅 Effect Finalizer |
| **验证独立性** | 1 | 4 | 2 | 2 |
| — 证据 | `VerifyPlanExecutionTool` feature-flagged，死代码 | Phase 2 五重隔离（无审批/网络，只允许本地写，禁止递归） | BeforeModel/AfterModel 分离（非进程级） | Effect Layer 隔离，但单代理 |
| **团队落地** | 3 | 4 | 3 | 3 |
| — 证据 | 四层文件体系 + 条件规则 | `docs/agents_md.md` 规范 + default.md 语义 + 嵌套优先规则 | `HierarchicalMemory` 接口 + eval 验证 | `Config.directories()` + `Permission.fromConfig()` |
| **总分 (40)** | **16** | **34** | **22** | **18** |
| **均分 (5)** | **2.0** | **4.25** | **2.75** | **2.25** |

---

## 3. 三类团队的选型建议

评分卡提供的是客观对比，选型建议需要把团队的实际情况纳入考量。以下三个场景覆盖了 Agent 工具使用中最常见的痛点类型。

### a) 长会话经常失控型

症状：Agent 工作一段时间后"忘记"了最初的指令，开始做一些没有被要求的事情；或者对话太长后 Agent 开始自相矛盾。

**优先选择：Gemini CLI**

Hook System 提供 BeforeModel/AfterModel 生命周期管理（反馈控制评分 3），使每次 Agent 决策前后都能注入检查逻辑。`fireSessionEndEvent`（`hookSystem.ts:226-237`）在会话结束时触发清理，维持会话边界。Snippet 模板化使会话规则可以版本化管理，不会因为规则散落在百科全书式文档里而失控。

**为什么不是 Codex**：Codex 的控制平面优先路线要求团队先建立制度（先写好 Approval policy，先定义模板体系），才能享受控制带来的收益。对于"先跑起来，边跑边治理"的团队，这个前期投入可能太高。Gemini CLI 的 Hook System 更接近"即插即用"的控制模式。

**为什么不是 Claude Code**：feature() 始终返回 false 导致条件分支走死代码路径，即使 Claude Code 有 Hook 机制，在反编译环境下也无法依赖它实际运行。

### b) 规则来源过散、权限边界不清型

症状：团队无法说清楚哪条规则从哪里来，不同成员设置的规则互相冲突，也不知道 Agent 在某个情况下会遵守哪条规则。

**优先选择：Codex**

Approval policy 四种模式强制团队明确"什么操作需要人工审批"（工具治理评分 4）。AGENTS.md 的嵌套优先规则提供了可预测的冲突解决机制——更深嵌套的规则总是优先，直接指令总是优先于文件规则（`default.md:25-26`）。`codex/docs/agents_md.md` 的规范文档让每个团队成员都能读懂规则体系，而不需要阅读源码（团队落地评分 4）。

**为什么不是 Claude Code**：Claude Code 的权限模型（`ALL_AGENT_DISALLOWED_TOOLS`）是硬编码集合，用户无法查看完整规则，无法在不修改源码的情况下调整权限边界。规则的不透明正是这类团队痛点的根源之一。

**为什么不是 OpenCode**：OpenCode 的 Permission Schema 虽然清晰，但缺少 Codex 那样的配套规范文档和冲突解决机制。团队在 OpenCode 上建立规则体系，需要自己设计协作规范，而 Codex 的规范是开箱即用的。

### c) 从零开始型

症状：团队还没有建立 Agent 工作流，想学习如何建立可控的 Agent 系统。

**两条路线并行推荐**

**Gemini CLI 路线**（学习推断型控制平面）：
- Snippet 函数组合直观：Prompt 即代码，可以单独修改和测试每个 Snippet
- 29+ eval 文件提供即时反馈循环：改一个规则，eval 立刻告诉你效果
- Hook System 是推断型前馈 + 反馈的完整示例：从这里理解 Agent 控制的实时性

**Codex 路线**（学习工程化控制）：
- 两阶段记忆管道是迄今最完整的熵管理实现：从这里理解"Agent 如何跨 session 保持一致性"
- Phase 1/2 的分离展示了如何实现验证隔离，对抗确认偏差
- Rust borrow checker 示范了编译期强制的最高水位线，理解它有助于评估其他工程的类型安全现实

**为什么不推荐从 Claude Code 开始**：反编译副作用导致大量条件分支是死代码，学习者无法从代码行为推断设计意图，容易形成错误的心智模型。Claude Code 更适合作为"分析反模式"的研究对象，而不是学习对象。

---

## 4. 一句话定性

| 工程 | 最终判断 |
|------|----------|
| **Claude Code** | 反编译 CLI，类型系统失灵且无熵管理，运行时优先路线因 feature flag 全部失效而沦为无控制保证的裸跑；四层文件体系是其唯一实质性的 harness 投入。 |
| **Codex** | 控制平面优先的当前标杆：Approval/Exec 双层 policy + Rust 编译期保证 + 两阶段记忆管道，是 Harness Engineering 各维度综合得分最高的实现，代价是 Rust 的入门门槛和"先建制度再跑 Agent"的时序要求。 |
| **Gemini CLI** | Hook System + Snippet 模板的平衡路线，eval 套件提供行为层面的持续验证，是"即插即用控制"的最佳实践；主要缺口是无主动熵管理和验证独立性不足，团队需自建 GC 机制。 |
| **OpenCode** | Effect-ts 架构提供理论上强大的可组合性，Permission Schema 的机械化审批是最无歧义的 harness 形式；当前阶段的主要限制是单代理、无熵管理、Skill 库孤岛化，工程成熟度仍在建设中。 |

---

*本文档由源码驱动分析生成，所有评分和结论基于 `claude-code/src/`、`codex/codex-rs/`、`gemini-cli/packages/core/src/`、`opencode/packages/opencode/src/` 的可观察实现。分析时间：2026 年，各工程版本分别为 Claude Code 2.1.87、Codex rust-v0.118.0、Gemini CLI v0.36.0、OpenCode v1.3.2。*
