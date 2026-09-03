import { describe, expect, it } from "vitest";

import { createDefaultState, recordVictory } from "./ProgressionStore";
import {
  getNextStageTip,
  getRaidStartStage,
  resolveVictoryChoice,
} from "./raidFlow";

describe("getRaidStartStage", () => {
  it("starts a new save at stage one", () => {
    expect(getRaidStartStage(0)).toBe(1);
  });

  it("resumes at exactly the stage after the persisted victory", () => {
    expect(getRaidStartStage(1)).toBe(2);
    expect(getRaidStartStage(4)).toBe(5);
    expect(getRaidStartStage(20)).toBe(21);
  });

  it("safely normalizes malformed progress", () => {
    expect(getRaidStartStage(-10)).toBe(1);
    expect(getRaidStartStage(Number.NaN)).toBe(1);
    expect(getRaidStartStage(4.9)).toBe(5);
  });

  it("uses the already rewarded victory state without replaying or skipping a stage", () => {
    const victory = recordVictory(createDefaultState(), 4, false, 3);

    expect(getRaidStartStage(victory.highestStageCleared)).toBe(5);
    expect(victory.highestStageCleared).toBe(4);
    expect(victory.thread).toBe(3);
    expect(victory.stats.monstersDefeated).toBe(1);
  });
});

describe("resolveVictoryChoice", () => {
  it("requires a save before returning to the menu", () => {
    expect(resolveVictoryChoice("menu")).toEqual({
      kind: "menu",
      persistProgress: true,
    });
  });

  it("continues directly to the next stage", () => {
    expect(resolveVictoryChoice("continue")).toEqual({
      kind: "next-stage",
    });
  });
});

describe("getNextStageTip", () => {
  it("introduces a new room in the in-game tip instead of another dialog", () => {
    expect(
      getNextStageTip(
        "attic",
        {
          id: "theatre",
          name: "Театр забытых кукол",
          subtitle: "Сцена лунных нитей",
        },
        {
          name: "Пружинный Заяц",
          epithet: "сбивает ритм спектакля",
        },
      ),
    ).toBe(
      "Театр забытых кукол: Сцена лунных нитей. Поймай новый ритм",
    );
  });

  it("warns about a boss without requiring a separate confirmation", () => {
    expect(
      getNextStageTip(
        "attic",
        {
          id: "attic",
          name: "Чердачная мастерская",
          subtitle: "Ожившие выкройки",
        },
        {
          name: "Великая Швейная Буря",
          epithet: "прячет сердце под лоскутами",
          isBoss: true,
        },
      ),
    ).toBe(
      "Босс: Великая Швейная Буря — прячет сердце под лоскутами",
    );
  });

  it("introduces a mini-boss in the HUD without another confirmation", () => {
    expect(
      getNextStageTip(
        "attic",
        {
          id: "attic",
          name: "Чердачная мастерская",
          subtitle: "Ожившие выкройки",
        },
        {
          name: "Катушечный Паук",
          epithet: "стягивает путь липкой пряжей",
          isMiniBoss: true,
        },
      ),
    ).toBe(
      "Мини-босс: Катушечный Паук — стягивает путь липкой пряжей",
    );
  });
});
