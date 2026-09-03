import { describe, expect, it } from "vitest";

import {
  MONSTERS,
  ROOMS,
  getExpeditionNumber,
  getMonsterForStage,
  getRequiredHits,
  getRoomForStage,
} from "./content";

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
  it("contains three rooms, five ordinary enemies, three mini-bosses, and four bosses", () => {
    expect(ROOMS).toHaveLength(3);
    expect(MONSTERS).toHaveLength(12);
    expect(
      MONSTERS.filter((monster) => !monster.isBoss && !monster.isMiniBoss),
    ).toHaveLength(5);
    expect(MONSTERS.filter((monster) => monster.isMiniBoss)).toHaveLength(3);
    expect(MONSTERS.filter((monster) => monster.isBoss)).toHaveLength(4);

    for (const monster of MONSTERS) {
      expect(ROOMS.some((room) => room.id === monster.roomId)).toBe(true);
      expect(Boolean(monster.isBoss && monster.isMiniBoss)).toBe(false);
      expect(monster.textureKeys).toHaveLength(4);
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

  it("repeats the roster every 20 stages and increments the expedition number", () => {
    for (let stage = 1; stage <= 20; stage += 1) {
      expect(getMonsterForStage(stage + 20).id).toBe(
        getMonsterForStage(stage).id,
      );
      expect(getRoomForStage(stage).id).toBe(
        getMonsterForStage(stage).roomId,
      );
    }

    expect(getExpeditionNumber(1)).toBe(1);
    expect(getExpeditionNumber(20)).toBe(1);
    expect(getExpeditionNumber(21)).toBe(2);
    expect(getExpeditionNumber(40)).toBe(2);
    expect(getExpeditionNumber(41)).toBe(3);
  });
});
