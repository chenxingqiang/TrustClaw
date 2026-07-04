# trustclaw/

TrustClaw PTDS 实现根目录。在 **OpenClaw fork** 上构建个人可信数据空间运行时。

## 文档（按阅读顺序）

| 文件 | 说明 |
| --- | --- |
| [PLAN.md](./PLAN.md) | 产品开发规划、阶段、DoD、审核清单 |
| [DECISIONS.md](./DECISIONS.md) | **待您逐条确认** 的架构决策 |
| [OPENCLAW_REUSE.md](./OPENCLAW_REUSE.md) | OpenClaw 能力继承 / 扩展 / 新建映射 |
| [AGENTS.md](./AGENTS.md) | Agent Loop 迭代开发协议 |
| [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) | 冻结 API / Schema / 合约 |
| [ROADMAP.md](./ROADMAP.md) | 5 天 Sprint |
| [docs/SPEC-V1-source.md](./docs/SPEC-V1-source.md) | 产品规格说明书 V1 原文 |

## 代码布局

```
trustclaw/
  ptds/              # Task 101 ✓ — v1.1 SQLite
  runtime/           # Text2SQL, rules, pipeline (102+)
  audit/ ledger/     # 301, 401
  agents/glp1/       # 业务 Agent prompts
  ui/                # V1 Demo SPA

extensions/trustclaw-ptds/   # 待建 — Gateway HTTP 插件 (D2)
```

## 当前进度

- **101 done** — `trustclaw/ptds/` schema + init + SELECT guard  
- **102+ in progress** — Task 102 done (`extensions/trustclaw-ptds`); next Task 201/501
