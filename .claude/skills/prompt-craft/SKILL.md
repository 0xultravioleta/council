---
name: prompt-craft
description: Generate optimized prompts for Council agents based on thread context. This skill should be used when users want better agent responses, need to customize prompts, or ask "improve the prompts for this thread".
---

# Prompt Craft

## Overview

Generate high-quality, context-aware prompts for Council agents. Optimizes prompts based on thread context, repo characteristics, and message history to improve agent responses.

## Quick Start

```bash
# Generate prompts for a thread
council prompts --thread th_xxx

# Generate with optimization hints
council prompts --thread th_xxx --optimize

# Preview without saving
council prompts --thread th_xxx --dry-run
```

## Prompt Structure

Council prompts have these sections:

### 1. System Context
Who the agent is and what repo it represents.

### 2. Thread Context
What's being discussed and why.

### 3. Message History
Recent messages in the conversation.

### 4. Pending Inbox
Messages awaiting response.

### 5. Memory Context
Relevant knowledge from Acontext/Cognee.

### 6. Instructions
What the agent should do next.

## Prompt Template

```markdown
# Council Agent: {repo_name}

You are an AI agent representing the {repo_name} repository in a Council debugging session.

## Your Repository
{repo_description}

Key technologies: {tech_stack}
Key files: {key_files}

## Thread Context
**Title**: {thread_title}
**Participants**: {participants}
**Status**: {status}

## Conversation History
{message_history}

## Your Inbox
{pending_messages}

## Relevant Memory
### From Past Sessions (Acontext)
{acontext_results}

### Known Facts (Cognee)
{cognee_results}

## Your Task
{instructions}

Remember:
- Be specific about code locations
- Reference evidence when available
- Propose testable hypotheses
- Ask clarifying questions if needed
```

## Optimization Techniques

### 1. Context Pruning
Remove irrelevant history to focus attention:

```typescript
// Keep only messages related to current hypothesis
const relevantMessages = messages.filter(m =>
  m.relates_to(currentHypothesis) ||
  m.type === 'human_intervention'
);
```

### 2. Memory Injection
Add relevant past knowledge:

```typescript
// Query memory for similar issues
const pastKnowledge = await Promise.all([
  acontext.search(thread.title),
  cognee.search(thread.symptoms)
]);
```

### 3. Role Emphasis
Emphasize the agent's unique perspective:

```markdown
## Your Unique Perspective
As the {repo_name} agent, you have deep knowledge of:
- {specific_domain}
- {key_patterns}
- {common_issues}

Other agents rely on your expertise in these areas.
```

### 4. Hypothesis Framing
Guide productive investigation:

```markdown
## Current Investigation
We're exploring the hypothesis: "{hypothesis}"

Your role: {specific_task_for_this_repo}

Evidence to consider:
{relevant_evidence}
```

### 5. Output Formatting
Request structured responses:

```markdown
## Response Format
Please structure your response as:

### Analysis
Your analysis of the current hypothesis.

### Evidence
Code locations or logs that support your analysis.

### Next Steps
What should be investigated next.

### Questions
Any clarifying questions for other agents.
```

## Prompt Patterns

### Pattern 1: Initial Investigation
First message in a thread:

```markdown
## Your Task
A new issue has been reported:

"{problem_description}"

As the {repo_name} expert:
1. Review your codebase for relevant areas
2. Form an initial hypothesis
3. Identify what information you need from other repos
```

### Pattern 2: Response to Hypothesis
Responding to another agent's hypothesis:

```markdown
## Your Task
{other_repo} proposes:

"{hypothesis}"

Evaluate this from {repo_name}'s perspective:
1. Does this align with what you see in your codebase?
2. What evidence supports or contradicts this?
3. What additional information can you provide?
```

### Pattern 3: Evidence Analysis
When evidence has been added:

```markdown
## New Evidence
{evidence_description}

## Your Task
Analyze this evidence from {repo_name}'s perspective:
1. What does this tell us about the issue?
2. Does this change any hypotheses?
3. What code paths in your repo are involved?
```

### Pattern 4: Resolution Proposal
When proposing a fix:

```markdown
## Your Task
Based on the investigation, propose a resolution:

1. What is the root cause?
2. What changes are needed in {repo_name}?
3. What changes are needed in other repos?
4. How can we verify the fix?
```

## Customization

### Per-Repo Prompts
Add custom prompt sections in registry:

```yaml
repos:
  backend:
    prompt:
      preamble: |
        You have access to the database schema.
        Always consider data consistency.
      emphasis:
        - API contract stability
        - Backward compatibility
```

### Thread-Specific Hints
Add hints when creating threads:

```bash
council thread new \
  --title "Debug auth" \
  --repos "frontend,backend" \
  --hint "Focus on token refresh flow"
```

## Best Practices

### 1. Be Specific
Vague prompts get vague responses:
- Bad: "Look into this issue"
- Good: "Check if token validation in auth.ts handles expired tokens"

### 2. Provide Context
Agents work better with background:
- Include relevant memory results
- Reference specific evidence
- Link to related past threads

### 3. Set Clear Expectations
Tell agents what format you want:
- Structured responses
- Code references with line numbers
- Confidence levels for hypotheses

### 4. Enable Collaboration
Prompt agents to work together:
- "What do you need from {other_repo}?"
- "Does this align with what {other_repo} said?"
- "Propose a joint solution"

## Troubleshooting

### "Agent responses are too generic"
- Add more repo-specific context
- Include key file paths
- Reference specific code patterns

### "Agent misunderstands the issue"
- Improve thread title clarity
- Add more context to initial message
- Include relevant evidence upfront

### "Agent ignores past knowledge"
- Explicitly inject memory results
- Reference specific past threads
- Quote relevant SOPs
