# Council

Agentic multi-repo orchestrator with live dialogue and dual memory.

Council spawns multiple Claude Code sessions (one per repository), enables them to dialogue with each other, allows human intervention at any moment, and learns from interactions using dual memory (Acontext + Cognee).

## Architecture

```
HUMAN (interrupt) -> CONDUCTOR -> [AGENT RepoA, AGENT RepoB, AGENT RepoC]
                                              |
                                    ACONTEXT (SOPs) + COGNEE (Facts)
```

- **Conductor**: Orchestrates turns, routes messages, generates prompts
- **Repo-Agents**: Each is a Claude Code session in a specific repo
- **Dual Memory**: Acontext for operational SOPs, Cognee for semantic facts

## Installation

```bash
# Clone and install
git clone <repo-url>
cd council
pnpm install
pnpm build

# Link globally (optional)
pnpm link --global
```

## Quickstart

### 1. Initialize workspace

```bash
council init
```

This creates a `.council/` directory with:
- `registry.yaml` - Repository configurations
- `threads/` - Conversation threads
- `scans/` - Synergy scan results
- `runs/` - Execution logs

### 2. Configure repositories

Edit `.council/registry.yaml`:

```yaml
repos:
  frontend:
    path: ../my-frontend
    description: React frontend application
  backend:
    path: ../my-backend
    description: Node.js API server
  shared:
    path: ../shared-lib
    description: Shared utilities

memory:
  acontext:
    enabled: true
    url: http://localhost:8080
  cognee:
    enabled: true
    dataset: council-facts
```

### 3. Create a conversation thread

```bash
council thread new --title "Debug auth flow" --repos "frontend,backend"
```

### 4. Send a message between repos

```bash
council ask \
  --thread th_20251222_abc \
  --from frontend \
  --to backend \
  --summary "Getting 401 errors on /api/user endpoint after login"
```

### 5. Generate prompts for each repo

```bash
council prompts --thread th_20251222_abc
```

### 6. Advance the conversation

```bash
council tick --thread th_20251222_abc
```

### 7. Watch live updates

```bash
council live --thread th_20251222_abc
```

### 8. Inject human context

```bash
council interrupt \
  --thread th_20251222_abc \
  --note "The issue started after we upgraded the JWT library"
```

### 9. Close the thread

```bash
council close \
  --thread th_20251222_abc \
  --status resolved \
  --summary "Fixed token refresh logic in backend"
```

## Commands

### Thread Management

| Command | Description |
|---------|-------------|
| `council init` | Initialize `.council/` workspace |
| `council thread new --title "..." --repos "A,B"` | Create conversation thread |
| `council thread list` | List all threads |
| `council close --thread <id> --status <status>` | Close thread (resolved/blocked/abandoned) |

### Messaging

| Command | Description |
|---------|-------------|
| `council ask --thread <id> --from A --to B --summary "..."` | Send message between repos |
| `council interrupt --thread <id> --note "..."` | Inject human context |
| `council add-evidence --thread <id> --file <path>` | Add evidence file |

### Execution

| Command | Description |
|---------|-------------|
| `council tick --thread <id>` | Advance one turn |
| `council run --thread <id>` | Auto-tick loop until resolution |
| `council prompts --thread <id>` | Generate prompts for each repo |
| `council live --thread <id>` | Stream dialogue in real-time |

### Automation

| Command | Description |
|---------|-------------|
| `council spawn --thread <id>` | Spawn Claude Code sessions |
| `council spawn --thread <id> --tmux --layout tiled` | Spawn in tmux panes |
| `council sessions list` | List active sessions |
| `council sessions kill --name <name>` | Kill a tmux session |
| `council mcp serve --port 3456` | Start MCP server |
| `council mcp tools` | List available MCP tools |

### Analysis

| Command | Description |
|---------|-------------|
| `council scan --repos "A,B,C"` | Scan repos for synergy |
| `council scan --repos "A,B" --output json --save` | Save scan results |

## Prompt Options

```bash
# Copy prompt to clipboard (with confirmation)
council prompts --thread <id> --copy

# Interactive mode to select and copy prompts
council prompts --thread <id> --interactive

# Include memory (SOPs and facts)
council prompts --thread <id> --memory

# Generate for specific repo only
council prompts --thread <id> --repo frontend
```

## Tmux Spawn Mode

Spawn Claude Code sessions in tmux panes for parallel work:

```bash
# Spawn with tiled layout (default)
council spawn --thread <id> --tmux

# Choose layout: horizontal, vertical, or tiled
council spawn --thread <id> --tmux --layout horizontal

# Auto-attach to session
council spawn --thread <id> --tmux --attach

# Manage sessions
council sessions list
council sessions attach --name council-th_xxx
council sessions kill --name council-th_xxx
```

## MCP Server

Expose Council as an MCP server for automation:

```bash
# Start server
council mcp serve --port 3456

# Available tools:
# - council_thread_create
# - council_thread_status
# - council_ask
# - council_prompts
# - council_list_threads
```

## Synergy Scanner

Analyze repositories for integration opportunities:

```bash
council scan --repos "frontend,backend,shared"
```

Detects:
- **Endpoints**: HTTP routes (Express, Flask, FastAPI, Go)
- **Dependencies**: Shared packages with version comparison
- **Boundaries**: Database, API, queue, config, file I/O
- **Overlaps**: Potential conflicts in endpoint paths

## Message Protocol

Messages are JSON files with structure:

```json
{
  "message_id": "msg_xxx",
  "thread_id": "th_xxx",
  "from": "frontend",
  "to": "backend",
  "type": "question",
  "summary": "Why is /api/user returning 401?",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

Types: `question`, `answer`, `hypothesis`, `patch_proposal`, `resolution`, `context_injection`

Human intervention uses `from: "HUMAN"` and `to: "ALL"`.

## Dual Memory

Council uses two memory systems:

### Acontext (SOPs)
- Writes every turn
- Stores sessions, artifacts, procedures
- Retrieved via `experience_search()`

### Cognee (Facts)
- Writes only at checkpoints (decisions, resolutions)
- Stores facts and relationships
- Retrieved via `search()`

**Rule**: Acontext writes everything, Cognee writes only distilled facts.

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

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm dev
```

## License

MIT
