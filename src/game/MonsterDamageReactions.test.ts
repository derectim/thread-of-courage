import { describe, expect, it } from "vitest";

import { MONSTERS } from "./content";
import {
  MONSTER_DAMAGE_REACTIONS,
  getMonsterDamageReactionProfile,
} from "./MonsterDamageReactions";

describe("monster damage reactions", () => {
  it("publishes a complete bounded profile for every late-game reaction", () => {
    const reactionIds = MONSTERS.flatMap((monster) =>
      monster.damageReaction ? [monster.damageReaction] : [],
    );

    expect(reactionIds).toHaveLength(10);
    expect(new Set(reactionIds)).toHaveLength(10);
    for (const id of reactionIds) {
      const profile = getMonsterDamageReactionProfile(id);
      expect(profile.id).toBe(id);
      expect(profile.particleCount).toBeGreaterThanOrEqual(6);
      expect(profile.particleCount).toBeLessThanOrEqual(16);
      expect(profile.durationMs).toBeGreaterThanOrEqual(350);
      expect(profile.durationMs).toBeLessThanOrEqual(900);
      expect(profile.shake).toBeGreaterThan(0);
      expect(profile.shake).toBeLessThan(0.01);
    }
  });

  it("uses a distinct visual motif for all ten new enemies", () => {
    const profiles = Object.values(MONSTER_DAMAGE_REACTIONS);
    expect(profiles).toHaveLength(10);
    expect(new Set(profiles.map((profile) => profile.motif))).toHaveLength(10);
  });
});
