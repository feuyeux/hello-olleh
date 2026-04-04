# Gemini CLI 上下文管理：分层记忆、压缩与循环保护

这部分在当前仓库里并不是一个单独的 `budget.ts` 或 `truncation.ts` 模块，而是由多条链路共同完成：记忆加载、系统提示词注入、会话历史裁剪、工具输出遮罩，以及循环检测。

## 1. 当前源码里的真实结构

Gemini CLI 的上下文主要由四层组成：

1. **系统提示词中的全局记忆**：由 `Config.getSystemInstructionMemory()` 提供，并在 `GeminiClient.startChat()` / `updateSystemInstruction()` 中传给 `getCoreSystemPrompt()`。
2. **会话级注入的扩展与项目记忆**：JIT context 打开时，`Config.getSessionMemory()` 会把 extension/project memory 包装成 `<loaded_context>` 片段，放入对话内容，而不是直接塞进 system prompt。
3. **`GeminiChat` 保存的对话历史**：`GeminiChat` 同时维护完整历史与“curated history”，发送请求时优先使用后者。
4. **发送前保护层**：`GeminiClient` 在真正调用模型前会尝试压缩历史、遮罩大体积工具输出，并做循环与上下文溢出检查。

## 2. 分层记忆如何进入上下文

### 2.1 `ContextManager` 负责三类记忆

`packages/core/src/services/contextManager.ts` 把记忆分成三层：

- **global memory**
- **extension memory**
- **project memory**

这些内容来自 `packages/core/src/utils/memoryDiscovery.ts`，后者会扫描 `GEMINI.md` 及其别名文件，并按来源分类、去重、拼接。

### 2.2 JIT context 不是“全量一次性注入”

当 `experimentalJitContext` 打开时，配置层会采用更细的策略：

- `Config.getSystemInstructionMemory()` 只返回 **global memory**
- `Config.getSessionMemory()` 返回 **extension + project memory**
- `ContextManager.discoverContext()` 还能在访问具体路径时，按需加载子目录里的补充记忆

这意味着 Gemini CLI 当前的上下文管理，已经不是“固定窗口里塞完整历史”那种单层模型，而是“系统级 + 会话级 + 按需发现”的分层结构。

## 3. 历史压缩与上下文窗口保护

### 3.1 当前默认 token 上限

`packages/core/src/core/tokenLimits.ts` 里，对当前默认和预览模型统一返回 `1_048_576` token。旧文档里常见的 `32K / 128K` 说法，已经不符合这里的实现。

### 3.2 自动压缩发生在发送前

`GeminiClient` 在真正流式发送前，会先调用 `tryCompressChat()`：

- 调用方：`packages/core/src/core/client.ts`
- 压缩实现：`packages/core/src/services/chatCompressionService.ts`
- 手动入口：`packages/cli/src/ui/commands/compressCommand.ts`

`ChatCompressionService` 的关键策略是：

- 默认在上下文大约达到模型上限的 **50%** 时尝试压缩
- 尽量保留最近约 **30%** 的历史
- 对超大的旧工具输出，不直接丢弃，而是先截断并把完整内容落到项目临时目录

这套实现比“超限后简单删前文”要稳健得多，因为它专门照顾了函数调用返回值过大的场景。

### 3.3 还有一层工具输出遮罩

除了压缩，`GeminiClient` 还会调用 `ToolOutputMaskingService`，把历史中过于臃肿的工具输出进一步瘦身。与此同时，`Config.getTruncateToolOutputThreshold()` 会根据当前剩余上下文动态收紧输出阈值。

如果这些措施之后，本次请求仍然可能超出窗口，客户端会发出 `GeminiEventType.ContextWindowWillOverflow` 事件，而不是盲目继续提交。

## 4. 循环检测并不缺席

旧版分析把 Gemini CLI 记成“没有循环检测”，这已经不准确。当前仓库里有完整的 `LoopDetectionService`：

- 文件：`packages/core/src/services/loopDetectionService.ts`
- 接入点：`packages/core/src/core/client.ts`

它至少包含三类检测：

- **完全相同的工具调用重复**：对 `tool name + args` 做哈希，连续重复超过阈值会判定为循环
- **内容 chanting / 重复输出**：检测流式文本片段的重复模式
- **LLM 辅助检查**：长轮次会话里，定期让模型判断当前是否陷入“无进展循环”

当前实现里的几个显式阈值也能从源码直接看到：

- 相同工具调用阈值：`5`
- 内容重复阈值：`10`
- LLM 检查默认在单个 prompt 内经过 `30` 个 turn 后启动

并且，这个检测器支持按 session 关闭，而不是写死在主循环里。

## 5. `GeminiChat` 保存了什么历史

`packages/core/src/core/geminiChat.ts` 维护的是完整对话历史，而不是只保留“用户消息 + 最终回答”：

- 模型文本
- `functionCall`
- `functionResponse`
- 思考片段与补充内容

`getHistory(curated = true)` 会过滤掉无效或空的 model turn，减少把脏历史继续传给模型的概率。这也是当前 Gemini CLI 上下文治理里很关键的一步。

## 6. 关键源码锚点

| 主题 | 代码锚点 | 说明 |
| --- | --- | --- |
| 分层记忆加载 | `packages/core/src/services/contextManager.ts` | 管 global / extension / project 三层记忆 |
| 记忆发现 | `packages/core/src/utils/memoryDiscovery.ts` | 扫描、分类、去重 `GEMINI.md` |
| 系统提示词记忆注入 | `packages/core/src/config/config.ts` | `getSystemInstructionMemory()` / `getSessionMemory()` |
| 会话历史维护 | `packages/core/src/core/geminiChat.ts` | 保存完整历史并导出 curated history |
| 自动压缩 | `packages/core/src/services/chatCompressionService.ts` | 压缩历史并处理大工具输出 |
| 发送前保护 | `packages/core/src/core/client.ts` | 压缩、遮罩、溢出预警 |
| 循环检测 | `packages/core/src/services/loopDetectionService.ts` | 工具重复、内容重复、LLM 辅助检测 |
| token 上限 | `packages/core/src/core/tokenLimits.ts` | 当前默认模型窗口上限 |
