# Workspace template (OpenClaw agent host)

Copy to `trustclaw/workspace/<pack-id>/` when instantiating a Business Agent Pack.

| Path        | Purpose                                                                              |
| ----------- | ------------------------------------------------------------------------------------ |
| `AGENTS.md` | Workspace contract (panels, tools, safety) — OpenClaw loads as project context       |
| `SOUL.md`   | Persona supplement (optional; pack `prompts/system` remains canonical for TRA)       |
| `skills/`   | **OpenClaw skills** — operational playbooks the Loops skill loop tests and optimizes |

Skills load from `<workspace>/skills/**/SKILL.md` (highest precedence). See `docs/tools/skills.md`.

**Skill loop vs Pack loop:**

- **Pack** (`trustclaw/agents/<id>/agent.pack.json`) — data / mode / workflow **platform contract**
- **Skills** (this directory) — **how** the OpenClaw agent executes TRA procedures in chat; iterated without changing MCA schema

Template skill: `skills/tra-pack-operations/SKILL.md`
