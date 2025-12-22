# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Council** is an agentic orchestrator that spawns multiple Claude Code sessions (one per repository), enables them to dialogue with each other, allows human intervention at any moment, and learns from interactions using dual memory (Acontext + Cognee).

## Architecture

```
HUMAN (interrupt) -> CONDUCTOR -> [AGENT RepoA, AGENT RepoB, AGENT RepoC]
                                              |
                                    ACONTEXT (SOPs) + COGNEE (Facts)
```

- **Conductor**: Orchestrates turns, routes messages, generates prompts
- **Repo-Agents**: Each is a Claude Code session in a specific repo
- **Dual Memory**: Acontext for operational SOPs, Cognee for semantic facts

## Project Structure

```
.council/
  registry.yaml          # Repo configs and memory settings
  threads/               # Active conversation threads
    th_YYYYMMDD_xxx/
      inbox/             # Incoming messages per repo
      outbox/            # Outgoing messages per repo
      evidence/          # Screenshots, logs, snippets
      artifacts/         # Generated repro scripts, patches
      prompts/           # Generated prompts per repo
      transcript.md      # Human-readable timeline
      state.json         # Current state
  scans/                 # Synergy scan results
  runs/                  # Execution logs
```

## Build & Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `council init` | Initialize .council/ workspace |
| `council thread new --title "..." --repos "A,B"` | Create conversation thread |
| `council ask --thread <id> --from A --to B` | Send message |
| `council tick --thread <id>` | Advance one turn |
| `council prompts --thread <id>` | Print prompts for each repo |
| `council live --thread <id>` | Stream dialogue in real-time |
| `council interrupt --thread <id> --note "..."` | Inject human context |
| `council close --thread <id> --status resolved` | Close thread |

## Message Protocol

Messages are JSON files with structure:
- `thread_id`, `from`, `to`, `type`, `summary`
- Types: question, answer, hypothesis, patch_proposal, resolution, context_injection

Human intervention uses `from: "HUMAN"` and `to: "ALL"`.

## Dual Memory Policy

- **ACONTEXT**: Writes every turn, stores sessions/artifacts/SOPs, reads via `experience_search()`
- **COGNEE**: Writes only at checkpoints (decisions, resolutions), stores facts/graph, reads via `search()`

Rule: Acontext writes everything, Cognee writes only distilled facts.

## Key Files

- `master_plan.md`: Complete design document with schemas and implementation phases
- `context.md`: Original conversation defining the vision
