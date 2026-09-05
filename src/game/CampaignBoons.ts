import { getMonsterForStage } from "./content";

export const CAMPAIGN_BOON_IDS = ["quiet-turn", "close-stitch", "generous-spool"] as const;
export type CampaignBoonId = (typeof CAMPAIGN_BOON_IDS)[number];
export const MAX_CAMPAIGN_BOON_LEVEL = 3;
export const CAMPAIGN_BOONS = [
  { id: "quiet-turn", name: "Тихий ход", description: "Враги вращаются на 6% медленнее за каждый уровень узора.", effect: "−6% к скорости врагов", iconFileName: "ability-time-loop.webp" },
  { id: "close-stitch", name: "Точный узор", description: "Опасная зона вокруг игл на 6% меньше за каждый уровень. Проще попадать в тесные места.", effect: "−6% к опасной зоне игл", iconFileName: "upgrade-precision.webp" },
  { id: "generous-spool", name: "Щедрая катушка", description: "Каждая следующая победа приносит на 1 нить больше за каждый уровень узора.", effect: "+1 нить за победу", iconFileName: "currency-thread-spool.webp" },
] as const;

export interface CampaignBoonChoice { readonly stage: number; readonly id: CampaignBoonId; }
export interface CampaignBoonsState {
  readonly choices: readonly CampaignBoonChoice[];
  readonly pendingBossStage: number | null;
}

export function createCampaignBoonsState(): CampaignBoonsState {
  return { choices: [], pendingBossStage: null };
}

export function getCampaignBoonLevel(state: CampaignBoonsState, id: CampaignBoonId): number {
  return Math.min(MAX_CAMPAIGN_BOON_LEVEL, state.choices.filter((choice) => choice.id === id).length);
}

export function getCampaignBoonEffects(state: CampaignBoonsState) {
  return {
    rotationMultiplier: 1 - getCampaignBoonLevel(state, "quiet-turn") * 0.06,
    gapMultiplier: 1 - getCampaignBoonLevel(state, "close-stitch") * 0.06,
    extraThread: getCampaignBoonLevel(state, "generous-spool"),
  };
}

export function normalizeCampaignBoons(value: unknown, resumeStage: number): CampaignBoonsState {
  if (resumeStage <= 1 || typeof value !== "object" || value === null) return createCampaignBoonsState();
  const raw = value as Record<string, unknown>;
  const choices: CampaignBoonChoice[] = [];
  for (const entry of Array.isArray(raw.choices) ? raw.choices : []) {
    if (typeof entry !== "object" || entry === null) continue;
    const { stage, id } = entry;
    if (!Number.isSafeInteger(stage) || stage < 1 || stage >= resumeStage || !getMonsterForStage(stage).isBoss) continue;
    if (!CAMPAIGN_BOON_IDS.includes(id) || choices.some((choice) => choice.stage === stage)) continue;
    if (choices.filter((choice) => choice.id === id).length >= MAX_CAMPAIGN_BOON_LEVEL) continue;
    choices.push({ stage, id });
  }
  const pending = raw.pendingBossStage;
  const pendingBossStage = typeof pending === "number" && Number.isSafeInteger(pending)
    && pending === resumeStage - 1 && getMonsterForStage(pending).isBoss
    && !choices.some((choice) => choice.stage === pending)
    && choices.length < CAMPAIGN_BOON_IDS.length * MAX_CAMPAIGN_BOON_LEVEL
    ? pending : null;
  return { choices, pendingBossStage };
}

/** Called once a campaign victory has been saved. Weekly victories never offer boons. */
export function offerCampaignBoon(state: CampaignBoonsState, stage: number): CampaignBoonsState {
  if (!Number.isSafeInteger(stage) || stage < 1 || !getMonsterForStage(stage).isBoss
    || state.pendingBossStage !== null || state.choices.some((choice) => choice.stage === stage)
    || CAMPAIGN_BOON_IDS.every((id) => getCampaignBoonLevel(state, id) >= MAX_CAMPAIGN_BOON_LEVEL)) return state;
  return { ...state, pendingBossStage: stage };
}

export function chooseCampaignBoon(state: CampaignBoonsState, id: CampaignBoonId): CampaignBoonsState {
  if (state.pendingBossStage === null || !CAMPAIGN_BOON_IDS.includes(id)
    || getCampaignBoonLevel(state, id) >= MAX_CAMPAIGN_BOON_LEVEL) return state;
  return { choices: [...state.choices, { stage: state.pendingBossStage, id }], pendingBossStage: null };
}
