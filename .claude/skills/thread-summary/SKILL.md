---
name: thread-summary
description: Generate a comprehensive summary of a Council conversation thread. This skill should be used when users need to catch up on a thread, want documentation of what happened, or ask things like "summarize this thread" or "what happened in thread X".
---

# Thread Summary

## Overview

Generate clear, actionable summaries of Council conversation threads. Useful for catching up on discussions, creating documentation, or extracting key decisions and action items.

## Quick Start

To summarize a thread:

1. Read the thread's transcript
2. Identify key participants and their roles
3. Extract the problem, hypotheses, and resolution
4. List action items and decisions made

## Summary Structure

### Header
- **Thread ID**: `th_YYYYMMDD_xxx`
- **Title**: Original thread title
- **Duration**: Start → End (or "ongoing")
- **Participants**: List of repos/agents involved
- **Status**: `open` | `resolved` | `stalled`

### Problem Statement
One paragraph describing the original issue that triggered the thread.

### Timeline
Chronological list of key events:
```
[timestamp] <from> → <to>: <summary of message>
```

### Hypotheses Explored
Bullet list of hypotheses raised and their outcomes:
- **Hypothesis 1**: <description> → `confirmed` | `rejected` | `partial`
- **Hypothesis 2**: <description> → `confirmed` | `rejected` | `partial`

### Resolution
If resolved: What was the root cause? What was the fix?
If ongoing: Current status and next steps.

### Decisions Made
Numbered list of decisions with who made them:
1. <decision> (decided by <agent/human>)

### Action Items
- [ ] <action> (assigned to <repo>)
- [x] <completed action>

### Lessons Learned
Key takeaways that should be stored in memory for future reference.

## Workflow

### Step 1: Load Thread Data

Read the transcript and state:
- `.council/threads/<thread_id>/transcript.md`
- `.council/threads/<thread_id>/state.json`
- `.council/threads/<thread_id>/evidence/`

### Step 2: Parse Messages

For each message, extract:
- Timestamp
- Sender and recipient
- Message type (question, answer, hypothesis, resolution)
- Key content

### Step 3: Identify Patterns

Look for:
- Problem → Hypothesis → Validation cycles
- Escalations or human interventions
- Turning points in the investigation

### Step 4: Synthesize

Combine into the summary structure above. Be concise but complete.

## Example Output

```markdown
# Thread Summary: th_20251223_abc

**Title**: Debug: 401 on /api/user post-login
**Duration**: 2h 15m (10:30 → 12:45)
**Participants**: frontend, backend, HUMAN
**Status**: resolved

## Problem
Frontend receiving 401 Unauthorized errors when calling /api/user
immediately after successful login. Issue only occurs in production.

## Timeline
- [10:30] frontend → backend: Initial report of 401 errors
- [10:45] backend → frontend: Requested token format details
- [11:00] frontend → backend: Shared token structure, noted prod-only
- [11:30] HUMAN → ALL: Suggested checking env var differences
- [11:45] backend: Found TOKEN_SECRET mismatch in prod
- [12:45] Resolution confirmed

## Resolution
**Root Cause**: Production TOKEN_SECRET environment variable was
rotated but not updated in the backend deployment.

**Fix**: Updated backend deployment with correct TOKEN_SECRET.

## Lessons Learned
- Add TOKEN_SECRET to deployment checklist
- Consider automated secret rotation validation
```
