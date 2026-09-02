export const PROGRESSION_SAVE_KEY = "thread-of-courage-save-v2";
export const LEGACY_SAVE_KEY = "thread-of-courage-save-v1";
export const PROGRESSION_SAVE_VERSION = 2 as const;
export const MAX_UPGRADE_LEVEL = 5 as const;

export const UPGRADE_IDS = ["power", "precision", "speed", "ward"] as const;

export type UpgradeId = (typeof UPGRADE_IDS)[number];
export type UpgradeLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type UpgradeLevels = Readonly<Record<UpgradeId, UpgradeLevel>>;

export interface ProgressionState {
  readonly version: typeof PROGRESSION_SAVE_VERSION;
  readonly bestStage: number;
  readonly thread: number;
  readonly muted: boolean;
  readonly upgrades: UpgradeLevels;
}

export interface ProgressionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface UpgradeDefinition {
  readonly description: string;
  readonly baseCost: number;
}

export const UPGRADE_DEFINITIONS: Readonly<
  Record<UpgradeId, UpgradeDefinition>
> = {
  power: {
    description: "Шанс нанести двойной стежок",
    baseCost: 12,
  },
  precision: {
    description: "Уменьшает минимальный угловой зазор между иглами",
    baseCost: 10,
  },
  speed: {
    description: "Ускоряет полёт иглы",
    baseCost: 8,
  },
  ward: {
    description: "Добавляет спасительные щиты на рейд",
    baseCost: 15,
  },
};

const COST_MULTIPLIERS = [1, 2, 3, 5, 8] as const;

function createUpgradeLevels(): Record<UpgradeId, UpgradeLevel> {
  return {
    power: 0,
    precision: 0,
    speed: 0,
    ward: 0,
  };
}

function createDefaultState(): ProgressionState {
  return {
    version: PROGRESSION_SAVE_VERSION,
    bestStage: 1,
    thread: 0,
    muted: false,
    upgrades: createUpgradeLevels(),
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

function normalizeInteger(value: unknown, fallback: number, minimum: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.floor(numeric));
}

function normalizeUpgradeLevel(value: unknown): UpgradeLevel {
  const level = normalizeInteger(value, 0, 0);
  return Math.min(level, MAX_UPGRADE_LEVEL) as UpgradeLevel;
}

function normalizeState(value: Record<string, unknown>): ProgressionState {
  const upgrades = isRecord(value.upgrades) ? value.upgrades : {};

  return {
    version: PROGRESSION_SAVE_VERSION,
    bestStage: normalizeInteger(value.bestStage, 1, 1),
    thread: normalizeInteger(value.thread, 0, 0),
    muted: value.muted === true,
    upgrades: {
      power: normalizeUpgradeLevel(upgrades.power),
      precision: normalizeUpgradeLevel(upgrades.precision),
      speed: normalizeUpgradeLevel(upgrades.speed),
      ward: normalizeUpgradeLevel(upgrades.ward),
    },
  };
}

function resolveStorage(
  storage: ProgressionStorage | null | undefined,
): ProgressionStorage | null {
  if (storage !== undefined) return storage;

  try {
    return typeof globalThis.localStorage === "undefined"
      ? null
      : globalThis.localStorage;
  } catch {
    return null;
  }
}

function readRecord(
  storage: ProgressionStorage,
  key: string,
): Record<string, unknown> | null {
  try {
    return parseRecord(storage.getItem(key));
  } catch {
    return null;
  }
}

/** Loads v2 progress, or migrates the legacy v1 save when necessary. */
export function load(
  storage?: ProgressionStorage | null,
): ProgressionState {
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) return createDefaultState();

  const current = readRecord(resolvedStorage, PROGRESSION_SAVE_KEY);
  if (current?.version === PROGRESSION_SAVE_VERSION) {
    return normalizeState(current);
  }

  const legacy = readRecord(resolvedStorage, LEGACY_SAVE_KEY);
  if (!legacy) return createDefaultState();

  const migrated = normalizeState(legacy);
  save(migrated, resolvedStorage);
  return migrated;
}

/** Saves a normalized v2 snapshot. Returns false when storage is unavailable. */
export function save(
  state: ProgressionState,
  storage?: ProgressionStorage | null,
): boolean {
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) return false;

  try {
    const snapshot = normalizeState(state as unknown as Record<string, unknown>);
    resolvedStorage.setItem(PROGRESSION_SAVE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

/** Returns the price of the next level, or null when the upgrade is maxed. */
export function getUpgradeCost(
  upgrade: UpgradeId,
  currentLevel: UpgradeLevel,
): number | null {
  if (currentLevel >= MAX_UPGRADE_LEVEL) return null;

  const purchasableLevel = currentLevel as Exclude<
    UpgradeLevel,
    typeof MAX_UPGRADE_LEVEL
  >;

  return (
    UPGRADE_DEFINITIONS[upgrade].baseCost * COST_MULTIPLIERS[purchasableLevel]
  );
}

/**
 * Purchases one level without mutating the supplied state.
 * If the upgrade is maxed or unaffordable, the original state is returned.
 */
export function purchaseUpgrade(
  state: ProgressionState,
  upgrade: UpgradeId,
): ProgressionState {
  const currentLevel = state.upgrades[upgrade];
  const cost = getUpgradeCost(upgrade, currentLevel);

  if (cost === null || state.thread < cost) return state;

  const nextLevel = (currentLevel + 1) as UpgradeLevel;

  return {
    ...state,
    thread: state.thread - cost,
    upgrades: {
      ...state.upgrades,
      [upgrade]: nextLevel,
    },
  };
}
