import { describe, expect, it } from "vitest";
import { createDefaultState, setCosmeticGoal, purchaseThreadCosmetic, recordVictory, recordChallengeVictory, resetCampaignAfterDefeat, chooseCampaignDetour, completeCampaignDetour, load, save, PROGRESSION_SAVE_KEY } from "./ProgressionStore";
import { COSMETIC_SHOP_OFFERS } from "./CosmeticShop";
import { CAMPAIGN_CHAPTERS, finishCampaignStory, getCampaignChapter } from "./CampaignStory";
import { getFirstCampaignStageForMonster } from "./content";
import { getDetourReward } from "./CampaignDetour";
import { getNextGoal } from "./NextGoal";

function memory() {
  const entries = new Map<string, string>();
  return { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
}

describe("a chosen cosmetic goal", () => {
  const id = COSMETIC_SHOP_OFFERS[3].collectible.id;
  it("persists a choice and prioritizes it even when another cosmetic is affordable", () => {
    const state = setCosmeticGoal({ ...createDefaultState(), thread: 600 }, id);
    const storage = memory(); save(state, storage);
    expect(getNextGoal(load(storage))).toMatchObject({ title: COSMETIC_SHOP_OFFERS[3].collectible.name, target: 4000, progress: 600, ready: false });
    expect(getNextGoal(setCosmeticGoal(createDefaultState(), id))).toMatchObject({ progress: 0, destination: "cosmetics" });
  });
  it("clears the goal on purchase and rejects unknown or already owned choices", () => {
    const initial = createDefaultState();
    expect(setCosmeticGoal(initial, "unknown")).toBe(initial);
    const selected = setCosmeticGoal({ ...initial, thread: 4000 }, id);
    expect(getNextGoal(selected).ready).toBe(true);
    const bought = purchaseThreadCosmetic(selected, id);
    expect(bought.cosmeticGoalId).toBeNull();
    expect(setCosmeticGoal(bought, id)).toBe(bought);
    expect(setCosmeticGoal(selected, null).cosmeticGoalId).toBeNull();
    const otherPurchase = purchaseThreadCosmetic({ ...selected, thread: 5000 }, COSMETIC_SHOP_OFFERS[0].collectible.id);
    expect(otherPurchase.cosmeticGoalId).toBe(id);
  });
});

describe("first boss story chapters", () => {
  it.each(CAMPAIGN_CHAPTERS)("offers $title once and keeps its completion after a campaign loss", chapter => {
    const stage = getFirstCampaignStageForMonster(chapter.bossId)!;
    const won = recordVictory(createDefaultState(), stage, true, 3);
    expect(won.campaignStory.pendingBossId).toBe(chapter.bossId);
    expect(getCampaignChapter(won.campaignStory.pendingBossId)).toBe(chapter);
    const finished = { ...won, campaignStory: finishCampaignStory(won.campaignStory) };
    const repeated = recordVictory(resetCampaignAfterDefeat(finished), stage, true, 3);
    expect(repeated.campaignStory.pendingBossId).toBeNull();
    expect(repeated.campaignStory.seenBossIds).toContain(chapter.bossId);
  });
  it("preserves an unread chapter and the paid victory across reload", () => {
    const won = recordVictory(createDefaultState(), 5, true, 3);
    const storage = memory(); save(won, storage);
    const restored = load(storage);
    expect(restored.campaignStory.pendingBossId).toBe("sewing-storm");
    expect(restored.campaignResumeStage).toBe(6);
    expect(restored.thread).toBe(3);
    expect(restored.campaignBoons.pendingBossStage).toBe(5);
    expect(getNextGoal(restored)).toMatchObject({ destination: "run", title: "Тишина после бури" });
    expect(recordChallengeVictory(createDefaultState(), true, 3).campaignStory.pendingBossId).toBeNull();
  });
  it("does not enqueue old bosses or erase currency when migrating an earlier save", () => {
    const storage = memory();
    storage.setItem(PROGRESSION_SAVE_KEY, JSON.stringify({ version: 3, thread: 270, premium: 9, highestStageCleared: 19, campaignResumeStage: 4, cosmeticGoalId: "not-a-product" }));
    const migrated = load(storage);
    expect(migrated.campaignStory).toEqual({ seenBossIds: ["sewing-storm", "moth-mask", "madam-marionette"], pendingBossId: null });
    expect(migrated.cosmeticGoalId).toBeNull();
    expect(migrated.thread).toBe(270); expect(migrated.premium).toBe(9);
  });
});

describe("a voluntary campaign detour", () => {
  it("offers a rare choice at stage 7 and can skip it without spending or granting rewards", () => {
    const won = recordVictory(createDefaultState(), 7, false, 2);
    expect(won.campaignDetour).toEqual({ stage: 7, status: "offered" });
    const skipped = chooseCampaignDetour(won, false);
    expect(skipped).toEqual({ ...won, campaignDetour: null });
    expect(completeCampaignDetour(won)).toBe(won);
    expect(recordVictory(skipped, 8, false, 3).campaignDetour).toBeNull();
    expect(recordVictory(skipped, 17, false, 2).campaignDetour?.stage).toBe(17);
  });
  it("resumes an accepted encounter and grants exactly its thread payout once", () => {
    const won = recordVictory({ ...createDefaultState(), premium: 9 }, 7, false, 2);
    const active = chooseCampaignDetour(won, true);
    const storage = memory(); save(active, storage);
    const restored = load(storage);
    expect(restored.campaignDetour).toEqual({ stage: 7, status: "active" });
    expect(chooseCampaignDetour(restored, false)).toBe(restored);
    const completed = completeCampaignDetour(restored);
    expect(completed).toEqual({ ...restored, thread: 22, campaignDetour: null });
    expect(completeCampaignDetour(completed)).toBe(completed);
    save(completed, storage);
    expect(completeCampaignDetour(load(storage)).thread).toBe(22);
  });
  it("ends the campaign on defeat while preserving owned items, currencies and selected goal", () => {
    const goal = COSMETIC_SHOP_OFFERS[0].collectible.id;
    const active = chooseCampaignDetour(recordVictory(setCosmeticGoal({ ...createDefaultState(), thread: 270, premium: 9 }, goal), 7, false, 2), true);
    const failed = resetCampaignAfterDefeat(active);
    expect(failed.campaignResumeStage).toBe(1);
    expect(failed.campaignDetour).toBeNull();
    expect(failed.thread).toBe(272); expect(failed.premium).toBe(9);
    expect(failed.cosmeticGoalId).toBe(goal);
    expect(failed.workshopCollection).toBe(active.workshopCollection);
  });
  it("rejects stale or malformed encounters on load and bounds later payouts", () => {
    const storage = memory();
    for (const stage of [6, 17, -7, 7.5]) {
      storage.setItem(PROGRESSION_SAVE_KEY, JSON.stringify({ ...createDefaultState(), highestStageCleared: 7, campaignResumeStage: 8, campaignDetour: { stage, status: "active" } }));
      expect(load(storage).campaignDetour).toBeNull();
    }
    expect(getDetourReward(7)).toBe(20); expect(getDetourReward(17)).toBe(25); expect(getDetourReward(107)).toBe(40); expect(getDetourReward(8)).toBe(0);
  });
});
