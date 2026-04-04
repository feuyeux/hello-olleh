---
layout: content
title: "Hooks 与生命周期：Gemini CLI 的事件回调与扩展点"
---
# Hooks 与生命周期：Gemini CLI 的事件回调与扩展点

这一层在当前仓库里其实分成三套机制：`HookSystem`、`coreEvents`、`MessageBus`。旧版把它们混成一个“内部事件总线”，容易把职责写乱。

## 1. 进程主链路上的关键阶段

按当前代码，更接近真实的主流程是：

1. CLI 入口初始化 `Config`
2. 初始化 `HookSystem`、`MessageBus`、`GeminiClient`
3. 启动交互式 TUI 或非交互式 CLI
4. 用户输入进入 `GeminiClient` 主循环
5. 主循环在模型调用前后、工具选择前后、压缩前后触发不同 hook
6. 调度器通过 `MessageBus` 处理确认与策略
7. UI 和宿主层通过 `coreEvents` 接收用户反馈、日志和状态更新

这里的关键对象已经不是旧文里写的 `GeminiAgent`，而是 `GeminiClient`、`Scheduler`、`HookSystem` 这几层协作。

## 2. HookSystem 是显式的生命周期扩展点

核心实现位于 `packages/core/src/hooks/hookSystem.ts`。

它不是单文件硬编码逻辑，而是由几部分协作：

- `HookRegistry`
- `HookRunner`
- `HookAggregator`
- `HookPlanner`
- `HookEventHandler`

从 `HookSystem` 暴露的方法看，当前已经有比较完整的 hook 生命周期：

- `fireSessionStartEvent`
- `fireSessionEndEvent`
- `firePreCompressEvent`
- `fireBeforeAgentEvent`
- `fireAfterAgentEvent`
- `fireBeforeModelEvent`
- `fireAfterModelEvent`
- `fireBeforeToolSelectionEvent`
- `fireBeforeToolEvent`
- `fireAfterToolEvent`
- `fireToolNotificationEvent`

这说明 Gemini CLI 并不是“没有 hook，只能靠 MCP 间接扩展”，而是已经有一套正式的 hook 执行框架。

## 3. `coreEvents` 负责全局可观察性

`packages/core/src/utils/events.ts` 里的 `coreEvents` 更像全局事件汇聚点，主要服务于 UI、日志和宿主反馈。

当前 `CoreEvent` 至少包括：

- `UserFeedback`
- `ModelChanged`
- `ConsoleLog`
- `Output`
- `MemoryChanged`
- `McpClientUpdate`
- `HookStart`
- `HookEnd`
- `AgentsRefreshed`
- `RetryAttempt`
- `ConsentRequest`
- `McpProgress`
- `QuotaChanged`

因此，`coreEvents` 的职责重点是“广播状态变化给宿主层”，而不是承担工具确认或策略决策。

## 4. `MessageBus` 负责确认与策略闭环

工具确认和策略检查走的是另一条线：`packages/core/src/confirmation-bus/message-bus.ts`。

`MessageBus` 的特点是：

- 发布工具确认请求
- 在发布时就调用 `PolicyEngine.check(...)`
- 根据策略结果直接放行、拒绝或转交 UI 询问用户
- 支持 request/response 模式
- 支持 `derive(subagentName)`，为子代理生成作用域化消息总线

所以它更像“工具确认总线”，而不是通用 UI event bus。

## 5. 工具执行生命周期在调度器里闭合

旧文里把 `ToolExecutor` 写在 `tools` 目录下已经不对。当前真实位置是：

- `packages/core/src/scheduler/tool-executor.ts`
- `packages/core/src/scheduler/scheduler.ts`

调度器负责：

- 工具选择后的实际执行
- 确认与审批
- 和 hook system / message bus 的衔接
- 在需要时更新 UI 状态

因此，“工具前后生命周期”这件事并不是单靠 `ToolExecutor` 一个类完成，而是 `Scheduler + ToolExecutor + HookSystem + MessageBus` 一起闭合。

## 6. 关键源码锚点

| 主题 | 代码锚点 | 说明 |
| --- | --- | --- |
| Hook 总入口 | `packages/core/src/hooks/hookSystem.ts` | 统一暴露生命周期 hook |
| Hook 事件处理 | `packages/core/src/hooks/hookEventHandler.ts` | 各类 hook 的具体分发 |
| 全局事件总线 | `packages/core/src/utils/events.ts` | UI / 宿主侧状态广播 |
| 工具确认总线 | `packages/core/src/confirmation-bus/message-bus.ts` | 策略检查、确认请求、子代理作用域 |
| 调度器 | `packages/core/src/scheduler/scheduler.ts` | 工具执行主编排 |
| 工具执行器 | `packages/core/src/scheduler/tool-executor.ts` | 单次工具调用执行 |
