# trustclaw/

TrustClaw PTDS 实现根目录。在 **OpenClaw fork** 上构建个人可信数据空间运行时。

## 文档

| 文件 | 说明 |
| --- | --- |
| **[AGENTS.md](./AGENTS.md)** | **产品 Loop 唯一驱动** — 无限优化闭环、DoD 闸门、合规 Must、当前轮次笔记 |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | 本地启动、端口、Console 布局 |
| [DECISIONS.md](./DECISIONS.md) | 架构决策闸门（V1 已交付） |
| [OPENCLAW_REUSE.md](./OPENCLAW_REUSE.md) | OpenClaw 能力继承 / 扩展 / 新建映射 |
| [docs/AGENT_PLATFORM.md](./docs/AGENT_PLATFORM.md) | Business Agent Pack 契约与注册表 |

## 代码布局

```
trustclaw/
  ptds/              # PTDS v1.1 SQLite + domain_agents
  runtime/           # Text2SQL, rules, pipeline, agent-pack
  audit/ ledger/     # JSONL 审计 + 证据哈希链
  agents/            # 声明式 Agent Pack（glp1, nrdl-reimburse, …）
  ui/                # PTDS Runtime Console SPA

extensions/trustclaw-ptds/   # Gateway HTTP 插件（/api/ptds/*, /api/agent/*）
```

## 状态

**V1 已交付（2026-07-05）。** 闭环：Init → Chat → Text2SQL → Rules → GLP-1 → Audit → Ledger → Console。开放项见 `DECISIONS.md`（D5/D21/D23 deferred；D13/D24 approved）。

开发 Loop 只读 `AGENTS.md`；本地启动见 `GETTING_STARTED.md`。
