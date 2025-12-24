---
name: synergy-scan
description: Discover opportunities for collaboration and knowledge sharing between registered repositories. This skill should be used when users want to find synergies, ask "what can repo A learn from repo B", or want to proactively identify cross-repo improvements.
---

# Synergy Scan

## Overview

Proactively analyze registered repositories to find opportunities for collaboration, code reuse, and knowledge transfer. Surfaces patterns, solutions, and insights that exist in one repo but could benefit others.

## Quick Start

```bash
# Scan all repos for synergies
council scan --all

# Scan specific repos
council scan --repos "frontend,backend,shared"

# Focus on specific area
council scan --focus "authentication"
```

## Synergy Types

### 1. Code Reuse Opportunities
Code in repo A that solves a problem repo B is struggling with.

**Indicators**:
- Similar function names with different implementations
- Duplicate utility code
- Shared domain concepts implemented differently

### 2. Knowledge Transfer
Lessons learned in one repo that apply to others.

**Indicators**:
- Past thread resolutions relevant to current issues
- SOPs that could generalize
- Error patterns seen and solved before

### 3. Architectural Alignment
Structural improvements one repo made that others could adopt.

**Indicators**:
- Different patterns for same problem (e.g., error handling)
- Inconsistent API contracts
- Missing shared abstractions

### 4. Dependency Optimization
Shared dependencies that could be consolidated or updated.

**Indicators**:
- Same package, different versions
- Overlapping functionality from different packages
- Outdated dependencies with known issues

## Scan Workflow

### Step 1: Inventory Repositories

Read registry and understand each repo:
- Path and description
- Key technologies
- Primary responsibilities

### Step 2: Cross-Reference Patterns

For each repo pair, look for:
- Overlapping domains (auth, logging, API clients)
- Complementary capabilities
- Shared challenges in thread history

### Step 3: Query Memory

Check dual memory for past insights:
- Acontext for SOPs and procedures
- Cognee for facts and relationships

### Step 4: Generate Synergy Report

Structure findings as actionable opportunities.

## Synergy Report Format

```markdown
# Synergy Scan Report
**Generated**: <timestamp>
**Repos Scanned**: <list>

## High-Value Synergies

### 1. <Synergy Title>
**Type**: Code Reuse | Knowledge Transfer | Architectural | Dependency
**Source**: <repo with the solution>
**Beneficiary**: <repo that could benefit>
**Effort**: Low | Medium | High
**Impact**: Low | Medium | High

#### Details
<Specific details about what to transfer and how>

#### Suggested Action
<Concrete next step>
```

## Example Synergy

```markdown
### JWT Validation Utility
**Type**: Code Reuse
**Source**: backend
**Beneficiary**: api-gateway
**Opportunity**: Backend has robust JWT validation with refresh token
handling. API Gateway is implementing similar logic from scratch.

**Suggested Action**: Extract backend's jwt-utils to shared package.
```
