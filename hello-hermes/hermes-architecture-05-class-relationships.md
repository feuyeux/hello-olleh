# Hermes 架构解析 (五)：类关系篇 · 核心对象与协作模式 (v2026.4.16)

> 基于第四篇《调试篇 · 完整链路走查》,本文聚焦 Hermes 核心类的职责划分、依赖关系与协作模式,帮助开发者快速定位关键对象并理解系统设计意图。

## 概览

Hermes 的类设计遵循**单一职责**与**分层解耦**原则:

- **编排层** (`AIAgent`) 负责对话循环、工具调度、上下文管理、凭据恢复与 provider fallback
- **状态层** (`SessionDB`, `MemoryStore`, `TodoStore`) 负责持久化与会话管理
- **工具层** (`ToolRegistry`, 各 `*_tool.py`, `ManagedToolGateway`) 负责能力扩展、自注册与托管后端
- **上下文层** (`ContextCompressor`, `PromptBuilder`) 负责 token 预算与 prompt 组装
- **适配层** (`AnthropicAdapter`, `BedrockAdapter`, Responses API) 负责多 provider 协议转换
- **记忆层** (`MemoryManager`, `MemoryProvider`) 负责长期记忆与自改进
- **浏览器层** (`BrowserProvider`, `Browserbase`, `BrowserUse`, `Firecrawl`) 负责可插拔浏览器后端
- **插件层** (`DashboardPlugin`, Theme System) 负责 Dashboard 扩展与主题定制

![Hermes 类关系图](images/hermes-class-diagram.svg)

---

## 1. 核心编排类：`AIAgent`

**位置**: `hermes-agent/run_agent.py` (L535, `__init__` at L552)

**职责**: 对话主循环编排器,负责:
- LLM API 调用 (流式/非流式,支持 4 种 api_mode)
- 工具调用批次执行 (串行/并行)
- 上下文压缩触发
- 会话持久化协调
- 中断与重试处理
- 凭据轮换与 provider fallback

**关键属性**:
```python
class AIAgent:
    model: str                          # 当前使用的模型名
    api_mode: str                       # "chat_completions" | "anthropic_messages" | "codex_responses" | "bedrock_converse"
    provider: str                       # "anthropic" | "openai" | "openrouter" | "bedrock" | "xai" | "ollama" | ...
    base_url: str                       # API endpoint
    
    # 状态管理
    session_id: str                     # 当前会话 ID
    iteration_budget: IterationBudget   # 迭代预算控制器
    messages: List[Dict]                # 对话历史
    
    # 组件依赖
    session_db: SessionDB               # SQLite 会话存储
    compressor: ContextCompressor       # 上下文压缩器
    memory_manager: MemoryManager       # 记忆管理器
    checkpoint_manager: CheckpointManager  # 文件回滚管理器
    todo_store: TodoStore               # 任务跟踪器
    
    # 工具集
    enabled_toolsets: List[str]         # 启用的工具集
    tool_definitions: List[Dict]        # 当前可用工具 schema
    
    # v0.10.0 新增
    reasoning_config: Dict              # 推理配置 (extended thinking 等)
    service_tier: str                   # 服务层级 (default / priority)
    fallback_model: str                 # 主模型不可用时的回退模型
    credential_pool: List[Dict]         # 凭据池 (多 API key 轮换)
    checkpoints_enabled: bool           # 是否启用文件快照
    gateway_session_key: str            # Gateway 会话密钥
```

**核心方法**:
- `run_conversation(user_input)` — 主循环入口,处理单次用户请求
- `_build_system_prompt()` — 组装 system prompt (L3335, SOUL.md + memory + skills + context files)
- `_compress_context()` — 触发上下文压缩 (L7136) 并切换 session lineage
- `_execute_tool_calls()` — 批量执行工具调用 (支持并行)
- `_persist_session()` — 统一持久化到 JSON log + SQLite

**v0.10.0 新增方法族**:

*Responses API (L3673-4699)*:
- `_responses_tools()` — 将工具 schema 转换为 Responses API 格式
- `_chat_messages_to_responses_input()` — 对话历史 → Responses input items
- `_normalize_codex_response()` — Codex response → 统一 assistant message
- `_run_codex_stream()` — Codex/Responses API 流式调用

*凭据管理 (L4777-4924)*:
- `_recover_with_credential_pool()` — 凭据池轮换恢复
- `_swap_credential()` — 切换到下一个可用凭据
- `_try_refresh_*_client_credentials()` — 刷新 OAuth / API key

*Provider Fallback (L5911-6215)*:
- `_try_activate_fallback()` — 激活回退模型
- `_restore_primary_runtime()` — 恢复主 provider
- `_try_recover_primary_transport()` — 尝试恢复主传输通道

*流式增强 (L5168-5262)*:
- `_reset_stream_delivery_tracking()` — 重置流式传输跟踪
- `_emit_interim_assistant_message()` — 发射中间 assistant 消息
- `_fire_stream_delta()` — 触发流式内容 delta 事件
- `_fire_reasoning_delta()` — 触发推理内容 delta 事件

**协作模式**:
```
用户输入 → AIAgent.run_conversation()
         ↓
    _build_system_prompt() ← PromptBuilder
         ↓
    _interruptible_streaming_api_call() → OpenAI/Anthropic/Bedrock Client
         ↓
    _execute_tool_calls() → ToolRegistry.dispatch()
         ↓
    _compress_context() → ContextCompressor.compress()
         ↓
    _persist_session() → SessionDB.append_message()
                       → _save_session_log() (JSON)
```

---

## 2. 状态持久化类：`SessionDB`

**位置**: `hermes-agent/hermes_state.py` (L115)

**Schema 版本**: 6

**职责**: SQLite 会话存储,提供:
- 会话元数据管理 (创建/结束/恢复/重新打开)
- 消息历史持久化
- FTS5 全文检索
- Token/Cost 统计 (含缓存与推理 token)
- Session lineage 管理 (压缩后的父子链)
- 会话标题与层级管理

**核心表结构**:
```sql
sessions:
  - id (PRIMARY KEY)
  - source ("cli" | "telegram" | "discord" | ...)
  - model, model_config
  - system_prompt
  - parent_session_id (压缩后的父会话)
  - started_at, ended_at
  - message_count, tool_call_count
  - title (可选,用于会话命名)
  -- Token 统计 (v0.10.0 扩展)
  - input_tokens, output_tokens
  - cache_read_tokens, cache_write_tokens  -- 缓存读写 token
  - reasoning_tokens                       -- 推理消耗 token
  -- 费用追踪 (v0.10.0 新增)
  - billing_provider                       -- 计费 provider
  - estimated_cost_usd                     -- 预估费用
  - actual_cost_usd                        -- 实际费用

messages:
  - id (AUTOINCREMENT)
  - session_id (FOREIGN KEY)
  - role ("user" | "assistant" | "tool")
  - content
  - tool_calls (JSON)
  - reasoning (推理文本)
  - reasoning_details (结构化推理详情)
  - codex_reasoning_items (Codex 推理项)
  - finish_reason (停止原因: stop | tool_calls | length | ...)
  - timestamp

messages_fts (FTS5 虚拟表):
  - 对 messages.content 建立全文索引
```

**关键方法**:
- `create_session()` — 创建新会话记录
- `reopen_session()` — 重新打开已结束的会话
- `ensure_session()` — 确保会话存在,不存在则创建
- `resolve_session_id()` — 模糊匹配会话 ID (前缀匹配)
- `append_message()` — 追加消息到历史
- `update_token_counts()` — 更新 token/cost 统计
- `search_messages()` — FTS5 全文检索
- `get_session_lineage()` — 获取压缩链 (parent → child)
- `list_sessions_rich()` — 富格式会话列表 (含标题、费用、token 统计)
- `set_title()` / `get_title()` — 会话标题管理

**并发安全**:
- WAL 模式 (多读单写)
- `_execute_write()` 使用 `BEGIN IMMEDIATE` + 随机 jitter 重试
- 每 50 次写操作触发一次 PASSIVE checkpoint

**删除行为**:
- 删除会话时,子会话变为孤儿 (orphan) 而非级联删除,保留压缩历史的可追溯性

---

## 3. 工具注册与分发：`ToolRegistry`

**位置**: `hermes-agent/tools/registry.py`

**职责**: 工具自注册中心,提供:
- 工具 schema 注册
- 工具可用性检查 (`check_fn`)
- 工具分发 (`dispatch`)
- Toolset 映射管理
- 动态 schema 重写 (如 `execute_code` 根据运行时环境调整参数)

**3 阶段工具发现** (`model_tools.py`):
```
Phase 1: Builtin — 导入 tools/*.py,触发 registry.register()
Phase 2: MCP — 连接 MCP server,注册远程工具
Phase 3: Plugins — 加载插件定义的工具与 toolset
```

**注册模式**:
```python
# 每个 tools/*.py 在模块顶层调用:
registry.register(
    name="web_search",
    handler=web_search,
    schema={...},
    toolset="web",
    check_fn=lambda: os.getenv("TAVILY_API_KEY") is not None,
    requirements={"env": ["TAVILY_API_KEY"]},
)
```

**分发流程**:
```
model_tools.handle_function_call(name, args, context=...)
    ↓
coerce_tool_args(name, args)          # 类型强制转换 (str→int 等)
    ↓
invoke_hook("pre_tool_call", name, args)  # 插件 pre-hook
    ↓
registry.dispatch(name, args, task_id=...)
    ↓
_run_async(handler(args)) if asyncio.iscoroutinefunction(handler)
    ↓
invoke_hook("post_tool_call", name, args, result)  # 插件 post-hook
    ↓
返回 JSON 字符串结果
```

**Toolset 系统**:
- `toolsets.py` 定义工具集 (web, terminal, file, browser, ...)
- `get_tool_definitions(enabled_toolsets)` 按 toolset 过滤工具
- 支持 `--toolsets web,file` 或 `--disable-toolsets browser`
- v0.10.0: 插件可定义自己的 toolset,与内建 toolset 统一管理

---

## 4. 上下文压缩：`ContextCompressor`

**位置**: `hermes-agent/agent/context_compressor.py` (压缩逻辑入口 `_compress_context` 位于 `run_agent.py` L7136)

**职责**: 当对话历史超过 token 阈值时,生成中段摘要并保留前后关键消息

**压缩策略**:
1. **保留前 N 条消息** (system prompt + 初始上下文)
2. **压缩中段** → 生成结构化摘要:
   ```
   Goal: ...
   Progress: ...
   Key Decisions: ...
   Relevant Files: ...
   Next Steps: ...
   Critical Context: ...
   ```
3. **保留最近 M 条消息** (当前工作上下文)
4. **v0.10.0 修复**: 始终保留尾部最后一条 user 消息,防止活跃任务上下文丢失

**触发时机**:
- `run_conversation()` 开始前 (preflight compression)
- 工具调用后,历史超过阈值时

**副作用**:
- 调用 `SessionDB.end_session()` 结束旧会话
- 调用 `SessionDB.create_session(parent_session_id=...)` 创建新会话
- 清空文件去重缓存 (`reset_file_dedup()`)
- 使 system prompt 缓存失效

---

## 5. Prompt 组装：`PromptBuilder`

**位置**: `hermes-agent/agent/prompt_builder.py` (`_build_system_prompt` 位于 `run_agent.py` L3335)

**职责**: 按固定层次组装 system prompt

**组装顺序**:
```
1. SOUL.md (agent identity)
2. Memory/User Profile (MEMORY.md, USER.md)
3. External Memory Block (memory_manager.build_system_prompt())
4. Skills Guidance (skills_list, skill_view, skill_manage 可用时)
5. Context Files (AGENTS.md / .hermes.md / CLAUDE.md / .cursorrules)
6. Timestamp (会话起始时间)
7. Platform Hints (WSL / Termux / 平台特定提示)
```

**关键函数**:
- `load_soul_md()` — 读取 `HERMES_HOME/SOUL.md`
- `build_skills_system_prompt()` — 格式化技能索引
- `build_context_files_prompt()` — 加载项目级上下文
- `build_environment_hints()` — 追加平台提示

---

## 6. 记忆管理：`MemoryManager` + `MemoryProvider`

**位置**: 
- `hermes-agent/agent/memory_manager.py` (管理器)
- `hermes-agent/agent/memory_provider.py` (插件接口)

**职责**: 
- **MemoryManager**: 协调内建记忆 (`MemoryStore`) 与外部记忆插件
- **MemoryProvider**: 插件接口,定义生命周期钩子

**生命周期钩子**:
```python
class MemoryProvider:
    def prefetch_all(query, context) -> str
        # 每轮 LLM 调用前,预取相关记忆
    
    def sync_turn(user_msg, assistant_msg, context)
        # 每轮对话后,同步到长期记忆
    
    def on_session_end(session_id, messages, context)
        # 会话结束时,抽取 profile/preferences/entities/events
    
    def on_memory_write(memory_type, content, context)
        # 内建 memory 工具写入后,桥接到外部系统
    
    def on_delegation(task, result, context)
        # 子任务完成后,供外部记忆系统吸收
```

**内建记忆** (`MemoryStore`):
- `MEMORY.md` — 稳定事实 (项目约定、环境约束)
- `USER.md` — 用户偏好 (代码风格、工作流)
- `load_from_disk()` → `format_for_system_prompt()` 注入 system prompt

**外部记忆插件示例**:
- `OpenVikingMemoryProvider` — 图状长期记忆
- `SupermemoryProvider` — 向量检索记忆
- `HolographicMemoryStore` — 反馈打分记忆

---

## 7. 多 Provider 适配：`AnthropicAdapter` / `BedrockAdapter` / Responses API

**位置**:
- `hermes-agent/agent/anthropic_adapter.py`
- `hermes-agent/agent/bedrock_adapter.py`
- Responses API 逻辑内联于 `run_agent.py` (L3673-4699)

**职责**: 协议转换,统一不同 provider 的 API 差异

**api_mode 路由** (v0.10.0):
```
provider        → api_mode
─────────────────────────────────
openai/openrouter → chat_completions
xai             → codex_responses
anthropic       → anthropic_messages
bedrock         → bedrock_converse
ollama          → chat_completions
```

**Anthropic 适配**:
```python
# OpenAI format → Anthropic Messages API
build_anthropic_kwargs(messages, tools, model, ...)
    ↓
{
    "model": "claude-opus-4-20250514",
    "messages": [...],  # system 提取到顶层
    "tools": [...],     # 转换为 Anthropic tool schema
    "max_tokens": 8192,
}

# Anthropic response → 统一 assistant message
normalize_anthropic_response(response)
    ↓
{
    "role": "assistant",
    "content": "...",
    "tool_calls": [...],  # 从 content blocks 提取
    "reasoning": "...",   # 从 thinking block 提取
}
```

**Bedrock 适配**:
```python
# OpenAI format → Bedrock Converse API
build_bedrock_kwargs(messages, tools, model, ...)
    ↓
{
    "modelId": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "messages": [...],
    "toolConfig": {...},
    "inferenceConfig": {...},
}
```

**Responses API 适配** (v0.10.0 新增):
```python
# OpenAI format → Responses API (xAI / Codex)
_chat_messages_to_responses_input(messages)
    ↓
_responses_tools(tool_definitions)
    ↓
_run_codex_stream(input_items, tools, ...)
    ↓
_normalize_codex_response(response) → 统一 assistant message
```

**v0.10.0 新增 Provider**:
- **xAI**: 通过 `codex_responses` api_mode 路由
- **Ollama Cloud**: 作为内建 provider,使用 `chat_completions` api_mode

---

## 8. 迭代预算控制：`IterationBudget`

**位置**: `hermes-agent/run_agent.py`

**职责**: 防止工具调用死循环

**设计**:
- 每个 `AIAgent` 实例持有一个 `IterationBudget`
- 父 agent 与子 agent (delegation) **共享同一个预算对象**
- 每次 LLM 调用前 `consume()`,失败则抛出 `MaxIterationsExceeded`
- `execute_code` 工具调用后 `refund()` (不消耗预算)

**配置**:
- 默认 `max_iterations=90`
- 子 agent 继承父 agent 的 `iteration_budget` 引用

---

## 9. 辅助类

### 9.1 `CheckpointManager`
**位置**: `hermes-agent/tools/checkpoint_manager.py`

**职责**: 文件修改前自动快照,支持回滚

**流程**:
```
write_file(path, content)
    ↓
CheckpointManager.create_checkpoint(path)  # 保存原文件到 ~/.hermes/checkpoints/
    ↓
执行写入
    ↓
用户可调用 checkpoint_restore(path) 回滚
```

### 9.2 `TodoStore`
**位置**: `hermes-agent/tools/todo_tool.py`

**职责**: 内存中的任务跟踪器

**特点**:
- 不持久化 (每次会话重新初始化)
- 从历史消息中恢复 (`_hydrate_todo_store()`)
- 支持 `todo add/list/complete/remove`

### 9.3 `SubdirectoryHintTracker`
**位置**: `hermes-agent/agent/subdirectory_hints.py`

**职责**: 根据工具调用结果附加目录上下文提示

**示例**:
```
read_file("src/utils/helper.py")
    ↓
SubdirectoryHintTracker.check_tool_call(...)
    ↓
附加提示: "You are now working in src/utils/"
```

### 9.4 `ManagedToolGateway` (v0.10.0 新增)
**位置**: `hermes-agent/tools/managed_tool_gateway.py`

**职责**: 托管工具后端网关,将特定工具的 API 调用透明路由到 Nous 托管服务

**核心组件**:
- `ManagedToolGatewayConfig` — 配置 dataclass (gateway URL、auth token、超时)
- Nous auth token 自动管理 (获取/刷新/缓存)
- Gateway URL 构造与解析
- 按工具粒度 opt-in (`use_gateway` 配置项)

**工作模式**:
```
工具调用 → 检查 use_gateway 配置
           ├─ true  → ManagedToolGateway.proxy(name, args) → Nous 托管 API
           └─ false → 本地 handler 执行
```

**优势**: 用户无需管理第三方 API key,由 Nous 统一托管

### 9.5 `BrowserProvider` 层 (v0.10.0 新增)
**位置**: `hermes-agent/tools/browser_providers/`

**职责**: 可插拔浏览器自动化后端,使用策略模式

**类层次**:
```python
browser_providers/
  ├─ base.py            # BrowserProvider (抽象基类)
  ├─ browserbase.py     # Browserbase 云端浏览器
  ├─ browser_use.py     # BrowserUse 本地浏览器
  └─ firecrawl.py       # Firecrawl 爬虫后端
```

**抽象接口**:
```python
class BrowserProvider(ABC):
    def navigate(url: str) → PageContent
    def screenshot() → bytes
    def execute_js(script: str) → Any
    def close()
```

### 9.6 Dashboard 插件系统 (v0.10.0 新增)
**位置**: `hermes-agent/plugins/`, `hermes-agent/web/src/plugins/`

**职责**: Dashboard UI 扩展框架

**核心组件**:
- **Plugin Manifest** — 声明插件元数据、依赖、入口
- **Plugin Registry** — 插件发现、加载、生命周期管理
- **Plugin SDK** — 标准化的插件开发接口
- 支持自定义 Tab、CSS/JS 注入

### 9.7 Dashboard 主题系统 (v0.10.0 新增)
**位置**: `hermes-agent/web/src/themes/`

**职责**: Dashboard 主题定制与实时切换

**核心组件**:
- **Theme Presets** — 预设主题 (dark, light, ...)
- **ThemeContext** — React Context 提供主题状态
- **Live Switching** — 运行时主题热切换

---

## 10. 类协作时序图

### 10.1 完整对话流程

```
用户输入
  ↓
HermesCLI._init_agent()
  ↓
AIAgent.__init__()
  ├─ SessionDB.create_session()
  ├─ MemoryStore.load_from_disk()
  ├─ ContextCompressor.__init__()
  └─ get_tool_definitions() → ToolRegistry.get_definitions()
  ↓
AIAgent.run_conversation(user_input)
  ├─ _build_system_prompt()
  │   ├─ load_soul_md()
  │   ├─ MemoryStore.format_for_system_prompt()
  │   ├─ MemoryManager.build_system_prompt()
  │   ├─ build_skills_system_prompt()
  │   └─ build_context_files_prompt()
  ├─ SessionDB.update_system_prompt()
  ├─ MemoryManager.prefetch_all()  # 预取相关记忆
  ├─ _interruptible_streaming_api_call()
  │   ├─ AnthropicAdapter.build_anthropic_kwargs() (if Anthropic)
  │   └─ client.messages.create(stream=True)
  ├─ _execute_tool_calls()
  │   ├─ ToolRegistry.dispatch(tool_name, args)
  │   └─ SubdirectoryHintTracker.check_tool_call()
  ├─ _compress_context() (if needed)
  │   ├─ ContextCompressor.compress()
  │   ├─ SessionDB.end_session()
  │   └─ SessionDB.create_session(parent_session_id=...)
  ├─ _persist_session()
  │   ├─ _save_session_log() (JSON)
  │   └─ SessionDB.append_message()
  ├─ MemoryManager.sync_all()  # 同步本轮对话到长期记忆
  └─ _spawn_background_review() (if enabled)
      └─ fork 静默 agent 复盘并写回 memory/skills
```

### 10.2 工具调用流程

```
LLM 返回 tool_calls
  ↓
AIAgent._execute_tool_calls(tool_calls)
  ├─ _should_parallelize_tool_batch() → 判断是否可并行
  ├─ _execute_tool_calls_concurrent() (if parallel)
  │   └─ ThreadPoolExecutor.map(...)
  └─ _execute_tool_calls_sequential() (if serial)
  ↓
AIAgent._invoke_tool(tool_call)
  ├─ 内建工具分支 (todo, memory, session_search, delegate_task)
  └─ model_tools.handle_function_call()
      ↓
  ToolRegistry.dispatch(name, args)
      ├─ coerce_tool_args() (类型转换)
      ├─ invoke_hook("pre_tool_call")
      ├─ handler(args) (同步或异步)
      └─ invoke_hook("post_tool_call")
  ↓
返回 tool result (JSON 字符串)
  ↓
maybe_persist_tool_result() (大结果替换为引用)
  ↓
SubdirectoryHintTracker.check_tool_call() (附加目录提示)
  ↓
追加 tool message 到 messages
  ↓
继续下一轮 LLM 调用
```

### 10.3 上下文压缩流程

```
_compress_context() 触发
  ↓
ContextCompressor.compress(messages)
  ├─ 保留前 N 条消息
  ├─ 压缩中段 → 生成摘要 (调用 LLM)
  └─ 保留最近 M 条消息
  ↓
SessionDB.end_session(old_session_id, "compressed")
  ↓
SessionDB.create_session(new_session_id, parent_session_id=old_session_id)
  ↓
reset_file_dedup() (清空文件去重缓存)
  ↓
_invalidate_system_prompt() (使缓存失效)
  ↓
返回压缩后的 messages
```

---

## 11. 设计模式总结

### 11.1 自注册模式 (Tool Registry)
- 每个工具模块在导入时自动调用 `registry.register()`
- 避免中心化的工具列表维护
- 新增工具只需创建 `tools/new_tool.py` 并注册

### 11.2 策略模式 (Provider Adapters)
- `AIAgent` 根据 `api_mode` 选择不同的适配器
- `AnthropicAdapter`, `BedrockAdapter` 封装协议差异
- 统一的 `normalize_*_response()` 接口

### 11.3 观察者模式 (Plugin Hooks)
- `invoke_hook("pre_tool_call", ...)` 通知所有插件
- 插件可返回 block message 阻止工具执行
- 支持 `pre_llm_call`, `post_llm_call`, `on_session_end` 等事件

### 11.4 模板方法模式 (MemoryProvider)
- `MemoryProvider` 定义生命周期钩子
- 子类实现具体的记忆存储逻辑
- `MemoryManager` 统一调度所有 provider

### 11.5 单例模式 (ToolRegistry)
- `registry` 是模块级单例
- 所有工具注册到同一个 registry 实例

### 11.6 策略模式 (Browser Providers, v0.10.0)
- `browser_providers/base.py` 定义抽象基类 `BrowserProvider`
- 具体实现: `Browserbase`, `BrowserUse`, `Firecrawl`
- 运行时根据配置选择具体后端

### 11.7 托管后端模式 (Managed Tool Gateway, v0.10.0)
- `ManagedToolGateway` 透明代理工具调用到 Nous 托管服务
- 工具代码无需修改,配置 `use_gateway=true` 即可切换
- 本地执行 ↔ 托管执行 对调用者透明

### 11.8 注册 + Hook 模式 (Dashboard Plugin, v0.10.0)
- Plugin Registry 负责发现与加载
- Hook 机制注入自定义 Tab、CSS/JS
- 生命周期: discover → validate → load → activate

---

## 12. 关键设计决策

### 12.1 为什么 `SessionDB` 使用 WAL 模式?
- **多读单写**: Gateway 多平台并发读取历史
- **写冲突**: 多个 hermes 进程 (CLI + gateway + worktree agents) 共享 `state.db`
- **解决方案**: WAL + `BEGIN IMMEDIATE` + 随机 jitter 重试

### 12.2 为什么 `IterationBudget` 在父子 agent 间共享?
- **防止预算绕过**: 子 agent 不应该有独立的 90 次预算
- **总预算控制**: 父 + 所有子 agent 共享同一个 90 次上限
- **配置**: `delegation.max_iterations` 控制单个子 agent 上限

### 12.3 为什么 `MemoryStore` 维护两套状态?
- **`_system_prompt_snapshot`**: 冻结在 `load_from_disk()` 时,保持 prefix cache 稳定
- **`_live_memory`**: 运行中可变,立刻写盘
- **生效时机**: 通常要到后续 session 或 system prompt 重建后才稳定影响模型

### 12.4 为什么工具调用有并行/串行两种模式?
- **并行**: 读文件、搜索等无副作用工具可并行
- **串行**: `clarify` (交互)、`terminal` (状态依赖) 必须串行
- **路径冲突检测**: `write_file` 同一路径不能并行

### 12.5 为什么压缩后要切换 session lineage?
- **历史追溯**: 压缩后的摘要不应该覆盖原始历史
- **父子链**: `parent_session_id` 形成压缩链,可回溯完整历史
- **Title 继承**: 压缩后自动生成 "title #2", "title #3"

### 12.6 为什么 Tool Gateway 优先采用托管后端而非直接 API key? (v0.10.0)
- **降低用户门槛**: 用户无需逐一申请第三方 API key
- **统一计费**: Nous 平台统一管理费用,简化成本追踪
- **安全隔离**: API key 不暴露给客户端,由网关代理
- **透明切换**: 工具代码不感知后端变化,配置即切换

### 12.7 为什么推理字段要持久化到 SessionDB? (v0.10.0)
- **可审计**: reasoning/reasoning_details 记录模型思考过程
- **调试支持**: 可回溯 LLM 决策链路,定位工具调用异常
- **成本分析**: reasoning_tokens 独立计量,支持精细费用分析
- **Codex 兼容**: codex_reasoning_items 保留 Codex 特有的推理结构

### 12.8 为什么采用 3 阶段工具发现? (v0.10.0)
- **确定性**: Builtin 工具优先注册,保证核心能力稳定
- **扩展性**: MCP 和 Plugin 阶段按需加载,不影响启动速度
- **冲突解决**: 后注册的同名工具不覆盖先注册的,Builtin 优先
- **Schema 重写**: 动态阶段可根据运行时环境调整工具参数 (如 execute_code)

---

## 13. 扩展点

### 13.1 新增工具
```python
# tools/my_tool.py
from tools.registry import registry

def my_tool(arg1: str, arg2: int) -> str:
    return json.dumps({"result": ...})

registry.register(
    name="my_tool",
    handler=my_tool,
    schema={
        "name": "my_tool",
        "description": "...",
        "parameters": {...},
    },
    toolset="custom",
    check_fn=lambda: True,
)
```

### 13.2 新增 Memory Provider
```python
# plugins/memory/my_provider/__init__.py
from agent.memory_provider import MemoryProvider

class MyMemoryProvider(MemoryProvider):
    def prefetch_all(self, query, context):
        # 检索相关记忆
        return "Relevant facts: ..."
    
    def sync_turn(self, user_msg, assistant_msg, context):
        # 同步本轮对话
        pass
    
    def on_session_end(self, session_id, messages, context):
        # 会话结束时抽取
        pass
```

### 13.3 新增 Plugin Hook
```python
# plugins/my_plugin/__init__.py
def on_pre_tool_call(tool_name, args, **kwargs):
    if tool_name == "terminal" and "rm -rf" in args.get("command", ""):
        return "Blocked: destructive command"
    return None  # 允许执行
```

### 13.4 通过 Tool Gateway 新增托管工具 (v0.10.0)
```yaml
# config.yaml
tool_gateway:
  enabled: true
  tools:
    my_saas_tool:
      use_gateway: true    # 路由到 Nous 托管后端
      # 无需配置 API key,网关自动管理
```
工具代码照常编写并注册到 `ToolRegistry`,配置 `use_gateway: true` 后调用自动通过网关代理。

### 13.5 新增 Dashboard 插件 (v0.10.0)
```json
// plugins/my_plugin/manifest.json
{
  "name": "my_plugin",
  "version": "0.1.0",
  "tabs": [{"id": "my_tab", "label": "My Tab", "component": "./MyTab.tsx"}],
  "css": ["./style.css"],
  "hooks": ["on_session_change"]
}
```

### 13.6 新增 Browser Provider (v0.10.0)
```python
# tools/browser_providers/my_browser.py
from tools.browser_providers.base import BrowserProvider

class MyBrowserProvider(BrowserProvider):
    def navigate(self, url: str):
        # 实现导航逻辑
        ...
    
    def screenshot(self):
        # 实现截图逻辑
        ...
    
    def close(self):
        ...
```
在配置中指定 `browser_provider: my_browser` 即可切换。

---

## 14. 常见问题

### Q1: 为什么 `memory` 工具写入后没有立刻生效?
**A**: `MemoryStore._system_prompt_snapshot` 在 `_build_system_prompt()` 时冻结,中途不变。要生效需要:
1. 重启 agent (新 session)
2. 触发上下文压缩 (重建 system prompt)
3. Gateway 场景下,下次消息会重新加载

### Q2: 如何调试工具调用失败?
**A**: 
1. 检查 `~/.hermes/logs/hermes.log`
2. 启用 `--verbose` 查看完整 tool args
3. 检查 `ToolRegistry.check_fn` 是否通过
4. 查看 `SessionDB.messages` 表的 `content` 字段 (tool result)

### Q3: 如何限制子 agent 的工具权限?
**A**: 
1. `delegate_task` 自动禁用 `memory` 工具
2. 传递 `enabled_toolsets` 参数限制工具集
3. 使用 plugin hook 拦截特定工具调用

### Q4: 如何实现跨会话记忆?
**A**:
1. **内建记忆**: `memory` 工具写入 `MEMORY.md` → 下次 session 自动加载
2. **Session Search**: `session_search` 工具检索历史会话
3. **外部记忆**: 实现 `MemoryProvider` 插件,在 `prefetch_all()` 中检索

---

## 15. 与第四篇的对应关系

| 第四篇链路节点 | 对应类/方法 |
|---|---|
| `hermes_cli/main.py::cmd_chat` | `HermesCLI.__init__()` |
| `cli.py::HermesCLI::_init_agent` | `AIAgent.__init__()` |
| `hermes_state.py::SessionDB::create_session` | `SessionDB.create_session()` |
| `run_agent.py::AIAgent::_build_system_prompt` | `PromptBuilder.load_soul_md()` + `MemoryStore.format_for_system_prompt()` |
| `run_agent.py::AIAgent::run_conversation` | `AIAgent.run_conversation()` |
| `run_agent.py::AIAgent::_execute_tool_calls` | `ToolRegistry.dispatch()` |
| `agent/context_compressor.py::ContextCompressor::compress` | `ContextCompressor.compress()` |
| `agent/memory_manager.py::_MemoryManager::prefetch_all` | `MemoryProvider.prefetch_all()` |
| `agent/memory_manager.py::_MemoryManager::sync_all` | `MemoryProvider.sync_turn()` |

---

## 16. 总结

Hermes 的类设计体现了**职责分离**与**可扩展性**的平衡:

1. **`AIAgent`** 专注编排,不关心具体工具实现
2. **`ToolRegistry`** 自注册机制,新增工具无需修改核心代码
3. **`SessionDB`** WAL 模式,支持多进程并发
4. **`MemoryManager`** 插件化,支持多种记忆后端
5. **`ContextCompressor`** 独立压缩逻辑,不侵入主循环
6. **Adapter 模式** 统一多 provider 差异

这种设计让 Hermes 既能快速迭代新功能 (新增工具、新 provider),又能保持核心循环的稳定性。

---

**下一篇预告**: 《Hermes 架构解析 (六)：性能篇 · Token 优化与并发控制》

- Prompt Caching 策略
- 并行工具调用优化
- SQLite 写冲突缓解
- 流式响应与中断处理
