# AGENTS.md — TRA workspace template

Replace `<pack-id>` and pack display name when copying.

## TRA Console contract

- Panel **A**: initialize personal data (`POST /api/tra/init`)
- Panel **B**: browse tables allowed by this pack's `readTables`
- Panel **C**: chat — use **`trustclaw_tra_query`** / **`trustclaw_tra_write`** per pack manifest
- Panels **D/E/F**: audit, ledger, compliance — only when grants and pack stages allow

## Skills

Read `skills/tra-pack-operations/SKILL.md` for standing TRA procedures. Prefer skills for repeatable operator flows; keep rules in SQLite (D14).

## Safety

- No fabricated clinical or personal data.
- Respect consent and Panel C grants (fail-closed).
