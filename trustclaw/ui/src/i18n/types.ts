export type TrustclawLocale = "en" | "zh-CN";

export type TrustclawMessages = {
  console: {
    title: string;
    badge: string;
    systemStatus: string;
    statusRunning: string;
    statusNotReady: string;
    statusNotMounted: string;
    statusChecking: string;
    statusReset: string;
    toggleTheme: string;
    language: string;
    langEn: string;
    langZh: string;
    chatFrameTitle: string;
    chatInControlUiTitle: string;
    chatInControlUiBody: string;
  };
  panels: {
    landing: {
      title: string;
      notMounted: string;
      mounted: string;
      name: string;
      weight: string;
      height: string;
      hba1c: string;
      historyLegend: string;
      thyroid: string;
      pancreatitis: string;
      t2dm: string;
      initBtn: string;
      resetBtn: string;
      mounting: string;
      resetting: string;
    };
    browser: {
      title: string;
      mountNote: string;
      viewerLabel: string;
      mounted: string;
      notMounted: string;
      unknown: string;
      selectTable: string;
      loading: string;
      reload: string;
      noData: string;
      listError: string;
      loadError: string;
    };
    chat: {
      title: string;
      placeholder: string;
      send: string;
      userLabel: string;
      assistantLabel: string;
      noResponse: string;
    };
    audit: {
      title: string;
      stepUser: string;
      stepText2sql: string;
      stepQuery: string;
      stepRules: string;
      stepDecision: string;
      stepLedger: string;
      ledgerPending: string;
    };
    ledger: {
      title: string;
      placeholder: string;
      blockHeight: string;
      rootHash: string;
      proofLabel: string;
      copyProof: string;
      copiedProof: string;
    };
  };
};
