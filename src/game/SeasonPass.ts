export const SEASON_PASS_VERSION = 1 as const;
export const SEASON_PASS_TIER_COUNT = 20 as const;
export const SEASON_PASS_XP_PER_TIER = 100 as const;
export const CURRENT_SEASON_ID = "living-thread-01" as const;

export type SeasonPassTrack = "free" | "premium";
export type SeasonCosmeticKind =
  | "profile-badge"
  | "profile-title"
  | "avatar-frame"
  | "needle-trail"
  | "hit-flourish"
  | "menu-ornament";

export interface SeasonCosmeticReward {
  readonly id: string;
  readonly kind: SeasonCosmeticKind;
  readonly name: string;
  readonly description: string;
  readonly cosmeticOnly: true;
}

export interface SeasonPassTierDefinition {
  readonly tier: number;
  readonly requiredXp: number;
  readonly freeReward: SeasonCosmeticReward;
  readonly premiumReward: SeasonCosmeticReward;
}

export type SeasonPassMetric =
  | "successfulHits"
  | "stagesCompleted"
  | "bossesDefeated"
  | "dailyTasksCompleted"
  | "weeklyNodesCompleted";

export const SEASON_TASK_IDS = [
  "first-pattern",
  "steady-road",
  "boss-thread",
  "daily-habit",
  "weekly-wanderer",
  "golden-rhythm",
] as const;
export type SeasonTaskId = (typeof SEASON_TASK_IDS)[number];

export interface SeasonTaskDefinition {
  readonly id: SeasonTaskId;
  readonly name: string;
  readonly description: string;
  readonly metric: SeasonPassMetric;
  readonly target: number;
  readonly xpReward: number;
}

export type SeasonPassEvent =
  | "successful-hit"
  | "stage-victory"
  | "boss-victory"
  | "daily-task-completed"
  | "weekly-node-completed";

export interface SeasonPassState {
  readonly version: typeof SEASON_PASS_VERSION;
  readonly seasonId: string;
  readonly xp: number;
  /** Prototype access only. It is deliberately unrelated to money or store APIs. */
  readonly prototypePremiumEnabled: boolean;
  readonly claimedFreeTiers: readonly number[];
  readonly claimedPremiumTiers: readonly number[];
  readonly taskProgress: Readonly<Record<SeasonTaskId, number>>;
  readonly completedTaskIds: readonly SeasonTaskId[];
}

export interface SeasonPassStatus {
  readonly unlockedTier: number;
  readonly xp: number;
  readonly xpIntoTier: number;
  readonly xpForNextTier: number | null;
  readonly completedTasks: number;
}

export interface SeasonPassClaimResult {
  readonly state: SeasonPassState;
  readonly reward: SeasonCosmeticReward | null;
}

type CosmeticCopy = readonly [SeasonCosmeticKind, string, string];

const FREE_REWARDS: readonly CosmeticCopy[] = [
  ["profile-badge", "Нашивка «Первый стежок»", "Знак начала сезона Живой нити."],
  ["profile-title", "Титул «Ученица мастерской»", "Косметическая подпись профиля."],
  ["hit-flourish", "Хлопок шерстинок", "Мягкий визуальный эффект точного попадания."],
  ["profile-badge", "Нашивка медной пуговицы", "Коллекционный знак четвёртой ступени."],
  ["avatar-frame", "Рамка «Синяя строчка»", "Прошитая рамка портрета."],
  ["menu-ornament", "Подвеска маленькой катушки", "Украшение главного меню."],
  ["needle-trail", "След белой пряжи", "Безвредный светлый след иглы."],
  ["profile-badge", "Знак лоскутного пути", "Коллекционная сезонная нашивка."],
  ["profile-title", "Титул «Собирательница узоров»", "Косметическая подпись профиля."],
  ["avatar-frame", "Рамка «Тёплый войлок»", "Мягкая войлочная рамка портрета."],
  ["hit-flourish", "Пуговичная искра", "Попадание вспыхивает маленькой пуговицей."],
  ["menu-ornament", "Ножницы подмастерья", "Украшение главного меню."],
  ["profile-badge", "Знак тринадцатой петли", "Коллекционная сезонная нашивка."],
  ["needle-trail", "След сумеречной нити", "Фиолетовый декоративный след иглы."],
  ["profile-title", "Титул «Верная рука»", "Косметическая подпись профиля."],
  ["avatar-frame", "Рамка «Катушечный венок»", "Рамка из миниатюрных катушек."],
  ["hit-flourish", "Золотой узелок", "Короткая золотая вспышка попадания."],
  ["profile-badge", "Нашивка мастера пути", "Коллекционный знак восемнадцатой ступени."],
  ["menu-ornament", "Лунная выкройка", "Редкое украшение главного меню."],
  ["profile-title", "Титул «Хранительница живой нити»", "Главный бесплатный титул сезона."],
] as const;

const PREMIUM_REWARDS: readonly CosmeticCopy[] = [
  ["avatar-frame", "Рамка «Золотое ушко»", "Премиальная косметическая рамка портрета."],
  ["needle-trail", "След звёздной нити", "Игристый декоративный след иглы."],
  ["profile-badge", "Герб ночной мастерской", "Премиальная сезонная нашивка."],
  ["hit-flourish", "Вспышка шёлковых звёзд", "Шёлковые звёзды при попадании."],
  ["profile-title", "Титул «Лунная лоскутница»", "Премиальная подпись профиля."],
  ["menu-ornament", "Золотой челнок", "Премиальное украшение главного меню."],
  ["avatar-frame", "Рамка «Театр нитей»", "Театральная рамка с золотым шнуром."],
  ["needle-trail", "След малиновой кометы", "Яркий декоративный след иглы."],
  ["profile-badge", "Герб филина-портного", "Премиальная сезонная нашивка."],
  ["hit-flourish", "Рассыпанные самоцветы", "Самоцветная вспышка точного попадания."],
  ["profile-title", "Титул «Повелительница лекал»", "Премиальная подпись профиля."],
  ["menu-ornament", "Часы великой швеи", "Премиальное украшение главного меню."],
  ["avatar-frame", "Рамка «Механическое кружево»", "Латунная кружевная рамка портрета."],
  ["needle-trail", "След северного сияния", "Переливающийся декоративный след иглы."],
  ["profile-badge", "Герб швейной бури", "Премиальная сезонная нашивка."],
  ["hit-flourish", "Корона из стежков", "Попадание на миг раскрывает золотую корону."],
  ["profile-title", "Титул «Голос мастерской»", "Премиальная подпись профиля."],
  ["menu-ornament", "Сердце золотой машины", "Премиальное украшение главного меню."],
  ["avatar-frame", "Рамка «Живая нить»", "Анимированная на вид рамка из светлой пряжи."],
  ["profile-title", "Титул «Легенда лоскутного мира»", "Главный премиальный титул сезона."],
] as const;

function makeReward(
  track: SeasonPassTrack,
  tier: number,
  copy: CosmeticCopy,
): SeasonCosmeticReward {
  return {
    id: `${CURRENT_SEASON_ID}-${track}-${tier}`,
    kind: copy[0],
    name: copy[1],
    description: copy[2],
    cosmeticOnly: true,
  };
}

export const SEASON_PASS_TIERS: readonly SeasonPassTierDefinition[] =
  Array.from({ length: SEASON_PASS_TIER_COUNT }, (_, index) => {
    const tier = index + 1;
    return {
      tier,
      requiredXp: tier * SEASON_PASS_XP_PER_TIER,
      freeReward: makeReward("free", tier, FREE_REWARDS[index]),
      premiumReward: makeReward("premium", tier, PREMIUM_REWARDS[index]),
    };
  });

export const SEASON_TASKS: readonly SeasonTaskDefinition[] = [
  {
    id: "first-pattern",
    name: "Разбудить узор",
    description: "Сделать 75 успешных попаданий.",
    metric: "successfulHits",
    target: 75,
    xpReward: 80,
  },
  {
    id: "steady-road",
    name: "Длинная строчка",
    description: "Завершить 20 этапов.",
    metric: "stagesCompleted",
    target: 20,
    xpReward: 120,
  },
  {
    id: "boss-thread",
    name: "Нить против великанов",
    description: "Победить 6 главных боссов.",
    metric: "bossesDefeated",
    target: 6,
    xpReward: 180,
  },
  {
    id: "daily-habit",
    name: "Ритуал мастерской",
    description: "Выполнить 10 ежедневных поручений.",
    metric: "dailyTasksCompleted",
    target: 10,
    xpReward: 160,
  },
  {
    id: "weekly-wanderer",
    name: "По недельной выкройке",
    description: "Пройти 10 узлов недельного маршрута.",
    metric: "weeklyNodesCompleted",
    target: 10,
    xpReward: 160,
  },
  {
    id: "golden-rhythm",
    name: "Золотой ритм",
    description: "Сделать 300 успешных попаданий.",
    metric: "successfulHits",
    target: 300,
    xpReward: 220,
  },
] as const;

const EVENT_XP: Readonly<Record<SeasonPassEvent, number>> = {
  "successful-hit": 0,
  "stage-victory": 12,
  "boss-victory": 18,
  "daily-task-completed": 45,
  "weekly-node-completed": 20,
};

const EVENT_METRIC: Readonly<Record<SeasonPassEvent, SeasonPassMetric>> = {
  "successful-hit": "successfulHits",
  "stage-victory": "stagesCompleted",
  "boss-victory": "bossesDefeated",
  "daily-task-completed": "dailyTasksCompleted",
  "weekly-node-completed": "weeklyNodesCompleted",
};

const MAX_PASS_XP = SEASON_PASS_TIER_COUNT * SEASON_PASS_XP_PER_TIER;

function normalizeCount(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(maximum, Math.max(0, Math.floor(numeric)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTierList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((tier) => normalizeCount(tier))
        .filter((tier) => tier >= 1 && tier <= SEASON_PASS_TIER_COUNT),
    ),
  ).sort((left, right) => left - right);
}

function normalizeCompletedTasks(value: unknown): SeasonTaskId[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (id): id is SeasonTaskId =>
          typeof id === "string" && SEASON_TASK_IDS.includes(id as SeasonTaskId),
      ),
    ),
  );
}

function createTaskProgress(): Record<SeasonTaskId, number> {
  return {
    "first-pattern": 0,
    "steady-road": 0,
    "boss-thread": 0,
    "daily-habit": 0,
    "weekly-wanderer": 0,
    "golden-rhythm": 0,
  };
}

export function createSeasonPassState(
  seasonId: string = CURRENT_SEASON_ID,
): SeasonPassState {
  return {
    version: SEASON_PASS_VERSION,
    seasonId,
    xp: 0,
    prototypePremiumEnabled: false,
    claimedFreeTiers: [],
    claimedPremiumTiers: [],
    taskProgress: createTaskProgress(),
    completedTaskIds: [],
  };
}

/** Resets on a new season and safely hydrates a current-season save. */
export function syncSeasonPassState(
  value: unknown,
  seasonId: string = CURRENT_SEASON_ID,
): SeasonPassState {
  if (!isRecord(value) || value.seasonId !== seasonId) {
    return createSeasonPassState(seasonId);
  }
  const rawTaskProgress = isRecord(value.taskProgress) ? value.taskProgress : {};
  const taskProgress = createTaskProgress();
  for (const task of SEASON_TASKS) {
    taskProgress[task.id] = normalizeCount(rawTaskProgress[task.id], task.target);
  }
  const completedTaskIds = normalizeCompletedTasks(value.completedTaskIds).filter(
    (id) => taskProgress[id] >= (SEASON_TASKS.find((task) => task.id === id)?.target ?? Infinity),
  );

  return {
    version: SEASON_PASS_VERSION,
    seasonId,
    xp: normalizeCount(value.xp, MAX_PASS_XP),
    prototypePremiumEnabled: value.prototypePremiumEnabled === true,
    claimedFreeTiers: normalizeTierList(value.claimedFreeTiers),
    claimedPremiumTiers: normalizeTierList(value.claimedPremiumTiers),
    taskProgress,
    completedTaskIds,
  };
}

export function getUnlockedSeasonPassTier(xp: number): number {
  return Math.min(
    SEASON_PASS_TIER_COUNT,
    Math.floor(normalizeCount(xp, MAX_PASS_XP) / SEASON_PASS_XP_PER_TIER),
  );
}

export function getSeasonPassStatus(state: SeasonPassState): SeasonPassStatus {
  const xp = normalizeCount(state.xp, MAX_PASS_XP);
  const unlockedTier = getUnlockedSeasonPassTier(xp);
  return {
    unlockedTier,
    xp,
    xpIntoTier:
      unlockedTier >= SEASON_PASS_TIER_COUNT
        ? SEASON_PASS_XP_PER_TIER
        : xp % SEASON_PASS_XP_PER_TIER,
    xpForNextTier:
      unlockedTier >= SEASON_PASS_TIER_COUNT
        ? null
        : SEASON_PASS_XP_PER_TIER,
    completedTasks: state.completedTaskIds.length,
  };
}

export function addSeasonPassXp(
  state: SeasonPassState,
  amount: number,
): SeasonPassState {
  const addedXp = normalizeCount(amount);
  if (addedXp === 0 || state.xp >= MAX_PASS_XP) return state;
  return { ...state, xp: Math.min(MAX_PASS_XP, state.xp + addedXp) };
}

/**
 * Records one game-side event, accumulates every matching task and automatically
 * grants each completed task's XP once. Boss victories are additive to stage victories.
 */
export function recordSeasonPassEvent(
  state: SeasonPassState,
  event: SeasonPassEvent,
  quantity = 1,
): SeasonPassState {
  const count = normalizeCount(quantity);
  if (count === 0) return state;
  let next = addSeasonPassXp(state, EVENT_XP[event] * count);
  const metric = EVENT_METRIC[event];
  let earnedTaskXp = 0;
  const completedTaskIds = [...next.completedTaskIds];
  const taskProgress = { ...next.taskProgress };

  for (const task of SEASON_TASKS) {
    if (task.metric !== metric) continue;
    const previous = taskProgress[task.id] ?? 0;
    const current = Math.min(task.target, previous + count);
    taskProgress[task.id] = current;
    if (current >= task.target && !completedTaskIds.includes(task.id)) {
      completedTaskIds.push(task.id);
      earnedTaskXp += task.xpReward;
    }
  }

  next = { ...next, taskProgress, completedTaskIds };
  return addSeasonPassXp(next, earnedTaskXp);
}

/** Prototype switch only: there is intentionally no purchase or real-money API. */
export function setPrototypePremiumAccess(
  state: SeasonPassState,
  enabled: boolean,
): SeasonPassState {
  if (state.prototypePremiumEnabled === enabled) return state;
  return { ...state, prototypePremiumEnabled: enabled };
}

export function claimSeasonPassReward(
  state: SeasonPassState,
  tier: number,
  track: SeasonPassTrack,
): SeasonPassClaimResult {
  const normalizedTier = normalizeCount(tier, SEASON_PASS_TIER_COUNT);
  const definition = SEASON_PASS_TIERS[normalizedTier - 1];
  if (!definition || getUnlockedSeasonPassTier(state.xp) < normalizedTier) {
    return { state, reward: null };
  }
  if (track === "premium" && !state.prototypePremiumEnabled) {
    return { state, reward: null };
  }
  const field = track === "free" ? "claimedFreeTiers" : "claimedPremiumTiers";
  if (state[field].includes(normalizedTier)) return { state, reward: null };
  return {
    state: { ...state, [field]: [...state[field], normalizedTier] },
    reward: track === "free" ? definition.freeReward : definition.premiumReward,
  };
}
