---
name: resolution-log
description: Track and document decisions and resolutions made during Council threads. This skill should be used when users want to log a decision, track resolutions, or need an audit trail of what was decided.
---

# Resolution Log

## Overview

Maintain a structured log of decisions and resolutions made during Council threads. Provides an audit trail, enables accountability, and ensures decisions are documented for future reference.

## Quick Start

```bash
# Log a resolution
council resolve \
  --thread th_xxx \
  --type decision \
  --summary "Use JWT for auth" \
  --rationale "Better for microservices"

# View resolution log
council resolutions --thread th_xxx

# View all resolutions
council resolutions --all
```

## Resolution Types

### 1. Decision
A choice made between options:

```bash
council resolve \
  --thread th_xxx \
  --type decision \
  --summary "Implement rate limiting with token bucket" \
  --alternatives "sliding window, fixed window" \
  --rationale "Better burst handling"
```

### 2. Root Cause
Identification of an issue's cause:

```bash
council resolve \
  --thread th_xxx \
  --type root_cause \
  --summary "TOKEN_SECRET mismatch in production" \
  --evidence "log_001, snippet_002"
```

### 3. Fix
A solution that was implemented:

```bash
council resolve \
  --thread th_xxx \
  --type fix \
  --summary "Updated TOKEN_SECRET in backend deployment" \
  --verified true \
  --commit "abc123"
```

### 4. Action Item
A task to be done later:

```bash
council resolve \
  --thread th_xxx \
  --type action_item \
  --summary "Add secret rotation validation" \
  --owner backend \
  --priority high
```

### 5. Rejection
An option that was explicitly rejected:

```bash
council resolve \
  --thread th_xxx \
  --type rejection \
  --summary "Not implementing session-based auth" \
  --rationale "Doesn't scale well for microservices"
```

## Resolution Structure

Each resolution contains:

```json
{
  "id": "res_001",
  "thread_id": "th_20251223_abc",
  "type": "decision",
  "summary": "Use JWT for authentication",
  "rationale": "Better suited for microservices architecture",
  "alternatives_considered": [
    "Session-based auth",
    "OAuth tokens"
  ],
  "decided_by": "backend",
  "approved_by": ["frontend", "HUMAN"],
  "evidence": ["snippet_001"],
  "created_at": "2025-12-23T10:30:00Z",
  "confidence": "high"
}
```

## Logging Workflow

### Step 1: Identify Resolution

When a decision is made or problem solved:
- Explicit statements: "Let's go with X"
- Consensus reached: Multiple agents agree
- Human intervention: "HUMAN decides X"

### Step 2: Capture Details

For each resolution, record:

| Field | Description |
|-------|-------------|
| **type** | decision, root_cause, fix, action_item, rejection |
| **summary** | One-line description |
| **rationale** | Why this was chosen |
| **alternatives** | Other options considered |
| **evidence** | Supporting artifacts |
| **decided_by** | Who made the decision |
| **approved_by** | Who agreed |

### Step 3: Log Resolution

```bash
council resolve \
  --thread th_xxx \
  --type decision \
  --summary "..." \
  --rationale "..." \
  --decided-by backend
```

### Step 4: Verify and Store

The resolution is:
1. Added to thread's resolution log
2. Stored in Acontext for future reference
3. Linked to relevant evidence

## Resolution Log Format

```markdown
# Resolution Log: th_20251223_abc

## Summary
- **Thread**: Debug: 401 on /api/user
- **Total Resolutions**: 4
- **Status**: Resolved

---

## Resolutions

### RES-001: Root Cause Identified
**Type**: root_cause
**Time**: 2025-12-23 11:00

TOKEN_SECRET environment variable was rotated but not
propagated to backend deployment.

**Evidence**: log_001, snippet_002
**Confidence**: High

---

### RES-002: Fix Applied
**Type**: fix
**Time**: 2025-12-23 11:30

Updated TOKEN_SECRET in backend deployment and restarted pods.

**Verified**: Yes
**Commit**: abc123def

---

### RES-003: Prevention Decision
**Type**: decision
**Time**: 2025-12-23 12:00

Add automated secret validation to deployment pipeline.

**Rationale**: Prevents future secret rotation issues
**Alternatives Considered**:
- Manual checklist (rejected: error-prone)
- Startup health check (accepted as additional measure)

**Decided By**: HUMAN
**Approved By**: backend, platform

---

### RES-004: Follow-up Action
**Type**: action_item
**Time**: 2025-12-23 12:15

Implement auth failure rate alerting.

**Owner**: platform
**Priority**: High
**Due**: 1 week
**Status**: Pending
```

## Querying Resolutions

### By Thread
```bash
council resolutions --thread th_xxx
```

### By Type
```bash
council resolutions --type decision
council resolutions --type action_item --status pending
```

### By Time
```bash
council resolutions --since 2025-12-01
council resolutions --last 7d
```

### By Owner
```bash
council resolutions --owner backend
council resolutions --decided-by HUMAN
```

## Integration with Memory

Resolutions are automatically stored:

### In Acontext
As SOPs for similar situations:
```
SOP: Secret Rotation Issue
When: TOKEN_SECRET mismatch suspected
Then: Check deployment config, verify secret propagation
Resolution: th_20251223_abc
```

### In Cognee
As facts and relationships:
```
Fact: TOKEN_SECRET requires manual propagation
Relation: backend deployment → depends on → secrets manager
```

## Best Practices

### 1. Log Immediately
Don't wait until thread close:
- Log decisions as they happen
- Easier to capture context
- Less chance of forgetting details

### 2. Include Rationale
Future readers need to understand WHY:
- Bad: "Use JWT"
- Good: "Use JWT because session storage doesn't scale across our microservices"

### 3. Document Rejections
Knowing what was rejected is valuable:
- Prevents revisiting dead ends
- Documents trade-off decisions
- Shows thoroughness

### 4. Link Evidence
Connect resolutions to supporting artifacts:
```bash
council resolve \
  --thread th_xxx \
  --evidence "log_001,screenshot_002"
```

### 5. Assign Owners
Action items need accountability:
```bash
council resolve \
  --type action_item \
  --owner platform \
  --priority high
```

## Audit Trail

For compliance and review, export resolution history:

```bash
# Export as JSON
council resolutions --all --format json > resolutions.json

# Export as CSV
council resolutions --all --format csv > resolutions.csv

# Export with full context
council resolutions --all --include-context > full-audit.json
```
