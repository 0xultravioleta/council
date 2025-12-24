---
name: live-narrator
description: Provide real-time narration of Council sessions for human observers. This skill should be used when users are watching a live session and want commentary, or ask "explain what's happening".
---

# Live Narrator

## Overview

Provide human-friendly, real-time narration of Council sessions. Translates technical agent dialogue into understandable commentary, highlights key moments, and helps observers follow complex multi-repo investigations.

## Quick Start

```bash
# Start live session with narration
council live --thread th_xxx --narrate

# Narrate an existing session
council narrate --thread th_xxx

# Narrate with verbosity level
council live --thread th_xxx --narrate --verbosity high
```

## Narration Levels

### Level 1: Headlines (--verbosity low)
Just the key events:

```
[10:30] Thread started: Debug 401 errors
[10:35] frontend sends hypothesis to backend
[10:45] backend responds with counterpoint
[11:00] Root cause identified!
[11:15] Fix proposed
```

### Level 2: Summary (--verbosity medium) [Default]
Events with brief explanations:

```
[10:30] 🎬 Thread Started
        "Debug: 401 on /api/user post-login"
        Participants: frontend, backend

[10:35] 💭 Hypothesis Proposed
        frontend → backend:
        "Suspect token validation issue. Headers look correct
        but getting 401 after successful login."

[10:45] 🔍 Investigation
        backend analyzing auth middleware...
        Checking: src/middleware/auth.ts

[11:00] 💡 Breakthrough!
        backend found TOKEN_SECRET mismatch in production.
        This explains why tokens validate locally but fail in prod.
```

### Level 3: Full (--verbosity high)
Complete play-by-play:

```
[10:30:00] 🎬 SESSION START
═══════════════════════════════════════════════════════
Thread: th_20251223_abc
Title: Debug: 401 on /api/user post-login
Repos: frontend, backend
Status: Open
═══════════════════════════════════════════════════════

[10:30:15] 📋 CONTEXT LOADED
frontend repo initialized:
- React 18 frontend
- Auth via JWT tokens
- Key file: src/api/auth.ts

backend repo initialized:
- Node.js Express API
- JWT validation middleware
- Key file: src/middleware/auth.ts

[10:35:00] 📤 MESSAGE: frontend → backend
┌─────────────────────────────────────────────────────┐
│ Type: hypothesis                                     │
│ From: frontend                                       │
│ To: backend                                          │
├─────────────────────────────────────────────────────┤
│ "Getting 401 on /api/user after successful login.   │
│ Token is being sent in Authorization header.        │
│ Suspect token validation or CORS issue on backend." │
│                                                      │
│ Evidence attached: screenshot_001 (Network tab)     │
└─────────────────────────────────────────────────────┘

💬 NARRATOR: frontend is reaching out to backend with an
initial theory. They've included a screenshot showing the
failing request. The token looks valid, so something on
the backend side might be rejecting it incorrectly.

[10:45:00] 📥 MESSAGE: backend → frontend
...
```

## Narration Events

### Session Events
| Event | Icon | Meaning |
|-------|------|---------|
| Thread Start | 🎬 | Session begins |
| Thread Close | 🏁 | Session ends |
| Human Joins | 👤 | Human intervention |
| Context Load | 📋 | Agent loading context |

### Message Events
| Event | Icon | Meaning |
|-------|------|---------|
| Hypothesis | 💭 | Theory proposed |
| Question | ❓ | Clarification needed |
| Answer | 💬 | Response to question |
| Evidence | 📎 | Artifact attached |
| Analysis | 🔍 | Deep investigation |

### Progress Events
| Event | Icon | Meaning |
|-------|------|---------|
| Breakthrough | 💡 | Key insight found |
| Root Cause | 🎯 | Problem identified |
| Fix Proposed | 🔧 | Solution suggested |
| Verified | ✅ | Fix confirmed working |
| Blocked | 🚫 | Investigation stuck |

### Meta Events
| Event | Icon | Meaning |
|-------|------|---------|
| Memory Query | 🧠 | Checking past knowledge |
| Synergy Found | 🔗 | Cross-repo connection |
| Decision | ⚖️ | Choice made |
| Action Item | 📝 | Follow-up task created |

## Narration Style

### Be Conversational
Translate technical to human:

```
❌ "backend.auth.validateToken() returned INVALID_SIGNATURE"

✅ "Backend found the problem! The token signature doesn't
   match what the server expects. This usually means the
   secret key used to sign tokens is different between
   where the token was created and where it's being verified."
```

### Highlight Significance
Point out why something matters:

```
💡 This is important because...

🔍 Note: This contradicts what frontend said earlier...

⚠️ Potential issue: This might affect other services too...
```

### Explain Context
Help observers understand the flow:

```
📋 CONTEXT: In this architecture, frontend gets a JWT token
   after login and sends it with every API request. Backend
   must validate this token before processing requests.

   Right now, the token is being rejected, causing 401 errors.
```

### Summarize Progress
Periodically recap:

```
📊 PROGRESS UPDATE (15 minutes in)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Problem identified: 401 errors post-login
✓ Initial hypothesis: Token validation issue
→ Currently investigating: TOKEN_SECRET configuration
○ Pending: Verify fix, update deployment
```

## Interactive Features

### Ask Narrator Questions
```
> What's the current status?

📊 Currently: backend is analyzing the auth middleware.
   They've found that TOKEN_SECRET differs between local
   and production environments. A fix is being discussed.
```

### Get Predictions
```
> What's likely to happen next?

🔮 Based on the conversation, backend will probably:
   1. Propose updating the production TOKEN_SECRET
   2. Request a deployment to apply the change
   3. Ask frontend to verify the fix works
```

### Highlight Search
```
> When was TOKEN_SECRET first mentioned?

🔍 TOKEN_SECRET was first mentioned at [10:52] by backend:
   "Found it - TOKEN_SECRET in production is the old value"
```

## Best Practices

### 1. Know Your Audience
Adjust verbosity based on who's watching:
- Developers: Medium verbosity, technical details
- Managers: Low verbosity, focus on progress
- Debugging: High verbosity, miss nothing

### 2. Highlight Turning Points
Mark moments that changed the investigation:

```
⭐ TURNING POINT [11:00]
   backend's discovery of the TOKEN_SECRET mismatch
   shifted the investigation from "possible CORS issue"
   to "definite configuration problem."
```

### 3. Maintain Timeline
Keep observers oriented in time:

```
📍 We're 45 minutes into this session.
   Key events so far:
   - [T+15m] Initial hypothesis formed
   - [T+30m] Hypothesis refined
   - [T+45m] Root cause identified ← We are here
```

### 4. Connect the Dots
Show how pieces relate:

```
🔗 This connects to what frontend said earlier about
   "tokens working locally but not in production" -
   now we know why: different TOKEN_SECRET values.
```

## Output Formats

### Terminal (Default)
Colored, formatted terminal output.

### Markdown
```bash
council narrate --thread th_xxx --format markdown > narration.md
```

### JSON (For Integration)
```bash
council narrate --thread th_xxx --format json
```

Output:
```json
{
  "timestamp": "2025-12-23T10:35:00Z",
  "event": "message",
  "type": "hypothesis",
  "from": "frontend",
  "to": "backend",
  "summary": "Token validation issue suspected",
  "significance": "high",
  "narration": "frontend proposes initial theory..."
}
```
