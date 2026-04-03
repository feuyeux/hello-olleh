---
layout: default
title: "REPL 与交互层：Ink TUI、非交互模式与输入分发"
---
# REPL 与交互层：Ink TUI、非交互模式与输入分发

本文分析 Gemini CLI 的交互层实现，包括基于 Ink 的 TUI 渲染、非交互模式和输入事件处理。

## 1. 双模式架构

```
gemini [--prompt "..."] [--no-interactive]
  ├─ 交互模式（默认）→ Ink TUI
  └─ 非交互模式      → 标准输入/输出
```

```typescript
// packages/cli/src/index.ts
if (flags.noInteractive || !process.stdin.isTTY) {
    await runHeadless(flags);
} else {
    render(<App flags={flags} />);  // Ink TUI
}
```

## 2. Ink TUI 组件树

```
<App>
  ├── <Header>（版本/模型信息）
  ├── <ConversationHistory>（对话历史，滚动）
  │     ├── <UserMessage>
  │     ├── <AssistantMessage>（支持 Markdown 渲染）
  │     └── <ToolCallView>（工具调用展示）
  ├── <InputBox>（用户输入，支持多行）
  └── <StatusBar>（Token 用量/审批状态/运行状态）
```

### 2.1 流式渲染

Ink 基于 React 模型，通过 `useState` + `useEffect` 实现 token 级流式更新：

```typescript
// packages/cli/src/ui/AssistantMessage.tsx
function AssistantMessage({ turnId }: { turnId: string }) {
  const [content, setContent] = useState('');
  
  useEffect(() => {
    messageBus.on('token', (e) => {
      if (e.turnId === turnId) {
        setContent(prev => prev + e.content);
      }
    });
  }, [turnId]);
  
  return <Text>{content}</Text>;
}
```

### 2.2 工具审批 UI

当 `autoAcceptTools` 为 false 时，工具调用前展示审批界面：

```
╔═══════════════════════════════════╗
║  工具调用请求：run_shell_command   ║
║  命令：git commit -m "fix: bug"   ║
║                                   ║
║  [Y] 批准  [N] 拒绝  [A] 全部批准 ║
╚═══════════════════════════════════╝
```

## 3. 非交互模式（Headless）

```bash
# 管道输入
echo "分析 README.md" | gemini

# 直接参数
gemini --prompt "列出所有 TODO 注释" --no-interactive

# CI 场景（自动批准所有工具）
gemini --prompt "运行测试并修复失败" --yolo
```

```typescript
// packages/cli/src/headless.ts
export async function runHeadless(flags: CliFlags) {
  const prompt = flags.prompt ?? await readStdin();
  const agent = new GeminiAgent(config);
  
  for await (const event of agent.run(prompt)) {
    if (event.type === 'token') process.stdout.write(event.content);
    if (event.type === 'error') { process.stderr.write(event.message); process.exit(1); }
  }
}
```

## 4. 输入处理

`InputBox` 组件处理键盘输入，支持：

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 提交输入（单行模式）|
| `Shift+Enter` | 换行（多行模式）|
| `Ctrl+C` | 中断当前 Agent 运行 |
| `Ctrl+D` | 退出 |
| `↑` / `↓` | 历史命令导航 |

## 5. 与 Claude Code REPL 的对比

| 特性 | Gemini CLI | Claude Code |
|------|------------|-------------|
| **UI 框架** | Ink（React/TS）| Ink（React/TS）|
| **Headless** | `--no-interactive` / pipe | `--print` / pipe |
| **Markdown 渲染** | ✅ | ✅ |
| **Slash 命令** | 少量（`/help`, `/clear`）| 丰富（可扩展）|
| **多行输入** | `Shift+Enter` | `Shift+Enter` |
