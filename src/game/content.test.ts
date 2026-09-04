import { describe, expect, it } from "vitest";

import {
  MONSTERS,
  ROOMS,
  getExpeditionNumber,
  getFirstCampaignStageForMonster,
  getMonsterForStage,
  getMovementPatternForProgress,
  getRequiredHits,
  getRoomForStage,
} from "./content";

const OPENING_STAGE_IDS = [
  "grumble-yarn",
  "button-bug",
  "spool-spider",
  "spring-rabbit",
  "sewing-storm",
  "thimble-hedgehog",
  "ink-shuttle",
  "patchwork-owl",
  "grumble-yarn",
  "moth-mask",
  "button-bug",
  "spring-rabbit",
  "thimble-sentinel",
  "thimble-hedgehog",
  "madam-marionette",
  "ink-shuttle",
  "grumble-yarn",
  "spool-spider",
  "button-bug",
  "ripper",
] as const;

const LATE_STAGE_IDS = [
  "measuring-worm",
  "velvet-bat",
  "scissor-mantis",
  "bobbin-crab",
  "queen-unraveling",
  "wax-doll",
  "lace-wisp",
  "loom-widow",
  "measuring-worm",
  "clockwork-tailor",
  "velvet-bat",
  "bobbin-crab",
  "pincushion-boar",
  "wax-doll",
  "queen-unraveling",
  "lace-wisp",
  "measuring-worm",
  "scissor-mantis",
  "velvet-bat",
  "clockwork-tailor",
] as const;

const LATE_MONSTER_IDS: ReadonlySet<string> = new Set(LATE_STAGE_IDS);

describe("getRequiredHits", () => {
  it("starts each monster at its configured number of hits", () => {
    for (const monster of MONSTERS) {
      expect(getRequiredHits(monster, 1)).toBe(monster.baseHits);
    }
  });

  it("grows once per ten completed stages", () => {
    expect(getRequiredHits(MONSTERS[0], 10)).toBe(MONSTERS[0].baseHits);
    expect(getRequiredHits(MONSTERS[0], 11)).toBe(
      MONSTERS[0].baseHits + 1,
    );
  });

  it("softens only the first spool spider encounter", () => {
    const spoolSpider = MONSTERS.find(
      (monster) => monster.id === "spool-spider",
    );
    expect(spoolSpider).toBeDefined();

    expect(getRequiredHits(spoolSpider!, 3)).toBe(8);
    expect(getRequiredHits(spoolSpider!, 18)).toBe(11);
    expect(getRequiredHits(spoolSpider!, 23)).toBe(12);
  });

  it("caps pendulum stages to their reachable firing arc", () => {
    const pendulum = MONSTERS.find((monster) => monster.pattern === "pendulum");
    expect(pendulum).toBeDefined();
    expect(getRequiredHits(pendulum!, 10_000)).toBe(20);
  });

  it("caps full-circle patterns below their angular capacity", () => {
    const carousel = MONSTERS.find((monster) => monster.pattern === "carousel");
    expect(carousel).toBeDefined();
    expect(getRequiredHits(carousel!, 10_000)).toBe(22);
  });
});

describe("expedition content", () => {
  it("contains the original expedition plus ten late-game enemies", () => {
    expect(ROOMS).toHaveLength(3);
    expect(MONSTERS).toHaveLength(22);
    expect(
      MONSTERS.filter((monster) => !monster.isBoss && !monster.isMiniBoss),
    ).toHaveLength(10);
    expect(MONSTERS.filter((monster) => monster.isMiniBoss)).toHaveLength(6);
    expect(MONSTERS.filter((monster) => monster.isBoss)).toHaveLength(6);

    for (const monster of MONSTERS) {
      expect(ROOMS.some((room) => room.id === monster.roomId)).toBe(true);
      expect(Boolean(monster.isBoss && monster.isMiniBoss)).toBe(false);
      expect(monster.textureKeys).toHaveLength(4);
    }
  });

  it("preserves the exact opening roster for stages one through twenty", () => {
    expect(
      Array.from({ length: 20 }, (_, index) => getMonsterForStage(index + 1).id),
    ).toEqual(OPENING_STAGE_IDS);
  });

  it("uses only the new roster for stages twenty-one through forty", () => {
    const encounters = Array.from(
      { length: 20 },
      (_, index) => getMonsterForStage(index + 21),
    );
    expect(encounters.map((monster) => monster.id)).toEqual(LATE_STAGE_IDS);
    expect(encounters.every((monster) => LATE_MONSTER_IDS.has(monster.id))).toBe(
      true,
    );

    const unique = Array.from(
      new Map(encounters.map((monster) => [monster.id, monster])).values(),
    );
    expect(
      unique.filter((monster) => !monster.isBoss && !monster.isMiniBoss),
    ).toHaveLength(5);
    expect(unique.filter((monster) => monster.isMiniBoss)).toHaveLength(3);
    expect(unique.filter((monster) => monster.isBoss)).toHaveLength(2);
  });

  it("places late bosses and mini-bosses in their intended slots", () => {
    const bossStages = [25, 30, 35, 40];
    const miniBossStages = [23, 28, 33, 38];

    for (let stage = 21; stage <= 40; stage += 1) {
      expect(Boolean(getMonsterForStage(stage).isBoss)).toBe(
        bossStages.includes(stage),
      );
      expect(Boolean(getMonsterForStage(stage).isMiniBoss)).toBe(
        miniBossStages.includes(stage),
      );
    }

    expect(bossStages.map((stage) => getMonsterForStage(stage).id)).toEqual([
      "queen-unraveling",
      "clockwork-tailor",
      "queen-unraveling",
      "clockwork-tailor",
    ]);
    expect(miniBossStages.map((stage) => getMonsterForStage(stage).id)).toEqual([
      "scissor-mantis",
      "loom-widow",
      "pincushion-boar",
      "scissor-mantis",
    ]);
  });

  it("gives every late enemy four unique frames and a unique hit reaction", () => {
    const lateMonsters = MONSTERS.filter((monster) =>
      LATE_MONSTER_IDS.has(monster.id),
    );
    const textureKeys = lateMonsters.flatMap(
      (monster) => monster.textureKeys ?? [],
    );
    const reactions = lateMonsters.map((monster) => monster.damageReaction);

    expect(lateMonsters).toHaveLength(10);
    expect(textureKeys).toHaveLength(40);
    expect(new Set(textureKeys)).toHaveLength(40);
    expect(lateMonsters.every((monster) => monster.textureKeys?.length === 4)).toBe(
      true,
    );
    expect(reactions.every(Boolean)).toBe(true);
    expect(new Set(reactions)).toHaveLength(10);
  });

  it("keeps the intended late-enemy tuning and asset prefixes", () => {
    const expected = [
      ["measuring-worm", "Мерная Гусеница", "attic", "stitches", 11, "tape-ripple", "regular"],
      ["velvet-bat", "Бархатная Ночница", "theatre", "pendulum", 12, "velvet-dust", "regular"],
      ["bobbin-crab", "Шпульковый Краб", "machine", "recoil", 12, "metal-sparks", "regular"],
      ["wax-doll", "Восковая Кукла", "theatre", "carousel", 12, "wax-crack", "regular"],
      ["lace-wisp", "Кружевной Огонёк", "attic", "stitches", 13, "lace-unravel", "regular"],
      ["scissor-mantis", "Ножничный Богомол", "machine", "recoil", 15, "blade-sparks", "mini"],
      ["loom-widow", "Ткацкая Вдова", "theatre", "stitches", 16, "web-unwind", "mini"],
      ["pincushion-boar", "Игольчатый Кабан", "attic", "carousel", 16, "needle-burst", "mini"],
      ["queen-unraveling", "Королева Распущенных Швов", "theatre", "stitches", 20, "royal-unravel", "boss"],
      ["clockwork-tailor", "Часовой Портной", "machine", "recoil", 21, "clockwork-break", "boss"],
    ] as const;

    for (const [id, name, roomId, pattern, baseHits, damageReaction, kind] of expected) {
      const monster = MONSTERS.find((candidate) => candidate.id === id);
      expect(monster).toMatchObject({
        id,
        name,
        roomId,
        pattern,
        baseHits,
        damageReaction,
        ...(kind === "boss"
          ? { isBoss: true }
          : kind === "mini"
            ? { isMiniBoss: true }
            : {}),
      });
      const texturePrefix =
        kind === "boss" ? `boss-${id}` : kind === "mini" ? `miniboss-${id}` : id;
      expect(monster?.textureKeys).toEqual(
        Array.from({ length: 4 }, (_, index) => `${texturePrefix}-${index}`),
      );
    }

    expect(MONSTERS.find((monster) => monster.id === "queen-unraveling")?.bossTuning).toEqual({
      speedMultiplier: 1.09,
      phaseTwoAt: 0.43,
      phaseTwoPattern: "recoil",
    });
    expect(MONSTERS.find((monster) => monster.id === "clockwork-tailor")?.bossTuning).toEqual({
      speedMultiplier: 1.11,
      phaseTwoAt: 0.37,
      phaseTwoPattern: "pendulum",
    });
  });

  it("reports the first campaign stage for opening and late enemies", () => {
    expect(getFirstCampaignStageForMonster("grumble-yarn")).toBe(1);
    expect(getFirstCampaignStageForMonster("ripper")).toBe(20);
    expect(getFirstCampaignStageForMonster("measuring-worm")).toBe(21);
    expect(getFirstCampaignStageForMonster("scissor-mantis")).toBe(23);
    expect(getFirstCampaignStageForMonster("queen-unraveling")).toBe(25);
    expect(getFirstCampaignStageForMonster("loom-widow")).toBe(28);
    expect(getFirstCampaignStageForMonster("clockwork-tailor")).toBe(30);
    expect(getFirstCampaignStageForMonster("pincushion-boar")).toBe(33);
    expect(getFirstCampaignStageForMonster("unknown-nightmare")).toBeNull();
  });

  it("keeps late-game durability within the angular capacity of each pattern", () => {
    const caps = {
      carousel: 22,
      pendulum: 20,
      stitches: 24,
      recoil: 24,
    } as const;

    for (let stage = 21; stage <= 400; stage += 1) {
      const monster = getMonsterForStage(stage);
      expect(getRequiredHits(monster, stage)).toBeLessThanOrEqual(
        caps[monster.pattern],
      );
    }
  });

  it("places bosses strictly at stages 5, 10, 15, and 20", () => {
    const bossByStage = new Map([
      [5, "sewing-storm"],
      [10, "moth-mask"],
      [15, "madam-marionette"],
      [20, "ripper"],
    ]);

    for (let stage = 1; stage <= 20; stage += 1) {
      const monster = getMonsterForStage(stage);
      const expectedBossId = bossByStage.get(stage);

      expect(Boolean(monster.isBoss)).toBe(expectedBossId !== undefined);
      if (expectedBossId) expect(monster.id).toBe(expectedBossId);
    }
  });

  it("ramps main-boss durability, speed, and phase pressure across the expedition", () => {
    const expected = [
      {
        stage: 5,
        id: "sewing-storm",
        requiredHits: 13,
        speedMultiplier: 1.06,
        phaseTwoAt: 0.5,
        phaseTwoPattern: "carousel",
      },
      {
        stage: 10,
        id: "moth-mask",
        requiredHits: 16,
        speedMultiplier: 1.16,
        phaseTwoAt: 0.46,
        phaseTwoPattern: "recoil",
      },
      {
        stage: 15,
        id: "madam-marionette",
        requiredHits: 18,
        speedMultiplier: 1.18,
        phaseTwoAt: 0.42,
        phaseTwoPattern: "stitches",
      },
      {
        stage: 20,
        id: "ripper",
        requiredHits: 20,
        speedMultiplier: 1.22,
        phaseTwoAt: 0.38,
        phaseTwoPattern: "stitches",
      },
    ] as const;

    for (const tuning of expected) {
      const monster = getMonsterForStage(tuning.stage);
      expect(monster.id).toBe(tuning.id);
      expect(getRequiredHits(monster, tuning.stage)).toBe(tuning.requiredHits);
      expect(monster.bossTuning).toEqual({
        speedMultiplier: tuning.speedMultiplier,
        phaseTwoAt: tuning.phaseTwoAt,
        phaseTwoPattern: tuning.phaseTwoPattern,
      });
      const phaseTwoHit = Math.ceil(
        tuning.requiredHits * tuning.phaseTwoAt,
      );
      expect(
        getMovementPatternForProgress(
          monster,
          phaseTwoHit - 1,
          tuning.requiredHits,
        ),
      ).toBe(monster.pattern);
      expect(
        getMovementPatternForProgress(
          monster,
          phaseTwoHit,
          tuning.requiredHits,
        ),
      ).toBe(tuning.phaseTwoPattern);
    }

    expect(getRequiredHits(getMonsterForStage(5), 5)).toBeLessThan(
      getRequiredHits(getMonsterForStage(10), 10),
    );
    expect(getMonsterForStage(5).bossTuning?.phaseTwoAt).toBeGreaterThan(
      getMonsterForStage(20).bossTuning?.phaseTwoAt ?? 1,
    );
    for (let index = 1; index < expected.length; index += 1) {
      expect(expected[index].requiredHits).toBeGreaterThan(
        expected[index - 1].requiredHits,
      );
      expect(expected[index].speedMultiplier).toBeGreaterThan(
        expected[index - 1].speedMultiplier,
      );
      expect(expected[index].phaseTwoAt).toBeLessThan(
        expected[index - 1].phaseTwoAt,
      );
    }
  });

  it("alternates mini-bosses at stages 3, 8, 13, and 18", () => {
    const miniBossByStage = new Map([
      [3, "spool-spider"],
      [8, "patchwork-owl"],
      [13, "thimble-sentinel"],
      [18, "spool-spider"],
    ]);

    for (let stage = 1; stage <= 20; stage += 1) {
      const monster = getMonsterForStage(stage);
      const expectedMiniBossId = miniBossByStage.get(stage);

      expect(Boolean(monster.isMiniBoss)).toBe(
        expectedMiniBossId !== undefined,
      );
      if (expectedMiniBossId) {
        expect(monster.id).toBe(expectedMiniBossId);
        expect(monster.isBoss).not.toBe(true);
      }
    }
  });

  it("gives every mini-boss its own room, durability, movement, and artwork", () => {
    const expectedMiniBosses = [
      {
        id: "spool-spider",
        name: "Катушечный Паук",
        roomId: "attic",
        pattern: "stitches",
        baseHits: 10,
        texturePrefix: "miniboss-spool-spider-",
      },
      {
        id: "patchwork-owl",
        name: "Лоскутный Филин",
        roomId: "theatre",
        pattern: "pendulum",
        baseHits: 11,
        texturePrefix: "miniboss-patchwork-owl-",
      },
      {
        id: "thimble-sentinel",
        name: "Напёрсточный Страж",
        roomId: "machine",
        pattern: "recoil",
        baseHits: 12,
        texturePrefix: "miniboss-thimble-sentinel-",
      },
    ] as const;

    for (const expected of expectedMiniBosses) {
      const monster = MONSTERS.find((candidate) => candidate.id === expected.id);
      expect(monster).toMatchObject({
        name: expected.name,
        roomId: expected.roomId,
        pattern: expected.pattern,
        baseHits: expected.baseHits,
        isMiniBoss: true,
      });
      expect(monster?.textureKeys).toEqual(
        Array.from({ length: 4 }, (_, index) =>
          `${expected.texturePrefix}${index}`,
        ),
      );
    }

    expect(new Set(expectedMiniBosses.map(({ pattern }) => pattern)).size).toBe(3);
  });

  it("keeps every ordinary enemy in the stage rotation without adjacent repeats", () => {
    const ordinaryEncounters = Array.from({ length: 20 }, (_, index) =>
      getMonsterForStage(index + 1),
    ).filter((monster) => !monster.isBoss && !monster.isMiniBoss);

    expect(new Set(ordinaryEncounters.map((monster) => monster.id)).size).toBe(5);
    for (let index = 1; index < ordinaryEncounters.length; index += 1) {
      expect(ordinaryEncounters[index].id).not.toBe(
        ordinaryEncounters[index - 1].id,
      );
    }
  });

  it("repeats the late roster after stage forty and increments expedition numbers", () => {
    for (let stage = 21; stage <= 40; stage += 1) {
      expect(getMonsterForStage(stage + 20).id).toBe(getMonsterForStage(stage).id);
      expect(getRoomForStage(stage).id).toBe(getMonsterForStage(stage).roomId);
    }

    expect(getMonsterForStage(41).id).toBe(getMonsterForStage(21).id);

    expect(getExpeditionNumber(1)).toBe(1);
    expect(getExpeditionNumber(20)).toBe(1);
    expect(getExpeditionNumber(21)).toBe(2);
    expect(getExpeditionNumber(40)).toBe(2);
    expect(getExpeditionNumber(41)).toBe(3);
  });
});
