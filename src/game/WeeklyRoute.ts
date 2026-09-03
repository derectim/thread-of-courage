import type { RoomId } from "./content";

export const WEEKLY_ROUTE_VERSION = 1 as const;
export const WEEKLY_ROUTE_NODE_COUNT = 5 as const;
/** Four weekly finishes in a typical month award 16 buttons; a five-week month awards 20. */
export const WEEKLY_ROUTE_BUTTON_REWARD = 4 as const;
export const WEEKLY_ROUTE_REWARD_VARIANTS = [
  {
    id: "weekly-emblem-moon-thimble",
    variant: "moon-thimble",
    name: "Эмблема «Лунный напёрсток»",
    description: "Памятный знак за завершение недельного пути.",
  },
  {
    id: "weekly-emblem-golden-spool",
    variant: "golden-spool",
    name: "Эмблема «Золотая катушка»",
    description: "Памятный знак за завершение недельного пути.",
  },
  {
    id: "weekly-emblem-owl-eye",
    variant: "owl-eye",
    name: "Эмблема «Око филина»",
    description: "Памятный знак за завершение недельного пути.",
  },
  {
    id: "weekly-emblem-pattern-heart",
    variant: "pattern-heart",
    name: "Эмблема «Сердце выкройки»",
    description: "Памятный знак за завершение недельного пути.",
  },
] as const;

export type WeeklyRouteCollectibleId =
  (typeof WEEKLY_ROUTE_REWARD_VARIANTS)[number]["id"];

export type WeeklyModifierId =
  | "hurried-mechanism"
  | "narrow-seam"
  | "dense-stuffing"
  | "reverse-stitch"
  | "fluff-fog"
  | "restless-pattern"
  | "echoing-buttons"
  | "golden-window";

export interface WeeklyModifierEffects {
  readonly rotationSpeedMultiplier?: number;
  readonly collisionToleranceMultiplier?: number;
  readonly requiredHitsDelta?: number;
  readonly reverseRotation?: boolean;
  readonly sceneContrastMultiplier?: number;
  readonly rotationAcceleration?: number;
  readonly directionChangeEveryHits?: number;
  readonly projectileSpeedMultiplier?: number;
}

export interface WeeklyModifierDefinition {
  readonly id: WeeklyModifierId;
  readonly name: string;
  readonly description: string;
  readonly effects: WeeklyModifierEffects;
}

export interface WeeklyRouteNode {
  readonly id: string;
  readonly order: 1 | 2 | 3 | 4 | 5;
  readonly name: string;
  readonly roomId: RoomId;
  readonly modifierId: WeeklyModifierId;
}

export interface WeeklyCosmeticReward {
  readonly id: WeeklyRouteCollectibleId;
  readonly kind: "profile-emblem";
  readonly name: string;
  readonly description: string;
  readonly cosmeticOnly: true;
  /** Earnable premium currency bundled with the first completed lap each week. */
  readonly buttonReward: typeof WEEKLY_ROUTE_BUTTON_REWARD;
  readonly acquisitionLabel: string;
}

export interface WeeklyRouteDefinition {
  readonly weekId: string;
  readonly name: string;
  readonly nodes: readonly WeeklyRouteNode[];
  readonly finalReward: WeeklyCosmeticReward;
}

export interface WeeklyRouteProgress {
  readonly version: typeof WEEKLY_ROUTE_VERSION;
  readonly weekId: string;
  readonly clearsByNode: Readonly<Record<string, number>>;
  readonly finalRewardClaimed: boolean;
}

export interface WeeklyRouteStatus {
  readonly completedFirstLap: boolean;
  readonly completedLaps: number;
  readonly completedNodesThisLap: number;
  readonly nextNode: WeeklyRouteNode;
  readonly canClaimFinalReward: boolean;
}

export interface WeeklyRewardClaimResult {
  readonly progress: WeeklyRouteProgress;
  readonly reward: WeeklyCosmeticReward | null;
}

export const WEEKLY_MODIFIERS: readonly WeeklyModifierDefinition[] = [
  {
    id: "hurried-mechanism",
    name: "Торопливый механизм",
    description: "Узор движется на 14% быстрее.",
    effects: { rotationSpeedMultiplier: 1.14 },
  },
  {
    id: "narrow-seam",
    name: "Узкий шов",
    description: "Безопасный зазор между иглами немного уже.",
    effects: { collisionToleranceMultiplier: 0.92 },
  },
  {
    id: "dense-stuffing",
    name: "Плотная набивка",
    description: "Для победы требуется на два точных стежка больше.",
    effects: { requiredHitsDelta: 2 },
  },
  {
    id: "reverse-stitch",
    name: "Обратная строчка",
    description: "Все узоры начинают движение в обратную сторону.",
    effects: { reverseRotation: true },
  },
  {
    id: "fluff-fog",
    name: "Туман из пуха",
    description: "Комната становится темнее, но силуэты остаются читаемыми.",
    effects: { sceneContrastMultiplier: 0.78 },
  },
  {
    id: "restless-pattern",
    name: "Беспокойная выкройка",
    description: "Узор понемногу ускоряется после каждого попадания.",
    effects: { rotationAcceleration: 0.018 },
  },
  {
    id: "echoing-buttons",
    name: "Эхо пуговиц",
    description: "После каждого третьего попадания направление меняется.",
    effects: { directionChangeEveryHits: 3 },
  },
  {
    id: "golden-window",
    name: "Золотое окно",
    description: "Игла летит быстрее, поэтому важен точный ритм.",
    effects: { projectileSpeedMultiplier: 1.16 },
  },
] as const;

const NODE_NAMES = [
  "Порог спутанных нитей",
  "Зал забытых лекал",
  "Галерея шепчущих кукол",
  "Мост медных катушек",
  "Сердце недельного узора",
] as const;

const ROOMS: readonly RoomId[] = ["attic", "theatre", "machine"];
function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeCount(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

function getWeekId(input: Date | string): string {
  if (typeof input !== "string") return getIsoWeekId(input);
  if (/^\d{4}-W\d{2}$/.test(input)) return input;
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? getIsoWeekId(new Date(0)) : getIsoWeekId(parsed);
}

/** Returns an ISO-8601 week such as `2026-W36`, using UTC to avoid device timezone drift. */
export function getIsoWeekId(date: Date): string {
  if (Number.isNaN(date.getTime())) return "1970-W01";
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const weekday = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - weekday);
  const isoYear = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** Builds the same five-node route for every player in the same ISO week. */
export function createWeeklyRoute(input: Date | string): WeeklyRouteDefinition {
  const weekId = getWeekId(input);
  const seed = hashString(weekId);
  const start = seed % WEEKLY_MODIFIERS.length;
  const step = [1, 3, 5, 7][Math.floor(seed / 8) % 4];
  const roomOffset = Math.floor(seed / 32) % ROOMS.length;
  const nodes = Array.from({ length: WEEKLY_ROUTE_NODE_COUNT }, (_, index) => {
    const modifier = WEEKLY_MODIFIERS[(start + index * step) % WEEKLY_MODIFIERS.length];
    return {
      id: `${weekId}-node-${index + 1}`,
      order: (index + 1) as WeeklyRouteNode["order"],
      name: NODE_NAMES[index],
      roomId: ROOMS[(roomOffset + index) % ROOMS.length],
      modifierId: modifier.id,
    };
  });
  const rewardVariant =
    WEEKLY_ROUTE_REWARD_VARIANTS[seed % WEEKLY_ROUTE_REWARD_VARIANTS.length];

  return {
    weekId,
    name: `Недельный маршрут · ${weekId}`,
    nodes,
    finalReward: {
      id: rewardVariant.id,
      kind: "profile-emblem",
      name: rewardVariant.name,
      description: rewardVariant.description,
      cosmeticOnly: true,
      buttonReward: WEEKLY_ROUTE_BUTTON_REWARD,
      acquisitionLabel: "Завершить все 5 узлов недельного маршрута",
    },
  };
}

/** Resolves current IDs and migrates the old per-week reward IDs used by early saves. */
export function resolveWeeklyRouteCollectibleId(
  value: string,
): WeeklyRouteCollectibleId | null {
  const stableReward = WEEKLY_ROUTE_REWARD_VARIANTS.find(
    (reward) => reward.id === value,
  );
  if (stableReward) return stableReward.id;

  const legacy = /^weekly-emblem-(\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3]))$/.exec(
    value,
  );
  return legacy ? createWeeklyRoute(legacy[1]).finalReward.id : null;
}

export function createWeeklyRouteProgress(
  route: WeeklyRouteDefinition,
): WeeklyRouteProgress {
  return {
    version: WEEKLY_ROUTE_VERSION,
    weekId: route.weekId,
    clearsByNode: Object.fromEntries(route.nodes.map((node) => [node.id, 0])),
    finalRewardClaimed: false,
  };
}

/** Starts fresh when the ISO week changes and sanitizes partial save data. */
export function syncWeeklyRouteProgress(
  value: unknown,
  route: WeeklyRouteDefinition,
): WeeklyRouteProgress {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return createWeeklyRouteProgress(route);
  }
  const record = value as Record<string, unknown>;
  if (record.weekId !== route.weekId) return createWeeklyRouteProgress(route);
  const rawClears =
    typeof record.clearsByNode === "object" &&
    record.clearsByNode !== null &&
    !Array.isArray(record.clearsByNode)
      ? (record.clearsByNode as Record<string, unknown>)
      : {};

  return {
    version: WEEKLY_ROUTE_VERSION,
    weekId: route.weekId,
    clearsByNode: Object.fromEntries(
      route.nodes.map((node) => [node.id, normalizeCount(rawClears[node.id])]),
    ),
    finalRewardClaimed: record.finalRewardClaimed === true,
  };
}

export function getWeeklyRouteStatus(
  progress: WeeklyRouteProgress,
  route: WeeklyRouteDefinition,
): WeeklyRouteStatus {
  const synced = syncWeeklyRouteProgress(progress, route);
  const clears = route.nodes.map((node) => synced.clearsByNode[node.id] ?? 0);
  const completedLaps = Math.min(...clears);
  const nextIndex = clears.findIndex((count) => count === completedLaps);
  const completedNodesThisLap = clears.filter((count) => count > completedLaps).length;
  const completedFirstLap = clears.every((count) => count >= 1);

  return {
    completedFirstLap,
    completedLaps,
    completedNodesThisLap,
    nextNode: route.nodes[Math.max(0, nextIndex)],
    canClaimFinalReward: completedFirstLap && !synced.finalRewardClaimed,
  };
}

/** Clears only the currently unlocked node; after node five the same route loops. */
export function completeWeeklyRouteNode(
  progress: WeeklyRouteProgress,
  route: WeeklyRouteDefinition,
  nodeId: string,
): WeeklyRouteProgress {
  const synced = syncWeeklyRouteProgress(progress, route);
  const status = getWeeklyRouteStatus(synced, route);
  if (status.nextNode.id !== nodeId) return synced;
  return {
    ...synced,
    clearsByNode: {
      ...synced.clearsByNode,
      [nodeId]: (synced.clearsByNode[nodeId] ?? 0) + 1,
    },
  };
}

/** Grants the weekly cosmetic once; repeated laps never duplicate it. */
export function claimWeeklyRouteReward(
  progress: WeeklyRouteProgress,
  route: WeeklyRouteDefinition,
): WeeklyRewardClaimResult {
  const synced = syncWeeklyRouteProgress(progress, route);
  const status = getWeeklyRouteStatus(synced, route);
  if (!status.canClaimFinalReward) return { progress: synced, reward: null };
  return {
    progress: { ...synced, finalRewardClaimed: true },
    reward: route.finalReward,
  };
}

export function getWeeklyModifier(
  id: WeeklyModifierId,
): WeeklyModifierDefinition {
  return WEEKLY_MODIFIERS.find((modifier) => modifier.id === id) ?? WEEKLY_MODIFIERS[0];
}
