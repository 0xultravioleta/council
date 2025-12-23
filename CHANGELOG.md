# Changelog

All notable changes to Council will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-12-22

### Added

#### Core (M1)
- CLI scaffold with Commander.js
- Workspace initialization (`council init`)
- Registry parser with YAML validation
- Thread creation and management
- Message schema with Zod validation
- Inbox/outbox message routing
- Prompt generator for multi-repo context
- Tick loop for turn advancement
- Append-only transcript renderer
- Thread state model (pending, waiting, resolved, blocked)

#### Live View + Interrupt (M2)
- Live streaming of thread updates (`council live`)
- Human interrupt injection (`council interrupt`)
- Prompt injection for human notes
- Thread close command with status

#### Claude Integration (M2.5)
- Claude Code spawner as subprocess
- Outbox file watcher with chokidar
- Session orchestrator for parallel sessions
- Auto-tick mode (`council run`)
- Session state tracking

#### Acontext Memory (M3)
- Acontext HTTP client with retries
- Thread-to-session mapping
- SOP learning on thread close
- SOP injection into prompts
- Graceful fallback when unavailable

#### Cognee Memory (M4)
- Fact schema with deterministic IDs
- Fact distiller for checkpoints
- Cognee client integration
- Fact injection into prompts
- Anti-collision rules (dataset scoping, TTL)

#### Automation + UX (M5)
- Tmux spawn mode with layouts (`--tmux`, `--layout`)
- Session management (`council sessions list/kill/attach`)
- Clipboard integration (`--copy`, `--interactive`)
- MCP server for automation (`council mcp serve`)
- Synergy scanner with endpoint/boundary detection

### Security
- Redaction guard for evidence files
  - Detects common secret patterns (AWS, GitHub, Stripe, OpenAI, Anthropic)
  - Detects passwords in URLs and connection strings
  - Detects private keys (RSA, DSA, EC, OpenSSH)
  - Auto-redact with `--redact` flag
  - Force mode with `--force` flag
  - Warns on sensitive filenames (.env, credentials, etc.)

### Documentation
- README with quickstart guide
- Example registry configuration
- Sample transcript demonstrating workflow
- CHANGELOG following Keep a Changelog format
