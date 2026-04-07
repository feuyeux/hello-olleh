# Implementation Plan: 智能座舱仿真智能体系统

## Overview

本实现计划将智能座舱仿真智能体系统分解为可执行的编码任务。系统采用 Python + Rust 混合架构（进程间通信模式），Python 负责 CLI、API、LLM 服务和业务编排，Rust 负责高性能运行时引擎。

核心架构：
- Python 进程：CLI 启动器、FastAPI 服务器、LLM 服务、仿真协调器和引擎
- Rust 进程：独立二进制 (iota)，内部 HTTP 服务器，核心运行时引擎
- 进程通信：HTTP/JSON-RPC（Python → Rust: 127.0.0.1:9527, Rust → Python: 127.0.0.1:8001）

## Tasks

- [ ] 1. 设置项目结构和配置管理
  - 创建 Python 和 Rust 项目目录结构
  - 配置 Rust Cargo.toml 和 Python requirements.txt
  - 实现配置层级系统（全局、项目、运行时）
  - 创建 JSON schema 用于配置验证
  - _Requirements: 15.1, 15.9, 15.10, 16.6, 17.1_

- [ ] 2. 实现 Rust 核心运行时引擎 (iota)
  - [ ] 2.1 实现 Rust HTTP 服务器基础框架
    - 使用 axum 创建 HTTP 服务器（监听 127.0.0.1:9527）
    - 实现 health check 端点 (GET /health)
    - 实现基础路由结构和错误处理
    - _Requirements: 15.2, 15.5, 17.2_

  - [ ] 2.2 实现会话管理器
    - 使用 dashmap 实现并发会话状态存储
    - 实现会话 CRUD 操作和状态机
    - 实现 POST /api/session/create 和 GET /api/session/{id}/status 端点
    - _Requirements: 15.2, 16.3, 17.2_

  - [ ] 2.3 实现 WebSocket 管理器
    - 使用 tokio-tungstenite 实现 WebSocket 客户端
    - 实现连接池和自动重连机制
    - 实现 POST /api/websocket/connect 和 POST /api/websocket/{id}/send 端点
    - _Requirements: 15.2, 15.5, 17.2_

  - [ ] 2.4 实现异步日志系统
    - 使用 tracing 框架实现结构化日志
    - 实现异步文件 I/O 和 JSON 格式输出
    - _Requirements: 15.2, 15.5, 17.2_

  - [ ] 2.5 实现评测量化引擎
    - 使用 rayon 实现并行评测计算
    - 实现四个维度的评测指标
    - 实现 POST /api/evaluation/compute 端点
    - _Requirements: 9.1, 15.2, 15.5, 17.2_

  - [ ] 2.6 实现 HTTP 客户端用于回调 Python LLM 服务
    - 使用 reqwest 实现异步 HTTP 客户端
    - 实现 POST /llm/* 端点调用和流式响应处理
    - _Requirements: 15.2, 15.6, 17.2_

  - [ ] 2.7 实现数据模型和序列化
    - 使用 serde 定义所有数据结构
    - 实现 JSON 序列化/反序列化
    - _Requirements: 15.8, 17.2_

- [ ] 3. Checkpoint - 验证 Rust 核心引擎
  - 独立运行 Rust 二进制，验证 HTTP 服务器启动
  - 使用 curl 测试所有 API 端点
  - 验证会话管理、WebSocket 连接、日志和评测功能
  - 确保所有测试通过，询问用户是否有问题

- [ ] 4. 实现 Python CLI 启动器
  - [ ] 4.1 实现进程管理和信号转发
    - 使用 subprocess.Popen() 启动 Rust 二进制
    - 实现 health check 等待逻辑
    - 实现信号转发到 Rust 进程
    - _Requirements: 15.1, 15.4, 17.2_

  - [ ] 4.2 实现命令行参数解析
    - 使用 argparse 解析命令行参数
    - 实现子命令（start, stop, status, llm-service, api-server）
    - _Requirements: 15.1, 15.4, 16.6_

- [ ] 5. 实现 Python LLM 服务
  - [ ] 5.1 实现 LLM HTTP 服务器
    - 使用 FastAPI 创建 HTTP 服务器（监听 127.0.0.1:8001）
    - 实现 POST /llm/generate, /llm/analyze 等端点
    - _Requirements: 15.1, 15.4, 17.2_

  - [ ] 5.2 集成 OpenAI SDK
    - 实现 OpenAI API 客户端封装
    - 支持流式响应处理和 token 统计
    - _Requirements: 15.1, 15.4, 16.8_

  - [ ] 5.3 集成 Anthropic SDK
    - 实现 Anthropic API 客户端封装
    - 支持流式响应处理和 token 统计
    - _Requirements: 15.1, 15.4, 16.8_

  - [ ] 5.4 实现 Prompt Engineering 能力
    - 实现系统提示词模板管理
    - 实现上下文注入和 Few-shot examples 支持
    - _Requirements: 16.5, 16.8_

- [ ] 6. 实现 Python HTTP API 服务器
  - [ ] 6.1 实现 FastAPI 应用和路由
    - 创建 FastAPI 应用（监听 0.0.0.0:8000）
    - 实现 POST /api/simulation/start 等端点
    - _Requirements: 15.1, 15.4, 17.2_

  - [ ] 6.2 实现 HTTP 客户端用于调用 Rust
    - 使用 httpx 或 aiohttp 实现异步 HTTP 客户端
    - 实现请求转发到 Rust HTTP 服务器
    - _Requirements: 15.1, 15.4, 17.2_

- [ ] 7. 实现干预层模块
  - [ ] 7.1 实现仿真场景初始化
    - 实现场景配置解析
    - 将初始化结果分发到环境感知、用户状态和长短期记忆模块
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 7.2 实现突发噪声模块
    - 实现四类噪声源
    - 通过噪声扰动链路传递到环境感知和用户状态
    - _Requirements: 2.1, 2.2, 2.3, 14.1, 14.2_

- [ ] 8. 实现输入支撑模块
  - [ ] 8.1 实现环境感知仿真引擎
    - 实现舱外环境、交通参与者、舱内环境、车辆状态的数据结构
    - 调用 LLM 服务生成环境数据
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 11.1_

  - [ ] 8.2 实现用户状态仿真引擎
    - 实现用户人设、知识背景、身体状态、情绪状态的数据结构
    - 调用 LLM 服务生成用户状态数据
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 11.2_

  - [ ] 8.3 实现长短期记忆模块
    - 实现个性化偏好、实时上下文窗口、知识库的数据结构
    - 实现记忆更新机制
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 13.1, 13.2, 13.3_
