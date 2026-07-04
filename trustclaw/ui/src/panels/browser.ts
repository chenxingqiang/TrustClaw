// Panel B — PTDS Data Browser. Reuses the D12 default tables surfaced by
// `/api/ptds/tables` (`body_anthropometrics`, `lab_test_results`,
// `nrdl_payment_rules`, `v_glp1_nrdl_check_snapshot`). Table names come from
// the server; do not hardcode a parallel list here.

import type { TrustclawApiClient } from "../api.js";

export function renderBrowser(root: HTMLElement, client: TrustclawApiClient): {
  refresh(): Promise<void>;
} {
  root.innerHTML = `
    <section class="panel" data-panel="browser">
      <header><h2>B · 个人数据空间 (PTDS) 状态浏览器</h2></header>
      <p class="panel-note">当前 SQLite 数据库文件状态：<strong data-testid="browser-mounted">检查中…</strong></p>
      <div class="controls">
        <select data-testid="browser-table"></select>
        <button data-action="reload">刷新</button>
      </div>
      <div class="table-container" data-testid="browser-table-container"></div>
    </section>
  `;

  const select = root.querySelector<HTMLSelectElement>('[data-testid="browser-table"]')!;
  const container = root.querySelector<HTMLElement>('[data-testid="browser-table-container"]')!;
  const reloadBtn = root.querySelector<HTMLButtonElement>('[data-action="reload"]')!;
  const mountedEl = root.querySelector<HTMLElement>('[data-testid="browser-mounted"]')!;

  async function refreshMounted(): Promise<void> {
    try {
      const status = await client.status();
      mountedEl.textContent = status.mounted ? "已挂载" : "未挂载";
    } catch {
      mountedEl.textContent = "未知";
    }
  }

  async function loadTables(): Promise<void> {
    try {
      const list = await client.tables();
      select.innerHTML = "";
      const options = list.default_tables.length > 0 ? list.default_tables : list.tables;
      for (const table of options) {
        const option = document.createElement("option");
        option.value = table;
        option.textContent = table;
        select.append(option);
      }
    } catch (error) {
      container.textContent = `Error listing tables: ${(error as Error).message}`;
    }
  }

  async function loadRows(): Promise<void> {
    const table = select.value;
    if (!table) {
      container.textContent = "请选择表";
      return;
    }
    container.textContent = "加载中…";
    try {
      const result = await client.browse(table, 100);
      if (result.status !== "success" || !result.rows) {
        container.textContent = result.message ?? "无数据";
        return;
      }
      const columns = result.columns ?? Object.keys((result.rows[0] as object | undefined) ?? {});
      const rows = result.rows as Record<string, unknown>[];
      const thead = `<thead><tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map(
          (row) =>
            `<tr>${columns
              .map((c) => `<td>${escapeHtml(String(row[c] ?? ""))}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody>`;
      container.innerHTML = `<table>${thead}${tbody}</table>`;
    } catch (error) {
      container.textContent = `Error: ${(error as Error).message}`;
    }
  }

  select.addEventListener("change", () => {
    void loadRows();
  });
  reloadBtn.addEventListener("click", () => {
    void loadRows();
  });

  void loadTables().then(() => loadRows());
  void refreshMounted();

  return {
    async refresh() {
      await refreshMounted();
      await loadTables();
      await loadRows();
    },
  };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
