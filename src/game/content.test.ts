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
  it("contains three rooms, five ordinary enemies, and four bosses", () => {
    expect(ROOMS).toHaveLength(3);
    expect(MONSTERS).toHaveLength(9);
    expect(MONSTERS.filter((monster) => !monster.isBoss)).toHaveLength(5);
    expect(MONSTERS.filter((monster) => monster.isBoss)).toHaveLength(4);

    for (const monster of MONSTERS) {
      expect(ROOMS.some((room) => room.id === monster.roomId)).toBe(true);
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
