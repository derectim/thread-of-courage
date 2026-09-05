import { describe, expect, it } from "vitest";
import { getBossPracticeStage } from "./BossPractice";
import { getMonsterForStage } from "./content";
import { getDefeatAdvice } from "./DefeatAdvice";

describe("practice access and defeat advice", () => {
  it("opens the next reachable boss before the player has to defeat it", () => {
    const boss = getMonsterForStage(5);
    expect(getBossPracticeStage(boss.id, 3)).toBeNull();
    expect(getBossPracticeStage(boss.id, 4)).toBe(5);
    expect(getBossPracticeStage(boss.id, 40)).toBe(5);
    expect(getBossPracticeStage(getMonsterForStage(1).id, 40)).toBeNull();
    expect(getBossPracticeStage("unknown-boss", 40)).toBeNull();
  });
  it("reports collision as the actual cause and distinguishes a direction change and nonlethal armor", () => {
    expect(getDefeatAdvice({ id: "thimble-sentinel" }, false)).toContain("Шлем только отражает");
    expect(getDefeatAdvice({ id: "moth-mask" }, true)).toContain("После смены направления");
    expect(getDefeatAdvice({ id: "moth-mask" }, false)).toContain("столкнулась с уже закреплённой");
  });
});
