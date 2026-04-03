---
layout: default
title: "REPL 与交互层：TUI、非交互模式与输入分发"
---
# REPL 与交互层：TUI、非交互模式与输入分发

本文分析 Codex 的交互层实现，包括 TUI 渲染、非交互（headless）模式及输入事件分发机制。

## 1. 双模式入口

Codex 支持两种运行模式，在启动时根据 CLI 参数选择：

```
codex [prompt]
  ├─ 有 prompt 且无 tty → 非交互模式（headless）
  └─ 无 prompt 或有 tty → 交互 TUI 模式
```

```rust
// codex-rs/tui/src/main.rs
if args.prompt.is_some() && !atty::is(Stream::Stdin) {
    run_headless(args).await
} else {
    run_tui(args).await
}
```

## 2. TUI 模式

Codex TUI 基于 `ratatui`（Rust TUI 框架）实现，核心组件：

```
App（顶层状态）
  ├── ChatView（对话历史渲染）
  │     ├── MessageList（消息列表）
  │     └── ToolCallView（工具调用展示）
  ├── InputBox（用户输入框）
  │     └── 键盘事件处理
  └── StatusBar（状态栏：模型/token/审批状态）
```

### 2.1 输入事件循环

```rust
// codex-rs/tui/src/app.rs
loop {
    // 渲染当前帧
    terminal.draw(|f| ui.render(f, &state))?;
    
    // 等待键盘事件
    if let Event::Key(key) = event::read()? {
        match key.code {
            KeyCode::Enter => {
                let input = input_box.take();
                tx.send(Op::UserInput(input)).await?;
            }
            KeyCode::Char('c') if key.modifiers.contains(Modifiers::CTRL) => {
                tx.send(Op::Interrupt).await?;
            }
            _ => input_box.handle_key(key),
        }
    }
    
    // 接收 Agent 输出更新 UI 状态
    while let Ok(event) = rx.try_recv() {
        state.apply(event);
    }
}
```

### 2.2 流式渲染

模型输出通过 channel 实时推送到 TUI，实现字符级流式渲染：

```rust
// 每收到一个 token 就触发重渲染
while let Some(chunk) = stream.next().await {
    state.append_token(chunk);
    // ratatui 的下一帧会自动展示新内容
}
```

## 3. 非交互模式（Headless）

非交互模式用于 CI/脚本场景：

```bash
echo "分析 src/ 目录的代码质量" | codex
# 或
codex "修复所有 clippy 警告" --approval-policy full-auto
```

```rust
// codex-rs/core/src/headless.rs
pub async fn run_headless(prompt: String, config: Config) -> ExitCode {
    let (tx, mut rx) = channel(32);
    let agent = CodexAgent::new(config, tx);
    
    agent.send(Op::UserInput(prompt)).await;
    
    while let Some(event) = rx.recv().await {
        match event {
            AgentEvent::Text(s) => print!("{}", s),
            AgentEvent::Done => break,
            AgentEvent::Error(e) => { eprintln!("{}", e); return ExitCode::FAILURE; }
        }
    }
    ExitCode::SUCCESS
}
```

## 4. 与 Claude Code REPL 的对比

| 特性 | Codex | Claude Code |
|------|-------|-------------|
| **UI 框架** | ratatui（Rust）| Ink（React/Node）|
| **Headless 模式** | ✅ stdin/args | ✅ `--print` / pipe |
| **流式渲染** | ✅ token 级 | ✅ token 级 |
| **Slash 命令** | 少量内置 | 丰富（可扩展）|
| **审批 UI** | 终端内嵌 | 终端内嵌 |
