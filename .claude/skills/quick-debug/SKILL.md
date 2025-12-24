---
name: quick-debug
description: Rapidly set up a multi-repo debugging session in Council. This skill should be used when users report bugs that span multiple repositories, need to quickly create a debug thread, or say things like "debug auth issue between frontend and backend".
---

# Quick Debug

## Overview

Rapidly create and configure a Council debugging session across multiple repositories. Reduces the friction of setting up threads, sending initial messages, and generating prompts for cross-repo bug investigation.

## Quick Start

To debug an issue across repos:

1. **Identify affected repos** from the user's description
2. **Create a focused thread** with clear title
3. **Send initial hypothesis** from the reporting repo
4. **Generate prompts** for each involved agent

## Workflow

### Step 1: Parse the Bug Report

Extract key information:
- **Symptom**: What's failing? (e.g., "401 errors after login")
- **Affected repos**: Which repos are involved?
- **Reproduction steps**: How to trigger the bug?
- **Evidence**: Any logs, screenshots, or error messages?

### Step 2: Create Debug Thread

```bash
council thread new \
  --title "Debug: <symptom summary>" \
  --repos "<repo1>,<repo2>"
```

Use a clear, searchable title format: `Debug: <symptom> between <repo1> and <repo2>`

### Step 3: Send Initial Message

From the repo where the symptom is observed:

```bash
council ask \
  --thread <thread_id> \
  --from <symptom_repo> \
  --to <suspected_cause_repo> \
  --type hypothesis \
  --summary "<initial hypothesis about root cause>"
```

### Step 4: Attach Evidence

If there's evidence (logs, screenshots):

```bash
council evidence add \
  --thread <thread_id> \
  --type <log|screenshot|snippet> \
  --file <path>
```

### Step 5: Generate Prompts

```bash
council prompts --thread <thread_id>
```

### Step 6: Start Investigation

Either advance manually:
```bash
council tick --thread <thread_id>
```

Or watch live:
```bash
council live --thread <thread_id>
```

## Example Session

User says: "Getting 401 errors on /api/user after login, works fine locally"

```bash
# 1. Create thread
council thread new --title "Debug: 401 on /api/user post-login" --repos "frontend,backend"

# 2. Initial hypothesis from frontend
council ask \
  --thread th_20251223_xyz \
  --from frontend \
  --to backend \
  --type hypothesis \
  --summary "Getting 401 on /api/user after successful login. Token is being sent in Authorization header. Suspect token validation or CORS issue on backend."

# 3. Generate prompts
council prompts --thread th_20251223_xyz

# 4. Start live session
council live --thread th_20251223_xyz
```

## Memory Integration

Before starting debug, query memory for similar past issues:

```bash
# Check if we've seen this before
council memory query "401 authentication errors"
```

This surfaces relevant SOPs and past resolutions.
