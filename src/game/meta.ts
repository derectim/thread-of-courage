export const NEEDLE_SKIN_IDS = ["silver", "bone", "storm", "sunrise"] as const;
export type NeedleSkinId = (typeof NEEDLE_SKIN_IDS)[number];

export interface CombatModifiers {
  readonly doubleChanceBonus?: number;
  readonly needleGapReduction?: number;
  readonly needleGapPenalty?: number;
  readonly projectileSpeedMultiplier?: number;
  readonly rotationSpeedMultiplier?: number;
  readonly startingWardBonus?: number;
  readonly extraHitEvery?: number;
  readonly firstHitBonus?: number;
}

export interface NeedleSkinDefinition {
  readonly id: NeedleSkinId;
  readonly name: string;
  readonly subtitle: string;
  readonly description: string;
  readonly textureKey: string;
  readonly iconFileName: string;
  readonly threadCost: number;
  readonly shaftColor: number;
  readonly headColor: number;
  readonly tailColor: number;
  readonly modifiers: CombatModifiers;
}

export const NEEDLE_SKINS: readonly NeedleSkinDefinition[] = [
  {
    id: "silver",
    name: "Серебряная игла",
    subtitle: "Надёжный первый стежок",
    description: "Ровная, быстрая и без скрытых условий.",
    textureKey: "needle-silver-v2",
    iconFileName: "needle-silver-v2.webp",
    threadCost: 0,
    shaftColor: 0xf2e3c6,
    headColor: 0xdde8e5,
    tailColor: 0xe56b6f,
    modifiers: {},
  },
  {
    id: "bone",
    name: "Костяной шип",
    subtitle: "Риск ради силы",
    description: "+8% к двойному стежку, но нужен чуть более чистый зазор.",
    textureKey: "needle-bone-v2",
    iconFileName: "needle-bone-v2.webp",
    threadCost: 90,
    shaftColor: 0xf0dfba,
    headColor: 0xfff4d5,
    tailColor: 0x9f7655,
    modifiers: { doubleChanceBonus: 0.08, needleGapPenalty: 0.004 },
  },
  {
    id: "storm",
    name: "Грозовой челнок",
    subtitle: "Каждый пятый удар сильнее",
    description: "Каждый пятый точный стежок наносит ещё одно повреждение.",
    textureKey: "needle-storm-v2",
    iconFileName: "needle-storm-v2.webp",
    threadCost: 240,
    shaftColor: 0x9edfd7,
    headColor: 0x39b7a5,
    tailColor: 0x557dc4,
    modifiers: { extraHitEvery: 5, projectileSpeedMultiplier: 1.08 },
  },
  {
    id: "sunrise",
    name: "Игла рассвета",
    subtitle: "Первый луч пробивает тьму",
    description: "Первое попадание на каждом этапе считается двойным.",
    textureKey: "needle-sunrise-v2",
    iconFileName: "needle-sunrise-v2.webp",
    threadCost: 520,
    shaftColor: 0xffe7a0,
    headColor: 0xe8b44d,
    tailColor: 0xff846f,
    modifiers: { firstHitBonus: 1 },
  },
] as const;

export const SKILL_IDS = ["steady-hand", "time-seam", "guardian-knot"] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export interface SkillDefinition {
  readonly id: SkillId;
  readonly name: string;
  readonly description: string;
  readonly unlockStage: number;
  readonly symbol: string;
  readonly modifiers: CombatModifiers;
}

export const SKILLS: readonly SkillDefinition[] = [
  {
    id: "steady-hand",
    name: "Тихая рука",
    description: "Чуть прощает касания рядом с уже воткнутой иглой.",
    unlockStage: 1,
    symbol: "◎",
    modifiers: { needleGapReduction: 0.008 },
  },
  {
    id: "time-seam",
    name: "Шов времени",
    description: "Все узоры вращаются на 10% медленнее.",
    unlockStage: 10,
    symbol: "◷",
    modifiers: { rotationSpeedMultiplier: 0.9 },
  },
  {
    id: "guardian-knot",
    name: "Узел хранителя",
    description: "Каждый новый рейд начинается с дополнительным оберегом.",
    unlockStage: 20,
    symbol: "◇",
    modifiers: { startingWardBonus: 1 },
  },
] as const;

export const BACKGROUND_IDS = ["auto", "moon-garden", "cloud-library", "star-cathedral"] as const;
export type BackgroundId = (typeof BACKGROUND_IDS)[number];

export interface BackgroundDefinition {
  readonly id: BackgroundId;
  readonly name: string;
  readonly description: string;
  readonly textureKey: string | null;
  readonly fileName: string | null;
  readonly unlockStage: number;
  readonly premiumCost: number;
}

export const BACKGROUNDS: readonly BackgroundDefinition[] = [
  {
    id: "auto",
    name: "Путь по комнатам",
    description: "Фон меняется вместе с комнатой рейда.",
    textureKey: null,
    fileName: null,
    unlockStage: 1,
    premiumCost: 0,
  },
  {
    id: "moon-garden",
    name: "Лунная оранжерея",
    description: "Редкий сад из бархатных листьев и светящихся нитей.",
    textureKey: "background-moon-garden",
    fileName: "background-moon-garden.webp",
    unlockStage: 25,
    premiumCost: 30,
  },
  {
    id: "cloud-library",
    name: "Библиотека облачных выкроек",
    description: "Небесный архив, где узоры хранятся среди облаков.",
    textureKey: "background-cloud-library",
    fileName: "background-cloud-library.webp",
    unlockStage: 50,
    premiumCost: 65,
  },
  {
    id: "star-cathedral",
    name: "Собор звёздной нити",
    description: "Почти недостижимая мастерская за пределами обычного похода.",
    textureKey: "background-star-cathedral",
    fileName: "background-star-cathedral.webp",
    unlockStage: 100,
    premiumCost: 120,
  },
] as const;

export const QUEST_IDS = [
  "first-fifty",
  "nightmare-hunter",
  "boss-breaker",
  "tenth-stitch",
  "needle-collector",
] as const;
export type QuestId = (typeof QUEST_IDS)[number];
export type StatId = "needlesThrown" | "monstersDefeated" | "bossesDefeated";

export interface QuestDefinition {
  readonly id: QuestId;
  readonly name: string;
  readonly description: string;
  readonly metric: StatId | "highestStageCleared" | "ownedNeedles";
  readonly target: number;
  readonly rewardThread: number;
  readonly rewardPremium: number;
}

export const QUESTS: readonly QuestDefinition[] = [
  {
    id: "first-fifty",
    name: "Ровная рука",
    description: "Выпустить 50 игл",
    metric: "needlesThrown",
    target: 50,
    rewardThread: 18,
    rewardPremium: 0,
  },
  {
    id: "nightmare-hunter",
    name: "Охотница за кошмарами",
    description: "Победить 20 монстров",
    metric: "monstersDefeated",
    target: 20,
    rewardThread: 30,
    rewardPremium: 0,
  },
  {
    id: "boss-breaker",
    name: "Распарыватель легенд",
    description: "Победить 4 боссов",
    metric: "bossesDefeated",
    target: 4,
    rewardThread: 0,
    rewardPremium: 3,
  },
  {
    id: "tenth-stitch",
    name: "Десятая ступень",
    description: "Очистить этап 10",
    metric: "highestStageCleared",
    target: 10,
    rewardThread: 40,
    rewardPremium: 0,
  },
  {
    id: "needle-collector",
    name: "Коллекционер остриёв",
    description: "Открыть 2 вида игл",
    metric: "ownedNeedles",
    target: 2,
    rewardThread: 0,
    rewardPremium: 2,
  },
] as const;

export function getNeedleSkin(id: NeedleSkinId): NeedleSkinDefinition {
  return NEEDLE_SKINS.find((skin) => skin.id === id) ?? NEEDLE_SKINS[0];
}

export function getSkill(id: SkillId): SkillDefinition {
  return SKILLS.find((skill) => skill.id === id) ?? SKILLS[0];
}

export function getBackground(id: BackgroundId): BackgroundDefinition {
  return BACKGROUNDS.find((background) => background.id === id) ?? BACKGROUNDS[0];
}
