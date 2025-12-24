---
name: evidence-bundle
description: Collect, organize, and package evidence for debugging sessions. This skill should be used when users need to attach logs, screenshots, code snippets, or other artifacts to a thread, or when packaging evidence for sharing.
---

# Evidence Bundle

## Overview

Systematically collect and organize debugging evidence (logs, screenshots, code snippets, stack traces) for Council threads. Ensures all relevant artifacts are captured, properly formatted, and easily accessible to agents.

## Quick Start

```bash
# Add evidence to a thread
council evidence add --thread <id> --type log --file ./error.log

# Bundle all evidence for sharing
council evidence bundle --thread <id> --output ./evidence.zip

# List evidence in a thread
council evidence list --thread <id>
```

## Evidence Types

### 1. Logs
Server logs, application logs, error outputs.

```bash
council evidence add \
  --thread th_xxx \
  --type log \
  --file ./server.log \
  --label "Backend error log"
```

### 2. Screenshots
UI errors, browser console, network tab captures.

```bash
council evidence add \
  --thread th_xxx \
  --type screenshot \
  --file ./error-ui.png \
  --label "Error state in UI"
```

### 3. Code Snippets
Relevant code sections, configurations, environment files.

```bash
council evidence add \
  --thread th_xxx \
  --type snippet \
  --file ./auth.ts:45-80 \
  --label "Token validation logic"
```

### 4. Stack Traces
Exception traces, crash dumps.

```bash
council evidence add \
  --thread th_xxx \
  --type stacktrace \
  --content "Error: Token expired at..."
```

### 5. Network Captures
HAR files, cURL commands, API responses.

```bash
council evidence add \
  --thread th_xxx \
  --type network \
  --file ./api-call.har \
  --label "Failed API request"
```

## Evidence Collection Workflow

### Step 1: Identify What's Needed

For each bug type, collect appropriate evidence:

| Bug Type | Essential Evidence |
|----------|-------------------|
| API Error | Request/response, server logs, status codes |
| UI Bug | Screenshot, console errors, DOM state |
| Performance | Timing logs, profiler output, metrics |
| Auth Issue | Token contents, headers, session state |
| Data Issue | Database queries, input/output samples |

### Step 2: Capture Evidence

Use appropriate tools:

```bash
# Capture API call
curl -v https://api.example.com/user 2>&1 | tee api-error.log

# Capture screenshot (headless)
npx playwright screenshot https://app.example.com ./error.png

# Extract relevant logs
grep -A 10 "ERROR" ./server.log > error-context.log
```

### Step 3: Add to Thread

```bash
council evidence add \
  --thread th_xxx \
  --type log \
  --file ./api-error.log \
  --label "cURL output showing 401"
```

### Step 4: Verify Evidence

List and review:
```bash
council evidence list --thread th_xxx
```

## Evidence Organization

Evidence is stored in:
```
.council/threads/<thread_id>/evidence/
├── log_001_backend-error.log
├── screenshot_002_ui-state.png
├── snippet_003_auth-logic.ts
└── manifest.json
```

The manifest tracks metadata:
```json
{
  "evidence": [
    {
      "id": "log_001",
      "type": "log",
      "label": "Backend error log",
      "file": "log_001_backend-error.log",
      "added_at": "2025-12-23T10:30:00Z",
      "added_by": "HUMAN"
    }
  ]
}
```

## Bundle for Sharing

Create a shareable package:

```bash
council evidence bundle \
  --thread th_xxx \
  --output ./debug-evidence.zip \
  --include-transcript
```

The bundle contains:
- All evidence files
- manifest.json with metadata
- (Optional) Thread transcript
- README with context

## Best Practices

### 1. Redact Sensitive Data
Before adding evidence, redact:
- API keys and tokens
- Passwords and secrets
- Personal identifiable information (PII)

```bash
# Use the redact command
council evidence add \
  --thread th_xxx \
  --file ./log.txt \
  --redact  # Automatically redacts common patterns
```

### 2. Label Clearly
Use descriptive labels:
- Bad: "log1.txt"
- Good: "Backend auth middleware error log 10:30 UTC"

### 3. Capture Context
Include surrounding context, not just the error:
- Lines before/after the error
- Request that triggered it
- System state at the time

### 4. Timestamp Everything
Evidence is more useful with timing:
```bash
council evidence add \
  --thread th_xxx \
  --file ./error.log \
  --timestamp "2025-12-23T10:30:00Z"
```
