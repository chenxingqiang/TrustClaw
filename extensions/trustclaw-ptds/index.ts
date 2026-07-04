import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import type { TrustclawPluginConfig } from "../../trustclaw/ptds/config.js";
import { createOpenAiText2SqlLlm } from "../../trustclaw/runtime/text2sql/openai-llm.js";
import { buildTrustclawPtdsAgentGuidance } from "./src/agent-guidance.js";
import { createAgentChatHandler } from "./src/agent-routes.js";
import { createPtdsAuditEventsHandler } from "./src/audit-routes.js";
import {
  createComplianceImportBundledHandler,
  createComplianceImportHandler,
  createCompliancePreviewHandler,
  createComplianceRulesHandler,
  createComplianceStandardsHandler,
} from "./src/compliance-routes.js";
import {
  createReferencePreviewHandler,
  createReferenceStatusHandler,
  createReferenceSyncBundledHandler,
  createReferenceSyncHandler,
} from "./src/reference-routes.js";
import { createDeviceImportHandler, createDevicePreviewHandler } from "./src/device-routes.js";
import { createTrustclawPtdsDataConsentHook } from "./src/data-consent-hook.js";
import { createTrustclawPtdsQueryToolFactory } from "./src/ptds-query-tool.js";
import { createTrustclawPtdsWriteToolFactory } from "./src/ptds-write-tool.js";
import {
  createPtdsBrowseHandler,
  createPtdsInitHandler,
  createPtdsProfileSummaryHandler,
  createPtdsResetHandler,
  createPtdsStatusHandler,
  createPtdsTablesHandler,
} from "./src/ptds-routes.js";
import { createTrustclawUiHandler } from "./src/ui-routes.js";
import { PTDS_SEED_GLP1_AST_V2_JSON, PTDS_SEED_NRDL_REFERENCE_GLP1_JSON } from "../../trustclaw/ptds/paths.js";

function readPluginConfig(
  pluginConfig: Record<string, unknown> | undefined,
): TrustclawPluginConfig {
  if (!pluginConfig) {
    return {};
  }
  return {
    dbPath: typeof pluginConfig.dbPath === "string" ? pluginConfig.dbPath : undefined,
    auditDir: typeof pluginConfig.auditDir === "string" ? pluginConfig.auditDir : undefined,
    evidenceDir:
      typeof pluginConfig.evidenceDir === "string" ? pluginConfig.evidenceDir : undefined,
  };
}

export default definePluginEntry({
  id: "trustclaw-ptds",
  name: "TrustClaw PTDS",
  description: "Personal Trusted Data Space runtime APIs for TrustClaw",
  register(api) {
    const cfg = readPluginConfig(api.pluginConfig);
    const text2sqlLlm = createOpenAiText2SqlLlm();
    api.registerHttpRoute({
      path: "/api/ptds/init",
      auth: "plugin",
      match: "exact",
      handler: createPtdsInitHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/reset",
      auth: "plugin",
      match: "exact",
      handler: createPtdsResetHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/status",
      auth: "plugin",
      match: "exact",
      handler: createPtdsStatusHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/compliance/preview",
      auth: "plugin",
      match: "exact",
      handler: createCompliancePreviewHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/compliance/import",
      auth: "plugin",
      match: "exact",
      handler: createComplianceImportHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/compliance/import/bundled-glp1-v2",
      auth: "plugin",
      match: "exact",
      handler: createComplianceImportBundledHandler(cfg, PTDS_SEED_GLP1_AST_V2_JSON),
    });
    api.registerHttpRoute({
      path: "/api/ptds/compliance/standards",
      auth: "plugin",
      match: "exact",
      handler: createComplianceStandardsHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/compliance/rules",
      auth: "plugin",
      match: "exact",
      handler: createComplianceRulesHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/reference/preview",
      auth: "plugin",
      match: "exact",
      handler: createReferencePreviewHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/reference/sync",
      auth: "plugin",
      match: "exact",
      handler: createReferenceSyncHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/reference/status",
      auth: "plugin",
      match: "exact",
      handler: createReferenceStatusHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/reference/sync/bundled-glp1",
      auth: "plugin",
      match: "exact",
      handler: createReferenceSyncBundledHandler(cfg, PTDS_SEED_NRDL_REFERENCE_GLP1_JSON),
    });
    api.registerHttpRoute({
      path: "/api/ptds/device/preview",
      auth: "plugin",
      match: "exact",
      handler: createDevicePreviewHandler(cfg, text2sqlLlm),
    });
    api.registerHttpRoute({
      path: "/api/ptds/device/import",
      auth: "plugin",
      match: "exact",
      handler: createDeviceImportHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/profile-summary",
      auth: "plugin",
      match: "exact",
      handler: createPtdsProfileSummaryHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/audit/events",
      auth: "plugin",
      match: "exact",
      handler: createPtdsAuditEventsHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/tables",
      auth: "plugin",
      match: "exact",
      handler: createPtdsTablesHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/browse",
      auth: "plugin",
      match: "exact",
      handler: createPtdsBrowseHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/agent/chat",
      auth: "plugin",
      match: "exact",
      handler: createAgentChatHandler(cfg, { llm: text2sqlLlm }),
    });
    api.registerTool(createTrustclawPtdsQueryToolFactory(cfg, { llm: text2sqlLlm }), {
      name: "trustclaw_ptds_query",
    });
    api.registerTool(createTrustclawPtdsWriteToolFactory(cfg, { llm: text2sqlLlm }), {
      name: "trustclaw_ptds_write",
    });
    api.on("before_prompt_build", async (event) =>
      buildTrustclawPtdsAgentGuidance({
        pluginConfig: cfg,
        messages: event?.messages,
      }),
    );
    api.on("before_tool_call", createTrustclawPtdsDataConsentHook(cfg));
    const uiHandler = createTrustclawUiHandler();
    api.registerHttpRoute({
      path: "/trustclaw",
      auth: "plugin",
      match: "prefix",
      handler: uiHandler,
    });
    api.logger.info?.(
      "[trustclaw-ptds] registered PTDS HTTP routes under /api/ptds/*, POST /api/agent/chat, and /trustclaw/* UI",
    );
  },
});
