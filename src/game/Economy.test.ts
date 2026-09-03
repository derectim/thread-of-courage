import { describe, expect, it } from "vitest";

import { getStageReward } from "./Economy";

describe("getStageReward", () => {
  it("awards two thread for normal enemies and three for bosses", () => {
    expect(
      Array.from({ length: 20 }, (_, index) => getStageReward(index + 1)),
    ).toEqual([
      2, 2, 2, 2, 3,
      2, 2, 2, 2, 3,
      2, 2, 2, 2, 3,
      2, 2, 2, 2, 3,
    ]);
  });

  it("does not inflate rewards in later 20-stage expeditions", () => {
    for (let stage = 1; stage <= 20; stage += 1) {
      expect(getStageReward(stage + 20)).toBe(getStageReward(stage));
      expect(getStageReward(stage + 200)).toBe(getStageReward(stage));
    }
  });
});
