# Design Document: 智能座舱仿真智能体系统

## Overview

智能座舱仿真智能体系统（Cabin Simulation Agent System）是一个独立的仿真系统，用于验证智能座舱系统的功能。该系统采用智能体架构模式，通过多轮交互循环与目标系统进行通信和验证。

### 系统目标

1. 模拟真实的智能座舱使用场景（舱外环境、舱内环境、用户行为）
2. 通过WebSocket双向通信与智能座舱系统交互
3. 支持多轮仿真，自动判断结束条件
4. 记录完整的交互日志用于分析和评估

### 核心设计理念

系统借鉴了成熟的智能体系统架构模式（如 Claude Code、Codex、Gemini-CLI、OpenCode 等代码智能体），采用以下核心设计：

- **多轮交互循环**：通过循环机制与目标系统进行多轮交互，每轮基于前一轮的响应
- **上下文管理**：维护会话状态和历史响应，确保仿真的连续性和一致性
- **决策与执行分离**：决策引擎负责生成决策，执行器负责通信和执行
- **工具调用层**：执行器作为工具调用层，封装WebSocket通信细节
- **模块化架构**：各功能模块独立，通过明确的接口交互
- **LLM驱动智能**：利用大语言模型提供智能决策和分析能力
- **结构化日志**：记录完整交互信息，便于分析和调试
- **错误处理与重试**：自动重连、超时处理、错误分类

### 关键设计模式

本系统借鉴了成熟智能体系统的核心架构模式，并针对座舱仿真场景进行了适配。

#### 1. 多轮交互循环（Agent Loop）

**模式来源**：智能体系统的对话循环机制

**应用方式**：
```
场景触发 → 环境仿真 → 生成决策 → 执行决策 → 监听响应 → 判断终止条件 → 继续或结束
```

**实现要点**：
- 仿真协调器作为循环控制器，协调整个流程
- 每轮仿真包含完整的感知-决策-执行-反馈循环
- 通过 `final_decision` 标志和最大轮数判断是否结束
- 类似代码智能体的主循环（Main Loop）模式

#### 2. 上下文管理（Context Management）

**模式来源**：智能体的会话上下文管理机制

**应用方式**：
- `SessionContext` 保存所有历史响应（`previousResponses`）
- 每轮仿真使用前一轮的响应作为输入
- 上下文包含任务状态、待确认事项等
- 用户行为仿真引擎根据历史响应生成合理行为

**数据结构**：
```typescript
interface SessionContext {
  currentTask?: string;
  taskSteps?: string[];
  pendingConfirmations?: string[];
  previousResponses: SystemResponse[]; // 历史对话
}
```

#### 3. 决策与执行分离（Think-Act Separation）

**模式来源**：智能体的思考与行动分离模式

**应用方式**：
- **决策引擎**：生成决策（"思考"），调用LLM进行推理，不与目标系统通信
- **执行器**：执行决策（"行动"），管理WebSocket连接，与目标系统交互
- 决策引擎输出结构化决策，执行器负责实际通信
- 思考不产生副作用，行动才改变状态

**接口设计**：
```typescript
// 决策引擎：只生成决策，不执行
interface DecisionEngine {
  generateDecision(...): Promise<Decision>;
}

// 执行引擎：接收决策并执行
interface ExecutionEngine {
  execute(decision: Decision): Promise<ExecutionResult>;
}
```

#### 4. 工具调用层（Tool Calling Layer）

**模式来源**：智能体的工具系统抽象

**应用方式**：
- 执行引擎作为工具调用层，封装WebSocket通信细节
- 决策引擎调用执行引擎，类似智能体调用工具
- 执行引擎内部管理连接、重试、错误处理
- 执行结果返回给主循环用于下一轮决策

**封装示例**：
```typescript
// 执行引擎作为工具，对外提供简单接口
interface ExecutionEngine {
  execute(decision: Decision): Promise<ExecutionResult>;
  close(): Promise<void>;
}

// 内部封装复杂的WebSocket管理
class WebSocketManager {
  private connection: WebSocket;
  async sendAndWaitResponse(...): Promise<SystemResponse>;
}
```

#### 5. LLM驱动的智能决策

**模式来源**：智能体的核心能力

**应用方式**：
- 舱外/舱内仿真：使用LLM生成合理的环境变化
- 用户行为仿真：使用LLM根据目标系统响应生成用户行为
- 决策引擎：使用LLM生成决策
- 执行引擎：使用LLM分析目标系统响应

**服务接口**：
```typescript
interface LLMService {
  generateExternalEnvironment(...): Promise<LLMResponse>;
  generateUserBehavior(...): Promise<LLMResponse>;
  generateDecision(...): Promise<LLMResponse>;
  analyzeResponse(...): Promise<LLMResponse>;
}
```

#### 6. 结构化日志与可观测性

**模式来源**：智能体的执行追踪机制

**应用方式**：
- 每轮仿真记录完整的输入、决策、输出
- JSON格式存储，便于查询和分析
- 支持按会话查询和导出
- 用于评估目标系统行为

**日志结构**：
```typescript
interface TurnLog {
  sessionId: string;
  turnId: string;
  timestamp: Date;
  externalEnvironment: ExternalEnvironmentData;
  internalEnvironment: InternalEnvironmentData;
  userBehavior: UserBehaviorData;
  decision: Decision;
  response: SystemResponse;
  executionStatus: 'success' | 'error';
}
```

#### 7. 错误处理与重试机制

**模式来源**：智能体的健壮性设计

**应用方式**：
- WebSocket连接断开自动重连（最多3次）
- LLM调用失败重试
- 执行超时处理
- 错误分类（可重试/不可重试）

**错误处理**：
```typescript
interface ExecutionError {
  code: string;
  message: string;
  retryable: boolean; // 错误分类
}

// WebSocket管理器内部重连逻辑
private async reconnect(): Promise<void> {
  if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
    // 重试逻辑
  }
}
```

#### 8. 并行执行优化

**模式来源**：智能体的并行工具调用

**应用方式**：
- 舱外和舱内仿真并行执行（无依赖关系）
- 用户行为仿真等待环境仿真完成（有依赖关系）
- 使用 `Promise.all` 实现并行处理

**实现示例**：
```typescript
const [externalEnv, internalEnv] = await Promise.all([
  this.externalEnvEngine.generate(...),
  this.internalEnvEngine.generate(...)
]);
```

#### 9. 状态机模式

**模式来源**：智能体的会话状态管理

**应用方式**：
- 会话状态：running, completed, aborted
- 状态转换条件：final_decision, max_turns, user_stop
- 状态机保证仿真流程可控

**状态转换**：
```typescript
interface Session {
  status: 'running' | 'completed' | 'aborted';
}

// 状态转换逻辑
if (response.finalDecision) {
  session.status = 'completed';
} else if (session.turnCount >= session.maxTurns) {
  session.status = 'aborted';
}
```

### 领域特定的设计创新

虽然借鉴了智能体的核心模式，但本系统针对座舱仿真场景有独特设计：

1. **双通道通信**：请求通道+数据通道，适配座舱系统的通信协议
2. **环境仿真**：舱外/舱内环境仿真是领域特定的，模拟真实驾驶场景
3. **用户行为仿真**：模拟用户响应，而非接收真实用户输入
4. **黑盒验证**：目标系统作为黑盒，通过仿真验证其行为正确性

## Technology Stack

### Multi-Language Architecture: Python + Rust (Process-Based)

本系统采用 Python + Rust 混合架构，参考 **codex** 项目的进程间通信模式，使用 **subprocess + HTTP/JSON-RPC** 实现 Python 和 Rust 的解耦通信。

**核心设计原则**：
- **No FFI/PyO3**：避免 FFI 的复杂性和跨语言内存管理问题
- **进程隔离**：Python 和 Rust 运行在独立进程中，互不干扰
- **HTTP 通信**：使用标准 HTTP/JSON-RPC 协议进行进程间通信
- **独立部署**：Rust 二进制可独立运行和测试

#### Language Responsibilities

**Python 负责 [Python]**：
- **CLI 启动器**：解析命令行参数，启动 Rust 二进制（subprocess）
- **HTTP API 服务器**：FastAPI 提供外部 REST API
- **LLM 服务集成**：所有 LLM 调用（OpenAI/Anthropic SDK）
- **业务编排**：仿真协调器、仿真引擎、决策引擎的业务逻辑
- **请求转发**：将仿真请求转发到 Rust HTTP 服务器

**Rust 负责 [Rust]**：
- **独立二进制 (iota)**：完整的运行时引擎，可独立启动
- **内部 HTTP 服务器**：监听 127.0.0.1:9527，接收 Python 请求
- **核心运行时引擎**：
  - WebSocket 连接管理（高并发、低延迟）
  - 会话状态管理（高性能读写）
  - 日志系统（异步 I/O、高吞吐）
  - 评测量化计算（CPU 密集型）
- **回调 Python LLM 服务**：通过 HTTP 调用 Python 的 LLM 服务

#### Python-Rust Boundary Definition (Process-Based)

系统在 Python 和 Rust 之间建立清晰的进程边界，通过 **HTTP/JSON-RPC** 进行通信。

**边界原则**：
1. **Python 进程**：CLI 启动器、HTTP API 服务器、LLM 服务、业务编排
2. **Rust 进程**：独立二进制 (iota)，内部 HTTP 服务器，核心运行时引擎
3. **进程通信**：
   - Python → Rust：HTTP POST 请求（JSON 数据）
   - Rust → Python：HTTP POST 回调（LLM 服务）
4. **数据序列化**：JSON 格式（标准 HTTP body）

**标记约定**：
- `[Python]`：Python 进程中的组件
- `[Rust]`：Rust 进程中的组件（iota 二进制）
- `[Python → Rust HTTP]`：Python 通过 HTTP 调用 Rust
- `[Rust → Python HTTP]`：Rust 通过 HTTP 回调 Python

#### Architecture Pattern (Reference: codex)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Python Process [Python]                                │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  CLI Launcher [Python]                                              │    │
│  │  - Parse command line arguments                                     │    │
│  │  - Spawn Rust binary using subprocess.Popen()                       │    │
│  │  - Wait for Rust HTTP server ready (health check)                   │    │
│  │  - Forward signals (SIGINT, SIGTERM) to Rust process                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  HTTP API Server [Python]                                           │    │
│  │  - FastAPI application (port 8000)                                  │    │
│  │  - REST endpoints: /api/simulation/start, /api/simulation/status    │    │
│  │  - Forward requests to Rust HTTP server (127.0.0.1:9527)            │    │
│  │  - Return responses to external clients                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  LLM Service [Python]                                                │    │
│  │  - HTTP server (port 8001) for Rust callbacks                       │    │
│  │  - OpenAI/Anthropic SDK integration                                 │    │
│  │  - Endpoints: /llm/generate, /llm/analyze                           │    │
│  │  - Handle streaming responses                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Simulation Orchestration & Engines [Python]                        │    │
│  │  - SimulationCoordinator (orchestration logic)                      │    │
│  │  - EnvironmentPerceptionSimulation (calls LLM service)              │    │
│  │  - UserStateSimulation (calls LLM service)                          │    │
│  │  - UserBehaviorSimulation (calls LLM service)                       │    │
│  │  - DecisionEngine (calls LLM service)                               │    │
│  │  - Communicate with Rust via HTTP client (httpx/aiohttp)            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Process Boundary
                                      │ Communication: HTTP/JSON-RPC
                                      │ Python → Rust: POST http://127.0.0.1:9527/api/*
                                      │ Rust → Python: POST http://127.0.0.1:8001/llm/*
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Rust Process (iota binary) [Rust]                         │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Internal HTTP Server [Rust]                                        │    │
│  │  - axum web framework                                                │    │
│  │  - Listen on 127.0.0.1:9527                                          │    │
│  │  - Routes:                                                           │    │
│  │    POST /api/session/create                                          │    │
│  │    POST /api/session/{id}/execute                                    │    │
│  │    GET  /api/session/{id}/status                                     │    │
│  │    POST /api/websocket/connect                                       │    │
│  │    POST /api/evaluation/compute                                      │    │
│  │    GET  /health (health check endpoint)                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Core Runtime Engine [Rust]                                         │    │
│  │                                                                       │    │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────┐    │    │
│  │  │  WebSocket Manager   │  │  Session Manager                 │    │    │
│  │  │  - tokio-tungstenite │  │  - dashmap (concurrent HashMap)  │    │    │
│  │  │  - Connection pool   │  │  - Arc<RwLock<Session>>          │    │    │
│  │  │  - Auto-reconnect    │  │  - Thread-safe state access      │    │    │
│  │  │  - Heartbeat         │  │  - CRUD operations               │    │    │
│  │  └──────────────────────┘  └──────────────────────────────────┘    │    │
│  │                                                                       │    │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────┐    │    │
│  │  │  Log Manager         │  │  Evaluation Engine               │    │    │
│  │  │  - tracing framework │  │  - rayon (parallel computation)  │    │    │
│  │  │  - Async file I/O    │  │  - Metrics calculation           │    │    │
│  │  │  - Structured JSON   │  │  - Score aggregation             │    │    │
│  │  │  - Non-blocking      │  │  - Performance optimization      │    │    │
│  │  └──────────────────────┘  └──────────────────────────────────┘    │    │
│  │                                                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  HTTP Client for Python LLM Service [Rust]                          │    │
│  │  - reqwest HTTP client                                               │    │
│  │  - Call Python LLM service: POST http://127.0.0.1:8001/llm/*        │    │
│  │  - Handle streaming responses                                        │    │
│  │  - Retry logic and timeout handling                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

**层次说明**：

1. **Python Process [Python]**：
   - **CLI Launcher**：使用 `subprocess.Popen()` 启动 Rust 二进制，管理进程生命周期
   - **HTTP API Server**：FastAPI 提供外部 REST API，转发请求到 Rust HTTP 服务器
   - **LLM Service**：独立 HTTP 服务器，接收 Rust 的 LLM 回调请求
   - **Simulation Orchestration & Engines**：业务编排逻辑，通过 HTTP 客户端与 Rust 通信

2. **Rust Process (iota binary) [Rust]**：
   - **Internal HTTP Server**：axum 框架，监听 127.0.0.1:9527，接收 Python 请求
   - **Core Runtime Engine**：
     - WebSocket Manager：管理与目标系统的 WebSocket 连接
     - Session Manager：管理仿真会话状态
     - Log Manager：异步日志系统
     - Evaluation Engine：评测计算引擎
   - **HTTP Client for Python LLM Service**：reqwest 客户端，回调 Python 的 LLM 服务

3. **Process Communication**：
   - **Python → Rust**：HTTP POST 请求到 `http://127.0.0.1:9527/api/*`
   - **Rust → Python**：HTTP POST 回调到 `http://127.0.0.1:8001/llm/*`
   - **Data Format**：JSON (标准 HTTP body)
   - **Process Management**：Python 使用 subprocess 管理 Rust 进程生命周期

#### Integration Strategy (Process-Based Communication)

**Process Spawning (Python → Rust)**：
- Python CLI 使用 `subprocess.Popen()` 启动 Rust 二进制
- Rust 二进制启动内部 HTTP 服务器（127.0.0.1:9527）
- Python 等待 Rust HTTP 服务器就绪（health check: GET /health）
- Python 转发信号（SIGINT, SIGTERM）到 Rust 进程

**HTTP Communication (Python ↔ Rust)**：
- Python → Rust：HTTP POST 请求（JSON body）
- Rust → Python：HTTP POST 回调（JSON body）
- 数据格式：标准 JSON（serde_json 序列化）
- 错误处理：HTTP 状态码 + JSON 错误响应

**Example Integration**：

```python
# Python side: CLI Launcher
import subprocess
import httpx
import time

class IotaLauncher:
    def __init__(self, binary_path: str = "./target/release/iota"):
        self.binary_path = binary_path
        self.process = None
        self.rust_url = "http://127.0.0.1:9527"
    
    def start(self):
        # Spawn Rust binary
        self.process = subprocess.Popen(
            [self.binary_path, "--port", "9527"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Wait for Rust HTTP server ready
        for _ in range(30):  # 30 seconds timeout
            try:
                response = httpx.get(f"{self.rust_url}/health")
                if response.status_code == 200:
                    print("Rust HTTP server ready")
                    return
            except httpx.ConnectError:
                time.sleep(1)
        
        raise RuntimeError("Rust HTTP server failed to start")
    
    def stop(self):
        if self.process:
            self.process.terminate()
            self.process.wait(timeout=10)

# Python side: HTTP Client for Rust
class IotaClient:
    def __init__(self, rust_url: str = "http://127.0.0.1:9527"):
        self.rust_url = rust_url
        self.client = httpx.AsyncClient()
    
    async def create_session(self, config: dict) -> str:
        response = await self.client.post(
            f"{self.rust_url}/api/session/create",
            json=config
        )
        response.raise_for_status()
        return response.json()["session_id"]
    
    async def execute_simulation(self, session_id: str, data: dict) -> dict:
        response = await self.client.post(
            f"{self.rust_url}/api/session/{session_id}/execute",
            json=data
        )
        response.raise_for_status()
        return response.json()

# Python side: LLM Service (for Rust callbacks)
from fastapi import FastAPI

app = FastAPI()

@app.post("/llm/generate")
async def llm_generate(request: dict):
    # Call OpenAI/Anthropic SDK
    prompt = request["prompt"]
    response = await openai_client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    return {"text": response.choices[0].message.content}
```

```rust
// Rust side: Internal HTTP Server
use axum::{
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

#[derive(Deserialize)]
struct CreateSessionRequest {
    config: serde_json::Value,
}

#[derive(Serialize)]
struct CreateSessionResponse {
    session_id: String,
}

async fn create_session(
    Json(req): Json<CreateSessionRequest>,
) -> Json<CreateSessionResponse> {
    // Create session logic
    let session_id = uuid::Uuid::new_v4().to_string();
    Json(CreateSessionResponse { session_id })
}

async fn health_check() -> &'static str {
    "OK"
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/session/create", post(create_session))
        .route("/api/session/:id/execute", post(execute_simulation));
    
    let addr = SocketAddr::from(([127, 0, 0, 1], 9527));
    println!("Rust HTTP server listening on {}", addr);
    
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

// Rust side: HTTP Client for Python LLM Service
use reqwest::Client;

struct LlmClient {
    client: Client,
    python_url: String,
}

impl LlmClient {
    fn new(python_url: String) -> Self {
        Self {
            client: Client::new(),
            python_url,
        }
    }
    
    async fn generate(&self, prompt: &str) -> Result<String, reqwest::Error> {
        let response = self.client
            .post(format!("{}/llm/generate", self.python_url))
            .json(&serde_json::json!({ "prompt": prompt }))
            .send()
            .await?;
        
        let result: serde_json::Value = response.json().await?;
        Ok(result["text"].as_str().unwrap().to_string())
    }
}
```

### Agent Runtime Engine: "iota"

系统的核心运行时引擎命名为 **iota**，参考以下项目的实现模式：

#### Reference Implementations

| Project | Language | Key Patterns |
|---------|----------|--------------|
| claude-code | TypeScript | Query engine, tool system, session management |
| claw-code | Rust | High-performance runtime, permission system, MCP support |
| codex | Rust | Native execution, sandbox, config hierarchy |
| gemini-cli | TypeScript | Streaming, context management |
| opencode | Python | LLM integration, prompt engineering |

#### iota Runtime Architecture

**Core Responsibilities**：
- **Session Lifecycle**: 创建、运行、暂停、恢复、终止会话
- **Tool Execution**: 工具调用、权限检查、结果收集
- **Context Management**: 上下文构建、压缩、持久化
- **Stream Processing**: 流式响应处理、增量更新
- **Error Handling**: 错误分类、重试策略、降级处理

**Design Principles (from reference projects)**：

1. **Modular Tool System** (claude-code pattern)
   - 每个工具独立实现
   - 统一的工具接口
   - 动态工具注册

2. **Permission Model** (claw-code pattern)
   - 细粒度权限控制
   - 用户确认流程
   - 权限策略配置

3. **Config Hierarchy** (codex pattern)
   - 全局配置 (`~/.iota/config.toml`)
   - 项目配置 (`.iota/config.toml`)
   - 运行时覆盖 (`--config` flags)

4. **Streaming First** (gemini-cli pattern)
   - 所有 LLM 调用默认流式
   - 增量渲染
   - 取消支持

5. **Prompt Engineering** (opencode pattern)
   - 系统提示词模板
   - 上下文注入
   - Few-shot examples

#### iota Module Structure (Process-Based)

```
iota/
├── cli/                     # Python CLI launcher
│   ├── __init__.py
│   ├── launcher.py         # Spawn Rust binary using subprocess
│   ├── config.py           # Configuration management
│   └── signals.py          # Signal forwarding (SIGINT, SIGTERM)
│
├── api/                     # Python HTTP API server
│   ├── __init__.py
│   ├── server.py           # FastAPI application
│   ├── routes/
│   │   ├── simulation.py   # /api/simulation/* endpoints
│   │   └── health.py       # /health endpoint
│   └── client.py           # HTTP client for Rust (httpx/aiohttp)
│
├── llm/                     # Python LLM service
│   ├── __init__.py
│   ├── server.py           # HTTP server for Rust callbacks
│   ├── openai_client.py    # OpenAI SDK integration
│   ├── anthropic_client.py # Anthropic SDK integration
│   └── streaming.py        # Streaming response handling
│
├── runtime/                 # Python simulation runtime
│   ├── coordinator/        # Simulation coordinator
│   ├── engines/            # Simulation engines
│   │   ├── environment.py
│   │   ├── user_state.py
│   │   └── behavior.py
│   └── decision/           # Decision engine
│
├── rust/                    # Rust binary (iota)
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs         # Entry point, HTTP server setup
│   │   ├── server/         # HTTP server (axum)
│   │   │   ├── mod.rs
│   │   │   ├── routes.rs   # API routes
│   │   │   └── handlers.rs # Request handlers
│   │   ├── core/           # Core runtime engine
│   │   │   ├── websocket/  # WebSocket manager
│   │   │   ├── session/    # Session manager
│   │   │   ├── logging/    # Log manager
│   │   │   └── evaluation/ # Evaluation engine
│   │   ├── client/         # HTTP client for Python LLM service
│   │   │   ├── mod.rs
│   │   │   └── llm.rs      # LLM client (reqwest)
│   │   └── models/         # Data models (serde)
│   │       ├── mod.rs
│   │       ├── session.rs
│   │       └── request.rs
│   └── tests/
│
└── config/                  # Configuration files
    ├── default.toml        # Default configuration
    └── schema.json         # JSON schema for validation
```

**模块说明**：

1. **Python CLI Launcher (`cli/`)**：
   - 使用 `subprocess.Popen()` 启动 Rust 二进制
   - 管理 Rust 进程生命周期
   - 转发信号到 Rust 进程

2. **Python HTTP API Server (`api/`)**：
   - FastAPI 应用，提供外部 REST API
   - 转发请求到 Rust HTTP 服务器
   - HTTP 客户端（httpx/aiohttp）与 Rust 通信

3. **Python LLM Service (`llm/`)**：
   - 独立 HTTP 服务器，接收 Rust 回调
   - OpenAI/Anthropic SDK 集成
   - 流式响应处理

4. **Python Simulation Runtime (`runtime/`)**：
   - 仿真协调器和引擎
   - 业务编排逻辑
   - 通过 HTTP 客户端与 Rust 通信

5. **Rust Binary (`rust/`)**：
   - 独立二进制，可独立运行
   - 内部 HTTP 服务器（axum）
   - 核心运行时引擎（WebSocket, Session, Logging, Evaluation）
   - HTTP 客户端（reqwest）回调 Python LLM 服务

#### Performance Optimization Strategy

**Rust for Hot Paths**：
- WebSocket I/O: 使用 `tokio` 异步运行时
- Session state: 使用 `dashmap` 并发哈希表
- Logging: 使用 `tracing` + `tracing-subscriber`
- Evaluation: 使用 `rayon` 并行计算
- HTTP Server: 使用 `axum` 高性能 web 框架

**Python for Flexibility**：
- LLM 调用: 使用成熟的 Python SDK (OpenAI, Anthropic)
- 数据分析: 使用 pandas, numpy
- 可视化: 使用 matplotlib, plotly
- 快速迭代: Python 的动态特性便于实验

**Process Communication Optimization**：
- 使用 HTTP/1.1 keep-alive 减少连接开销
- JSON 序列化使用 `serde_json`（Rust）和 `orjson`（Python）
- 可选：使用 MessagePack 替代 JSON 提升性能
- 异步 HTTP 客户端（httpx/aiohttp in Python, reqwest in Rust）

#### Build & Deployment (Process-Based)

**Development**：
```bash
# Build Rust binary
cd iota/rust
cargo build --release

# Binary location: iota/rust/target/release/iota

# Run Rust binary standalone (for testing)
./target/release/iota --port 9527

# Run Python CLI (spawns Rust binary)
cd iota
python -m cli.launcher --rust-binary ./rust/target/release/iota

# Run Python LLM service
python -m llm.server --port 8001

# Run Python API server
python -m api.server --port 8000
```

**Production**：
```bash
# Build Rust binary for production
cd iota/rust
cargo build --release --target x86_64-unknown-linux-musl

# Install Python package
cd iota
pip install -e .

# Run system (Python spawns Rust)
iota start --config config.toml

# Or run components separately:
# Terminal 1: Rust binary
./rust/target/release/iota --port 9527

# Terminal 2: Python LLM service
iota llm-service --port 8001

# Terminal 3: Python API server
iota api-server --port 8000
```

**Docker Deployment**：
```dockerfile
# Multi-stage build
FROM rust:1.75 AS rust-builder
WORKDIR /app
COPY iota/rust ./
RUN cargo build --release

FROM python:3.11-slim
WORKDIR /app

# Copy Rust binary
COPY --from=rust-builder /app/target/release/iota /usr/local/bin/iota

# Install Python dependencies
COPY iota/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python code
COPY iota/ ./

# Expose ports
EXPOSE 8000 8001 9527

# Start script (spawns Rust + Python services)
CMD ["python", "-m", "cli.launcher"]
```

**Key Points**：
- Rust 二进制独立编译，无需 Python 环境
- Python 包安装不需要 Rust 工具链
- 可以独立运行 Rust 二进制进行测试
- Docker 镜像包含 Rust 二进制和 Python 代码
- 进程间通信通过 HTTP，无需共享内存

#### HTTP/JSON-RPC API Interfaces

本节定义 Python 和 Rust 之间的 HTTP API 接口。

**Python → Rust API (Rust HTTP Server: 127.0.0.1:9527)**：

```typescript
// Health Check
GET /health
Response: 200 OK
Body: "OK"

// Create Session
POST /api/session/create
Request Body: {
  "config": {
    "scenario_type": "commute" | "leisure" | "business" | "emergency",
    "max_turns": number,
    "timeout": number
  }
}
Response Body: {
  "session_id": string,
  "status": "created"
}

// Execute Simulation Turn
POST /api/session/{session_id}/execute
Request Body: {
  "environment_data": EnvironmentData,
  "user_state_data": UserStateData,
  "behavior_data": UserBehaviorData
}
Response Body: {
  "execution_result": {
    "status": "success" | "error",
    "response": SystemResponse,
    "evaluation": EvaluationResult
  }
}

// Get Session Status
GET /api/session/{session_id}/status
Response Body: {
  "session_id": string,
  "status": "running" | "completed" | "aborted",
  "turn_count": number,
  "created_at": string,
  "updated_at": string
}

// Connect WebSocket to Target System
POST /api/websocket/connect
Request Body: {
  "url": string,
  "headers": Record<string, string>
}
Response Body: {
  "connection_id": string,
  "status": "connected"
}

// Send WebSocket Message
POST /api/websocket/{connection_id}/send
Request Body: {
  "message": any
}
Response Body: {
  "status": "sent",
  "response": any
}

// Compute Evaluation
POST /api/evaluation/compute
Request Body: {
  "behavior": UserBehaviorData,
  "response": SystemResponse
}
Response Body: {
  "evaluation": EvaluationResult
}
```

**Rust → Python API (Python LLM Service: 127.0.0.1:8001)**：

```typescript
// Generate LLM Response
POST /llm/generate
Request Body: {
  "prompt": string,
  "model": "gpt-4" | "claude-3-opus",
  "temperature": number,
  "max_tokens": number,
  "stream": boolean
}
Response Body: {
  "text": string,
  "usage": {
    "prompt_tokens": number,
    "completion_tokens": number,
    "total_tokens": number
  }
}

// Analyze System Response
POST /llm/analyze
Request Body: {
  "response": SystemResponse,
  "context": SessionContext
}
Response Body: {
  "analysis": {
    "intent": string,
    "sentiment": string,
    "key_points": string[]
  }
}

// Generate Environment Data
POST /llm/environment/generate
Request Body: {
  "scenario": ScenarioState,
  "context": SessionContext
}
Response Body: {
  "environment": EnvironmentData
}

// Generate User State Data
POST /llm/user-state/generate
Request Body: {
  "scenario": ScenarioState,
  "environment": EnvironmentData,
  "context": SessionContext
}
Response Body: {
  "user_state": UserStateData
}

// Generate User Behavior
POST /llm/behavior/generate
Request Body: {
  "environment": EnvironmentData,
  "user_state": UserStateData,
  "context": SessionContext
}
Response Body: {
  "behavior": UserBehaviorData
}
```

**Data Serialization Format**：

所有 HTTP 请求和响应使用 JSON 格式：
- Content-Type: `application/json`
- 使用 `serde_json`（Rust）和 `orjson`（Python）进行序列化
- 可选：使用 `application/msgpack` 提升性能

**Error Handling**：

```typescript
// Error Response Format
{
  "error": {
    "code": string,  // "SESSION_NOT_FOUND", "WEBSOCKET_ERROR", etc.
    "message": string,
    "details": any,
    "retryable": boolean
  }
}

// HTTP Status Codes
200 OK: Success
400 Bad Request: Invalid request data
404 Not Found: Resource not found
500 Internal Server Error: Server error
503 Service Unavailable: Service temporarily unavailable
```

#### Process-Based Architecture Benefits

相比 FFI/PyO3 方案，进程间通信架构具有以下优势：

**1. 简化开发和部署**：
- 无需 PyO3 绑定代码和复杂的 FFI 接口
- Rust 二进制独立编译，无需 maturin 构建 Python wheel
- Python 包安装不需要 Rust 工具链
- 开发者可以独立测试 Rust 和 Python 组件

**2. 进程隔离和稳定性**：
- Python 和 Rust 运行在独立进程中，互不干扰
- Rust 进程崩溃不会影响 Python 进程（反之亦然）
- 可以独立重启任一进程
- 更容易调试和监控

**3. 语言边界清晰**：
- 使用标准 HTTP/JSON 协议，无需处理跨语言内存管理
- 数据序列化格式明确（JSON）
- 错误处理通过 HTTP 状态码和 JSON 响应
- 无需处理 Python GIL 和 Rust 异步运行时的交互

**4. 灵活部署**：
- 可以将 Rust 和 Python 部署在不同机器上
- 可以水平扩展 Rust 实例（多个 iota 进程）
- 可以使用负载均衡器分发请求
- 支持容器化部署（Docker, Kubernetes）

**5. 参考成熟实践**：
- 遵循 codex 项目的进程间通信模式
- 使用标准 HTTP 协议，易于理解和维护
- 可以使用现有的 HTTP 工具进行测试和监控（curl, Postman, etc.）

**Trade-offs**：
- HTTP 通信有一定开销（相比 FFI 直接调用）
- 需要序列化/反序列化数据（JSON）
- 需要管理多个进程的生命周期

**结论**：对于本系统，进程间通信的优势（简化开发、进程隔离、灵活部署）远大于性能开销，是更合适的架构选择。

### 核心架构设计

系统采用分层架构，各层职责明确：

**仿真协调器（Simulation Coordinator）**作为系统的中枢大脑，负责：
- 协调整个仿真流程
- 调用LLM理解当前状态
- 决定是否继续下一轮仿真
- 管理各模块的执行顺序

**会话管理器（Session Manager）**作为状态存储，负责：
- 纯粹的状态管理
- 不调用LLM
- 不包含业务逻辑

**决策引擎（Decision Engine）**负责生成具体决策：
- 汇总仿真引擎输出
- 调用LLM生成发送给目标系统的决策
- 不负责元决策（是否继续循环）

**执行引擎（ExecutionEngine）**负责执行决策：
- 管理WebSocket通信
- 调用LLM分析目标系统响应
- 不负责流程控制

这种设计实现了关注点分离：状态、协调、决策、执行各司其职，每个模块的LLM调用都有明确的目的。

## Architecture

### 系统架构概览

系统采用分层架构，严格遵循 requirements.md 中定义的四层结构和五条关键链路：

#### 四层架构

1. **干预层（Intervention Layer）**：
   - 仿真场景初始化（Scenario Initialization）
   - 突发噪声（Sudden Noise）

2. **输入支撑模块（Input Support Modules）**：
   - 环境感知仿真（Environment Perception Simulation）
   - 用户状态仿真（User State Simulation）
   - 长短期记忆模块（Long-Short Term Memory Module）

3. **上层决策编排层（Upper Decision Orchestration Layer）**：
   - 仿真编排决策器（Simulation Orchestration Decision Maker）
   - 内部能力：情景理解&推理、需求解析&挖掘、长期规划&短期策略、用户意图推演

4. **下层执行反馈层（Lower Execution Feedback Layer）**：
   - 用户行为仿真（User Behavior Simulation）
   - 目标系统调用与响应解析（Target System Call and Response Parsing）
   - 评测量化（Evaluation and Quantification）

#### 五条关键链路

1. **仿真主链路（Main Simulation Chain）**：
   - 场景初始化 → 输入支撑模块 → 编排决策 → 行为执行 → 目标系统调用 → 评测量化

2. **环境 & 用户反馈链路（Environment & User Feedback Chain）**：
   - 目标系统响应 → 环境感知仿真
   - 目标系统响应 → 用户状态仿真

3. **量化评估链路（Quantitative Evaluation Chain）**：
   - 用户行为 → 评测量化
   - 目标系统响应 → 评测量化

4. **记忆更新链路（Memory Update Chain）**：
   - 用户行为 → 长短期记忆
   - 评测量化 → 长短期记忆

5. **噪声扰动链路（Noise Disturbance Chain）**：
   - 突发噪声 → 环境感知仿真
   - 突发噪声 → 用户状态仿真

#### 技术实现层

在四层架构之上，系统还包含以下技术支撑层：

- **API层**：HTTP REST API，提供仿真控制接口
- **会话管理层**：管理仿真会话状态和上下文（纯状态管理）
- **日志层**：记录所有交互数据
- **LLM服务层**：为Python业务逻辑提供LLM能力

```mermaid
graph TB
    subgraph Python进程_业务逻辑和LLM
        CLI[CLI启动器<br/>Python]
        
        subgraph 干预层_Python
            SceneInit[仿真场景初始化<br/>Python]
            Noise[突发噪声<br/>Python]
        end
        
        subgraph 输入支撑模块_Python
            Env[环境感知仿真<br/>Python]
            UserState[用户状态仿真<br/>Python]
            Memory[长短期记忆模块<br/>Python]
        end
        
        subgraph 上层决策编排层_Python
            Orchestrator[仿真编排决策器<br/>Python<br/><br/>内部能力：<br/>情景理解&推理<br/>需求解析&挖掘<br/>长期规划&短期策略<br/>用户意图推演<br/><br/>包含：继续/结束判断]
        end
        
        subgraph 下层执行反馈层_Python
            Behavior[用户行为仿真<br/>Python]
        end
        
        subgraph LLM服务_Python
            OpenAI[OpenAI SDK]
            Anthropic[Anthropic SDK]
        end
    end
    
    subgraph Rust进程_iota性能关键组件
        subgraph 下层执行反馈层_Rust
            ServiceCall[目标系统调用与响应解析<br/>Rust WebSocket管理]
            Eval[评测量化<br/>Rust 并行计算]
        end
        
        subgraph 技术支撑层_Rust
            SessionMgr[会话管理器<br/>Rust dashmap]
            LogManager[日志管理器<br/>Rust tracing]
        end
        
        ContextStore[(会话上下文<br/>Rust)]
    end
    
    subgraph 外部系统
        TargetSystem[目标系统服务<br/>智能座舱系统]
    end
    
    %% Python启动Rust
    CLI -->|subprocess启动| ServiceCall
    
    %% 主链路（红色 #d9485f）
    CLI -->|01 仿真请求| Orchestrator
    Orchestrator -->|02 启动初始化| SceneInit
    SceneInit -->|03 初始化环境| Env
    SceneInit -->|04 初始化用户| UserState
    SceneInit -->|05 初始化记忆| Memory
    
    Env -->|06 环境上下文| Orchestrator
    UserState -->|07 用户上下文| Orchestrator
    Memory -->|08 记忆上下文| Orchestrator
    
    Orchestrator -->|09 策略意图| Behavior
    Behavior -->|10 行为请求 HTTP| ServiceCall
    ServiceCall -->|11 WebSocket请求| TargetSystem
    TargetSystem -->|12 返回响应| ServiceCall
    ServiceCall -->|13 结构化响应 HTTP| Orchestrator
    
    %% 环境&用户反馈链路（蓝色虚线 #2563eb）
    ServiceCall -.->|14 反馈环境 HTTP| Env
    ServiceCall -.->|15 反馈用户 HTTP| UserState
    
    %% 量化评估链路（蓝色虚线 #2563eb）
    Behavior -.->|16 行为评估 HTTP| Eval
    ServiceCall -.->|17 响应评估| Eval
    
    %% 记忆更新链路（蓝色虚线 #2563eb）
    Behavior -.->|18 行为写回| Memory
    Eval -.->|19 评估写回 HTTP| Memory
    
    %% 噪声扰动链路（蓝色虚线 #2563eb）
    Noise -.->|20 噪声入环境| Env
    Noise -.->|21 噪声入用户| UserState
    
    %% 评估回编排（红色 #d9485f）
    Eval -->|22 评估结果 HTTP| Orchestrator
    
    %% Orchestrator内部判断是否继续（红色 #d9485f）
    Orchestrator -->|23 判断：继续下一轮| Env
    Orchestrator -->|24 判断：结束会话| CLI
    
    %% 技术支撑（蓝色虚线 #2563eb）
    Orchestrator <-.->|状态管理 HTTP| SessionMgr
    SessionMgr <-.->|存储| ContextStore
    Orchestrator -.->|异步日志 HTTP| LogManager
    
    %% LLM调用（紫色虚线 #9c27b0，加粗表示调用LLM）
    Orchestrator -.->|LLM调用| OpenAI
    Orchestrator -.->|LLM调用| Anthropic
    Env -.->|LLM调用| OpenAI
    Env -.->|LLM调用| Anthropic
    UserState -.->|LLM调用| OpenAI
    UserState -.->|LLM调用| Anthropic
    Behavior -.->|LLM调用| OpenAI
    Behavior -.->|LLM调用| Anthropic
    
    %% Python组件 - 浅蓝色背景 #e3f2fd
    style CLI fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style SceneInit fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style Noise fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style Memory fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style Behavior fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style OpenAI fill:#e3f2fd,stroke:#1976d2,stroke-width:1px
    style Anthropic fill:#e3f2fd,stroke:#1976d2,stroke-width:1px
    
    %% Rust组件 - 浅橙色背景 #ffe0b2
    style ServiceCall fill:#ffe0b2,stroke:#f57c00,stroke-width:2px
    style Eval fill:#ffe0b2,stroke:#f57c00,stroke-width:2px
    style SessionMgr fill:#ffe0b2,stroke:#f57c00,stroke-width:2px
    style LogManager fill:#ffe0b2,stroke:#f57c00,stroke-width:2px
    style ContextStore fill:#ffe0b2,stroke:#f57c00,stroke-width:2px
    
    %% 调用LLM的组件 - 紫色加粗边框 #9c27b0
    style Orchestrator fill:#e3f2fd,stroke:#9c27b0,stroke-width:4px
    style Env fill:#e3f2fd,stroke:#9c27b0,stroke-width:4px
    style UserState fill:#e3f2fd,stroke:#9c27b0,stroke-width:4px
    
    %% 外部系统 - 浅红色
    style TargetSystem fill:#ffcdd2,stroke:#c62828,stroke-width:2px
    
    linkStyle 1,2,3,4,5,6,7,8,9,10,11,12,21,22,23 stroke:#d9485f,stroke-width:2.5px
    linkStyle 13,14,15,16,17,18,19,20,24,25,26 stroke:#2563eb,stroke-width:2px,stroke-dasharray:5
    linkStyle 27,28,29,30,31,32,33,34 stroke:#9c27b0,stroke-width:3px,stroke-dasharray:5
```

**架构说明**：

**颜色标注**：
- **浅蓝色背景 (#e3f2fd)**：Python 进程（业务逻辑 + LLM服务）
- **浅橙色背景 (#ffe0b2)**：Rust 进程（性能关键组件）
- **紫色加粗边框 (#9c27b0, 4px)**：调用LLM的组件（Orchestrator, Env, UserState）
- **紫色虚线**：LLM调用链路

**关键设计决策**：
1. **去掉"车辆响应仿真"**：目标系统的响应直接由ServiceCall解析后反馈给Orchestrator和环境/用户模块
2. **"是否继续下一轮"在Orchestrator内部**：不是独立节点，是决策器的内部判断逻辑
3. **Python负责业务逻辑**：
   - 干预层：仿真场景初始化、突发噪声
   - 输入支撑模块：环境感知仿真、用户状态仿真、长短期记忆
   - 上层决策编排层：仿真编排决策器
   - 下层执行反馈层：用户行为仿真
   - LLM服务：直接调用OpenAI/Anthropic SDK
4. **Rust负责性能关键部分**：
   - WebSocket连接管理（高并发、低延迟）
   - 会话状态管理（并发读写）
   - 日志系统（异步I/O）
   - 评测量化计算（CPU密集型、并行计算）
5. **Python-Rust通信**：
   - Python通过HTTP调用Rust的WebSocket管理、会话管理、日志、评测服务
   - 频率相对较低，主要在关键性能点切换

**完整流程说明（按 requirements.md 定义）：**

**主链路（仿真主链路 - 红色实线 #d9485f）**：
1. **仿真请求进入**：HTTP API 接收仿真请求，传递给仿真编排决策器
2. **启动场景初始化**：编排决策器基于业务配置启动仿真场景初始化（干预层）
3-5. **初始化输入支撑模块**：场景初始化将结果分别送入环境感知仿真、用户状态仿真和长短期记忆模块
6-8. **上下文汇聚**：三个输入支撑模块将各自的上下文提供给编排决策器
9. **策略意图生成**：编排决策器（调用LLM）产出当前轮策略与意图，提供给用户行为仿真
10. **行为生成**：用户行为仿真（调用LLM）基于策略生成具体行为表达
11-12. **目标系统交互**：目标系统调用与响应解析向目标系统发送请求并接收响应（调用LLM分析）
13. **响应回编排**：结构化响应返回给编排决策器
14. **评测量化**：目标系统响应送入评测量化模块
22. **评估结果回编排**：评估结果返回给编排决策器
23-24. **循环控制**：编排决策器（调用LLM）基于响应、评估、记忆和轮次约束决定继续或结束

**环境 & 用户反馈链路（蓝色虚线 #2563eb）**：
14. **反馈环境**：目标系统响应 → 环境感知仿真（反馈系统状态变化）
15. **反馈用户**：目标系统响应 → 用户状态仿真（反馈用户体验变化）

**量化评估链路（蓝色虚线 #2563eb）**：
16. **行为评估**：用户行为仿真 → 评测量化（评估行为合理性）
17. **响应评估**：目标系统响应 → 评测量化（评估响应准确性）

**记忆更新链路（蓝色虚线 #2563eb）**：
18. **行为写回**：用户行为仿真 → 长短期记忆（沉淀交互结果）
19. **评估写回**：评测量化 → 长短期记忆（沉淀评估结果）

**噪声扰动链路（蓝色虚线 #2563eb）**：
20. **噪声入环境**：突发噪声 → 环境感知仿真（注入环境扰动）
21. **噪声入用户**：突发噪声 → 用户状态仿真（注入用户扰动）

**技术支撑（蓝色虚线 #2563eb）**：
23-24. **状态管理与存储**：会话管理器管理状态并存储到上下文
25. **异步日志**：日志管理器异步记录，不阻塞主流程
26-30. **LLM服务调用**：为编排器、环境仿真、用户状态仿真、行为仿真和服务调用提供智能能力

**关键设计点：**
- 严格遵循 requirements.md 定义的四层架构：干预层、输入支撑模块、上层决策编排层、下层执行反馈层
- 实现五条关键链路：主链路、环境&用户反馈链路、量化评估链路、记忆更新链路、噪声扰动链路
- 编排决策器作为唯一的上层决策组件，按需拉取输入支撑模块的上下文
- 编排决策器内部具备情景理解&推理、需求解析&挖掘、长期规划&短期策略、用户意图推演四类能力
- 下层执行反馈层负责动作落地、目标系统通信、响应解析和评测量化，但不决定是否进入下一轮
- 环境感知仿真和用户状态仿真并行执行，互不依赖
- 所有需要智能能力的模块（编排器、环境仿真、用户状态仿真、行为仿真、服务调用）都调用LLM服务
- 会话管理器只负责状态存储，不调用LLM
- 日志记录异步进行，不阻塞主决策循环
- 上下文保存历史响应，每轮仿真基于前一轮响应
- 反馈链路确保目标系统响应能够影响环境和用户状态，形成闭环
- 记忆更新链路确保交互结果和评估结果沉淀到长短期记忆，体现连续性
- 噪声扰动链路作为干预层能力，可选地注入扰动到输入支撑模块

### 架构设计原则

1. **严格分层**：遵循四层架构
   - 干预层：场景初始化和噪声注入
   - 输入支撑模块：环境、用户状态、记忆
   - 上层决策编排层：唯一的全局编排者
   - 下层执行反馈层：行为、服务调用、评测
   
2. **关注点分离**：每个模块职责单一
   - 编排决策器：全局编排、理解状态、决定下一步
   - 会话管理器：纯状态存储
   - 输入支撑模块：提供环境、用户、记忆上下文
   - 执行反馈层：动作落地、通信、响应解析、评测
   
3. **链路清晰**：五条链路各司其职
   - 主链路：从初始化到评测的完整流程
   - 反馈链路：目标系统响应影响环境和用户
   - 评估链路：行为和响应送入评测
   - 记忆链路：交互和评估沉淀到记忆
   - 噪声链路：扰动注入到输入支撑
   
4. **按需拉取**：编排决策器按需从输入支撑模块拉取上下文，而非被动等待固定顺序的推送
   
5. **LLM驱动**：编排器、环境仿真、用户状态仿真、行为仿真和服务调用都通过LLM服务获得智能能力
   
6. **封装性**：WebSocket连接管理完全封装在目标系统调用与响应解析组件内部
   
7. **并行优化**：环境感知仿真和用户状态仿真并行执行，互不依赖
   
8. **可测试性**：各模块独立可测，支持模拟和依赖注入
   
9. **可扩展性**：通过配置和插件机制支持新场景和规则
   
10. **职责边界**：下层执行反馈层不得决定是否进入下一轮，该决策权属于上层编排决策器

## Components and Interfaces

### 仿真引擎执行顺序

仿真引擎的执行遵循以下顺序和依赖关系：

```mermaid
graph LR
    Start[开始仿真轮次] --> Parallel{并行执行}
    
    Parallel --> ExtEnv[舱外环境仿真引擎<br/>调用LLM]
    Parallel --> IntEnv[舱内环境仿真引擎<br/>调用LLM]
    
    ExtEnv --> Wait[等待两者完成]
    IntEnv --> Wait
    
    Wait --> UserBehavior[用户行为仿真引擎<br/>依赖舱内外环境<br/>调用LLM]
    
    UserBehavior --> Decision[决策引擎<br/>调用LLM]
    
    Decision --> ExecutionEngine[执行引擎<br/>调用LLM分析响应]
    
    style ExtEnv fill:#e8f5e9
    style IntEnv fill:#e8f5e9
    style UserBehavior fill:#fff3e0
    style Decision fill:#ffe0b2
    style ExecutionEngine fill:#fce4ec
```

**关键点**：
1. 舱外和舱内仿真引擎并行执行，互不依赖
2. 用户行为仿真引擎必须等待舱外和舱内仿真完成后才能执行
3. 用户行为仿真需要舱外和舱内的环境数据作为输入
4. 所有仿真引擎、决策引擎和执行引擎都需要调用LLM服务

### 1. 仿真场景初始化 (Scenario Initialization)

**对应 requirements.md**: `Requirement 1`

**所属层级**: 干预层（Intervention Layer）

**职责**：
- 作为仿真主链路的起点
- 基于业务配置建立清晰的初始场景
- 生成出行目的、起始点坐标、人员配置和场景配置
- 将初始化结果提供给输入支撑模块

**接口**：

```typescript
interface ScenarioInitializer {
  // 初始化场景
  initialize(businessConfig: BusinessConfig): ScenarioState;
}

interface BusinessConfig {
  scenarioType: 'commute' | 'leisure' | 'business' | 'emergency';
  userProfile?: UserProfile;
  preferences?: Record<string, any>;
}

interface ScenarioState {
  // 出行目的
  tripPurpose: string;
  
  // 起始点坐标
  startLocation: Coordinates;
  endLocation: Coordinates;
  
  // 人员配置
  participants: Participant[];
  
  // 场景配置
  sceneConfig: SceneConfig;
}

interface Coordinates {
  latitude: number;
  longitude: number;
  address?: string;
}

interface Participant {
  role: 'driver' | 'passenger' | 'rear_left' | 'rear_right';
  name: string;
  age: number;
  preferences?: Record<string, any>;
}

interface SceneConfig {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  trafficCondition: 'light' | 'moderate' | 'heavy';
  weatherCondition: string;
  duration?: number; // 预计行程时长（分钟）
}
```

### 2. 突发噪声 (Sudden Noise)

**对应 requirements.md**: `Requirement 2`

**所属层级**: 干预层（Intervention Layer）

**职责**：
- 在仿真过程中注入突发扰动
- 支持四类干预源：交通事故、热点事件、个人突发、生活&工作
- 通过噪声扰动链路影响环境感知仿真和用户状态仿真
- 作为可选能力存在，不是主链路必经节点

**接口**：

```typescript
interface SuddenNoiseModule {
  // 注入噪声
  inject(noiseEvent: NoiseEvent): void;
  
  // 获取当前活跃的噪声
  getActiveNoises(): NoiseEvent[];
  
  // 清除噪声
  clear(noiseId: string): void;
}

interface NoiseEvent {
  id: string;
  type: 'traffic_accident' | 'hot_event' | 'personal_emergency' | 'life_work';
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp: Date;
  duration?: number; // 持续时间（秒）
  
  // 影响范围
  affectsEnvironment: boolean;
  affectsUserState: boolean;
  
  // 具体影响
  environmentImpact?: {
    trafficDelay?: number;
    weatherChange?: string;
    roadConditionChange?: string;
  };
  
  userStateImpact?: {
    emotionChange?: string;
    urgencyLevel?: 'low' | 'medium' | 'high';
    attentionShift?: string;
  };
}
```

### 3. 环境感知仿真 (Environment Perception Simulation)

**对应 requirements.md**: `Requirement 3`

**所属层级**: 输入支撑模块（Input Support Modules）

**职责**：
- 统一模拟用户所处环境
- 覆盖舱外环境、交通参与者、舱内环境和车辆状态
- 基于场景初始化建立初始环境
- 接收目标系统响应反馈和噪声扰动
- 将环境上下文提供给用户状态仿真和编排决策器

**接口**：

```typescript
interface EnvironmentPerceptionSimulation {
  // 生成环境数据（调用LLM）
  generate(
    scenario: ScenarioState,
    context: SessionContext,
    llmService: LLMService
  ): Promise<EnvironmentData>;
  
  // 接收目标系统响应反馈
  receiveFeedback(serviceCallResult: ServiceCallResult): void;
  
  // 接收噪声扰动
  receiveNoise(noiseEvent: NoiseEvent): void;
}

interface EnvironmentData {
  // 舱外环境
  externalEnvironment: {
    weather: 'sunny' | 'rainy' | 'foggy' | 'snowy' | 'cloudy';
    temperature: number; // 摄氏度
    visibility: number; // 米
    roadCondition: 'dry' | 'wet' | 'icy' | 'snowy';
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  };
  
  // 交通参与者
  trafficParticipants: TrafficParticipant[];
  
  // 舱内环境
  internalEnvironment: {
    temperature: number; // 摄氏度
    humidity: number; // 百分比
    noiseLevel: number; // 分贝
    lightLevel: 'bright' | 'dim' | 'dark';
    airQuality: 'good' | 'moderate' | 'poor';
  };
  
  // 车辆状态
  vehicleState: {
    speed: number; // km/h
    fuelLevel: number; // 百分比
    batteryLevel?: number; // 百分比（电动车）
    engineStatus: 'on' | 'off' | 'idle';
    gearPosition: 'P' | 'R' | 'N' | 'D';
    doors: DoorStatus[];
    windows: WindowStatus[];
    seatbelt: SeatbeltStatus[];
  };
}

interface TrafficParticipant {
  type: 'vehicle' | 'pedestrian' | 'cyclist' | 'obstacle';
  distance: number; // 米
  direction: 'front' | 'back' | 'left' | 'right';
  speed?: number; // km/h
  behavior?: 'normal' | 'aggressive' | 'cautious';
}

interface DoorStatus {
  position: 'driver' | 'passenger' | 'rear_left' | 'rear_right' | 'trunk';
  status: 'open' | 'closed' | 'locked';
}

interface WindowStatus {
  position: 'driver' | 'passenger' | 'rear_left' | 'rear_right';
  openPercentage: number; // 0-100
}

interface SeatbeltStatus {
  position: 'driver' | 'passenger' | 'rear_left' | 'rear_right';
  fastened: boolean;
}
```

### 4. 用户状态仿真 (User State Simulation)

**对应 requirements.md**: `Requirement 4`

**所属层级**: 输入支撑模块（Input Support Modules）

**职责**：
- 持续刻画用户自身状态
- 覆盖用户人设、知识背景、身体状态和情绪状态
- 基于场景初始化建立初始用户状态
- 接收环境变化、目标系统响应反馈和噪声扰动
- 将用户状态上下文提供给编排决策器

**接口**：

```typescript
interface UserStateSimulation {
  // 生成用户状态数据（调用LLM）
  generate(
    scenario: ScenarioState,
    environment: EnvironmentData,
    context: SessionContext,
    llmService: LLMService
  ): Promise<UserStateData>;
  
  // 接收环境变化
  receiveEnvironmentUpdate(environment: EnvironmentData): void;
  
  // 接收目标系统响应反馈
  receiveFeedback(serviceCallResult: ServiceCallResult): void;
  
  // 接收噪声扰动
  receiveNoise(noiseEvent: NoiseEvent): void;
}

interface UserStateData {
  // 用户人设
  persona: {
    name: string;
    age: number;
    gender: 'male' | 'female' | 'other';
    occupation: string;
    personality: string[];
    communicationStyle: 'formal' | 'casual' | 'technical';
  };
  
  // 知识背景
  knowledgeBackground: {
    techSavviness: 'low' | 'medium' | 'high';
    vehicleExperience: 'novice' | 'intermediate' | 'expert';
    preferredLanguage: string;
    familiarFeatures: string[];
  };
  
  // 身体状态
  physicalState: {
    fatigue: 'low' | 'medium' | 'high';
    comfort: 'comfortable' | 'neutral' | 'uncomfortable';
    healthConditions?: string[];
    mobility: 'full' | 'limited';
  };
  
  // 情绪状态
  emotionalState: {
    mood: 'happy' | 'neutral' | 'stressed' | 'angry' | 'sad';
    urgency: 'low' | 'medium' | 'high';
    patience: 'low' | 'medium' | 'high';
    satisfaction: number; // 0-100
    recentEmotions: string[];
  };
}
```

### 5. 长短期记忆模块 (Long-Short Term Memory Module)

**对应 requirements.md**: `Requirement 5`

**所属层级**: 输入支撑模块（Input Support Modules）

**职责**：
- 保留用户长期偏好和当前上下文
- 维护个性化偏好、实时上下文窗口和知识库
- 基于初始场景载入初始记忆
- 接收用户行为和评估结果的更新
- 向编排决策器提供记忆上下文

**接口**：

```typescript
interface LongShortTermMemoryModule {
  // 初始化记忆
  initialize(scenario: ScenarioState): void;
  
  // 获取记忆上下文
  getContext(): MemoryContext;
  
  // 更新记忆（来自用户行为）
  updateFromBehavior(behavior: UserBehaviorData): void;
  
  // 更新记忆（来自评估结果）
  updateFromEvaluation(evaluation: EvaluationData): void;
}

interface MemoryContext {
  // 个性化偏好
  personalizedPreferences: {
    temperature: number;
    musicGenre: string[];
    seatPosition: Record<string, any>;
    navigationStyle: 'fastest' | 'shortest' | 'scenic';
    voiceVolume: number;
    frequentDestinations: Coordinates[];
  };
  
  // 实时上下文窗口
  realtimeContext: {
    currentTask?: string;
    taskSteps?: string[];
    pendingConfirmations?: string[];
    recentInteractions: Interaction[];
    conversationHistory: string[];
  };
  
  // 知识库
  knowledgeBase: {
    learnedPreferences: Record<string, any>;
    commonPatterns: string[];
    errorHistory: string[];
    successfulInteractions: string[];
  };
}

interface Interaction {
  timestamp: Date;
  userAction: string;
  systemResponse: string;
  outcome: 'success' | 'failure' | 'partial';
}
```

### 6. 仿真编排决策器 (Simulation Orchestration Decision Maker)

### 6. 仿真编排决策器 (Simulation Orchestration Decision Maker)

**对应 requirements.md**: `Requirement 6, Requirement 10`

**所属层级**: 上层决策编排层（Upper Decision Orchestration Layer）

**职责**：
- 作为系统的唯一上层决策组件和全局编排者
- 按需从输入支撑模块拉取当前所需上下文
- 内部具备情景理解&推理、需求解析&挖掘、长期规划&短期策略、用户意图推演四类能力
- 产出当前轮的策略与意图，提供给用户行为仿真
- 基于目标系统响应、评测结果、记忆状态和轮次约束决定继续下一轮还是结束会话
- 不直接调用目标系统服务，不直接产出评测量化结果

**接口**：

```typescript
interface SimulationOrchestrationDecisionMaker {
  // 执行单轮仿真（调用LLM）
  executeTurn(sessionId: string): Promise<TurnResult>;
  
  // 持续执行直到结束（调用LLM）
  runUntilComplete(sessionId: string): Promise<SessionResult>;
  
  // 分析当前状态并决定下一步（调用LLM）
  analyzeAndDecide(
    session: Session,
    executionResult: ExecutionResult,
    evaluationResult: EvaluationData,
    llmService: LLMService
  ): Promise<OrchestrationDecision>;
  
  // 生成策略与意图（调用LLM，内部能力）
  generateStrategyAndIntent(
    environment: EnvironmentData,
    userState: UserStateData,
    memory: MemoryContext,
    llmService: LLMService
  ): Promise<StrategyIntent>;
}

interface OrchestrationDecision {
  // 是否继续下一轮
  shouldContinue: boolean;
  
  // 决策原因
  reason: 'final_decision' | 'max_turns' | 'user_stop' | 'error' | 'continue';
  
  // 会话状态更新
  sessionStatus: 'running' | 'completed' | 'aborted';
  
  // 上下文更新建议
  contextUpdates?: Partial<SessionContext>;
  
  // LLM的分析结果（内部能力体现）
  analysis?: {
    // 情景理解&推理
    situationUnderstanding: string;
    
    // 需求解析&挖掘
    needsAnalysis: string;
    
    // 长期规划&短期策略
    planningStrategy: string;
    
    // 用户意图推演
    intentInference: string;
    
    // 进度和异常
    currentProgress: string;
    nextStepSuggestion?: string;
    anomalies?: string[];
  };
}

interface StrategyIntent {
  // 当前轮策略
  strategy: {
    goal: string;
    approach: string;
    priority: 'high' | 'medium' | 'low';
  };
  
  // 用户意图
  intent: {
    type: 'query' | 'command' | 'confirmation' | 'clarification';
    content: string;
    parameters?: Record<string, any>;
  };
  
  // 预期结果
  expectedOutcome: string;
}

interface TurnResult {
  turnId: string;
  success: boolean;
  environment: EnvironmentData;
  userState: UserStateData;
  memory: MemoryContext;
  strategyIntent: StrategyIntent;
  userBehavior: UserBehaviorData;
  serviceCallResult: ServiceCallResult;
  evaluation: EvaluationData;
}

interface SessionResult {
  sessionId: string;
  status: 'completed' | 'aborted';
  totalTurns: number;
  finalDecision: boolean;
  summary?: string; // LLM生成的会话总结
}
```

### 7. 用户行为仿真 (User Behavior Simulation)

**对应 requirements.md**: `Requirement 7`

**所属层级**: 下层执行反馈层（Lower Execution Feedback Layer）

**职责**：
- 把上层编排决策转成可执行的交互动作
- 支持语音（主要）、按键和触屏三类明确行为形式
- 为手势保留扩展能力
- 将行为结果提供给目标系统调用、评测量化和长短期记忆

**接口**：

```typescript
interface UserBehaviorSimulation {
  // 生成用户行为（调用LLM）
  generate(
    strategyIntent: StrategyIntent,
    environment: EnvironmentData,
    userState: UserStateData,
    llmService: LLMService
  ): Promise<UserBehaviorData>;
}

interface UserBehaviorData {
  // 行为类型
  behaviorType: 'voice_command' | 'button_press' | 'touchscreen' | 'gesture';
  
  // 行为详情
  details: {
    // 意图
    intent: string;
    
    // 槽位
    slots: Record<string, any>;
    
    // 语音内容（如果是语音）
    voiceContent?: string;
    
    // 按键/触屏位置（如果是按键或触屏）
    location?: {
      x: number;
      y: number;
      target: string;
    };
    
    // 手势类型（如果是手势，待确认能力）
    gestureType?: 'swipe' | 'tap' | 'pinch' | 'rotate';
  };
  
  // 是否为最终行为
  isFinal: boolean;
  
  // 时间戳
  timestamp: Date;
}
```

### 8. 目标系统调用与响应解析 (Target System Call and Response Parsing)

**对应 requirements.md**: `Requirement 8`

**所属层级**: 下层执行反馈层（Lower Execution Feedback Layer）

**职责**：
- 向目标系统服务发送请求并接收响应
- 输出结构化执行结果，包含响应状态、响应内容和完成标记
- 将结构化响应提供给仿真编排决策器
- 通过反馈链路将响应提供给环境感知仿真和用户状态仿真
- 通过评估链路将响应提供给评测量化
- 调用LLM分析响应
- 内部管理WebSocket连接

**接口**：

```typescript
interface TargetSystemCallAndResponseParsing {
  // 执行服务调用（调用LLM分析响应）
  execute(
    userBehavior: UserBehaviorData,
    environment: EnvironmentData,
    llmService: LLMService
  ): Promise<ServiceCallResult>;
  
  // 关闭连接（会话结束时调用）
  close(): Promise<void>;
}

interface ServiceCallResult {
  success: boolean;
  
  // 结构化响应（必需字段）
  response?: {
    // 响应状态
    status: 'success' | 'failure' | 'pending' | 'error';
    
    // 响应内容
    message: string;
    data?: any;
    
    // 完成标记
    finalDecision: boolean;
    
    // 额外信息
    requiresUserAction: boolean;
    suggestedNextAction?: string;
  };
  
  error?: ExecutionError;
  
  // LLM分析结果
  analysis?: {
    responseType: string;
    keyInformation: string[];
    anomalies?: string[];
  };
}

interface ExecutionError {
  code: string;
  message: string;
  retryable: boolean;
}
```

**内部组件**：

```typescript
// WebSocket连接管理器（内部组件）
class WebSocketManager {
  private connection: WebSocket | null;
  private config: WebSocketConfig;
  private reconnectAttempts: number;
  
  // 建立连接
  async connect(): Promise<void>;
  
  // 发送请求
  async sendRequest(request: any): Promise<void>;
  
  // 接收响应
  async receiveResponse(): Promise<any>;
  
  // 重连
  private async reconnect(): Promise<void>;
  
  // 关闭连接
  async close(): Promise<void>;
}

interface WebSocketConfig {
  url: string;
  port: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  timeout: number;
  heartbeatInterval: number;
}
```

### 9. 评测量化 (Evaluation and Quantification)

**对应 requirements.md**: `Requirement 9`

**所属层级**: 下层执行反馈层（Lower Execution Feedback Layer）

**职责**：
- 把执行结果转成可度量指标
- 覆盖用户行为合理性、目标系统响应准确性、场景覆盖率和响应实时性四个维度
- 以用户行为仿真和目标系统调用与响应解析的输出为输入
- 通过记忆更新链路回传给长短期记忆模块
- 位于下层执行反馈层中的评测节点

**接口**：

```typescript
interface EvaluationAndQuantification {
  // 评估
  evaluate(
    userBehavior: UserBehaviorData,
    serviceCallResult: ServiceCallResult,
    environment: EnvironmentData,
    userState: UserStateData
  ): Promise<EvaluationData>;
}

interface EvaluationData {
  // 用户行为合理性
  behaviorReasonableness: {
    score: number; // 0-100
    factors: {
      contextAppropriate: boolean;
      timingAppropriate: boolean;
      contentClear: boolean;
    };
    issues?: string[];
  };
  
  // 目标系统响应准确性
  responseAccuracy: {
    score: number; // 0-100
    factors: {
      intentMatched: boolean;
      actionCompleted: boolean;
      feedbackProvided: boolean;
    };
    issues?: string[];
  };
  
  // 场景覆盖率
  scenarioCoverage: {
    score: number; // 0-100
    coveredScenarios: string[];
    uncoveredScenarios: string[];
    totalScenarios: number;
  };
  
  // 响应实时性
  responseTimeliness: {
    score: number; // 0-100
    metrics: {
      behaviorToCallLatency: number; // 毫秒
      callToResponseLatency: number; // 毫秒
      totalLatency: number; // 毫秒
    };
    thresholds: {
      acceptable: number;
      good: number;
      excellent: number;
    };
  };
  
  // 综合评分
  overallScore: number; // 0-100
  
  // 时间戳
  timestamp: Date;
}
```

### 10. 仿真会话管理器 (Simulation Session Manager)

**职责**：
- 纯粹的状态管理器
- 创建和管理仿真会话
- 维护会话状态和上下文
- 不包含业务逻辑，不调用LLM

**接口**：

```typescript
interface SimulationSessionManager {
  // 创建新会话
  createSession(config: SessionConfig): Session;
  
  // 获取会话
  getSession(sessionId: string): Session | null;
  
  // 更新会话状态
  updateSessionStatus(sessionId: string, status: Session['status']): void;
  
  // 更新会话上下文
  updateContext(sessionId: string, updates: Partial<SessionContext>): void;
  
  // 保存目标系统响应到上下文
  saveResponse(sessionId: string, response: SystemResponse): void;
  
  // 增加轮次计数
  incrementTurnCount(sessionId: string): number;
  
  // 关闭会话
  closeSession(sessionId: string): void;
}

interface SessionConfig {
  scenarioType: string;
  initialState: ScenarioState;
  maxTurns: number;
  websocketConfig: WebSocketConfig;
}

interface Session {
  id: string;
  status: 'running' | 'completed' | 'aborted';
  turnCount: number;
  maxTurns: number;
  context: SessionContext;
  startTime: Date;
  endTime?: Date;
}

interface SessionContext {
  currentTask?: string;
  taskSteps?: string[];
  pendingConfirmations?: string[];
  previousResponses: SystemResponse[];
}
```

### 3. 舱外环境仿真引擎 (ExternalEnvironmentEngine)

**职责**：
- 根据场景配置生成舱外环境数据
- 模拟天气、温度、能见度、路况、周围物体
- 调用LLM服务生成合理的环境变化

**接口**：

```typescript
interface ExternalEnvironmentEngine {
  // 生成舱外环境数据（调用LLM）
  generate(
    scenario: ScenarioState, 
    context: SessionContext,
    llmService: LLMService
  ): Promise<ExternalEnvironmentData>;
}

interface ExternalEnvironmentData {
  module: 'external_environment';
  data: {
    weather: 'sunny' | 'rainy' | 'foggy' | 'snowy' | 'cloudy';
    temperature: number; // 摄氏度
    visibility: number; // 米
    roadCondition: 'dry' | 'wet' | 'icy' | 'snowy';
    surroundingObjects: SurroundingObject[];
  };
}

interface SurroundingObject {
  type: 'vehicle' | 'pedestrian' | 'obstacle' | 'traffic_sign';
  distance: number; // 米
  direction: 'front' | 'back' | 'left' | 'right';
}
```

### 4. 舱内环境仿真模块 (Internal Environment Module)

**对应 requirements.md**: `Internal_Environment_Module`

**技术实现**: `InternalEnvironmentEngine`

**职责**：
- 根据场景配置生成舱内环境数据
- 模拟车辆状态、座舱状态
- 调用LLM服务生成合理的状态变化

**接口**：

```typescript
interface InternalEnvironmentEngine {
  // 生成舱内环境数据（调用LLM）
  generate(
    scenario: ScenarioState, 
    context: SessionContext,
    llmService: LLMService
  ): Promise<InternalEnvironmentData>;
}

interface InternalEnvironmentData {
  module: 'internal_environment';
  data: {
    seatbelt: 'fastened' | 'unfastened';
    doors: DoorStatus[];
    airConditioner: {
      temperature: number; // 摄氏度
      mode: 'cool' | 'heat' | 'auto' | 'off';
    };
    noiseLevel: number; // 分贝
  };
}

interface DoorStatus {
  position: 'driver' | 'passenger' | 'rear_left' | 'rear_right';
  status: 'open' | 'closed';
}
```

### 5. 用户行为仿真模块 (User Behavior Module)

**对应 requirements.md**: `User_Behavior_Module`

**技术实现**: `UserBehaviorEngine`

**职责**：
- 根据目标系统响应和舱内外环境生成用户行为
- 依赖舱外和舱内仿真引擎的输出
- 处理确认、提供信息、发起新需求等场景
- 调用LLM服务生成合理的用户行为

**接口**：

```typescript
interface UserBehaviorEngine {
  // 生成用户行为数据（依赖舱内外环境，调用LLM）
  generate(
    scenario: ScenarioState,
    context: SessionContext,
    externalEnv: ExternalEnvironmentData,
    internalEnv: InternalEnvironmentData,
    previousResponse: SystemResponse | undefined,
    llmService: LLMService
  ): Promise<UserBehaviorData>;
}

interface UserBehaviorData {
  module: 'user_behavior';
  data: {
    behaviorType: 'voice_command' | 'touch' | 'gesture';
    details: {
      intent: string;
      slots: Record<string, any>;
    };
    isFinal: boolean;
  };
}
```

### 6. 决策引擎 (Decision Engine)

**对应 requirements.md**: `Decision_Engine`

**技术实现**: `DecisionEngine`

**职责**：
- 汇总三个仿真引擎的输出
- 根据决策规则生成决策
- 调用LLM服务进行决策推理
- 不直接与目标系统通信

**接口**：

```typescript
interface DecisionEngine {
  // 生成决策（调用LLM）
  generateDecision(
    externalEnv: ExternalEnvironmentData,
    internalEnv: InternalEnvironmentData,
    userBehavior: UserBehaviorData,
    llmService: LLMService
  ): Promise<Decision>;
}

interface Decision {
  // 控制指令（通过请求通道发送）
  control: {
    action: string;
    intent: string;
    command?: string;
  };
  
  // 环境和用户数据（通过数据通道发送）
  data: {
    cabin_external: ExternalEnvironmentData['data'];
    cabin_internal: InternalEnvironmentData['data'];
    user_action: UserBehaviorData['data'];
  };
  
  // 元数据
  metadata: {
    turnId: string;
    timestamp: Date;
  };
}
```

### 7. 执行引擎 (ExecutionEngine)

**职责**：
- 接收决策引擎的输出
- 内部管理WebSocket连接
- 通过双通道发送数据到目标系统
- 接收并解析目标系统响应
- 调用LLM服务进行响应分析和错误处理

**接口**：

```typescript
interface ExecutionEngine {
  // 执行决策（调用LLM进行响应分析）
  execute(decision: Decision, llmService: LLMService): Promise<ExecutionResult>;
  
  // 关闭连接（会话结束时调用）
  close(): Promise<void>;
}

interface ExecutionResult {
  success: boolean;
  response?: SystemResponse;
  error?: ExecutionError;
}

interface SystemResponse {
  status: string;
  message: string;
  data?: any;
  finalDecision: boolean; // 关键字段：是否完成任务
}

interface ExecutionError {
  code: string;
  message: string;
  retryable: boolean;
}
```

**内部组件**：

```typescript
// WebSocket连接管理器（执行引擎内部）
class WebSocketManager {
  private connection: WebSocket | null;
  private config: WebSocketConfig;
  private reconnectAttempts: number;
  
  // 建立连接
  async connect(): Promise<void>;
  
  // 发送请求通道数据
  async sendRequest(control: Decision['control']): Promise<void>;
  
  // 发送数据通道数据
  async sendData(data: Decision['data']): Promise<void>;
  
  // 接收响应
  async receiveResponse(): Promise<SystemResponse>;
  
  // 重连
  private async reconnect(): Promise<void>;
  
  // 关闭连接
  async close(): Promise<void>;
}

interface WebSocketConfig {
  url: string;
  port: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  timeout: number;
  heartbeatInterval: number;
}
```

### 8. 日志管理器 (LogManager)

**职责**：
- 异步记录每轮仿真的完整信息（不阻塞主流程）
- 提供日志查询和导出功能

**接口**：

```typescript
interface LogManager {
  // 异步记录单轮日志（不阻塞调用者）
  logTurn(turnLog: TurnLog): void; // 注意：返回void，不需要await
  
  // 查询会话日志
  getSessionLogs(sessionId: string): TurnLog[];
  
  // 导出所有日志
  exportLogs(): Promise<string>; // 返回JSON字符串
}

// 内部实现示例
class AsyncLogManager implements LogManager {
  private logQueue: TurnLog[] = [];
  private isProcessing: boolean = false;
  
  // 立即返回，不阻塞
  logTurn(turnLog: TurnLog): void {
    this.logQueue.push(turnLog);
    
    // 触发异步处理（不等待）
    if (!this.isProcessing) {
      this.processQueue();
    }
  }
  
  // 后台异步处理日志
  private async processQueue(): Promise<void> {
    this.isProcessing = true;
    
    while (this.logQueue.length > 0) {
      const log = this.logQueue.shift()!;
      try {
        // 写入存储（文件、数据库等）
        await this.writeToStorage(log);
      } catch (error) {
        console.error('Failed to write log:', error);
        // 可以选择重试或丢弃
      }
    }
    
    this.isProcessing = false;
  }
  
  private async writeToStorage(log: TurnLog): Promise<void> {
    // 实际的存储逻辑
  }
}

interface TurnLog {
  sessionId: string;
  turnId: string;
  timestamp: Date;
  
  // 仿真引擎输出
  externalEnvironment: ExternalEnvironmentData;
  internalEnvironment: InternalEnvironmentData;
  userBehavior: UserBehaviorData;
  
  // 决策
  decision: Decision;
  
  // 目标系统响应
  response: SystemResponse | null;
  
  // 执行状态
  executionStatus: 'success' | 'error';
  error?: ExecutionError;
}
```

### 9. HTTP API 控制器

**接口**：

```typescript
// POST /api/v1/simulation/start
interface StartSimulationRequest {
  scenarioType: string;
  initialState: ScenarioState;
  maxTurns: number;
}

interface StartSimulationResponse {
  sessionId: string;
  status: string;
  currentTurn: number;
}

// GET /api/v1/simulation/{session_id}
interface GetSessionResponse {
  sessionId: string;
  status: 'running' | 'completed' | 'aborted';
  turnCount: number;
  maxTurns: number;
  startTime: string;
  endTime?: string;
}

// POST /api/v1/simulation/{session_id}/run
interface RunSimulationResponse {
  sessionId: string;
  status: 'completed' | 'aborted';
  totalTurns: number;
  finalDecision: boolean;
}

// GET /api/v1/simulation/{session_id}/logs
interface GetLogsResponse {
  sessionId: string;
  logs: TurnLog[];
}
```

### 10. LLM服务 (LLM Service)

**职责**：
- 为所有需要智能能力的模块提供LLM调用接口
- 管理LLM提供商连接（OpenAI、Anthropic等）
- 处理提示词模板和上下文管理
- 实现重试和错误处理机制

**接口**：

```typescript
interface LLMService {
  // 为协调器分析会话状态
  analyzeSessionState(
    prompt: SessionStatePrompt
  ): Promise<LLMResponse<SessionStateAnalysis>>;
  
  // 为协调器生成会话总结
  generateSessionSummary(
    prompt: SessionSummaryPrompt
  ): Promise<LLMResponse<string>>;
  
  // 为舱外环境仿真生成数据
  generateExternalEnvironment(
    prompt: EnvironmentPrompt,
    context: SessionContext
  ): Promise<LLMResponse<ExternalEnvironmentData['data']>>;
  
  // 为舱内环境仿真生成数据
  generateInternalEnvironment(
    prompt: EnvironmentPrompt,
    context: SessionContext
  ): Promise<LLMResponse<InternalEnvironmentData['data']>>;
  
  // 为用户行为仿真生成数据
  generateUserBehavior(
    prompt: UserBehaviorPrompt,
    externalEnv: ExternalEnvironmentData,
    internalEnv: InternalEnvironmentData,
    previousResponse: SystemResponse | undefined,
    context: SessionContext
  ): Promise<LLMResponse<UserBehaviorData['data']>>;
  
  // 为决策引擎生成决策
  generateDecision(
    prompt: DecisionPrompt,
    externalEnv: ExternalEnvironmentData,
    internalEnv: InternalEnvironmentData,
    userBehavior: UserBehaviorData,
    context: SessionContext
  ): Promise<LLMResponse<Decision>>;
  
  // 为执行引擎分析响应
  analyzeResponse(
    prompt: ResponseAnalysisPrompt,
    response: SystemResponse,
    context: SessionContext
  ): Promise<LLMResponse<ResponseAnalysis>>;
}

interface SessionStatePrompt {
  sessionId: string;
  turnCount: number;
  maxTurns: number;
  currentResponse: SystemResponse;
  previousResponses: SystemResponse[];
  currentTask?: string;
}

interface SessionStateAnalysis {
  currentProgress: string;
  nextStepSuggestion?: string;
  anomalies?: string[];
}

interface SessionSummaryPrompt {
  sessionId: string;
  totalTurns: number;
  status: 'completed' | 'aborted';
  allResponses: SystemResponse[];
}

interface LLMResponse<T> {
  success: boolean;
  data?: T;
  error?: LLMError;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface LLMError {
  code: string;
  message: string;
  retryable: boolean;
}

interface EnvironmentPrompt {
  scenario: ScenarioState;
  turnNumber: number;
  previousState?: any;
}

interface UserBehaviorPrompt {
  scenario: ScenarioState;
  turnNumber: number;
  externalEnvironment: ExternalEnvironmentData['data'];
  internalEnvironment: InternalEnvironmentData['data'];
  previousResponse?: SystemResponse;
  conversationHistory: string[];
}

interface DecisionPrompt {
  scenario: ScenarioState;
  turnNumber: number;
  externalEnvironment: ExternalEnvironmentData['data'];
  internalEnvironment: InternalEnvironmentData['data'];
  userBehavior: UserBehaviorData['data'];
  decisionRules: DecisionRule[];
}

interface ResponseAnalysisPrompt {
  decision: Decision;
  response: SystemResponse;
  expectedBehavior?: string;
}

interface ResponseAnalysis {
  finalDecision: boolean;
  requiresUserAction: boolean;
  suggestedNextAction?: string;
  anomalies?: string[];
}

interface DecisionRule {
  condition: string;
  action: string;
  priority: number;
}
```

**LLM提供商配置**：

```typescript
interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}
```

**提示词模板示例**：

```typescript
// 协调器：会话状态分析提示词
const SESSION_STATE_ANALYSIS_PROMPT = `
你是一个智能座舱仿真系统的协调器。
分析当前仿真会话的状态和进度。

会话信息：
- 会话ID: {sessionId}
- 当前轮次: {turnCount}/{maxTurns}
- 当前任务: {currentTask}

目标系统最新响应：
{currentResponse}

历史响应：
{previousResponses}

请分析：
1. 当前仿真进度如何？任务是否按预期进行？
2. 目标系统的响应是否符合预期？
3. 是否存在异常情况或需要关注的问题？
4. 如果继续下一轮，应该关注什么？

返回JSON格式：
{
  "currentProgress": "进度描述",
  "nextStepSuggestion": "下一步建议",
  "anomalies": ["异常1", "异常2"]
}
`;

// 协调器：会话总结提示词
const SESSION_SUMMARY_PROMPT = `
你是一个智能座舱仿真系统的协调器。
为完成的仿真会话生成总结报告。

会话信息：
- 会话ID: {sessionId}
- 总轮次: {totalTurns}
- 最终状态: {status}

所有交互历史：
{allResponses}

请生成一份简洁的总结报告，包括：
1. 仿真场景和目标
2. 主要交互过程
3. 目标系统的表现评估
4. 是否达成预期目标
5. 发现的问题或改进建议
`;

// 舱外环境仿真提示词
const EXTERNAL_ENV_PROMPT = `
你是一个智能座舱仿真系统的舱外环境仿真引擎。
根据以下场景配置和上下文，生成合理的舱外环境数据。

场景类型: {scenarioType}
当前轮次: {turnNumber}
上一轮状态: {previousState}

请生成包含以下字段的JSON数据：
- weather: 天气状态
- temperature: 温度（摄氏度）
- visibility: 能见度（米）
- roadCondition: 路况
- surroundingObjects: 周围物体列表

确保生成的数据符合真实场景逻辑。
`;

// 用户行为仿真提示词
const USER_BEHAVIOR_PROMPT = `
你是一个智能座舱仿真系统的用户行为仿真引擎。
根据目标系统的响应和当前环境，生成合理的用户行为。

目标系统上一轮响应: {previousResponse}
舱外环境: {externalEnvironment}
舱内环境: {internalEnvironment}
对话历史: {conversationHistory}

请分析目标系统的响应类型：
- 如果目标系统要求确认，生成确认或否定的用户行为
- 如果目标系统询问信息，生成提供信息的用户行为
- 如果目标系统执行完成，生成下一个需求或结束信号

生成包含以下字段的JSON数据：
- behaviorType: 行为类型（voice_command/touch/gesture）
- details: 行为详情（intent和slots）
- isFinal: 是否为最终行为
`;

// 决策引擎提示词
const DECISION_PROMPT = `
你是一个智能座舱仿真系统的决策引擎。
根据仿真引擎的输出，生成发送给目标系统的决策。

舱外环境: {externalEnvironment}
舱内环境: {internalEnvironment}
用户行为: {userBehavior}
决策规则: {decisionRules}

请生成包含以下字段的JSON数据：
- control: 控制指令（action, intent, command）
- data: 环境和用户数据

确保决策符合决策规则和场景逻辑。
`;
```

## Data Models

### 多轮仿真循环流程

多轮仿真是系统的核心机制，通过监听目标系统响应并根据响应内容决定是否进入下一轮。

#### 循环流程设计

```mermaid
stateDiagram-v2
    [*] --> 初始化会话
    初始化会话 --> 开始轮次
    
    开始轮次 --> 并行仿真: 轮次+1
    
    state 并行仿真 {
        [*] --> 舱外仿真
        [*] --> 舱内仿真
        舱外仿真 --> 等待完成: 调用LLM
        舱内仿真 --> 等待完成: 调用LLM
        等待完成 --> [*]: 两者都完成
    }
    
    并行仿真 --> 用户行为仿真
    用户行为仿真 --> 决策生成: 调用LLM
    决策生成 --> 执行决策: 调用LLM
    
    state 执行决策 {
        [*] --> 发送请求通道
        [*] --> 发送数据通道
        发送请求通道 --> 监听响应
        发送数据通道 --> 监听响应
        监听响应 --> 接收响应: 目标系统返回
        接收响应 --> 解析响应: 调用LLM分析
        解析响应 --> [*]: 返回执行结果
    }
    
    执行决策 --> 异步记录日志
    执行决策 --> 保存上下文
    
    异步记录日志 --> 日志完成: 不阻塞主流程
    保存上下文 --> 检查终止条件: 保存响应到会话上下文
    
    检查终止条件 --> 结束会话: final_decision=true
    检查终止条件 --> 结束会话: 达到最大轮数
    检查终止条件 --> 开始轮次: 继续下一轮
    
    结束会话 --> 关闭连接
    关闭连接 --> [*]
    
    note right of 监听响应
        关键：阻塞等待目标系统响应
        响应到达后才进入下一步
    end note
    
    note right of 保存上下文
        将目标系统响应保存到上下文
        下一轮仿真会使用这个响应
    end note
    
    note right of 检查终止条件
        1. final_decision=true → 完成
        2. 轮次>=最大轮数 → 中止
        3. 否则 → 继续循环
    end note
    
    note left of 异步记录日志
        异步执行，不阻塞
        主流程继续进行
    end note
```

#### 循环控制逻辑

```typescript
class SimulationCoordinator implements SimulationCoordinator {
  constructor(
    private sessionManager: SimulationSessionManager,
    private externalEnvEngine: ExternalEnvironmentEngine,
    private internalEnvEngine: InternalEnvironmentEngine,
    private userBehaviorEngine: UserBehaviorEngine,
    private decisionEngine: DecisionEngine,
    private executionEngine: ExecutionEngine,
    private logManager: LogManager,
    private llmService: LLMService
  ) {}
  
  async runUntilComplete(sessionId: string): Promise<SessionResult> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    while (session.status === 'running') {
      // 执行单轮仿真
      const turnResult = await this.executeTurn(sessionId);
      
      // 调用LLM分析并决定是否继续
      const decision = await this.analyzeAndDecide(
        session,
        turnResult.executionResult,
        this.llmService
      );
      
      // 更新会话状态
      this.sessionManager.updateSessionStatus(sessionId, decision.sessionStatus);
      
      // 如果有上下文更新建议，应用它们
      if (decision.contextUpdates) {
        this.sessionManager.updateContext(sessionId, decision.contextUpdates);
      }
      
      // 检查是否应该结束
      if (!decision.shouldContinue) {
        session.endTime = new Date();
        break;
      }
    }
    
    // 关闭WebSocket连接
    await this.executionEngine.close();
    
    // 生成会话总结（调用LLM）
    const summary = await this.generateSessionSummary(session);
    
    return {
      sessionId,
      status: session.status,
      totalTurns: session.turnCount,
      finalDecision: session.context.previousResponses[
        session.context.previousResponses.length - 1
      ]?.finalDecision || false,
      summary
    };
  }
  
  async executeTurn(sessionId: string): Promise<TurnResult> {
    const session = this.sessionManager.getSession(sessionId)!;
    
    // 1. 增加轮次计数
    const turnCount = this.sessionManager.incrementTurnCount(sessionId);
    const turnId = `turn-${turnCount}`;
    
    // 2. 并行执行舱外和舱内仿真（调用LLM）
    const [externalEnv, internalEnv] = await Promise.all([
      this.externalEnvEngine.generate(
        session.scenario,
        session.context,
        this.llmService
      ),
      this.internalEnvEngine.generate(
        session.scenario,
        session.context,
        this.llmService
      )
    ]);
    
    // 3. 用户行为仿真（依赖舱内外环境，调用LLM）
    const previousResponse = session.context.previousResponses[
      session.context.previousResponses.length - 1
    ];
    const userBehavior = await this.userBehaviorEngine.generate(
      session.scenario,
      session.context,
      externalEnv,
      internalEnv,
      previousResponse,
      this.llmService
    );
    
    // 4. 决策生成（调用LLM）
    const decision = await this.decisionEngine.generateDecision(
      externalEnv,
      internalEnv,
      userBehavior,
      this.llmService
    );
    
    // 5. 执行决策（调用LLM分析响应）
    const executionResult = await this.executionEngine.execute(
      decision,
      this.llmService
    );
    
    // 6. 异步记录日志（不阻塞）
    this.logManager.logTurn({
      sessionId,
      turnId,
      timestamp: new Date(),
      externalEnvironment: externalEnv,
      internalEnvironment: internalEnv,
      userBehavior,
      decision,
      response: executionResult.response || null,
      executionStatus: executionResult.success ? 'success' : 'error',
      error: executionResult.error
    });
    
    // 7. 保存响应到会话上下文
    if (executionResult.success && executionResult.response) {
      this.sessionManager.saveResponse(sessionId, executionResult.response);
    }
    
    return {
      turnId,
      success: executionResult.success,
      externalEnvironment: externalEnv,
      internalEnvironment: internalEnv,
      userBehavior,
      decision,
      executionResult
    };
  }
  
  async analyzeAndDecide(
    session: Session,
    executionResult: ExecutionResult,
    llmService: LLMService
  ): Promise<CoordinationDecision> {
    // 调用LLM分析当前状态
    const stateAnalysis = await llmService.analyzeSessionState({
      sessionId: session.id,
      turnCount: session.turnCount,
      maxTurns: session.maxTurns,
      currentResponse: executionResult.response!,
      previousResponses: session.context.previousResponses,
      currentTask: session.context.currentTask
    });
    
    // 判断是否应该继续
    let shouldContinue = true;
    let reason: CoordinationDecision['reason'] = 'continue';
    let sessionStatus: Session['status'] = 'running';
    
    // 检查终止条件
    if (executionResult.response?.finalDecision) {
      shouldContinue = false;
      reason = 'final_decision';
      sessionStatus = 'completed';
    } else if (session.turnCount >= session.maxTurns) {
      shouldContinue = false;
      reason = 'max_turns';
      sessionStatus = 'aborted';
    } else if (!executionResult.success) {
      shouldContinue = false;
      reason = 'error';
      sessionStatus = 'aborted';
    }
    
    return {
      shouldContinue,
      reason,
      sessionStatus,
      analysis: stateAnalysis.data
    };
  }
  
  private async generateSessionSummary(session: Session): Promise<string> {
    const summaryResponse = await this.llmService.generateSessionSummary({
      sessionId: session.id,
      totalTurns: session.turnCount,
      status: session.status,
      allResponses: session.context.previousResponses
    });
    
    return summaryResponse.data || '会话总结生成失败';
  }
}
```

### 场景状态数据模型

```typescript
interface ScenarioState {
  scenarioType: string;
  tripPurpose: string;
  startLocation: Coordinates;
  endLocation: Coordinates;
  participants: Participant[];
  sceneConfig: SceneConfig;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Participant {
  role: 'driver' | 'passenger';
  name: string;
  age: number;
  preferences?: Record<string, any>;
}

interface SceneConfig {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  trafficCondition: 'light' | 'moderate' | 'heavy';
  weatherCondition: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 场景初始化完整性

*For any* 仿真会话，当系统接收到业务配置时，仿真场景初始化模块必须生成包含出行目的、起始点坐标、人员配置和场景配置的完整初始化结果。

**Validates: Requirements 1.1, 1.2**

### Property 2: 初始化数据分发

*For any* 完成的场景初始化，其结果必须同时提供给环境感知仿真、用户状态仿真和长短期记忆模块这三个输入支撑模块。

**Validates: Requirements 1.3, 10.4**

### Property 3: 主链路执行顺序

*For any* 仿真轮次，系统必须按照"仿真场景初始化 → 输入支撑模块 → 仿真编排决策器 → 用户行为仿真 → 目标系统调用与响应解析 → 评测量化"的顺序执行主链路。

**Validates: Requirements 1.4, 10.3**

### Property 4: 初始化输出边界

*For any* 场景初始化的输出，不得直接包含用户行为或评测结果类型的数据。

**Validates: Requirements 1.5**

### Property 5: 噪声类型支持

*For any* 突发噪声事件，其类型必须属于交通事故、热点事件、个人突发或生活&工作这四类干预源之一。

**Validates: Requirements 2.1**

### Property 6: 噪声扰动传递

*For any* 注入的突发噪声，必须通过噪声扰动链路传递到环境感知仿真和用户状态仿真模块，且不得绕过输入支撑模块直接影响仿真编排决策器或用户行为仿真。

**Validates: Requirements 2.2, 2.4, 14.1, 14.2, 14.4**

### Property 7: 噪声可选性

*For any* 仿真会话，突发噪声的注入是可选的，主链路的执行不依赖于噪声的存在。

**Validates: Requirements 2.3**

### Property 8: 环境仿真完整性

*For any* 环境感知仿真的输出，必须覆盖舱外环境、交通参与者、舱内环境和车辆状态这四类内容。

**Validates: Requirements 3.1**

### Property 9: 环境初始化依赖

*For any* 仿真轮次，环境感知仿真模块必须基于场景初始化结果建立当前环境状态。

**Validates: Requirements 3.2**

### Property 10: 环境反馈更新

*For any* 目标系统调用与响应解析产生的响应，环境感知仿真模块必须通过环境&用户反馈链路接收反馈并更新环境表示。

**Validates: Requirements 3.3, 11.1**

### Property 11: 环境噪声响应

*For any* 触发的突发噪声，环境感知仿真模块必须通过噪声扰动链路接收扰动并反映到当前环境中。

**Validates: Requirements 3.4**

### Property 12: 环境数据分发

*For any* 环境感知仿真的输出，必须提供给用户状态仿真和仿真编排决策器。

**Validates: Requirements 3.5**

### Property 13: 用户状态完整性

*For any* 用户状态仿真的输出，必须覆盖用户人设、知识背景、身体状态和情绪状态这四个方面。

**Validates: Requirements 4.1**

### Property 14: 用户状态初始化依赖

*For any* 仿真轮次，用户状态仿真模块必须基于场景初始化结果建立用户初始状态。

**Validates: Requirements 4.2**

### Property 15: 用户状态环境响应

*For any* 环境感知仿真的变化，用户状态仿真模块必须接收环境输入并更新当前用户状态。

**Validates: Requirements 4.3**

### Property 16: 用户状态反馈更新

*For any* 目标系统调用与响应解析影响用户体验或系统状态的输出，用户状态仿真模块必须通过环境&用户反馈链路接收反馈。

**Validates: Requirements 4.4, 11.2**

### Property 17: 用户状态噪声响应

*For any* 触发的突发噪声，用户状态仿真模块必须通过噪声扰动链路接收扰动。

**Validates: Requirements 4.5**

### Property 18: 用户状态数据分发

*For any* 用户状态仿真的输出，必须提供给仿真编排决策器。

**Validates: Requirements 4.6**

### Property 19: 记忆模块结构

*For any* 长短期记忆模块的状态，必须维护个性化偏好、实时上下文窗口和知识库这三个组成部分。

**Validates: Requirements 5.1**

### Property 20: 记忆初始化

*For any* 仿真会话，长短期记忆模块必须基于初始场景载入初始记忆。

**Validates: Requirements 5.2**

### Property 21: 记忆上下文提供

*For any* 仿真编排决策，长短期记忆模块必须向仿真编排决策器提供可用的记忆上下文。

**Validates: Requirements 5.3**

### Property 22: 记忆行为更新

*For any* 用户行为仿真产生的新交互结果，长短期记忆模块必须通过记忆更新链路接收更新输入。

**Validates: Requirements 5.4, 7.6, 13.1**

### Property 23: 记忆评估更新

*For any* 评测量化产生的新评估结果，长短期记忆模块必须通过记忆更新链路接收更新输入。

**Validates: Requirements 5.5, 9.3, 13.2**

### Property 24: 记忆持久性

*For any* 仿真轮次（轮次号 > 1），更新后的长短期记忆模块状态必须在后续仿真编排决策中可见并可用。

**Validates: Requirements 13.3, 11.3**

### Property 25: 编排决策器输出

*For any* 仿真编排决策器完成的决策，必须产出当前轮的策略与意图，并将结果提供给用户行为仿真。

**Validates: Requirements 6.3**

### Property 26: 编排决策器继续判断

*For any* 目标系统调用与响应解析返回的结构化响应，仿真编排决策器必须基于目标系统响应、评测结果、记忆状态和轮次约束决定继续下一轮还是结束会话。

**Validates: Requirements 6.4, 10.7**

### Property 27: 编排决策器输出边界

*For any* 仿真编排决策器的输出，不得直接包含目标系统服务调用或评测量化结果。

**Validates: Requirements 6.5**

### Property 28: 用户行为依赖

*For any* 用户行为仿真的执行，必须基于仿真编排决策器完成的当前轮策略生成行为表达。

**Validates: Requirements 7.1**

### Property 29: 用户行为类型支持

*For any* 用户行为仿真的输出，其行为类型必须属于语音（主要）、按键或触屏这三类明确行为形式之一。

**Validates: Requirements 7.2**

### Property 30: 用户行为数据分发

*For any* 用户行为仿真的输出，必须提供给目标系统调用与响应解析、评测量化模块和长短期记忆模块。

**Validates: Requirements 7.4, 7.5, 7.6**

### Property 31: 目标系统调用顺序

*For any* 用户行为仿真产生的行为结果，下层执行反馈层必须通过目标系统调用与响应解析向目标系统服务发送请求并接收响应。

**Validates: Requirements 8.1, 8.8**

### Property 32: 服务调用输出结构

*For any* 目标系统调用与响应解析的输出，必须包含响应状态、响应内容和完成标记这些必需字段。

**Validates: Requirements 8.2**

### Property 33: 服务调用响应分发

*For any* 目标系统调用与响应解析返回的结构化响应，必须提供给仿真编排决策器、环境感知仿真、用户状态仿真和评测量化模块。

**Validates: Requirements 8.3**

### Property 34: 评测量化输入

*For any* 评测量化的执行，必须以用户行为仿真和目标系统调用与响应解析的输出作为输入。

**Validates: Requirements 9.2, 12.1, 12.2**

### Property 35: 评测量化维度完整性

*For any* 评测量化模块的输出，必须覆盖用户行为合理性、目标系统响应准确性、场景覆盖率和响应实时性这四个评估维度。

**Validates: Requirements 9.1**

### Property 36: 编排决策器触发初始化

*For any* 进入系统的仿真请求，仿真编排决策器必须基于业务配置启动仿真场景初始化。

**Validates: Requirements 10.2**

### Property 37: 下层执行反馈职责边界

*For any* 下层执行反馈层的执行，不得决定是否进入下一轮仿真（该决策权属于仿真编排决策器）。

**Validates: Requirements 10.6**

### Property 38: 反馈链路不跳层

*For any* 环境&用户反馈链路的数据流，不得直接跳过输入支撑模块写入上层决策结果。

**Validates: Requirements 11.4**

## Error Handling

### 错误分类

系统将错误分为以下几类：

1. **可重试错误**：
   - WebSocket连接断开
   - LLM调用超时
   - 目标系统临时不可用
   - 网络波动

2. **不可重试错误**：
   - 配置错误（无效的场景配置）
   - 认证失败
   - LLM API密钥无效
   - 目标系统返回永久性错误

3. **业务逻辑错误**：
   - 场景初始化失败
   - 仿真引擎生成无效数据
   - 决策引擎无法生成决策

### 错误处理策略

#### WebSocket连接错误

```typescript
class WebSocketManager {
  private async handleConnectionError(error: Error): Promise<void> {
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      await this.delay(this.config.reconnectDelay);
      await this.reconnect();
    } else {
      throw new ExecutionError({
        code: 'WS_MAX_RECONNECT_EXCEEDED',
        message: `Failed to reconnect after ${this.config.maxReconnectAttempts} attempts`,
        retryable: false
      });
    }
  }
}
```

#### LLM调用错误

```typescript
class LLMService {
  private async callWithRetry<T>(
    fn: () => Promise<T>,
    retries: number = 3
  ): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1 || !this.isRetryable(error)) {
          throw error;
        }
        await this.delay(Math.pow(2, i) * 1000); // 指数退避
      }
    }
    throw new Error('Unexpected error in retry logic');
  }
  
  private isRetryable(error: any): boolean {
    // 超时、限流等错误可重试
    return error.code === 'TIMEOUT' || 
           error.code === 'RATE_LIMIT' ||
           error.status === 429 ||
           error.status === 503;
  }
}
```

#### 仿真引擎错误

```typescript
class SimulationCoordinator {
  async executeTurn(sessionId: string): Promise<TurnResult> {
    try {
      // 执行仿真逻辑
      // ...
    } catch (error) {
      // 记录错误
      this.logManager.logTurn({
        sessionId,
        turnId: `turn-${session.turnCount}`,
        timestamp: new Date(),
        executionStatus: 'error',
        error: {
          code: error.code || 'UNKNOWN_ERROR',
          message: error.message,
          retryable: false
        }
      });
      
      // 更新会话状态为中止
      this.sessionManager.updateSessionStatus(sessionId, 'aborted');
      
      throw error;
    }
  }
}
```

### 超时处理

```typescript
interface TimeoutConfig {
  llmCallTimeout: number; // LLM调用超时（毫秒）
  websocketTimeout: number; // WebSocket响应超时（毫秒）
  turnTimeout: number; // 单轮仿真超时（毫秒）
}

class SimulationCoordinator {
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
    errorMessage: string
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeout)
      )
    ]);
  }
}
```

## Testing Strategy

### 测试方法论

系统采用双重测试策略：

1. **单元测试**：验证具体示例、边缘情况和错误条件
2. **属性测试**：验证跨所有输入的通用属性

两种测试方法互补，共同确保全面覆盖。

### 单元测试策略

单元测试专注于：
- 具体示例，展示正确行为
- 组件之间的集成点
- 边缘情况和错误条件

**示例**：

```typescript
describe('ScenarioInitializer', () => {
  it('should generate complete initialization data', () => {
    const config = {
      scenarioType: 'commute',
      businessConfig: { /* ... */ }
    };
    
    const result = initializer.initialize(config);
    
    expect(result).toHaveProperty('tripPurpose');
    expect(result).toHaveProperty('startLocation');
    expect(result).toHaveProperty('participants');
    expect(result).toHaveProperty('sceneConfig');
  });
  
  it('should handle invalid config gracefully', () => {
    const invalidConfig = { scenarioType: '' };
    
    expect(() => initializer.initialize(invalidConfig))
      .toThrow('Invalid scenario configuration');
  });
});
```

### 属性测试策略

属性测试验证通用属性，使用随机生成的输入进行大量测试。

**配置**：
- 每个属性测试最少运行 100 次迭代
- 每个测试必须引用设计文档中的属性
- 标签格式：**Feature: cabin-simulation-agent, Property {number}: {property_text}**

**属性测试库选择**：
- TypeScript/JavaScript: `fast-check`
- Python: `Hypothesis`
- Java: `jqwik`

**示例**：

```typescript
import fc from 'fast-check';

describe('Property Tests', () => {
  /**
   * Feature: cabin-simulation-agent, Property 1: 场景初始化完整性
   * For any 仿真会话，当系统接收到业务配置时，仿真场景初始化模块必须生成
   * 包含出行目的、起始点坐标、人员配置和场景配置的完整初始化结果。
   */
  it('Property 1: Scenario initialization completeness', () => {
    fc.assert(
      fc.property(
        fc.record({
          scenarioType: fc.constantFrom('commute', 'leisure', 'business'),
          businessConfig: fc.object()
        }),
        (config) => {
          const result = initializer.initialize(config);
          
          return (
            result.hasOwnProperty('tripPurpose') &&
            result.hasOwnProperty('startLocation') &&
            result.hasOwnProperty('participants') &&
            result.hasOwnProperty('sceneConfig')
          );
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: cabin-simulation-agent, Property 2: 初始化数据分发
   * For any 完成的场景初始化，其结果必须同时提供给环境感知仿真、
   * 用户状态仿真和长短期记忆模块这三个输入支撑模块。
   */
  it('Property 2: Initialization data distribution', () => {
    fc.assert(
      fc.property(
        fc.record({
          scenarioType: fc.constantFrom('commute', 'leisure', 'business'),
          businessConfig: fc.object()
        }),
        (config) => {
          const result = initializer.initialize(config);
          const recipients = initializer.getDataRecipients();
          
          return (
            recipients.includes('environment_simulation') &&
            recipients.includes('user_state_simulation') &&
            recipients.includes('memory_module')
          );
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: cabin-simulation-agent, Property 8: 环境仿真完整性
   * For any 环境感知仿真的输出，必须覆盖舱外环境、交通参与者、
   * 舱内环境和车辆状态这四类内容。
   */
  it('Property 8: Environment simulation completeness', () => {
    fc.assert(
      fc.property(
        fc.record({
          scenario: fc.object(),
          context: fc.object()
        }),
        async ({ scenario, context }) => {
          const result = await envEngine.generate(scenario, context, llmService);
          
          return (
            result.data.hasOwnProperty('externalEnvironment') &&
            result.data.hasOwnProperty('trafficParticipants') &&
            result.data.hasOwnProperty('internalEnvironment') &&
            result.data.hasOwnProperty('vehicleState')
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 集成测试

集成测试验证模块之间的交互：

```typescript
describe('Integration Tests', () => {
  it('should complete a full simulation turn', async () => {
    const sessionId = await coordinator.createSession(config);
    
    const turnResult = await coordinator.executeTurn(sessionId);
    
    expect(turnResult.success).toBe(true);
    expect(turnResult.externalEnvironment).toBeDefined();
    expect(turnResult.internalEnvironment).toBeDefined();
    expect(turnResult.userBehavior).toBeDefined();
    expect(turnResult.decision).toBeDefined();
    expect(turnResult.executionResult).toBeDefined();
  });
  
  it('should handle feedback loops correctly', async () => {
    const sessionId = await coordinator.createSession(config);
    
    // 第一轮
    await coordinator.executeTurn(sessionId);
    
    // 第二轮应该使用第一轮的响应
    const turn2Result = await coordinator.executeTurn(sessionId);
    
    const session = sessionManager.getSession(sessionId);
    expect(session.context.previousResponses.length).toBe(2);
  });
});
```

### 端到端测试

端到端测试验证完整的仿真流程：

```typescript
describe('End-to-End Tests', () => {
  it('should complete a full simulation session', async () => {
    const config = {
      scenarioType: 'commute',
      initialState: { /* ... */ },
      maxTurns: 5
    };
    
    const sessionId = await coordinator.createSession(config);
    const result = await coordinator.runUntilComplete(sessionId);
    
    expect(result.status).toMatch(/completed|aborted/);
    expect(result.totalTurns).toBeGreaterThan(0);
    expect(result.totalTurns).toBeLessThanOrEqual(5);
  });
});
```

### 测试覆盖率目标

- 单元测试代码覆盖率：≥ 80%
- 属性测试：每个设计属性至少一个测试
- 集成测试：覆盖所有关键数据流
- 端到端测试：覆盖所有主要场景类型

### 持续集成

测试应在以下情况下自动运行：
- 每次代码提交
- Pull Request创建时
- 合并到主分支前

CI配置示例：

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:unit
      - run: npm run test:property
      - run: npm run test:integration
      - run: npm run test:e2e
```e(
    session: Session,
    executionResult: ExecutionResult,
    llmService: LLMService
  ): Promise<CoordinationDecision> {
    // 1. 检查执行错误
    if (!executionResult.success) {
      return {
        shouldContinue: false,
        reason: 'error',
        sessionStatus: 'aborted'
      };
    }
    
    const response = executionResult.response!;
    
    // 2. 调用LLM分析当前状态
    const analysisPrompt = {
      sessionId: session.id,
      turnCount: session.turnCount,
      maxTurns: session.maxTurns,
      currentResponse: response,
      previousResponses: session.context.previousResponses,
      currentTask: session.context.currentTask
    };
    
    const analysis = await llmService.analyzeSessionState(analysisPrompt);
    
    // 3. 基于LLM分析和规则决定是否继续
    if (response.finalDecision === true) {
      return {
        shouldContinue: false,
        reason: 'final_decision',
        sessionStatus: 'completed',
        analysis: analysis.data
      };
    }
    
    if (session.turnCount >= session.maxTurns) {
      return {
        shouldContinue: false,
        reason: 'max_turns',
        sessionStatus: 'aborted',
        analysis: analysis.data
      };
    }
    
    // 4. 继续下一轮
    return {
      shouldContinue: true,
      reason: 'continue',
      sessionStatus: 'running',
      analysis: analysis.data,
      contextUpdates: {
        // 可以基于LLM分析更新上下文
        currentTask: response.data?.currentTask || session.context.currentTask
      }
    };
  }
  
  private async generateSessionSummary(session: Session): Promise<string> {
    const summaryPrompt = {
      sessionId: session.id,
      totalTurns: session.turnCount,
      status: session.status,
      allResponses: session.context.previousResponses
    };
    
    const summary = await this.llmService.generateSessionSummary(summaryPrompt);
    return summary.data || '会话已完成';
  }
}
```

#### 响应监听机制

执行器内部的WebSocket管理器实现响应监听：

```typescript
class WebSocketManager {
  private responseQueue: SystemAResponse[] = [];
  private responseWaiters: Array<(response: SystemAResponse) => void> = [];
  
  constructor(config: WebSocketConfig) {
    this.setupWebSocket();
  }
  
  private setupWebSocket() {
    this.connection = new WebSocket(this.config.url);
    
    // 监听响应通道消息
    this.connection.on('message', (data: string) => {
      const message = JSON.parse(data);
      
      if (message.channel === 'response') {
        const response: SystemAResponse = {
          status: message.status,
          message: message.message,
          data: message.data,
          finalDecision: message.finalDecision
        };
        
        // 如果有等待者，立即通知
        if (this.responseWaiters.length > 0) {
          const waiter = this.responseWaiters.shift()!;
          waiter(response);
        } else {
          // 否则放入队列
          this.responseQueue.push(response);
        }
      }
    });
  }
  
  // 阻塞等待响应
  async waitForResponse(timeout: number = 30000): Promise<SystemAResponse> {
    // 如果队列中有响应，立即返回
    if (this.responseQueue.length > 0) {
      return this.responseQueue.shift()!;
    }
    
    // 否则等待新响应
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.responseWaiters.indexOf(resolve);
        if (index > -1) {
          this.responseWaiters.splice(index, 1);
        }
        reject(new Error('Response timeout'));
      }, timeout);
      
      this.responseWaiters.push((response) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }
  
  async sendAndWaitResponse(
    control: Decision['control'],
    data: Decision['data']
  ): Promise<SystemAResponse> {
    // 发送请求通道和数据通道
    await this.sendRequest(control);
    await this.sendData(data);
    
    // 阻塞等待响应（关键：这里会等待目标系统返回）
    const response = await this.waitForResponse();
    
    return response;
  }
}
```

#### 上下文传递机制

```typescript
interface SessionContext {
  currentTask?: string;
  taskSteps?: string[];
  pendingConfirmations?: string[];
  
  // 关键：保存所有历史响应
  previousResponses: SystemResponse[];
  
  // 当前轮次使用的响应（指向最后一个）
  get currentResponse(): SystemResponse | undefined {
    return this.previousResponses[this.previousResponses.length - 1];
  }
}

// 更新上下文
updateContext(sessionId: string, response: SystemResponse): void {
  const session = this.sessions.get(sessionId);
  if (session) {
    // 将新响应添加到历史中
    session.context.previousResponses.push(response);
    
    // 更新任务状态
    if (response.data?.currentTask) {
      session.context.currentTask = response.data.currentTask;
    }
    if (response.data?.taskSteps) {
      session.context.taskSteps = response.data.taskSteps;
    }
  }
}
```

#### 终止条件判断

```typescript
interface TerminationCheck {
  shouldTerminate: boolean;
  reason: 'final_decision' | 'max_turns' | 'user_stop' | 'error';
  status: 'completed' | 'aborted';
}

function checkTermination(
  session: Session,
  response: SystemResponse,
  executionResult: ExecutionResult
): TerminationCheck {
  // 1. 检查执行错误
  if (!executionResult.success) {
    return {
      shouldTerminate: true,
      reason: 'error',
      status: 'aborted'
    };
  }
  
  // 2. 检查目标系统最终决定
  if (response.finalDecision === true) {
    return {
      shouldTerminate: true,
      reason: 'final_decision',
      status: 'completed'
    };
  }
  
  // 3. 检查最大轮数
  if (session.turnCount >= session.maxTurns) {
    return {
      shouldTerminate: true,
      reason: 'max_turns',
      status: 'aborted'
    };
  }
  
  // 4. 检查用户停止
  if (session.userStopRequested) {
    return {
      shouldTerminate: true,
      reason: 'user_stop',
      status: 'aborted'
    };
  }
  
  // 5. 继续循环
  return {
    shouldTerminate: false,
    reason: null,
    status: 'running'
  };
}
```

### 场景配置 (Scenario)

```typescript
interface Scenario {
  id: string;
  name: string;
  type: string;
  description: string;
  initialState: ScenarioState;
  expectedBehaviors?: ExpectedBehavior[];
}

interface ScenarioState {
  external: {
    weather: string;
    temperature: number;
    visibility: number;
    roadCondition: string;
    surroundingObjects: SurroundingObject[];
  };
  internal: {
    seatbelt: string;
    doors: DoorStatus[];
    airConditioner: {
      temperature: number;
      mode: string;
    };
    noiseLevel: number;
  };
  user: {
    initialIntent: string;
    initialSlots: Record<string, any>;
  };
}

interface ExpectedBehavior {
  turn: number;
  expectedAction: string;
  expectedResponse: string;
}
```

### 会话数据持久化

会话数据存储在内存中（可选持久化到数据库）：

```typescript
interface SessionStore {
  sessions: Map<string, Session>;
  logs: Map<string, TurnLog[]>;
}
```

### WebSocket消息格式

**请求通道消息**：

```json
{
  "channel": "request",
  "type": "control",
  "data": {
    "action": "navigate",
    "intent": "set_destination",
    "command": "navigate_to_location"
  },
  "metadata": {
    "sessionId": "session-123",
    "turnId": "turn-1",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

**数据通道消息**：

```json
{
  "channel": "data",
  "type": "environment_and_user",
  "data": {
    "cabin_external": {
      "weather": "sunny",
      "temperature": 25,
      "visibility": 1000,
      "roadCondition": "dry",
      "surroundingObjects": []
    },
    "cabin_internal": {
      "seatbelt": "fastened",
      "doors": [],
      "airConditioner": {
        "temperature": 22,
        "mode": "auto"
      },
      "noiseLevel": 45
    },
    "user_action": {
      "behaviorType": "voice_command",
      "details": {
        "intent": "navigate",
        "slots": {
          "destination": "北京"
        }
      },
      "isFinal": false
    }
  },
  "metadata": {
    "sessionId": "session-123",
    "turnId": "turn-1",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

**响应通道消息**：

```json
{
  "channel": "response",
  "status": "success",
  "message": "导航已设置",
  "data": {
    "route": "...",
    "estimatedTime": "30分钟"
  },
  "finalDecision": false,
  "metadata": {
    "sessionId": "session-123",
    "turnId": "turn-1",
    "timestamp": "2024-01-01T00:00:01Z"
  }
}
```



## Reference Implementations

本系统的技术架构和设计模式参考了以下成熟的智能体系统项目：

### 1. claude-code (TypeScript)

**Repository**: `claude-code/` (vendor tree)

**Key Learnings**:
- **Query Engine**: 1700+ 行的流式对话与工具调用循环，含自动压缩、token 追踪
- **Tool System**: 30+ 工具，统一接口，动态注册
- **Session Management**: 会话引擎管理对话状态与归因
- **Context Building**: git status / CLAUDE.md / memory 上下文构建
- **Permission System**: plan/auto/manual 模式，6300+ 行权限系统
- **Hook System**: pre/post tool use hooks，支持 settings.json 配置

**Applied Patterns**:
- 仿真编排决策器借鉴 Query Engine 的循环控制逻辑
- 工具调用层借鉴 Tool System 的统一接口设计
- 会话管理器借鉴 Session Management 的状态管理模式

### 2. claw-code (Rust)

**Repository**: `claw-code/rust/` (vendor tree)

**Key Learnings**:
- **High-Performance Runtime**: Rust 实现的高性能运行时
- **Permission System**: 细粒度权限控制，用户确认流程
- **MCP Support**: Model Context Protocol 客户端和服务器
- **Config Hierarchy**: 全局/项目/运行时三层配置
- **Streaming First**: 所有 LLM 调用默认流式
- **Tool Execution**: bash, read, write, edit, grep, glob 等工具

**Applied Patterns**:
- iota 核心使用 Rust 实现高性能组件
- 权限模型借鉴 claw-code 的细粒度控制
- 配置层级借鉴三层配置模式
- WebSocket 管理借鉴 Rust 异步运行时模式

### 3. codex (Rust + Bazel)

**Repository**: `codex/codex-rs/` (vendor tree)

**Key Learnings**:
- **Native Execution**: 零依赖安装的原生可执行文件
- **Sandbox**: macOS (Seatbelt), Linux (Landlock), Windows 沙箱
- **Config System**: config.toml 配置文件，丰富的配置选项
- **MCP Client**: 连接 MCP 服务器，扩展工具能力
- **Exec Mode**: 非交互式执行，programmatic 调用
- **Modular Crates**: core, exec, tui, cli 等模块化 crate

**Applied Patterns**:
- 模块结构借鉴 codex 的 crate 组织方式
- 配置系统借鉴 config.toml 模式
- 构建系统借鉴 Cargo workspace 模式

### 4. gemini-cli (TypeScript)

**Repository**: `gemini-cli/` (vendor tree)

**Key Learnings**:
- **Streaming**: 流式响应处理，增量更新
- **Context Management**: 上下文管理和压缩
- **Error Handling**: 错误分类和重试策略

**Applied Patterns**:
- LLM 服务层借鉴流式处理模式
- 上下文管理借鉴压缩和持久化策略

### 5. opencode (Python)

**Repository**: `opencode/` (vendor tree)

**Key Learnings**:
- **LLM Integration**: 成熟的 LLM 服务集成
- **Prompt Engineering**: 系统提示词模板、上下文注入、Few-shot examples

**Applied Patterns**:
- Python 层 LLM 集成借鉴 opencode 的实现
- Prompt Engineering 借鉴提示词工程最佳实践

### Multi-Language Development Pattern

**codex** 和 **claw-code** 展示了如何在同一项目中结合 Python 和 Rust：

**codex 模式**:
```
codex/
├── codex-cli/          # Python CLI wrapper
│   └── package.json
└── codex-rs/           # Rust core implementation
    ├── Cargo.toml
    └── crates/
        ├── core/       # Business logic
        ├── exec/       # Headless CLI
        ├── tui/        # Terminal UI
        └── cli/        # CLI multitool
```

**claw-code 模式**:
```
claw-code/
├── src/                # Python implementation (reference)
│   ├── assistant/
│   ├── coordinator/
│   └── tools/
└── rust/               # Rust rewrite (production)
    ├── Cargo.toml
    └── crates/
        ├── api/        # Provider clients
        ├── runtime/    # Session, config, permissions
        └── tools/      # Tool execution
```

**iota 采用的模式（进程间通信）**:
```
iota/
├── cli/                     # Python CLI launcher
│   ├── __init__.py
│   ├── launcher.py         # Spawn Rust binary using subprocess
│   ├── config.py           # Configuration management
│   └── signals.py          # Signal forwarding (SIGINT, SIGTERM)
│
├── api/                     # Python HTTP API server
│   ├── __init__.py
│   ├── server.py           # FastAPI application
│   ├── routes/
│   │   ├── simulation.py   # /api/simulation/* endpoints
│   │   └── health.py       # /health endpoint
│   └── client.py           # HTTP client for Rust (httpx/aiohttp)
│
├── llm/                     # Python LLM service
│   ├── __init__.py
│   ├── server.py           # HTTP server for Rust callbacks
│   ├── openai_client.py    # OpenAI SDK integration
│   ├── anthropic_client.py # Anthropic SDK integration
│   └── streaming.py        # Streaming response handling
│
├── runtime/                 # Python simulation runtime
│   ├── coordinator/        # Simulation coordinator
│   ├── engines/            # Simulation engines
│   │   ├── environment.py
│   │   ├── user_state.py
│   │   └── behavior.py
│   └── decision/           # Decision engine
│
├── rust/                    # Rust binary (iota)
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs         # Entry point, HTTP server setup
│   │   ├── server/         # HTTP server (axum)
│   │   │   ├── mod.rs
│   │   │   ├── routes.rs   # API routes
│   │   │   └── handlers.rs # Request handlers
│   │   ├── core/           # Core runtime engine
│   │   │   ├── websocket/  # WebSocket manager
│   │   │   ├── session/    # Session manager
│   │   │   ├── logging/    # Log manager
│   │   │   └── evaluation/ # Evaluation engine
│   │   ├── client/         # HTTP client for Python LLM service
│   │   │   ├── mod.rs
│   │   │   └── llm.rs      # LLM client (reqwest)
│   │   └── models/         # Data models (serde)
│   │       ├── mod.rs
│   │       ├── session.rs
│   │       └── request.rs
│   └── tests/
│
└── config/                  # Configuration files
    ├── default.toml        # Default configuration
    └── schema.json         # JSON schema for validation
```

### Integration Lessons (Process-Based Communication)

1. **Process Isolation**: Python 和 Rust 运行在独立进程中，通过 HTTP/JSON-RPC 通信
2. **Data Serialization**: 使用 JSON 在进程边界传递数据（serde_json + orjson）
3. **Error Handling**: HTTP 状态码 + JSON 错误响应，保持错误信息完整
4. **Process Management**: Python 使用 subprocess 管理 Rust 进程生命周期
5. **Health Check**: Rust HTTP 服务器提供 /health 端点，Python 等待就绪

### Performance Optimization Lessons

从 claw-code 和 codex 学到的性能优化经验：

1. **Hot Path in Rust**: 将性能关键路径（WebSocket I/O, 会话状态读写）用 Rust 实现
2. **Async Runtime**: 使用 tokio 异步运行时处理高并发 I/O
3. **Concurrent Data Structures**: 使用 dashmap 等并发数据结构避免锁竞争
4. **Zero-Copy**: 尽可能使用零拷贝技术减少内存分配
5. **Streaming**: 流式处理大数据，避免一次性加载到内存
6. **HTTP Keep-Alive**: 使用 HTTP/1.1 keep-alive 减少连接开销

### Tool System Lessons

从 claude-code 和 claw-code 学到的工具系统设计：

1. **Unified Interface**: 所有工具实现统一接口（execute, validate, describe）
2. **Dynamic Registration**: 工具动态注册，支持插件扩展
3. **Permission Check**: 每个工具执行前检查权限
4. **Error Recovery**: 工具执行失败时的错误恢复和降级策略
5. **Tool Search**: 支持工具搜索和发现机制

### Session Management Lessons

从 claude-code 和 codex 学到的会话管理设计：

1. **State Machine**: 会话状态机（created, running, paused, resumed, terminated）
2. **Persistence**: 会话状态持久化到磁盘，支持恢复
3. **Context Window**: 上下文窗口管理，自动压缩超长上下文
4. **History Tracking**: 完整的历史记录，支持回溯和分析
5. **Concurrent Sessions**: 支持多个并发会话，互不干扰

## Dependencies

### Python Dependencies

```toml
[project]
name = "iota"
version = "0.1.0"
dependencies = [
    "fastapi>=0.100.0",
    "uvicorn>=0.23.0",
    "pydantic>=2.0.0",
    "openai>=1.0.0",
    "anthropic>=0.7.0",
    "httpx>=0.25.0",
    "aiohttp>=3.8.0",
    "orjson>=3.9.0",
    "pandas>=2.0.0",
    "numpy>=1.24.0",
    "matplotlib>=3.7.0",
    "plotly>=5.14.0",
]

[build-system]
requires = ["setuptools>=68.0", "wheel"]
build-backend = "setuptools.build_meta"
```

### Rust Dependencies

```toml
[dependencies]
tokio = { version = "1.35", features = ["full"] }
tokio-tungstenite = "0.21"
axum = "0.7"
reqwest = { version = "0.11", features = ["json", "stream"] }
dashmap = "5.5"
tracing = "0.1"
tracing-subscriber = "0.3"
rayon = "1.8"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
uuid = { version = "1.6", features = ["v4", "serde"] }
anyhow = "1.0"
thiserror = "1.0"
```

### Development Dependencies

```toml
[dev-dependencies]
pytest = ">=7.4.0"
pytest-asyncio = ">=0.21.0"
black = ">=23.0.0"
ruff = ">=0.1.0"
mypy = ">=1.5.0"

[dev-dependencies.rust]
cargo-watch = "8.4"
cargo-nextest = "0.9"
```

## Deployment Architecture

### Development Environment

```bash
# 1. Clone repository
git clone https://github.com/your-org/iota.git
cd iota

# 2. Build Rust binary
cd rust
cargo build --release
cd ..

# 3. Install Python dependencies
pip install -e ".[dev]"

# 4. Run Rust binary standalone (for testing)
./rust/target/release/iota --port 9527

# 5. Run Python CLI (spawns Rust binary)
python -m cli.launcher --rust-binary ./rust/target/release/iota
```

### Production Environment

```bash
# 1. Build Rust binary for production
cd rust
cargo build --release --target x86_64-unknown-linux-musl
cd ..

# 2. Install Python package
pip install .

# 3. Run system (Python spawns Rust)
iota start --config /etc/iota/config.toml
```

### Docker Deployment

```dockerfile
FROM rust:1.75 as rust-builder
WORKDIR /app
COPY core/ ./core/
RUN cd core && cargo build --release

FROM python:3.11-slim
WORKDIR /app
COPY --from=rust-builder /app/core/target/release/libiota_core.so /app/
COPY runtime/ ./runtime/
COPY api/ ./api/
COPY cli/ ./cli/
COPY pyproject.toml ./
RUN pip install --no-cache-dir .
EXPOSE 8000
CMD ["iota", "--config", "/app/config.toml"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: iota-simulation
spec:
  replicas: 3
  selector:
    matchLabels:
      app: iota
  template:
    metadata:
      labels:
        app: iota
    spec:
      containers:
      - name: iota
        image: your-registry/iota:latest
        ports:
        - containerPort: 8000
        env:
        - name: IOTA_CONFIG
          value: "/config/config.toml"
        volumeMounts:
        - name: config
          mountPath: /config
      volumes:
      - name: config
        configMap:
          name: iota-config
```

## Testing Strategy

### Unit Testing

**Python Tests**:
```python
# tests/test_coordinator.py
import pytest
from iota.runtime.coordinator import SimulationCoordinator

@pytest.mark.asyncio
async def test_coordinator_lifecycle():
    coordinator = SimulationCoordinator()
    session = await coordinator.create_session(config)
    assert session.status == "created"
    
    await coordinator.start_session(session.id)
    assert session.status == "running"
```

**Rust Tests**:
```rust
// core/src/websocket/tests.rs
#[tokio::test]
async fn test_websocket_connection() {
    let manager = WebSocketManager::new("ws://localhost:8080");
    let result = manager.connect().await;
    assert!(result.is_ok());
}
```

### Integration Testing

```python
# tests/integration/test_full_simulation.py
@pytest.mark.integration
async def test_full_simulation_cycle():
    # 1. Initialize scenario
    scenario = initialize_scenario(config)
    
    # 2. Run simulation
    result = await run_simulation(scenario)
    
    # 3. Verify results
    assert result.status == "completed"
    assert result.total_turns > 0
    assert result.evaluation.overall_score > 0
```

### Performance Testing

```python
# tests/performance/test_websocket_throughput.py
@pytest.mark.performance
async def test_websocket_throughput():
    manager = WebSocketManager()
    
    start = time.time()
    for i in range(1000):
        await manager.send_and_wait({"id": i})
    duration = time.time() - start
    
    throughput = 1000 / duration
    assert throughput > 100  # > 100 req/s
```

### Mock Testing

```python
# tests/mocks/test_with_mock_llm.py
from unittest.mock import AsyncMock

@pytest.mark.asyncio
async def test_simulation_with_mock_llm():
    mock_llm = AsyncMock()
    mock_llm.generate.return_value = {"content": "mock response"}
    
    coordinator = SimulationCoordinator(llm_service=mock_llm)
    result = await coordinator.execute_turn(session_id)
    
    assert mock_llm.generate.called
    assert result.success
```

## Monitoring and Observability

### Metrics Collection

```python
# iota/runtime/metrics.py
from prometheus_client import Counter, Histogram, Gauge

simulation_turns_total = Counter(
    'iota_simulation_turns_total',
    'Total number of simulation turns'
)

simulation_duration_seconds = Histogram(
    'iota_simulation_duration_seconds',
    'Simulation duration in seconds'
)

active_sessions = Gauge(
    'iota_active_sessions',
    'Number of active simulation sessions'
)
```

### Logging

```rust
// core/src/logging/mod.rs
use tracing::{info, warn, error};

pub fn init_logging() {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .init();
}
```

### Tracing

```python
# iota/runtime/tracing.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider

tracer = trace.get_tracer(__name__)

@tracer.start_as_current_span("simulation_turn")
async def execute_turn(session_id: str):
    with tracer.start_as_current_span("environment_generation"):
        env = await generate_environment()
    
    with tracer.start_as_current_span("decision_making"):
        decision = await make_decision(env)
    
    return decision
```

## Security Considerations

### Authentication & Authorization

```python
# iota/api/auth.py
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer

security = HTTPBearer()

async def verify_token(credentials = Depends(security)):
    token = credentials.credentials
    if not is_valid_token(token):
        raise HTTPException(status_code=401, detail="Invalid token")
    return token
```

### Input Validation

```python
# iota/api/models.py
from pydantic import BaseModel, Field, validator

class SimulationRequest(BaseModel):
    scenario_type: str = Field(..., regex="^(commute|leisure|business|emergency)$")
    max_turns: int = Field(default=10, ge=1, le=100)
    
    @validator('scenario_type')
    def validate_scenario_type(cls, v):
        allowed = ['commute', 'leisure', 'business', 'emergency']
        if v not in allowed:
            raise ValueError(f'scenario_type must be one of {allowed}')
        return v
```

### Rate Limiting

```python
# iota/api/middleware.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/simulation/start")
@limiter.limit("10/minute")
async def start_simulation(request: SimulationRequest):
    return await coordinator.start_simulation(request)
```

### Secrets Management

```python
# iota/config/secrets.py
import os
from cryptography.fernet import Fernet

def load_secret(key: str) -> str:
    # Load from environment variable
    if value := os.getenv(key):
        return value
    
    # Load from encrypted file
    cipher = Fernet(os.getenv("IOTA_ENCRYPTION_KEY"))
    with open(f"/secrets/{key}", "rb") as f:
        encrypted = f.read()
    return cipher.decrypt(encrypted).decode()
```

## Conclusion

本设计文档定义了智能座舱仿真智能体系统的完整技术架构，采用 Python + Rust 混合架构，核心运行时引擎命名为 "iota"。系统参考了 claude-code、claw-code、codex、gemini-cli 和 opencode 等成熟智能体系统的实现模式，在保持开发灵活性的同时获得性能关键路径的高性能。

系统严格遵循 requirements.md 中定义的四层架构和五条关键链路，通过模块化设计、清晰的接口定义和完善的测试策略，确保系统的可维护性、可扩展性和可靠性。
