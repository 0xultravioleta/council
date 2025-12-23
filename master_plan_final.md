# Council: Master Plan v2 (Expanded)
## Sistema Agentico Multi-Repo con Dialogo en Vivo y Memoria Dual

Version: 2.0
Fecha: 2025-12-22

---

## 0. Resumen Ejecutivo (Expanded)

Council es un sistema file-based que orquesta multiples sesiones de Claude Code (una por repo) para que dialoguen entre si con evidencia, decisiones y resolucion, mientras un humano puede intervenir en vivo y el sistema aprende con memoria dual (Acontext + Cognee).

El objetivo no es solo "pasar mensajes", sino crear un flujo de debugging conversacional multi-repo que:
- reduce tiempo de resolucion
- mantiene historial auditable
- reutiliza SOPs y facts confirmados
- soporta intervencion humana sin friccion

---

## 1. Vision (Expanded)

**Vision:** convertir el debugging cross-repo en una conversacion orquestada, visible y acumulativa donde el conocimiento se conserva y se reutiliza.

### 1.1 Objetivos medibles
- Reducir tiempo medio de resolucion (TTR) en 30-60% en incidentes cross-repo.
- Reducir saltos manuales entre repos (copy/paste de prompts) en 70% despues de fase 2.
- Aumentar tasa de "first correct repo" (routing correcto al primer intento) a 80%+.
- Lograr que 100% de los threads cerrados queden guardados en memoria dual.

### 1.2 Principios de diseño
- Conversacion antes que automatizacion.
- File-based primero, infraestructura despues.
- Memoria dual con responsabilidades separadas.
- Human-in-the-loop siempre disponible.
- Evidencia primero: no suposiciones sin logs, repro o contratos.

### 1.3 No objetivos (para evitar scope creep)
- No reemplazar sistemas de observabilidad existentes.
- No auto-merge de cambios ni despliegues automaticos.
- No UI pesada en v1; CLI y archivos son suficientes.
- No dependencia obligatoria de MCP o tmux en fase 1.

---

## 2. Problema que Resuelve (Expanded)

### 2.1 Problemas actuales
- Coordinacion manual entre repos cuando hay fallos interdependientes.
- Duplicacion de esfuerzo al reconstruir contexto en cada repo.
- Dificultad para rastrear conversaciones y decisiones pasadas.
- Dependencia en memoria humana para SOPs y hechos confirmados.

### 2.2 Resultado esperado con Council
- Conversaciones estructuradas que guian la solucion.
- Contexto unificado y persistente por thread.
- Routing automatico de preguntas basadas en evidencia.
- Aprendizaje acumulativo via SOPs (Acontext) y facts (Cognee).

### 2.3 Indicadores de exito
- Threads cerrados con resolucion reproducible.
- Menos "re-ask" de preguntas ya respondidas en el pasado.
- Historial consultable con artefactos y decisiones.

---

## 3. Arquitectura de Alto Nivel (Expanded)

```
HUMANO (interrupt) -> CONDUCTOR -> [AGENT RepoA, RepoB, RepoC]
                                         |
                          ACONTEXT (SOPs) + COGNEE (Facts)
```

### 3.1 Roles
- HUMANO: operador que inicia threads, aporta contexto, valida resolucion.
- CONDUCTOR: orquesta turnos, enruta mensajes, genera prompts, escribe memoria.
- REPO-AGENT: una sesion Claude Code en un repo especifico.

### 3.2 Responsabilidades clave
- Conductor mantiene estado y evita duplicados.
- Repo-Agents solo responden con evidencia, repro o patches.
- Memoria dual guarda conocimiento en formatos separados.

### 3.3 Flujos de datos
1. HUMANO inicia thread y hace ask.
2. Conductor genera prompts y espera respuestas (outbox).
3. Respuestas actualizan transcript y state.
4. Conductor inyecta memoria y human context en el siguiente turno.
5. Al cierre, escribe a Acontext y Cognee.

### 3.4 Requerimientos no funcionales
- Confiabilidad file-based (atomic writes).
- Determinismo de rutas y nombres.
- Baja friccion: comandos simples y salida clara.
- Latencia baja en live view.

---

## 4. Componentes Principales (Expanded)

### 4.1 Council CLI (Requerimientos exhaustivos)

**Objetivo:** interfaz unica para operar el sistema.

**Requerimientos funcionales:**
- Inicializar workspace y registry.
- Crear threads y administrar su estado.
- Enviar mensajes y avanzar turnos.
- Generar prompts por repo.
- Visualizar conversacion en vivo.
- Inyectar contexto humano.
- Cerrar threads y disparar memoria.

**Requerimientos no funcionales:**
- Cross-platform (Windows, macOS, Linux).
- Respuestas claras y accionables.
- Modo silencioso y modo verbose.
- Logs estructurados para depurar el conductor.

**Comandos y comportamiento esperado:**

1) `council init`
- Entradas: ruta actual.
- Acciones: crea `.council/`, `registry.yaml` base, subcarpetas.
- Validaciones: no sobrescribir sin `--force`.
- Salida: mensaje de exito con rutas creadas.

2) `council thread new --title "..." --repos "A,B,C"`
- Entradas: titulo, lista de repos.
- Acciones: crea `th_YYYYMMDD_HHMMSS_xxx/` con estructura completa.
- Escribe: `state.json`, `transcript.md`, `memory/boundary_map.json` (vacio).
- Validaciones: repos existen en `registry.yaml`.

3) `council ask --thread <id> --from A --to B --summary "..."`
- Entradas: thread_id, from, to, summary.
- Acciones: crea mensaje en `inbox/` con schema validado.
- Validaciones: thread existe, from/to validos, summary no vacio.
- Salida: message_id creado.

4) `council tick --thread <id>`
- Entradas: thread_id.
- Acciones: ejecuta el loop del conductor 1 turno.
- Efectos: lee inbox, escribe prompts, actualiza transcript/state.
- Validaciones: evita reprocesar mensajes ya leidos.

5) `council prompts --thread <id>`
- Entradas: thread_id.
- Acciones: imprime prompts por repo o guarda en `prompts/`.
- Flags: `--repo`, `--json`, `--write`.

6) `council live --thread <id>`
- Entradas: thread_id.
- Acciones: tail de transcript y eventos nuevos.
- Opciones: `--filter repo`, `--follow`, `--since`.

7) `council interrupt --thread <id> --note "..."`
- Entradas: thread_id, note.
- Acciones: crea mensaje HUMAN con `to: ALL`.
- Efecto: se incluye en el siguiente prompt de cada repo.

8) `council close --thread <id> --status resolved --summary "..."`
- Entradas: thread_id, status, summary.
- Acciones: marca thread cerrado, escribe `resolution.md`, dispara memoria.
- Validaciones: status valido (resolved, blocked, abandoned).

9) `council scan --repos "A,B"`
- Entradas: lista de repos.
- Acciones: busca oportunidades de integracion (interfaces, contratos).
- Salida: reporte en `.council/scans/`.

### 4.2 Workspace File-Based (Requerimientos exhaustivos)

**Objetivo:** datos accesibles, auditables y editables sin DB.

**Estructura:**
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
        boundary_map.json
      transcript.md
      state.json
      resolution.md
  scans/
  runs/
```

**Requerimientos:**
- Todos los paths son relativos al thread.
- Escrituras atomicas: escribir a temp y renombrar.
- Nombres de archivo con timestamp y origen.
- Evidence siempre en `evidence/` (copias, no referencias externas).
- `state.json` es la unica fuente de verdad del estado actual.
- `transcript.md` es append-only.

### 4.3 Conductor (Requerimientos exhaustivos)

**Responsabilidad central:**
- Leer mensajes nuevos, generar prompts, actualizar estado.

**Requerimientos clave:**
- Idempotencia: procesar el mismo inbox no debe duplicar acciones.
- Orden estable: mensajes se procesan por timestamp.
- Manejo de errores: JSON invalido => marcar en state como error.
- Si no hay respuestas, estado pasa a `waiting_response`.

### 4.4 Repo-Agent (Contrato de comportamiento)

**Reglas:**
- Responder solo con JSON valido.
- Si no hay evidencia suficiente, pedir evidencia especifica.
- Si hay propuesta de patch, incluir archivos exactos y plan de tests.
- Escribir en `outbox/` con timestamp.

---

## 5. Protocolo de Mensajes (Expanded)

### 5.1 Schema base (v1)

```json
{
  "schema_version": "1.0",
  "thread_id": "th_20251222_180500_k9p2",
  "message_id": "msg_20251222_180601_a1b2",
  "parent_id": "msg_20251222_180500_x9y8",
  "from": "402milly",
  "to": "Facilitador",
  "type": "question",
  "summary": "confirm auth fields for /pay",
  "created_at": "2025-12-22T18:06:01-05:00",
  "priority": "normal",
  "tags": ["auth", "pay"],
  "context": {
    "env": "prod",
    "time_window": "2025-12-22T18:00..2025-12-22T18:15"
  },
  "evidence_refs": [
    "evidence/screenshot_01.png",
    "evidence/error.txt"
  ],
  "questions": [
    "what fields are validated for auth v2",
    "how to tell nonce mismatch vs signature mismatch in logs"
  ],
  "asks": [
    "correlate logs by request id",
    "provide expected schema and minimal repro"
  ]
}
```

### 5.2 Requerimientos del schema
- `schema_version`, `thread_id`, `message_id`, `from`, `to`, `type`, `summary`, `created_at` son obligatorios.
- `message_id` debe ser unico por thread.
- `parent_id` referencia el mensaje anterior relevante.
- `evidence_refs` son rutas relativas al thread.
- `type` debe estar en el set permitido.

### 5.3 Tipos de mensaje (expandidos)
- `question`: pregunta o solicitud.
- `answer`: respuesta concreta con evidencia o contrato.
- `request_evidence`: pedir evidencia especifica (no generica).
- `hypothesis`: teoria con soporte en logs o facts.
- `repro`: pasos reproducibles con comandos o scripts.
- `patch_proposal`: propuesta con archivos y tests.
- `decision`: decision tomada y rationale.
- `resolution`: cierre del thread con resultado.
- `context_injection`: mensaje HUMANO.

### 5.4 Validacion y saneamiento
- JSON debe ser parseable y con campos correctos.
- Evitar secrets: tokens, keys, PII deben redactarse.
- Evidence puede incluir hashes para integridad opcional.

---

## 6. Memoria Dual (ACONTEXT + COGNEE) Expanded

### 6.1 Principio de separacion
- Acontext: memoria operativa (como se ejecuto, SOPs).
- Cognee: memoria semantica (facts, relaciones).

Regla de oro: Acontext escribe todo; Cognee escribe solo destilado.

### 6.2 Acontext (Memoria operativa)

**Guarda:**
- Session completa por thread (mensajes + transcript).
- Artifacts y evidencia (screenshots, repro, logs).
- Tareas y bloqueos.
- SOPs aprendidos.

**Escritura:**
- En cada turno: mensajes y estado.
- En cierre: ejecutar learn() para SOPs.

**Lectura:**
- Al iniciar thread: experience_search() por tags y repos.

**Requerimientos:**
- Degradar graceful si Acontext no responde.
- Etiquetado consistente (tags, repo, tipo de fallo).
- SOPs deben ser bloques cortos y accionables.

### 6.3 Cognee (Memoria semantica)

**Guarda:**
- Facts estables: contratos, headers, campos, invariantes.
- Relaciones: "repo A llama endpoint B".
- Patrones de fallo confirmados.

**Escritura (solo en checkpoints):**
- decision
- resolution
- nuevo boundary contract
- failure pattern confirmado

**Lectura:**
- Al iniciar thread: search() por endpoints, headers, tags.

**Requerimientos:**
- facts con fact_id deterministico (hash repo+tipo+clave).
- dataset por repo + dataset "cross-repo".
- TTL o confidence para hechos blandos.

### 6.4 Politica anti-colision
1) Acontext guarda todo; Cognee solo destilado.
2) Facts con `rev` incremental y `updated_at`.
3) Datasets separados para evitar mezclas.
4) Solo el conductor escribe en Cognee (no los repo-agents).

### 6.5 Inyeccion en prompts (formato fijo)
```
=== RUNBOOKS FROM ACONTEXT ===
- SOP-023: When auth fails, ask for request_id and timestamp.

=== FACTS FROM COGNEE ===
- FACT: /pay validates [nonce, signature, timestamp, chain_id]
- EDGE: 402milly -> Facilitador:/pay uses header x-proto-version
```

---

## 7. Generador de Prompts (Expanded)

### 7.1 Objetivo
Generar prompts consistentes, cortos y accionables para cada repo-agent.

### 7.2 Requerimientos
- Contener mensajes entrantes y contexto humano.
- Inyectar SOPs y facts con bloques separados.
- Instrucciones claras sobre output JSON.
- Indicar ruta exacta de salida en outbox/.

### 7.3 Template base (v1)
```
You are the repo agent for: [REPO_NAME]
Thread: [THREAD_ID]

Your job:
- Answer the incoming message
- Ask for missing evidence if needed
- Keep the conversation moving
- Write your response as JSON to:
  .council/threads/[THREAD_ID]/outbox/[ts]__from__[REPO_NAME].json

Incoming messages:
[PASTE JSON MESSAGES]

Latest human notes:
[PASTE HUMAN CONTEXT]

=== RUNBOOKS FROM ACONTEXT ===
[SOPs]

=== FACTS FROM COGNEE ===
[FACTS]

Instructions:
1) Provide one of:
   - Direct answer (schema, behavior, expectations)
   - Evidence request (specific)
   - Minimal repro steps + artifact
   - Patch proposal with files and test plan
2) Be concise and evidence-based
3) If you suspect another repo, say why and what to ask
```

---

## 8. Loop del Conductor (Expanded)

### 8.1 Steps detallados
1) Leer nuevos mensajes en `inbox/`.
2) Validar JSON y schema; marcar invalidos en `state.json`.
3) Consultar Acontext para SOPs relevantes.
4) Consultar Cognee para facts relevantes.
5) Generar prompts por repo con mensajes pendientes.
6) Escribir prompts en `prompts/` (y opcionalmente imprimir).
7) Esperar respuestas en `outbox/`.
8) Actualizar `transcript.md` y `state.json`.
9) Escribir a Acontext (cada turno).
10) Si checkpoint, destilar facts y escribir a Cognee.
11) Evaluar stop conditions.

### 8.2 Stop conditions detalladas
- `resolution_confirmed`: existe mensaje `resolution` + confirmacion del repo origin.
- `action_plan_ready`: hay decision con steps, owners y plan de tests.
- `blocked_missing_evidence`: hay request_evidence sin respuesta N turnos.
- `max_turns`: limite configurado alcanzado.

### 8.3 Requerimientos de robustez
- Si falta respuesta de un repo: estado `waiting_response`.
- Si un mensaje es invalido: mover a `evidence/invalid/`.
- Si hay conflicto de routing: enviar a `triage`.

---

## 9. Vista en Vivo e Intervencion Humana (Expanded)

### 9.1 `council live`
**Requerimientos:**
- Actualizacion en tiempo real (tail).
- Mostrar timestamps, from, to, summary.
- Filtros por repo, type y status.
- Modo compacto y modo verbose.

### 9.2 `council interrupt`
**Requerimientos:**
- Inyeccion inmediata con `from: HUMAN`.
- Se distribuye a todos los repos del thread.
- Se refleja en transcript y prompts siguientes.

### 9.3 `council pause/resume` (opcional)
- Pausa el loop de conductor sin perder estado.
- Resume con el mismo snapshot.

---

## 10. Fases de Implementacion (Expanded)

### FASE 1: Core MVP (file-based)

**Entregables:**
- CLI basico (init, thread new, ask, tick, prompts, close).
- Workspace file-based completo.
- Schema de mensajes validado.
- transcript.md y state.json basicos.
- Fixture de ejemplo con 2-3 repos.

**Pasos detallados:**
1) Scaffolding del CLI (TypeScript + Commander).
2) Parser y validador de `registry.yaml`.
3) Generador de thread_id y estructura de carpetas.
4) Modelo de `state.json` con estados basicos.
5) Implementar `ask` y escritura a inbox.
6) Implementar `tick` con lectura de inbox y generacion de prompts.
7) Render de transcript incremental.
8) Tests unitarios para schema y file IO.

**Requerimientos clave:**
- Determinismo: mismos inputs => mismos outputs.
- Zero external deps obligatorias.
- Mensajes siempre validos.

**Criterios de aceptacion:**
- Crear thread y enviar mensaje.
- Generar prompts por repo.
- Responder con outbox y avanzar turnos.
- Ver transcript y state actualizado.

### FASE 2: Vista en Vivo + Interrupt

**Entregables:**
- `council live` con tail y filtros.
- `council interrupt` funcional.
- Mejoras a transcript con timestamps.

**Pasos detallados:**
1) File watcher (chokidar).
2) Stream de transcript y outbox.
3) Manejo de eventos concurrentes.
4) Inyeccion humana en prompts.

**Criterios de aceptacion:**
- Ver mensajes en vivo al escribir outbox.
- Interrumpir y ver contexto inyectado en el siguiente prompt.

### FASE 3: Memoria Acontext

**Entregables:**
- Integracion API Acontext.
- Guardar sessions, artifacts y SOPs.
- experience_search al iniciar thread.

**Pasos detallados:**
1) Cliente HTTP con retries.
2) Mapeo de thread a Session.
3) Upload de artifacts en cierre.
4) SOP extraction en cierre.
5) Injection de SOPs al inicio.

**Criterios de aceptacion:**
- Session creada en Acontext al cerrar thread.
- SOPs aparecen en prompts de threads nuevos.

### FASE 4: Memoria Cognee

**Entregables:**
- Integracion Cognee (local o MCP).
- Distilador de facts + edges.
- search() al iniciar thread.

**Pasos detallados:**
1) Definir schema de fact y edge.
2) Implementar fact_id deterministico.
3) Escribir solo en checkpoints.
4) Inyectar facts relevantes en prompts.

**Criterios de aceptacion:**
- Facts persistidos y recuperables.
- No duplicados ni colisiones.

### FASE 5: Automatizacion y UX

**Entregables:**
- Integracion tmux (opcional).
- Auto-paste de prompts (opcional).
- MCP server para tools (opcional).
- Modo `council spawn` para multi-pane.

**Criterios de aceptacion:**
- Funciona sin automation (fallback siempre disponible).
- Automation no rompe el protocolo file-based.

---

## 11. Stack Tecnologico Recomendado (Expanded)

### Core
- CLI: TypeScript + Commander.js
- File watching: chokidar
- YAML: js-yaml
- Logs: pino o consola estructurada

### Memory
- Acontext: HTTP client
- Cognee: Python package o MCP server

### Live view (opcional)
- ink o blessed para UI en terminal

---

## 12. Ejemplo de Flujo Completo (Expanded)

### Escenario: pago falla en prod
1) `council thread new --title "payment fails prod" --repos "402milly,Facilitador,SDK-TS"`
2) `council ask --thread <id> --from 402milly --to Facilitador --summary "pay fails after quote"`
3) `council interrupt --thread <id> --note "failure started after deploy abc123"`
4) `council tick --thread <id>` genera prompt para Facilitador.
5) Facilitador responde con logs (outbox).
6) `council tick` enruta a SDK-TS con evidencia.
7) SDK-TS responde con patch proposal.
8) `council close --thread <id> --status resolved --summary "nonce encoding fix"`

**Archivos creados:**
- `.council/threads/<id>/inbox/*.json`
- `.council/threads/<id>/outbox/*.json`
- `.council/threads/<id>/transcript.md`
- `.council/threads/<id>/state.json`
- `.council/threads/<id>/resolution.md`

---

## 13. Registry Config Completo (Expanded)

**Requerimientos:**
- Cada repo debe tener `path`.
- `tech_hints` ayudan a prompts.
- `quick_commands` para tests/repro.
- `logs` opcional con tipo y ubicacion.

**Schema recomendado:**
```yaml
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

## 14. Definition of Done (Expanded)

- Conversacion en vivo entre 2+ Claude Code sessions.
- Intervencion humana posible en cualquier momento.
- Threads resueltos via dialogo con evidencia.
- Guardado en Acontext al cerrar thread.
- Facts destilados guardados en Cognee.
- SOPs y facts inyectados en threads nuevos.
- Documentacion y fixture inicial funcionando.

---

## 15. Siguiente Paso Inmediato (Expanded)

Semana 1 (MVP):
1) Crear proyecto TypeScript.
2) Implementar `council init`.
3) Implementar `council thread new`.
4) Definir schema JSON y validadores.
5) Implementar `council prompts`.
6) Probar con 2 repos reales.

Semana 2:
1) `council live` y `interrupt`.
2) Mejorar transcript y state.

---

## 16. Por Que Este Approach Es Poderoso (Expanded)

- Conversacion-first reduce saltos manuales.
- Human-in-the-loop evita perdida de contexto.
- Memoria dual convierte experiencia en activos reutilizables.
- File-based reduce friccion y permite auditabilidad.
- Escala a N repos sin cambiar el protocolo.

---

## 17. Riesgos y Mitigaciones (Nuevo)

- **Riesgo:** prompts largos y ruido.
  - Mitigacion: SOPs max 3, facts max 5 por prompt.
- **Riesgo:** colision de facts.
  - Mitigacion: fact_id deterministico + rev + dataset.
- **Riesgo:** evidencia con secretos.
  - Mitigacion: redaccion automatica y warnings.
- **Riesgo:** bloqueo por falta de respuesta.
  - Mitigacion: estado `waiting_response` y recordatorio humano.

---

## 18. Plan de Pruebas (Nuevo)

### Unit tests
- Validacion de schema JSON.
- Generacion de thread_id y nombres.
- Parsing de registry.yaml.

### Integration tests
- `init -> thread new -> ask -> tick -> prompts`.
- Simulacion de outbox y update de transcript.

### Manual smoke tests
- Flujo completo con 2 repos y 1 interrupt.
- Cierre de thread y verificacion de resolution.

---

## 19. Checklist de Release (Nuevo)

- CLI empaquetado y versionado.
- Documentacion minima en README.
- Fixture de conversacion listo.
- Registro de cambios (CHANGELOG).

---

## 20. Reflexion Final (Expanded)

Council no reemplaza a Claude Code. Lo coordina.
El valor real es convertir debugging en dialogo persistente, visible y reutilizable.
El sistema mejora con cada thread, y el humano sigue al mando.

---

*Master Plan v2.0 (Expanded)*
