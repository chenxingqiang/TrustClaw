// Panel A — Landing & PTDS Init. Renders the frozen `POST /api/ptds/init` form
// (spec `PRODUCT_SPEC.md` §Frozen API contracts). Refuses to fetch until the
// user submits; on success, notifies the rest of the app via `onInitialized`.

import type { PtdsInitRequest, TrustclawApiClient } from "../api.js";

export interface LandingHandlers {
  onInitialized(): void;
  onReset(): void;
}

export function renderLanding(
  root: HTMLElement,
  client: TrustclawApiClient,
  handlers: LandingHandlers,
): void {
  root.innerHTML = `
    <section class="panel" data-panel="landing">
      <header><h2>A · PTDS 初始化区</h2><span class="status" data-testid="landing-status">未挂载</span></header>
      <form data-testid="init-form">
        <label>姓名 <input name="name" type="text" value="张三" /></label>
        <label>体重 (kg) <input name="weight" type="number" step="0.1" value="82" required /></label>
        <label>身高 (cm) <input name="height" type="number" step="0.1" value="170" required /></label>
        <label>血糖 HbA1c (%) <input name="hba1c" type="number" step="0.1" value="6.8" required /></label>
        <fieldset class="history-fieldset">
          <legend>既往病史选择</legend>
          <label><input name="thyroid_cancer_history" type="checkbox" /> 甲状腺髓样癌病史</label>
          <label><input name="pancreatitis_history" type="checkbox" /> 胰腺炎历史</label>
          <label><input name="include_t2dm_diagnosis" type="checkbox" checked /> 2 型糖尿病诊断</label>
        </fieldset>
        <div class="actions">
          <button type="submit">初始化并加载数据空间</button>
          <button type="button" data-action="reset">Reset PTDS</button>
        </div>
        <pre data-testid="landing-result" class="result"></pre>
      </form>
    </section>
  `;

  const statusEl = root.querySelector<HTMLElement>('[data-testid="landing-status"]')!;
  const resultEl = root.querySelector<HTMLElement>('[data-testid="landing-result"]')!;
  const form = root.querySelector<HTMLFormElement>('[data-testid="init-form"]')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-action="reset"]')!;

  void client.status().then((s) => {
    if (s.mounted) {
      statusEl.textContent = "已挂载";
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const body: PtdsInitRequest = {
      weight: Number(data.get("weight")),
      height: Number(data.get("height")),
      hba1c: Number(data.get("hba1c")),
      thyroid_cancer_history: data.get("thyroid_cancer_history") ? 1 : 0,
      pancreatitis_history: data.get("pancreatitis_history") ? 1 : 0,
      include_t2dm_diagnosis: Boolean(data.get("include_t2dm_diagnosis")),
    };
    const name = String(data.get("name") ?? "").trim();
    if (name) {
      body.name = name;
    }
    resultEl.textContent = "挂载中…";
    try {
      const response = await client.init(body);
      resultEl.textContent = JSON.stringify(response, null, 2);
      if (response.status === "success") {
        statusEl.textContent = "已挂载";
        handlers.onInitialized();
      }
    } catch (error) {
      resultEl.textContent = `Error: ${(error as Error).message}`;
    }
  });

  resetBtn.addEventListener("click", async () => {
    resultEl.textContent = "Reset 中…";
    try {
      const response = await client.reset();
      resultEl.textContent = JSON.stringify(response, null, 2);
      statusEl.textContent = "未挂载";
      handlers.onReset();
    } catch (error) {
      resultEl.textContent = `Error: ${(error as Error).message}`;
    }
  });
}
