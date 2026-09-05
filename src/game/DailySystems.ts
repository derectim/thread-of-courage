import type { RoomId } from "./content";
import type { NeedleSkinId } from "./meta";

export const DAILY_SYSTEMS_VERSION = 1 as const;
export const DAILY_QUEST_COUNT = 3 as const;

export interface RewardBundle {
  readonly thread: number;
  /** Kept for compatibility; repeatable rewards never grant premium currency. */
  readonly buttonReward?: number;
}

export type BossKind = "any" | "main" | "mini";

export type DailyQuestCriteria =
  | {
      readonly kind: "victories";
      readonly target: number;
      readonly needleId?: NeedleSkinId;
      readonly roomId?: RoomId;
      readonly monsterId?: string;
      readonly bossKind?: BossKind;
      readonly perfectOnly?: boolean;
    }
  | {
      readonly kind: "accurate-streak";
      readonly target: number;
    };

export const DAILY_QUEST_IDS = [
  "victories-2",
  "victories-4",
  "perfect-victory",
  "accurate-streak-6",
  "accurate-streak-10",
  "accurate-streak-14",
  "needle-silver",
  "needle-bone",
  "needle-storm",
  "needle-sunrise",
  "room-attic",
  "room-theatre",
  "room-machine",
  "boss-any",
  "boss-main",
  "boss-mini",
  "boss-sewing-storm",
  "boss-moth-mask",
  "boss-madam-marionette",
  "boss-ripper",
] as const;

export type DailyQuestId = (typeof DAILY_QUEST_IDS)[number];
export type DailyQuestGroup = "journey" | "accuracy" | "needle" | "room" | "boss";

export interface DailyQuestDefinition {
  readonly id: DailyQuestId;
  readonly group: DailyQuestGroup;
  readonly name: string;
  readonly description: string;
  readonly criteria: DailyQuestCriteria;
  readonly reward: RewardBundle;
}

export const DAILY_QUESTS: readonly DailyQuestDefinition[] = [
  {
    id: "victories-2",
    group: "journey",
    name: "Размять пальцы",
    description: "Победи 2 противников.",
    criteria: { kind: "victories", target: 2 },
    reward: { thread: 10 },
  },
  {
    id: "victories-4",
    group: "journey",
    name: "Длинная дорожка",
    description: "Победи 4 противников.",
    criteria: { kind: "victories", target: 4 },
    reward: { thread: 14 },
  },
  {
    id: "perfect-victory",
    group: "journey",
    name: "Без единой затяжки",
    description: "Заверши комнату без промаха.",
    criteria: { kind: "victories", target: 1, perfectOnly: true },
    reward: { thread: 18 },
  },
  {
    id: "accurate-streak-6",
    group: "accuracy",
    name: "Ровная строчка",
    description: "Собери серию из 6 точных попаданий.",
    criteria: { kind: "accurate-streak", target: 6 },
    reward: { thread: 10 },
  },
  {
    id: "accurate-streak-10",
    group: "accuracy",
    name: "Рука мастерицы",
    description: "Собери серию из 10 точных попаданий.",
    criteria: { kind: "accurate-streak", target: 10 },
    reward: { thread: 19 },
  },
  {
    id: "accurate-streak-14",
    group: "accuracy",
    name: "Идеальный шов",
    description: "Собери серию из 14 точных попаданий.",
    criteria: { kind: "accurate-streak", target: 14 },
    reward: { thread: 28 },
  },
  {
    id: "needle-silver",
    group: "needle",
    name: "Серебряная работа",
    description: "Одержи 2 победы Серебряной иглой.",
    criteria: { kind: "victories", target: 2, needleId: "silver" },
    reward: { thread: 11 },
  },
  {
    id: "needle-bone",
    group: "needle",
    name: "Костяная вязь",
    description: "Одержи 2 победы Костяным шипом.",
    criteria: { kind: "victories", target: 2, needleId: "bone" },
    reward: { thread: 12 },
  },
  {
    id: "needle-storm",
    group: "needle",
    name: "Грозовой узор",
    description: "Одержи 2 победы Грозовым челноком.",
    criteria: { kind: "victories", target: 2, needleId: "storm" },
    reward: { thread: 18 },
  },
  {
    id: "needle-sunrise",
    group: "needle",
    name: "Строчка рассвета",
    description: "Одержи 2 победы Иглой рассвета.",
    criteria: { kind: "victories", target: 2, needleId: "sunrise" },
    reward: { thread: 20 },
  },
  {
    id: "room-attic",
    group: "room",
    name: "Порядок на чердаке",
    description: "Очисти 2 комнаты Чердачной мастерской.",
    criteria: { kind: "victories", target: 2, roomId: "attic" },
    reward: { thread: 11 },
  },
  {
    id: "room-theatre",
    group: "room",
    name: "Тихая сцена",
    description: "Очисти 2 комнаты Театра забытых кукол.",
    criteria: { kind: "victories", target: 2, roomId: "theatre" },
    reward: { thread: 12 },
  },
  {
    id: "room-machine",
    group: "room",
    name: "Сердце механизма",
    description: "Очисти 2 комнаты Сердца швейной машины.",
    criteria: { kind: "victories", target: 2, roomId: "machine" },
    reward: { thread: 13 },
  },
  {
    id: "boss-any",
    group: "boss",
    name: "Большая штопка",
    description: "Победи любого босса или мини-босса.",
    criteria: { kind: "victories", target: 1, bossKind: "any" },
    reward: { thread: 20 },
  },
  {
    id: "boss-main",
    group: "boss",
    name: "Главная угроза",
    description: "Победи главного босса.",
    criteria: { kind: "victories", target: 1, bossKind: "main" },
    reward: { thread: 28 },
  },
  {
    id: "boss-mini",
    group: "boss",
    name: "Мал да колюч",
    description: "Победи мини-босса.",
    criteria: { kind: "victories", target: 1, bossKind: "mini" },
    reward: { thread: 19 },
  },
  {
    id: "boss-sewing-storm",
    group: "boss",
    name: "Укротить бурю",
    description: "Победи Великую Швейную Бурю.",
    criteria: { kind: "victories", target: 1, monsterId: "sewing-storm" },
    reward: { thread: 30 },
  },
  {
    id: "boss-moth-mask",
    group: "boss",
    name: "Сорвать маску",
    description: "Победи Моль-Маску.",
    criteria: { kind: "victories", target: 1, monsterId: "moth-mask" },
    reward: { thread: 31 },
  },
  {
    id: "boss-madam-marionette",
    group: "boss",
    name: "Обрезать нити",
    description: "Победи Мадам Марионетку.",
    criteria: { kind: "victories", target: 1, monsterId: "madam-marionette" },
    reward: { thread: 32 },
  },
  {
    id: "boss-ripper",
    group: "boss",
    name: "Последний разрез",
    description: "Победи Распарывателя.",
    criteria: { kind: "victories", target: 1, monsterId: "ripper" },
    reward: { thread: 38 },
  },
] as const;

const QUEST_BY_ID = new Map(DAILY_QUESTS.map((quest) => [quest.id, quest]));

export interface DailySelectionContext {
  /** Pass owned needles so a daily quest never asks for locked equipment. */
  readonly availableNeedleIds?: readonly NeedleSkinId[];
  /** Pass rooms reachable by the player. All rooms are used when omitted. */
  readonly availableRoomIds?: readonly RoomId[];
  /** Pass discovered boss ids to enable named boss quests. */
  readonly availableMonsterIds?: readonly string[];
  readonly includeMainBossQuests?: boolean;
  readonly includeMiniBossQuests?: boolean;
}

export interface DailyQuestProgress {
  readonly id: DailyQuestId;
  readonly progress: number;
  readonly claimed: boolean;
}

export interface DailyQuestBoardState {
  readonly dayKey: string;
  readonly roll: 0 | 1;
  readonly refreshUsed: boolean;
  readonly quests: readonly DailyQuestProgress[];
}

export type StreakChestTier = "regular" | "grand";

export interface StreakChest {
  readonly id: string;
  readonly run: number;
  readonly milestone: number;
  readonly tier: StreakChestTier;
  readonly reward: RewardBundle;
}

export interface VictoryStreakState {
  readonly run: number;
  readonly current: number;
  readonly best: number;
  readonly pendingChests: readonly StreakChest[];
  readonly claimedChestIds: readonly string[];
}

export interface DailySystemsState {
  readonly version: typeof DAILY_SYSTEMS_VERSION;
  readonly daily: DailyQuestBoardState;
  readonly streak: VictoryStreakState;
}

export interface VictoryDailyEvent {
  readonly type: "victory";
  readonly needleId: NeedleSkinId;
  readonly roomId: RoomId;
  readonly monsterId: string;
  readonly isBoss?: boolean;
  readonly isMiniBoss?: boolean;
  readonly perfect?: boolean;
  /** Lets combat report the best accurate chain without a second event call. */
  readonly maxAccurateStreak?: number;
}

export interface AccurateStreakDailyEvent {
  readonly type: "accurate-streak";
  readonly length: number;
}

export interface DefeatDailyEvent {
  readonly type: "defeat";
}

export type DailyGameplayEvent =
  | VictoryDailyEvent
  | AccurateStreakDailyEvent
  | DefeatDailyEvent;

export interface RewardClaimResult {
  readonly state: DailySystemsState;
  readonly reward: RewardBundle | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSafeInteger(value: unknown, fallback = 0, minimum = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.floor(numeric));
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string")));
}

export function getLocalDayKey(date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid calendar date");
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDailyQuestDefinition(id: DailyQuestId): DailyQuestDefinition {
  const definition = QUEST_BY_ID.get(id);
  if (!definition) throw new Error(`Unknown daily quest: ${id}`);
  return definition;
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function normalizedContext(context: DailySelectionContext): Required<DailySelectionContext> {
  return {
    availableNeedleIds:
      context.availableNeedleIds && context.availableNeedleIds.length > 0
        ? Array.from(new Set(context.availableNeedleIds))
        : ["silver"],
    availableRoomIds:
      context.availableRoomIds && context.availableRoomIds.length > 0
        ? Array.from(new Set(context.availableRoomIds))
        : ["attic", "theatre", "machine"],
    availableMonsterIds: Array.from(new Set(context.availableMonsterIds ?? [])),
    includeMainBossQuests: context.includeMainBossQuests !== false,
    includeMiniBossQuests: context.includeMiniBossQuests !== false,
  };
}

function isQuestEligible(
  quest: DailyQuestDefinition,
  context: Required<DailySelectionContext>,
): boolean {
  if (quest.criteria.kind !== "victories") return true;
  const { criteria } = quest;
  if (criteria.needleId && !context.availableNeedleIds.includes(criteria.needleId)) return false;
  if (criteria.roomId && !context.availableRoomIds.includes(criteria.roomId)) return false;
  if (criteria.monsterId && !context.availableMonsterIds.includes(criteria.monsterId)) return false;
  if (criteria.bossKind === "main" && !context.includeMainBossQuests) return false;
  if (criteria.bossKind === "mini" && !context.includeMiniBossQuests) return false;
  if (
    criteria.bossKind === "any" &&
    !context.includeMainBossQuests &&
    !context.includeMiniBossQuests
  ) {
    return false;
  }
  return true;
}

function chooseDailyQuestIds(
  dayKey: string,
  roll: 0 | 1,
  selectionContext: DailySelectionContext,
  excludedIds: readonly DailyQuestId[] = [],
): DailyQuestId[] {
  const context = normalizedContext(selectionContext);
  const contextKey = [
    [...context.availableNeedleIds].sort().join(","),
    [...context.availableRoomIds].sort().join(","),
    [...context.availableMonsterIds].sort().join(","),
    String(context.includeMainBossQuests),
    String(context.includeMiniBossQuests),
  ].join("|");
  const random = createRandom(hashString(`${dayKey}|${roll}|${contextKey}`));
  const eligible = DAILY_QUESTS.filter((quest) => isQuestEligible(quest, context));
  const exclusions = new Set(excludedIds);
  const freshPool = eligible.filter((quest) => !exclusions.has(quest.id));
  const primaryPool = freshPool.length >= DAILY_QUEST_COUNT ? freshPool : eligible;
  const ordered = shuffled(primaryPool, random);
  const selected: DailyQuestDefinition[] = [];
  const selectedGroups = new Set<DailyQuestGroup>();

  for (const quest of ordered) {
    if (selectedGroups.has(quest.group)) continue;
    selected.push(quest);
    selectedGroups.add(quest.group);
  }
  for (const quest of ordered) {
    if (selected.some((candidate) => candidate.id === quest.id)) continue;
    selected.push(quest);
  }

  if (selected.length < DAILY_QUEST_COUNT) {
    throw new Error("Daily quest pool must contain at least three eligible quests");
  }
  return selected.slice(0, DAILY_QUEST_COUNT).map((quest) => quest.id);
}

function createBoard(
  dayKey: string,
  roll: 0 | 1,
  context: DailySelectionContext,
  refreshUsed = false,
  excludedIds: readonly DailyQuestId[] = [],
): DailyQuestBoardState {
  return {
    dayKey,
    roll,
    refreshUsed,
    quests: chooseDailyQuestIds(dayKey, roll, context, excludedIds).map((id) => ({
      id,
      progress: 0,
      claimed: false,
    })),
  };
}

function createStreakState(): VictoryStreakState {
  return {
    run: 1,
    current: 0,
    best: 0,
    pendingChests: [],
    claimedChestIds: [],
  };
}

export function createDailySystemsState(
  date = new Date(),
  context: DailySelectionContext = {},
): DailySystemsState {
  return {
    version: DAILY_SYSTEMS_VERSION,
    daily: createBoard(getLocalDayKey(date), 0, context),
    streak: createStreakState(),
  };
}

function normalizeBoard(
  value: unknown,
  dayKey: string,
  context: DailySelectionContext,
): DailyQuestBoardState {
  if (!isRecord(value) || value.dayKey !== dayKey) return createBoard(dayKey, 0, context);
  const roll = value.roll === 1 ? 1 : 0;
  const refreshUsed = value.refreshUsed === true || roll === 1;
  const rawQuests = Array.isArray(value.quests) ? value.quests : [];
  const seen = new Set<DailyQuestId>();
  const quests: DailyQuestProgress[] = [];

  for (const rawQuest of rawQuests) {
    if (!isRecord(rawQuest) || !DAILY_QUEST_IDS.includes(rawQuest.id as DailyQuestId)) continue;
    const id = rawQuest.id as DailyQuestId;
    if (seen.has(id)) continue;
    seen.add(id);
    const target = getDailyQuestDefinition(id).criteria.target;
    const progress = Math.min(target, toSafeInteger(rawQuest.progress));
    quests.push({ id, progress, claimed: rawQuest.claimed === true && progress >= target });
  }

  if (quests.length !== DAILY_QUEST_COUNT) {
    return createBoard(dayKey, roll, context, refreshUsed);
  }
  return { dayKey, roll, refreshUsed, quests };
}

function createChest(run: number, milestone: number): StreakChest {
  return {
    id: `streak-${run}-${milestone}`,
    run,
    milestone,
    tier: milestone % 10 === 0 ? "grand" : "regular",
    reward: getStreakChestReward(milestone),
  };
}

function normalizeStreak(value: unknown): VictoryStreakState {
  if (!isRecord(value)) return createStreakState();
  const run = toSafeInteger(value.run, 1, 1);
  const current = toSafeInteger(value.current);
  const best = Math.max(current, toSafeInteger(value.best));
  const claimedChestIds = uniqueStrings(value.claimedChestIds).slice(-200);
  const claimedSet = new Set(claimedChestIds);
  const pendingChests: StreakChest[] = [];
  const pendingIds = new Set<string>();

  if (Array.isArray(value.pendingChests)) {
    for (const rawChest of value.pendingChests) {
      if (!isRecord(rawChest)) continue;
      const chestRun = toSafeInteger(rawChest.run, 0, 1);
      const milestone = toSafeInteger(rawChest.milestone);
      if (milestone < 5 || milestone % 5 !== 0) continue;
      const chest = createChest(chestRun, milestone);
      if (claimedSet.has(chest.id) || pendingIds.has(chest.id)) continue;
      pendingIds.add(chest.id);
      pendingChests.push(chest);
    }
  }

  return { run, current, best, pendingChests, claimedChestIds };
}

/** Repairs JSON-loaded data and advances the daily board at local midnight. */
export function normalizeDailySystemsState(
  value: unknown,
  date = new Date(),
  context: DailySelectionContext = {},
): DailySystemsState {
  const record = isRecord(value) ? value : {};
  const dayKey = getLocalDayKey(date);
  return {
    version: DAILY_SYSTEMS_VERSION,
    daily: normalizeBoard(record.daily, dayKey, context),
    streak: normalizeStreak(record.streak),
  };
}

export function canRefreshDailyQuests(state: DailySystemsState): boolean {
  return !state.daily.refreshUsed && !state.daily.quests.some((quest) => quest.claimed);
}

export function refreshDailyQuests(
  state: DailySystemsState,
  date = new Date(),
  context: DailySelectionContext = {},
): DailySystemsState {
  const normalized = normalizeDailySystemsState(state, date, context);
  if (!canRefreshDailyQuests(normalized)) return normalized;
  return {
    ...normalized,
    daily: createBoard(
      normalized.daily.dayKey,
      1,
      context,
      true,
      normalized.daily.quests.map((quest) => quest.id),
    ),
  };
}

function victoryMatches(criteria: Extract<DailyQuestCriteria, { kind: "victories" }>, event: VictoryDailyEvent): boolean {
  if (criteria.needleId && event.needleId !== criteria.needleId) return false;
  if (criteria.roomId && event.roomId !== criteria.roomId) return false;
  if (criteria.monsterId && event.monsterId !== criteria.monsterId) return false;
  if (criteria.perfectOnly && event.perfect !== true) return false;
  if (criteria.bossKind === "main" && event.isBoss !== true) return false;
  if (criteria.bossKind === "mini" && event.isMiniBoss !== true) return false;
  if (criteria.bossKind === "any" && event.isBoss !== true && event.isMiniBoss !== true) return false;
  return true;
}

function updateQuestProgress(
  quest: DailyQuestProgress,
  event: DailyGameplayEvent,
): DailyQuestProgress {
  if (quest.claimed) return quest;
  const definition = getDailyQuestDefinition(quest.id);
  const { criteria } = definition;
  let nextProgress = quest.progress;

  if (criteria.kind === "accurate-streak") {
    if (event.type === "accurate-streak") nextProgress = Math.max(nextProgress, event.length);
    if (event.type === "victory" && event.maxAccurateStreak !== undefined) {
      nextProgress = Math.max(nextProgress, event.maxAccurateStreak);
    }
  } else if (event.type === "victory" && victoryMatches(criteria, event)) {
    nextProgress += 1;
  }

  nextProgress = Math.min(criteria.target, toSafeInteger(nextProgress));
  return nextProgress === quest.progress ? quest : { ...quest, progress: nextProgress };
}

export function getStreakChestReward(milestone: number): RewardBundle {
  const normalizedMilestone = Math.max(5, Math.floor(milestone / 5) * 5);
  if (normalizedMilestone % 10 === 0) {
    const grandNumber = normalizedMilestone / 10;
    return {
      thread: 6 + grandNumber * 2 + 5 * (2 + Math.floor(grandNumber / 3)),
    };
  }
  return {
    thread: 3 + Math.floor(normalizedMilestone / 15) + 5 * (1 + Math.floor(normalizedMilestone / 25)),
  };
}

function updateVictoryStreak(
  streak: VictoryStreakState,
  event: DailyGameplayEvent,
): VictoryStreakState {
  if (event.type === "defeat") {
    if (streak.current === 0) return streak;
    return { ...streak, run: streak.run + 1, current: 0 };
  }
  if (event.type !== "victory") return streak;

  const current = streak.current + 1;
  const best = Math.max(streak.best, current);
  if (current % 5 !== 0) return { ...streak, current, best };
  const chest = createChest(streak.run, current);
  const alreadyKnown =
    streak.pendingChests.some((candidate) => candidate.id === chest.id) ||
    streak.claimedChestIds.includes(chest.id);
  return {
    ...streak,
    current,
    best,
    pendingChests: alreadyKnown ? streak.pendingChests : [...streak.pendingChests, chest],
  };
}

/** Applies one gameplay event to both today's quests and the persistent victory streak. */
export function recordDailyGameplayEvent(
  state: DailySystemsState,
  event: DailyGameplayEvent,
  date = new Date(),
  context: DailySelectionContext = {},
): DailySystemsState {
  const normalized = normalizeDailySystemsState(state, date, context);
  return {
    ...normalized,
    daily: {
      ...normalized.daily,
      quests: normalized.daily.quests.map((quest) => updateQuestProgress(quest, event)),
    },
    streak: updateVictoryStreak(normalized.streak, event),
  };
}

export function claimDailyQuest(
  state: DailySystemsState,
  questId: DailyQuestId,
  date = new Date(),
  context: DailySelectionContext = {},
): RewardClaimResult {
  const normalized = normalizeDailySystemsState(state, date, context);
  const quest = normalized.daily.quests.find((candidate) => candidate.id === questId);
  if (!quest || quest.claimed) return { state: normalized, reward: null };
  const definition = getDailyQuestDefinition(quest.id);
  if (quest.progress < definition.criteria.target) return { state: normalized, reward: null };
  return {
    state: {
      ...normalized,
      daily: {
        ...normalized.daily,
        quests: normalized.daily.quests.map((candidate) =>
          candidate.id === questId ? { ...candidate, claimed: true } : candidate,
        ),
      },
    },
    reward: { ...definition.reward },
  };
}

export function claimStreakChest(
  state: DailySystemsState,
  chestId: string,
  date = new Date(),
  context: DailySelectionContext = {},
): RewardClaimResult {
  const normalized = normalizeDailySystemsState(state, date, context);
  const chest = normalized.streak.pendingChests.find((candidate) => candidate.id === chestId);
  if (!chest) return { state: normalized, reward: null };
  return {
    state: {
      ...normalized,
      streak: {
        ...normalized.streak,
        pendingChests: normalized.streak.pendingChests.filter(
          (candidate) => candidate.id !== chestId,
        ),
        claimedChestIds: [...normalized.streak.claimedChestIds, chestId].slice(-200),
      },
    },
    reward: { ...chest.reward },
  };
}
