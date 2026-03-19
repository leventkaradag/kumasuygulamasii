export const WORKFLOW_PROGRESS_EPSILON = 1e-6;

export const nowDateTimeLocal = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

export const toIsoFromDateTimeLocal = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} gerekli.`);

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} gecersiz.`);
  }

  return parsed.toISOString();
};

export const toPositiveNumberInput = (value: string, label: string) => {
  const parsed = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} 0'dan buyuk olmali.`);
  }
  return parsed;
};

export const toPositiveIntInput = (value: string, label: string) => {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} 1 veya daha buyuk tam sayi olmali.`);
  }
  return parsed;
};

export const calculateProgressTotalMeters = (metersInput: string, unitCountInput: string) => {
  const metersPerUnit = Number(metersInput.trim().replace(",", "."));
  const unitCount = Number(unitCountInput.trim());
  if (!Number.isFinite(metersPerUnit) || metersPerUnit <= 0) return 0;
  if (!Number.isFinite(unitCount) || !Number.isInteger(unitCount) || unitCount <= 0) return 0;
  return metersPerUnit * unitCount;
};
