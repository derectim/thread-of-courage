import {
  NEEDLE_MASTERY_REWARDS,
  getNeedleMasteryLevel,
  normalizeNeedleMasteryState,
} from "./NeedleMastery";
import {
  SEASON_PASS_TIERS,
  type SeasonCosmeticKind,
  type SeasonPassTrack,
} from "./SeasonPass";
import {
  WEEKLY_ROUTE_REWARD_VARIANTS,
  resolveWeeklyRouteCollectibleId,
} from "./WeeklyRoute";

export const WORKSHOP_COLLECTION_VERSION = 1 as const;
export const WORKSHOP_COLLECTION_SAVE_KEY = "thread-of-courage-workshop-v1";

export const WORKSHOP_COLLECTIBLE_KINDS = [
  "title",
  "patch",
  "portrait-frame",
  "name-glow",
  "name-font",
  "needle-trail",
  "needle-impact",
  "needle-aura",
  "workshop-ornament",
] as const;

export type WorkshopCollectibleKind =
  (typeof WORKSHOP_COLLECTIBLE_KINDS)[number];
export type WorkshopCollectibleSource =
  | "season"
  | "needle-mastery"
  | "weekly-route"
  | "workshop-milestone";
export type WorkshopCollectibleRarity =
  | "common"
  | "rare"
  | "epic"
  | "legendary";

export interface WorkshopCollectible {
  readonly id: string;
  readonly kind: WorkshopCollectibleKind;
  readonly source: WorkshopCollectibleSource;
  readonly sourceId: string;
  readonly name: string;
  readonly description: string;
  /** Stable key for a UI image atlas or an individual generated asset. */
  readonly artKey: string;
  readonly rarity: WorkshopCollectibleRarity;
  readonly cosmeticOnly: true;
}

export type WorkshopEquipment = Readonly<
  Record<WorkshopCollectibleKind, string | null>
>;

export interface WorkshopCollectionState {
  readonly version: typeof WORKSHOP_COLLECTION_VERSION;
  readonly ownedCollectibleIds: readonly string[];
  readonly equipped: WorkshopEquipment;
}

export interface WorkshopCollectionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface WorkshopEntitlements {
  /** Known reward IDs copied from the legacy ProgressionState entitlement list. */
  readonly ownedSeasonCosmeticIds?: readonly string[];
  /** A NeedleMasteryState or untrusted save data accepted by its normalizer. */
  readonly needleMastery?: unknown;
  /** Reserved for later trusted rewards, such as a weekly route collectible. */
  readonly additionalCollectibleIds?: readonly string[];
}

export interface WorkshopLevelDefinition {
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  readonly requiredCollectionCount: number;
  readonly name: string;
  readonly description: string;
  readonly visualAdditions: readonly string[];
  readonly rewardCollectibleId: string | null;
}

export interface WorkshopCollectionSummary {
  readonly collectedCount: number;
  readonly totalCollectibleCount: number;
  readonly workshopLevel: WorkshopLevelDefinition["level"];
  readonly currentLevel: WorkshopLevelDefinition;
  readonly nextLevel: WorkshopLevelDefinition | null;
  readonly collectedTowardNextLevel: number;
  readonly neededForNextLevel: number | null;
}

const SEASON_KIND_MAP: Readonly<
  Record<SeasonCosmeticKind, WorkshopCollectibleKind>
> = {
  "profile-badge": "patch",
  "profile-title": "title",
  "avatar-frame": "portrait-frame",
  "needle-trail": "needle-trail",
  "hit-flourish": "needle-impact",
  "menu-ornament": "workshop-ornament",
};

const MASTERY_KIND_MAP = {
  trail: "needle-trail",
  impact: "needle-impact",
  badge: "patch",
  aura: "needle-aura",
  title: "title",
} as const satisfies Readonly<
  Record<
    (typeof NEEDLE_MASTERY_REWARDS)[number]["kind"],
    WorkshopCollectibleKind
  >
>;

function seasonRarity(
  track: SeasonPassTrack,
  tier: number,
): WorkshopCollectibleRarity {
  if (tier === SEASON_PASS_TIERS.length) return "legendary";
  if (track === "premium") return tier >= 13 ? "legendary" : "epic";
  return tier >= 15 ? "epic" : tier >= 7 ? "rare" : "common";
}

const SEASON_COLLECTIBLES: readonly WorkshopCollectible[] =
  SEASON_PASS_TIERS.flatMap((definition) =>
    (["free", "premium"] as const).map((track) => {
      const reward =
        track === "free" ? definition.freeReward : definition.premiumReward;
      return {
        id: reward.id,
        kind: SEASON_KIND_MAP[reward.kind],
        source: "season" as const,
        sourceId: `${track}-${definition.tier}`,
        name: reward.name,
        description: reward.description,
        artKey: reward.id,
        rarity: seasonRarity(track, definition.tier),
        cosmeticOnly: true as const,
      };
    }),
  );

const MASTERY_COLLECTIBLES: readonly WorkshopCollectible[] =
  NEEDLE_MASTERY_REWARDS.map((reward) => ({
    id: reward.id,
    kind: MASTERY_KIND_MAP[reward.kind],
    source: "needle-mastery" as const,
    sourceId: `${reward.needleId}-${reward.requiredLevel}`,
    name: reward.name,
    description: reward.description,
    artKey: reward.id,
    rarity:
      reward.requiredLevel >= 10
        ? ("legendary" as const)
        : reward.requiredLevel >= 8
          ? ("epic" as const)
          : reward.requiredLevel >= 4
            ? ("rare" as const)
            : ("common" as const),
    cosmeticOnly: true as const,
  }));

const WEEKLY_ROUTE_COLLECTIBLES: readonly WorkshopCollectible[] =
  WEEKLY_ROUTE_REWARD_VARIANTS.map((reward) => ({
    id: reward.id,
    kind: "patch" as const,
    source: "weekly-route" as const,
    sourceId: reward.variant,
    name: reward.name,
    description: reward.description,
    artKey: reward.id,
    rarity: "epic" as const,
    cosmeticOnly: true as const,
  }));

const MILESTONE_COLLECTIBLES: readonly WorkshopCollectible[] = [
  {
    id: "workshop-glow-warm-thread",
    kind: "name-glow",
    source: "workshop-milestone",
    sourceId: "workshop-level-2",
    name: "Свечение «Тёплая нить»",
    description: "Имя мягко светится янтарной пряжей.",
    artKey: "workshop-glow-warm-thread",
    rarity: "rare",
    cosmeticOnly: true,
  },
  {
    id: "workshop-font-hand-stitch",
    kind: "name-font",
    source: "workshop-milestone",
    sourceId: "workshop-level-3",
    name: "Почерк «Ручной стежок»",
    description: "Тёплый рукописный шрифт имени.",
    artKey: "workshop-font-hand-stitch",
    rarity: "rare",
    cosmeticOnly: true,
  },
  {
    id: "workshop-glow-moon-silk",
    kind: "name-glow",
    source: "workshop-milestone",
    sourceId: "workshop-level-4",
    name: "Свечение «Лунный шёлк»",
    description: "Серебристо-синяя подсветка имени.",
    artKey: "workshop-glow-moon-silk",
    rarity: "epic",
    cosmeticOnly: true,
  },
  {
    id: "workshop-font-storybook",
    kind: "name-font",
    source: "workshop-milestone",
    sourceId: "workshop-level-5",
    name: "Почерк «Сказочная книга»",
    description: "Нарядный книжный шрифт имени.",
    artKey: "workshop-font-storybook",
    rarity: "epic",
    cosmeticOnly: true,
  },
  {
    id: "workshop-glow-living-thread",
    kind: "name-glow",
    source: "workshop-milestone",
    sourceId: "workshop-level-6",
    name: "Свечение «Живая нить»",
    description: "Редкое малиново-золотое сияние имени мастера.",
    artKey: "workshop-glow-living-thread",
    rarity: "legendary",
    cosmeticOnly: true,
  },
] as const;

export const WORKSHOP_COLLECTIBLES: readonly WorkshopCollectible[] = [
  ...SEASON_COLLECTIBLES,
  ...MASTERY_COLLECTIBLES,
  ...WEEKLY_ROUTE_COLLECTIBLES,
  ...MILESTONE_COLLECTIBLES,
];

export const WORKSHOP_LEVELS: readonly WorkshopLevelDefinition[] = [
  {
    level: 1,
    requiredCollectionCount: 0,
    name: "Швейный уголок",
    description: "Появляются рабочий стол и потрёпанная Книга мастерской.",
    visualAdditions: ["worktable", "workshop-book"],
    rewardCollectibleId: null,
  },
  {
    level: 2,
    requiredCollectionCount: 4,
    name: "Полка выкроек",
    description: "Над столом появляется полка с выкройками и тёплой лампой.",
    visualAdditions: ["pattern-shelf", "thread-lamp"],
    rewardCollectibleId: "workshop-glow-warm-thread",
  },
  {
    level: 3,
    requiredCollectionCount: 10,
    name: "Стена нашивок",
    description: "Собранные нашивки занимают заметное место в мастерской.",
    visualAdditions: ["patch-wall", "needle-stand"],
    rewardCollectibleId: "workshop-font-hand-stitch",
  },
  {
    level: 4,
    requiredCollectionCount: 18,
    name: "Архив узоров",
    description: "Открываются книжный шкаф и светящийся сезонный альбом.",
    visualAdditions: ["bookcase", "season-album-stand"],
    rewardCollectibleId: "workshop-glow-moon-silk",
  },
  {
    level: 5,
    requiredCollectionCount: 30,
    name: "Дом живой нити",
    description: "Мастерская получает витрину рамок и вышитый балдахин.",
    visualAdditions: ["frame-display", "stitched-canopy"],
    rewardCollectibleId: "workshop-font-storybook",
  },
  {
    level: 6,
    requiredCollectionCount: 45,
    name: "Великая мастерская",
    description: "Зал завершают золотой станок, знамя и витрина трофеев.",
    visualAdditions: ["golden-loom", "master-banner", "trophy-cabinet"],
    rewardCollectibleId: "workshop-glow-living-thread",
  },
] as const;

const COLLECTIBLE_BY_ID = new Map(
  WORKSHOP_COLLECTIBLES.map((collectible) => [collectible.id, collectible]),
);

/** Every patch is a real generated, transparent game asset rather than a glyph. */
export const WORKSHOP_PATCH_ART: Readonly<Record<string, string>> = {
  "living-thread-01-free-1": "patch-first-stitch.webp",
  "living-thread-01-free-4": "patch-copper-button.webp",
  "living-thread-01-free-8": "patch-patchwork-path.webp",
  "living-thread-01-free-13": "patch-thirteenth-loop.webp",
  "living-thread-01-free-18": "patch-master-path.webp",
  "living-thread-01-premium-3": "patch-night-workshop.webp",
  "living-thread-01-premium-9": "patch-tailor-owl.webp",
  "living-thread-01-premium-15": "patch-sewing-storm.webp",
  "silver-mastery-6": "patch-faithful-hand.webp",
  "bone-mastery-6": "patch-old-craft.webp",
  "storm-mastery-6": "patch-storm-tamer.webp",
  "sunrise-mastery-6": "patch-first-ray.webp",
  "moonweave-mastery-6": "patch-moonweave-master-v1.webp",
  "velvet-thorn-mastery-6": "patch-velvet-thorn-master-v1.webp",
  "clockwork-mastery-6": "patch-clockwork-master-v1.webp",
  "royal-seam-mastery-6": "patch-royal-seam-master-v1.webp",
  "weekly-emblem-moon-thimble": "patch-weekly-moon-thimble.webp",
  "weekly-emblem-golden-spool": "patch-weekly-golden-spool.webp",
  "weekly-emblem-owl-eye": "patch-weekly-owl-eye.webp",
  "weekly-emblem-pattern-heart": "patch-weekly-pattern-heart.webp",
};

/** Runtime art for every collectible portrait frame in the current season. */
export const WORKSHOP_FRAME_ART: Readonly<Record<string, string>> = {
  "living-thread-01-free-5": "frame-blue-stitch.webp",
  "living-thread-01-free-10": "frame-warm-felt.webp",
  "living-thread-01-free-16": "frame-spool-wreath.webp",
  "living-thread-01-premium-1": "frame-golden-eye.webp",
  "living-thread-01-premium-7": "frame-thread-theatre.webp",
  "living-thread-01-premium-13": "frame-mechanical-lace.webp",
  "living-thread-01-premium-19": "frame-living-thread.webp",
};

/** Runtime art for every collectible ornament placed in the workshop. */
export const WORKSHOP_ORNAMENT_ART: Readonly<Record<string, string>> = {
  "living-thread-01-free-6": "ornament-small-spool.webp",
  "living-thread-01-free-12": "ornament-apprentice-scissors.webp",
  "living-thread-01-free-19": "ornament-moon-pattern.webp",
  "living-thread-01-premium-6": "ornament-golden-shuttle.webp",
  "living-thread-01-premium-12": "ornament-seamstress-clock.webp",
  "living-thread-01-premium-18": "ornament-golden-machine-heart.webp",
};

/** Runtime art for every collectible needle impact in the season and mastery tracks. */
export const WORKSHOP_IMPACT_ART: Readonly<Record<string, string>> = {
  "living-thread-01-free-3": "impact-wool-puff.webp",
  "living-thread-01-free-11": "impact-button-spark.webp",
  "living-thread-01-free-17": "impact-golden-knot.webp",
  "living-thread-01-premium-4": "impact-silk-stars.webp",
  "living-thread-01-premium-10": "impact-scattered-gems.webp",
  "living-thread-01-premium-16": "impact-stitch-crown.webp",
  "silver-mastery-4": "impact-moon-sparks.webp",
  "bone-mastery-4": "impact-runic-shard.webp",
  "storm-mastery-4": "impact-thunder-knot.webp",
  "sunrise-mastery-4": "impact-dawn-petals.webp",
  "moonweave-mastery-4": "impact-moon-tide-v1.webp",
  "velvet-thorn-mastery-4": "impact-velvet-rose-v1.webp",
  "clockwork-mastery-4": "impact-clockwork-strike-v1.webp",
  "royal-seam-mastery-4": "impact-amethyst-crown-v1.webp",
};

export function getWorkshopPatchArtFileName(id: string): string | null {
  return WORKSHOP_PATCH_ART[id] ?? null;
}

export function getWorkshopFrameArtFileName(id: string): string | null {
  return WORKSHOP_FRAME_ART[id] ?? null;
}

export function getWorkshopOrnamentArtFileName(id: string): string | null {
  return WORKSHOP_ORNAMENT_ART[id] ?? null;
}

export function getWorkshopImpactArtFileName(id: string): string | null {
  return WORKSHOP_IMPACT_ART[id] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createEquipment(): Record<WorkshopCollectibleKind, string | null> {
  return {
    title: null,
    patch: null,
    "portrait-frame": null,
    "name-glow": null,
    "name-font": null,
    "needle-trail": null,
    "needle-impact": null,
    "needle-aura": null,
    "workshop-ornament": null,
  };
}

function normalizeKnownIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.flatMap((id) => {
        if (typeof id !== "string") return [];
        if (COLLECTIBLE_BY_ID.has(id)) return [id];
        const migratedId = resolveWeeklyRouteCollectibleId(id);
        return migratedId && COLLECTIBLE_BY_ID.has(migratedId)
          ? [migratedId]
          : [];
      }),
    ),
  );
}

function getCoreCollectionCount(ids: readonly string[]): number {
  return ids.reduce((count, id) => {
    const collectible = COLLECTIBLE_BY_ID.get(id);
    return collectible && collectible.source !== "workshop-milestone"
      ? count + 1
      : count;
  }, 0);
}

function getWorkshopLevelForCount(count: number): WorkshopLevelDefinition {
  let current = WORKSHOP_LEVELS[0];
  for (const level of WORKSHOP_LEVELS) {
    if (count < level.requiredCollectionCount) break;
    current = level;
  }
  return current;
}

function withMilestoneRewards(ids: readonly string[]): string[] {
  const knownIds = normalizeKnownIds(ids);
  const level = getWorkshopLevelForCount(getCoreCollectionCount(knownIds));
  const milestoneRewards = WORKSHOP_LEVELS.filter(
    (definition) => definition.level <= level.level,
  )
    .map((definition) => definition.rewardCollectibleId)
    .filter((id): id is string => id !== null);
  return Array.from(new Set([...knownIds, ...milestoneRewards]));
}

function readLegacyEquipment(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const modern = isRecord(value.equipped) ? value.equipped : {};
  return {
    ...modern,
    title: modern.title ?? value.equippedTitle,
    patch: modern.patch ?? value.equippedPatch,
    "portrait-frame": modern["portrait-frame"] ?? value.equippedPortraitFrame,
    "name-glow": modern["name-glow"] ?? value.equippedNameGlow,
    "name-font": modern["name-font"] ?? value.equippedNameFont,
    "needle-trail": modern["needle-trail"] ?? value.equippedNeedleTrail,
    "needle-impact": modern["needle-impact"] ?? value.equippedNeedleImpact,
    "needle-aura": modern["needle-aura"] ?? value.equippedNeedleAura,
    "workshop-ornament":
      modern["workshop-ornament"] ?? value.equippedWorkshopOrnament,
  };
}

function normalizeEquipment(
  value: Record<string, unknown>,
  ownedIds: readonly string[],
): WorkshopEquipment {
  const equipped = createEquipment();
  const owned = new Set(ownedIds);
  for (const kind of WORKSHOP_COLLECTIBLE_KINDS) {
    const candidate = value[kind];
    if (typeof candidate !== "string" || !owned.has(candidate)) continue;
    if (COLLECTIBLE_BY_ID.get(candidate)?.kind === kind) {
      equipped[kind] = candidate;
    }
  }
  return equipped;
}

function collectEntitledIds(entitlements: WorkshopEntitlements): string[] {
  const seasonIds = normalizeKnownIds(entitlements.ownedSeasonCosmeticIds);
  const additionalIds = normalizeKnownIds(entitlements.additionalCollectibleIds);
  const mastery = normalizeNeedleMasteryState(entitlements.needleMastery);
  const masteryIds = NEEDLE_MASTERY_REWARDS.filter(
    (reward) =>
      reward.requiredLevel <=
      getNeedleMasteryLevel(mastery.byNeedle[reward.needleId].xp),
  ).map((reward) => reward.id);
  return [...seasonIds, ...additionalIds, ...masteryIds];
}

export function getWorkshopCollectible(
  id: string,
): WorkshopCollectible | null {
  return COLLECTIBLE_BY_ID.get(id) ?? null;
}

export function getWorkshopCollectiblesByKind(
  kind: WorkshopCollectibleKind,
): readonly WorkshopCollectible[] {
  return WORKSHOP_COLLECTIBLES.filter(
    (collectible) => collectible.kind === kind,
  );
}

export function createWorkshopCollectionState(
  entitlements: WorkshopEntitlements = {},
): WorkshopCollectionState {
  const ownedCollectibleIds = withMilestoneRewards(
    collectEntitledIds(entitlements),
  );
  return {
    version: WORKSHOP_COLLECTION_VERSION,
    ownedCollectibleIds,
    equipped: createEquipment(),
  };
}

/** Safely migrates flat equipment fields and merges authoritative game rewards. */
export function normalizeWorkshopCollectionState(
  value: unknown,
  entitlements: WorkshopEntitlements = {},
): WorkshopCollectionState {
  const record = isRecord(value) ? value : {};
  const savedIds = normalizeKnownIds(
    record.ownedCollectibleIds ?? record.ownedIds ?? record.collectedIds,
  );
  const ownedCollectibleIds = withMilestoneRewards([
    ...savedIds,
    ...collectEntitledIds(entitlements),
  ]);
  return {
    version: WORKSHOP_COLLECTION_VERSION,
    ownedCollectibleIds,
    equipped: normalizeEquipment(
      readLegacyEquipment(record),
      ownedCollectibleIds,
    ),
  };
}

export function grantWorkshopCollectible(
  state: WorkshopCollectionState,
  collectibleId: string,
): WorkshopCollectionState {
  const normalizedId = normalizeKnownIds([collectibleId])[0];
  if (!normalizedId) return state;
  const ownedCollectibleIds = withMilestoneRewards([
    ...state.ownedCollectibleIds,
    normalizedId,
  ]);
  if (
    ownedCollectibleIds.length === state.ownedCollectibleIds.length &&
    state.ownedCollectibleIds.includes(normalizedId)
  ) {
    return state;
  }
  return { ...state, ownedCollectibleIds };
}

/** Equips an owned item; passing null restores the default look for that slot. */
export function equipWorkshopCollectible(
  state: WorkshopCollectionState,
  kind: WorkshopCollectibleKind,
  collectibleId: string | null,
): WorkshopCollectionState {
  if (collectibleId === null) {
    if (state.equipped[kind] === null) return state;
    return { ...state, equipped: { ...state.equipped, [kind]: null } };
  }
  const collectible = COLLECTIBLE_BY_ID.get(collectibleId);
  if (
    collectible?.kind !== kind ||
    !state.ownedCollectibleIds.includes(collectibleId) ||
    state.equipped[kind] === collectibleId
  ) {
    return state;
  }
  return {
    ...state,
    equipped: { ...state.equipped, [kind]: collectibleId },
  };
}

export function getEquippedWorkshopCollectible(
  state: WorkshopCollectionState,
  kind: WorkshopCollectibleKind,
): WorkshopCollectible | null {
  const id = state.equipped[kind];
  if (id === null) return null;
  const collectible = COLLECTIBLE_BY_ID.get(id);
  return collectible?.kind === kind ? collectible : null;
}

export function getWorkshopCollectionSummary(
  state: WorkshopCollectionState,
): WorkshopCollectionSummary {
  const collectedCount = getCoreCollectionCount(state.ownedCollectibleIds);
  const currentLevel = getWorkshopLevelForCount(collectedCount);
  const nextLevel =
    WORKSHOP_LEVELS.find((level) => level.level === currentLevel.level + 1) ??
    null;
  return {
    collectedCount,
    totalCollectibleCount:
      SEASON_COLLECTIBLES.length +
      MASTERY_COLLECTIBLES.length +
      WEEKLY_ROUTE_COLLECTIBLES.length,
    workshopLevel: currentLevel.level,
    currentLevel,
    nextLevel,
    collectedTowardNextLevel: nextLevel
      ? collectedCount - currentLevel.requiredCollectionCount
      : collectedCount - currentLevel.requiredCollectionCount,
    neededForNextLevel: nextLevel
      ? nextLevel.requiredCollectionCount - collectedCount
      : null,
  };
}

function resolveStorage(
  storage: WorkshopCollectionStorage | null | undefined,
): WorkshopCollectionStorage | null {
  if (storage !== undefined) return storage;
  try {
    return typeof globalThis.localStorage === "undefined"
      ? null
      : globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadWorkshopCollection(
  storage?: WorkshopCollectionStorage | null,
  entitlements: WorkshopEntitlements = {},
): WorkshopCollectionState {
  const resolved = resolveStorage(storage);
  if (!resolved) return createWorkshopCollectionState(entitlements);
  try {
    const raw = resolved.getItem(WORKSHOP_COLLECTION_SAVE_KEY);
    if (raw === null) return createWorkshopCollectionState(entitlements);
    return normalizeWorkshopCollectionState(JSON.parse(raw) as unknown, entitlements);
  } catch {
    return createWorkshopCollectionState(entitlements);
  }
}

export function saveWorkshopCollection(
  state: WorkshopCollectionState,
  storage?: WorkshopCollectionStorage | null,
): boolean {
  const resolved = resolveStorage(storage);
  if (!resolved) return false;
  try {
    resolved.setItem(
      WORKSHOP_COLLECTION_SAVE_KEY,
      JSON.stringify(normalizeWorkshopCollectionState(state)),
    );
    return true;
  } catch {
    return false;
  }
}
