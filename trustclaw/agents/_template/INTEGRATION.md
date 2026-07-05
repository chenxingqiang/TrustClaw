# Business Agent Pack — template integration guide

This directory is **not loaded at runtime** (`load.ts` skips `_`-prefixed folders). Copy it to `trustclaw/agents/<your-pack-id>/` and replace placeholders.

**Design intent:** TRA Business Agent is **vertically open**. Bundled healthcare packs (`glp1-eligibility`, `nrdl-reimburse`, `compliance-auditor`) are the **first strict validation instances**, not the platform ceiling.

OpenClaw builds TRA abstractions by **declaring** three contracts in `agent.pack.json` and binding an `agents.list` host — no OpenClaw core changes required (D2).

## Three contracts (template level)

| Contract     | Pack fields                                     | What you declare                                                                      |
| ------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Data**     | `data.*`, TRA schema SQL, compliance import     | Which SQLite tables/views the pack may read/write; lineage via `data_source_registry` |
| **Mode**     | `openclaw.*`, `consent.*`, `tools.*`, grants    | How this pack maps to an OpenClaw `agentId`, consent posture, read/write tool surface |
| **Workflow** | `pipeline.*`, `rules.*`, `audit.*`, `prompts/*` | MCA stages subset, rule engine id, decision shape, audit component names              |

Platform enforces MCA on all contracts (`trustclaw/docs/TRA_GOVERNANCE_ARCHITECTURE.md`). Pack cannot disable hooks or audit.

## Copy checklist

1. `cp -R trustclaw/agents/_template trustclaw/agents/<pack-id>`
2. Edit `agent.pack.json` — set `id`, `domain[]`, tables, pipeline, audit components (unique strings).
3. Replace `prompts/*.md` — persona + Text2SQL template (`{{DATABASE_SCHEMA}}`, `{{USER_QUERY}}`).
4. Add OpenClaw host — `openclaw.json` → `agents.list[]` with `id` matching `openclaw.agentId`.
5. Copy workspace template — `cp -R trustclaw/workspace/_template trustclaw/workspace/<pack-id>/` (includes `skills/` for OpenClaw skill loop).
6. Enable plugin — `plugins.entries.trustclaw-tra.enabled: true`; optional `defaultAgentPack`.
7. Operator grants — Panel C scopes derived from pack manifest (`deriveAgentDomainScopes`).
8. Verify — pack vitest + `openclaw skills check` + consent deny path (see Skill loop in `AGENT_PLATFORM.md`).

## Data contract

- Add or reuse tables in `trustclaw/tra/schema/` + migrations; seed via init/import APIs.
- List allowed tables in `data.readTables` (required) and optional `data.writeTables`.
- `snapshotView` optional — denormalized read surface for rules/Text2SQL hints.
- Rules live in **SQLite / compliance import**, not TS (D14).

## Mode contract (OpenClaw binding)

```json
{
  "agents": {
    "list": [
      {
        "id": "<same-as-openclaw.agentId>",
        "workspace": "trustclaw/workspace/<pack-id>"
      }
    ]
  }
}
```

- `consent.read.allowAlways` / `consent.write.allowAlways` — session approval UX.
- `tools.read` → `trustclaw_tra_query`; optional `tools.write` → `trustclaw_tra_write`.
- Scopes: `panel.browse`, `tra.chat`, `tra.write`, `panel.audit`, `panel.ledger`, `panel.compliance` — see `trustclaw/tra/agent-domain-scopes.ts`.

## Workflow contract

**Stages** (declare subset only):

`TEXT2SQL_GEN` → `DB_QUERY` → `RULE_EVAL` → `AGENT_DECISION` → `LEDGER_COMMIT`

**V1 bundled registries** (new verticals need platform registration + schema enum bump):

| Field                      | V1 values                              | Open extension                                                   |
| -------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| `rules.engine`             | `none`, `ast-compliance`, `nrdl-table` | Add evaluator under `trustclaw/runtime/rules/`                   |
| `pipeline.decisionBuilder` | `pass-through`, `glp1-decision`        | Add builder in `trustclaw/runtime/pipeline/`                     |
| `audit.*Component`         | unique strings per pack                | Platform audit enum tightening tracked in governance §12         |
| Workspace `skills/`        | OpenClaw `SKILL.md` playbooks          | Skill loop — `skill_workshop` or edit under `<workspace>/skills` |

Starter vertical-agnostic path: `rules.engine: none`, `decisionBuilder: pass-through`, stages without `RULE_EVAL` / `LEDGER_COMMIT` until rules exist.

## Skill contract (OpenClaw skills × Pack)

| Layer             | Location                                      | Loops optimizes                                              |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------ |
| Pack prompts      | `trustclaw/agents/<id>/prompts/`              | Pack loop (MCA, persona, Text2SQL)                           |
| Workspace skills  | `trustclaw/workspace/<id>/skills/**/SKILL.md` | **Skill loop** (procedures, panel order, tool preconditions) |
| Durable proposals | `skill_workshop` tool                         | Review → apply → re-verify                                   |

Copy `trustclaw/workspace/_template/skills/tra-pack-operations/` when bootstrapping a new pack workspace. Skills must **not** duplicate clinical rules (D14) or bypass consent hooks.

## Healthcare reference instances

| Pack                 | Strict scenario                | Use when copying          |
| -------------------- | ------------------------------ | ------------------------- |
| `glp1-eligibility`   | Full MCA M3, write + AST rules | Full five-stage + ledger  |
| `nrdl-reimburse`     | Read-heavy reimburse           | NRDL tables + rule engine |
| `compliance-auditor` | Strict consent, no write       | Policy / import focus     |

## Related docs

- `trustclaw/docs/AGENT_PLATFORM.md` — open platform + OpenClaw parallel model
- `trustclaw/agents/_schema/agent-pack.v1.json` — JSON Schema
- `trustclaw/runtime/agent-pack/schema.ts` — runtime validator (keep in sync)
