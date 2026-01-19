# Council Implementation TODO

> Auto-generated from control-plane brainstorming backlog on 2026-01-19.
> Sources: session_karmacadabra_agent_economy, session_karmacadabra_extensions, from_claude_agent_sdk_workshop, from_anthropic_long_running_agents

---

## Context

Council is the multi-repo orchestration tool. Key integrations needed:
- Claude Agent SDK Harness Pattern
- Two-Agent Pattern (Council + Tribunal)
- KarmaCadabra agent economy foundation

---

## P0 (CRITICAL - This Week)

### 1. Implement Claude Agent SDK Harness Pattern
**Priority**: P0
**Status**: [ ] Not started
**Location**: Refactor `src/` to match harness

Map current code to:
- tools (repo management)
- hooks (code verification)
- skills (language-specific)
- sub-agents (specialized per repo)

**Why**: Foundational pattern for all agent work

---

### 2. Implement Two-Agent Harness (Council + Tribunal)
**Priority**: P0
**Status**: [ ] Not started
**Location**: `src/handoff/`

- Council = Initializer (define voting structure)
- Tribunal = Coding Agent (execute votes)
- Formal artifacts for session handoff between agents

**Why**: Enables long-running agent sessions

---

### 3. Design PersonalAgent schema extending base_agent.py
**Priority**: P0
**Status**: [ ] Not started
**Location**: `src/agents/personal_agent.py`

- `PersonalAgent` class with multi-source data ingestion
- Sources: karma-hello logs, abracadabra transcripts
- Enables core vision: one agent per DAO member

---

### 4. Define KarmaCadabra 5 Specialized Agents Plan
**Priority**: P0
**Status**: [ ] Not started
**Location**: `docs/karmacadabra-agents.md`

Implement with ERC-8004 Extended identity:
1. QualityEvaluator - data validation, stake-backed
2. TranscriptionAgent - audio to text with timestamps
3. SentimentAnalyzer - emotion detection, style extraction
4. EngagementPredictor - engagement scoring
5. ContentModerator - content filtering

---

## P1 (High Priority - This Month)

### 5. Prototype PersonalAgent Training Pipeline
**Priority**: P1
**Status**: [ ] Not started
**Location**: `src/training/`

Pipeline:
- karma-hello logs (10k+ messages)
- abracadabra transcripts (70+ streams)
- → StyleExtractor → SkillDetector → PersonalAgent

Deliverable: Working prototype for 1 DAO member

---

### 6. Build x402 Payment Integration for Agent Services
**Priority**: P1
**Status**: [ ] Not started
**Location**: `src/payments/`

- Agents accept GLUE token (EIP-3009 gasless)
- Example: `receive(from_agent, amount_glue, token='GLUE', chain='base_sepolia', gasless=True)`

---

### 7. Prototype meshrelay IRC → KarmaCadabra Bridge
**Priority**: P1
**Status**: [ ] Not started
**Location**: `src/irc_bridge/`

- A2A communication via IRC channels
- Channels: #karmacadabra-marketplace, #kc-skills, #kc-data
- Message format: `OFFER: <agent> selling <product> for <price> GLUE`

---

### 8. Build Log Marketplace API
**Priority**: P1
**Status**: [ ] Not started
**Location**: `src/marketplace/`

Agents buy/sell:
- RAW_LOGS: 0.01 GLUE/1k msgs
- TRANSCRIPTS: 0.05 GLUE/stream
- CONTEXT_PACKS: 0.10 GLUE/topic

Quality validated by QualityEvaluator before listing.

---

### 9. Build Style Extraction Service
**Priority**: P1
**Status**: [ ] Not started
**Location**: `src/services/style_extractor.py`

Extract from 1000+ chat logs:
- Formality, vocabulary, tone patterns
- Emoji frequency, bilingual patterns
- Price: 1-5 GLUE
- Processed by SentimentAnalyzer

---

### 10. Build Skill Detection Service
**Priority**: P1
**Status**: [ ] Not started
**Location**: `src/services/skill_detector.py`

- Detect skills from logs/transcripts
- Skills: Solidity, Python, DeFi, NFTs, etc.
- Confidence scores per skill
- Package as trainable assets (2-10 GLUE per skill pack)

---

## P2 (Medium Priority - This Quarter)

### 11. Implement Agent Staking + Slashing Model
**Priority**: P2
**Status**: [ ] Not started

- Agents stake GLUE as quality guarantee
- Tribunal can slash stakes for bad service
- Higher stake = higher trust = more customers

---

### 12. Implement A2A Agent Cards Discovery Protocol
**Priority**: P2
**Status**: [ ] Not started

- Standard A2A Agent Cards
- URL: `https://agents.uvd.xyz/.well-known/agent-card.json`
- Enables cross-agent service discovery

---

### 13. Session Handoff Protocol for Long-Running Agents
**Priority**: P2
**Status**: [ ] Not started

- Progress files across context windows
- Immutable feature lists + environment bootstrap
- Critical for: faro monitoring, abracadabra stream processing

---

### 14. TEE-Protected Data Markets (via tee-mesh + enclaveops)
**Priority**: P2
**Status**: [ ] Not started

- Private data computation in TEE
- Seller uploads encrypted, buyer submits query
- Computation inside enclave, only results exit

---

### 15. Streaming Payments (x402 + Superfluid)
**Priority**: P2
**Status**: [ ] Not started

- Continuous flow rates for data access:
  - 0.00001 GLUE/second for live data
  - 0.5 GLUE/day for 24h access
  - 10 GLUE/month for unlimited
- Auto-terminate on insufficient balance

---

## Critical Dependencies to Resolve

### BLOCKERS

- [ ] **Verify karma-hello API availability for per-user log access**
  - Impact: BLOCKS PersonalAgent training pipeline
  - Action: Check karma-hello repo for existing exports

- [ ] **Verify abracadabra knowledge graph export capability**
  - Impact: BLOCKS SkillDetector + SentimentAnalyzer
  - Action: Check abracadabra Cognee integration

- [ ] **Confirm meshrelay readiness for A2A IRC messages**
  - Impact: BLOCKS IRC communication layer
  - Action: Review meshrelay spec status

- [ ] **Verify ERC-8004 Extended support for metadata updates**
  - Impact: BLOCKS dynamic agent capability registration
  - Action: Check ERC-8004 implementation docs

---

## Done

*Move completed items here with date.*
