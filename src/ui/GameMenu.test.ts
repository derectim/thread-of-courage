import { describe, expect, it } from "vitest";

import {
  getBestiaryThreatLabel,
  resolvePanelScrollRestoration,
  TAB_LABELS,
} from "./GameMenu";

describe("menu tab artwork", () => {
  it("maps every menu section to a unique published icon", () => {
    const entries = Object.entries(TAB_LABELS);
    const iconFiles = entries.map(([, tab]) => tab.iconFileName);

    expect(entries).toHaveLength(5);
    expect(new Set(iconFiles)).toHaveLength(5);
    expect(iconFiles.every((fileName) => fileName.endsWith(".webp"))).toBe(true);
  });

});

describe("bestiary threat labels", () => {
  it("distinguishes mini-bosses from main bosses", () => {
    expect(getBestiaryThreatLabel({})).toBe("");
    expect(getBestiaryThreatLabel({ isMiniBoss: true })).toBe("МИНИ-БОСС");
    expect(getBestiaryThreatLabel({ isBoss: true })).toBe("БОСС");
  });
});

describe("menu panel scroll restoration", () => {
  it("restores the same panel after returning from gameplay without relying on focus", () => {
    expect(resolvePanelScrollRestoration("quests", "quests", 640)).toBe(640);
    expect(resolvePanelScrollRestoration("quests", "quests", 0)).toBe(0);
  });

  it("does not carry a saved position into another panel or the home screen", () => {
    expect(resolvePanelScrollRestoration("quests", "needles", 640)).toBeUndefined();
    expect(resolvePanelScrollRestoration("quests", "home", 640)).toBeUndefined();
    expect(resolvePanelScrollRestoration(undefined, "quests", 640)).toBeUndefined();
  });
});
