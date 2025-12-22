# Council Roadmap
Version: 2025-12-22

This roadmap converts `master_plan_final.md` into actionable issues grouped by phase.
Each issue has a stable ID for tracking and can be copied into a ticket system.

## Operating Rules
- Phase order is strict: M1 -> M2 -> M2.5 -> M3 -> M4 -> M5.
- Each issue must produce a visible, testable artifact.
- Do not expand scope inside a phase; defer to next phase.
- Acceptance criteria must be verifiable from the workspace.

---

## Phase 1: Core MVP (M1) ✓ COMPLETE

Milestone goals:
- File-based workflow works end-to-end for 2 repos.
- Messages flow via inbox/outbox and prompts render correctly.
- Transcript and state update on every turn.
- CLI is deterministic and safe to run repeatedly.

| ID | Title | Description | Acceptance Criteria | Dependencies |
| --- | --- | --- | --- | --- |
| M1-01 | CLI scaffold | Create TypeScript CLI skeleton, build/test scripts, and basic command routing. | `council --help` works and all commands are wired. | None |
| M1-02 | Workspace init | Implement `council init` to create `.council/` and base registry. | Running `council init` creates all required folders and sample registry without errors. | M1-01 |
| M1-03 | Registry parser | Parse and validate `registry.yaml` with clear errors. | Invalid config surfaces a clear error; valid config loads into memory. | M1-01 |
| M1-04 | Thread creation | Implement `council thread new` to create thread folder and files. | Thread folder includes `inbox/`, `outbox/`, `prompts/`, `transcript.md`, `state.json`. | M1-02, M1-03 |
| M1-05 | Message schema | Define schema v1 and validator for inbox/outbox messages. | Invalid message is rejected and logged; valid message passes. | M1-01 |
| M1-06 | Ask command | Implement `council ask` to write an inbox message. | Inbox file created with required fields and correct repo names. | M1-04, M1-05 |
| M1-07 | Prompt generator | Generate repo-specific prompts from inbox + registry + context. | `council prompts` writes prompt files and prints to stdout. | M1-05, M1-06 |
| M1-08 | Tick loop | Implement `council tick` to process inbox, update state, and write prompts. | One tick consumes new inbox messages and updates `state.json` and `transcript.md`. | M1-07 |
| M1-09 | Transcript renderer | Append-only transcript with timestamps and routing. | Transcript shows message timeline with from/to/type/summary. | M1-08 |
| M1-10 | State model | Define state fields for pending, waiting, resolved, blocked. | `state.json` reflects last turn and pending actions. | M1-08 |
| M1-11 | Basic tests | Unit tests for IDs, schema validation, and registry parsing. | Tests run locally and pass. | M1-05 |
| M1-12 | Fixture thread | Provide a sample thread with 6 messages as a reference. | Fixture exists under `.council/threads/` and renders in transcript. | M1-09 |

---

## Phase 2: Live View + Interrupt (M2) ✓ COMPLETE

Milestone goals:
- Live view streams conversation updates.
- Human can inject context at any moment.
- Transcript and prompts include human notes.

| ID | Title | Description | Acceptance Criteria | Dependencies |
| --- | --- | --- | --- | --- |
| M2-01 | Live view | Implement `council live` with tail-style output and filters. | New messages appear live with repo and timestamp labels. | M1-09 |
| M2-02 | Interrupt | Implement `council interrupt` to write HUMAN message to inbox. | Next tick includes human notes in prompts. | M1-06 |
| M2-03 | Prompt injection | Ensure human notes are visible in prompts and transcript. | Prompt contains a human notes block and transcript shows injection. | M2-02 |
| M2-04 | Pause/resume | Optional: pause loop and resume without losing state. | Paused threads do not generate prompts until resumed. | M1-08 |

---

## Phase 2.5: Claude Integration (M2.5) ← CURRENT

Milestone goals:
- Claude Code sessions can be spawned as subprocesses.
- Outbox files are detected automatically via file watching.
- Multiple sessions run in parallel with orchestration.
- Auto-tick mode advances turns without manual intervention.

| ID | Title | Description | Acceptance Criteria | Dependencies |
| --- | --- | --- | --- | --- |
| M2.5-00 | Claude spawner | Spawn Claude Code CLI as subprocess with working directory and prompt piping. | `council spawn --thread <id>` opens Claude Code sessions for pending repos. | M2-01 |
| M2.5-01 | Outbox watcher | Use chokidar to watch outbox/ for new JSON files. | Watcher detects new outbox files within 500ms and emits events. | M1-08 |
| M2.5-02 | Session orchestrator | Manage multiple Claude Code sessions with health checks and cleanup. | Sessions can be started, monitored, and terminated cleanly. | M2.5-00 |
| M2.5-03 | Auto-tick mode | Automatically run tick when outbox files appear. | `council run --thread <id>` enters auto-tick loop until resolution. | M2.5-01 |
| M2.5-04 | Session state | Track session PIDs and status in state.json. | State reflects running sessions and their health. | M2.5-02 |

---

## Phase 3: Acontext Memory (M3)

Milestone goals:
- Sessions and artifacts are written to Acontext.
- SOPs are retrieved and injected on new threads.
- Failures degrade gracefully without breaking flow.

| ID | Title | Description | Acceptance Criteria | Dependencies |
| --- | --- | --- | --- | --- |
| M3-01 | Acontext client | Implement HTTP client with retries and timeouts. | Client can create sessions and upload artifacts. | M1-01 |
| M3-02 | Session mapping | Map thread data to Acontext session + labels. | Closing a thread creates a session with tags. | M1-10, M3-01 |
| M3-03 | SOP learning | Trigger learn flow on thread close to store SOPs. | SOPs appear in Acontext and are retrievable. | M3-02 |
| M3-04 | SOP injection | Fetch SOPs at thread start and inject into prompts. | Prompts include top SOPs from Acontext. | M3-03 |
| M3-05 | Failure fallback | Graceful handling when Acontext is unavailable. | System runs without blocking and logs warning. | M3-01 |

---

## Phase 4: Cognee Memory (M4)

Milestone goals:
- Facts and edges are stored only at checkpoints.
- Facts are deduped via deterministic IDs.
- Search results are injected cleanly into prompts.

| ID | Title | Description | Acceptance Criteria | Dependencies |
| --- | --- | --- | --- | --- |
| M4-01 | Fact schema | Define fact and edge schema with deterministic `fact_id`. | Fact ID is stable across runs for same data. | M1-01 |
| M4-02 | Distiller | Extract facts and edges from resolution/checkpoints. | Distilled output is small and evidence-based. | M4-01 |
| M4-03 | Cognee client | Integrate Cognee via local package or MCP. | Facts are written and searchable. | M4-01 |
| M4-04 | Fact injection | Query Cognee on thread start and inject into prompts. | Prompts include a facts block separate from SOPs. | M4-03 |
| M4-05 | Anti-collision rules | Enforce dataset scoping, rev, and TTL. | No duplicate or conflicting facts in the graph. | M4-02 |

---

## Phase 5: Automation + UX (M5)

Milestone goals:
- Optional automation does not change the file protocol.
- Multi-repo workflow feels faster but remains inspectable.

| ID | Title | Description | Acceptance Criteria | Dependencies |
| --- | --- | --- | --- | --- |
| M5-01 | Tmux spawn | Optional `council spawn` to open panes per repo. | Panes open with correct working directories. | M2-01 |
| M5-02 | Auto-paste | Optional safe prompt paste helper. | Prompts paste only when user confirms. | M5-01 |
| M5-03 | MCP server | Expose tools as MCP endpoints for automation. | MCP server lists tools and runs core actions. | M1-08 |
| M5-04 | Synergy scan | Improve `council scan` to detect integration points. | Scan output lists endpoints and boundary hints. | M1-03 |

---

## Cross-Cutting Work

| ID | Title | Description | Acceptance Criteria | Dependencies |
| --- | --- | --- | --- | --- |
| CC-01 | Documentation | Minimal README, quickstart, and examples. | New users can run a full thread in < 10 minutes. | M1-08 |
| CC-02 | Redaction guard | Redact secrets in evidence before write. | Evidence writes warn on secrets and mask values. | M1-06 |
| CC-03 | Release checklist | Add a basic release checklist and changelog. | `CHANGELOG.md` and release steps exist. | M1-01 |
