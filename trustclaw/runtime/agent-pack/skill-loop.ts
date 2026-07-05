/**
 * Skill loop verification hooks for TrustClaw × OpenClaw skills.
 * Skills live under `<workspace>/skills`; packs under `trustclaw/agents/`.
 */

export const SKILL_LOOP_VERIFY_COMMANDS = [
  "openclaw skills check",
  "openclaw skills list",
  "node scripts/run-vitest.mjs extensions/trustclaw-tra",
] as const;

export const SKILL_LOOP_WORKSHOP_TOOL = "skill_workshop";

export const TRA_PACK_OPERATIONS_SKILL_NAME = "tra-pack-operations";

export function listSkillLoopVerifyCommands(): readonly string[] {
  return SKILL_LOOP_VERIFY_COMMANDS;
}
