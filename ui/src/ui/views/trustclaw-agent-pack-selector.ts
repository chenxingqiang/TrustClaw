// Agent pack selector bar for PTDS Console Panel C.
import { html, nothing, type TemplateResult } from "lit";
import { i18n, t } from "../../i18n/index.ts";
import type { TrustclawAgentPackSummary } from "../controllers/trustclaw-ptds.ts";

export type TrustclawAgentPackSelectorParams = {
  packs: TrustclawAgentPackSummary[];
  selectedPackId: string | null;
  resolvedFrom: "session" | "openclaw_agent" | "default" | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onSelect: (packId: string) => void;
};

function packLabel(pack: TrustclawAgentPackSummary): string {
  const locale = i18n.getLocale();
  if (locale === "zh-CN") {
    return pack.displayName["zh-CN"];
  }
  return pack.displayName.en;
}

function resolvedFromHint(
  source: TrustclawAgentPackSelectorParams["resolvedFrom"],
): string | null {
  if (!source || source === "session") {
    return null;
  }
  if (source === "openclaw_agent") {
    return t("ptdsPanel.agentPackFromAgent");
  }
  return t("ptdsPanel.agentPackFromDefault");
}

export function renderTrustclawAgentPackSelector(
  params: TrustclawAgentPackSelectorParams,
): TemplateResult {
  const hint = resolvedFromHint(params.resolvedFrom);
  const disabled = params.loading || params.saving || params.packs.length === 0;

  return html`<div class="trustclaw-ptds-agent-pack" aria-label=${t("ptdsPanel.agentPackLabel")}>
    <label class="trustclaw-ptds-agent-pack__label" for="trustclaw-ptds-agent-pack-select">
      ${t("ptdsPanel.agentPackLabel")}
    </label>
    <select
      id="trustclaw-ptds-agent-pack-select"
      class="trustclaw-ptds-agent-pack__select"
      ?disabled=${disabled}
      .value=${params.selectedPackId ?? ""}
      @change=${(event: Event) => {
        const value = (event.currentTarget as HTMLSelectElement).value.trim();
        if (value) {
          params.onSelect(value);
        }
      }}
    >
      ${params.packs.length === 0
        ? html`<option value="">${t("ptdsPanel.agentPackLoading")}</option>`
        : params.packs.map(
            (pack) =>
              html`<option value=${pack.id} ?selected=${pack.id === params.selectedPackId}>
                ${packLabel(pack)}
              </option>`,
          )}
    </select>
    ${params.saving
      ? html`<span class="trustclaw-ptds-agent-pack__status">${t("ptdsPanel.agentPackSaving")}</span>`
      : hint
        ? html`<span class="trustclaw-ptds-agent-pack__hint">${hint}</span>`
        : nothing}
    ${params.error
      ? html`<span class="trustclaw-ptds-agent-pack__error" role="status">${params.error}</span>`
      : nothing}
  </div>`;
}
