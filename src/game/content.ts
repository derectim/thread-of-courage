export type MovementPattern = "carousel" | "pendulum" | "stitches" | "recoil";

export type RoomId = "attic" | "theatre" | "machine";

export interface RoomDefinition {
  readonly id: RoomId;
  readonly name: string;
  readonly subtitle: string;
  readonly backgroundKey: string;
  readonly accentColor: number;
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
  },
  {
    id: "sewing-storm",
    name: "Великая Швейная Буря",
    epithet: "прячет сердце под лоскутами",
    roomId: "attic",
    pattern: "recoil",
    baseHits: 10,
    bodyColor: 0x6b4a6f,
    accentColor: 0xe8b44d,
    shadowColor: 0x3f304b,
    isBoss: true,
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
    baseHits: 8,
    bodyColor: 0xd59a8a,
    accentColor: 0xf2e3c6,
    shadowColor: 0x6b4a6f,
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
  },
  {
    id: "madam-marionette",
    name: "Мадам Марионетка",
    epithet: "дёргает за забытые нити",
    roomId: "theatre",
    pattern: "pendulum",
    baseHits: 10,
    bodyColor: 0x8a5578,
    accentColor: 0xf2e3c6,
    shadowColor: 0x3f304b,
    isBoss: true,
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
  },
  {
    id: "ripper",
    name: "Распарыватель",
    epithet: "разрывает саму ткань мира",
    roomId: "machine",
    pattern: "recoil",
    baseHits: 12,
    bodyColor: 0x705134,
    accentColor: 0x39b7a5,
    shadowColor: 0x171a24,
    isBoss: true,
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
  carousel: 18,
  pendulum: 10,
  stitches: 18,
  recoil: 18,
};

export function getMonsterForStage(stage: number): MonsterDefinition {
  const normalizedStage = Math.max(1, Math.floor(stage));
  return MONSTERS[(normalizedStage - 1) % MONSTERS.length];
}

export function getRoomForStage(stage: number): RoomDefinition {
  return ROOMS.find((room) => room.id === getMonsterForStage(stage).roomId) ?? ROOMS[0];
}

export function getExpeditionNumber(stage: number): number {
  const normalizedStage = Math.max(1, Math.floor(stage));
  return Math.floor((normalizedStage - 1) / MONSTERS.length) + 1;
}

export function getRequiredHits(monster: MonsterDefinition, stage: number): number {
  const normalizedStage = Math.max(1, Math.floor(stage));
  const growth = Math.floor((normalizedStage - 1) / MONSTERS.length);
  return Math.min(monster.baseHits + growth, MAX_HITS_BY_PATTERN[monster.pattern]);
}
