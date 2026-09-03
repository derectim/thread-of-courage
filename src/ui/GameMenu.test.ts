import { describe, expect, it } from "vitest";

import { getBestiaryThreatLabel, TAB_LABELS } from "./GameMenu";

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
