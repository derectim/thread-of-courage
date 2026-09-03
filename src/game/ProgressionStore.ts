import {
  BACKGROUND_IDS,
  NEEDLE_SKIN_IDS,
  QUEST_IDS,
  SKILLS,
  SKILL_IDS,
  getBackground,
  getNeedleSkin,
  type BackgroundId,
  type NeedleSkinId,
  type QuestId,
  type SkillId,
} from "./meta";

export const PROGRESSION_SAVE_KEY = "thread-of-courage-save-v3";
export const V2_SAVE_KEY = "thread-of-courage-save-v2";
export const LEGACY_SAVE_KEY = "thread-of-courage-save-v1";
export const PROGRESSION_SAVE_VERSION = 3 as const;
export const MAX_UPGRADE_LEVEL = 5 as const;

export const UPGRADE_IDS = ["power", "precision", "speed", "ward"] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];
export type UpgradeLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type UpgradeLevels = Readonly<Record<UpgradeId, UpgradeLevel>>;

export interface LifetimeStats {
  readonly needlesThrown: number;
  readonly monstersDefeated: number;
  readonly bossesDefeated: number;
  readonly upgradesPurchased: number;
}

export interface ProgressionState {
  readonly version: typeof PROGRESSION_SAVE_VERSION;
  readonly highestStageCleared: number;
  readonly thread: number;
  readonly premium: number;
  readonly muted: boolean;
  readonly upgrades: UpgradeLevels;
  readonly stats: LifetimeStats;
  readonly ownedNeedles: readonly NeedleSkinId[];
  readonly equippedNeedle: NeedleSkinId;
  readonly ownedBackgrounds: readonly BackgroundId[];
  readonly equippedBackground: BackgroundId;
  readonly unlockedSkills: readonly SkillId[];
  readonly equippedSkill: SkillId;
  readonly claimedQuestIds: readonly QuestId[];
}

export interface ProgressionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface UpgradeDefinition {
  readonly description: string;
  readonly costs: readonly [number, number, number, number, number];
}

export const UPGRADE_DEFINITIONS: Readonly<Record<UpgradeId, UpgradeDefinition>> = {
  power: {
    description: "Шанс нанести двойной стежок",
    costs: [25, 100, 180, 300, 500],
  },
  precision: {
    description: "Прощает более тесные попадания",
    costs: [60, 160, 280, 470, 780],
  },
  speed: {
    description: "Ускоряет полёт иглы",
    costs: [50, 140, 250, 420, 700],
  },
  ward: {
    description: "Добавляет спасительные обереги на рейд",
    costs: [500, 1000, 1500, 2200, 3000],
  },
};

const RANDOM_NEEDLE_UNLOCK_COSTS = [90, 240, 520] as const;

function createUpgradeLevels(): Record<UpgradeId, UpgradeLevel> {
  return { power: 0, precision: 0, speed: 0, ward: 0 };
}

export function createDefaultState(): ProgressionState {
  return {
    version: PROGRESSION_SAVE_VERSION,
    highestStageCleared: 0,
    thread: 0,
    premium: 0,
    muted: false,
    upgrades: createUpgradeLevels(),
    stats: {
      needlesThrown: 0,
      monstersDefeated: 0,
      bossesDefeated: 0,
      upgradesPurchased: 0,
    },
    ownedNeedles: ["silver"],
    equippedNeedle: "silver",
    ownedBackgrounds: ["auto"],
    equippedBackground: "auto",
    unlockedSkills: ["steady-hand"],
    equippedSkill: "steady-hand",
    claimedQuestIds: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecord(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeInteger(value: unknown, fallback: number, minimum = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.floor(numeric));
}

function normalizeUpgradeLevel(value: unknown): UpgradeLevel {
  return Math.min(normalizeInteger(value, 0), MAX_UPGRADE_LEVEL) as UpgradeLevel;
}

function normalizeIdList<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  const source = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      source.filter(
        (item): item is T => typeof item === "string" && allowed.includes(item as T),
      ),
    ),
  );
}

function normalizeState(value: Record<string, unknown>): ProgressionState {
  const upgrades = isRecord(value.upgrades) ? value.upgrades : {};
  const stats = isRecord(value.stats) ? value.stats : {};
  const highestStageCleared = normalizeInteger(value.highestStageCleared, 0);
  const ownedNeedles = Array.from(
    new Set<NeedleSkinId>(["silver", ...normalizeIdList(value.ownedNeedles, NEEDLE_SKIN_IDS)]),
  );
  const ownedBackgrounds = Array.from(
    new Set<BackgroundId>(["auto", ...normalizeIdList(value.ownedBackgrounds, BACKGROUND_IDS)]),
  );
  const unlockedSkills = Array.from(
    new Set<SkillId>([
      "steady-hand",
      ...normalizeIdList(value.unlockedSkills, SKILL_IDS),
      ...SKILLS.filter((skill) => skill.unlockStage <= highestStageCleared).map(
        (skill) => skill.id,
      ),
    ]),
  );
  const requestedNeedle = NEEDLE_SKIN_IDS.includes(value.equippedNeedle as NeedleSkinId)
    ? (value.equippedNeedle as NeedleSkinId)
    : "silver";
  const requestedBackground = BACKGROUND_IDS.includes(value.equippedBackground as BackgroundId)
    ? (value.equippedBackground as BackgroundId)
    : "auto";
  const requestedSkill = SKILL_IDS.includes(value.equippedSkill as SkillId)
    ? (value.equippedSkill as SkillId)
    : "steady-hand";

  return {
    version: PROGRESSION_SAVE_VERSION,
    highestStageCleared,
    thread: normalizeInteger(value.thread, 0),
    premium: normalizeInteger(value.premium, 0),
    muted: value.muted === true,
    upgrades: {
      power: normalizeUpgradeLevel(upgrades.power),
      precision: normalizeUpgradeLevel(upgrades.precision),
      speed: normalizeUpgradeLevel(upgrades.speed),
      ward: normalizeUpgradeLevel(upgrades.ward),
    },
    stats: {
      needlesThrown: normalizeInteger(stats.needlesThrown, 0),
      monstersDefeated: normalizeInteger(stats.monstersDefeated, 0),
      bossesDefeated: normalizeInteger(stats.bossesDefeated, 0),
      upgradesPurchased: normalizeInteger(stats.upgradesPurchased, 0),
    },
    ownedNeedles,
    equippedNeedle: ownedNeedles.includes(requestedNeedle) ? requestedNeedle : "silver",
    ownedBackgrounds,
    equippedBackground: ownedBackgrounds.includes(requestedBackground)
      ? requestedBackground
      : "auto",
    unlockedSkills,
    equippedSkill: unlockedSkills.includes(requestedSkill) ? requestedSkill : "steady-hand",
    claimedQuestIds: normalizeIdList(value.claimedQuestIds, QUEST_IDS),
  };
}

function migrateLegacy(value: Record<string, unknown>): ProgressionState {
  const oldBestStage = normalizeInteger(value.bestStage, 1, 1);
  const oldUpgrades = isRecord(value.upgrades) ? value.upgrades : {};
  return normalizeState({
    ...value,
    highestStageCleared: Math.max(0, oldBestStage - 1),
    premium: 0,
    ownedNeedles: ["silver"],
    equippedNeedle: "silver",
    ownedBackgrounds: ["auto"],
    equippedBackground: "auto",
    unlockedSkills: ["steady-hand"],
    equippedSkill: "steady-hand",
    claimedQuestIds: [],
    stats: {
      needlesThrown: 0,
      monstersDefeated: Math.max(0, oldBestStage - 1),
      bossesDefeated: Math.floor(Math.max(0, oldBestStage - 1) / 5),
      upgradesPurchased: UPGRADE_IDS.reduce(
        (sum, id) => sum + normalizeUpgradeLevel(oldUpgrades[id]),
        0,
      ),
    },
  });
}

function resolveStorage(storage: ProgressionStorage | null | undefined): ProgressionStorage | null {
  if (storage !== undefined) return storage;
  try {
    return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function readRecord(storage: ProgressionStorage, key: string): Record<string, unknown> | null {
  try {
    return parseRecord(storage.getItem(key));
  } catch {
    return null;
  }
}

/** Loads v3 progress, or safely migrates the previous save formats. */
export function load(storage?: ProgressionStorage | null): ProgressionState {
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) return createDefaultState();
  const current = readRecord(resolvedStorage, PROGRESSION_SAVE_KEY);
  if (current?.version === PROGRESSION_SAVE_VERSION) return normalizeState(current);
  const previous =
    readRecord(resolvedStorage, V2_SAVE_KEY) ?? readRecord(resolvedStorage, LEGACY_SAVE_KEY);
  if (!previous) return createDefaultState();
  const migrated = migrateLegacy(previous);
  save(migrated, resolvedStorage);
  return migrated;
}

export function save(state: ProgressionState, storage?: ProgressionStorage | null): boolean {
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) return false;
  try {
    resolvedStorage.setItem(
      PROGRESSION_SAVE_KEY,
      JSON.stringify(normalizeState(state as unknown as Record<string, unknown>)),
    );
    return true;
  } catch {
    return false;
  }
}

export function getUpgradeCost(upgrade: UpgradeId, currentLevel: UpgradeLevel): number | null {
  if (currentLevel >= MAX_UPGRADE_LEVEL) return null;
  const purchasableLevel = currentLevel as Exclude<UpgradeLevel, typeof MAX_UPGRADE_LEVEL>;
  return UPGRADE_DEFINITIONS[upgrade].costs[purchasableLevel];
}

export function purchaseUpgrade(state: ProgressionState, upgrade: UpgradeId): ProgressionState {
  const currentLevel = state.upgrades[upgrade];
  const cost = getUpgradeCost(upgrade, currentLevel);
  if (cost === null || state.thread < cost) return state;
  return {
    ...state,
    thread: state.thread - cost,
    upgrades: { ...state.upgrades, [upgrade]: (currentLevel + 1) as UpgradeLevel },
    stats: { ...state.stats, upgradesPurchased: state.stats.upgradesPurchased + 1 },
  };
}

export function buyNeedle(state: ProgressionState, id: NeedleSkinId): ProgressionState {
  if (state.ownedNeedles.includes(id)) return { ...state, equippedNeedle: id };
  const cost = getNeedleSkin(id).threadCost;
  if (state.thread < cost) return state;
  return {
    ...state,
    thread: state.thread - cost,
    ownedNeedles: [...state.ownedNeedles, id],
    equippedNeedle: id,
  };
}

export function equipNeedle(state: ProgressionState, id: NeedleSkinId): ProgressionState {
  if (!state.ownedNeedles.includes(id) || state.equippedNeedle === id) return state;
  return { ...state, equippedNeedle: id };
}

export function getRandomNeedleUnlockCost(state: ProgressionState): number | null {
  const unlockedBeyondStarter = Math.max(0, state.ownedNeedles.length - 1);
  return RANDOM_NEEDLE_UNLOCK_COSTS[unlockedBeyondStarter] ?? null;
}

export function unlockRandomNeedle(
  state: ProgressionState,
  randomValue = Math.random(),
): ProgressionState {
  const locked = NEEDLE_SKIN_IDS.filter((id) => !state.ownedNeedles.includes(id));
  const cost = getRandomNeedleUnlockCost(state);
  if (locked.length === 0 || cost === null || state.thread < cost) return state;

  const normalizedRandom = Number.isFinite(randomValue)
    ? Math.min(0.999999, Math.max(0, randomValue))
    : 0;
  const unlockedId = locked[Math.floor(normalizedRandom * locked.length)] ?? locked[0];
  if (!unlockedId) return state;
  return {
    ...state,
    thread: state.thread - cost,
    ownedNeedles: [...state.ownedNeedles, unlockedId],
    equippedNeedle: unlockedId,
  };
}

export function equipSkill(state: ProgressionState, id: SkillId): ProgressionState {
  if (!state.unlockedSkills.includes(id)) return state;
  return { ...state, equippedSkill: id };
}

export function unlockBackground(state: ProgressionState, id: BackgroundId): ProgressionState {
  if (state.ownedBackgrounds.includes(id)) return { ...state, equippedBackground: id };
  const definition = getBackground(id);
  const earnedByStage = state.highestStageCleared >= definition.unlockStage;
  if (!earnedByStage && state.premium < definition.premiumCost) return state;
  return {
    ...state,
    premium: earnedByStage ? state.premium : state.premium - definition.premiumCost,
    ownedBackgrounds: [...state.ownedBackgrounds, id],
    equippedBackground: id,
  };
}

export function recordShot(state: ProgressionState): ProgressionState {
  return {
    ...state,
    stats: { ...state.stats, needlesThrown: state.stats.needlesThrown + 1 },
  };
}

export function recordVictory(
  state: ProgressionState,
  stage: number,
  isBoss: boolean,
  reward: number,
): ProgressionState {
  const highestStageCleared = Math.max(state.highestStageCleared, stage);
  const unlockedSkills = Array.from(
    new Set<SkillId>([
      ...state.unlockedSkills,
      ...SKILLS.filter((skill) => skill.unlockStage <= highestStageCleared).map(
        (skill) => skill.id,
      ),
    ]),
  );
  return {
    ...state,
    highestStageCleared,
    thread: state.thread + reward,
    unlockedSkills,
    stats: {
      ...state.stats,
      monstersDefeated: state.stats.monstersDefeated + 1,
      bossesDefeated: state.stats.bossesDefeated + (isBoss ? 1 : 0),
    },
  };
}

export function getQuestProgress(state: ProgressionState, id: QuestId): number {
  switch (id) {
    case "first-fifty":
      return state.stats.needlesThrown;
    case "nightmare-hunter":
      return state.stats.monstersDefeated;
    case "boss-breaker":
      return state.stats.bossesDefeated;
    case "tenth-stitch":
      return state.highestStageCleared;
    case "needle-collector":
      return state.ownedNeedles.length;
  }
}

export function claimQuest(
  state: ProgressionState,
  quest: {
    readonly id: QuestId;
    readonly target: number;
    readonly rewardThread: number;
    readonly rewardPremium: number;
  },
): ProgressionState {
  if (
    state.claimedQuestIds.includes(quest.id) ||
    getQuestProgress(state, quest.id) < quest.target
  ) {
    return state;
  }
  return {
    ...state,
    thread: state.thread + quest.rewardThread,
    premium: state.premium + quest.rewardPremium,
    claimedQuestIds: [...state.claimedQuestIds, quest.id],
  };
}
