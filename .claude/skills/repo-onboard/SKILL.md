---
name: repo-onboard
description: Onboard a new repository to Council with best practices and configuration. This skill should be used when users want to add a new repo to the registry, set up a repo for Council, or say "add this repo to council".
---

# Repo Onboard

## Overview

Guide the process of adding a new repository to Council's registry with proper configuration, memory setup, and best practices. Ensures new repos are ready for cross-repo collaboration.

## Quick Start

```bash
# Initialize Council if not done
council init

# Add a new repo
council registry add \
  --name "my-service" \
  --path "../my-service" \
  --description "My microservice"
```

## Onboarding Workflow

### Step 1: Verify Prerequisites

Before onboarding, ensure:

- [ ] Repository exists and is accessible
- [ ] Council is initialized (`council init`)
- [ ] Repository has a clear purpose/description
- [ ] You understand how this repo relates to others

### Step 2: Gather Information

Collect details about the new repo:

| Field | Description | Example |
|-------|-------------|---------|
| **name** | Short identifier (no spaces) | `api-gateway` |
| **path** | Relative path from Council root | `../api-gateway` |
| **description** | What this repo does | `API gateway and auth` |
| **tech** | Key technologies | `Node.js, Express, Redis` |
| **team** | Owning team (optional) | `platform` |

### Step 3: Add to Registry

Edit `.council/registry.yaml`:

```yaml
repos:
  # Existing repos...

  api-gateway:
    path: ../api-gateway
    description: API gateway handling auth and routing
    tech:
      - nodejs
      - express
      - redis
    team: platform
    memory:
      acontext: true
      cognee: true
```

Or use the CLI:

```bash
council registry add \
  --name "api-gateway" \
  --path "../api-gateway" \
  --description "API gateway handling auth and routing"
```

### Step 4: Verify Configuration

Test that Council can access the repo:

```bash
council registry verify --repo api-gateway
```

Expected output:
```
✓ Path exists: ../api-gateway
✓ Git repository detected
✓ CLAUDE.md found (optional)
✓ Ready for Council sessions
```

### Step 5: Create CLAUDE.md (Recommended)

Add a CLAUDE.md in the repo root to guide agents:

```markdown
# CLAUDE.md

## Overview
API gateway handling authentication, rate limiting, and routing.

## Key Files
- `src/auth/` - Authentication middleware
- `src/routes/` - Route definitions
- `src/rate-limit/` - Rate limiting logic

## Common Issues
- Token validation failures: Check TOKEN_SECRET env var
- Rate limit errors: Check Redis connection

## Related Repos
- `backend`: Main API (routes to this)
- `frontend`: Client (calls through this)
```

### Step 6: Test Integration

Create a test thread to verify:

```bash
# Create thread with new repo
council thread new \
  --title "Test: api-gateway integration" \
  --repos "api-gateway,backend"

# Generate prompts
council prompts --thread <id>

# Verify prompts include new repo context
```

### Step 7: Document Relationships

Update the registry to note relationships:

```yaml
repos:
  api-gateway:
    path: ../api-gateway
    description: API gateway handling auth and routing
    relationships:
      - type: routes_to
        target: backend
      - type: called_by
        target: frontend
```

## Configuration Options

### Memory Settings

```yaml
repos:
  my-repo:
    memory:
      acontext:
        enabled: true
        namespace: my-repo  # Isolate memory
      cognee:
        enabled: true
        dataset: my-repo-facts
```

### Agent Hints

```yaml
repos:
  my-repo:
    agent:
      model: claude-3-opus  # Prefer specific model
      context_files:        # Always include these
        - README.md
        - CLAUDE.md
        - src/index.ts
```

### Spawn Configuration

```yaml
repos:
  my-repo:
    spawn:
      working_dir: src/     # Start in subdirectory
      env:
        NODE_ENV: development
```

## Best Practices

### 1. Use Descriptive Names
Names should be clear and consistent:
- Good: `user-service`, `api-gateway`, `frontend-web`
- Bad: `svc1`, `new-thing`, `test`

### 2. Write Clear Descriptions
Descriptions help agents understand context:
- Good: "User authentication and profile management service"
- Bad: "handles users"

### 3. Document Relationships
Explicit relationships improve cross-repo reasoning:
```yaml
relationships:
  - type: depends_on
    target: shared-lib
  - type: publishes_to
    target: message-queue
```

### 4. Create CLAUDE.md
A CLAUDE.md in each repo helps agents:
- Understand the codebase quickly
- Know common issues and solutions
- Find key files and entry points

### 5. Test Before Production
Always verify with a test thread before using in real debugging:
```bash
council thread new --title "Test: new-repo" --repos "new-repo"
council tick --thread <id> --dry-run
```

## Troubleshooting

### "Path not found"
```bash
# Check the path is correct relative to .council/
ls -la ../my-repo
```

### "Git not detected"
```bash
# Ensure it's a git repository
cd ../my-repo && git status
```

### "Agent can't understand repo"
Add or improve CLAUDE.md with:
- Clear overview
- Key file locations
- Common patterns in the codebase
