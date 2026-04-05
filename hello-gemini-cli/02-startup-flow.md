---
layout: content
title: "启动链路：从入口到运行模式的分发"
---
# 启动链路：从入口到运行模式的分发

Gemini CLI 的启动不仅仅是加载 UI，它包含了一个复杂的环境预热与权限校验链。

## 1. 启动全景图

```mermaid
%%{init: {'theme': 'neutral'}}%%
flowchart LR
    Main["packages/cli/src/gemini.tsx<br/>main() @ 186"] --> Parse["config.ts<br/>parseArguments() @ 155"]
    Parse --> Setup["加载 settings /<br/>trustedFolders / auth"]
    Setup --> Sandbox{沙箱<br/>需要?}
    Sandbox -->|是| StartSandbox["start_sandbox()<br/>重启进容器/受限进程"]
    Sandbox -->|否| LoadCfg["loadCliConfig()<br/>创建 Config @ config.ts:885"]
    StartSandbox -. "子进程重新<br/>从 main() 开始" .-> Main
    LoadCfg --> InitApp["initializer.ts<br/>initializeApp() @ 38"]
    InitApp --> Mode{交互<br/>模式?}
    Mode -->|是| UI["interactiveCli.tsx<br/>startInteractiveUI() @ 53"]
    Mode -->|否| Headless["nonInteractiveCli.ts<br/>runNonInteractive() @ 58"]

    LoadCfg --> ConfigInit["config.initialize()<br/>@ config.ts:1289"]
    UI -. "useEffect 中调用<br/>config.initialize()" .-> ConfigInit
    Headless -. "直接调用<br/>config.initialize()" .-> ConfigInit
    ConfigInit --> TOOL_INIT["ToolRegistry.discoverAllTools()<br/>@ tool-registry.ts:219"]
    ConfigInit --> MCP_INIT["McpClientManager.startConfiguredMcpServers()<br/>@ mcp-client-manager.ts:34"]
    ConfigInit --> SKILL_INIT["SkillManager.discoverSkills()<br/>@ skillManager.ts:17"]
```

## 2. 核心函数清单 (Function List)

| 函数/方法 | 文件路径 | 行号 | 职责 |
|---|---|---|---|
| `main()` | `packages/cli/src/gemini.tsx` | :186 | 程序入口，参数解析，沙箱决策 |
| `parseArguments()` | `packages/cli/src/config/config.ts` | :155 | Yargs 子命令解析 |
| `loadSandboxConfig()` | `packages/cli/src/config/sandboxConfig.ts` | :126 | 沙箱配置加载（命令检测、镜像路径、allowedPaths） |
| `start_sandbox()` | `packages/cli/src/utils/sandbox.ts` | :46 | 沙箱子进程启动（Docker/LXC/Seatbelt 等） |
| `initializeApp()` | `packages/cli/src/core/initializer.ts` | :38 | Auth 校验、IDE 连接预热、主题验证；返回 `InitializationResult` |
| `Config._initialize()` | `packages/core/src/config/config.ts` | :1299 | 工具注册/MCP 启动/Skill 发现/Hook 系统初始化/GeminiClient 初始化 |
| `startInteractiveUI()` | `packages/cli/src/interactiveCli.tsx` | :53 | React + Ink TUI 挂载 |
| `runNonInteractive()` | `packages/cli/src/nonInteractiveCli.ts` | :58 | Headless stdin/stdout 模式 |
| `loadTrustedFolders()` | `packages/cli/src/config/trustedFolders.ts` | :249 | 工作区信任校验 |

## 3. 核心初始化顺序

### 3.1 参数解析 (Yargs)
系统在 `packages/cli/src/config/config.ts` 中使用 `yargs` 定义了丰富的子命令和运行标志。解析后的 `argv` 决定了：
- 运行模式（交互 vs. 非交互）
- 认证方式
- 是否启用特定的扩展或 MCP 服务

### 3.2 沙箱隔离：重启动模式与实际差异

#### 什么是沙箱
沙箱是一种**进程级隔离**机制。当启用沙箱时，Gemini CLI 不是在当前进程直接运行，而是通过 `start_sandbox()` **重新拉起一个子进程**在受限环境中执行。当前进程等待子进程结束后一同退出。

#### 沙箱决策流程

```mermaid
%%{init: {'theme': 'neutral'}}%%
flowchart TD
    Entry["main() 检查 !SANDBOX<br/>gemini.tsx:389"]
    Entry -->|已在沙箱| Direct["直接在宿主进程运行"]
    Entry -->|首次启动| Resolve["getSandboxCommand() 解析<br/>sandboxConfig.ts:43"]
    Resolve --> Env["GEMINI_SANDBOX 环境变量?<br/>sandboxConfig.ts:52-57"]
    Env -->|有值| EnvVal["取 toLowerCase().trim() 值"]
    Env -->|无值| ArgVal["取 argv.sandbox 或 settings.tools.sandbox"]
    EnvVal --> Normalize["类型归一化<br/>sandboxConfig.ts:58-59"]
    ArgVal --> Normalize
    Normalize -->|false| Direct
    Normalize -->|字符串| Explicit["显式指定命令<br/>sandboxConfig.ts:65-98"]
    Normalize -->|true| Auto["自动检测<br/>sandboxConfig.ts:101-123"]
    Explicit --> Validate["命令存在性 & 平台支持<br/>sandboxConfig.ts:74-97"]
    Validate -->|失败| Error["抛出 FatalSandboxError"]
    Validate -->|成功| ReturnCmd["返回命令字符串"]
    Auto --> Darwin?["平台 darwin?<br/>sandboxConfig.ts:104"]
    Darwin? -->|是| SB?["sandbox-exec 存在?<br/>sandboxConfig.ts:104"]
    Darwin? -->|否| Docker?["docker 存在?<br/>sandboxConfig.ts:106"]
    SB? -->|是| ReturnSeatbelt["返回 sandbox-exec"]
    SB? -->|否| Docker?
    Docker? -->|是| ReturnDocker["返回 docker"]
    Docker? -->|否| Podman?["podman 存在?<br/>sandboxConfig.ts:108"]
    Podman? -->|是| ReturnPodman["返回 podman"]
    Podman? -->|否| NoCmd["sandbox=true 但无容器命令<br/>sandboxConfig.ts:113-118"]
    Direct --> MainFlow["loadCliConfig() 正常启动"]
    ReturnCmd --> LoadCfg["loadSandboxConfig() 组装完整配置<br/>sandboxConfig.ts:126"]
    ReturnSeatbelt --> LoadCfg
    ReturnDocker --> LoadCfg
    ReturnPodman --> LoadCfg
    LoadCfg -->|有 image 或原生沙箱| Spawn["start_sandbox() 重启进容器<br/>sandbox.ts:46"]
    Spawn -. "子进程重新从 main() 开始" .-> Entry
    Error --> H["程序退出"]
```

#### 沙箱内外：实际差异对比

| 维度 | 无沙箱 | 有沙箱 |
|---|---|---|
| **文件系统** | 完全访问宿主机所有文件 | 只能访问工作目录、配置目录、明文允许的路径；其他路径对沙箱内进程不可见 |
| **网络访问** | 完全网络访问 | 可配置为完全隔离（`networkAccess: false`）或通过代理有限访问 |
| **进程环境** | 继承宿主所有环境变量 | 仅传递白名单内的环境变量（API key、模型配置、IDE 端口等） |
| **写操作** | 直接写入宿主机文件系统 | 写操作仅在挂载的卷内生效，容器退出后消失（Docker `--rm`） |
| **Shell 工具** | 直接执行宿主机上的任意命令 | 只能执行沙箱镜像内预设的工具链 |

#### 关键机制：环境变量过滤

`start_sandbox()` 仅传递以下环境变量进沙箱：

```typescript
// 必传：API 凭证
GEMINI_API_KEY / GOOGLE_API_KEY

// 可选：自定义后端
GOOGLE_GEMINI_BASE_URL / GOOGLE_VERTEX_BASE_URL

// 可选：模型配置
GOOGLE_GENAI_USE_VERTEXAI / GOOGLE_GENAI_USE_GCA
GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION
GEMINI_MODEL

// 传递：终端配置
TERM / COLORTERM

// 传递：IDE 集成
GEMINI_CLI_IDE_SERVER_PORT / GEMINI_CLI_IDE_WORKSPACE_PATH
TERM_PROGRAM
```

#### 关键机制：文件系统挂载（Docker/Podman）

沙箱内可见的路径是明确挂载的：

```
宿主机路径              →  容器内路径
─────────────────────────────────────────
当前工作目录 (cwd)      →  相同绝对路径（读写）
~/.gemini (用户配置)    →  /home/node/.gemini（读写）
os.tmpdir()            →  相同路径（读写）
~/.config/gcloud       →  只读挂载
$GOOGLE_APPLICATION_CREDENTIALS → 只读挂载
sandbox.venv/          →  替换 VIRTUAL_ENV（若工作目录内）
```

`config.allowedPaths` 中的路径以**只读**方式额外挂载。

#### 关键机制：网络隔离

- `networkAccess: true`（默认）：沙箱加入 `gemini-cli-network` 虚拟网络，可访问外部互联网
- `networkAccess: false`：加入内部网络，完全阻断外网访问
- 配合 `GEMINI_SANDBOX_PROXY_COMMAND`：通过代理容器中转流量，可同时满足"有代理"与"隔离网络"

#### 关键机制：Seatbelt（macOS）

macOS 上使用 `sandbox-exec`，通过 `.sb` 配置文件（沙箱 profile）限制系统调用：

```
允许：read / write（仅允许的目录）
允许：网络（可配置）
禁止：fork / exec（除明确批准的二进制）
```

可自定义 `SEATBELT_PROFILE`（默认 `permissive-open`）。

#### 如何启用

**方式一：命令行参数**
```bash
gemini --sandbox                  # 自动检测 docker/podman
gemini --sandbox docker            # 强制使用 docker
gemini --sandbox=false             # 禁用沙箱
```

**方式二：环境变量**
```bash
GEMINI_SANDBOX=true
GEMINI_SANDBOX=docker
```

**方式三：settings.json**
```json
{
  "tools": {
    "sandbox": {
      "enabled": true,
      "command": "docker",
      "networkAccess": false,
      "allowedPaths": ["/Users/me/shared-code"]
    }
  }
}
```

#### 宿主机重启的本质

当 `main()` 检测到需要沙箱时：
1. 父进程准备所有启动参数（环境变量、挂载卷、命令行参数）
2. 通过 `spawn()` 启动沙箱子进程（docker run / sandbox-exec / lxc exec）
3. **父进程 stdin 暂停**，等待子进程
4. 子进程退出后，父进程将子进程退出码作为自己的退出码

沙箱子进程是一个**全新的 Node.js 进程**，它重新走一遍 `main()`，但这次 `process.env['SANDBOX']` 已有值，所以不会再次触发沙箱重启。

### 3.3 运行时核心初始化
通过 `initializer.ts` 的 `initializeApp(config, settings)` 执行启动前预热，返回 `InitializationResult`。此过程依次完成：
- Auth 状态校验与刷新
- IDE 连接状态预热（`IdeClient.connect()`）
- 主题验证

真正的运行时初始化（`Config._initialize()`）发生在模式分发之后：
- **交互模式**：`config.initialize()` 在 `AppContainer.tsx` 的 `useEffect` 中被调用，UI 先挂起再后台完成工具/MCP 初始化
- **非交互模式**：`config.initialize()` 在 `gemini.tsx:627` 同步调用，必须等待初始化完成后才执行

## 4. 运行模式分发

Gemini CLI 支持两种主要的运行模式，它们共享相同的 `packages/core` 核心，但外壳协议不同：

### 4.1 交互模式 (Interactive TUI)
调用 `startInteractiveUI()`。它会初始化 React + Ink 容器 `AppContainer`，将整个 TUI 挂载到终端。此模式下，状态管理由 React Context 和 `UIStateContext` 驱动。

### 4.2 非交互模式 (Non-Interactive Headless)
调用 `runNonInteractive()`（`gemini-cli/packages/cli/src/nonInteractiveCli.ts`）。
- **同步 IO**：从 stdin 读取输入，并将其折叠成一次 Agent Loop 执行。
- **线性输出**：适合流水线集成，支持以 JSON 格式输出结果。

## 5. 代码质量评估 (Code Quality Assessment)

### 5.1 优点
- **沙箱策略前置**：沙箱决策在 `main()` 早期完成，避免核心逻辑在非沙箱环境下泄露。
- **初始化分层**：`loadCliConfig()` 创建 `Config` 实例后，`initializeApp()` 做预热，TUI/Headless 才 fork，职责清晰。
- **按需初始化**：交互模式下工具/MCP 后台初始化，UI 快速响应；非交互模式同步等待初始化完成，保证执行稳定性。

### 5.2 改进点
- **`main()` 方法过长**：363-418 行的单一方法混合了日志初始化、参数解析、沙箱检测、模式分发等多重逻辑，建议拆分为 `bootstrap()` → `resolveSandbox()` → `dispatchMode()` 三个方法。
- **沙箱检测与重启耦合**：检测到需要沙箱时直接在 `main()` 中调用 `loadSandboxConfig` 重新拉起自身，这种"自我替换"模式难以测试，建议提取为独立进程管理器。
- **Headless 模式缺少会话恢复路径**：`runNonInteractive()` 不支持 `--resume`，长流程任务无法断点续跑。

### 5.3 章节导航 (Chapter Breakdown)

| 子章节 | 核心议题 |
|---|---|
| §1 启动全景图 | main() → loadCliConfig() → initializeApp() → TUI/Headless → config.initialize() |
| §2 核心函数清单 | 关键函数的源码定位 |
| §3 初始化顺序 | loadCliConfig() 创建 Config → initializeApp() 预热 → 模式分发 → config.initialize() |
| §3.2 沙箱隔离 | 有无沙箱的实际差异：文件系统、网络、环境变量；六种沙箱实现；配置方式 |
| §4 模式分发 | 交互 vs. 非交互的协议差异；initialize() 调用时机的差异 |
| §5 代码质量 | main() 臃肿、沙箱自重启难测试、Headless 缺 resume |

---

> 关联阅读：[03-agent-loop.md](./03-agent-loop.md) 深入了解模式分发后的执行主循环。
