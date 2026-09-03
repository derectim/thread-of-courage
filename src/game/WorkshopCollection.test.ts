import { describe, expect, it } from "vitest";

import {
  NEEDLE_MASTERY_REWARDS,
  createNeedleMasteryState,
  recordNeedleMasteryHit,
} from "./NeedleMastery";
import { SEASON_PASS_TIERS } from "./SeasonPass";
import {
  WORKSHOP_COLLECTION_SAVE_KEY,
  WORKSHOP_COLLECTIBLES,
  WORKSHOP_LEVELS,
  getWorkshopPatchArtFileName,
  createWorkshopCollectionState,
  equipWorkshopCollectible,
  getEquippedWorkshopCollectible,
  getWorkshopCollectible,
  getWorkshopCollectionSummary,
  grantWorkshopCollectible,
  loadWorkshopCollection,
  normalizeWorkshopCollectionState,
  saveWorkshopCollection,
  type WorkshopCollectionStorage,
} from "./WorkshopCollection";

class MemoryStorage implements WorkshopCollectionStorage {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const seasonRewards = SEASON_PASS_TIERS.flatMap((tier) => [
  tier.freeReward,
  tier.premiumReward,
]);

describe("WorkshopCollection catalog", () => {
  it("turns every season and mastery reward into a real collectible", () => {
    for (const reward of [...seasonRewards, ...NEEDLE_MASTERY_REWARDS]) {
      const collectible = getWorkshopCollectible(reward.id);
      expect(collectible, reward.id).not.toBeNull();
      expect(collectible?.name).toBe(reward.name);
      expect(collectible?.artKey).toBe(reward.id);
    }

    expect(
      new Set(WORKSHOP_COLLECTIBLES.map((collectible) => collectible.id)).size,
    ).toBe(WORKSHOP_COLLECTIBLES.length);
  });

  it("gives every previous reward kind an equippable destination", () => {
    const seasonKinds = new Set(
      seasonRewards.map((reward) => getWorkshopCollectible(reward.id)?.kind),
    );
    expect(seasonKinds).toEqual(
      new Set([
        "patch",
        "title",
        "portrait-frame",
        "needle-trail",
        "needle-impact",
        "workshop-ornament",
      ]),
    );

    expect(
      WORKSHOP_COLLECTIBLES.some((item) => item.kind === "name-glow"),
    ).toBe(true);
    expect(
      WORKSHOP_COLLECTIBLES.some((item) => item.kind === "name-font"),
    ).toBe(true);
  });

  it("has an individual generated image for every collectible patch", () => {
    const patches = WORKSHOP_COLLECTIBLES.filter((item) => item.kind === "patch");
    expect(patches).toHaveLength(12);
    expect(
      patches.every((patch) => getWorkshopPatchArtFileName(patch.id)?.endsWith(".webp")),
    ).toBe(true);
  });
});

describe("WorkshopCollection progression and equipment", () => {
  it("visually grows the workshop as the collection fills", () => {
    let state = createWorkshopCollectionState();
    expect(getWorkshopCollectionSummary(state)).toMatchObject({
      workshopLevel: 1,
      collectedCount: 0,
      neededForNextLevel: 4,
    });

    for (const reward of seasonRewards.slice(0, 10)) {
      state = grantWorkshopCollectible(state, reward.id);
    }

    const summary = getWorkshopCollectionSummary(state);
    expect(summary).toMatchObject({
      workshopLevel: 3,
      collectedCount: 10,
      neededForNextLevel: 8,
    });
    expect(summary.currentLevel.visualAdditions).toContain("patch-wall");
    expect(state.ownedCollectibleIds).toContain("workshop-glow-warm-thread");
    expect(state.ownedCollectibleIds).toContain("workshop-font-hand-stitch");
    expect(WORKSHOP_LEVELS.map((level) => level.requiredCollectionCount)).toEqual([
      0, 4, 10, 18, 30, 45,
    ]);
  });

  it("equips only an owned collectible in its matching slot", () => {
    const title = seasonRewards.find(
      (reward) => getWorkshopCollectible(reward.id)?.kind === "title",
    );
    const patch = seasonRewards.find(
      (reward) => getWorkshopCollectible(reward.id)?.kind === "patch",
    );
    if (!title || !patch) throw new Error("Missing fixture rewards");

    const empty = createWorkshopCollectionState();
    expect(equipWorkshopCollectible(empty, "title", title.id)).toBe(empty);

    const owned = grantWorkshopCollectible(empty, title.id);
    expect(equipWorkshopCollectible(owned, "patch", title.id)).toBe(owned);
    const equipped = equipWorkshopCollectible(owned, "title", title.id);
    expect(getEquippedWorkshopCollectible(equipped, "title")?.id).toBe(title.id);
    expect(getEquippedWorkshopCollectible(equipped, "patch")).toBeNull();
    expect(equipWorkshopCollectible(equipped, "title", null).equipped.title).toBeNull();
    expect(equipWorkshopCollectible(owned, "patch", patch.id)).toBe(owned);
  });

  it("derives entitlements from claimed season rewards and needle mastery", () => {
    const seasonTitle = seasonRewards.find(
      (reward) => getWorkshopCollectible(reward.id)?.kind === "title",
    );
    if (!seasonTitle) throw new Error("Missing season title");
    const mastery = recordNeedleMasteryHit(createNeedleMasteryState(), "silver", 30);
    const state = createWorkshopCollectionState({
      ownedSeasonCosmeticIds: [seasonTitle.id],
      needleMastery: mastery,
    });

    expect(state.ownedCollectibleIds).toContain(seasonTitle.id);
    expect(state.ownedCollectibleIds).toContain("silver-mastery-2");
    expect(state.ownedCollectibleIds).not.toContain("silver-mastery-4");
  });

  it("normalizes malformed data and migrates old flat equipment fields", () => {
    const title = seasonRewards.find(
      (reward) => getWorkshopCollectible(reward.id)?.kind === "title",
    );
    const patch = seasonRewards.find(
      (reward) => getWorkshopCollectible(reward.id)?.kind === "patch",
    );
    if (!title || !patch) throw new Error("Missing fixture rewards");

    const normalized = normalizeWorkshopCollectionState({
      version: -20,
      ownedIds: [title.id, title.id, patch.id, "not-real", 42],
      equippedTitle: title.id,
      equippedPatch: title.id,
      equippedNameGlow: "not-real",
    });

    expect(normalized.version).toBe(1);
    expect(normalized.ownedCollectibleIds).toEqual([title.id, patch.id]);
    expect(normalized.equipped.title).toBe(title.id);
    expect(normalized.equipped.patch).toBeNull();
    expect(normalized.equipped["name-glow"]).toBeNull();
  });
});

describe("WorkshopCollection local persistence", () => {
  it("round-trips equipment and safely merges later game entitlements", () => {
    const storage = new MemoryStorage();
    const title = seasonRewards.find(
      (reward) => getWorkshopCollectible(reward.id)?.kind === "title",
    );
    const patch = seasonRewards.find(
      (reward) => getWorkshopCollectible(reward.id)?.kind === "patch",
    );
    if (!title || !patch) throw new Error("Missing fixture rewards");
    const state = equipWorkshopCollectible(
      grantWorkshopCollectible(createWorkshopCollectionState(), title.id),
      "title",
      title.id,
    );

    expect(saveWorkshopCollection(state, storage)).toBe(true);
    const loaded = loadWorkshopCollection(storage, {
      ownedSeasonCosmeticIds: [patch.id],
    });
    expect(loaded.equipped.title).toBe(title.id);
    expect(loaded.ownedCollectibleIds).toEqual([title.id, patch.id]);
    expect(storage.getItem(WORKSHOP_COLLECTION_SAVE_KEY)).not.toBeNull();
  });

  it("falls back when storage is unavailable, malformed or throws", () => {
    const storage = new MemoryStorage();
    storage.setItem(WORKSHOP_COLLECTION_SAVE_KEY, "{bad-json");
    expect(loadWorkshopCollection(storage)).toEqual(
      createWorkshopCollectionState(),
    );

    const broken: WorkshopCollectionStorage = {
      getItem: () => {
        throw new Error("unavailable");
      },
      setItem: () => {
        throw new Error("unavailable");
      },
    };
    expect(loadWorkshopCollection(broken)).toEqual(
      createWorkshopCollectionState(),
    );
    expect(saveWorkshopCollection(createWorkshopCollectionState(), broken)).toBe(false);
    expect(saveWorkshopCollection(createWorkshopCollectionState(), null)).toBe(false);
  });
});
