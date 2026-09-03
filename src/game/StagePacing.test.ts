import { describe, expect, it } from "vitest";

import { getStageRotationSpeed } from "./StagePacing";

describe("campaign stage pacing", () => {
  it("keeps the opening readable and increases speed throughout the campaign", () => {
    const stages = [1, 5, 10, 20, 30, 50, 80];
    const speeds = stages.map(getStageRotationSpeed);

    expect(speeds[0]).toBeCloseTo(0.94, 2);
    for (let index = 1; index < speeds.length; index += 1) {
      expect(speeds[index]).toBeGreaterThan(speeds[index - 1]);
    }
  });

  it("adds only a gradual late-game ramp and keeps an upper bound", () => {
    const stage20 = getStageRotationSpeed(20);
    const stage21 = getStageRotationSpeed(21);

    expect(stage21 - stage20).toBeGreaterThan(0);
    expect(stage21 - stage20).toBeLessThan(0.04);
    expect(getStageRotationSpeed(10_000)).toBe(2.7);
  });

  it("normalizes invalid low stages to the first stage", () => {
    expect(getStageRotationSpeed(0)).toBe(getStageRotationSpeed(1));
    expect(getStageRotationSpeed(-12)).toBe(getStageRotationSpeed(1));
  });
});
