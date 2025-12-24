---
name: postmortem
description: Generate a comprehensive postmortem from a resolved Council thread. This skill should be used when a thread is closed, users want to document lessons learned, or need a formal incident report.
---

# Postmortem

## Overview

Generate structured postmortem documents from resolved Council threads. Captures root cause, timeline, resolution, and actionable lessons learned. Ensures knowledge is preserved and similar issues are prevented.

## Quick Start

```bash
# Generate postmortem for a resolved thread
council postmortem --thread th_xxx

# Generate with specific format
council postmortem --thread th_xxx --format markdown

# Include all evidence
council postmortem --thread th_xxx --include-evidence
```

## Postmortem Structure

### 1. Summary
One-paragraph executive summary of the incident.

### 2. Impact
- **Severity**: Critical | High | Medium | Low
- **Duration**: Time from detection to resolution
- **Affected Systems**: Which repos/services
- **User Impact**: What users experienced

### 3. Timeline
Chronological sequence of events from detection to resolution.

### 4. Root Cause
Technical explanation of what caused the issue.

### 5. Resolution
What was done to fix the issue.

### 6. Lessons Learned
Actionable insights for preventing recurrence.

### 7. Action Items
Specific follow-up tasks with owners.

## Workflow

### Step 1: Gather Data

From the thread, extract:
- Initial problem report
- All hypotheses explored
- Evidence collected
- Resolution message
- Human interventions

### Step 2: Analyze Timeline

Build chronological narrative:
```
[T+0m]  Issue detected: <symptom>
[T+15m] Initial hypothesis: <hypothesis>
[T+30m] Hypothesis rejected: <reason>
[T+45m] Root cause identified: <cause>
[T+60m] Fix deployed: <fix>
[T+75m] Resolution confirmed
```

### Step 3: Identify Root Cause

Distinguish between:
- **Proximate cause**: The immediate trigger
- **Root cause**: The underlying systemic issue
- **Contributing factors**: What made it worse

### Step 4: Extract Lessons

For each lesson:
1. What went wrong?
2. Why did it happen?
3. How do we prevent it?

### Step 5: Define Action Items

Each action item should have:
- Clear description
- Owner (repo or person)
- Due date (if applicable)
- Priority

## Postmortem Template

```markdown
# Postmortem: <Title>

**Thread**: th_xxx
**Date**: YYYY-MM-DD
**Severity**: High
**Duration**: 2h 15m

## Summary

Brief description of what happened, impact, and resolution.

## Impact

- **Services Affected**: frontend, backend
- **User Impact**: Users unable to log in for 2 hours
- **Data Impact**: None

## Timeline

| Time | Event |
|------|-------|
| 10:00 | First user reports login failure |
| 10:15 | On-call alerted, investigation begins |
| 10:30 | Identified: 401 errors on /api/user |
| 11:00 | Root cause found: TOKEN_SECRET mismatch |
| 11:30 | Fix deployed to production |
| 12:15 | All systems nominal, incident closed |

## Root Cause

**Proximate Cause**: Backend rejecting valid tokens with 401.

**Root Cause**: TOKEN_SECRET environment variable was rotated
in secrets manager but not propagated to backend deployment.
The deployment uses a cached secret that wasn't refreshed.

**Contributing Factors**:
- No automated validation of secret rotation
- Deployment doesn't verify secret accessibility on startup

## Resolution

1. Manually updated TOKEN_SECRET in backend deployment
2. Restarted backend pods to pick up new secret
3. Verified token validation working

## Lessons Learned

### What Went Well
- Quick detection via user reports
- Cross-repo collaboration effective
- Root cause identified within 1 hour

### What Went Wrong
- Secret rotation process has no validation
- No alerts for auth failure spike
- Deployment doesn't health-check auth on startup

### Where We Got Lucky
- Issue happened during business hours
- Low traffic period minimized impact

## Action Items

| Action | Owner | Priority | Due |
|--------|-------|----------|-----|
| Add secret validation to rotation script | backend | High | 1 week |
| Alert on auth failure rate spike | platform | High | 1 week |
| Startup health check for auth | backend | Medium | 2 weeks |
| Document secret rotation procedure | docs | Low | 1 month |

## Memory Storage

This postmortem has been stored in:
- **Acontext**: SOP for "Secret Rotation Debugging"
- **Cognee**: Facts about TOKEN_SECRET and auth flow
```

## Best Practices

### 1. Blameless Analysis
Focus on systems, not individuals:
- Bad: "John forgot to update the secret"
- Good: "The rotation process lacks automated propagation"

### 2. Be Specific
Vague lessons don't help:
- Bad: "Improve monitoring"
- Good: "Add alert when auth failure rate exceeds 5% over 5 minutes"

### 3. Prioritize Action Items
Not everything needs to be fixed immediately:
- **P0**: Would have prevented this incident
- **P1**: Would have reduced impact/duration
- **P2**: General improvements surfaced

### 4. Store in Memory
Ensure learnings are stored:
```bash
council close --thread th_xxx --status resolved
# This triggers automatic memory storage

# Or manually:
council memory store --thread th_xxx --type postmortem
```
