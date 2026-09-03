import { describe, expect, it } from "vitest";

import type { RoomId } from "./content";
import type { NeedleSkinId } from "./meta";
import {
  DAILY_QUEST_COUNT,
  DAILY_QUESTS,
  canRefreshDailyQuests,
  claimDailyQuest,
  claimStreakChest,
  createDailySystemsState,
  getDailyQuestDefinition,
  getLocalDayKey,
  getStreakChestReward,
  normalizeDailySystemsState,
  recordDailyGameplayEvent,
  refreshDailyQuests,
  type DailyQuestId,
  type DailySystemsState,
  type VictoryDailyEvent,
} from "./DailySystems";

const TODAY = new Date(2026, 8, 3, 12, 30);
const TOMORROW = new Date(2026, 8, 4, 9, 0);

function ids(state: DailySystemsState): DailyQuestId[] {
  return state.daily.quests.map((quest) => quest.id);
}

function withQuests(
  questIds: readonly [DailyQuestId, DailyQuestId, DailyQuestId],
  progress: Partial<Record<DailyQuestId, number>> = {},
): DailySystemsState {
  const state = createDailySystemsState(TODAY);
  return {
    ...state,
    daily: {
      ...state.daily,
      quests: questIds.map((id) => ({
        id,
        progress: progress[id] ?? 0,
        claimed: false,
      })),
    },
  };
}

function victory(
  overrides: Partial<Omit<VictoryDailyEvent, "type">> = {},
): VictoryDailyEvent {
  return {
    type: "victory",
    needleId: "silver",
    roomId: "attic",
    monsterId: "grumble-yarn",
    ...overrides,
  };
}

function recordVictories(state: DailySystemsState, amount: number): DailySystemsState {
  let next = state;
  for (let index = 0; index < amount; index += 1) {
    next = recordDailyGameplayEvent(next, victory(), TODAY);
  }
  return next;
}

describe("daily quest calendar and deterministic selection", () => {
  it("uses a padded local calendar date rather than UTC text", () => {
    const localDate = new Date(2026, 0, 7, 23, 58);
    expect(getLocalDayKey(localDate)).toBe("2026-01-07");
    expect(() => getLocalDayKey(new Date(Number.NaN))).toThrow(RangeError);
  });

  it("selects exactly three distinct deterministic quests for a day", () => {
    const context = {
      availableNeedleIds: ["silver", "bone"] as NeedleSkinId[],
      availableRoomIds: ["attic", "theatre"] as RoomId[],
      availableMonsterIds: ["sewing-storm"],
    };
    const first = createDailySystemsState(TODAY, context);
    const second = createDailySystemsState(new Date(2026, 8, 3, 21, 59), context);

    expect(ids(first)).toEqual(ids(second));
    expect(first.daily.quests).toHaveLength(DAILY_QUEST_COUNT);
    expect(new Set(ids(first)).size).toBe(DAILY_QUEST_COUNT);
    expect(new Set(first.daily.quests.map((quest) => getDailyQuestDefinition(quest.id).group)).size)
      .toBe(DAILY_QUEST_COUNT);
  });

  it("changes the deterministic rotation across calendar days", () => {
    const weeklySets = Array.from({ length: 7 }, (_, dayOffset) => {
      const date = new Date(2026, 8, 3 + dayOffset, 12);
      return ids(createDailySystemsState(date)).join(",");
    });
    expect(new Set(weeklySets).size).toBeGreaterThan(1);
  });

  it("never selects a quest for a locked needle or unavailable room", () => {
    for (let dayOffset = 0; dayOffset < 40; dayOffset += 1) {
      const state = createDailySystemsState(new Date(2026, 8, 3 + dayOffset), {
        availableNeedleIds: ["silver"],
        availableRoomIds: ["attic"],
      });
      for (const quest of state.daily.quests) {
        const criteria = getDailyQuestDefinition(quest.id).criteria;
        if (criteria.kind !== "victories") continue;
        expect(criteria.needleId === undefined || criteria.needleId === "silver").toBe(true);
        expect(criteria.roomId === undefined || criteria.roomId === "attic").toBe(true);
        expect(criteria.monsterId).toBeUndefined();
      }
    }
  });

  it("enables named boss quests only for discovered bosses", () => {
    const namedIds = new Set(
      DAILY_QUESTS.filter(
        (quest) => quest.criteria.kind === "victories" && quest.criteria.monsterId,
      ).map((quest) => quest.id),
    );
    let sawMothQuest = false;

    for (let dayOffset = 0; dayOffset < 120; dayOffset += 1) {
      const date = new Date(2026, 0, 1 + dayOffset);
      const locked = createDailySystemsState(date);
      expect(ids(locked).some((id) => namedIds.has(id))).toBe(false);

      const discovered = createDailySystemsState(date, {
        availableMonsterIds: ["moth-mask"],
      });
      for (const questId of ids(discovered)) {
        const criteria = getDailyQuestDefinition(questId).criteria;
        if (criteria.kind === "victories" && criteria.monsterId) {
          expect(criteria.monsterId).toBe("moth-mask");
          sawMothQuest = true;
        }
      }
    }
    expect(sawMothQuest).toBe(true);
  });
});

describe("free daily refresh and rollover", () => {
  it("offers one free replacement set with no repeated task", () => {
    const initial = createDailySystemsState(TODAY);
    const refreshed = refreshDailyQuests(initial, TODAY);

    expect(canRefreshDailyQuests(initial)).toBe(true);
    expect(refreshed.daily.roll).toBe(1);
    expect(refreshed.daily.refreshUsed).toBe(true);
    expect(ids(refreshed).filter((id) => ids(initial).includes(id))).toEqual([]);
    expect(refreshDailyQuests(refreshed, TODAY)).toEqual(refreshed);
  });

  it("does not allow farming extra rewards by refreshing after a claim", () => {
    const ready = withQuests(
      ["victories-2", "accurate-streak-6", "room-attic"],
      { "victories-2": 2 },
    );
    const claimed = claimDailyQuest(ready, "victories-2", TODAY).state;

    expect(canRefreshDailyQuests(claimed)).toBe(false);
    expect(refreshDailyQuests(claimed, TODAY)).toEqual(claimed);
  });

  it("starts a fresh board at local midnight while preserving the victory streak", () => {
    const today = recordVictories(createDailySystemsState(TODAY), 4);
    const tomorrow = normalizeDailySystemsState(today, TOMORROW);

    expect(tomorrow.daily.dayKey).toBe("2026-09-04");
    expect(tomorrow.daily.roll).toBe(0);
    expect(tomorrow.daily.refreshUsed).toBe(false);
    expect(tomorrow.daily.quests.every((quest) => quest.progress === 0)).toBe(true);
    expect(tomorrow.streak.current).toBe(4);
    expect(tomorrow.streak.best).toBe(4);
  });
});

describe("daily quest event progress", () => {
  it("counts generic, equipped-needle and room victories from one event", () => {
    const state = withQuests(["victories-2", "needle-bone", "room-theatre"]);
    const matching = recordDailyGameplayEvent(
      state,
      victory({ needleId: "bone", roomId: "theatre" }),
      TODAY,
    );
    expect(matching.daily.quests.map((quest) => quest.progress)).toEqual([1, 1, 1]);

    const partial = recordDailyGameplayEvent(matching, victory(), TODAY);
    expect(partial.daily.quests.map((quest) => quest.progress)).toEqual([2, 1, 1]);
  });

  it("distinguishes mini-boss, main-boss and a named boss", () => {
    const state = withQuests(["boss-any", "boss-main", "boss-sewing-storm"]);
    const regular = recordDailyGameplayEvent(state, victory(), TODAY);
    expect(regular.daily.quests.map((quest) => quest.progress)).toEqual([0, 0, 0]);

    const mini = recordDailyGameplayEvent(
      regular,
      victory({ monsterId: "spool-spider", isMiniBoss: true }),
      TODAY,
    );
    expect(mini.daily.quests.map((quest) => quest.progress)).toEqual([1, 0, 0]);

    const main = recordDailyGameplayEvent(
      mini,
      victory({ monsterId: "sewing-storm", isBoss: true }),
      TODAY,
    );
    expect(main.daily.quests.map((quest) => quest.progress)).toEqual([1, 1, 1]);
  });

  it("uses the best accurate chain, accepts it on either event, and caps targets", () => {
    const state = withQuests([
      "accurate-streak-6",
      "accurate-streak-10",
      "accurate-streak-14",
    ]);
    const first = recordDailyGameplayEvent(
      state,
      { type: "accurate-streak", length: 9 },
      TODAY,
    );
    expect(first.daily.quests.map((quest) => quest.progress)).toEqual([6, 9, 9]);

    const lower = recordDailyGameplayEvent(
      first,
      { type: "accurate-streak", length: 4 },
      TODAY,
    );
    expect(lower.daily.quests.map((quest) => quest.progress)).toEqual([6, 9, 9]);

    const bundled = recordDailyGameplayEvent(
      lower,
      victory({ maxAccurateStreak: 12 }),
      TODAY,
    );
    expect(bundled.daily.quests.map((quest) => quest.progress)).toEqual([6, 10, 12]);
  });

  it("counts a flawless room only when the victory says it had no miss", () => {
    const state = withQuests(["perfect-victory", "victories-2", "room-attic"]);
    const ordinary = recordDailyGameplayEvent(state, victory(), TODAY);
    expect(ordinary.daily.quests.map((quest) => quest.progress)).toEqual([0, 1, 1]);

    const flawless = recordDailyGameplayEvent(
      ordinary,
      victory({ perfect: true }),
      TODAY,
    );
    expect(flawless.daily.quests.map((quest) => quest.progress)).toEqual([1, 2, 2]);
  });

  it("does not mutate the state supplied by combat", () => {
    const state = withQuests(["victories-2", "needle-silver", "room-attic"]);
    const snapshot = JSON.parse(JSON.stringify(state));
    const next = recordDailyGameplayEvent(state, victory(), TODAY);

    expect(state).toEqual(snapshot);
    expect(next).not.toBe(state);
    expect(next.daily.quests).not.toBe(state.daily.quests);
  });
});

describe("daily rewards", () => {
  it("returns thread and cosmetic fragments for a completed quest exactly once", () => {
    const ready = withQuests(
      ["victories-2", "accurate-streak-6", "room-attic"],
      { "victories-2": 2 },
    );
    const firstClaim = claimDailyQuest(ready, "victories-2", TODAY);

    expect(firstClaim.reward).toEqual({ thread: 5, cosmeticFragments: 1 });
    expect(firstClaim.state.daily.quests[0]?.claimed).toBe(true);
    const repeated = claimDailyQuest(firstClaim.state, "victories-2", TODAY);
    expect(repeated.reward).toBeNull();
  });

  it("refuses missing and incomplete quest claims", () => {
    const state = withQuests(["victories-2", "accurate-streak-6", "room-attic"]);
    expect(claimDailyQuest(state, "victories-2", TODAY).reward).toBeNull();
    expect(claimDailyQuest(state, "boss-main", TODAY).reward).toBeNull();
  });
});

describe("persistent victory-streak chests", () => {
  it("creates no chest before five wins and a regular chest on the fifth", () => {
    const four = recordVictories(createDailySystemsState(TODAY), 4);
    expect(four.streak.current).toBe(4);
    expect(four.streak.pendingChests).toEqual([]);

    const five = recordVictories(four, 1);
    expect(five.streak.current).toBe(5);
    expect(five.streak.best).toBe(5);
    expect(five.streak.pendingChests).toEqual([
      {
        id: "streak-1-5",
        run: 1,
        milestone: 5,
        tier: "regular",
        reward: { thread: 3, cosmeticFragments: 1 },
      },
    ]);
  });

  it("creates a more valuable grand chest on every tenth win", () => {
    const ten = recordVictories(createDailySystemsState(TODAY), 10);
    const regular = ten.streak.pendingChests[0];
    const grand = ten.streak.pendingChests[1];

    expect(ten.streak.pendingChests).toHaveLength(2);
    expect(grand?.id).toBe("streak-1-10");
    expect(grand?.tier).toBe("grand");
    expect(grand?.reward.thread).toBeGreaterThan(regular?.reward.thread ?? 0);
    expect(grand?.reward.cosmeticFragments).toBeGreaterThan(
      regular?.reward.cosmeticFragments ?? 0,
    );
    expect(getStreakChestReward(20).thread).toBeGreaterThan(
      getStreakChestReward(10).thread,
    );
  });

  it("claims a pending chest once and cannot recreate or reclaim it", () => {
    const five = recordVictories(createDailySystemsState(TODAY), 5);
    const claimed = claimStreakChest(five, "streak-1-5", TODAY);

    expect(claimed.reward).toEqual({ thread: 3, cosmeticFragments: 1 });
    expect(claimed.state.streak.pendingChests).toEqual([]);
    expect(claimed.state.streak.claimedChestIds).toEqual(["streak-1-5"]);
    expect(claimStreakChest(claimed.state, "streak-1-5", TODAY).reward).toBeNull();

    const sixth = recordVictories(claimed.state, 1);
    expect(sixth.streak.pendingChests).toEqual([]);
    expect(sixth.streak.current).toBe(6);
  });

  it("resets the current streak after defeat but preserves best and old pending rewards", () => {
    const five = recordVictories(createDailySystemsState(TODAY), 5);
    const defeated = recordDailyGameplayEvent(five, { type: "defeat" }, TODAY);

    expect(defeated.streak.current).toBe(0);
    expect(defeated.streak.best).toBe(5);
    expect(defeated.streak.run).toBe(2);
    expect(defeated.streak.pendingChests.map((chest) => chest.id)).toEqual(["streak-1-5"]);

    const nextFive = recordVictories(defeated, 5);
    expect(nextFive.streak.pendingChests.map((chest) => chest.id)).toEqual([
      "streak-1-5",
      "streak-2-5",
    ]);
  });

  it("does not create extra runs for repeated defeat events at zero", () => {
    const state = createDailySystemsState(TODAY);
    const first = recordDailyGameplayEvent(state, { type: "defeat" }, TODAY);
    const second = recordDailyGameplayEvent(first, { type: "defeat" }, TODAY);
    expect(second.streak.run).toBe(1);
  });
});

describe("JSON persistence and repair", () => {
  it("round-trips all daily and chest progress through plain JSON", () => {
    const ten = recordVictories(createDailySystemsState(TODAY), 10);
    const claimed = claimStreakChest(ten, "streak-1-5", TODAY).state;
    const json = JSON.stringify(claimed);

    expect(normalizeDailySystemsState(JSON.parse(json), TODAY)).toEqual(claimed);
  });

  it("repairs malformed progress, duplicate quests and forged chest rewards", () => {
    const repaired = normalizeDailySystemsState(
      {
        version: 99,
        daily: {
          dayKey: getLocalDayKey(TODAY),
          roll: 1,
          refreshUsed: false,
          quests: [
            { id: "victories-2", progress: 999, claimed: true },
            { id: "victories-2", progress: 1, claimed: false },
            { id: "unknown", progress: 4 },
          ],
        },
        streak: {
          run: -4,
          current: "7.9",
          best: 2,
          claimedChestIds: ["streak-2-5", "streak-2-5", 4],
          pendingChests: [
            {
              run: 2,
              milestone: 5,
              reward: { thread: 999_999, cosmeticFragments: 999_999 },
            },
            { run: 2, milestone: 6 },
          ],
        },
      },
      TODAY,
    );

    expect(repaired.version).toBe(1);
    expect(repaired.daily.quests).toHaveLength(3);
    expect(new Set(ids(repaired)).size).toBe(3);
    expect(repaired.daily.roll).toBe(1);
    expect(repaired.daily.refreshUsed).toBe(true);
    expect(repaired.streak.run).toBe(1);
    expect(repaired.streak.current).toBe(7);
    expect(repaired.streak.best).toBe(7);
    expect(repaired.streak.claimedChestIds).toEqual(["streak-2-5"]);
    expect(repaired.streak.pendingChests).toEqual([]);
  });
});
