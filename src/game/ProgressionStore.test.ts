import { describe, expect, it } from "vitest";

import { QUESTS, type QuestId } from "./meta";
import {
  LEGACY_SAVE_KEY,
  MAX_UPGRADE_LEVEL,
  PROGRESSION_SAVE_KEY,
  UPGRADE_IDS,
  V2_SAVE_KEY,
  buyNeedle,
  claimQuest,
  createDefaultState,
  equipNeedle,
  equipActiveAbility,
  equipSkill,
  getQuestProgress,
  getRandomNeedleUnlockCost,
  getUpgradeCost,
  load,
  purchaseUpgrade,
  recordShot,
  recordChallengeVictory,
  recordVictory,
  resetCampaignAfterDefeat,
  save,
  unlockRandomNeedle,
  unlockBackground,
  type ProgressionState,
  type ProgressionStorage,
} from "./ProgressionStore";

class MemoryStorage implements ProgressionStorage {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function createState(overrides: Partial<ProgressionState> = {}): ProgressionState {
  return { ...createDefaultState(), ...overrides };
}

function getQuest(id: QuestId) {
  const quest = QUESTS.find((candidate) => candidate.id === id);
  if (!quest) throw new Error(`Missing quest definition: ${id}`);
  return quest;
}

describe("ProgressionStore v3 persistence", () => {
  it("returns independent fresh defaults when storage is unavailable", () => {
    const first = load(null);
    const second = load(null);

    expect(first).toEqual(createDefaultState());
    expect(first).not.toBe(second);
    expect(first.upgrades).not.toBe(second.upgrades);
    expect(first.stats).not.toBe(second.stats);
    expect(first.ownedNeedles).not.toBe(second.ownedNeedles);
    expect(save(first, null)).toBe(false);
  });

  it("round-trips a normalized v3 save", () => {
    const storage = new MemoryStorage();
    const state = createState({
      highestStageCleared: 25,
      campaignResumeStage: 18,
      thread: 875,
      premium: 42,
      muted: true,
      introSeen: true,
      upgrades: { power: 2, precision: 1, speed: 3, ward: 1 },
      stats: {
        needlesThrown: 321,
        monstersDefeated: 27,
        bossesDefeated: 5,
        upgradesPurchased: 7,
      },
      ownedNeedles: ["silver", "bone", "storm", "moonweave", "velvet-thorn"],
      equippedNeedle: "storm",
      ownedBackgrounds: ["auto", "moon-garden"],
      equippedBackground: "moon-garden",
      unlockedSkills: ["steady-hand", "time-seam", "guardian-knot"],
      equippedSkill: "guardian-knot",
      claimedQuestIds: ["first-fifty", "tenth-stitch"],
    });

    expect(save(state, storage)).toBe(true);
    expect(load(storage)).toEqual(state);
  });

  it("migrates a v2 save into v3 without losing earned progression", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      V2_SAVE_KEY,
      JSON.stringify({
        version: 2,
        bestStage: 12,
        thread: 275,
        muted: true,
        upgrades: { power: 2, precision: 1, speed: 3, ward: 1 },
      }),
    );

    const migrated = load(storage);

    expect(migrated).toEqual(
      createState({
        highestStageCleared: 11,
        campaignResumeStage: 12,
        thread: 275,
        muted: true,
        upgrades: { power: 2, precision: 1, speed: 3, ward: 1 },
        stats: {
          needlesThrown: 0,
          monstersDefeated: 11,
          bossesDefeated: 2,
          upgradesPurchased: 7,
        },
        unlockedSkills: ["steady-hand", "time-seam"],
        dailySystems: migrated.dailySystems,
      }),
    );
    expect(JSON.parse(storage.getItem(PROGRESSION_SAVE_KEY) ?? "null")).toEqual(
      migrated,
    );
  });

  it("still migrates the original v1 save when no v2 save exists", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LEGACY_SAVE_KEY,
      JSON.stringify({ bestStage: 9, thread: 123, muted: true }),
    );

    const migrated = load(storage);
    expect(migrated).toEqual(
      createState({
        highestStageCleared: 8,
        campaignResumeStage: 9,
        thread: 123,
        muted: true,
        stats: {
          needlesThrown: 0,
          monstersDefeated: 8,
          bossesDefeated: 1,
          upgradesPurchased: 0,
        },
        dailySystems: migrated.dailySystems,
      }),
    );
  });

  it("prefers a valid v3 save over older keys", () => {
    const storage = new MemoryStorage();
    const current = createState({
      highestStageCleared: 14,
      thread: 200,
      unlockedSkills: ["steady-hand", "time-seam"],
    });
    storage.setItem(PROGRESSION_SAVE_KEY, JSON.stringify(current));
    storage.setItem(
      V2_SAVE_KEY,
      JSON.stringify({ version: 2, bestStage: 3, thread: 10, muted: true }),
    );

    expect(load(storage)).toEqual(current);
  });

  it("preserves the old resume behavior when a v3 save predates campaign checkpoints", () => {
    const storage = new MemoryStorage();
    const legacyV3 = createState({ highestStageCleared: 14 });
    const stored: Record<string, unknown> = { ...legacyV3 };
    delete stored.campaignResumeStage;
    storage.setItem(PROGRESSION_SAVE_KEY, JSON.stringify(stored));

    expect(load(storage).campaignResumeStage).toBe(15);
  });

  it("shows the prologue once and safely normalizes older v3 saves", () => {
    const storage = new MemoryStorage();
    const watched = createState({ introSeen: true });
    expect(save(watched, storage)).toBe(true);
    expect(load(storage).introSeen).toBe(true);

    const oldSave: Record<string, unknown> = { ...watched };
    delete oldSave.introSeen;
    storage.setItem(PROGRESSION_SAVE_KEY, JSON.stringify(oldSave));
    expect(load(storage).introSeen).toBe(false);

    storage.setItem(
      PROGRESSION_SAVE_KEY,
      JSON.stringify({ ...watched, introSeen: "yes" }),
    );
    expect(load(storage).introSeen).toBe(false);
  });

  it("persists ad cadence and normalizes saves created before it existed", () => {
    const storage = new MemoryStorage();
    const current = createState({ adCadence: { lossesModulo: 2 } });
    expect(save(current, storage)).toBe(true);
    expect(load(storage).adCadence).toEqual({ lossesModulo: 2 });

    const oldSave: Record<string, unknown> = { ...current };
    delete oldSave.adCadence;
    storage.setItem(PROGRESSION_SAVE_KEY, JSON.stringify(oldSave));
    expect(load(storage).adCadence).toEqual({ lossesModulo: 0 });

    storage.setItem(
      PROGRESSION_SAVE_KEY,
      JSON.stringify({ ...current, adCadence: { lossesModulo: 11 } }),
    );
    expect(load(storage).adCadence).toEqual({ lossesModulo: 2 });
  });

  it("sanitizes malformed v3 values and rejects unowned equipment", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PROGRESSION_SAVE_KEY,
      JSON.stringify({
        version: 3,
        highestStageCleared: -4,
        thread: "18.9",
        premium: -8,
        muted: "yes",
        upgrades: { power: 99, precision: -2, speed: 2.8, ward: "4" },
        stats: {
          needlesThrown: "51.7",
          monstersDefeated: -1,
          bossesDefeated: 2.9,
          upgradesPurchased: "3",
        },
        ownedNeedles: ["bone", "bone", "unknown"],
        equippedNeedle: "storm",
        ownedBackgrounds: ["moon-garden", "moon-garden", "unknown"],
        equippedBackground: "star-cathedral",
        unlockedSkills: ["unknown"],
        equippedSkill: "guardian-knot",
        claimedQuestIds: ["first-fifty", "unknown", "first-fifty"],
      }),
    );

    const normalized = load(storage);
    expect(normalized).toEqual(
      createState({
        thread: 18,
        upgrades: { power: 5, precision: 0, speed: 2, ward: 4 },
        stats: {
          needlesThrown: 51,
          monstersDefeated: 0,
          bossesDefeated: 2,
          upgradesPurchased: 3,
        },
        ownedNeedles: ["silver", "bone"],
        ownedBackgrounds: ["auto", "moon-garden"],
        claimedQuestIds: ["first-fifty"],
        dailySystems: normalized.dailySystems,
      }),
    );
  });

  it("falls back safely when storage access throws", () => {
    const brokenStorage: ProgressionStorage = {
      getItem: () => {
        throw new Error("unavailable");
      },
      setItem: () => {
        throw new Error("unavailable");
      },
    };

    const state = createDefaultState();
    expect(load(brokenStorage)).toEqual(state);
    expect(save(state, brokenStorage)).toBe(false);
  });
});

describe("expensive upgrade economy", () => {
  it("uses a distinct five-level price curve for every upgrade", () => {
    expect([0, 1, 2, 3, 4].map((level) =>
      getUpgradeCost("power", level as 0 | 1 | 2 | 3 | 4),
    )).toEqual([25, 100, 180, 300, 500]);
    expect([0, 1, 2, 3, 4].map((level) =>
      getUpgradeCost("precision", level as 0 | 1 | 2 | 3 | 4),
    )).toEqual([60, 160, 280, 470, 780]);
    expect([0, 1, 2, 3, 4].map((level) =>
      getUpgradeCost("speed", level as 0 | 1 | 2 | 3 | 4),
    )).toEqual([50, 140, 250, 420, 700]);
    expect([0, 1, 2, 3, 4].map((level) =>
      getUpgradeCost("ward", level as 0 | 1 | 2 | 3 | 4),
    )).toEqual([500, 1000, 1500, 2200, 3000]);
  });

  it.each(UPGRADE_IDS)("grows every %s price through the fifth level", (id) => {
    const costs = [0, 1, 2, 3, 4].map((level) =>
      getUpgradeCost(id, level as 0 | 1 | 2 | 3 | 4),
    );

    expect(costs.every((cost) => typeof cost === "number")).toBe(true);
    for (let index = 1; index < costs.length; index += 1) {
      expect(costs[index]).toBeGreaterThan(costs[index - 1] ?? 0);
    }
    expect(getUpgradeCost(id, MAX_UPGRADE_LEVEL)).toBeNull();
  });

  it("keeps the first double-stitch accessible and later levels at one hundred or more", () => {
    expect(getUpgradeCost("power", 0)).toBeLessThan(50);
    for (const level of [1, 2, 3, 4] as const) {
      expect(getUpgradeCost("power", level)).toBeGreaterThanOrEqual(100);
    }
  });

  it("treats every ward as an endgame purchase and precision as dearer than speed", () => {
    const wardCosts = [0, 1, 2, 3, 4].map((level) =>
      getUpgradeCost("ward", level as 0 | 1 | 2 | 3 | 4) ?? 0,
    );
    expect(wardCosts[0]).toBe(500);
    for (let index = 1; index < wardCosts.length; index += 1) {
      expect(wardCosts[index] - wardCosts[index - 1]).toBeGreaterThanOrEqual(500);
    }
    for (const level of [0, 1, 2, 3, 4] as const) {
      expect(getUpgradeCost("precision", level)).toBeGreaterThan(
        getUpgradeCost("speed", level) ?? 0,
      );
    }
  });

  it("deducts thread, raises only one upgrade and records the purchase", () => {
    const state = createState({ thread: 100 });
    const purchased = purchaseUpgrade(state, "power");

    expect(purchased).not.toBe(state);
    expect(purchased.thread).toBe(75);
    expect(purchased.upgrades).toEqual({
      power: 1,
      precision: 0,
      speed: 0,
      ward: 0,
    });
    expect(purchased.stats.upgradesPurchased).toBe(1);
    expect(state).toEqual(createState({ thread: 100 }));
  });

  it("does not buy an unaffordable or maxed upgrade", () => {
    const poor = createState({ thread: 1 });
    expect(purchaseUpgrade(poor, "precision")).toBe(poor);

    const maxed = createState({
      thread: 10_000,
      upgrades: { power: 0, precision: 0, speed: 0, ward: 5 },
    });
    expect(purchaseUpgrade(maxed, "ward")).toBe(maxed);
  });
});

describe("needles, skills and backgrounds", () => {
  it("equips only active abilities unlocked by campaign progress", () => {
    const starter = createState();
    expect(equipActiveAbility(starter, "magnetic-stitch")).toBe(starter);

    const reached = createState({ highestStageCleared: 6 });
    const equipped = equipActiveAbility(reached, "magnetic-stitch");
    expect(equipped.equippedActiveAbility).toBe("magnetic-stitch");
    expect(equipped.highestStageCleared).toBe(6);
  });

  it("unlocks a random needle without repeats and uses escalating prices", () => {
    const firstState = createState({ thread: 1_000 });
    expect(getRandomNeedleUnlockCost(firstState)).toBe(90);

    const first = unlockRandomNeedle(firstState, 0);
    expect(first.thread).toBe(910);
    expect(first.ownedNeedles).toEqual(["silver", "bone"]);
    expect(first.equippedNeedle).toBe("bone");
    expect(getRandomNeedleUnlockCost(first)).toBe(240);

    const second = unlockRandomNeedle(first, 0);
    expect(second.thread).toBe(670);
    expect(second.ownedNeedles).toEqual(["silver", "bone", "storm"]);
    expect(getRandomNeedleUnlockCost(second)).toBe(520);
  });

  it("unlocks stage needles only after victories on stages 23, 25, 30 and 40", () => {
    let state = recordVictory(createState(), 22, false, 0);
    expect(state.ownedNeedles).toEqual(["silver"]);

    state = recordVictory(state, 23, false, 0);
    expect(state.ownedNeedles).toEqual(["silver", "moonweave"]);

    state = recordVictory(state, 24, false, 0);
    expect(state.ownedNeedles).toEqual(["silver", "moonweave"]);

    state = recordVictory(state, 25, false, 0);
    expect(state.ownedNeedles).toEqual(["silver", "moonweave", "velvet-thorn"]);

    state = recordVictory(state, 29, false, 0);
    expect(state.ownedNeedles).toEqual(["silver", "moonweave", "velvet-thorn"]);

    state = recordVictory(state, 30, false, 0);
    expect(state.ownedNeedles).toEqual([
      "silver",
      "moonweave",
      "velvet-thorn",
      "clockwork",
    ]);

    state = recordVictory(state, 39, false, 0);
    expect(state.ownedNeedles).toEqual([
      "silver",
      "moonweave",
      "velvet-thorn",
      "clockwork",
    ]);

    state = recordVictory(state, 40, false, 0);
    expect(state.ownedNeedles).toEqual([
      "silver",
      "moonweave",
      "velvet-thorn",
      "clockwork",
      "royal-seam",
    ]);
  });

  it("restores earned stage needles when an older high-stage save is normalized", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PROGRESSION_SAVE_KEY,
      JSON.stringify(
        createState({
          highestStageCleared: 40,
          ownedNeedles: ["silver", "bone"],
        }),
      ),
    );

    expect(load(storage).ownedNeedles).toEqual([
      "silver",
      "bone",
      "moonweave",
      "velvet-thorn",
      "clockwork",
      "royal-seam",
    ]);
  });

  it("keeps the case limited to the original four-needle collection and price ladder", () => {
    let state = createState({
      highestStageCleared: 40,
      thread: 1_000,
      ownedNeedles: ["silver"],
    });

    expect(getRandomNeedleUnlockCost(state)).toBe(90);
    state = unlockRandomNeedle(state, 0);
    expect(state.ownedNeedles).toEqual(["silver", "bone"]);
    expect(getRandomNeedleUnlockCost(state)).toBe(240);

    state = unlockRandomNeedle(state, 0);
    expect(state.ownedNeedles).toEqual(["silver", "bone", "storm"]);
    expect(getRandomNeedleUnlockCost(state)).toBe(520);

    state = unlockRandomNeedle(state, 0);
    expect(state.ownedNeedles).toEqual(["silver", "bone", "storm", "sunrise"]);
    expect(getRandomNeedleUnlockCost(state)).toBeNull();
    expect(unlockRandomNeedle(state, 0)).toBe(state);
  });

  it("does not open a random needle without enough thread or after the collection is complete", () => {
    const poor = createState({ thread: 89 });
    expect(unlockRandomNeedle(poor, 0.5)).toBe(poor);

    const complete = createState({
      thread: 10_000,
      ownedNeedles: ["silver", "bone", "storm", "sunrise"],
    });
    expect(getRandomNeedleUnlockCost(complete)).toBeNull();
    expect(unlockRandomNeedle(complete, 0.5)).toBe(complete);
  });

  it("buys and immediately equips a needle while charging its thread cost", () => {
    const state = createState({ thread: 100 });
    const purchased = buyNeedle(state, "bone");

    expect(purchased.thread).toBe(10);
    expect(purchased.ownedNeedles).toEqual(["silver", "bone"]);
    expect(purchased.equippedNeedle).toBe("bone");
    expect(state.ownedNeedles).toEqual(["silver"]);
  });

  it("equips an owned needle for free and refuses a locked one", () => {
    const owned = createState({
      thread: 10,
      ownedNeedles: ["silver", "bone"],
      equippedNeedle: "bone",
    });
    const equipped = equipNeedle(owned, "silver");

    expect(equipped.thread).toBe(10);
    expect(equipped.equippedNeedle).toBe("silver");
    const locked = createState({ thread: 1_000 });
    expect(equipNeedle(locked, "storm")).toBe(locked);
  });

  it("equips only skills that have been unlocked", () => {
    const locked = createState();
    expect(equipSkill(locked, "time-seam")).toBe(locked);

    const unlocked = createState({
      unlockedSkills: ["steady-hand", "time-seam"],
    });
    const equipped = equipSkill(unlocked, "time-seam");
    expect(equipped.equippedSkill).toBe("time-seam");
    expect(unlocked.equippedSkill).toBe("steady-hand");
  });

  it("earns a background by stage without spending premium currency", () => {
    const state = createState({ highestStageCleared: 25, premium: 30 });
    const unlocked = unlockBackground(state, "moon-garden");

    expect(unlocked.premium).toBe(30);
    expect(unlocked.ownedBackgrounds).toEqual(["auto", "moon-garden"]);
    expect(unlocked.equippedBackground).toBe("moon-garden");
  });

  it("can buy a background early with premium currency", () => {
    const state = createState({ premium: 30 });
    const unlocked = unlockBackground(state, "moon-garden");

    expect(unlocked.premium).toBe(0);
    expect(unlocked.ownedBackgrounds).toContain("moon-garden");
    expect(unlocked.equippedBackground).toBe("moon-garden");
    const poor = createState({ premium: 29 });
    expect(unlockBackground(poor, "moon-garden")).toBe(poor);
  });

  it("re-equips an owned background without charging it twice", () => {
    const state = createState({
      premium: 7,
      ownedBackgrounds: ["auto", "moon-garden"],
      equippedBackground: "auto",
    });
    const equipped = unlockBackground(state, "moon-garden");

    expect(equipped.premium).toBe(7);
    expect(equipped.ownedBackgrounds).toEqual(state.ownedBackgrounds);
    expect(equipped.equippedBackground).toBe("moon-garden");
  });
});

describe("run records", () => {
  it("records a shot without mutating the supplied state", () => {
    const state = createState();
    const recorded = recordShot(state);

    expect(recorded.stats.needlesThrown).toBe(1);
    expect(state.stats.needlesThrown).toBe(0);
    expect(recorded.stats).not.toBe(state.stats);
  });

  it("records rewards, victories and boss victories, then unlocks stage skills", () => {
    const state = createState({ thread: 10, highestStageCleared: 4 });
    const victory = recordVictory(state, 10, true, 7);

    expect(victory.thread).toBe(17);
    expect(victory.highestStageCleared).toBe(10);
    expect(victory.campaignResumeStage).toBe(11);
    expect(victory.stats.monstersDefeated).toBe(1);
    expect(victory.stats.bossesDefeated).toBe(1);
    expect(victory.unlockedSkills).toEqual(["steady-hand", "time-seam"]);
    expect(state).toEqual(createState({ thread: 10, highestStageCleared: 4 }));
  });

  it("never lowers the best cleared stage and ignores boss count for normal enemies", () => {
    const state = createState({
      highestStageCleared: 12,
      stats: {
        needlesThrown: 4,
        monstersDefeated: 3,
        bossesDefeated: 1,
        upgradesPurchased: 0,
      },
    });
    const victory = recordVictory(state, 3, false, 2);

    expect(victory.highestStageCleared).toBe(12);
    expect(victory.campaignResumeStage).toBe(4);
    expect(victory.stats.monstersDefeated).toBe(4);
    expect(victory.stats.bossesDefeated).toBe(1);
  });

  it("resets only the active campaign checkpoint after defeat", () => {
    const state = createState({
      highestStageCleared: 20,
      campaignResumeStage: 13,
      thread: 777,
      premium: 9,
      ownedNeedles: ["silver", "bone"],
      equippedNeedle: "bone",
      upgrades: { power: 2, precision: 1, speed: 3, ward: 1 },
    });

    const reset = resetCampaignAfterDefeat(state);

    expect(reset).toEqual({ ...state, campaignResumeStage: 1 });
    expect(reset.highestStageCleared).toBe(20);
    expect(reset.thread).toBe(777);
    expect(reset.ownedNeedles).toEqual(["silver", "bone"]);
  });

  it("rewards a side-route victory without advancing the campaign checkpoint", () => {
    const state = createState({
      highestStageCleared: 7,
      campaignResumeStage: 5,
      thread: 4,
    });
    const victory = recordChallengeVictory(state, true, 3);

    expect(victory.highestStageCleared).toBe(7);
    expect(victory.campaignResumeStage).toBe(5);
    expect(victory.thread).toBe(7);
    expect(victory.stats.monstersDefeated).toBe(1);
    expect(victory.stats.bossesDefeated).toBe(1);
  });
});

describe("quests", () => {
  it("derives every quest progress value from persisted state", () => {
    const state = createState({
      highestStageCleared: 10,
      ownedNeedles: ["silver", "bone"],
      stats: {
        needlesThrown: 55,
        monstersDefeated: 22,
        bossesDefeated: 4,
        upgradesPurchased: 0,
      },
    });

    expect(getQuestProgress(state, "first-fifty")).toBe(55);
    expect(getQuestProgress(state, "nightmare-hunter")).toBe(22);
    expect(getQuestProgress(state, "boss-breaker")).toBe(4);
    expect(getQuestProgress(state, "tenth-stitch")).toBe(10);
    expect(getQuestProgress(state, "needle-collector")).toBe(2);
  });

  it("refuses an incomplete quest", () => {
    const state = createState();
    expect(claimQuest(state, getQuest("first-fifty"))).toBe(state);
  });

  it("awards a completed quest exactly once", () => {
    const state = createState({
      stats: {
        needlesThrown: 50,
        monstersDefeated: 0,
        bossesDefeated: 0,
        upgradesPurchased: 0,
      },
    });
    const claimed = claimQuest(state, getQuest("first-fifty"));

    expect(claimed.thread).toBe(18);
    expect(claimed.claimedQuestIds).toEqual(["first-fifty"]);
    expect(claimQuest(claimed, getQuest("first-fifty"))).toBe(claimed);
  });

  it("can award premium currency for a collection quest", () => {
    const state = createState({ ownedNeedles: ["silver", "bone"] });
    const claimed = claimQuest(state, getQuest("needle-collector"));

    expect(claimed.premium).toBe(2);
    expect(claimed.claimedQuestIds).toEqual(["needle-collector"]);
  });
});
