---
name: memory-query
description: Query Council's dual memory system (Acontext + Cognee) to surface past learnings, SOPs, and facts. This skill should be used when users ask "what do we know about X", need to find past resolutions, or want to leverage accumulated knowledge.
---

# Memory Query

## Overview

Search and retrieve knowledge from Council's dual memory system. Acontext stores operational procedures (SOPs), while Cognee stores semantic facts and relationships. This skill helps surface relevant past learnings before starting new investigations.

## Quick Start

```bash
# Query both memory systems
council memory query "authentication errors"

# Query specific system
council memory query --source acontext "deployment procedure"
council memory query --source cognee "JWT token facts"
```

## Memory Systems

### Acontext (Procedural Memory)
Stores **how to do things**:
- Standard Operating Procedures (SOPs)
- Past debugging workflows that worked
- Step-by-step solutions to recurring problems
- Session artifacts and transcripts

**Best for**: "How did we fix X last time?" "What's the procedure for Y?"

### Cognee (Semantic Memory)
Stores **facts and relationships**:
- Entities and their properties
- Relationships between concepts
- Distilled knowledge from resolutions
- Cross-project patterns

**Best for**: "What do we know about X?" "How does A relate to B?"

## Query Patterns

### Pattern 1: Pre-Investigation Check

Before starting a debug session, check if similar issues were resolved:

```bash
# Before creating a thread about auth issues
council memory query "401 authentication production"
```

### Pattern 2: SOP Retrieval

Find established procedures:

```bash
council memory query --source acontext "deploy to production"
council memory query --source acontext "rollback procedure"
```

### Pattern 3: Fact Lookup

Find specific knowledge:

```bash
council memory query --source cognee "token expiration"
council memory query --source cognee "rate limits api"
```

### Pattern 4: Cross-Project Patterns

Find patterns across all projects:

```bash
council memory query "caching strategy"
council memory query "error handling patterns"
```

## Query Syntax

### Basic Query
```
council memory query "<natural language query>"
```

### Filtered Query
```
council memory query \
  --source <acontext|cognee|all> \
  --project <project-name> \
  --since <date> \
  --limit <number> \
  "<query>"
```

### Structured Query (Cognee)
```
council memory query --cognee-search \
  --entity "JWT" \
  --relation "expires_after" \
  --target "*"
```

## Response Format

```markdown
## Memory Query Results

**Query**: "authentication errors"
**Sources**: acontext, cognee
**Results**: 5 matches

### From Acontext (Procedures)

1. **SOP: Debug 401 Errors** (relevance: 0.92)
   - Thread: th_20251215_abc
   - Steps: Check token format → Verify secret → Check CORS

2. **Session: Auth Refactor** (relevance: 0.85)
   - Date: 2025-12-10
   - Key insight: Token refresh race condition

### From Cognee (Facts)

1. **Fact: Token Expiration** (confidence: 0.95)
   - JWT tokens expire after 24 hours
   - Refresh tokens expire after 7 days

2. **Relation: Auth → Redis** (confidence: 0.88)
   - Session tokens stored in Redis cluster
   - TTL synced with JWT expiration
```

## Best Practices

### 1. Query Before You Start
Always check memory before creating a new thread:
```bash
council memory query "<problem description>"
```

### 2. Use Specific Terms
More specific queries yield better results:
- Bad: "error"
- Good: "401 unauthorized error after token refresh"

### 3. Cross-Reference Both Systems
Acontext tells you HOW, Cognee tells you WHAT:
```bash
# What do we know?
council memory query --source cognee "rate limiting"

# How did we handle it?
council memory query --source acontext "rate limiting"
```

### 4. Store New Learnings
After resolving issues, ensure learnings are stored:
```bash
council close --thread <id> --status resolved
# This triggers memory storage
```
