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

---

## Scenarios

Detailed step-by-step guides for common multi-repo workflows. Each scenario includes:
- **Triggers**: When to use this scenario
- **Prerequisites**: What you need before starting
- **Step-by-step commands**: Complete workflow

---

### Scenario 1: Cross-Repo Bug Investigation

#### Triggers - When to Use
- [ ] Error reports mention behavior spanning multiple services
- [ ] Logs show failures at service boundaries (API calls, message queues)
- [ ] Bug reproduces in one repo but root cause is unclear
- [ ] Stack traces point to external service responses
- [ ] "It works locally" but fails in integration

#### How to Recognize This Scenario
```bash
# Check if error involves cross-service communication
grep -r "fetch\|axios\|http\." ./src           # Frontend calling backend?
grep -r "ECONNREFUSED\|timeout\|502\|503" ./logs  # Connection issues?

# Look for boundary errors in logs
tail -100 /var/log/app/error.log | grep -i "api\|service\|endpoint"
```

#### Prerequisites
```bash
# Ensure repos are in registry
cat .council/registry.yaml | grep -A2 "frontend\|backend"

# Have error logs or screenshots ready
ls -la ./evidence/
```

#### Step-by-Step Workflow

```bash
# Step 1: Scan repos to understand integration points
council scan --repos "frontend,backend" --save

# Step 2: Create investigation thread
council thread new \
  --title "Investigate 500 errors on checkout" \
  --repos "frontend,backend"
# Output: Created thread th_20251222_abc

# Step 3: Start the investigation from frontend's perspective
council ask \
  --thread th_20251222_abc \
  --from frontend \
  --to backend \
  --summary "Users getting 500 errors on POST /api/checkout. Request payload looks valid. Is the endpoint receiving requests?"

# Step 4: Add error logs as evidence
council add-evidence \
  --thread th_20251222_abc \
  --file ./error-logs.txt \
  --redact  # Auto-mask any secrets in logs

# Step 5: Generate prompts and spawn Claude sessions
council prompts --thread th_20251222_abc
council spawn --thread th_20251222_abc --tmux --attach

# Step 6: Watch the dialogue unfold
# (In another terminal)
council live --thread th_20251222_abc

# Step 7: Inject context when you discover something
council interrupt \
  --thread th_20251222_abc \
  --note "Found that the error started at 2pm - same time as database migration"

# Step 8: Let agents continue investigating
council tick --thread th_20251222_abc

# Step 9: Close when resolved
council close \
  --thread th_20251222_abc \
  --status resolved \
  --summary "Database migration added NOT NULL constraint. Backend updated to handle nullable field."
```

---

### Scenario 2: Coordinated Feature Development

#### Triggers - When to Use
- [ ] New feature requires changes in 2+ repositories
- [ ] Feature has dependencies (shared types → API → UI)
- [ ] Multiple developers/agents need to stay synchronized
- [ ] Feature spec references multiple system components
- [ ] Changes need to be deployed together

#### How to Recognize This Scenario
```bash
# Map out which repos need changes:
# 1. Does it need new types? → shared repo
# 2. Does it need new API? → backend repo
# 3. Does it need new UI? → frontend repo
# 4. Does it need new workers? → worker repo

# Check existing shared types
ls ../shared/src/types/

# Check existing API endpoints
grep -r "router\.\|app\." ../backend/src/routes/
```

#### Prerequisites
```bash
# Feature spec is clear
cat ./specs/user-preferences.md

# All repos in registry
council scan --repos "frontend,backend,shared" --output summary

# Design mockups ready (optional)
ls ./designs/*.png
```

#### Pre-flight Checklist
- [ ] Feature spec defines all components needed
- [ ] Identified dependency order (what must be built first)
- [ ] All relevant repos are in registry.yaml
- [ ] Design mockups/specs available as evidence

#### Step-by-Step Workflow

```bash
# Step 1: Create thread with all involved repos
council thread new \
  --title "Implement user preferences feature" \
  --repos "frontend,backend,shared"

# Step 2: Start with shared types (dependency order)
council ask \
  --thread th_20251222_xyz \
  --from backend \
  --to shared \
  --summary "Need to define UserPreferences type with theme, notifications, and locale settings"

# Step 3: After shared is done, coordinate backend
council ask \
  --thread th_20251222_xyz \
  --from frontend \
  --to backend \
  --summary "What endpoints will be available for preferences? Need GET and PATCH."

# Step 4: Use auto-run mode for faster iteration
council run --thread th_20251222_xyz --spawn

# Step 5: Monitor progress
council live --thread th_20251222_xyz

# Step 6: Add design mockup as evidence
council add-evidence \
  --thread th_20251222_xyz \
  --file ./preferences-mockup.png

# Step 7: Redirect if needed
council interrupt \
  --thread th_20251222_xyz \
  --note "Product changed requirements: also need language preference, not just locale"

# Step 8: Close with summary
council close \
  --thread th_20251222_xyz \
  --status resolved \
  --summary "UserPreferences implemented: shared types, REST API, React settings page"
```

---

### Scenario 3: Pre-Integration Synergy Analysis

#### Triggers - When to Use
- [ ] Planning to merge or consolidate microservices
- [ ] Evaluating code reuse opportunities across repos
- [ ] Onboarding to a new multi-repo codebase
- [ ] Auditing for duplicate functionality
- [ ] Checking for dependency version conflicts

#### How to Recognize This Scenario
```bash
# Signs you need synergy analysis:
grep -r "validateUser" ../*/src | wc -l  # Same function in multiple repos?
cat ../*/package.json | grep "express"   # Different versions?
```

#### What to Look For in Results

| Finding | Action |
|---------|--------|
| Shared deps, different versions | Align versions |
| Endpoint overlaps | Namespace or merge |
| Same boundary types | Share connection config |
| Common exports | Extract to shared lib |

#### Step-by-Step Workflow

```bash
# Step 1: Run comprehensive scan
council scan \
  --repos "service-a,service-b,service-c" \
  --output full \
  --save

# Step 2: Review the output
# - Shared Dependencies: Shows common packages (version conflicts?)
# - Endpoint Overlaps: Shows conflicting routes
# - Potential Integrations: Shows where repos touch same boundaries

# Step 3: Create planning thread based on findings
council thread new \
  --title "Plan service consolidation" \
  --repos "service-a,service-b"

# Step 4: Ask about specific overlap found in scan
council ask \
  --thread th_20251222_plan \
  --from service-a \
  --to service-b \
  --summary "Scan shows we both have /api/users endpoint. What does yours do? Should we merge or namespace?"

# Step 5: Gather decisions
council tick --thread th_20251222_plan
council tick --thread th_20251222_plan

# Step 6: Close with integration plan
council close \
  --thread th_20251222_plan \
  --status resolved \
  --summary "Decision: Namespace endpoints as /api/v1/users (service-a) and /api/v2/users (service-b) until Q2 merge"
```

---

### Scenario 4: Emergency Hotfix Coordination

#### Triggers - When to Use
- [ ] Production outage or severe degradation
- [ ] Customer-impacting bug requiring immediate fix
- [ ] Security incident requiring coordinated response
- [ ] SLA breach imminent or occurring

#### Severity Guide

| Severity | Response Time | Thread Prefix |
|----------|--------------|---------------|
| SEV1 - Total outage | Immediate | `URGENT:` |
| SEV2 - Major degradation | 15 min | `HIGH:` |
| SEV3 - Partial impact | 1 hour | `MEDIUM:` |

#### Emergency Readiness Checklist
```bash
# Ensure ready BEFORE emergencies
council init                    # Workspace exists
which tmux                      # Tmux available
which claude                    # Claude Code ready
cat .council/registry.yaml      # Repos configured
```

#### Incident Response Flow
```
1. ALERT    → Create urgent thread
2. ASSEMBLE → Spawn all sessions (tmux)
3. BROADCAST → Interrupt with details
4. EVIDENCE → Add logs, metrics
5. ITERATE  → Auto-run with interrupts
6. RESOLVE  → Close with root cause
```

#### Step-by-Step Workflow

```bash
# Step 1: Create urgent thread
council thread new \
  --title "URGENT: Production checkout broken" \
  --repos "frontend,backend,payments"

# Step 2: Immediately spawn all sessions in tmux
council spawn \
  --thread th_20251222_urgent \
  --tmux \
  --layout tiled \
  --attach

# Step 3: Broadcast the issue to all repos
council interrupt \
  --thread th_20251222_urgent \
  --note "PRODUCTION DOWN: Checkout returns 503. Started 5 min ago. All hands investigating."

# Step 4: Add production logs
council add-evidence \
  --thread th_20251222_urgent \
  --file /var/log/app/error.log \
  --redact

# Step 5: Run auto-tick for rapid iteration
council run --thread th_20251222_urgent

# Step 6: Inject findings as you discover them
council interrupt \
  --thread th_20251222_urgent \
  --note "Payments service shows connection timeout to Stripe API"

# Step 7: Close with postmortem notes
council close \
  --thread th_20251222_urgent \
  --status resolved \
  --summary "Root cause: Stripe API key expired. Rotated key and added expiry monitoring."
```

---

### Scenario 5: Architecture Discussion

#### Triggers - When to Use
- [ ] Considering extracting shared code into a library
- [ ] Debating between architectural approaches
- [ ] Planning major refactoring or migration
- [ ] Designing new system boundaries

#### How to Recognize This Scenario
```bash
# Signs you need architecture discussion:
diff <(grep -r "validateToken" ../app-a/src) <(grep -r "validateToken" ../app-b/src)
# If similar code exists in multiple repos → extraction candidate
```

#### Key Questions to Ask
- What's the current state in each repo?
- What are the constraints (performance, compatibility)?
- What's the migration path?
- Who owns the shared code?

#### Step-by-Step Workflow

```bash
# Step 1: Scan to understand current coupling
council scan --repos "app-a,app-b,app-c" --output json --save

# Step 2: Create discussion thread
council thread new \
  --title "Evaluate extracting auth module" \
  --repos "app-a,app-b,app-c"

# Step 3: Start with hypothesis
council ask \
  --thread th_20251222_arch \
  --from app-a \
  --to app-b \
  --summary "We both implement JWT validation. Should we extract to shared auth library? What's your current implementation?"

# Step 4: Expand discussion
council ask \
  --thread th_20251222_arch \
  --from app-a \
  --to app-c \
  --summary "Same question about auth extraction. Also, do you handle refresh tokens?"

# Step 5: Let discussion develop
council tick --thread th_20251222_arch
council tick --thread th_20251222_arch
council tick --thread th_20251222_arch

# Step 6: Inject human decision criteria
council interrupt \
  --thread th_20251222_arch \
  --note "Key factors: 1) Must support both session and JWT, 2) Need <10ms validation time, 3) Can't break existing APIs"

# Step 7: Request resolution
council ask \
  --thread th_20251222_arch \
  --from HUMAN \
  --to ALL \
  --summary "Based on discussion, propose final recommendation: extract or keep separate?"

# Step 8: Close with decision
council close \
  --thread th_20251222_arch \
  --status resolved \
  --summary "Decision: Extract auth to @company/auth package. Start with JWT validation, add session support in v2."
```

---

### Scenario 6: Manual vs Automated Workflows

#### Triggers - When to Use Each Mode

| Mode | Use When | Control |
|------|----------|---------|
| **Manual** | Learning, sensitive changes, full review needed | High |
| **Semi-auto** | Regular work, want clipboard help | Medium |
| **Full auto** | Routine tasks, time pressure | Low |

#### Decision Flowchart
```
Sensitive/risky change? → YES → Manual mode
                       → NO  ↓
Need to review each response? → YES → Semi-auto
                              → NO  ↓
Time critical? → YES → Full auto
             → NO  → Semi-auto
```

#### Switching Modes Mid-Thread
```bash
# Stop auto mode
council sessions kill --name council-th_xxx

# Continue manually
council prompts --thread th_xxx --interactive
council tick --thread th_xxx
```

#### Manual Mode - Full control, step by step:

```bash
# Create thread
council thread new --title "Manual debug" --repos "a,b"

# Send message
council ask --thread th_xxx --from a --to b --summary "Question..."

# Generate prompts (copy manually to Claude Code)
council prompts --thread th_xxx --interactive

# After Claude responds, advance
council tick --thread th_xxx

# Repeat until done
council close --thread th_xxx --status resolved
```

**Semi-automated** - Prompts copied automatically:

```bash
# Create and ask
council thread new --title "Semi-auto" --repos "a,b"
council ask --thread th_xxx --from a --to b --summary "Question..."

# Copy prompts to clipboard
council prompts --thread th_xxx --copy

# Paste into Claude Code, get response, tick
council tick --thread th_xxx
```

**Fully automated** - Claude Code sessions spawned:

```bash
# Create and spawn
council thread new --title "Full auto" --repos "a,b"
council ask --thread th_xxx --from a --to b --summary "Question..."

# Spawn sessions and auto-run
council run --thread th_xxx --spawn

# Just monitor
council live --thread th_xxx

# Interrupt only if needed
council interrupt --thread th_xxx --note "Redirect to focus on X"
```

---

### Scenario 7: Working with Evidence

#### Triggers - When to Add Evidence
- [ ] Bug reports with screenshots or logs
- [ ] Error messages that need exact text
- [ ] Configuration files relevant to issue
- [ ] Performance profiles or metrics
- [ ] Design mockups for features

#### Evidence Types and Handling

| Type | Extension | Flag | Notes |
|------|-----------|------|-------|
| Logs | .log, .txt | `--redact` | Auto-mask secrets |
| Screenshots | .png, .jpg | (none) | Binary, copied as-is |
| Config | .json, .yaml | `--redact` | Check for API keys |
| Env files | .env | `--force` | Blocked by default |

#### Pre-Evidence Checklist
```bash
# Check for secrets before adding
grep -E "(password|secret|key|token).*=" ./file.txt

# Check file size (large files slow things down)
ls -lh ./file.txt

# Trim logs to relevant section
tail -100 ./app.log > ./relevant.log
```

#### Adding Different Types of Evidence:

```bash
# Add a log file (auto-redacts secrets)
council add-evidence --thread th_xxx --file ./app.log --redact

# Add a screenshot
council add-evidence --thread th_xxx --file ./error-screenshot.png

# Add config (requires --force if sensitive filename detected)
council add-evidence --thread th_xxx --file ./.env.example --force

# Add with full redaction
council add-evidence --thread th_xxx --file ./config.json --redact
```

**Referencing evidence in messages**:

```bash
council ask \
  --thread th_xxx \
  --from frontend \
  --to backend \
  --summary "See attached error log (20251222T120000_app.log). Error on line 423."
```

---

### Scenario 8: Parallel Tmux Sessions

#### Triggers - When to Use Tmux Mode
- [ ] Working on 3+ repos simultaneously
- [ ] Need visual oversight of all agents
- [ ] Prefer terminal-based workflow
- [ ] Running on remote server via SSH

#### Prerequisites
```bash
which tmux || sudo apt install tmux  # Install tmux
which claude                          # Claude Code available
```

#### Layout Selection Guide

| Layout | Best For | Repos |
|--------|----------|-------|
| `tiled` | 3-6 repos, equal importance | Default |
| `horizontal` | 2 repos, code side-by-side | Review |
| `vertical` | 2 repos, comparing outputs | Logs |

#### Tmux Quick Reference
```bash
# Inside tmux session
Ctrl+B, Arrow    # Move between panes
Ctrl+B, z        # Zoom pane (toggle)
Ctrl+B, d        # Detach from session

# Outside tmux
tmux ls                       # List sessions
tmux attach -t council-th_xxx # Reattach
```

#### Fastest Workflow for Multi-Repo Work:

```bash
# Step 1: Create thread
council thread new --title "Parallel work" --repos "api,web,mobile,shared"

# Step 2: Spawn all in tiled layout
council spawn --thread th_xxx --tmux --layout tiled --attach

# You now have 4 panes, each with Claude Code in the correct directory
# Each pane shows the prompt for that repo

# Step 3: In a separate terminal, monitor
council live --thread th_xxx

# Step 4: Manage sessions
council sessions list
# Output:
# council-th_xxx (4 panes: api, web, mobile, shared)

# Step 5: Kill when done
council sessions kill --name council-th_xxx
```

**Layout options**:

```bash
# Horizontal split (stacked)
council spawn --thread th_xxx --tmux --layout horizontal

# Vertical split (side by side)
council spawn --thread th_xxx --tmux --layout vertical

# Tiled (grid) - best for 3+ repos
council spawn --thread th_xxx --tmux --layout tiled
```

---

### Scenario 9: Memory-Assisted Debugging

#### Triggers - When to Use Memory
- [ ] Debugging a recurring issue
- [ ] Issue similar to past problems
- [ ] Want to leverage organizational knowledge
- [ ] Training new team members on past solutions

#### How Memory Helps
```
Acontext (SOPs):
- "When JWT auth fails, check algorithm mismatch first"
- "Database timeouts usually indicate connection pool exhaustion"

Cognee (Facts):
- "Frontend signs JWT with HS256"
- "Backend rate limit is 1000 req/min"
```

#### Prerequisites
```bash
# Memory must be configured in registry
cat .council/registry.yaml | grep -A5 "memory:"

# Previous threads must have been closed (to learn from)
council thread list | grep resolved
```

#### Using Learned SOPs and Facts:

```bash
# Step 1: Create thread with memory enabled
council thread new --title "Auth bug (check memory)" --repos "frontend,backend"

# Step 2: Generate prompts with memory context
council prompts --thread th_xxx --memory

# This injects:
# - SOPs from Acontext (past procedures that worked)
# - Facts from Cognee (known system behaviors)

# Step 3: The prompt now includes relevant history
# "Previous resolution: JWT library v9 requires explicit algorithm..."
```

---

### Scenario 10: Long-Running Investigation

#### Triggers - When to Use
- [ ] Complex issue requiring deep analysis
- [ ] Investigation spanning multiple days
- [ ] Need to preserve context across sessions
- [ ] Multiple people contributing over time

#### Best Practices for Long Investigations
```bash
# 1. Use descriptive thread titles
council thread new --title "Memory leak in worker - heap analysis" ...

# 2. Add evidence incrementally
council add-evidence --thread th_xxx --file ./day1-heap.json
council add-evidence --thread th_xxx --file ./day2-heap.json

# 3. Use interrupts to document findings
council interrupt --thread th_xxx --note "Day 1: Identified leak in event handlers"

# 4. Review transcript to catch up
council live --thread th_xxx  # See full history
```

#### Thread State Persistence
```bash
# Threads persist indefinitely until closed
council thread list
# th_xxx | Memory leak investigation | active | turn 15 | 3 days ago

# Resume anytime
council prompts --thread th_xxx
council tick --thread th_xxx
```

#### Multi-Day or Complex Investigation:

```bash
# Day 1: Start investigation
council thread new --title "Memory leak investigation" --repos "api,worker"
council ask --thread th_xxx --from api --to worker \
  --summary "Heap grows unbounded after 24h. Suspecting event listener leak."

# Add profiler output
council add-evidence --thread th_xxx --file ./heap-snapshot.json

# End of day - thread persists
council thread list
# Shows: th_xxx (active, turn 5)

# Day 2: Continue
council live --thread th_xxx  # See where we left off
council ask --thread th_xxx --from worker --to api \
  --summary "Found orphaned subscriptions. Are you cleaning up on disconnect?"

# Day 3: Resolution
council close --thread th_xxx --status resolved \
  --summary "Event listeners not removed on WebSocket close. Added cleanup handler."
```

---

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
