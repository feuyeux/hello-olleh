# Implementation Plan: 状态与记忆章节合并

## Overview

本实现计划将四个 AI Coding CLI 项目中的状态管理（第 5 章）、上下文管理（第 11 章）和记忆系统（第 16 章）合并为统一的第 4 章，删除原有章节，重新编号所有受影响的章节，并更新 hello-harness 中的横向对比分析。

实现方式：通过 bash 脚本和手动文件操作完成文档重构，确保所有内部引用正确更新，保持 Jekyll 兼容性和中文语言一致性。

## Tasks

- [x] 1. 为 hello-claude-code 项目创建合并章节
  - [x] 1.1 读取并合并三个源章节内容
    - 读取 `hello-claude-code/05-state-management.md`
    - 读取 `hello-claude-code/11-context-management.md`
    - 读取 `hello-claude-code/16-memory-system.md`
    - 按照设计文档的结构合并内容：概述、实现机制（状态管理、上下文管理、记忆系统）、实际使用模式、代码示例、关键函数清单、代码质量评估
    - 保留所有代码示例、图表和技术细节
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 1.2 创建新的 04-state-session-memory.md 文件
    - 使用中文编写内容
    - 设置 YAML front matter: `layout: content`, `title: "Claude Code 的状态、会话与记忆系统"`
    - 确保 Jekyll 兼容性
    - _Requirements: 1.1, 6.1, 6.2, 8.1, 8.2_

- [x] 2. 为 hello-codex 项目创建合并章节
  - [x] 2.1 读取并合并三个源章节内容
    - 读取 `hello-codex/05-state-management.md`
    - 读取 `hello-codex/11-context-management.md`
    - 读取 `hello-codex/16-memory-system.md`
    - 按照相同结构合并内容
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 2.2 创建新的 04-state-session-memory.md 文件
    - 使用中文编写内容
    - 设置 YAML front matter: `layout: content`, `title: "Codex 的状态、会话与记忆系统"`
    - _Requirements: 1.1, 6.1, 6.2, 8.1, 8.2_

- [x] 3. 为 hello-gemini-cli 项目创建合并章节
  - [x] 3.1 读取并合并三个源章节内容
    - 读取 `hello-gemini-cli/05-state-management.md`
    - 读取 `hello-gemini-cli/11-context-management.md`
    - 读取 `hello-gemini-cli/16-memory-system.md`
    - 按照相同结构合并内容
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 3.2 创建新的 04-state-session-memory.md 文件
    - 使用中文编写内容
    - 设置 YAML front matter: `layout: content`, `title: "Gemini CLI 的状态、会话与记忆系统"`
    - _Requirements: 1.1, 6.1, 6.2, 8.1, 8.2_

- [x] 4. 为 hello-opencode 项目创建合并章节
  - [x] 4.1 读取并合并三个源章节内容
    - 读取 `hello-opencode/05-state-management.md`
    - 读取 `hello-opencode/11-context-management.md`
    - 读取 `hello-opencode/16-memory-system.md`
    - 按照相同结构合并内容
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 4.2 创建新的 04-state-session-memory.md 文件
    - 使用中文编写内容
    - 设置 YAML front matter: `layout: content`, `title: "OpenCode 的状态、会话与记忆系统"`
    - _Requirements: 1.1, 6.1, 6.2, 8.1, 8.2_

- [x] 5. Checkpoint - 验证新章节创建完成
  - 确认所有四个项目都有新的 04-state-session-memory.md 文件
  - 验证内容完整性和中文语言一致性
  - 询问用户是否有问题

- [x] 6. 重新编号 hello-claude-code 项目的章节
  - [x] 6.1 重命名 04-tool-system.md 为 05-tool-system.md
    - 使用 `git mv` 命令保留历史记录
    - _Requirements: 3.1_
  
  - [x] 6.2 重命名 12-15 章节为 11-14
    - `git mv hello-claude-code/12-prompt-system.md hello-claude-code/11-prompt-system.md`
    - `git mv hello-claude-code/13-multi-agent.md hello-claude-code/12-multi-agent.md`
    - `git mv hello-claude-code/14-skill-system.md hello-claude-code/13-skill-system.md`
    - `git mv hello-claude-code/15-plugin-system.md hello-claude-code/14-plugin-system.md`
    - _Requirements: 3.3_
  
  - [x] 6.3 重命名 17+ 章节为 15+
    - 按照设计文档中的 RENUMBERING_RULES 映射执行重命名
    - 17->15, 18->16, 19->17, 20->18, 21->19, 22->20, 23->21, 24->22, 25->23, 26->24, 27->25
    - _Requirements: 3.4_

- [x] 7. 重新编号 hello-codex 项目的章节
  - [x] 7.1 重命名 04-tool-system.md 为 05-tool-system.md
    - _Requirements: 3.1_
  
  - [x] 7.2 重命名 12-15 章节为 11-14
    - _Requirements: 3.3_
  
  - [x] 7.3 重命名 17+ 章节为 15+
    - 注意 hello-codex 可能有 28-ghost-snapshot.md，需要重命名为 26-ghost-snapshot.md
    - _Requirements: 3.4_

- [x] 8. 重新编号 hello-gemini-cli 项目的章节
  - [x] 8.1 重命名 04-tool-system.md 为 05-tool-system.md
    - _Requirements: 3.1_
  
  - [x] 8.2 重命名 12-15 章节为 11-14
    - _Requirements: 3.3_
  
  - [x] 8.3 重命名 17+ 章节为 15+
    - _Requirements: 3.4_

- [x] 9. 重新编号 hello-opencode 项目的章节
  - [x] 9.1 重命名 04-tool-system.md 为 05-tool-system.md
    - _Requirements: 3.1_
  
  - [x] 9.2 重命名 12-15 章节为 11-14
    - _Requirements: 3.3_
  
  - [x] 9.3 重命名 17+ 章节为 15+
    - _Requirements: 3.4_

- [x] 10. Checkpoint - 验证章节重编号完成
  - 确认所有四个项目的章节编号正确
  - 验证没有遗漏的文件
  - 询问用户是否有问题

- [x] 11. 更新 hello-claude-code 项目的内部引用
  - [x] 11.1 扫描所有 Markdown 文件中的链接
    - 使用 `rg` 或 `grep` 查找所有指向 05、11、16 章的链接
    - 查找模式：`\[.*\]\(\.\/05-state-management\.md.*\)`, `\[.*\]\(\.\/11-context-management\.md.*\)`, `\[.*\]\(\.\/16-memory-system\.md.*\)`
    - _Requirements: 4.1, 4.2_
  
  - [x] 11.2 更新指向已删除章节的链接
    - 将所有指向 05、11、16 章的链接更新为指向新的 04-state-session-memory.md
    - 保留锚点（如果存在）
    - _Requirements: 4.2, 4.3_
  
  - [x] 11.3 更新指向已重命名章节的链接
    - 根据重编号映射更新所有章节链接
    - 例如：`./12-prompt-system.md` -> `./11-prompt-system.md`
    - _Requirements: 4.2, 4.4_
  
  - [x] 11.4 更新 index.md 或 README.md 中的章节列表
    - 如果存在章节索引，更新章节编号和标题
    - _Requirements: 4.5_

- [x] 12. 更新 hello-codex 项目的内部引用
  - [x] 12.1 扫描并更新指向已删除章节的链接
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 12.2 更新指向已重命名章节的链接
    - _Requirements: 4.2, 4.4_
  
  - [x] 12.3 更新 index.md 或 README.md 中的章节列表
    - _Requirements: 4.5_

- [x] 13. 更新 hello-gemini-cli 项目的内部引用
  - [x] 13.1 扫描并更新指向已删除章节的链接
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 13.2 更新指向已重命名章节的链接
    - _Requirements: 4.2, 4.4_
  
  - [x] 13.3 更新 index.md 或 README.md 中的章节列表
    - _Requirements: 4.5_

- [x] 14. 更新 hello-opencode 项目的内部引用
  - [x] 14.1 扫描并更新指向已删除章节的链接
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 14.2 更新指向已重命名章节的链接
    - _Requirements: 4.2, 4.4_
  
  - [x] 14.3 更新 index.md 或 README.md 中的章节列表
    - _Requirements: 4.5_

- [x] 15. Checkpoint - 验证内部引用更新完成
  - 运行链接检查工具验证没有断链
  - 询问用户是否有问题

- [x] 16. 更新 hello-harness 横向对比分析
  - [x] 16.1 更新 hello-harness/06-context-and-memory.md
    - 读取四个项目的新 04-state-session-memory.md 文件
    - 提取实现机制对比信息
    - 提取实际使用模式对比信息
    - 使用中文编写更丰富的横向分析
    - _Requirements: 5.1, 5.2, 5.3, 6.2_
  
  - [x] 16.2 更新章节引用路径
    - 将所有指向旧章节的引用更新为 `04-state-session-memory.md`
    - _Requirements: 5.4_
  
  - [x] 16.3 保持现有结构和评分体系
    - 不改变 hello-harness 的文档结构
    - 保留评分和对比表格格式
    - _Requirements: 5.5_

- [x] 17. 删除原有章节文件
  - [x] 17.1 删除 hello-claude-code 的旧章节
    - `git rm hello-claude-code/05-state-management.md`
    - `git rm hello-claude-code/11-context-management.md`
    - `git rm hello-claude-code/16-memory-system.md`
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 17.2 删除 hello-codex 的旧章节
    - `git rm hello-codex/05-state-management.md`
    - `git rm hello-codex/11-context-management.md`
    - `git rm hello-codex/16-memory-system.md`
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 17.3 删除 hello-gemini-cli 的旧章节
    - `git rm hello-gemini-cli/05-state-management.md`
    - `git rm hello-gemini-cli/11-context-management.md`
    - `git rm hello-gemini-cli/16-memory-system.md`
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 17.4 删除 hello-opencode 的旧章节
    - `git rm hello-opencode/05-state-management.md`
    - `git rm hello-opencode/11-context-management.md`
    - `git rm hello-opencode/16-memory-system.md`
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 18. 验证文档完整性
  - [x] 18.1 生成验证报告
    - 列出所有已删除的文件（12 个文件：4 个项目 × 3 个章节）
    - 列出所有已重命名的文件
    - 列出所有已更新的内部链接
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 18.2 验证内容完整性
    - 确认新的 04-state-session-memory.md 包含原 05、11 和 16 章的所有关键主题
    - 检查是否有遗漏的技术细节或代码示例
    - _Requirements: 7.4_
  
  - [x] 18.3 验证没有断链
    - 使用 `rg` 扫描所有 Markdown 文件中的链接
    - 验证所有相对路径链接指向存在的文件
    - _Requirements: 7.5_

- [x] 19. 验证 Jekyll 构建
  - [x] 19.1 运行 Jekyll 构建测试
    - 执行 `cd pages && npm run build`
    - 检查构建输出是否有错误
    - _Requirements: 8.4_
  
  - [x] 19.2 验证网站导航结构
    - 检查构建后的网站是否正确显示新的章节编号
    - 验证所有链接在构建后的网站中正常工作
    - _Requirements: 8.5_
  
  - [x] 19.3 验证 YAML front matter
    - 确认所有新文件和重命名文件的 front matter 正确
    - 验证 title 字段反映新的章节名称
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 20. Final checkpoint - 完成验证和清理
  - 确认所有任务完成
  - 生成最终验证报告
  - 询问用户是否需要调整或有其他问题

## Notes

- 本任务主要涉及文档重构，使用 bash 命令和文件操作完成
- 使用 `git mv` 和 `git rm` 命令保留 Git 历史记录
- 所有新内容和更新内容必须使用中文编写
- 保持 Jekyll 兼容性，确保 YAML front matter 正确
- 每个 checkpoint 任务提供验证和用户确认的机会
- 按照 AGENTS.md 规则，使用 `rg --files hello-*` 列出文件，使用 `cd pages && npm run build` 验证构建
