export type PtdsInitRequest = {
  weight: number;
  height: number;
  hba1c: number;
  thyroid_cancer_history: 0 | 1;
  pancreatitis_history: 0 | 1;
  /** Optional display name for user_profile row. */
  name?: string;
  /** When true, seed active T2DM (E11) for NRDL GLP-1 assessment path. */
  include_t2dm_diagnosis?: boolean;
};

export type PtdsInitResult = {
  status: "success" | "error";
  message: string;
  db_file: string;
  records_inserted: number;
};

export type PtdsQueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
};

export type Glp1CheckSnapshot = {
  user_id: string;
  name: string;
  has_t2dm: number;
  prior_oral_therapy_status: number;
  latest_hospital_hba1c: number | null;
  has_cardiovascular_comorbidity: number;
  has_absolute_contraindication: number;
};
