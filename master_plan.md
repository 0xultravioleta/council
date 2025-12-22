# Council: Master Plan
## Sistema Agentico Multi-Repo con Dialogo en Vivo y Memoria Dual

---

## 1. Vision

Un orquestador que spawnea multiples sesiones de Claude Code (una por repositorio), las hace dialogar entre si como agentes autonomos, permite intervencion humana en cualquier momento, y aprende de cada interaccion usando memoria dual (Acontext + Cognee).

**No es un bus de errores. Es un consejo de agentes que conversan hasta resolver.**

---

## 2. Problema que Resuelve

| Situacion Actual | Con Council |
|------------------|-------------|
| Cuando algo falla en 402milly, salto manualmente al facilitador a preguntar | Council spawnea ambos agentes y los hace hablar |
| Claude en repo A dice "preguntale al facilitador X" y yo copio el prompt | Los agentes se pasan mensajes automaticamente |
| Debuggeo adivinando donde esta el bug | Los agentes correlacionan logs, schemas y boundaries |
| Contexto se pierde entre sesiones | Memoria dual guarda SOPs y hechos confirmados |
| No hay historial de como se resolvio algo similar | Acontext sugiere runbooks, Cognee inyecta facts |

---

## 3. Arquitectura de Alto Nivel

```
+------------------+
|     HUMANO       |  <-- interviene cuando quiere con council interrupt
+--------+---------+
         |
         v
+------------------+
|    CONDUCTOR     |  <-- orquesta turnos, enruta mensajes, genera prompts
+--------+---------+
         |
    +----+----+----+----+
    |         |         |
    v         v         v
+-------+ +-------+ +-------+
| AGENT | | AGENT | | AGENT |   <-- cada uno es una sesion Claude Code en un repo
| Repo A| | Repo B| | Repo C|
+---+---+ +---+---+ +---+---+
    |         |         |
    +---------+---------+
              |
    +---------+---------+
    |                   |
    v                   v
+----------+     +-----------+
| ACONTEXT |     |  COGNEE   |
| (SOPs)   |     | (Facts)   |
+----------+     +-----------+
```

---

## 4. Componentes Principales

### 4.1 Council CLI

| Comando | Descripcion |
|---------|-------------|
| council init | Inicializa .council/ en el directorio actual |
| council thread new --title "..." --repos "A,B,C" | Crea nuevo thread de conversacion |
| council ask --thread [id] --from A --to B --summary "..." | Envia primer mensaje |
| council tick --thread [id] | Avanza un turno (enruta respuestas, genera prompts) |
| council prompts --thread [id] | Imprime prompts para pegar en cada Claude Code |
| council live --thread [id] | Vista en tiempo real del dialogo (tail-style) |
| council interrupt --thread [id] --note "..." | Inyecta contexto humano inmediato |
| council close --thread [id] --status resolved | Cierra thread y dispara guardado a memorias |
| council scan --repos "A,B" | Modo sinergia: detecta oportunidades de integracion |

### 4.2 Workspace (File-Based)

```
.council/
  registry.yaml
  threads/
    th_YYYYMMDD_HHMMSS_xxx/
      inbox/
      outbox/
      evidence/
      artifacts/
      prompts/
      memory/
      transcript.md
      state.json
      resolution.md
  scans/
  runs/
```

---

## 5. Protocolo de Mensajes

### 5.1 Schema de Mensaje

```json
{
  "thread_id": "th_20251222_180500_k9p2",
  "from": "402milly",
  "to": "Facilitador",
  "type": "question",
  "summary": "necesito confirmar campos de auth para /pay",
  "context": {
    "env": "prod",
    "time_window": "2025-12-22T18:00..2025-12-22T18:15"
  },
  "evidence_refs": [
    "evidence/screenshot_01.png",
    "evidence/error.txt"
  ],
  "questions": [
    "que campos valida el servidor para auth v2",
    "como distingo nonce mismatch de signature mismatch en logs"
  ],
  "asks": [
    "correlaciona logs por request id",
    "dame schema esperado y repro minimo"
  ]
}
```

### 5.2 Tipos de Mensaje

| Tipo | Uso |
|------|-----|
| question | Hacer una pregunta a otro repo |
| answer | Responder una pregunta |
| request_evidence | Pedir mas evidencia |
| hypothesis | Proponer teoria de fallo |
| repro | Pasos de reproduccion |
| patch_proposal | Propuesta de fix con archivos |
| decision | Confirmar curso de accion |
| resolution | Cerrar hilo con resultado |
| context_injection | Mensaje del HUMANO con contexto |

### 5.3 Mensaje de Intervencion Humana

```json
{
  "thread_id": "th_20251222_180500_k9p2",
  "from": "HUMAN",
  "to": "ALL",
  "type": "context_injection",
  "summary": "contexto extra del operador",
  "notes": [
    "esto empezo justo despues del deploy abc123 en 402milly",
    "el header x-proto-version cambio recientemente",
    "prioricen boundary contract mismatch"
  ]
}
```

---

## 6. Memoria Dual (ACONTEXT + COGNEE)

### 6.1 Principio de Separacion

| Sistema | Almacena | Proposito |
|---------|----------|-----------|
| ACONTEXT | Sessions, artifacts, SOPs aprendidos | Memoria operativa - "como se ejecuto" |
| COGNEE | Facts, edges, graph de conocimiento | Memoria semantica - "que es verdad" |

**Regla de Oro:** Acontext escribe todo, Cognee solo escribe destilado en checkpoints.

### 6.2 ACONTEXT: Memoria Operativa

Guarda y sirve:
- Session por thread con todos los mensajes
- Disk de artifacts: screenshots, snippets, repro scripts
- Tareas y progreso: que pregunto cada agent, que falta
- Skills/SOPs: patrones repetibles tipo "cuando falla auth, primero correlaciona logs..."

**Cuando escribe:**
- Cada turno: mensajes + artifacts + estado
- Al cerrar thread: dispara learn() para extraer SOPs

**Cuando lee:**
- Al iniciar thread: experience_search() para inyectar SOPs relevantes

### 6.3 COGNEE: Memoria Semantica

Guarda y sirve:
- Knowledge graph de cosas estables: endpoints, headers, contratos, invariantes
- Relaciones: "este repo llama a este endpoint", "este SDK genera este campo"
- Busqueda hibrida vector+grafo

**Cuando escribe (solo en checkpoints):**
- Cuando hay decision
- Cuando hay resolution
- Cuando se detecta nuevo boundary contract
- Cuando se confirma un failure pattern

**Cuando lee:**
- Al iniciar thread: search() para inyectar facts relevantes

### 6.4 Inyeccion en Prompts

```
=== RUNBOOKS FROM ACONTEXT ===
- SOP-023: Cuando falla pago, primero pedir timestamp y request_id
- SOP-047: Para auth mismatch, validar schema antes de logs

=== FACTS FROM COGNEE ===
- FACT: /pay valida campos [nonce, signature, timestamp, chain_id]
- FACT: Header x-proto-version introducido en rev 7
- EDGE: 402milly -> Facilitador:/pay usa header x-proto-version
```

### 6.5 Prevencion de Colisiones

1. **IDs Canonicos:** Cada fact tiene fact_id = hash(repo + tipo + clave)
2. **Scoping por Dataset:** Dataset por repo + dataset "cross-repo"
3. **TTL para Facts Blandos:** expires_at o confidence para facts cambiantes

---

## 7. Generador de Prompts

### 7.1 Prompt para Repo-Agent

```
Eres el agente del repo: [REPO_NAME]
Thread: [THREAD_ID]

Tu trabajo:
- Responder el mensaje entrante
- Pedir evidencia faltante si es necesario
- Mantener la conversacion avanzando
- Escribir tu respuesta como JSON a:
  .council/threads/[THREAD_ID]/outbox/[ts]__from__[REPO_NAME].json

Mensajes entrantes:
[PASTE JSON MESSAGES]

Notas del humano (debes incorporar):
[PASTE HUMAN CONTEXT]

Contexto de memoria:
=== RUNBOOKS FROM ACONTEXT ===
[SOPs]

=== FACTS FROM COGNEE ===
[FACTS]

Instrucciones:
1) Provee una de:
   - Respuesta directa (schema, comportamiento esperado)
   - Request de evidencia (especifica)
   - Pasos de repro minimos + artifact en artifacts/
   - Patch proposal con archivos exactos y plan de tests
2) Se conciso y basado en evidencia
3) Si sospechas de otro repo, di exactamente por que y que pregunta hacerles
```

---

## 8. Loop del Conductor

```
WHILE not stop_condition:
  1. Leer nuevos mensajes de inbox/
  2. Verificar mensajes HUMAN pendientes
  3. Consultar ACONTEXT para SOPs relevantes
  4. Consultar COGNEE para facts relevantes
  5. Generar prompt para cada repo con mensajes pendientes
  6. Escribir prompts a prompts/
  7. Esperar respuestas en outbox/
  8. Actualizar transcript.md y state.json
  9. Escribir a ACONTEXT (cada turno)
  10. Checkear stop conditions
  11. Si checkpoint: escribir a COGNEE

STOP CONDITIONS:
  - resolution_confirmed
  - action_plan_ready
  - blocked_missing_evidence
  - max_turns alcanzado
```

---

## 9. Vista en Vivo y Intervencion

### 9.1 council live --thread [id]

Muestra streaming del transcript:

```
[18:05:12] 402milly -> Facilitador: payment fails after quote
[18:05:45] Facilitador -> 402milly: found logs, invalid nonce
[18:06:03] Facilitador -> SDK-TS: confirm nonce encoding
[18:06:22] HUMAN -> ALL: esto empezo despues del deploy abc123
[18:06:48] SDK-TS -> Facilitador: encoding is hex, should be base64url
```

### 9.2 council interrupt --thread [id] --note "..."

Inyecta mensaje HUMAN inmediatamente. El proximo tick lo incorpora.

---

## 10. Fases de Implementacion

### FASE 1: Core MVP

**Entregables:**
- council init, thread new, ask, tick, prompts
- Workspace file-based
- Schema de mensajes JSON
- Generador de prompts basico
- transcript.md y state.json

**Como se usa:**
1. Abrir 2-3 terminales, una por repo
2. council prompts --thread [id] para ver prompts
3. Pegar prompt en Claude Code de cada repo
4. Cada repo escribe outbox JSON
5. council tick para avanzar

### FASE 2: Vista en Vivo + Interrupcion

**Entregables:**
- council live (tail streaming)
- council interrupt
- council pause / resume
- Mejor transcript.md con timestamps

### FASE 3: Memoria ACONTEXT

**Entregables:**
- Integracion con Acontext API
- Guardar sessions al cerrar threads
- Guardar artifacts en disk
- experience_search al iniciar threads
- Aprender SOPs automaticamente

### FASE 4: Memoria COGNEE

**Entregables:**
- Integracion con Cognee
- Escribir facts en checkpoints
- search() al iniciar threads
- Separacion clara de datasets

### FASE 5: Automatizacion

**Entregables:**
- Integracion tmux para panes paralelos
- Auto-paste de prompts (opcional)
- MCP server para tools desde Claude Code
- Deteccion automatica de sinergias

---

## 11. Stack Tecnologico Recomendado

| Componente | Tecnologia | Razon |
|------------|------------|-------|
| CLI | TypeScript + Commander.js | Consistente con tu stack |
| File watching | chokidar | Live view |
| YAML parsing | js-yaml | Registry config |
| ACONTEXT | HTTP client a localhost:8029 | Self-learning loop |
| COGNEE | cognee Python package o MCP | Graph + vector memory |
| Terminal streaming | blessed o ink | Live view bonito |

---

## 12. Ejemplo de Flujo Completo

### Escenario: Compra falla en produccion

```bash
# 1. Crear thread
council thread new --title "payment fails prod" --repos "402milly,Facilitador,SDK-TS"
# Output: Created thread th_20251222_190000_abc

# 2. Enviar primer mensaje
council ask --thread th_20251222_190000_abc \
  --from 402milly \
  --to Facilitador \
  --summary "payment fails after successful quote"

# 3. Agregar evidencia
council add-evidence --thread th_20251222_190000_abc --file ./screenshot.png

# 4. Ver prompts para cada repo
council prompts --thread th_20251222_190000_abc

# 5. (En otra terminal) Monitorear en vivo
council live --thread th_20251222_190000_abc

# 6. Intervenir con contexto
council interrupt --thread th_20251222_190000_abc \
  --note "esto empezo despues del deploy abc123, prioricen headers"

# 7. Avanzar turnos
council tick --thread th_20251222_190000_abc

# 8. Repetir tick hasta resolucion...

# 9. Cerrar thread
council close --thread th_20251222_190000_abc \
  --status resolved \
  --summary "SDK-TS nonce encoding fix applied"
```

---

## 13. Registry Config Completo

```yaml
# .council/registry.yaml

repos:
  "402milly":
    path: "../402milly"
    tech_hints: ["typescript", "nextjs", "web"]
    quick_commands:
      dev: "pnpm dev"
      test: "pnpm test"

  "Facilitador":
    path: "../x402-facilitator"
    tech_hints: ["typescript", "server", "aws"]
    logs:
      kind: "cloudwatch"
      group: "/ecs/ultravioleta-facilitator"
      region: "us-east-1"
    quick_commands:
      run: "make dev"
      test: "make test-smoke"

  "SDK-TS":
    path: "../x402-sdk-typescript"
    tech_hints: ["typescript", "library"]
    quick_commands:
      test: "pnpm test"
      build: "pnpm build"

  "SDK-PY":
    path: "../x402-sdk-python"
    tech_hints: ["python", "library"]
    quick_commands:
      test: "pytest -q"

council:
  parallelism: 3
  max_turns: 14
  stop_when:
    - "resolution_confirmed"
    - "action_plan_ready"
    - "blocked_missing_evidence"

human:
  allow_interrupt: true
  default_mode: "live"

memory:
  enabled: true
  acontext:
    base_url: "http://localhost:8029/api/v1"
    api_key: "sk-ac-your-root-api-bearer-token"
    space_name: "council-skills"
  cognee:
    enabled: true
    local: true
```

---

## 14. Definition of Done

- [ ] Puedo ver conversacion en vivo entre 2+ Claude Code sessions
- [ ] Puedo interrumpir en cualquier momento con contexto
- [ ] El council resuelve preguntas mediante dialogo
- [ ] Cada thread resuelto se guarda en ACONTEXT
- [ ] Facts destilados se guardan en COGNEE
- [ ] Nuevos threads reciben SOPs y facts relevantes
- [ ] El sistema mejora con cada uso

---

## 15. Siguiente Paso Inmediato

**Iniciar con FASE 1:**

1. Crear proyecto `council` en TypeScript
2. Implementar `council init` que crea estructura de carpetas
3. Implementar `council thread new`
4. Implementar schema de mensajes JSON
5. Implementar `council prompts` que genera prompts por repo
6. Probar con 2 repos reales (402milly + Facilitador)

---

## 16. Por Que Este Approach es Poderoso

1. **Conversation-First:** No analisis estatico frio. Dialogo vivo entre agentes.
2. **Human-in-the-Loop:** Tu intervienes cuando quieres, no cuando el sistema falla.
3. **Dual Memory:** SOPs operativos (Acontext) + Facts semanticos (Cognee) = nunca olvida.
4. **File-Based:** Sin infra pesada. Carpetas y JSON. Funciona offline.
5. **Incremental:** Fase 1 funciona con copy-paste manual. Automation viene despues.
6. **Observable:** Ves todo. Nada es caja negra.

---

## 17. Reflexion Final

Este sistema convierte el debugging cross-repo de un proceso manual frustrante en una **conversacion orquestada entre agentes expertos**, donde tu eres el director que puede intervenir en cualquier momento.

Cada vez que resuelves algo, el sistema aprende. Cada vez que intervienes, el sistema entiende mejor tu contexto. Cada vez que un agent hace una pregunta inteligente, esa pregunta queda guardada como patron para el futuro.

**Council no reemplaza a Claude Code. Hace que multiples Claude Codes trabajen como un equipo coordinado.**

---

*Master Plan v1.0 - 2025-12-22*
*Diseado para ultravioleta/dao*
