# Implementation Plan: iota cabin-simulation-agent

## Overview

本计划将修正后的 requirements 和 design 落成可执行的纯 Python 实现任务。实现目标是构建一个单进程、asyncio 驱动的 `iota` 智能座舱仿真系统，包含统一的初始化模型、统一的会话上下文和统一的结构化响应闭环。

## Tasks

- [ ] 1. 搭建项目骨架与依赖
  - 创建 `iota/` 包结构，严格对齐 requirements 中定义的完整模块结构
  - 创建 `pyproject.toml`，声明 FastAPI、websockets、Pydantic、structlog、orjson、aiofiles、OpenAI、Anthropic 等依赖
  - 创建 `.iota/config.toml` 示例与 `config/default.toml`
  - 补齐所有包的 `__init__.py`
  - _Requirements: 14, 15, 16_

- [ ] 2. 定义权威数据模型
  - [ ] 2.1 实现场景初始化模型
    - 创建 `TripGoal`、`Origin`、`Occupant`、`ScenarioInitialization`
    - 确保字段与三份文档完全一致：`trip_goal`、`origin`、`occupants`、`scene_config`
    - _Requirements: 1, 15_
  - [ ] 2.2 实现结构化响应模型
    - 创建 `StructuredResponse`
    - 固定字段：`response_status`、`response_content`、`completion_flag`、`side_effects`、`raw_payload`、`timestamp`
    - _Requirements: 8, 9_
  - [ ] 2.3 实现会话上下文模型
    - 创建 `TurnRecord`、`SessionContext`
    - 固定状态集合：`created / running / completed / aborted`
    - 固定上下文字段：初始化结果、当前环境、当前用户状态、记忆、最近一轮行为、最近一轮响应、最近一轮评测、历史记录
    - _Requirements: 6, 10, 15_
  - [ ] 2.4 实现环境、用户、行为、评测模型
    - 创建环境、用户状态、行为输入、评测结果相关 Pydantic 模型
    - _Requirements: 3, 4, 7, 9_

- [ ] 3. 实现配置与错误体系
  - 创建 `ConfigLoader`，支持全局配置、项目配置、运行时覆盖
  - 实现深度合并策略：运行时覆盖 > 项目配置 > 全局配置
  - 创建错误基类、可重试错误、不可重试错误
  - 为 WebSocket、LLM、配置和协议解析定义错误分类
  - 采用快速失败策略
  - _Requirements: 14, 15_

- [ ] 4. 实现 LLM 服务层
  - [ ] 4.1 创建统一 LLMService
    - 封装 provider 选择、超时、重试和 token 统计
    - _Requirements: 14, 15_
  - [ ] 4.2 实现 OpenAI 与 Anthropic Provider
    - 使用异步 Python SDK
    - _Requirements: 14_
  - [ ] 4.3 创建 Prompt 模板
    - `environment.py`
    - `user_state.py`
    - `behavior.py`
    - `decision.py`
    - `response_parser.py`
    - _Requirements: 15_
  - [ ] 4.4 实现流式 LLM 支持
    - 为 provider 统一暴露 streaming 接口
    - 支持增量消费和取消
    - _Requirements: 14, 15_

- [ ] 5. 实现核心运行时组件
  - [ ] 5.1 实现 SessionManager
    - 创建、读取、更新、终止会话
    - 按单用户模式管理会话，多轮复用同一个 session
    - 使用 asyncio 锁保护共享状态
    - _Requirements: 14, 15_
  - [ ] 5.2 实现 WebSocketManager
    - 建立系统级单例连接
    - 所有会话通过会话 ID 复用同一连接
    - 支持超时和心跳
    - 采用快速失败策略，不实现复杂重连逻辑
    - _Requirements: 8, 14_
  - [ ] 5.3 实现 LogManager
    - 使用 structlog + asyncio.Queue + aiofiles
    - 输出每轮日志、状态日志和错误日志
    - _Requirements: 14_

- [ ] 6. 实现初始化模块
  - [ ] 6.1 实现 ScenarioInitializer
    - 将业务配置映射为统一 `ScenarioInitialization`
    - 确保所有下游模块消费同一初始化结果
    - _Requirements: 1_
  - [ ] 6.2 实现 SuddenNoiseGenerator (Mock)
    - 定义接口，返回空字典作为 Mock 实现
    - 支持四类扰动源的接口定义
    - 限制其只影响环境感知仿真和用户状态仿真
    - _Requirements: 2_

- [ ] 7. 实现输入支撑模块
  - [ ] 7.1 实现 EnvironmentSimulation
    - 基于初始化结果构建初始环境（舱外+舱内）
    - 合并噪声和 `StructuredResponse.side_effects`
    - 确保在每轮中先于用户状态仿真完成更新
    - 对外提供当前环境上下文
    - _Requirements: 3, 11_
  - [ ] 7.2 实现 UserStateSimulation
    - 基于初始化结果建立用户初始状态
    - 依赖环境感知仿真的当前输出作为前提条件
    - 读取当前环境并合并噪声和响应副作用
    - 对外提供当前用户状态
    - _Requirements: 4, 11_
  - [ ] 7.3 实现 MemoryModule (外部系统接口)
    - 初始化长期偏好和短期上下文
    - 提供异步接口接收行为更新和评估更新
    - 对 DecisionEngine 提供稳定的记忆视图
    - 记忆系统自行保证更新顺序
    - _Requirements: 5, 13_

- [ ] 8. 实现下层执行反馈层
  - [ ] 8.1 实现 UserBehaviorSimulation
    - 支持语音、按键、触屏
    - 为手势预留扩展字段
    - 输出行为并同步写入记忆更新链路和评估链路
    - _Requirements: 7, 12, 13_
  - [ ] 8.2 实现 TargetSystemCallModule
    - 通过 WebSocketManager 向目标系统发送行为请求
    - 接收原始响应
    - 优先使用协议 schema 解析，必要时使用 LLM 归一化
    - 输出统一 `StructuredResponse`
    - _Requirements: 8, 11, 12_
  - [ ] 8.3 实现 EvaluationEngine
    - 固定输入为“用户行为 + StructuredResponse”
    - 计算合理性、准确性、覆盖率、实时性
    - 将评估结果写入记忆并返回给编排器
    - _Requirements: 9, 12, 13_

- [ ] 9. 实现上层决策编排层
  - [ ] 9.1 实现 DecisionEngine
    - 基于环境、用户状态和记忆生成当前轮策略
    - 统一封装情景理解、需求解析、规划策略和意图推演
    - 负责会话级外层循环 (run_until_complete)
    - 负责单轮级内层执行 (execute_turn)
    - _Requirements: 6, 10_
  - [ ] 9.2 实现继续/结束判断
    - 按优先级检查：致命错误、完成标记、最大轮次
    - 采用快速失败策略，不实现复杂恢复逻辑
    - _Requirements: 6, 10, 14_
  - [ ] 9.3 实现反馈链路写回
    - 将 `StructuredResponse.side_effects` 写回环境和用户状态
    - 将行为结果和评测结果异步发送到记忆模块
    - _Requirements: 11, 13_

- [ ] 10. 实现 API 与 CLI
  - [ ] 10.1 实现 FastAPI 应用
    - `POST /api/simulation/start`
    - `GET /api/simulation/{session_id}/status`
    - `POST /api/simulation/{session_id}/stop`
    - `GET /health`
    - _Requirements: 14, 16_
  - [ ] 10.2 实现 CLI
    - `python -m iota start --config config.toml`
    - `iota start --config config.toml`
    - _Requirements: 14, 15, 16_

- [ ] 11. 连接所有组件
  - 在 API 生命周期中初始化 SessionManager、WebSocketManager、LogManager、LLMService、DecisionEngine
  - 将仿真任务放入后台 asyncio task
  - 在关闭时清理连接和后台任务
  - _Requirements: 10, 14, 15_

- [ ] 12. 编写测试
  - [ ] 12.1 单元测试
    - 模型校验、配置加载、错误分类、状态机
    - 配置合并策略测试
    - _Requirements: 1, 8, 15_
  - [ ] 12.2 集成测试
    - 单轮闭环、多轮闭环、反馈链路、记忆连续性
    - 环境先于用户状态更新的顺序验证
    - _Requirements: 10, 11, 12, 13_
  - [ ] 12.3 协议测试
    - WebSocket 请求与响应 schema
    - 响应解析三层降级策略测试
    - _Requirements: 8, 14_
  - [ ] 12.4 属性测试
    - 主链路顺序、评估依赖、噪声边界
    - 使用 pytest + hypothesis 验证正确性属性
    - _Requirements: Correctness Properties_

- [ ] 13. 补齐部署与文档
  - 创建 `Dockerfile`
  - 补齐 README 中的开发、测试、运行和部署说明
  - 记录配置示例和环境变量要求
  - _Requirements: 16_

- [ ] 14. 最终一致性检查
  - 检查代码与文档中不再出现独立“车辆响应仿真”
  - 检查所有模块都使用统一 `SessionContext`
  - 检查所有初始化流程都消费统一 `ScenarioInitialization`
  - 检查评测输入固定为“用户行为 + StructuredResponse”
  - _Requirements: 1, 8, 9, 15_

## Notes

- `iota` 是系统名，不再实现独立的工具系统子框架
- 不实现独立的“车辆响应仿真”层
- 不引入非 Python 语言组件
- 环境更新先于用户状态更新，避免文档与实现顺序冲突
- `StructuredResponse` 是唯一标准化反馈结构

## Main Loop Architecture

### Outer Loop

- `SimulationCoordinator.run_until_complete()` 负责会话级循环
- 条件是 `SessionContext.status == "running"`
- 每轮执行 `execute_turn()`，之后执行继续/结束判断

### Inner Loop

- `execute_turn()` 负责单轮执行
- 顺序为：环境更新 -> 用户状态更新 -> 记忆读取 -> 编排决策 -> 行为生成 -> 目标系统调用与响应解析 -> 评测量化
- 反馈链路和日志写入可以异步解耦，但不改变主链路顺序

### Decision Logic

- 优先检查致命错误
- 再检查 `StructuredResponse.completion_flag`
- 再检查 `max_turns`
- 最后保留 LLM 辅助判断能力

### Error Recovery

- WebSocket 错误按可重试错误处理
- LLM 暂时性错误按重试策略处理
- 超过重试上限后把会话标记为 `aborted`
