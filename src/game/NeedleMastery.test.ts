import { describe, expect, it } from "vitest";

import { NEEDLE_SKIN_IDS } from "./meta";
import {
  MAX_NEEDLE_MASTERY_LEVEL,
  NEEDLE_MASTERY_LEVEL_THRESHOLDS,
  NEEDLE_MASTERY_REWARDS,
  addNeedleMasteryXp,
  createNeedleMasteryState,
  getNeedleMasteryLevel,
  getNeedleMasterySummary,
  normalizeNeedleMasteryState,
  recordNeedleMasteryHit,
  recordNeedleMasteryVictory,
} from "./NeedleMastery";

describe("needle mastery", () => {
  it("tracks independent XP and levels from 1 through 10 for every needle", () => {
    let state = createNeedleMasteryState();
    state = recordNeedleMasteryHit(state, "silver", 12);
    state = recordNeedleMasteryVictory(state, "silver", "boss");

    expect(getNeedleMasterySummary(state, "silver")).toMatchObject({
      xp: 26,
      level: 2,
    });
    expect(getNeedleMasterySummary(state, "bone")).toMatchObject({
      xp: 0,
      level: 1,
    });
    expect(getNeedleMasteryLevel(420)).toBe(MAX_NEEDLE_MASTERY_LEVEL);
    expect(NEEDLE_MASTERY_LEVEL_THRESHOLDS).toHaveLength(10);
  });

  it("awards more mastery XP for tougher victories", () => {
    const base = createNeedleMasteryState();
    const regular = recordNeedleMasteryVictory(base, "storm", "regular");
    const miniBoss = recordNeedleMasteryVictory(base, "storm", "mini-boss");
    const boss = recordNeedleMasteryVictory(base, "storm", "boss");

    expect(regular.byNeedle.storm.xp).toBe(6);
    expect(miniBoss.byNeedle.storm.xp).toBe(10);
    expect(boss.byNeedle.storm.xp).toBe(14);
  });

  it("unlocks five purely cosmetic rewards per needle", () => {
    for (const needleId of NEEDLE_SKIN_IDS) {
      const rewards = NEEDLE_MASTERY_REWARDS.filter(
        (reward) => reward.needleId === needleId,
      );
      expect(rewards.map((reward) => reward.requiredLevel)).toEqual([
        2, 4, 6, 8, 10,
      ]);
      expect(rewards.every((reward) => reward.cosmeticOnly)).toBe(true);
      expect(
        rewards.every(
          (reward) =>
            !("modifiers" in reward) && !("damage" in reward) && !("power" in reward),
        ),
      ).toBe(true);
    }
  });

  it("caps XP at level 10 and reports completed progress", () => {
    const state = addNeedleMasteryXp(
      createNeedleMasteryState(),
      "sunrise",
      999_999,
    );
    const summary = getNeedleMasterySummary(state, "sunrise");

    expect(summary.level).toBe(10);
    expect(summary.xp).toBe(420);
    expect(summary.nextLevelXp).toBeNull();
    expect(summary.unlockedRewards).toHaveLength(5);
  });

  it("safely normalizes malformed and partial save data", () => {
    const state = normalizeNeedleMasteryState({
      version: 99,
      byNeedle: {
        silver: { xp: "55" },
        bone: { xp: -20 },
        storm: { xp: Number.NaN },
        sunrise: { xp: 99_999 },
      },
    });

    expect(state.version).toBe(1);
    expect(state.byNeedle.silver.xp).toBe(55);
    expect(state.byNeedle.bone.xp).toBe(0);
    expect(state.byNeedle.storm.xp).toBe(0);
    expect(state.byNeedle.sunrise.xp).toBe(420);
  });
});
