# Hello Harness

Cross-runtime context and memory module design for AI coding agents.

## Documents

- **40-pluggable-context-memory-module.md** - Core architecture design for a pluggable context and memory system that works across both OpenCode (TypeScript/Bun) and Hermes Agent (Python) runtimes.
- **42-runtime-comparison.md** - Detailed comparison analysis of OpenCode vs Hermes Agent implementations covering message models, context compilation, memory systems, compression strategies, and storage layers.
- **pluggable-architecture.mermaid** - Visual diagram of the layered abstraction architecture showing business logic, unified interfaces, adapters, and runtime layers.

## Overview

This directory contains design documents for building runtime-agnostic components that can work with multiple AI agent frameworks. The goal is to create reusable abstractions for:

- Context management and compilation
- Memory persistence and retrieval  
- Compression strategies
- Message storage

## Key Principles

1. **Interface-first design** - Define capability contracts before implementation
2. **Minimal common denominator + extension points** - Core interfaces cover the intersection, metadata/hooks expose differences
3. **Runtime independence** - Business logic doesn't depend on specific SQLite schemas, event buses, or language features
4. **Progressive migration** - Can implement in one system first, then port to others

## Status

🚧 **Design Phase** - Architecture and interfaces defined, implementation pending.

