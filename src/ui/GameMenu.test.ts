import { describe, expect, it } from "vitest";

import {
  QUEST_PAGE_LABELS,
  LOCKED_REWARD_ART_FILE_NAME,
  LOCKED_REWARD_DESCRIPTION,
  LOCKED_REWARD_NAME,
  UPGRADE_PAGE_LABELS,
  WORKSHOP_PAGE_KINDS,
  WORKSHOP_PAGE_LABELS,
  getCollectibleRewardPresentation,
  getBestiaryThreatLabel,
  getMenuPanelKey,
  resolvePanelScrollRestoration,
  TAB_LABELS,
} from "./GameMenu";
import {
  WORKSHOP_COLLECTIBLE_KINDS,
  WORKSHOP_COLLECTIBLES,
} from "../game/WorkshopCollection";

describe("menu tab artwork", () => {
  it("maps every menu section to a unique published icon", () => {
    const entries = Object.entries(TAB_LABELS);
    const iconFiles = entries.map(([, tab]) => tab.iconFileName);

    expect(entries).toHaveLength(5);
    expect(new Set(iconFiles)).toHaveLength(5);
    expect(iconFiles.every((fileName) => fileName.endsWith(".webp"))).toBe(true);
  });

});

describe("compact menu sections", () => {
  it("keeps stable, unique labels for upgrades and quests", () => {
    expect(Object.keys(UPGRADE_PAGE_LABELS)).toEqual([
      "permanent",
      "active",
      "passive",
    ]);
    expect(Object.keys(QUEST_PAGE_LABELS)).toEqual([
      "daily",
      "weekly",
      "chronicle",
    ]);
    expect(new Set(Object.values(UPGRADE_PAGE_LABELS))).toHaveLength(3);
    expect(new Set(Object.values(QUEST_PAGE_LABELS))).toHaveLength(3);
  });

  it("places every workshop reward kind on exactly one book page", () => {
    expect(Object.keys(WORKSHOP_PAGE_LABELS)).toEqual([
      "profile",
      "needle",
      "room",
    ]);
    const kinds = Object.values(WORKSHOP_PAGE_KINDS).flat();
    expect(kinds).toHaveLength(WORKSHOP_COLLECTIBLE_KINDS.length);
    expect(new Set(kinds)).toEqual(new Set(WORKSHOP_COLLECTIBLE_KINDS));
  });
});

describe("mystery reward presentation", () => {
  it("never exposes the name or description of an unowned collectible", () => {
    expect(LOCKED_REWARD_ART_FILE_NAME).toBe(
      "ui-reward-mystery-parcel.webp",
    );
    for (const collectible of WORKSHOP_COLLECTIBLES) {
      expect(getCollectibleRewardPresentation(collectible, false)).toEqual({
        name: LOCKED_REWARD_NAME,
        description: LOCKED_REWARD_DESCRIPTION,
        revealed: false,
      });
    }
  });

  it("reveals the real collectible copy only after it is owned", () => {
    for (const collectible of WORKSHOP_COLLECTIBLES) {
      expect(getCollectibleRewardPresentation(collectible, true)).toEqual({
        name: collectible.name.replace(/^Титул «|»$/g, ""),
        description: collectible.description,
        revealed: true,
      });
    }
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

  it("keeps the needles panel stable while another needle is previewed", () => {
    expect(getMenuPanelKey("needles", "permanent", "daily")).toBe("needles");
    expect(getMenuPanelKey("needles", "active", "weekly")).toBe("needles");
    expect(getMenuPanelKey("upgrades", "active", "daily")).toBe("upgrades:active");
    expect(getMenuPanelKey("quests", "permanent", "weekly")).toBe("quests:weekly");
    expect(getMenuPanelKey("shop", "permanent", "daily", "album")).toBe("shop:album");
    expect(getMenuPanelKey("shop", "permanent", "daily", "tasks")).toBe("shop:tasks");
    expect(getMenuPanelKey("shop", "permanent", "daily", "backgrounds")).toBe("shop:backgrounds");
  });
});
