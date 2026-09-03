import { describe, expect, it } from "vitest";

import { TAB_LABELS } from "./GameMenu";

describe("menu tab artwork", () => {
  it("maps every menu section to a unique published icon", () => {
    const entries = Object.entries(TAB_LABELS);
    const iconFiles = entries.map(([, tab]) => tab.iconFileName);

    expect(entries).toHaveLength(5);
    expect(new Set(iconFiles)).toHaveLength(5);
    expect(iconFiles.every((fileName) => fileName.endsWith(".webp"))).toBe(true);
  });

});
