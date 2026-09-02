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

  it("grows once per full monster cycle", () => {
    expect(getRequiredHits(MONSTERS[0], MONSTERS.length + 1)).toBe(
      MONSTERS[0].baseHits + 1,
    );
  });

  it("caps pendulum stages to their reachable firing arc", () => {
    const pendulum = MONSTERS.find((monster) => monster.pattern === "pendulum");
    expect(pendulum).toBeDefined();
    expect(getRequiredHits(pendulum!, 10_000)).toBe(10);
  });

  it("caps full-circle patterns below their angular capacity", () => {
    const carousel = MONSTERS.find((monster) => monster.pattern === "carousel");
    expect(carousel).toBeDefined();
    expect(getRequiredHits(carousel!, 10_000)).toBe(18);
  });
});

describe("expedition content", () => {
  it("contains three rooms with two enemies and one boss each", () => {
    expect(ROOMS).toHaveLength(3);
    expect(MONSTERS).toHaveLength(9);

    for (const room of ROOMS) {
      const residents = MONSTERS.filter((monster) => monster.roomId === room.id);
      expect(residents).toHaveLength(3);
      expect(residents.filter((monster) => monster.isBoss)).toHaveLength(1);
    }
  });

  it("places a boss at every third stage", () => {
    for (let stage = 1; stage <= MONSTERS.length; stage += 1) {
      expect(Boolean(getMonsterForStage(stage).isBoss)).toBe(stage % 3 === 0);
    }
  });

  it("cycles rooms and increments the expedition number", () => {
    expect(getRoomForStage(1).id).toBe("attic");
    expect(getRoomForStage(4).id).toBe("theatre");
    expect(getRoomForStage(7).id).toBe("machine");
    expect(getRoomForStage(10).id).toBe("attic");
    expect(getExpeditionNumber(9)).toBe(1);
    expect(getExpeditionNumber(10)).toBe(2);
  });
});
