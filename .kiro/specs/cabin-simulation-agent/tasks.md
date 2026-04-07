# Implementation Plan: cabin-simulation-agent

## Overview

This implementation plan converts the cabin simulation agent design into a series of incremental coding tasks. The system is a pure Python intelligent cabin simulation agent using asyncio for high-performance simulation, following a four-layer architecture with five key chains. The core runtime engine is named "iota".

## Tasks

- [ ] 1. Set up project structure and core dependencies
  - Create iota package directory structure following the design specification
  - Create setup.py or pyproject.toml with all required dependencies (FastAPI, asyncio, websockets, Pydantic, structlog, OpenAI SDK, Anthropic SDK, orjson, aiofiles)
  - Create configuration files (default.toml, schema.json)
  - Set up virtual environment and install dependencies
  - Create __init__.py files for all packages
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 16.5, 17.1_

- [ ] 2. Implement core data models (Pydantic)
  - [ ] 2.1 Create scenario and session models
    - Implement ScenarioConfig model with travel_purpose, start_location, end_location, personnel_config, scene_config
    - Implement SessionContext model with current_task, task_steps, pending_confirmations, previous_responses
    - Implement Session model with session_id, status (running/completed/aborted), scenario, context, turn_count, max_turns
    - _Requirements: 1.2, 6.1, 10.2_

  - [ ] 2.2 Create environment data models
    - Implement ExternalEnvironmentData model with weather, traffic_conditions, road_conditions, time_of_day
    - Implement InternalEnvironmentData model with temperature, air_quality, lighting, seat_position
    - Implement VehicleState model with speed, location, fuel_level, system_status
    - _Requirements: 3.1, 3.2_

  - [ ] 2.3 Create user state and behavior models
    - Implement UserProfile model with persona, knowledge_background, physical_state, emotional_state
    - Implement UserBehaviorData model with interaction_type (voice/button/touch/gesture), content, timestamp
    - Implement SystemResponse model with response_status, response_content, completion_flag, timestamp
    - _Requirements: 4.1, 7.2, 8.2_

  - [ ] 2.4 Create memory and evaluation models
    - Implement MemoryData model with personalized_preferences, realtime_context_window, knowledge_base
    - Implement EvaluationMetrics model with behavior_rationality, response_accuracy, scenario_coverage, response_timeliness
    - _Requirements: 5.1, 9.1_

- [ ] 3. Implement LLM service layer
  - [ ] 3.1 Create LLM service interface and providers
    - Implement LLMService base class with async generate() method
    - Implement OpenAIProvider with AsyncOpenAI client integration
    - Implement AnthropicProvider with AsyncAnthropic client integration
    - Add provider selection logic based on model name
    - Add token usage tracking
    - _Requirements: 15.7, 16.7_

  - [ ] 3.2 Create prompt templates
    - Create environment perception prompt template (environment.py)
    - Create user state simulation prompt template (user_state.py)
    - Create user behavior simulation prompt template (behavior.py)
    - Create decision generation prompt template (decision.py)
    - Create response analysis prompt template (response_analysis.py)
    - _Requirements: 16.7_

  - [ ]* 3.3 Add streaming response support
    - Implement streaming response handling for LLM calls
    - Add incremental rendering support
    - Add cancellation support
    - _Requirements: 16.6_

- [ ] 4. Implement core runtime components
  - [ ] 4.1 Implement WebSocket manager
    - Create WebSocketManager class with async connect(), send_and_receive(), close() methods
    - Implement connection pooling with Dict[str, WebSocketClientProtocol]
    - Add auto-reconnect logic with max retry attempts (3 times)
    - Add heartbeat mechanism
    - Add timeout handling
    - _Requirements: 15.4, 16.8_

  - [ ] 4.2 Implement session manager
    - Create SessionManager class with create_session(), get_session(), update_status() methods
    - Use in-memory dictionary for session storage
    - Implement thread-safe access using asyncio locks
    - Add session CRUD operations
    - _Requirements: 16.3_

  - [ ] 4.3 Implement async log manager
    - Create LogManager class with async start(), stop(), log_turn() methods
    - Use asyncio.Queue for non-blocking log processing
    - Implement background worker task for writing logs
    - Use structlog for structured logging
    - Use aiofiles for async file I/O
    - Log format: JSON with session_id, turn_id, timestamp, env_data, user_state_data, behavior_data, response, execution_status
    - _Requirements: 15.6, 16.9_

  - [ ] 4.4 Implement evaluation engine
    - Create EvaluationEngine class with async evaluate() method
    - Implement behavior rationality scoring
    - Implement response accuracy scoring
    - Implement scenario coverage calculation
    - Implement response timeliness measurement
    - Aggregate scores into EvaluationMetrics
    - _Requirements: 9.1, 9.2_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement intervention layer (干预层)
  - [ ] 6.1 Implement scenario initialization
    - Create ScenarioInitializer class with async initialize() method
    - Generate travel_purpose, start_location, end_location based on business config
    - Generate personnel_config and scene_config
    - Return ScenarioConfig that will be sent to environment, user state, and memory modules
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 6.2 Implement sudden noise module
    - Create SuddenNoiseGenerator class with async inject_noise() method
    - Support four noise types: traffic_accident, hot_event, personal_emergency, life_work_event
    - Implement noise injection to environment and user state modules via noise disturbance chain
    - Ensure noise does not directly modify orchestrator, behavior, or evaluation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 14.1, 14.2, 14.3, 14.4_

- [ ] 7. Implement input support modules (输入支撑模块)
  - [ ] 7.1 Implement environment perception simulation
    - Create EnvironmentPerceptionSimulation class with async generate() method
    - Call LLM to generate external environment (weather, traffic, road, time)
    - Call LLM to generate internal environment (temperature, air quality, lighting, seat)
    - Generate vehicle state (speed, location, fuel, system status)
    - Accept feedback from target system response via environment & user feedback chain
    - Accept noise injection via noise disturbance chain
    - Provide current environment context to orchestrator
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 11.1_

  - [ ] 7.2 Implement user state simulation
    - Create UserStateSimulation class with async generate() method
    - Call LLM to generate user profile (persona, knowledge, physical state, emotional state)
    - Initialize user state based on scenario initialization
    - Update user state based on environment changes
    - Accept feedback from target system response via environment & user feedback chain
    - Accept noise injection via noise disturbance chain
    - Provide current user state context to orchestrator
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 11.2_

  - [ ] 7.3 Implement long-short term memory module
    - Create MemoryModule class with async get_context(), update() methods
    - Maintain personalized_preferences, realtime_context_window, knowledge_base
    - Initialize memory based on scenario initialization
    - Accept behavior updates via memory update chain
    - Accept evaluation updates via memory update chain
    - Provide memory context to orchestrator
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 13.1, 13.2, 13.3_

- [ ] 8. Implement upper decision orchestration layer (上层决策编排层)
  - [ ] 8.1 Implement simulation orchestration decision maker
    - Create SimulationOrchestrator class with async run_until_complete() method (outer loop)
    - Implement async execute_turn() method (inner loop) with parallel execution of environment and user state
    - Implement on-demand context fetching from environment, user state, and memory modules
    - Call LLM for situation understanding & reasoning
    - Call LLM for requirement analysis & mining
    - Call LLM for long-term planning & short-term strategy
    - Call LLM for user intent inference
    - Generate strategy and intent for current turn
    - Provide strategy to user behavior simulation
    - Receive structured response from target system call
    - Implement main simulation loop (execute_turn, analyze_and_decide, update_status)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_
  
  - [ ] 8.2 Implement next-round decision logic (analyze_and_decide method)
    - Implement hard termination condition checks (max_turns, user_interrupt)
    - Implement completion flag check from target system response
    - Implement LLM-based intelligent decision making
    - Build decision prompt with response, evaluation, context, and turn constraints
    - Parse LLM decision response with fallback strategy
    - Return Decision object with should_continue, reason, session_status, confidence
    - Log all decision details for traceability
    - _Requirements: 6.4, 10.7, Property 26_
  
  - [ ] 8.3 Implement loop detection mechanism
    - Create LoopDetector class with configurable threshold (default: 3)
    - Implement response content hashing for similarity detection
    - Detect consecutive identical responses (exact match)
    - Integrate loop detection into analyze_and_decide logic
    - Add loop detection result to decision logging
    - _Requirements: Design: Loop Detection (inspired by Gemini CLI)_
  
  - [ ] 8.4 Implement error recovery and retry logic
    - Create execute_turn_with_retry wrapper with exponential backoff
    - Handle WebSocket errors with reconnection attempts
    - Handle LLM errors with retry for transient failures
    - Classify errors as retryable vs non-retryable
    - Log all retry attempts and final outcomes
    - _Requirements: 16.8, Design: Error Recovery_
  
  - [ ] 8.5 Implement feedback chain updates (async, non-blocking)
    - Create _update_feedback_chains async method
    - Send response feedback to environment perception via environment & user feedback chain
    - Send response feedback to user state via environment & user feedback chain
    - Send behavior to memory via memory update chain
    - Send evaluation to memory via memory update chain
    - Use asyncio.create_task for non-blocking execution
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 12.1, 12.2, 12.3, 13.1, 13.2, 13.3_

- [ ] 9. Implement lower execution feedback layer (下层执行反馈层)
  - [ ] 9.1 Implement user behavior simulation
    - Create UserBehaviorSimulation class with async generate() method
    - Call LLM to generate user behavior based on orchestrator strategy
    - Support voice (primary), button, touch interaction types
    - Reserve gesture capability for future extension
    - Provide behavior result to target system call module
    - Send behavior to evaluation via quantitative evaluation chain
    - Send behavior to memory via memory update chain
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 12.1_

  - [ ] 9.2 Implement target system call and response parsing
    - Create TargetSystemCallModule class with async call_and_parse() method
    - Use WebSocketManager to send behavior request to target system
    - Receive response from target system
    - Call LLM to parse response into structured format (response_status, response_content, completion_flag)
    - Provide structured response to orchestrator
    - Send response feedback to environment via environment & user feedback chain
    - Send response feedback to user state via environment & user feedback chain
    - Send response to evaluation via quantitative evaluation chain
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 11.1, 11.2, 11.3, 11.4, 12.2_

  - [ ] 9.3 Wire evaluation engine into execution feedback layer
    - Integrate EvaluationEngine to receive behavior from user behavior simulation
    - Integrate EvaluationEngine to receive response from target system call
    - Calculate evaluation metrics (behavior rationality, response accuracy, scenario coverage, response timeliness)
    - Send evaluation results to memory via memory update chain
    - Send evaluation results to orchestrator for decision making
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 12.1, 12.2, 12.3, 13.2_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement HTTP API server (FastAPI)
  - [ ] 11.1 Create FastAPI application and routes
    - Create FastAPI app with lifespan context manager
    - Implement POST /api/simulation/start endpoint to create session and start simulation
    - Implement GET /api/simulation/{session_id}/status endpoint to get session status
    - Implement POST /api/simulation/{session_id}/stop endpoint to stop simulation
    - Implement GET /health endpoint for health check
    - Add Pydantic models for request/response validation
    - _Requirements: 15.3, 17.1_

  - [ ] 11.2 Wire all components together in API layer
    - Initialize global components (SessionManager, WebSocketManager, LogManager, LLMService)
    - Create SimulationOrchestrator with all dependencies
    - Run simulation in background using asyncio.create_task()
    - Handle startup and shutdown lifecycle (start log manager, close websocket connections)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

- [ ] 12. Implement CLI entry point
  - [ ] 12.1 Create CLI commands
    - Create CLI using Click or Typer
    - Implement `iota start` command to start FastAPI server
    - Add --config flag for configuration file path
    - Add --host and --port flags for server binding
    - Load configuration from TOML file
    - _Requirements: 16.5, 17.1_

  - [ ] 12.2 Create __main__.py entry point
    - Create iota/__main__.py to enable `python -m iota` execution
    - Call CLI main function
    - _Requirements: 17.1_

- [ ] 13. Add configuration management
  - [ ] 13.1 Create default configuration
    - Create config/default.toml with default settings (LLM models, max turns, timeouts, log paths)
    - Create config/schema.json for configuration validation
    - _Requirements: 16.5_

  - [ ] 13.2 Implement configuration loading
    - Create ConfigLoader class to load TOML configuration
    - Support config hierarchy: global (~/.iota/config.toml), project (.iota/config.toml), runtime (--config flags)
    - Validate configuration against schema
    - _Requirements: 16.5_

- [ ] 14. Add error handling and retry mechanisms
  - [ ] 14.1 Implement error classification
    - Create error classes for retryable and non-retryable errors
    - Classify WebSocket errors (connection, timeout, protocol)
    - Classify LLM errors (rate limit, API error, timeout)
    - _Requirements: 16.8_

  - [ ] 14.2 Add retry logic to WebSocket manager
    - Implement exponential backoff for reconnection
    - Add max retry attempts configuration
    - Log retry attempts
    - _Requirements: 16.8_

  - [ ] 14.3 Add retry logic to LLM service
    - Implement retry for transient LLM errors
    - Add timeout handling
    - Log retry attempts
    - _Requirements: 16.8_

- [ ] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Create deployment files
  - [ ] 16.1 Create requirements.txt and setup.py
    - List all production dependencies in requirements.txt
    - List all development dependencies in requirements-dev.txt
    - Create setup.py or pyproject.toml for package installation
    - _Requirements: 15.9, 18.1, 18.2, 18.6_

  - [ ] 16.2 Create Dockerfile
    - Create Dockerfile with Python 3.11+ base image
    - Copy requirements.txt and install dependencies
    - Copy application code
    - Expose port 8000
    - Set CMD to run uvicorn
    - _Requirements: 18.3, 18.5_

  - [ ] 16.3 Create docker-compose.yml
    - Define iota service with build context
    - Map port 8000
    - Set environment variables for API keys
    - Mount config and logs volumes
    - Set restart policy
    - _Requirements: 18.5_

  - [ ] 16.4 Create README.md with setup instructions
    - Document development setup (venv, pip install, run commands)
    - Document production deployment (uvicorn, gunicorn, Docker)
    - Document configuration options
    - Document API endpoints
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

- [ ] 17. Final integration and testing
  - [ ] 17.1 Verify main simulation chain execution order
    - Test that scenario initialization completes before environment/user state/memory initialization
    - Test that orchestrator waits for all input support modules before generating strategy
    - Test that behavior simulation waits for orchestrator strategy
    - Test that target system call waits for behavior
    - Test that evaluation waits for behavior and response
    - _Requirements: Property 1, 10.3_

  - [ ] 17.2 Verify feedback chains
    - Test environment & user feedback chain: target system response updates environment and user state
    - Test quantitative evaluation chain: behavior and response flow to evaluation
    - Test memory update chain: behavior and evaluation results update memory
    - Test noise disturbance chain: noise affects environment and user state only
    - _Requirements: Property 2, 11.1, 11.2, 11.3, 11.4, 12.1, 12.2, 12.3, 13.1, 13.2, 13.3, 14.1, 14.2, 14.3, 14.4_

  - [ ] 17.3 Verify multi-turn simulation
    - Test that memory is continuous across turns
    - Test that orchestrator correctly decides to continue or end based on response, evaluation, and turn count
    - Test that session status transitions correctly (running -> completed/aborted)
    - _Requirements: Property 3, Property 4, 6.4, 10.7_

  - [ ] 17.4 Verify parallel execution
    - Test that environment and user state simulations execute in parallel
    - Test that behavior simulation waits for both environment and user state
    - _Requirements: Design: Parallel Execution Optimization_

- [ ] 18. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- All components use asyncio for high-performance async I/O
- The system is a single-process Python application with no inter-process communication
- LLM calls are made by: environment perception, user state, behavior simulation, orchestrator (decision making), and target system response parsing
- The orchestrator is the only component that decides whether to continue or end the simulation

## Main Loop Architecture

The system implements a **dual-loop + state-driven** architecture inspired by mature agent systems:

### Outer Loop (Session-level Control)
- `run_until_complete()` method in SimulationOrchestrator
- Continues while `session.status == 'running'`
- Calls `execute_turn()` for each iteration
- Calls `analyze_and_decide()` after each turn to determine continuation
- Updates session status based on decision
- Exits when `should_continue == False` or max turns reached

### Inner Loop (Turn-level Execution)
- `execute_turn()` method executes a single simulation turn
- Parallel execution of environment and user state simulations (asyncio.gather)
- Sequential execution of behavior, target system call, and evaluation
- Async feedback chain updates (non-blocking)
- Async logging (non-blocking)
- Returns TurnResult with all execution data

### Decision Logic (Next-Round Judgment)
- `analyze_and_decide()` method determines whether to continue
- **Priority 1**: Hard termination conditions (max_turns, user_interrupt)
- **Priority 2**: Completion flag from target system
- **Priority 3**: LLM-based intelligent decision
- **Safety net**: Loop detection (consecutive identical responses)
- All decisions are logged with reason and confidence

### Error Recovery
- `execute_turn_with_retry()` wrapper with exponential backoff
- WebSocket reconnection on connection errors
- LLM retry on transient failures
- Error classification (retryable vs non-retryable)

### Reference Implementations
The main loop design references the following mature agent systems:
- **Claude Code (TypeScript)**: Single-core `queryLoop` with while(true) and explicit returns
- **Codex (Rust)**: Four-layer architecture (submission_loop → run_turn → run_sampling_request → try_run_sampling_request)
- **Gemini CLI (TypeScript)**: Three-layer async generators + UI hook for loop closure
- **OpenCode (TypeScript)**: Dual while(true) loops + SQLite persistence for crash recovery

Our implementation adopts:
- Dual-loop structure for clear separation of concerns
- State-driven continuation via session status
- LLM-based decision making (inspired by Claude Code) for intelligent termination
- Loop detection (inspired by Gemini CLI) to prevent infinite loops
- Async feedback chains (common pattern across all references) for non-blocking updates
