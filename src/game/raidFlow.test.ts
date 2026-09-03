import { describe, expect, it } from "vitest";

import { getNextStageTip, resolveVictoryChoice } from "./raidFlow";

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
