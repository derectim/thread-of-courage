import { describe, expect, it } from "vitest";

import { HERO_CROSSBOW_FRAMES, getHeroNeedleLayout } from "./heroAnimation";

describe("hero crossbow animation", () => {
  it("keeps three frames on a shared canvas with a stable horizontal anchor", () => {
    expect(HERO_CROSSBOW_FRAMES).toHaveLength(3);
    const xs = HERO_CROSSBOW_FRAMES.map((frame) => frame.needle.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.011);
  });

  it("scales each frame-specific needle anchor with the displayed artwork", () => {
    expect(getHeroNeedleLayout(0, 278, 278)).toEqual({
      x: expect.closeTo(6.6442, 3),
      tipY: expect.closeTo(-129.2422, 3),
      tailY: expect.closeTo(-68.4988, 3),
    });

    const crouched = getHeroNeedleLayout(2, 556, 556);
    expect(crouched.x).toBeCloseTo(19.0708, 3);
    expect(crouched.tipY).toBeCloseTo(-182.2568, 3);
    expect(crouched.tailY).toBeCloseTo(-58.5468, 3);
  });
});
