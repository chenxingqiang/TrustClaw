// Panel C — Domain Agent authorization (user grants per pack) + JSONL history.

import type { AgentGrantPackRow, TrustclawApiClient } from "../api.js";
import { msg } from "../i18n/index.js";
import { renderDomainAgentRegistry } from "./agent-domain-registry.js";
import { formatGrantTimestamp, renderAgentGrantHistoryTable } from "./agent-grant-history.js";
import {
  createGrantSessionId,
  readPanelLogicalAgentId,
  writePanelLogicalAgentId,
} from "./agent-panel-context.js";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function packLabel(pack: AgentGrantPackRow): string {
  return document.documentElement.lang === "zh-CN"
    ? pack.displayName["zh-CN"]
    : pack.displayName.en;
}

const DOMAIN_AGENTS_REGISTRY_TARGET = 1000;

function renderRegistryImportBar(total: number, labels: { importBundled: string }): string {
  if (total >= DOMAIN_AGENTS_REGISTRY_TARGET) {
    return "";
  }
  return `<p class="panel-note panel-note--compact" data-testid="domain-agents-import-bar">
    <button type="button" class="btn-inline" data-action="import-domain-registry">${escapeHtml(labels.importBundled)}</button>
    <span data-testid="domain-agents-import-status"></span>
  </p>`;
}

export function renderAgentGrants(
  root: HTMLElement,
  client: TrustclawApiClient,
): { refresh(): Promise<void> } {
  const m = msg().panels.agentGrants;
  root.innerHTML = `
    <section class="panel panel--c" data-panel="agent-grants">
      <header class="panel__header">
        <div class="panel__heading">
          <h2>${escapeHtml(m.title)}</h2>
          <p class="panel__subtitle">${escapeHtml(m.subtitle)}</p>
        </div>
        <span class="tag tag--muted" data-testid="agent-grants-status">${escapeHtml(m.loading)}</span>
      </header>
      <div class="panel__body">
        <p class="panel-note">${escapeHtml(m.description)}</p>
        <div data-testid="agent-grants-list" class="agent-grants-list"></div>
        <hr class="panel-divider" />
        <h3 class="panel-subtitle">${escapeHtml(m.registryTitle)}</h3>
        <p class="panel-note panel-note--compact">${escapeHtml(m.registrySubtitle)}</p>
        <div data-testid="domain-agents-host"></div>
        <hr class="panel-divider" />
        <h3 class="panel-subtitle">${escapeHtml(m.historyTitle)}</h3>
        <div data-testid="agent-grant-history-host"></div>
      </div>
    </section>
  `;

  const statusEl = root.querySelector<HTMLElement>('[data-testid="agent-grants-status"]')!;
  const listEl = root.querySelector<HTMLElement>('[data-testid="agent-grants-list"]')!;
  const registryHost = root.querySelector<HTMLElement>('[data-testid="domain-agents-host"]')!;
  const historyHost = root.querySelector<HTMLElement>('[data-testid="agent-grant-history-host"]')!;
  const packById = new Map<string, AgentGrantPackRow>();
  let registryPackFilter = "";
  let registryEnabledFilter = "";
  let selectedLogicalAgentId = readPanelLogicalAgentId();
  let packIdsForRegistry: string[] = [];
  let lastRegistryAgents: string[] = [];

  function resolvePackDisplayName(packId: string): string {
    const pack = packById.get(packId);
    return pack ? packLabel(pack) : packId;
  }

  function registryLabels() {
    return {
      unavailable: m.registryUnavailable,
      empty: m.registryEmpty,
      summary: m.registrySummary,
      selectLabel: m.registrySelectLabel,
      selectPlaceholder: m.registrySelectPlaceholder,
      filterPack: m.registryFilterPack,
      filterEnabled: m.registryFilterEnabled,
      filterAll: m.registryFilterAll,
      filterPartial: m.registryFilterPartial,
      filterFalse: m.registryFilterFalse,
      colId: m.registryColId,
      colName: m.registryColName,
      colDomain: m.registryColDomain,
      colPack: m.registryColPack,
      colEnabled: m.registryColEnabled,
      detailId: m.registryDetailId,
      detailName: m.registryDetailName,
      detailDomain: m.registryDetailDomain,
      detailSubdomain: m.registryDetailSubdomain,
      detailRegion: m.registryDetailRegion,
      detailInsurance: m.registryDetailInsurance,
      detailPack: m.registryDetailPack,
      detailPackVersion: m.registryDetailPackVersion,
      detailScopes: m.registryDetailScopes,
      detailWrite: m.registryDetailWrite,
      detailRegistered: m.registryDetailRegistered,
    };
  }

  function setSelectedLogicalAgent(agentId: string): void {
    selectedLogicalAgentId = agentId.trim();
    writePanelLogicalAgentId(selectedLogicalAgentId);
  }

  async function refreshRegistry(): Promise<void> {
    const registry = await client.domainAgents({
      pack_id: registryPackFilter || undefined,
      enabled: registryEnabledFilter || undefined,
    });
    lastRegistryAgents = registry.agents.map((agent) => agent.agent_id);
    if (selectedLogicalAgentId && !lastRegistryAgents.includes(selectedLogicalAgentId)) {
      selectedLogicalAgentId = "";
      writePanelLogicalAgentId("");
    }
    registryHost.innerHTML = `${renderRegistryImportBar(registry.summary.total, {
      importBundled: m.registryImportBundled,
    })}${renderDomainAgentRegistry(
      registry,
      registryLabels(),
      packIdsForRegistry,
      registryPackFilter,
      registryEnabledFilter,
      selectedLogicalAgentId,
    )}`;
  }

  async function refresh(): Promise<void> {
    statusEl.textContent = m.loading;
    statusEl.className = "tag tag--muted";
    try {
      const data = await client.agentGrants();
      packById.clear();
      packIdsForRegistry = [];
      for (const pack of data.packs) {
        packById.set(pack.id, pack);
        packIdsForRegistry.push(pack.id);
      }
      packIdsForRegistry.sort();

      listEl.innerHTML = data.packs
        .map((pack) => {
          const label = packLabel(pack);
          const grantNote =
            pack.granted_at != null && pack.granted_scopes.length > 0
              ? m.currentGrantAt.replace("{time}", formatGrantTimestamp(pack.granted_at))
              : m.notGrantedNow;
          const checks = pack.available_scopes
            .map((scope) => {
              const scopeLabel = m.scopes[scope as keyof typeof m.scopes] ?? scope;
              const checked = pack.granted_scopes.includes(scope);
              return `<label class="agent-grant-scope">
                <input type="checkbox" data-pack="${escapeHtml(pack.id)}" data-scope="${escapeHtml(scope)}"${checked ? " checked" : ""} />
                ${escapeHtml(scopeLabel)}
              </label>`;
            })
            .join("");
          const domains = (pack.domain ?? []).join(", ");
          return `<article class="agent-grant-card" data-pack-id="${escapeHtml(pack.id)}">
            <header class="agent-grant-card__head">
              <strong>${escapeHtml(label)}</strong>
              <code>${escapeHtml(pack.id)}</code>
            </header>
            <p class="panel-note panel-note--compact agent-grant-card__since">${escapeHtml(grantNote)}</p>
            ${domains ? `<p class="panel-note panel-note--compact">${escapeHtml(m.domain)}: ${escapeHtml(domains)}</p>` : ""}
            <div class="agent-grant-card__scopes">${checks}</div>
            <button type="button" class="btn-primary btn-primary--compact" data-action="save-grant" data-pack="${escapeHtml(pack.id)}">${escapeHtml(m.save)}</button>
          </article>`;
        })
        .join("");

      await refreshRegistry();

      historyHost.innerHTML = renderAgentGrantHistoryTable(data.history ?? [], {
        empty: m.historyEmpty,
        time: m.historyTime,
        agent: m.historyAgent,
        scopes: m.historyScopes,
        action: m.historyAction,
        granted: m.historyGranted,
        revoked: m.historyRevoked,
        scopeLabels: m.scopes,
        packDisplayName: resolvePackDisplayName,
      });

      statusEl.textContent = m.ready;
      statusEl.className = "tag tag--ok";
    } catch (error) {
      listEl.textContent = `${m.error}: ${(error as Error).message}`;
      registryHost.innerHTML = "";
      historyHost.innerHTML = "";
      statusEl.textContent = m.error;
      statusEl.className = "tag tag--warn";
    }
  }

  listEl.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const saveBtn = target.closest<HTMLButtonElement>('[data-action="save-grant"]');
    if (!saveBtn) {
      return;
    }
    const packId = saveBtn.dataset.pack?.trim();
    if (!packId) {
      return;
    }
    const scopes = [
      ...listEl.querySelectorAll<HTMLInputElement>(`input[data-pack="${packId}"]:checked`),
    ]
      .map((input) => input.dataset.scope?.trim())
      .filter((scope): scope is string => Boolean(scope));
    saveBtn.disabled = true;
    try {
      await client.putAgentGrant({
        session_id: createGrantSessionId(),
        agent_pack_id: packId,
        scopes,
      });
      await refresh();
    } catch (error) {
      statusEl.textContent = `${m.error}: ${(error as Error).message}`;
      statusEl.className = "tag tag--warn";
    } finally {
      saveBtn.disabled = false;
    }
  });

  registryHost.addEventListener("change", async (event) => {
    const target = event.target as HTMLElement;
    const agentSelect = target.closest<HTMLSelectElement>('[data-testid="domain-agents-select"]');
    const packSelect = target.closest<HTMLSelectElement>(
      '[data-testid="domain-agents-filter-pack"]',
    );
    const enabledSelect = target.closest<HTMLSelectElement>(
      '[data-testid="domain-agents-filter-enabled"]',
    );
    if (!agentSelect && !packSelect && !enabledSelect) {
      return;
    }
    if (agentSelect) {
      setSelectedLogicalAgent(agentSelect.value);
    }
    if (packSelect) {
      registryPackFilter = packSelect.value.trim();
    }
    if (enabledSelect) {
      registryEnabledFilter = enabledSelect.value.trim();
    }
    try {
      await refreshRegistry();
    } catch (error) {
      registryHost.innerHTML = `<p class="panel-note panel-note--compact">${escapeHtml(`${m.error}: ${(error as Error).message}`)}</p>`;
    }
  });

  registryHost.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const importBtn = target.closest<HTMLButtonElement>('[data-action="import-domain-registry"]');
    if (importBtn) {
      const importStatus = registryHost.querySelector<HTMLElement>(
        '[data-testid="domain-agents-import-status"]',
      );
      importBtn.disabled = true;
      if (importStatus) {
        importStatus.textContent = ` ${m.registryImporting}`;
      }
      try {
        const result = await client.importDomainAgentsBundledRegistry();
        if (result.status === "error") {
          throw new Error(result.message);
        }
        registryPackFilter = "";
        registryEnabledFilter = "";
        await refresh();
        if (importStatus && result.total_count != null) {
          importStatus.textContent = ` ${m.registryImportDone.replace("{total}", String(result.total_count))}`;
        }
      } catch (error) {
        const message = (error as Error).message;
        if (importStatus) {
          importStatus.textContent = ` ${m.registryImportError}: ${message}`;
        } else {
          registryHost.insertAdjacentHTML(
            "afterbegin",
            `<p class="panel-note panel-note--compact">${escapeHtml(`${m.registryImportError}: ${message}`)}</p>`,
          );
        }
      } finally {
        importBtn.disabled = false;
      }
      return;
    }
    const row = target.closest<HTMLTableRowElement>('[data-testid="domain-agent-row"]');
    if (!row) {
      return;
    }
    const agentId = row.dataset.agentId?.trim();
    if (!agentId || agentId === selectedLogicalAgentId) {
      return;
    }
    setSelectedLogicalAgent(agentId);
    try {
      await refreshRegistry();
    } catch (error) {
      registryHost.innerHTML = `<p class="panel-note panel-note--compact">${escapeHtml(`${m.error}: ${(error as Error).message}`)}</p>`;
    }
  });

  void refresh();
  return { refresh };
}
