import { describe, expect, it } from "vitest";

import {
  NEEDLE_MASTERY_REWARDS,
  createNeedleMasteryState,
  recordNeedleMasteryHit,
} from "./NeedleMastery";
import { SEASON_PASS_TIERS } from "./SeasonPass";
import {
  WEEKLY_ROUTE_REWARD_VARIANTS,
  createWeeklyRoute,
} from "./WeeklyRoute";
import {
  WORKSHOP_COLLECTION_SAVE_KEY,
  WORKSHOP_COLLECTIBLES,
  WORKSHOP_FRAME_ART,
  WORKSHOP_IMPACT_ART,
  WORKSHOP_LEVELS,
  WORKSHOP_ORNAMENT_ART,
  getWorkshopFrameArtFileName,
  getWorkshopImpactArtFileName,
  getWorkshopOrnamentArtFileName,
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

  it("registers all four stable weekly emblems as equippable patches", () => {
    for (const reward of WEEKLY_ROUTE_REWARD_VARIANTS) {
      expect(getWorkshopCollectible(reward.id)).toMatchObject({
        id: reward.id,
        kind: "patch",
        source: "weekly-route",
        sourceId: reward.variant,
        name: reward.name,
        artKey: reward.id,
        cosmeticOnly: true,
      });
    }
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
    expect(patches).toHaveLength(20);
    expect(
      patches.every((patch) => getWorkshopPatchArtFileName(patch.id)?.endsWith(".webp")),
    ).toBe(true);
    expect(
      Object.fromEntries(
        WEEKLY_ROUTE_REWARD_VARIANTS.map((reward) => [
          reward.variant,
          getWorkshopPatchArtFileName(reward.id),
        ]),
      ),
    ).toEqual({
      "moon-thimble": "patch-weekly-moon-thimble.webp",
      "golden-spool": "patch-weekly-golden-spool.webp",
      "owl-eye": "patch-weekly-owl-eye.webp",
      "pattern-heart": "patch-weekly-pattern-heart.webp",
    });
  });

  it("maps every collectible portrait frame to its runtime art", () => {
    const frames = WORKSHOP_COLLECTIBLES.filter(
      (item) => item.kind === "portrait-frame",
    );
    expect(
      Object.fromEntries(
        frames.map((frame) => [frame.id, getWorkshopFrameArtFileName(frame.id)]),
      ),
    ).toEqual({
      "living-thread-01-free-5": "frame-blue-stitch.webp",
      "living-thread-01-free-10": "frame-warm-felt.webp",
      "living-thread-01-free-16": "frame-spool-wreath.webp",
      "living-thread-01-premium-1": "frame-golden-eye.webp",
      "living-thread-01-premium-7": "frame-thread-theatre.webp",
      "living-thread-01-premium-13": "frame-mechanical-lace.webp",
      "living-thread-01-premium-19": "frame-living-thread.webp",
    });
    expect(Object.keys(WORKSHOP_FRAME_ART)).toHaveLength(frames.length);
    expect(
      frames.every((frame) => Boolean(getWorkshopFrameArtFileName(frame.id)?.trim())),
    ).toBe(true);
  });

  it("maps every collectible workshop ornament to its runtime art", () => {
    const ornaments = WORKSHOP_COLLECTIBLES.filter(
      (item) => item.kind === "workshop-ornament",
    );
    expect(
      Object.fromEntries(
        ornaments.map((ornament) => [
          ornament.id,
          getWorkshopOrnamentArtFileName(ornament.id),
        ]),
      ),
    ).toEqual({
      "living-thread-01-free-6": "ornament-small-spool.webp",
      "living-thread-01-free-12": "ornament-apprentice-scissors.webp",
      "living-thread-01-free-19": "ornament-moon-pattern.webp",
      "living-thread-01-premium-6": "ornament-golden-shuttle.webp",
      "living-thread-01-premium-12": "ornament-seamstress-clock.webp",
      "living-thread-01-premium-18": "ornament-golden-machine-heart.webp",
    });
    expect(Object.keys(WORKSHOP_ORNAMENT_ART)).toHaveLength(ornaments.length);
    expect(
      ornaments.every((ornament) =>
        Boolean(getWorkshopOrnamentArtFileName(ornament.id)?.trim()),
      ),
    ).toBe(true);
  });

  it("maps every collectible needle impact to its runtime art", () => {
    const impacts = WORKSHOP_COLLECTIBLES.filter(
      (item) => item.kind === "needle-impact",
    );
    expect(
      Object.fromEntries(
        impacts.map((impact) => [
          impact.id,
          getWorkshopImpactArtFileName(impact.id),
        ]),
      ),
    ).toEqual({
      "living-thread-01-free-3": "impact-wool-puff.webp",
      "living-thread-01-free-11": "impact-button-spark.webp",
      "living-thread-01-free-17": "impact-golden-knot.webp",
      "living-thread-01-premium-4": "impact-silk-stars.webp",
      "living-thread-01-premium-10": "impact-scattered-gems.webp",
      "living-thread-01-premium-16": "impact-stitch-crown.webp",
      "silver-mastery-4": "impact-moon-sparks.webp",
      "bone-mastery-4": "impact-runic-shard.webp",
      "storm-mastery-4": "impact-thunder-knot.webp",
      "sunrise-mastery-4": "impact-dawn-petals.webp",
      "moonweave-mastery-4": "impact-moon-tide-v1.webp",
      "velvet-thorn-mastery-4": "impact-velvet-rose-v1.webp",
      "clockwork-mastery-4": "impact-clockwork-strike-v1.webp",
      "royal-seam-mastery-4": "impact-amethyst-crown-v1.webp",
    });
    expect(Object.keys(WORKSHOP_IMPACT_ART)).toHaveLength(impacts.length);
    expect(
      impacts.every((impact) =>
        Boolean(getWorkshopImpactArtFileName(impact.id)?.trim()),
      ),
    ).toBe(true);
  });

  it("returns no frame, ornament or impact art for other kinds and unknown ids", () => {
    for (const collectible of WORKSHOP_COLLECTIBLES) {
      if (collectible.kind !== "portrait-frame") {
        expect(getWorkshopFrameArtFileName(collectible.id)).toBeNull();
      }
      if (collectible.kind !== "workshop-ornament") {
        expect(getWorkshopOrnamentArtFileName(collectible.id)).toBeNull();
      }
      if (collectible.kind !== "needle-impact") {
        expect(getWorkshopImpactArtFileName(collectible.id)).toBeNull();
      }
    }
    expect(getWorkshopFrameArtFileName("unknown-collectible")).toBeNull();
    expect(getWorkshopOrnamentArtFileName("unknown-collectible")).toBeNull();
    expect(getWorkshopImpactArtFileName("unknown-collectible")).toBeNull();
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

  it("keeps a weekly emblem entitlement and allows equipping it as a patch", () => {
    const weeklyId = createWeeklyRoute("2026-W36").finalReward.id;
    const state = createWorkshopCollectionState({
      ownedSeasonCosmeticIds: [weeklyId],
    });

    expect(state.ownedCollectibleIds).toContain(weeklyId);
    const equipped = equipWorkshopCollectible(state, "patch", weeklyId);
    expect(getEquippedWorkshopCollectible(equipped, "patch")?.id).toBe(weeklyId);
  });

  it("migrates old per-week emblem IDs to their stable collectible", () => {
    const route = createWeeklyRoute("2026-W36");
    const legacyId = `weekly-emblem-${route.weekId}`;
    const state = normalizeWorkshopCollectionState(
      { ownedCollectibleIds: [legacyId] },
      { ownedSeasonCosmeticIds: [legacyId] },
    );

    expect(state.ownedCollectibleIds).toContain(route.finalReward.id);
    expect(state.ownedCollectibleIds).not.toContain(legacyId);
    expect(
      grantWorkshopCollectible(createWorkshopCollectionState(), legacyId)
        .ownedCollectibleIds,
    ).toContain(route.finalReward.id);
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
