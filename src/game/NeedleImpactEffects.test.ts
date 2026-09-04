import { describe, expect, it } from "vitest";

import { WORKSHOP_IMPACT_ART } from "./WorkshopCollection";
import {
  NEEDLE_IMPACT_VFX_PROFILES,
  getNeedleImpactVfxProfile,
} from "./NeedleImpactEffects";

describe("collectible needle impact VFX", () => {
  it("assigns a bespoke animated reaction to every published impact artwork", () => {
    expect(Object.keys(NEEDLE_IMPACT_VFX_PROFILES).sort()).toEqual(
      Object.keys(WORKSHOP_IMPACT_ART).sort(),
    );
    expect(
      new Set(
        Object.values(NEEDLE_IMPACT_VFX_PROFILES).map(
          (profile) => profile.reaction,
        ),
      ).size,
    ).toBe(Object.keys(WORKSHOP_IMPACT_ART).length);
  });

  it("keeps every reaction visible long enough to read without lingering", () => {
    for (const id of Object.keys(WORKSHOP_IMPACT_ART)) {
      const profile = getNeedleImpactVfxProfile(id);
      expect(profile).not.toBeNull();
      expect(profile?.particleCount).toBeGreaterThanOrEqual(6);
      expect(profile?.durationMs).toBeGreaterThanOrEqual(300);
      expect(profile?.durationMs).toBeLessThanOrEqual(800);
    }
  });
});
