import { describe, expect, it } from "vitest";
import { COSMETIC_SHOP_OFFERS } from "./CosmeticShop";
import { createDefaultState, load, purchaseThreadCosmetic, save } from "./ProgressionStore";
import { equipWorkshopCollectible, getWorkshopCollectible } from "./WorkshopCollection";

describe("cosmetics for thread", () => {
  it("exchanges the exact price for one permanent cosmetic without changing upgrades or premium currency", () => {
    const initial = {...createDefaultState(),thread:COSMETIC_SHOP_OFFERS[0].cost};
    const id = COSMETIC_SHOP_OFFERS[0].collectible.id;
    const next = purchaseThreadCosmetic(initial,id);
    expect(next.thread).toBe(0);
    expect(next.workshopCollection.ownedCollectibleIds).toContain(id);
    expect(next.upgrades).toBe(initial.upgrades);
    expect(next.premium).toBe(initial.premium);
    expect(next.ownedSeasonCosmetics).toEqual([]);
    expect(getWorkshopCollectible(id)?.cosmeticOnly).toBe(true);
  });

  it("cannot charge twice, overspend, or buy an unknown item", () => {
    const initial = {...createDefaultState(),thread:COSMETIC_SHOP_OFFERS[0].cost * 2};
    const id = COSMETIC_SHOP_OFFERS[0].collectible.id;
    const next = purchaseThreadCosmetic(initial,id);
    expect(purchaseThreadCosmetic(next,id)).toBe(next);
    const shortByOne = {...initial,thread:COSMETIC_SHOP_OFFERS[0].cost - 1};
    expect(purchaseThreadCosmetic(shortByOne,id)).toBe(shortByOne);
    expect(purchaseThreadCosmetic(createDefaultState(),id).thread).toBe(0);
    expect(purchaseThreadCosmetic(initial,"not-a-product")).toBe(initial);
  });

  it("keeps every purchased and equipped cosmetic after reload", () => {
    const values = new Map<string,string>();
    const storage = {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
    let state = {...createDefaultState(),thread:COSMETIC_SHOP_OFFERS.reduce((total,offer)=>total+offer.cost,0)};
    for (const offer of COSMETIC_SHOP_OFFERS) {
      state = purchaseThreadCosmetic(state,offer.collectible.id);
      state = {...state,workshopCollection:equipWorkshopCollectible(state.workshopCollection,offer.collectible.kind,offer.collectible.id)};
    }
    expect(state.thread).toBe(0);
    save(state,storage);
    const restored = load(storage);
    expect(restored.thread).toBe(0);
    for (const offer of COSMETIC_SHOP_OFFERS) {
      expect(restored.workshopCollection.equipped[offer.collectible.kind]).toBe(offer.collectible.id);
      expect(restored.workshopCollection.ownedCollectibleIds).toContain(offer.collectible.id);
    }
  });

  it("keeps cosmetics bought at the old price without charging the difference", () => {
    const id = COSMETIC_SHOP_OFFERS[0].collectible.id;
    const initial = createDefaultState();
    const oldSave = {...initial,thread:270,premium:9,workshopCollection:{...initial.workshopCollection,ownedCollectibleIds:[id]}};
    const restored = load({getItem:()=>JSON.stringify(oldSave),setItem:()=>{}});
    expect(restored.workshopCollection.ownedCollectibleIds).toContain(id);
    expect(restored.thread).toBe(270);
    expect(restored.premium).toBe(9);
    expect(purchaseThreadCosmetic(restored,id)).toBe(restored);
  });
});
