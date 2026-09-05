import { describe, expect, it } from "vitest";
import { createDefaultState, purchaseThreadCosmetic, recordVictory } from "./ProgressionStore";
import { COSMETIC_SHOP_OFFERS } from "./CosmeticShop";
import { getNextGoal } from "./NextGoal";
import { addSeasonPassXp } from "./SeasonPass";

describe("one next goal", () => {
  it("gives a new player a concrete boss and a playable destination", () => {
    expect(getNextGoal(createDefaultState())).toMatchObject({destination:"run",target:5,progress:0,ready:false});
  });
  it("prioritizes an unchosen boss reward over other goals", () => {
    expect(getNextGoal(recordVictory(createDefaultState(),5,true,3))).toMatchObject({destination:"run",ready:true,title:"Выбери узор похода"});
  });
  it("points to earned season rewards instead of sending the player to grind more", () => {
    const initial = createDefaultState();
    expect(getNextGoal({...initial,seasonPass:addSeasonPassXp(initial.seasonPass,100)})).toMatchObject({destination:"season",ready:true});
  });
  it("moves the collection goal forward after purchase", () => {
    const initial = {...createDefaultState(),thread:30};
    expect(getNextGoal(initial)).toMatchObject({destination:"cosmetics",ready:true,title:COSMETIC_SHOP_OFFERS[0].collectible.name});
    const next = {...purchaseThreadCosmetic(initial,COSMETIC_SHOP_OFFERS[0].collectible.id),thread:20};
    expect(getNextGoal(next)).toMatchObject({destination:"cosmetics",ready:false,target:60,progress:20,title:COSMETIC_SHOP_OFFERS[1].collectible.name});
  });
  it("surfaces a nearby ability unlock with its real threshold", () => {
    expect(getNextGoal({...createDefaultState(),highestStageCleared:4,campaignResumeStage:5})).toMatchObject({destination:"abilities",target:6,progress:4,title:"Магнитный стежок"});
  });
});
