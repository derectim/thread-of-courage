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
  equipSkill,
  getQuestProgress,
  getUpgradeCost,
  load,
  purchaseUpgrade,
  recordShot,
  recordVictory,
  save,
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
      thread: 875,
      premium: 42,
      muted: true,
      upgrades: { power: 2, precision: 1, speed: 3, ward: 1 },
      stats: {
        needlesThrown: 321,
        monstersDefeated: 27,
        bossesDefeated: 5,
        upgradesPurchased: 7,
      },
      ownedNeedles: ["silver", "bone", "storm"],
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

    expect(load(storage)).toEqual(
      createState({
        highestStageCleared: 8,
        thread: 123,
        muted: true,
        stats: {
          needlesThrown: 0,
          monstersDefeated: 8,
          bossesDefeated: 1,
          upgradesPurchased: 0,
        },
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

    expect(load(storage)).toEqual(
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
  it("uses the raised first-level prices", () => {
    expect(getUpgradeCost("speed", 0)).toBe(22);
    expect(getUpgradeCost("precision", 0)).toBe(26);
    expect(getUpgradeCost("power", 0)).toBe(30);
    expect(getUpgradeCost("ward", 0)).toBe(36);
  });

  it.each(UPGRADE_IDS)("grows every %s price through an expensive fifth level", (id) => {
    const costs = [0, 1, 2, 3, 4].map((level) =>
      getUpgradeCost(id, level as 0 | 1 | 2 | 3 | 4),
    );

    expect(costs.every((cost) => typeof cost === "number")).toBe(true);
    for (let index = 1; index < costs.length; index += 1) {
      expect(costs[index]).toBeGreaterThan(costs[index - 1] ?? 0);
    }
    expect(costs[4]).toBe((costs[0] ?? 0) * 8);
    expect(getUpgradeCost(id, MAX_UPGRADE_LEVEL)).toBeNull();
  });

  it("deducts thread, raises only one upgrade and records the purchase", () => {
    const state = createState({ thread: 100 });
    const purchased = purchaseUpgrade(state, "power");

    expect(purchased).not.toBe(state);
    expect(purchased.thread).toBe(70);
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
  it("buys and immediately equips a needle while charging its thread cost", () => {
    const state = createState({ thread: 100 });
    const purchased = buyNeedle(state, "bone");

    expect(purchased.thread).toBe(10);
    expect(purchased.ownedNeedles).toEqual(["silver", "bone"]);
    expect(purchased.equippedNeedle).toBe("bone");
    expect(state.ownedNeedles).toEqual(["silver"]);
  });

  it("equips an owned needle for free and refuses an unaffordable one", () => {
    const owned = createState({
      thread: 10,
      ownedNeedles: ["silver", "bone"],
      equippedNeedle: "bone",
    });
    const equipped = buyNeedle(owned, "silver");

    expect(equipped.thread).toBe(10);
    expect(equipped.equippedNeedle).toBe("silver");
    const poor = createState({ thread: 239 });
    expect(buyNeedle(poor, "storm")).toBe(poor);
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
    expect(victory.stats.monstersDefeated).toBe(4);
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
