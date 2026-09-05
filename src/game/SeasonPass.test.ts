import { describe, expect, it } from "vitest";

import {
  CURRENT_SEASON_ID,
  SEASON_PASS_TIERS,
  SEASON_TASKS,
  addSeasonPassXp,
  claimAllSeasonPassRewards,
  claimSeasonPassReward,
  createSeasonPassState,
  getSeasonPassStatus,
  getClaimableSeasonPassRewards,
  recordSeasonPassEvent,
  setPrototypePremiumAccess,
  syncSeasonPassState,
} from "./SeasonPass";

describe("season pass", () => {
  it("claims all earned free rewards once without granting locked or premium rewards", () => {
    const initial = addSeasonPassXp(createSeasonPassState(), 450);
    const partial = claimSeasonPassReward(initial, 2, "free").state;
    expect(getClaimableSeasonPassRewards(partial)).toEqual([{ tier: 1, track: "free" }, { tier: 3, track: "free" }]);
    const result = claimAllSeasonPassRewards(partial);
    expect(result.rewards.map((reward) => reward.id)).toEqual([SEASON_PASS_TIERS[0].freeReward.id, SEASON_PASS_TIERS[2].freeReward.id]);
    expect(result.state.claimedFreeTiers).toEqual([2, 1, 3]);
    expect(result.state.claimedPremiumTiers).toEqual([]);
    expect(claimAllSeasonPassRewards(result.state)).toEqual({ state: result.state, rewards: [] });
  });

  it("collects earlier golden rewards after activating the track and never repeats free rewards", () => {
    const free = claimAllSeasonPassRewards(addSeasonPassXp(createSeasonPassState(), 250));
    const result = claimAllSeasonPassRewards(setPrototypePremiumAccess(free.state, true));
    expect(result.rewards).toEqual(SEASON_PASS_TIERS.slice(0, 2).map((tier) => tier.premiumReward));
    expect(result.state.claimedPremiumTiers).toEqual([1, 2]);
    expect(result.state.claimedFreeTiers).toEqual([1, 2]);
  });

  it("contains 20 free and premium cosmetic-only tiers", () => {
    expect(SEASON_PASS_TIERS).toHaveLength(20);
    expect(SEASON_PASS_TIERS.map((tier) => tier.requiredXp)).toEqual(
      [
        100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250,
        3850, 4500, 5200, 5950, 6750, 7600, 8500, 9450, 10450, 11500,
      ],
    );
    for (const tier of SEASON_PASS_TIERS) {
      for (const reward of [tier.freeReward, tier.premiumReward]) {
        expect(reward.cosmeticOnly).toBe(true);
        expect("modifiers" in reward).toBe(false);
        expect("damage" in reward).toBe(false);
        expect("ward" in reward).toBe(false);
      }
    }
  });

  it("earns XP from play and daily tasks and caps at tier 20", () => {
    let state = createSeasonPassState();
    state = recordSeasonPassEvent(state, "stage-victory", 10);
    state = recordSeasonPassEvent(state, "daily-task-completed", 1);
    expect(state.xp).toBe(110);
    expect(getSeasonPassStatus(state).unlockedTier).toBe(1);

    state = addSeasonPassXp(state, 100_000);
    expect(getSeasonPassStatus(state)).toMatchObject({
      unlockedTier: 20,
      xp: 11500,
      xpForNextTier: null,
    });
  });

  it("accumulates task progress and pays task XP only once", () => {
    let state = createSeasonPassState();
    state = recordSeasonPassEvent(state, "successful-hit", 149);
    expect(state.taskProgress["first-pattern"]).toBe(149);
    expect(state.xp).toBe(0);

    state = recordSeasonPassEvent(state, "successful-hit", 1);
    expect(state.completedTaskIds).toContain("first-pattern");
    expect(state.xp).toBe(
      SEASON_TASKS.find((task) => task.id === "first-pattern")?.xpReward,
    );

    state = recordSeasonPassEvent(state, "successful-hit", 100);
    expect(state.xp).toBe(120);
    expect(state.taskProgress["golden-rhythm"]).toBe(250);
  });

  it("locks the premium track behind a prototype flag without any payment", () => {
    const unlocked = addSeasonPassXp(createSeasonPassState(), 100);
    expect(claimSeasonPassReward(unlocked, 1, "premium").reward).toBeNull();

    const prototype = setPrototypePremiumAccess(unlocked, true);
    const claimed = claimSeasonPassReward(prototype, 1, "premium");
    expect(claimed.reward).toEqual(SEASON_PASS_TIERS[0].premiumReward);
    expect(claimSeasonPassReward(claimed.state, 1, "premium").reward).toBeNull();
  });

  it("claims each unlocked reward once and keeps the tracks independent", () => {
    let state = setPrototypePremiumAccess(
      addSeasonPassXp(createSeasonPassState(), 200),
      true,
    );
    state = addSeasonPassXp(state, 50);
    const free = claimSeasonPassReward(state, 2, "free");
    expect(free.reward).toEqual(SEASON_PASS_TIERS[1].freeReward);
    state = free.state;

    const premium = claimSeasonPassReward(state, 2, "premium");
    expect(premium.reward).toEqual(SEASON_PASS_TIERS[1].premiumReward);
    expect(claimSeasonPassReward(premium.state, 3, "free").reward).toBeNull();
  });

  it("resets for a new season and sanitizes current-season saves", () => {
    const malformed = {
      ...createSeasonPassState(),
      xp: 999_999,
      claimedFreeTiers: [0, 1, 1, 21, "2"],
      taskProgress: { "steady-road": 999 },
      completedTaskIds: ["steady-road", "unknown"],
    };
    const synced = syncSeasonPassState(malformed);
    expect(synced.xp).toBe(11500);
    expect(synced.claimedFreeTiers).toEqual([1, 2]);
    expect(synced.taskProgress["steady-road"]).toBe(50);
    expect(synced.completedTaskIds).toEqual(["steady-road"]);

    expect(syncSeasonPassState(synced, "living-thread-02")).toEqual(
      createSeasonPassState("living-thread-02"),
    );
    expect(synced.seasonId).toBe(CURRENT_SEASON_ID);
  });

  it("keeps a few early rewards close but makes the full album long-term", () => {
    expect(getSeasonPassStatus(addSeasonPassXp(createSeasonPassState(), 930))).toMatchObject({
      unlockedTier: 4,
      xpIntoTier: 230,
      xpForNextTier: 300,
    });

    let earlyRun = createSeasonPassState();
    earlyRun = recordSeasonPassEvent(earlyRun, "stage-victory", 20);
    earlyRun = recordSeasonPassEvent(earlyRun, "boss-victory", 4);
    earlyRun = recordSeasonPassEvent(earlyRun, "daily-task-completed", 2);
    earlyRun = recordSeasonPassEvent(earlyRun, "successful-hit", 300);
    expect(earlyRun.xp).toBe(388);
    expect(getSeasonPassStatus(earlyRun).unlockedTier).toBe(2);
  });
});
