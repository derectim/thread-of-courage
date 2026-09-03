export type MovementPattern = "carousel" | "pendulum" | "stitches" | "recoil";

export type RoomId = "attic" | "theatre" | "machine";

export interface RoomDefinition {
  readonly id: RoomId;
  readonly name: string;
  readonly subtitle: string;
  readonly backgroundKey: string;
  readonly accentColor: number;
}

export interface BossTuning {
  readonly speedMultiplier: number;
  readonly phaseTwoAt: number;
  readonly phaseTwoPattern: MovementPattern;
}

export interface MonsterDefinition {
  readonly id: string;
  readonly name: string;
  readonly epithet: string;
  readonly roomId: RoomId;
  readonly pattern: MovementPattern;
  readonly baseHits: number;
  readonly bodyColor: number;
  readonly accentColor: number;
  readonly shadowColor: number;
  readonly isBoss?: boolean;
  readonly isMiniBoss?: boolean;
  readonly bossTuning?: BossTuning;
  readonly textureKeys?: readonly string[];
}

export const ROOMS: readonly RoomDefinition[] = [
  {
    id: "attic",
    name: "Чердачная мастерская",
    subtitle: "Ожившие выкройки",
    backgroundKey: "room-attic",
    accentColor: 0xe8b44d,
  },
  {
    id: "theatre",
    name: "Театр забытых кукол",
    subtitle: "Сцена лунных нитей",
    backgroundKey: "room-theatre",
    accentColor: 0x8a5578,
  },
  {
    id: "machine",
    name: "Сердце швейной машины",
    subtitle: "Механизм чёрной пряжи",
    backgroundKey: "room-machine",
    accentColor: 0x39b7a5,
  },
] as const;

export const MONSTERS: readonly MonsterDefinition[] = [
  {
    id: "grumble-yarn",
    name: "Клубок-Ворчун",
    epithet: "путает добрые мысли",
    roomId: "attic",
    pattern: "carousel",
    baseHits: 7,
    bodyColor: 0x6b4a6f,
    accentColor: 0xe8b44d,
    shadowColor: 0x3f304b,
    textureKeys: [
      "grumble-yarn-0",
      "grumble-yarn-1",
      "grumble-yarn-2",
      "grumble-yarn-3",
    ],
  },
  {
    id: "button-bug",
    name: "Пуговичный Жук",
    epithet: "грызёт старые истории",
    roomId: "attic",
    pattern: "pendulum",
    baseHits: 8,
    bodyColor: 0x5b8c85,
    accentColor: 0xf2e3c6,
    shadowColor: 0x315f5b,
    textureKeys: [
      "button-bug-0",
      "button-bug-1",
      "button-bug-2",
      "button-bug-3",
    ],
  },
  {
    id: "spool-spider",
    name: "Катушечный Паук",
    epithet: "стягивает путь липкой пряжей",
    roomId: "attic",
    pattern: "stitches",
    baseHits: 10,
    bodyColor: 0x4b275f,
    accentColor: 0xe8b44d,
    shadowColor: 0x241837,
    isMiniBoss: true,
    textureKeys: [
      "miniboss-spool-spider-0",
      "miniboss-spool-spider-1",
      "miniboss-spool-spider-2",
      "miniboss-spool-spider-3",
    ],
  },
  {
    id: "sewing-storm",
    name: "Великая Швейная Буря",
    epithet: "прячет сердце под лоскутами",
    roomId: "attic",
    pattern: "recoil",
    baseHits: 13,
    bodyColor: 0x6b4a6f,
    accentColor: 0xe8b44d,
    shadowColor: 0x3f304b,
    isBoss: true,
    bossTuning: {
      speedMultiplier: 1.06,
      phaseTwoAt: 0.5,
      phaseTwoPattern: "carousel",
    },
    textureKeys: [
      "boss-sewing-storm-0",
      "boss-sewing-storm-1",
      "boss-sewing-storm-2",
      "boss-sewing-storm-3",
    ],
  },
  {
    id: "moth-mask",
    name: "Моль-Маска",
    epithet: "боится ярких нитей",
    roomId: "theatre",
    pattern: "stitches",
    baseHits: 16,
    bodyColor: 0xd59a8a,
    accentColor: 0xf2e3c6,
    shadowColor: 0x6b4a6f,
    isBoss: true,
    bossTuning: {
      speedMultiplier: 1.16,
      phaseTwoAt: 0.46,
      phaseTwoPattern: "recoil",
    },
    textureKeys: [
      "boss-moth-mask-0",
      "boss-moth-mask-1",
      "boss-moth-mask-2",
      "boss-moth-mask-3",
    ],
  },
  {
    id: "spring-rabbit",
    name: "Пружинный Заяц",
    epithet: "сбивает ритм спектакля",
    roomId: "theatre",
    pattern: "carousel",
    baseHits: 9,
    bodyColor: 0x8a5578,
    accentColor: 0xe56b6f,
    shadowColor: 0x44344f,
    textureKeys: [
      "spring-rabbit-0",
      "spring-rabbit-1",
      "spring-rabbit-2",
      "spring-rabbit-3",
    ],
  },
  {
    id: "patchwork-owl",
    name: "Лоскутный Филин",
    epithet: "видит каждый неверный стежок",
    roomId: "theatre",
    pattern: "pendulum",
    baseHits: 11,
    bodyColor: 0x31556a,
    accentColor: 0xc89345,
    shadowColor: 0x281c38,
    isMiniBoss: true,
    textureKeys: [
      "miniboss-patchwork-owl-0",
      "miniboss-patchwork-owl-1",
      "miniboss-patchwork-owl-2",
      "miniboss-patchwork-owl-3",
    ],
  },
  {
    id: "madam-marionette",
    name: "Мадам Марионетка",
    epithet: "дёргает за забытые нити",
    roomId: "theatre",
    pattern: "pendulum",
    baseHits: 17,
    bodyColor: 0x8a5578,
    accentColor: 0xf2e3c6,
    shadowColor: 0x3f304b,
    isBoss: true,
    bossTuning: {
      speedMultiplier: 1.18,
      phaseTwoAt: 0.42,
      phaseTwoPattern: "stitches",
    },
    textureKeys: [
      "boss-madam-marionette-0",
      "boss-madam-marionette-1",
      "boss-madam-marionette-2",
      "boss-madam-marionette-3",
    ],
  },
  {
    id: "thimble-hedgehog",
    name: "Напёрсточный Ёж",
    epithet: "прячется за бронёй",
    roomId: "machine",
    pattern: "carousel",
    baseHits: 10,
    bodyColor: 0x9f7655,
    accentColor: 0xe8b44d,
    shadowColor: 0x4d3b37,
    textureKeys: [
      "thimble-hedgehog-0",
      "thimble-hedgehog-1",
      "thimble-hedgehog-2",
      "thimble-hedgehog-3",
    ],
  },
  {
    id: "ink-shuttle",
    name: "Чернильный Челнок",
    epithet: "оставляет ложные стежки",
    roomId: "machine",
    pattern: "stitches",
    baseHits: 10,
    bodyColor: 0x25324a,
    accentColor: 0x39b7a5,
    shadowColor: 0x101923,
    textureKeys: [
      "ink-shuttle-0",
      "ink-shuttle-1",
      "ink-shuttle-2",
      "ink-shuttle-3",
    ],
  },
  {
    id: "thimble-sentinel",
    name: "Напёрсточный Страж",
    epithet: "охраняет сердце древнего механизма",
    roomId: "machine",
    pattern: "recoil",
    baseHits: 12,
    bodyColor: 0x274b5c,
    accentColor: 0x39b7a5,
    shadowColor: 0x171a24,
    isMiniBoss: true,
    textureKeys: [
      "miniboss-thimble-sentinel-0",
      "miniboss-thimble-sentinel-1",
      "miniboss-thimble-sentinel-2",
      "miniboss-thimble-sentinel-3",
    ],
  },
  {
    id: "ripper",
    name: "Распарыватель",
    epithet: "разрывает саму ткань мира",
    roomId: "machine",
    pattern: "recoil",
    baseHits: 19,
    bodyColor: 0x705134,
    accentColor: 0x39b7a5,
    shadowColor: 0x171a24,
    isBoss: true,
    bossTuning: {
      speedMultiplier: 1.22,
      phaseTwoAt: 0.38,
      phaseTwoPattern: "stitches",
    },
    textureKeys: [
      "boss-ripper-0",
      "boss-ripper-1",
      "boss-ripper-2",
      "boss-ripper-3",
    ],
  },
] as const;

export const PATTERN_NAMES: Readonly<Record<MovementPattern, string>> = {
  carousel: "Карусель",
  pendulum: "Маятник",
  stitches: "Стежки",
  recoil: "Отдача",
};

const MAX_HITS_BY_PATTERN: Readonly<Record<MovementPattern, number>> = {
  carousel: 22,
  pendulum: 20,
  stitches: 24,
  recoil: 24,
};

const FIRST_SPOOL_SPIDER_STAGE = 3;
const FIRST_SPOOL_SPIDER_HIT_RELIEF = 2;

const REGULAR_MONSTERS = MONSTERS.filter(
  (monster) => !monster.isBoss && !monster.isMiniBoss,
);
const MINI_BOSS_STAGES = [3, 8, 13, 18] as const;
const MINI_BOSS_ROTATION = [
  MONSTERS.find((monster) => monster.id === "spool-spider")!,
  MONSTERS.find((monster) => monster.id === "patchwork-owl")!,
  MONSTERS.find((monster) => monster.id === "thimble-sentinel")!,
] as const;
const BOSS_ROTATION = [
  MONSTERS.find((monster) => monster.id === "sewing-storm")!,
  MONSTERS.find((monster) => monster.id === "moth-mask")!,
  MONSTERS.find((monster) => monster.id === "madam-marionette")!,
  MONSTERS.find((monster) => monster.id === "ripper")!,
] as const;

export function getMonsterForStage(stage: number): MonsterDefinition {
  const normalizedStage = Math.max(1, Math.floor(stage));
  const cycleStage = ((normalizedStage - 1) % 20) + 1;
  if (cycleStage % 5 === 0) {
    const bossIndex = cycleStage / 5 - 1;
    return BOSS_ROTATION[bossIndex];
  }

  const miniBossIndex = MINI_BOSS_STAGES.indexOf(
    cycleStage as (typeof MINI_BOSS_STAGES)[number],
  );
  if (miniBossIndex >= 0) {
    return MINI_BOSS_ROTATION[miniBossIndex % MINI_BOSS_ROTATION.length];
  }

  const bossesBeforeStage = Math.floor((cycleStage - 1) / 5);
  const miniBossesBeforeStage = MINI_BOSS_STAGES.filter(
    (miniBossStage) => miniBossStage < cycleStage,
  ).length;
  const regularIndex =
    cycleStage - 1 - bossesBeforeStage - miniBossesBeforeStage;
  return REGULAR_MONSTERS[regularIndex % REGULAR_MONSTERS.length];
}

export function getRoomForStage(stage: number): RoomDefinition {
  return ROOMS.find((room) => room.id === getMonsterForStage(stage).roomId) ?? ROOMS[0];
}

export function getExpeditionNumber(stage: number): number {
  const normalizedStage = Math.max(1, Math.floor(stage));
  return Math.floor((normalizedStage - 1) / 20) + 1;
}

export function getMovementPatternForProgress(
  monster: MonsterDefinition,
  completedHits: number,
  requiredHits: number,
): MovementPattern {
  const tuning = monster.bossTuning;
  if (
    !tuning ||
    completedHits < Math.max(1, requiredHits) * tuning.phaseTwoAt
  ) {
    return monster.pattern;
  }
  return tuning.phaseTwoPattern;
}

export function getRequiredHits(monster: MonsterDefinition, stage: number): number {
  const normalizedStage = Math.max(1, Math.floor(stage));
  const growth = Math.floor((normalizedStage - 1) / 10);
  const earlyEncounterRelief =
    monster.id === "spool-spider" &&
    normalizedStage === FIRST_SPOOL_SPIDER_STAGE
      ? FIRST_SPOOL_SPIDER_HIT_RELIEF
      : 0;
  return Math.min(
    monster.baseHits + growth - earlyEncounterRelief,
    MAX_HITS_BY_PATTERN[monster.pattern],
  );
}
