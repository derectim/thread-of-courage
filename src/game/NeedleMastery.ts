import { NEEDLE_SKIN_IDS, type NeedleSkinId } from "./meta";

export const NEEDLE_MASTERY_VERSION = 1 as const;
export const MAX_NEEDLE_MASTERY_LEVEL = 10 as const;
export const NEEDLE_MASTERY_HIT_XP = 1 as const;

/** Cumulative XP required for mastery levels 1 through 10. */
export const NEEDLE_MASTERY_LEVEL_THRESHOLDS = [
  0, 12, 30, 55, 90, 135, 190, 255, 330, 420,
] as const;

export type NeedleMasteryVictoryKind = "regular" | "mini-boss" | "boss";
export type NeedleMasteryRewardKind =
  | "trail"
  | "impact"
  | "badge"
  | "aura"
  | "title";

export interface NeedleMasteryReward {
  readonly id: string;
  readonly needleId: NeedleSkinId;
  readonly requiredLevel: 2 | 4 | 6 | 8 | 10;
  readonly kind: NeedleMasteryRewardKind;
  readonly name: string;
  readonly description: string;
  readonly cosmeticOnly: true;
}

export interface NeedleMasteryProgress {
  readonly xp: number;
}

export interface NeedleMasteryState {
  readonly version: typeof NEEDLE_MASTERY_VERSION;
  readonly byNeedle: Readonly<Record<NeedleSkinId, NeedleMasteryProgress>>;
}

export interface NeedleMasterySummary {
  readonly needleId: NeedleSkinId;
  readonly level: number;
  readonly xp: number;
  readonly currentLevelXp: number;
  readonly nextLevelXp: number | null;
  readonly unlockedRewards: readonly NeedleMasteryReward[];
}

const VICTORY_XP: Readonly<Record<NeedleMasteryVictoryKind, number>> = {
  regular: 6,
  "mini-boss": 10,
  boss: 14,
};

type RewardCopy = readonly [
  NeedleMasteryRewardKind,
  string,
  string,
];

const REWARD_COPY: Readonly<Record<NeedleSkinId, readonly RewardCopy[]>> = {
  silver: [
    ["trail", "След серебряной нити", "Тонкая светлая строчка следует за иглой."],
    ["impact", "Лунные искры", "Точное попадание рассыпает серебряные искры."],
    ["badge", "Знак верной руки", "Нашивка мастера Серебряной иглы."],
    ["aura", "Холодное сияние", "Иглу окружает мягкий лунный ореол."],
    ["title", "Титул «Серебряная швея»", "Редкий косметический титул профиля."],
  ],
  bone: [
    ["trail", "След костяной пыли", "За остриём тянутся тёплые резные крупинки."],
    ["impact", "Рунический скол", "Попадание оставляет вспышку древнего узора."],
    ["badge", "Знак старого ремесла", "Нашивка мастера Костяного шипа."],
    ["aura", "Янтарный оберег", "Вокруг иглы мерцает янтарная вязь."],
    ["title", "Титул «Хранительница кости»", "Редкий косметический титул профиля."],
  ],
  storm: [
    ["trail", "Грозовая строчка", "За челноком вспыхивает бирюзовая молния."],
    ["impact", "Щелчок грома", "Попадание раскрывается электрическим узелком."],
    ["badge", "Знак укротителя бури", "Нашивка мастера Грозового челнока."],
    ["aura", "Око грозы", "Вокруг челнока кружит безвредное свечение."],
    ["title", "Титул «Повелительница грозы»", "Редкий косметический титул профиля."],
  ],
  sunrise: [
    ["trail", "Золотой рассвет", "За иглой остаётся тёплая солнечная нить."],
    ["impact", "Лепестки зари", "Попадание расцветает золотыми лоскутами."],
    ["badge", "Знак первого луча", "Нашивка мастера Иглы рассвета."],
    ["aura", "Утренняя корона", "Иглу окружает мягкий венец света."],
    ["title", "Титул «Несущая рассвет»", "Редкий косметический титул профиля."],
  ],
  moonweave: [
    ["trail", "След лунного шёлка", "За спицей тянется холодная серебряная нить."],
    ["impact", "Лунный прилив", "Попадание раскрывает мягкую волну голубого света."],
    ["badge", "Знак лунной спицы", "Нашивка мастера Лунной спицы."],
    ["aura", "Ореол полумесяца", "Иглу окружает тонкий защитный лунный круг."],
    ["title", "Титул «Хранительница луны»", "Редкий косметический титул профиля."],
  ],
  "velvet-thorn": [
    ["trail", "Бархатная строчка", "За остриём остаётся тёмно-малиновая нить."],
    ["impact", "Роза шипов", "Попадание расцветает лепестками и золотыми шипами."],
    ["badge", "Знак тихого шипа", "Нашивка мастера Бархатного острия."],
    ["aura", "Винный бархат", "Вокруг иглы колышется густое мягкое сияние."],
    ["title", "Титул «Бархатная мастерица»", "Редкий косметический титул профиля."],
  ],
  clockwork: [
    ["trail", "Заводная нить", "За иглой щёлкают бирюзовые часовые искры."],
    ["impact", "Латунный бой", "Попадание разбрасывает шестерёнки и искры."],
    ["badge", "Знак точного хода", "Нашивка мастера Часовой иглы."],
    ["aura", "Заводная орбита", "Вокруг иглы вращается маленькое латунное кольцо."],
    ["title", "Титул «Хозяйка времени»", "Редкий косметический титул профиля."],
  ],
  "royal-seam": [
    ["trail", "Королевская вязь", "За иглой тянется пурпурно-золотая строчка."],
    ["impact", "Аметистовая корона", "Попадание вспыхивает гранёным королевским узором."],
    ["badge", "Знак высшего стежка", "Нашивка мастера Королевского стежка."],
    ["aura", "Дворцовый венец", "Иглу окружает торжественный золотой ореол."],
    ["title", "Титул «Королева узора»", "Редкий косметический титул профиля."],
  ],
};

const REWARD_LEVELS = [2, 4, 6, 8, 10] as const;

export const NEEDLE_MASTERY_REWARDS: readonly NeedleMasteryReward[] =
  NEEDLE_SKIN_IDS.flatMap((needleId) =>
    REWARD_COPY[needleId].map(([kind, name, description], index) => ({
      id: `${needleId}-mastery-${REWARD_LEVELS[index]}`,
      needleId,
      requiredLevel: REWARD_LEVELS[index],
      kind,
      name,
      description,
      cosmeticOnly: true as const,
    })),
  );

function normalizeWholeNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createNeedleProgress(xp = 0): NeedleMasteryProgress {
  return {
    xp: Math.min(
      normalizeWholeNumber(xp),
      NEEDLE_MASTERY_LEVEL_THRESHOLDS[MAX_NEEDLE_MASTERY_LEVEL - 1],
    ),
  };
}

export function createNeedleMasteryState(): NeedleMasteryState {
  return {
    version: NEEDLE_MASTERY_VERSION,
    byNeedle: Object.fromEntries(
      NEEDLE_SKIN_IDS.map((id) => [id, createNeedleProgress()]),
    ) as Record<NeedleSkinId, NeedleMasteryProgress>,
  };
}

/** Safely hydrates mastery from optional/older save data. */
export function normalizeNeedleMasteryState(value: unknown): NeedleMasteryState {
  const record = isRecord(value) ? value : {};
  const byNeedle = isRecord(record.byNeedle) ? record.byNeedle : {};
  const readXp = (id: NeedleSkinId): number => {
    const progress = isRecord(byNeedle[id]) ? byNeedle[id] : {};
    return normalizeWholeNumber(progress.xp);
  };

  return {
    version: NEEDLE_MASTERY_VERSION,
    byNeedle: Object.fromEntries(
      NEEDLE_SKIN_IDS.map((id) => [id, createNeedleProgress(readXp(id))]),
    ) as Record<NeedleSkinId, NeedleMasteryProgress>,
  };
}

export function getNeedleMasteryLevel(xp: number): number {
  const normalizedXp = normalizeWholeNumber(xp);
  let level = 1;
  for (let index = 1; index < NEEDLE_MASTERY_LEVEL_THRESHOLDS.length; index += 1) {
    if (normalizedXp < NEEDLE_MASTERY_LEVEL_THRESHOLDS[index]) break;
    level = index + 1;
  }
  return level;
}

export function getNeedleMasteryRewards(
  needleId: NeedleSkinId,
  level: number,
): readonly NeedleMasteryReward[] {
  const normalizedLevel = Math.min(
    MAX_NEEDLE_MASTERY_LEVEL,
    Math.max(1, Math.floor(level)),
  );
  return NEEDLE_MASTERY_REWARDS.filter(
    (reward) =>
      reward.needleId === needleId && reward.requiredLevel <= normalizedLevel,
  );
}

export function getNeedleMasterySummary(
  state: NeedleMasteryState,
  needleId: NeedleSkinId,
): NeedleMasterySummary {
  const xp = state.byNeedle[needleId]?.xp ?? 0;
  const level = getNeedleMasteryLevel(xp);
  const currentThreshold = NEEDLE_MASTERY_LEVEL_THRESHOLDS[level - 1];
  const nextThreshold = NEEDLE_MASTERY_LEVEL_THRESHOLDS[level] ?? null;
  return {
    needleId,
    level,
    xp,
    currentLevelXp: xp - currentThreshold,
    nextLevelXp:
      nextThreshold === null ? null : nextThreshold - currentThreshold,
    unlockedRewards: getNeedleMasteryRewards(needleId, level),
  };
}

export function addNeedleMasteryXp(
  state: NeedleMasteryState,
  needleId: NeedleSkinId,
  amount: number,
): NeedleMasteryState {
  const addedXp = normalizeWholeNumber(amount);
  if (addedXp === 0) return state;
  const currentXp = state.byNeedle[needleId]?.xp ?? 0;
  const nextProgress = createNeedleProgress(currentXp + addedXp);
  if (nextProgress.xp === currentXp) return state;
  return {
    ...state,
    byNeedle: {
      ...state.byNeedle,
      [needleId]: nextProgress,
    },
  };
}

export function recordNeedleMasteryHit(
  state: NeedleMasteryState,
  needleId: NeedleSkinId,
  successfulHits = 1,
): NeedleMasteryState {
  return addNeedleMasteryXp(
    state,
    needleId,
    normalizeWholeNumber(successfulHits) * NEEDLE_MASTERY_HIT_XP,
  );
}

export function recordNeedleMasteryVictory(
  state: NeedleMasteryState,
  needleId: NeedleSkinId,
  kind: NeedleMasteryVictoryKind = "regular",
): NeedleMasteryState {
  return addNeedleMasteryXp(state, needleId, VICTORY_XP[kind]);
}
