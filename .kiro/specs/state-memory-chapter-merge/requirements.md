# Requirements Document

## Introduction

本需求文档定义了一个文档重构特性，旨在合并和重新组织四个 AI Coding CLI 项目（hello-claude-code、hello-codex、hello-gemini-cli、hello-opencode）中关于状态管理、上下文管理和记忆系统的章节。当前这些主题分散在第 5 章（state-management）、第 11 章（context-management）和第 16 章（memory-system）中，导致相关概念被人为分割。本次重构将这三章合并为新的第 4 章，删除原有章节，并重新编号所有受影响的章节，同时更新 hello-harness 中的横向对比分析。

## Glossary

- **Documentation_System**: 本项目的文档系统，包含 hello-claude-code、hello-codex、hello-gemini-cli、hello-opencode 四个项目目录及 hello-harness 横向分析目录
- **Chapter**: 文档系统中的单个 Markdown 文件，使用数字前缀编号（如 05-state-management.md）
- **State_Management**: 状态管理章节（当前为第 5 章），描述运行时状态、会话持久化和并发控制
- **Context_Management**: 上下文管理章节（当前为第 11 章），描述上下文窗口管理、token 优化和上下文策略
- **Memory_System**: 记忆系统章节（当前为第 16 章），描述长期记忆、知识管理和上下文治理
- **Chapter_Renumbering**: 章节重新编号操作，更新文件名和内部引用
- **Cross_Project_Analysis**: hello-harness 目录中的横向对比分析文档

## Requirements

### Requirement 1: 合并状态管理、上下文管理和记忆系统章节

**User Story:** 作为文档读者，我希望在一个统一的章节中理解状态/上下文/会话/记忆的完整机制，这样我就能理解它们如何协同工作而不是孤立地阅读三个分离的章节。

#### Acceptance Criteria

1. THE Documentation_System SHALL 为每个项目（hello-claude-code、hello-codex、hello-gemini-cli、hello-opencode）创建新的 04-state-session-memory.md 文件
2. WHEN 创建新章节时，THE Documentation_System SHALL 合并原 05-state-management.md、11-context-management.md 和 16-memory-system.md 的内容
3. THE Documentation_System SHALL 在新章节中包含两个主要部分：实现机制（implementation mechanisms）和实际使用模式（practical usage patterns）
4. THE Documentation_System SHALL 确保新章节解释状态/上下文/会话/记忆如何在实际场景中被使用，而不仅仅是技术实现
5. THE Documentation_System SHALL 在新章节中保留所有原有的代码示例、图表和技术细节

### Requirement 2: 删除原有章节文件

**User Story:** 作为文档维护者，我希望删除已合并的旧章节文件，这样就不会有重复或过时的内容存在。

#### Acceptance Criteria

1. WHEN 新的 04-state-session-memory.md 文件创建完成后，THE Documentation_System SHALL 删除所有项目中的 05-state-management.md 文件
2. WHEN 新的 04-state-session-memory.md 文件创建完成后，THE Documentation_System SHALL 删除所有项目中的 11-context-management.md 文件
3. WHEN 新的 04-state-session-memory.md 文件创建完成后，THE Documentation_System SHALL 删除所有项目中的 16-memory-system.md 文件
4. THE Documentation_System SHALL 确认删除操作在所有四个项目目录中执行

### Requirement 3: 重新编号受影响的章节

**User Story:** 作为文档读者，我希望章节编号保持连续且逻辑清晰，这样我就能按顺序阅读而不会遇到编号跳跃或混乱。

#### Acceptance Criteria

1. THE Documentation_System SHALL 将当前的 04-tool-system.md 重命名为 05-tool-system.md（向后移动一位）
2. THE Documentation_System SHALL 保持当前的 06-extension-mcp.md 到 10-session-resume.md 编号不变
3. THE Documentation_System SHALL 将当前的 12-prompt-system.md 到 15-plugin-system.md 重命名为 11-prompt-system.md 到 14-plugin-system.md（向前移动一位）
4. THE Documentation_System SHALL 将当前的 17-sdk-transport.md 及之后的所有章节重命名为 15-sdk-transport.md 及之后（向前移动两位）
5. THE Documentation_System SHALL 在所有四个项目目录中执行重命名操作
6. THE Documentation_System SHALL 确保重命名后的文件名遵循 NN-topic-name.md 格式，其中 NN 是两位数字

### Requirement 4: 更新章节内部引用

**User Story:** 作为文档读者，我希望章节之间的交叉引用链接正确工作，这样我就能在相关主题之间导航而不会遇到断链。

#### Acceptance Criteria

1. WHEN 章节被重新编号时，THE Documentation_System SHALL 扫描所有 Markdown 文件中的内部链接
2. THE Documentation_System SHALL 更新所有指向已重命名章节的相对路径链接（如 `[text](./05-state-management.md)` 更新为 `[text](./04-state-session-memory.md)`）
3. THE Documentation_System SHALL 更新所有指向已删除章节的链接，使其指向新的合并章节
4. THE Documentation_System SHALL 验证更新后的链接在本地文件系统中可解析
5. THE Documentation_System SHALL 更新 index.md 或 README.md 文件中的章节列表（如果存在）

### Requirement 5: 更新 hello-harness 横向对比分析

**User Story:** 作为架构分析读者，我希望 hello-harness 中的横向对比分析反映最新的文档结构，这样我就能获得准确和完整的跨项目比较。参考上述4篇04序号的文档。

#### Acceptance Criteria

1. THE Documentation_System SHALL 更新 hello-harness/06-context-and-memory.md 文件
2. THE Documentation_System SHALL 在更新的分析中包含更丰富的实现机制对比
3. THE Documentation_System SHALL 在更新的分析中包含更完整的实际使用模式对比
4. THE Documentation_System SHALL 确保分析引用正确的新章节路径（04-state-session-memory.md）
5. THE Documentation_System SHALL 保持 hello-harness 文档的现有结构和评分体系

### Requirement 6: 保持文档语言一致性

**User Story:** 作为中文读者，我希望所有文档保持中文语言，这样我就能流畅地阅读而不会遇到语言切换。

#### Acceptance Criteria

1. THE Documentation_System SHALL 使用中文编写所有新创建的 04-state-session-memory.md 文件
2. THE Documentation_System SHALL 使用中文更新 hello-harness/06-context-and-memory.md 文件
3. THE Documentation_System SHALL 保留原有章节中的中文技术术语和表达方式
4. THE Documentation_System SHALL 在必要时使用英文技术术语，但提供中文解释
5. THE Documentation_System SHALL 确保代码注释和示例保持其原始语言（通常为英文）

### Requirement 7: 验证文档完整性

**User Story:** 作为文档维护者，我希望验证重构后的文档没有丢失重要内容，这样我就能确保读者获得完整的信息。

#### Acceptance Criteria

1. THE Documentation_System SHALL 生成一个验证报告，列出所有已删除的文件
2. THE Documentation_System SHALL 生成一个验证报告，列出所有已重命名的文件
3. THE Documentation_System SHALL 生成一个验证报告，列出所有已更新的内部链接
4. THE Documentation_System SHALL 验证新的 04-state-session-memory.md 文件包含原 05、11 和 16 章的所有关键主题
5. THE Documentation_System SHALL 验证没有断链存在于重构后的文档系统中

### Requirement 8: 保持 Jekyll 兼容性

**User Story:** 作为网站维护者，我希望重构后的文档与 Jekyll 构建系统兼容，这样 GitHub Pages 网站就能正确渲染所有页面。

#### Acceptance Criteria

1. THE Documentation_System SHALL 保留所有 Markdown 文件的 YAML front matter
2. THE Documentation_System SHALL 更新 front matter 中的 title 字段以反映新的章节名称
3. THE Documentation_System SHALL 确保所有相对链接使用 Jekyll 兼容的格式
4. THE Documentation_System SHALL 验证重构后的文档可以通过 `cd pages && npm run build` 成功构建
5. THE Documentation_System SHALL 确保构建后的网站导航结构反映新的章节编号

---

*文档版本: 1.0*  
*创建日期: 2025-01-XX*
