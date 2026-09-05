import { describe, expect, it } from "vitest";
import { CAMPAIGN_BOON_IDS, chooseCampaignBoon, createCampaignBoonsState, getCampaignBoonEffects, normalizeCampaignBoons, offerCampaignBoon } from "./CampaignBoons";
import { createDefaultState, load, recordChallengeVictory, recordVictory, resetCampaignAfterDefeat, save } from "./ProgressionStore";
import { getMonsterForStage } from "./content";

describe("temporary campaign boons", () => {
  it("offers a choice for a main campaign boss, but not for regular, mini or weekly encounters", () => {
    const initial = createDefaultState();
    expect(recordVictory(initial, 1, false, 2).campaignBoons.pendingBossStage).toBeNull();
    expect(recordVictory(initial, 3, false, 3).campaignBoons.pendingBossStage).toBeNull();
    expect(recordVictory(initial, 5, true, 3).campaignBoons.pendingBossStage).toBe(5);
    expect(recordChallengeVictory(initial, true, 3).campaignBoons).toBe(initial.campaignBoons);
  });

  it("accepts exactly one choice for a boss and applies a benefit only after selection", () => {
    const offered = offerCampaignBoon(createCampaignBoonsState(), 5);
    expect(getCampaignBoonEffects(offered)).toEqual({rotationMultiplier:1,gapMultiplier:1,extraThread:0});
    const chosen = chooseCampaignBoon(offered, "generous-spool");
    expect(getCampaignBoonEffects(chosen).extraThread).toBe(1);
    expect(chooseCampaignBoon(chosen, "quiet-turn")).toBe(chosen);
    expect(offerCampaignBoon(chosen, 5)).toBe(chosen);
    expect(chosen.pendingBossStage).toBeNull();
  });

  it("caps each benefit, offers other choices, and stops offering when every pattern is full", () => {
    let state = createCampaignBoonsState();
    const bosses = Array.from({length:100},(_,i)=>i+1).filter(stage=>getMonsterForStage(stage).isBoss);
    let index = 0;
    for (const id of CAMPAIGN_BOON_IDS) {
      for (let level=0;level<3;level++) state = chooseCampaignBoon(offerCampaignBoon(state, bosses[index++]), id);
      if (index < 9) {
        const offered = offerCampaignBoon(state, bosses[index]);
        expect(chooseCampaignBoon(offered, id)).toBe(offered);
      }
    }
    expect(getCampaignBoonEffects(state).rotationMultiplier).toBeCloseTo(0.82);
    expect(getCampaignBoonEffects(state).gapMultiplier).toBeCloseTo(0.82);
    expect(getCampaignBoonEffects(state).extraThread).toBe(3);
    expect(offerCampaignBoon(state, bosses[index])).toBe(state);
  });

  it("preserves the pending choice and chosen benefits across saving, but clears them after defeat", () => {
    const data = new Map<string,string>();
    const storage = {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
    const victory = recordVictory(createDefaultState(),5,true,3);
    save(victory, storage);
    expect(load(storage).campaignBoons.pendingBossStage).toBe(5);
    const chosen = {...victory,campaignBoons:chooseCampaignBoon(victory.campaignBoons,"quiet-turn")};
    save(chosen,storage);
    expect(load(storage).campaignBoons).toEqual(chosen.campaignBoons);
    const defeat = resetCampaignAfterDefeat(load(storage));
    expect(defeat.campaignBoons).toEqual(createCampaignBoonsState());
    expect(defeat.thread).toBe(3);
    expect(defeat.highestStageCleared).toBe(5);
  });

  it("normalizes old and malformed saves without a phantom bonus", () => {
    expect(normalizeCampaignBoons(undefined, 12)).toEqual(createCampaignBoonsState());
    expect(normalizeCampaignBoons({choices:[{stage:5,id:"quiet-turn"}],pendingBossStage:5},1)).toEqual(createCampaignBoonsState());
    const state = normalizeCampaignBoons({choices:[{stage:1,id:"quiet-turn"},{stage:5,id:"quiet-turn"},{stage:5,id:"generous-spool"},{stage:10,id:"unknown"},{stage:15,id:"close-stitch"}],pendingBossStage:10},11);
    expect(state).toEqual({choices:[{stage:5,id:"quiet-turn"}],pendingBossStage:10});
  });
});
