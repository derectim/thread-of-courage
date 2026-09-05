import { describe, expect, it } from "vitest";
import { claimQuest, createDefaultState, load, PROGRESSION_SAVE_KEY, save } from "./ProgressionStore";
import { COSMETIC_SHOP_OFFERS } from "./CosmeticShop";
import { equipWorkshopCollectible, grantWorkshopCollectible } from "./WorkshopCollection";
import { DAILY_QUESTS, getStreakChestReward } from "./DailySystems";
import { QUESTS } from "./meta";
import { WEEKLY_ROUTE_BUTTON_REWARD } from "./WeeklyRoute";

describe("two-currency economy", () => {
  it("converts legacy fragments once at unchanged buying power and preserves owned cosmetics and premium", () => {
    const item = COSMETIC_SHOP_OFFERS[0].collectible;
    const initial = createDefaultState();
    const collection = equipWorkshopCollectible(grantWorkshopCollectible(initial.workshopCollection, item.id), item.kind, item.id);
    const values = new Map([[PROGRESSION_SAVE_KEY, JSON.stringify({ ...initial, thread: 17, premium: 42, cosmeticFragments: 18, workshopCollection: collection })]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const migrated = load(storage);
    expect(migrated.thread).toBe(107);
    expect(migrated.premium).toBe(42);
    expect(migrated).not.toHaveProperty("cosmeticFragments");
    expect(migrated.workshopCollection.equipped.title).toBe(item.id);
    expect(save(migrated, storage)).toBe(true);
    expect(load(storage)).toEqual(migrated);
    save(load(storage), storage);
    expect(load(storage).thread).toBe(107);
    expect(values.get(PROGRESSION_SAVE_KEY)).not.toContain("cosmeticFragments");
  });
  it("does not grant premium currency from repeatable dailies or any streak chest", () => {
    for (const reward of [...DAILY_QUESTS.map(q => q.reward), ...Array.from({ length: 200 }, (_, i) => getStreakChestReward((i + 1) * 5))]) {
      expect(reward.buttonReward ?? 0).toBe(0);
      expect(reward).not.toHaveProperty("cosmeticFragments");
      expect(reward.thread).toBeGreaterThan(0);
    }
    expect(WEEKLY_ROUTE_BUTTON_REWARD).toBe(2);
  });
  it("reserves one-time premium rewards for stages 20 and 40 and cannot claim them twice", () => {
    const rare = QUESTS.filter(q => q.rewardPremium > 0);
    expect(rare.map(q => [q.target, q.rewardPremium])).toEqual([[20, 3], [40, 5]]);
    let state = { ...createDefaultState(), highestStageCleared: 19 };
    expect(claimQuest(state, rare[0])).toBe(state);
    state = claimQuest({ ...state, highestStageCleared: 20 }, rare[0]);
    expect(state.premium).toBe(3);
    expect(claimQuest(state, rare[0])).toBe(state);
    expect(claimQuest(state, rare[1])).toBe(state);
    state = claimQuest({ ...state, highestStageCleared: 40 }, rare[1]);
    expect(state.premium).toBe(8);
    expect(claimQuest(state, rare[1])).toBe(state);
  });
});
