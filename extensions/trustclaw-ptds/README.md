# TrustClaw PTDS plugin

Enable in `openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "trustclaw-ptds": {
        "enabled": true
      }
    }
  }
}
```

Start Gateway:

```bash
pnpm openclaw gateway run
```

## HTTP routes (Task 102)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/ptds/init` | Initialize local PTDS personal data (v1.1 schema mapping) |
| POST | `/api/ptds/reset` | Clear personal PTDS rows |
| GET | `/api/ptds/status` | Mounted status + GLP-1 snapshot |
| GET | `/api/ptds/tables` | List browsable tables |
| GET | `/api/ptds/browse?table=...` | Read-only table preview |

Default DB: `$OPENCLAW_STATE_DIR/state/local_ptds.db` (usually `~/.openclaw/state/local_ptds.db`).
