# Hermes 架构解析 (四)：调试篇 · 完整链路走查 (v2026.4.16)

示例命令：

```sh
python hermes_cli/main.py chat --quiet -q "Summarize the repository structure in 5 bullets"
```

## 说明

> 这个命令**不会进入** `cli.py::HermesCLI::chat`，而是直接走 `cli.py::<module>::main` 的 quiet one-shot 分支，再直接调用 `run_agent.py::AIAgent::run_conversation`

- 格式统一为：`文件名::类名::方法名 方法的作用 ...`
- 无类方法统一写成 `::<module>::`
- 只给和 `状态 / 上下文 / 会话 / 记忆` 直接相关的方法打标签
- `【自改进】` 标签：表示这个节点会把经验回写、复用，或触发后台沉淀；**不等于训练模型权重**
- 本文以这个**具体命令**的真实路径为主，条件分支会单独标注 `条件：...`

## 1. 启动链

1. `hermes_cli/main.py::<module>::_apply_profile_override` 预解析 `--profile/-p` 并在其他模块导入前设置 `HERMES_HOME` 【**状态**】
2. `hermes_constants.py::<module>::get_default_hermes_root` 解析 Hermes 默认根目录；仅当命令行未显式传 profile 时读取 `active_profile` 使用
3. `hermes_cli/profiles.py::<module>::resolve_profile_env` 把 profile 名解析为具体的 `HERMES_HOME` 路径 【**状态**】
4. `hermes_cli/env_loader.py::<module>::load_hermes_dotenv` 先加载 `~/.hermes/.env`，再加载项目 `.env`，刷新运行时环境变量 【**状态**】
5. `hermes_logging.py::<module>::setup_logging` 初始化 CLI 文件日志输出
6. `hermes_cli/config.py::<module>::load_config` 预加载配置；仅用于早期网络参数判断 【**状态**】
7. `hermes_constants.py::<module>::apply_ipv4_preference` 在配置要求时提前启用 IPv4 优先
8. `hermes_cli/main.py::<module>::main` 构建 argparse、解析命令、分发子命令

## 2. CLI 分发链

1. `hermes_cli/main.py::<module>::main` 创建顶层 parser 与 `chat` 子命令 parser
2. `hermes_cli/config.py::<module>::get_container_exec_info` 判断当前是否需要路由进容器环境执行
3. `hermes_cli/main.py::<module>::_coalesce_session_name_args` 合并 `--resume/--continue` 后未加引号的多词会话名 【**会话**】
4. `hermes_cli/main.py::<module>::cmd_chat` 处理 `chat` 子命令参数并转交给 `cli.py`
5. `hermes_cli/main.py::<module>::_has_any_provider_configured` 检查当前是否至少存在一个可用推理 provider 【**状态**】
6. `hermes_cli/config.py::<module>::load_config` 读取模型/provider 配置 【**状态**】
7. `hermes_cli/config.py::<module>::get_env_path` 定位 `.env` 路径
8. `hermes_cli/auth.py::<module>::get_auth_status` 检查 provider 登录/认证状态 【**状态**】
9. `hermes_cli/config.py::<module>::get_hermes_home` 获取 Hermes 数据目录 【**状态**】
10. `hermes_cli/banner.py::<module>::prefetch_update_check` 后台预取升级信息
11. `tools/skills_sync.py::<module>::sync_skills` 同步内置 skills 索引
12. `cli.py::<module>::main` 进入 CLI 真实执行入口

## 3. `cli.py` 的 quiet one-shot 路径

1. `cli.py::<module>::main` 处理 `query = query or q`
2. `hermes_cli/tools_config.py::<module>::_get_platform_tools` 在未显式传 `--toolsets` 时解析 `cli` 平台默认 toolsets
3. `cli.py::<module>::_parse_skills_argument` 解析 `--skills` 参数；本命令未传 skills，通常返回空
4. `cli.py::HermesCLI::__init__` 创建 CLI 实例并初始化会话号、配置、控制台、SQLite session store 【**状态**】【**会话**】
5. `hermes_state.py::SessionDB::__init__` 打开 `state.db` 并准备会话库 【**状态**】【**会话**】
6. `hermes_state.py::SessionDB::_init_schema` 初始化/迁移 SQLite schema 【**状态**】【**会话**】
7. `cli.py::<module>::_collect_query_images` 收集 `--image` 和 query 中的本地图像；本命令未传 image，返回空
8. `cli.py::HermesCLI::_ensure_runtime_credentials` 解析当前 provider/base_url/api_key/model 组合 【**状态**】
9. `hermes_cli/runtime_provider.py::<module>::resolve_runtime_provider` 统一解析运行时 provider 凭据和访问模式 【**状态**】
10. `hermes_cli/runtime_provider.py::<module>::resolve_requested_provider` 决定此次请求实际要走哪个 provider 【**状态**】
11. `hermes_cli/runtime_provider.py::<module>::_get_model_config` 读取 `model` 配置并补齐默认/本地模型信息 【**状态**】
12. `hermes_cli/auth.py::<module>::resolve_provider` 把 `auto/custom/...` 解析成真实 provider 标识 【**状态**】
13. `hermes_cli/runtime_provider.py::<module>::_resolve_explicit_runtime` 处理显式传入的 `api_key/base_url` 覆盖 【**状态**】
14. `agent/credential_pool.py::<module>::load_pool` 条件：provider 启用了 credential pool 时装载凭据池 【**状态**】
15. `cli.py::HermesCLI::_normalize_model_for_provider` 修正 provider 与 model 的匹配关系 【**状态**】
16. `cli.py::HermesCLI::_resolve_turn_agent_config` 解析本轮是否启用 smart routing / service tier 覆盖 【**状态**】
17. `agent/smart_model_routing.py::<module>::resolve_turn_route` 为当前 prompt 选择 primary route 或 cheap route 【**状态**】
18. `agent/smart_model_routing.py::<module>::choose_cheap_model_route` 按 prompt 复杂度判断是否降级到 cheap model；本命令是否命中取决于配置
19. `cli.py::HermesCLI::_init_agent` 初始化 `AIAgent`，并在必要时恢复会话历史 【**状态**】【**会话**】
20. `cli.py::HermesCLI::_ensure_runtime_credentials` `_init_agent` 内再次兜底刷新 provider 解析 【**状态**】
21. `run_agent.py::AIAgent::__init__` 创建 agent、本地状态、客户端、工具集合、压缩器、持久化组件 【**状态**】【**会话**】【**记忆**】
22. `cli.py::<module>::main` quiet 分支直接调用 `cli.agent.run_conversation(...)`

## 4. `AIAgent.__init__` 初始化链

> v0.10.0 变化：`AIAgent.__init__` 从 L1149 移到 **L552**（类定义在 L535）。新增大量参数：`provider`、`api_mode`、`acp_command/args`、`enabled/disabled_toolsets`、多种回调参数（`tool_progress_callback`、`thinking_callback`、`reasoning_callback`、`stream_delta_callback` 等）、`session_db`、`parent_session_id`、`iteration_budget`、`fallback_model`、`credential_pool`、`checkpoints_enabled`、`checkpoint_max_snapshots`、`pass_session_id`、`persist_session`。

1. `run_agent.py::<module>::_install_safe_stdio` 用安全包装器接管 stdout/stderr，防止 broken pipe 异常
2. `hermes_cli/model_normalize.py::<module>::normalize_model_for_provider` 规范化 model 名称和 provider 约束 【**状态**】
3. `run_agent.py::AIAgent::__init__` (L552) 生成或接收 `session_id`；若未传入则生成格式为 `{timestamp}_{uuid[:6]}` 的新 ID 【**会话**】【**状态**】
4. `run_agent.py::AIAgent::__init__` **api_mode 自动检测链** (L686-746)：根据 provider/base_url/model 自动选择 API 模式 【**状态**】
   - `openai-codex` → `codex_responses`
   - `xai` → `codex_responses`
   - 原生 Anthropic endpoint → `anthropic_messages`
   - AWS Bedrock endpoint → `bedrock_converse`
   - 需要 Responses API 的模型 → 自动升级为 `codex_responses`
5. `run_agent.py::AIAgent::_is_direct_openai_url` 判断当前 base_url 是否是原生 OpenAI URL 【**状态**】
6. `run_agent.py::AIAgent::_model_requires_responses_api` 判断当前模型是否必须改走 Responses API 【**状态**】
7. `run_agent.py::AIAgent::_create_openai_client` 条件：`chat_completions/codex_responses` 路径下创建 OpenAI 兼容 client 【**状态**】
8. `agent/anthropic_adapter.py::<module>::build_anthropic_client` 条件：`anthropic_messages` 路径下创建 Anthropic client 【**状态**】
9. `model_tools.py::<module>::get_tool_definitions` 根据启用 toolsets 构造本次 session 可用工具 schema 【**状态**】【**上下文**】
10. `model_tools.py::<module>::_discover_tools` 三阶段工具发现：builtin → MCP → plugins
11. `tools/mcp_tool.py::<module>::discover_mcp_tools` 发现配置中的 MCP 工具
12. `hermes_cli/plugins.py::<module>::discover_plugins` 发现插件工具
13. `tools/registry.py::ToolRegistry::get_definitions` 从 registry 取出通过可用性校验的工具 schema 【**状态**】
14. `model_tools.py::<module>::check_toolset_requirements` 检查 toolset 依赖项是否齐备
15. `tools/checkpoint_manager.py::CheckpointManager::__init__` 初始化文件回滚快照管理器 【**状态**】
16. `tools/todo_tool.py::TodoStore::__init__` 初始化内存中的 todo store 【**状态**】
17. `hermes_state.py::SessionDB::create_session` 创建本次 CLI session 记录（schema v6：新增 title、billing/cost、reasoning tokens 字段）【**会话**】【**状态**】
18. `hermes_state.py::SessionDB::_execute_write` 执行 `create_session` 的 SQLite 写事务（WAL 模式 + jitter retry + 定期 checkpoint）【**会话**】【**状态**】
19. `tools/memory_tool.py::MemoryStore::__init__` 条件：开启 memory 时初始化记忆存储 【**记忆**】【**状态**】
20. `tools/memory_tool.py::MemoryStore::load_from_disk` 条件：从 `MEMORY.md/USER.md` 载入本地记忆，作为后续 session 的可复用经验快照 【**记忆**】【**状态**】【**自改进**】
21. `agent/subdirectory_hints.py::SubdirectoryHintTracker::__init__` 初始化目录上下文提示跟踪器 【**上下文**】【**状态**】
22. `agent/context_compressor.py::ContextCompressor::__init__` 初始化上下文压缩器和阈值 【**上下文**】【**状态**】
23. `plugins/context_engine/__init__.py::<module>::load_context_engine` 条件：开启 context engine 时装载上下文引擎 【**上下文**】【**状态**】
24. `agent/memory_manager.py::_MemoryManager::initialize_all` 条件：初始化外部 memory provider 插件，为后续 recall / sync / feedback 打开通路 【**记忆**】【**状态**】【**自改进**】

## 5. `run_conversation` 固定主干

> v0.10.0 关键方法位置更新：`run_conversation` → L8172，`_build_system_prompt` → L3335，`_build_api_kwargs` → L6432，`_flush_messages_to_session_db` → L2493，`_compress_context` → L7136，`_execute_tool_calls` → L7238，`_invoke_tool` → L7261，`_persist_session` → L2480，`_hydrate_todo_store` → L3289。

1. `run_agent.py::AIAgent::run_conversation` 执行一次完整的用户请求主循环 【**状态**】【**上下文**】【**会话**】【**记忆**】
2. `run_agent.py::<module>::_install_safe_stdio` 再次确保当前线程标准输出安全
3. `hermes_logging.py::<module>::set_session_context` 把当前日志线程绑定到本次 `session_id` 【**会话**】【**状态**】
4. `run_agent.py::AIAgent::_restore_primary_runtime` 如果上一轮发生 fallback，则先恢复主 provider/runtime 【**状态**】
5. `run_agent.py::<module>::_sanitize_surrogates` 清洗用户输入中的非法 surrogate 字符 【**状态**】
6. `run_agent.py::IterationBudget::__init__` 为本轮建立新的迭代预算状态 【**状态**】
7. `run_agent.py::AIAgent::_cleanup_dead_connections` 清理上轮遗留的坏连接；`anthropic_messages` 下通常跳过 【**状态**】
8. `run_agent.py::AIAgent::_replay_compression_warning` 重放此前的上下文压缩告警 【**上下文**】【**状态**】
9. `run_agent.py::AIAgent::_hydrate_todo_store` 条件：从历史消息恢复 todo 状态 【**状态**】【**会话**】
10. `run_agent.py::AIAgent::_build_system_prompt` 第一次请求时组装稳定 system prompt 【**上下文**】【**会话**】【**记忆**】
11. `hermes_cli/plugins.py::<module>::invoke_hook` 事件：`on_session_start`，允许插件扩展会话启动 【**会话**】【**状态**】
12. `hermes_state.py::SessionDB::update_system_prompt` 把组装后的 system prompt 快照写入 session 行 【**会话**】【**上下文**】【**状态**】
13. `hermes_state.py::SessionDB::_execute_write` 执行 `update_system_prompt` 的 SQLite 写事务 【**会话**】【**状态**】
14. `agent/model_metadata.py::<module>::estimate_request_tokens_rough` 预估当前消息+工具 schema 的总 token 数 【**上下文**】【**状态**】
15. `run_agent.py::AIAgent::_compress_context` 条件：历史已超过压缩阈值时先做 preflight compression 【**上下文**】【**会话**】【**记忆**】【**状态**】
16. `hermes_cli/plugins.py::<module>::invoke_hook` 事件：`pre_llm_call`，允许插件把额外上下文注入到本轮 user message 【**上下文**】【**会话**】
17. `agent/memory_manager.py::_MemoryManager::prefetch_all` 条件：外部记忆插件预取与本轮 query 相关的记忆片段，把过去沉淀重新带回当前推理链 【**记忆**】【**上下文**】【**自改进**】
18. `run_agent.py::AIAgent::clear_interrupt` 清理本轮开始前的中断状态 【**状态**】

## 6. 主循环中每轮 API 调用前的固定链

1. `tools/checkpoint_manager.py::CheckpointManager::new_turn` 重置本轮 checkpoint 去重状态 【**状态**】
2. `run_agent.py::AIAgent::_touch_activity` 更新 agent 当前活动状态和时间戳 【**状态**】
3. `run_agent.py::IterationBudget::consume` 消耗一次 LLM 调用预算 【**状态**】
4. `run_agent.py::AIAgent::_sanitize_api_messages` 清理 orphan tool result、非法 role、坏 tool_call 配对 【**上下文**】【**状态**】
5. `agent/memory_manager.py::<module>::build_memory_context_block` 把外部记忆预取结果包成注入到 user message 的上下文块 【**记忆**】【**上下文**】
6. `agent/prompt_caching.py::<module>::apply_anthropic_cache_control` 条件：Claude/OpenRouter/Anthropic 路径下设置 prompt cache breakpoint 【**上下文**】【**状态**】
7. `agent/model_metadata.py::<module>::estimate_messages_tokens_rough` 估算送入 API 的消息体 token 数 【**上下文**】【**状态**】
8. `run_agent.py::AIAgent::_build_api_kwargs` 把内部消息结构转换成 provider 专属请求体 【**上下文**】【**状态**】
9. `hermes_cli/plugins.py::<module>::invoke_hook` 事件：`pre_api_request`，允许插件观察请求发送前状态 【**状态**】【**会话**】
10. `run_agent.py::AIAgent::_interruptible_streaming_api_call` 默认走流式调用路径，并包裹超时/中断/重试逻辑 【**状态**】
11. `run_agent.py::AIAgent::_interruptible_api_call` 条件：流式不可用或被禁用时走非流式调用 【**状态**】

## 7. `_build_system_prompt` 下钻

1. `run_agent.py::AIAgent::_build_system_prompt` 按固定层次拼接 identity、memory、skills、project context、timestamp、platform hints 【**上下文**】【**会话**】【**记忆**】
2. `agent/prompt_builder.py::<module>::load_soul_md` 读取 `HERMES_HOME/SOUL.md` 作为 agent identity 【**上下文**】
3. `agent/prompt_builder.py::<module>::build_nous_subscription_prompt` 条件：按可用工具生成 Nous 订阅提示
4. `tools/memory_tool.py::MemoryStore::format_for_system_prompt` 条件：把本地 memory/user profile 格式化进 system prompt，让历史经验在新 session 启动时直接生效 【**记忆**】【**上下文**】【**自改进**】
5. `agent/memory_manager.py::_MemoryManager::build_system_prompt` 条件：把外部 memory provider 的 system prompt 块加入 prompt 【**记忆**】【**上下文**】【**自改进**】
6. `agent/prompt_builder.py::<module>::build_skills_system_prompt` 条件：当 `skills_list/skill_view/skill_manage` 可用时构造 skills 提示，把已沉淀的方法论重新注入 system prompt 【**上下文**】【**自改进**】
7. `agent/prompt_builder.py::<module>::build_context_files_prompt` 装载项目级上下文文件 【**上下文**】
8. `agent/prompt_builder.py::<module>::_load_hermes_md` 条件：优先查找 `.hermes.md/HERMES.md` 【**上下文**】
9. `agent/prompt_builder.py::<module>::_load_agents_md` 条件：若无 `.hermes.md`，读取仓库根 `AGENTS.md` 【**上下文**】
10. `agent/prompt_builder.py::<module>::_load_claude_md` 条件：若无前两者，读取 `CLAUDE.md` 【**上下文**】
11. `agent/prompt_builder.py::<module>::_load_cursorrules` 条件：若无前三者，读取 `.cursorrules` / `.cursor/rules/*.mdc` 【**上下文**】
12. `hermes_time.py::<module>::now` 生成固定会话起始时间戳 【**会话**】【**状态**】
13. `agent/prompt_builder.py::<module>::build_environment_hints` 追加 WSL/Termux/平台运行环境提示 【**上下文**】

## 8. 真实请求发送分支

1. `run_agent.py::AIAgent::_build_api_kwargs` 根据 `api_mode` 组装 `chat_completions / codex_responses / anthropic_messages` 三类请求体 【**上下文**】【**状态**】
2. `run_agent.py::AIAgent::_prepare_anthropic_messages_for_api` 条件：Anthropic path 下重写消息结构 【**上下文**】
3. `agent/anthropic_adapter.py::<module>::build_anthropic_kwargs` 条件：生成 Anthropic Messages API 参数
4. `run_agent.py::AIAgent::_chat_messages_to_responses_input` 条件：Codex/Responses path 下把 chat messages 转为 Responses input items 【**上下文**】
5. `run_agent.py::AIAgent::_preflight_codex_api_kwargs` 条件：Codex path 下做 Responses request 预校验 【**状态**】
6. `run_agent.py::AIAgent::_interruptible_streaming_api_call` 实际发起流式请求并负责重试、超时、中断、流式 delta 聚合 【**状态**】
7. `run_agent.py::AIAgent::_interruptible_streaming_api_call._call_chat_completions(内嵌)` 条件：`chat_completions` 路径下调用 `request_client.chat.completions.create(..., stream=True)`
8. `run_agent.py::AIAgent::_interruptible_streaming_api_call._call_anthropic(内嵌)` 条件：`anthropic_messages` 路径下调用 Anthropic stream
9. `run_agent.py::AIAgent::_call_anthropic` 处理 Anthropic 流式事件并回填最终消息对象 【**状态**】
10. `run_agent.py::AIAgent::_fire_first_delta` 首个 token 到达时通知上层显示逻辑 【**状态**】
11. `run_agent.py::AIAgent::_fire_stream_delta` 持续推送可见文本增量 【**状态**】
12. `run_agent.py::AIAgent::_fire_reasoning_delta` 持续推送 reasoning 增量 【**状态**】【**上下文**】
13. `run_agent.py::AIAgent::_fire_tool_gen_started` 流式工具生成开始时通知上层

## 9. API 返回后的固定处理链

1. `run_agent.py::AIAgent::_normalize_codex_response` 条件：Codex path 下把 Responses 返回归一化成 assistant message 【**上下文**】
2. `agent/anthropic_adapter.py::<module>::normalize_anthropic_response` 条件：Anthropic path 下把 content blocks 归一化成 assistant message 【**上下文**】
3. `hermes_cli/plugins.py::<module>::invoke_hook` 事件：`post_api_request`，允许插件观察本次返回结果 【**状态**】【**会话**】
4. `agent/usage_pricing.py::<module>::normalize_usage` 统一不同 provider 的 usage 结构 【**状态**】
5. `agent/context_compressor.py::ContextCompressor::update_from_response` 用真实 usage 更新 prompt/completion token 统计 【**上下文**】【**状态**】
6. `agent/usage_pricing.py::<module>::estimate_usage_cost` 根据 model/provider 估算本次调用费用 【**状态**】
7. `hermes_state.py::SessionDB::update_token_counts` 把 token/cost 增量写回 session 行 【**会话**】【**状态**】
8. `hermes_state.py::SessionDB::_execute_write` 执行 `update_token_counts` 的 SQLite 写事务 【**会话**】【**状态**】

## 10. 无工具调用时的收尾链

1. `run_agent.py::AIAgent::_strip_think_blocks` 移除 `<think>/<REASONING_SCRATCHPAD>` 后得到最终可见回复 【**上下文**】
2. `run_agent.py::AIAgent::_build_assistant_message` 构建最终 assistant message，保留 reasoning/tool_calls/finish_reason 【**上下文**】【**会话**】【**状态**】
3. `run_agent.py::AIAgent::_save_trajectory` 条件：若启用 trajectory 保存，则写入轨迹文件 【**会话**】【**状态**】
4. `run_agent.py::AIAgent::_cleanup_task_resources` 清理本轮 task 的 VM/browser/tool 资源 【**状态**】
5. `run_agent.py::AIAgent::_persist_session` 统一把本轮消息持久化到 JSON log + SQLite 【**会话**】【**状态**】
6. `run_agent.py::AIAgent::_apply_persist_user_message_override` 条件：把 API-only user message 替换回持久化用原始消息 【**会话**】【**状态**】
7. `run_agent.py::AIAgent::_save_session_log` 把消息列表写入 `~/.hermes/sessions/session_<id>.json` 【**会话**】【**状态**】
8. `run_agent.py::AIAgent::_flush_messages_to_session_db` 把尚未 flush 的消息逐条落到 SQLite 【**会话**】【**状态**】
9. `hermes_state.py::SessionDB::ensure_session` 保证 session 行存在，避免 `create_session` 失败后丢消息 【**会话**】【**状态**】
10. `hermes_state.py::SessionDB::_execute_write` 执行 `ensure_session` 的 SQLite 写事务 【**会话**】【**状态**】
11. `hermes_state.py::SessionDB::append_message` 逐条追加消息到 `messages` 表，并维护 `message_count/tool_call_count` 【**会话**】【**状态**】
12. `hermes_state.py::SessionDB::_execute_write` 执行 `append_message` 的 SQLite 写事务 【**会话**】【**状态**】
13. `hermes_cli/plugins.py::<module>::invoke_hook` 事件：`post_llm_call`，允许插件在本轮完成后处理对话结果 【**会话**】
14. `run_agent.py::AIAgent::clear_interrupt` 清理本轮中断状态 【**状态**】
15. `agent/memory_manager.py::_MemoryManager::sync_all` 条件：把这轮 user/assistant 对话同步给外部 memory provider，供其做长期存储、抽取或索引 【**记忆**】【**会话**】【**自改进**】
16. `agent/memory_manager.py::_MemoryManager::queue_prefetch_all` 条件：为下一轮 query 异步预取记忆，形成“本轮写入，下轮可取回”的闭环 【**记忆**】【**状态**】【**自改进**】
17. `run_agent.py::AIAgent::_spawn_background_review` 条件：触发 memory/skills 的后台 review；fork 一个静默 agent 复盘本轮，并把值得保留的内容写入共享记忆或技能库 【**记忆**】【**状态**】【**自改进**】
18. `hermes_cli/plugins.py::<module>::invoke_hook` 事件：`on_session_end`，允许插件在本轮结束时清理会话态 【**会话**】【**状态**】
19. `cli.py::<module>::main` quiet one-shot 分支打印 `response`
20. `cli.py::<module>::main` quiet one-shot 分支打印 `session_id`

## 11. 有工具调用时的分支链

1. `run_agent.py::AIAgent::_repair_tool_call` 条件：模型生成了错误工具名时尝试自动修复 【**状态**】
2. `run_agent.py::AIAgent::_cap_delegate_task_calls` 限制单轮 `delegate_task` 数量，避免并发失控 【**状态**】
3. `run_agent.py::AIAgent::_deduplicate_tool_calls` 去重本轮 tool calls，避免模型重复执行同一调用 【**状态**】
4. `run_agent.py::AIAgent::_build_assistant_message` 把带 tool_calls 的 assistant turn 规范化入消息流 【**上下文**】【**会话**】【**状态**】
5. `run_agent.py::AIAgent::_emit_interim_assistant_message` 把中间 assistant turn 通知给上层 UI / callback
6. `run_agent.py::AIAgent::_execute_tool_calls` 按批次执行当前 assistant 提交的工具调用 【**状态**】
7. `run_agent.py::<module>::_should_parallelize_tool_batch` 判断当前工具批是否允许并行
8. `run_agent.py::AIAgent::_execute_tool_calls_sequential` 逐个串行执行工具；交互型工具默认走这里
9. `run_agent.py::AIAgent::_execute_tool_calls_concurrent` 并发执行互不冲突的工具批
10. `run_agent.py::AIAgent::_invoke_tool` 对单个工具做 agent 内建分发或 registry 分发
11. `tools/todo_tool.py::<module>::todo_tool` 条件：执行内建 todo 工具 【**状态**】
12. `tools/session_search_tool.py::<module>::session_search` 条件：执行 session_search，从历史会话中召回相关经验而不是让用户重复说明 【**会话**】【**上下文**】【**自改进**】
13. `tools/memory_tool.py::<module>::memory_tool` 条件：执行内建 memory 工具，把稳定事实写入 `MEMORY.md/USER.md` 【**记忆**】【**状态**】【**自改进**】
14. `tools/clarify_tool.py::<module>::clarify_tool` 条件：向用户追问补充信息 【**上下文**】【**状态**】
15. `tools/delegate_tool.py::<module>::delegate_task` 条件：创建子代理任务；子任务完成后父代理可通过 `memory_manager.on_delegation(...)` 观察 task/result，供外部记忆系统吸收 【**状态**】【**自改进**】
16. `agent/memory_manager.py::_MemoryManager::handle_tool_call` 条件：执行外部 memory provider 暴露的工具，例如显式记忆、检索、反馈打分等 【**记忆**】【**状态**】【**自改进**】
17. `model_tools.py::<module>::handle_function_call` 执行普通 registry 工具的统一分发入口（v0.10.0 扩展签名 L421-430：新增 `tool_call_id`、`session_id`、`enabled_tools`、`skip_pre_tool_call_hook`）【**状态**】
18. `model_tools.py::<module>::coerce_tool_args` (L334) 按 schema 把工具参数字符串转换为目标类型 【**状态**】
19. `hermes_cli/plugins.py::<module>::invoke_hook` 事件：`pre_tool_call`，插件可阻止工具执行（L454-472 blocking hook）【**状态**】
20. `tools/registry.py::ToolRegistry::dispatch` 把工具调用路由到具体 `tools/*.py` handler
21. `hermes_cli/plugins.py::<module>::invoke_hook` 事件：`post_tool_call`（L514-525），允许插件观察工具执行结果 【**状态**】【**会话**】
21. `tools/tool_result_storage.py::<module>::maybe_persist_tool_result` 条件：把大型工具结果替换为可复用引用，控制上下文膨胀 【**上下文**】【**状态**】
22. `agent/subdirectory_hints.py::SubdirectoryHintTracker::check_tool_call` 根据工具调用结果附加目录上下文提示 【**上下文**】【**状态**】
23. `tools/tool_result_storage.py::<module>::enforce_turn_budget` 限制单轮工具结果总量，避免消息爆炸 【**上下文**】【**状态**】
24. `run_agent.py::AIAgent::_compress_context` 条件：工具结果把上下文推过阈值时压缩历史 【**上下文**】【**会话**】【**记忆**】【**状态**】
25. `run_agent.py::AIAgent::_save_session_log` 增量写入当前中间状态 【**会话**】【**状态**】
26. `run_agent.py::AIAgent::run_conversation` 回到 `while` 顶部发起下一轮 API 调用 【**状态**】

## 12. 条件分支补充：`SessionDB` / 压缩 / 记忆

1. `run_agent.py::AIAgent::_compress_context` 调用 `ContextCompressor.compress` 生成中段摘要并保留前后关键消息 【**上下文**】【**会话**】【**记忆**】【**状态**】
2. `agent/context_compressor.py::ContextCompressor::compress` 执行真实的上下文压缩算法 【**上下文**】【**状态**】
3. `run_agent.py::AIAgent::_invalidate_system_prompt` 压缩后使缓存的 system prompt 失效，准备重建 【**上下文**】【**状态**】
4. `hermes_state.py::SessionDB::end_session` 条件：压缩时结束旧 session 并切换 lineage 【**会话**】【**状态**】
5. `hermes_state.py::SessionDB::create_session` 条件：压缩后创建新的 session lineage 节点 【**会话**】【**状态**】
6. `hermes_state.py::SessionDB::set_session_title` 条件：给压缩后新 session 续写 lineage title 【**会话**】【**状态**】
7. `tools/file_tools.py::<module>::reset_file_dedup` 条件：压缩后清空文件读取去重缓存 【**上下文**】【**状态**】
8. `agent/memory_manager.py::_MemoryManager::on_memory_write` 条件：内建 memory 工具写入后桥接外部记忆系统，把显式记忆同步到插件后端 【**记忆**】【**状态**】【**自改进**】

## 13. `session_id` 生成位置汇总

`session_id` 是 Hermes 会话追踪的核心标识符，在多个入口点生成，格式统一为 `{timestamp}_{uuid}`：

### 13.1 CLI 路径生成

1. **`cli.py::HermesCLI::__init__` (L1598；类定义在 L1590)**
   ```python
   timestamp_str = self.session_start.strftime("%Y%m%d_%H%M%S")
   short_uuid = uuid.uuid4().hex[:6]
   self.session_id = f"{timestamp_str}_{short_uuid}"
   ```
   - 触发时机：CLI 交互模式启动时
   - 格式：`20260416_143025_a3f2c1` (6位 UUID)
   - 传递路径：`HermesCLI.__init__` → `_init_agent()` → `AIAgent.__init__(session_id=...)`

2. **`cli.py::HermesCLI::_branch_session` (L4049-4050)**
   ```python
   timestamp_str = now.strftime("%Y%m%d_%H%M%S")
   short_uuid = uuid.uuid4().hex[:6]
   new_session_id = f"{timestamp_str}_{short_uuid}"
   ```
   - 触发时机：用户执行 `/branch` 命令创建会话分支时
   - 用途：从当前会话派生新的独立会话线

### 13.2 Agent 内核生成

3. **`run_agent.py::AIAgent::__init__` (L552；类定义在 L535)**
   ```python
   timestamp_str = self.session_start.strftime("%Y%m%d_%H%M%S")
   short_uuid = uuid.uuid4().hex[:6]
   self.session_id = f"{timestamp_str}_{short_uuid}"
   ```
   - 触发时机：`AIAgent` 初始化时未传入 `session_id` 参数
   - 格式：`20260416_143025_a3f2c1` (6位 UUID)
   - 说明：这是 agent 内核的兜底生成逻辑

4. **`run_agent.py::AIAgent::_compress_context` (L7136)**
   ```python
   self.session_id = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
   ```
   - 触发时机：上下文压缩后创建新 session lineage 节点
   - 用途：压缩会切断旧会话并开启新会话，保持 lineage 链

### 13.3 Gateway 路径生成

5. **`gateway/session.py::SessionStore::get_or_create_session` (L734)**
   ```python
   session_id = f"{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
   ```
   - 触发时机：Gateway 平台（Telegram/Discord/Slack 等）创建新会话时
   - 格式：`20260416_143025_a3f2c1b4` (8位 UUID，比 CLI 多2位)
   - 说明：Gateway 使用稍长的 UUID 以降低多平台并发冲突概率

6. **`gateway/session.py::SessionStore::branch_session` (L843)**
   ```python
   session_id = f"{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
   ```
   - 触发时机：Gateway 平台执行会话分支时
   - 用途：与 CLI 分支类似，但在消息平台环境

7. **`gateway/run.py::_branch_session` (L6429)**
   ```python
   new_session_id = f"{timestamp_str}_{short_uuid}"
   ```
   - 触发时机：Gateway 运行时分支逻辑
   - 说明：Gateway 的另一个分支入口

8. **`gateway/platforms/api_server.py::_handle_chat_completions` (L1489)**
   ```python
   session_id = stored_session_id or str(uuid.uuid4())
   ```
   - 触发时机：OpenAI 兼容 API 服务器处理请求时
   - 格式：纯 UUID（无时间戳前缀），与其他路径不同
   - 说明：优先复用已存储的 `session_id`，否则生成纯 UUID

### 13.4 其他组件生成

9. **`acp_adapter/session.py::SessionManager::create_session` (L98)**
   ```python
   session_id = str(uuid.uuid4())
   ```
   - 触发时机：ACP (Agent Communication Protocol) 适配器创建会话时
   - 格式：纯 UUID 字符串
   - 说明：ACP 协议使用标准 UUID 格式

### 13.5 格式差异总结

| 生成位置 | 格式 | UUID 长度 | 示例 |
|---------|------|----------|------|
| CLI / Agent 内核 | `{timestamp}_{uuid}` | 6位 | `20260416_143025_a3f2c1` |
| Gateway 平台 | `{timestamp}_{uuid}` | 8位 | `20260416_143025_a3f2c1b4` |
| API Server | 纯 UUID | 完整 | `550e8400-e29b-41d4-a716-446655440000` |
| ACP 适配器 | 纯 UUID | 完整 | `550e8400-e29b-41d4-a716-446655440000` |

### 13.6 设计要点

1. **时间戳前缀的作用**：
   - 便于按时间排序和检索
   - 人类可读性强，调试时能快速定位会话时间
   - 文件系统友好（`session_{session_id}.json` 自然按时间排序）

2. **UUID 长度权衡**：
   - CLI 使用 6位：单用户环境，冲突概率极低
   - Gateway 使用 8位：多平台并发，需要更高唯一性保证
   - 完整 UUID：跨系统通信（API/ACP），需要标准格式

3. **生成时机**：
   - 入口层（CLI/Gateway）：在用户交互开始时生成
   - 内核层（AIAgent）：兜底生成，确保总有有效 ID
   - 压缩时：创建新 lineage 节点，保持会话链可追溯

4. **传递链路**：
   ```
   CLI/Gateway 生成 session_id
     ↓
   传递给 AIAgent.__init__(session_id=...)
     ↓
   AIAgent 使用该 ID 创建 SessionDB 记录
     ↓
   所有消息、工具调用、压缩事件都关联到该 ID
   ```

## 结

- 无工具调用的完整主链看到 10 为止
- 有工具调用的完整链路在 10 之后继续接 11
- 12 只是压缩 / SessionDB / 记忆相关的补充分支说明，不是主链尾部
- 13 补充了 `session_id` 在各个入口点的生成逻辑和格式差异
- 14 补充了 v0.10.0 新增的调试与运行时特性

## 14. v0.10.0 新增调试相关特性

### 14.1 新调试命令

1. **`/debug` 命令**：在 CLI 交互模式中快速查看当前 session 状态、token 用量、provider 信息
2. **`hermes debug share`**：导出当前 session 诊断信息，便于远程排错
3. **Tool Gateway 状态检查**：检查 MCP 和外部工具连接的健康状态
4. **插件命令分发**：插件可以注册自定义 `/` 命令
5. **Reasoning 预览**：CLI 中可实时显示模型的 reasoning/thinking 增量内容

### 14.2 凭据轮换与回退子系统

`run_agent.py` L4307-4924 新增运行时凭据管理子系统：
- `credential_pool`：多个 API key 的负载均衡与故障切换
- `fallback_model`：主模型不可用时自动降级
- `_restore_primary_runtime`：上一轮 fallback 后恢复主 provider

### 14.3 SessionDB schema v6

- sessions 表新增字段：`title`、`billing`/`cost`、`reasoning_tokens`
- messages 表新增字段：`reasoning`、`reasoning_details`、`codex_reasoning_items`
- SQLite 启用 WAL 模式 + jitter retry + 定期 checkpoint

### 14.4 新 Gateway 平台适配器

v0.10.0 新增多个平台适配器：BlueBubbles、WeCom 回调、Email、SMS、Home Assistant

### 14.5 model_tools.py 工具分发链更新

- 三阶段工具发现：builtin → MCP → plugins
- `coerce_tool_args` (L334)：参数类型自动强制转换
- `pre_tool_call` blocking hook (L454-472)：插件可阻止工具执行
- `post_tool_call` hook (L514-525)：插件可观察/修改工具结果
- `handle_function_call` 扩展签名 (L421-430)：新增 `tool_call_id`、`session_id`、`enabled_tools`、`skip_pre_tool_call_hook`

### 14.6 其他运行时新特性

- **语音模式（Voice mode）**：通过 `faster-whisper` + `elevenlabs` 支持语音输入输出
- **后台任务监控**：CLI 可查看后台 review/delegation 任务状态
- **api_mode 自动检测**：根据 provider/model 自动选择 `chat_completions`、`codex_responses`、`anthropic_messages`、`bedrock_converse` 模式

## 附录

附录部分不再追加主链节点，而是集中补充三类容易在阅读源码时混淆的问题：Hermes 当前的在线自改进机制、`hermes-agent-self-evolution` 的离线进化规划、以及这些设计在实际使用中会呈现出的行为后果。

### 1. 自改进链路补注

Hermes 的“自学习”本质上不是训练模型参数，而是把任务过程中的**稳定事实、可复用方法、历史对话证据、外部记忆反馈**沉淀到下一轮还能继续使用的层。

1. **显式记忆沉淀**
   `tools/memory_tool.py::MemoryStore::add/replace/remove` 把稳定事实写入 `MEMORY.md` 或 `USER.md`，`load_from_disk` 与 `format_for_system_prompt` 会在后续 session 启动时重新注入这些内容。也就是说，Hermes 会“记住”用户偏好、环境约束、项目约定，但这份记忆是文件级持久化，不是模型权重更新。

2. **后台复盘后自动写回**
   `run_agent.py::AIAgent::_spawn_background_review` 是最像“自我复盘”的节点。它会在主任务答复结束后 fork 一个静默 agent，把 `_MEMORY_REVIEW_PROMPT / _SKILL_REVIEW_PROMPT / _COMBINED_REVIEW_PROMPT` 作为新一轮输入，检查这次对话里有没有值得沉淀的偏好、经验、坑点或可复用流程；若有，就直接调用 `memory` 或 `skill_manage` 写回共享存储。

3. **技能是程序性记忆，不是普通笔记**
   `tools/skill_manager_tool.py` 在源码开头就把 skills 定义为 `procedural memory`。它保存的是“某类任务应该怎么做”的操作套路，而不是用户画像。后续 `agent/prompt_builder.py::<module>::build_skills_system_prompt` 会重新扫描技能索引，并把可用技能压缩成 system prompt 的一部分，所以经验能跨任务复用。

4. **跨会话召回让它看起来像‘记得以前做过’**
   `tools/session_search_tool.py::<module>::session_search` 通过 SQLite FTS5 检索旧会话，再让辅助模型生成聚焦摘要；`agent/memory_manager.py::_MemoryManager::prefetch_all` 则允许外部记忆插件在每轮前预取相关事实。这两条链让 Hermes 可以在新任务里把旧任务的结论、命令、文件路径、决策重新带回来。

5. **外部 memory provider 负责更强的抽取、索引和反馈**
   `agent/memory_provider.py::MemoryProvider` 定义了 `prefetch / sync_turn / on_session_end / on_memory_write / on_delegation` 这组生命周期钩子。不同插件据此实现增强版“自改进”：
   - `plugins/memory/openviking/__init__.py::OpenVikingMemoryProvider::on_session_end` 会在 session commit 时自动抽取 `profile / preferences / entities / events / cases / patterns`
   - `plugins/memory/supermemory/__init__.py::SupermemoryProvider::sync_turn/on_session_end/on_memory_write` 会把 turn、session、显式记忆分别写入图状长期记忆
   - `plugins/memory/holographic/store.py::MemoryStore::record_feedback` 支持 `fact_feedback(helpful/unhelpful)`，直接调整 fact trust score；这是真正意义上的“基于使用反馈修正记忆质量”

6. **短期自修复和长期自改进要分开看**
   类似 `run_agent.py::AIAgent::_repair_tool_call`、无效工具名重试、上下文压缩、重试回退，这些更偏向**运行时自修复**；它们能让当前回合少犯错，但不一定形成长期知识。真正会留下来、并在未来继续影响行为的，是记忆写回、技能沉淀、session recall、provider 同步与反馈打分这几条链。

### 2. 对照 [hermes-agent-self-evolution](https://github.com/NousResearch/hermes-agent-self-evolution)计划再看一层

参考 `NousResearch/hermes-agent-self-evolution` 的 `PLAN.md`，可以把 Hermes 的“自改进”再拆成两层：

1. **Hermes 当前仓内已经存在的在线自改进层**
   这一层就是本文前面标出的真实链路：`memory_tool`、`skill_manage`、`session_search`、`_spawn_background_review`、`memory_manager.prefetch_all/sync_all/on_memory_write`，以及各类外部 memory provider。它的特点是**边运行边沉淀**，目标是让同一个 agent 在后续 session 或后续 turn 更懂用户、更会复用经验。

2. **`hermes-agent-self-evolution` 计划中的离线进化优化层**
   这个计划明确写的是：它**不在 hermes-agent 仓内运行**，而是一个独立 repo，`operates ON hermes-agent — not part of it`。它要优化的也不是模型权重，而是**技能文本、工具描述、system prompt 片段、以及部分代码文件**。也就是说，它不是“在线记忆”，而是“离线把 agent 本身的策略文本和实现继续打磨”。

3. **两层的目标不同，但素材来源是连通的**
   `PLAN.md` 里的优化闭环依赖几类 Hermes 现成资产：
   - `hermes_state.py` / SessionDB：挖真实使用数据，构造 eval dataset
   - `batch_runner.py`：并行跑评测任务，比较 baseline 与 candidate
   - `agent/trajectory.py` 与 trajectory 保存链：把执行轨迹提供给反思式优化器
   - `skills/`：技能文本本身就是一号优化对象
   - `tools/registry.py` / `tools/*.py`：工具 schema 的 description 是二号优化对象
   - `agent/prompt_builder.py`：`MEMORY_GUIDANCE / SESSION_SEARCH_GUIDANCE / SKILLS_GUIDANCE` 等 prompt 片段是三号优化对象
   - `tests/` 与 benchmark 环境：做 guardrail，避免“优化”变成回归

4. **这说明当前 Hermes 已经具备“被进化”的接口面**
   从源码现状看，很多关键支点已经存在：
   - `batch_runner.py` 已经能并行跑任务并产出 trajectory
   - `run_agent.py::AIAgent::_save_trajectory` / `agent/trajectory.py` 已经能保留执行轨迹
   - `environments/benchmarks/tblite/`、`terminalbench_2/`、`yc_bench/` 已经提供 benchmark gate
   - `prompt_builder.py` 里的 guidance 常量本身就是可参数化的 prompt section
   - `skill_manage` 与技能目录让“程序性记忆”天然可版本化、可 diff、可回滚

5. **`PLAN.md` 比当前仓内能力更进一步的地方**
   当前 Hermes 主要做到“把经验留下来并复用”；而 self-evolution 计划想做的是“把这些经验转成可验证的优化实验”，核心新增的是：
   - 用 DSPy + GEPA / MIPROv2 进化 skills、tool descriptions、prompt sections
   - 用 Darwinian Evolver 进化代码实现
   - 用 train / val / test 划分、LLM-as-judge rubric、benchmark gate 做严格比较
   - 只在离线评估和人工审批通过后，才通过 git branch / PR 回灌到 `hermes-agent`

6. **因此，严格说现在的 Hermes 是“可持续积累经验的 agent”，而不是完整的“自动进化系统”**
   当前仓内已经实现了在线经验沉淀、跨会话召回、后台复盘、外部记忆反馈这些机制；但 `PLAN.md` 描述的 GEPA/DSPy/Darwinian 那套**离线 evolutionary optimization pipeline**，还属于仓外规划能力，而不是本文这条调试链里已经发生的默认行为。

7. **两者拼起来，才是更完整的 self-improving 图景**
   - 在线层：解决“这次学到的东西，下次能不能记住并用上”
   - 离线层：解决“这些记忆、轨迹、失败样本，能不能系统性反哺技能、prompt、工具描述甚至代码本身”

换句话说，本文前面标出的链路解释了**Hermes 现在怎样在产品内自我改进**；而 `hermes-agent-self-evolution/PLAN.md` 则补上了**Hermes 未来怎样把这些运行痕迹变成可测量、可回滚、可审查的离线进化工程**。

### 3. 来自 [Hermes Agent 从中级到高级进阶指南](https://x.com/BTCqzy1/status/2044259795499450414)

1. **为什么很多人会觉得 Hermes “写了记忆却没立刻记住”**
   这不是单纯的体验问题，而是源码里的明确设计：`tools/memory_tool.py::MemoryStore` 维护两套状态，一套是 `_system_prompt_snapshot`，在 `load_from_disk()` 时冻结；另一套才是运行中可变的 live memory。前者中途不变，是为了保持 prefix cache 稳定；后者会立刻写盘，但通常要到后续 session 或 system prompt 重建后才真正稳定地影响模型行为。

2. **`nudge_interval` 的语义，最好按“用户轮次”理解，不要按 tool call 理解**
   `run_agent.py::AIAgent::run_conversation` 在每次新的用户输入开始时递增 `_user_turn_count`，并用 `_turns_since_memory` 判断是否触发 memory review；这说明 `memory.nudge_interval` 更接近“若干次用户回合后触发一次记忆复盘”。
   相对地，技能侧是另一套节奏：`_iters_since_skill` 在 agent loop 的工具迭代里累计，`skills.creation_nudge_interval` 更接近“若干次工具驱动迭代后，触发一次 skill review”。

3. **`SOUL.md`、`AGENTS.md`、`MEMORY.md/USER.md` 在源码里属于不同层，不应该混写**
   从 `_build_system_prompt` 看，Hermes 大致按 `SOUL.md -> memory/user profile -> external memory block -> skills -> AGENTS.md/.hermes.md/...` 的顺序组装上下文：
   - `SOUL.md` 更接近 agent identity / 长期行为准则
   - `AGENTS.md` 更接近项目级规范和仓库约束
   - `MEMORY.md / USER.md` 更接近 agent-curated 的稳定事实与偏好
   所以 `temp` 里“不要把应该写在 SOUL.md 的东西塞进 MEMORY.md”这个提醒是有借鉴价值的，而且和当前源码的 prompt 分层是一致的。

4. **本文里凡是写到 `~/.hermes/...`，都应该脑补成“当前 `HERMES_HOME` 对应路径”**
   `MemoryStore.get_memory_dir()`、`load_soul_md()` 等入口都通过 `get_hermes_home()` 取路径，说明这些文件并不是硬编码绑死在默认 profile。也就是说，在 profile 场景下，本篇提到的 `MEMORY.md`、`USER.md`、`SOUL.md`、`skills/` 本质上都应该理解为“当前 profile 的数据根目录下的对应文件”。

5. **子 Agent 不会天然继承主 Agent 的完整上下文，这一点在调试 delegation 时很关键**
   `tools/delegate_tool.py` 明确把 `memory` 从子 Agent 可用工具里禁掉，并在创建 child 时传 `skip_memory=True`。同时它的 tool schema 也直接写了：subagent 对父上下文是未知的，`goal` 和 `context` 必须写得自足。
   这意味着：当你在 delegation 链路里看到子 Agent “不知道刚才那个文件”或“没继承主线偏好”，默认应该先怀疑 `delegate_task(context=...)` 是否写得不够完整，而不是先怀疑记忆系统失效。

![Hermes Self Evolution](images/hermes-self-evolution.drawio)
