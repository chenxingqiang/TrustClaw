# TrustClaw Business Agent Platform

TrustClaw separates **PTDS platform capabilities** from **declarative Business Agent packs**. GLP-1/C3-PO is the first pack; additional医保/健康 agents ship as new directories under `trustclaw/agents/`.

## Architecture

| Layer | Owner | Responsibility |
| --- | --- | --- |
| **PTDS platform** | `trustclaw/ptds/`, `trustclaw/runtime/`, `extensions/trustclaw-ptds/` | SQLite, Text2SQL guards, consent, audit, ledger, plugin tools |
| **Agent Pack** | `trustclaw/agents/<pack>/agent.pack.json` | Persona prompts, tool subset, rule engine, consent policy, audit labels |
| **OpenClaw binding** | `openclaw.json` `agents.list` + plugin hooks | Maps `agentId` → pack; injects system context per turn |

## Agent Pack contract

Schema: `trustclaw/agents/_schema/agent-pack.v1.json`  
Loader: `trustclaw/runtime/agent-pack/`  
Registry: `AgentPackRegistry.load()` / `GET /api/ptds/agent-packs`

### Minimal pack layout

```
trustclaw/agents/my-agent/
  agent.pack.json
  prompts/
    my-agent-system.v1.md
```

### Bundled packs (V1)

| Pack id | OpenClaw `agentId` | Read | Write | Rule engine |
| --- | --- | --- | --- | --- |
| `glp1-eligibility` | `main` (default) | ✓ | ✓ | `ast-compliance` |
| `nrdl-reimburse` | `nrdl-reimburse` | ✓ | — | `nrdl-table` |
| `compliance-auditor` | `compliance-auditor` | ✓ | — | `none` |

## Platform tools (shared)

| Tool | Purpose |
| --- | --- |
| `trustclaw_ptds_query` | SELECT Text2SQL + GLP-1 pipeline read path |
| `trustclaw_ptds_write` | INSERT Text2SQL personal/device writes |

Packs declare which tools are exposed. Consent policy is pack-scoped (`consent.read.allowAlways`, `consent.write.allowAlways`).

## OpenClaw configuration

```json
{
  "agents": {
    "list": [
      { "id": "main", "workspace": "trustclaw/workspace/dev" },
      { "id": "nrdl-reimburse", "workspace": "trustclaw/workspace/nrdl-reimburse" },
      { "id": "compliance-auditor", "workspace": "trustclaw/workspace/compliance-auditor" }
    ]
  },
  "plugins": {
    "entries": {
      "trustclaw-ptds": {
        "enabled": true,
        "config": {
          "defaultAgentPack": "glp1-eligibility"
        }
      }
    }
  }
}
```

Plugin hooks:

- `before_prompt_build` → `buildTrustclawPtdsAgentGuidance({ openclawAgentId })`
- `before_tool_call` → consent gates per pack policy

## REST API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/ptds/agent-packs` | List installed packs + default id |
| `POST /api/agent/chat` | Optional `agent_pack_id` overrides pack for HTTP chat demo |

Runtime Context responses include `agent_pack_id`.

## Adding a new healthcare agent

1. Create `trustclaw/agents/<id>/agent.pack.json` (validate against schema).
2. Add `prompts/*-system.v1.md` persona (no hardcoded clinical rules — rules live in SQLite/AST).
3. Map `openclaw.agentId` to an OpenClaw agent profile.
4. Choose `rules.engine` and `pipeline.decisionBuilder`.
5. Run `pnpm test extensions/trustclaw-ptds` and restart Gateway.

## Phase roadmap

| Phase | Scope |
| --- | --- |
| **2.5 (current)** | Pack schema, registry, GLP-1 migration, 3 template packs, API list |
| **3** | Panel C agent selector; session-bound pack; Coordinator routing (D15) |
| **4** | Pack authoring CLI/UI; signed external packs |

## Compliance notes

- Packs must not bypass `before_tool_call` consent.
- `compliance-auditor` sets `consent.read.allowAlways: false` — every read requires approval.
- Write tools are blocked when omitted from `tools` in the pack.

See also: `trustclaw/AGENTS.md` (compliance review), `trustclaw/DECISIONS.md` (D17–D19).
