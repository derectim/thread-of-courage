export interface CampaignDetour { readonly stage: number; readonly status: "offered" | "active"; }
export const DETOUR_SPEED_MULTIPLIER = 1.2;
export const DETOUR_EXTRA_HITS = 2;
export const isDetourStage = (stage: number): boolean => Number.isSafeInteger(stage) && stage >= 7 && stage % 10 === 7;
export const getDetourReward = (stage: number): number => isDetourStage(stage) ? Math.min(40, 20 + 5 * Math.floor(stage / 10)) : 0;

export function normalizeCampaignDetour(value: unknown, resumeStage: number): CampaignDetour | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CampaignDetour>;
  return typeof raw.stage === "number" && isDetourStage(raw.stage) && raw.stage === resumeStage - 1 && (raw.status === "offered" || raw.status === "active")
    ? { stage: raw.stage, status: raw.status } : null;
}
