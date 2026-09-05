import { describe, expect, it } from "vitest";

import {
  WEEKLY_ROUTE_BUTTON_REWARD,
  WEEKLY_ROUTE_REWARD_VARIANTS,
  WEEKLY_MODIFIERS,
  claimWeeklyRouteReward,
  completeWeeklyRouteNode,
  createWeeklyRoute,
  createWeeklyRouteProgress,
  getIsoWeekId,
  getNextWeeklyResetAt,
  getWeeklyCycleId,
  getWeeklyModifier,
  getWeeklyRouteStatus,
  resolveWeeklyRouteCollectibleId,
  syncWeeklyRouteProgress,
} from "./WeeklyRoute";

describe("weekly route", () => {
  it("calculates ISO weeks correctly across calendar-year boundaries", () => {
    expect(getIsoWeekId(new Date("2021-01-01T23:00:00Z"))).toBe("2020-W53");
    expect(getIsoWeekId(new Date("2021-01-04T00:00:00Z"))).toBe("2021-W01");
    expect(getIsoWeekId(new Date("2026-09-03T09:00:00Z"))).toBe("2026-W36");
  });

  it("uses one global Friday-to-Thursday cycle with a 00:00 UTC reset", () => {
    expect(getWeeklyCycleId(new Date("2026-09-03T23:59:59.999Z"))).toBe(
      "2026-W35",
    );
    expect(getWeeklyCycleId(new Date("2026-09-04T00:00:00.000Z"))).toBe(
      "2026-W36",
    );
    expect(getWeeklyCycleId(new Date("2026-09-10T23:59:59.999Z"))).toBe(
      "2026-W36",
    );
    expect(getWeeklyCycleId(new Date("2026-09-11T00:00:00.000Z"))).toBe(
      "2026-W37",
    );
  });

  it("returns the next Friday reset, including when called exactly at reset", () => {
    expect(
      getNextWeeklyResetAt(new Date("2026-09-03T23:59:59.999Z")).toISOString(),
    ).toBe("2026-09-04T00:00:00.000Z");
    expect(
      getNextWeeklyResetAt(new Date("2026-09-04T00:00:00.000Z")).toISOString(),
    ).toBe("2026-09-11T00:00:00.000Z");
    expect(
      getNextWeeklyResetAt(new Date("2026-09-04T21:15:00.000Z")).toISOString(),
    ).toBe("2026-09-11T00:00:00.000Z");
  });

  it("keeps the Friday cycle stable across the ISO year boundary", () => {
    expect(getWeeklyCycleId(new Date("2021-01-01T00:00:00.000Z"))).toBe(
      "2020-W53",
    );
    expect(getWeeklyCycleId(new Date("2021-01-07T23:59:59.999Z"))).toBe(
      "2020-W53",
    );
    expect(getWeeklyCycleId(new Date("2021-01-08T00:00:00.000Z"))).toBe(
      "2021-W01",
    );
  });

  it("creates five deterministic, fully known nodes for an ISO week", () => {
    const first = createWeeklyRoute("2026-W36");
    const again = createWeeklyRoute(new Date("2026-09-04T00:00:00Z"));

    expect(again).toEqual(first);
    expect(first.nodes).toHaveLength(5);
    expect(new Set(first.nodes.map((node) => node.id)).size).toBe(5);
    expect(new Set(first.nodes.map((node) => node.modifierId)).size).toBe(5);
    for (const node of first.nodes) {
      expect(getWeeklyModifier(node.modifierId)).toBeDefined();
    }
    expect(WEEKLY_MODIFIERS).toHaveLength(8);
    expect(WEEKLY_ROUTE_BUTTON_REWARD).toBe(2);
    expect(first.finalReward).toMatchObject({
      id: "weekly-emblem-owl-eye",
      buttonReward: WEEKLY_ROUTE_BUTTON_REWARD,
      acquisitionLabel: "Завершить все 5 узлов недельного маршрута",
    });
  });

  it("uses only four stable collectible IDs across all calendar weeks", () => {
    const expectedIds = [
      "weekly-emblem-moon-thimble",
      "weekly-emblem-golden-spool",
      "weekly-emblem-owl-eye",
      "weekly-emblem-pattern-heart",
    ];
    expect(WEEKLY_ROUTE_REWARD_VARIANTS.map((reward) => reward.id)).toEqual(
      expectedIds,
    );

    const generatedIds = new Set(
      Array.from({ length: 53 }, (_, index) =>
        createWeeklyRoute(`2026-W${String(index + 1).padStart(2, "0")}`).finalReward.id,
      ),
    );
    expect(generatedIds).toEqual(new Set(expectedIds));
  });

  it("resolves old per-week collectible IDs without accepting malformed weeks", () => {
    expect(resolveWeeklyRouteCollectibleId("weekly-emblem-2026-W36")).toBe(
      createWeeklyRoute("2026-W36").finalReward.id,
    );
    expect(resolveWeeklyRouteCollectibleId("weekly-emblem-moon-thimble")).toBe(
      "weekly-emblem-moon-thimble",
    );
    expect(resolveWeeklyRouteCollectibleId("weekly-emblem-2026-W00")).toBeNull();
    expect(resolveWeeklyRouteCollectibleId("weekly-emblem-2026-W99")).toBeNull();
  });

  it("unlocks nodes in order and tracks first-lap progress", () => {
    const route = createWeeklyRoute("2026-W36");
    let progress = createWeeklyRouteProgress(route);

    progress = completeWeeklyRouteNode(progress, route, route.nodes[3].id);
    expect(getWeeklyRouteStatus(progress, route).completedNodesThisLap).toBe(0);

    for (let index = 0; index < 5; index += 1) {
      expect(getWeeklyRouteStatus(progress, route).nextNode.id).toBe(
        route.nodes[index].id,
      );
      progress = completeWeeklyRouteNode(progress, route, route.nodes[index].id);
    }

    expect(getWeeklyRouteStatus(progress, route)).toMatchObject({
      completedFirstLap: true,
      completedLaps: 1,
      completedNodesThisLap: 0,
      canPlay: false,
      canClaimFinalReward: true,
    });
  });

  it("locks the route after one clear and claiming the reward never unlocks it", () => {
    const route = createWeeklyRoute("2026-W36");
    let progress = createWeeklyRouteProgress(route);
    for (const node of route.nodes) {
      progress = completeWeeklyRouteNode(progress, route, node.id);
    }

    const firstClaim = claimWeeklyRouteReward(progress, route);
    expect(firstClaim.reward).toEqual(route.finalReward);
    expect(firstClaim.reward?.cosmeticOnly).toBe(true);
    expect(firstClaim.reward?.buttonReward).toBe(2);

    progress = firstClaim.progress;
    const replayAttempt = completeWeeklyRouteNode(progress, route, route.nodes[0].id);
    expect(replayAttempt).toEqual(progress);
    expect(getWeeklyRouteStatus(progress, route)).toMatchObject({
      completedFirstLap: true,
      completedLaps: 1,
      canPlay: false,
      canClaimFinalReward: false,
    });
    const repeatedClaim = claimWeeklyRouteReward(progress, route);
    expect(repeatedClaim.reward).toBeNull();
    expect(repeatedClaim.progress).toEqual(progress);
  });

  it("grants two buttons again in a new week even when the emblem variant repeats", () => {
    const firstRoute = createWeeklyRoute("2026-W19");
    const nextRoute = createWeeklyRoute("2026-W20");
    expect(nextRoute.finalReward.id).toBe(firstRoute.finalReward.id);

    let progress = createWeeklyRouteProgress(firstRoute);
    for (const node of firstRoute.nodes) {
      progress = completeWeeklyRouteNode(progress, firstRoute, node.id);
    }
    const firstClaim = claimWeeklyRouteReward(progress, firstRoute);
    expect(firstClaim.reward?.buttonReward).toBe(2);

    progress = syncWeeklyRouteProgress(firstClaim.progress, nextRoute);
    for (const node of nextRoute.nodes) {
      progress = completeWeeklyRouteNode(progress, nextRoute, node.id);
    }
    const nextClaim = claimWeeklyRouteReward(progress, nextRoute);
    expect(nextClaim.reward?.id).toBe(firstClaim.reward?.id);
    expect(nextClaim.reward?.buttonReward).toBe(2);
  });

  it("does not grant buttons before all five nodes are complete", () => {
    const route = createWeeklyRoute("2026-W36");
    let progress = createWeeklyRouteProgress(route);
    for (const node of route.nodes.slice(0, -1)) {
      progress = completeWeeklyRouteNode(progress, route, node.id);
    }

    const claim = claimWeeklyRouteReward(progress, route);
    expect(claim.reward).toBeNull();
    expect(claim.progress.finalRewardClaimed).toBe(false);
  });

  it("resets progress for a new Friday cycle and sanitizes current-cycle values", () => {
    const oldRoute = createWeeklyRoute("2026-W36");
    const nextRoute = createWeeklyRoute("2026-W37");
    const oldProgress = {
      ...createWeeklyRouteProgress(oldRoute),
      clearsByNode: { [oldRoute.nodes[0].id]: 2.8 },
      finalRewardClaimed: true,
    };

    expect(syncWeeklyRouteProgress(oldProgress, oldRoute)).toMatchObject({
      clearsByNode: { [oldRoute.nodes[0].id]: 1 },
      finalRewardClaimed: false,
    });
    expect(syncWeeklyRouteProgress(oldProgress, nextRoute)).toEqual(
      createWeeklyRouteProgress(nextRoute),
    );
  });

  it("starts fresh when migrating a save from the old Monday-based cycle", () => {
    const route = createWeeklyRoute("2026-W36");
    const mondayCycleProgress = {
      ...createWeeklyRouteProgress(route),
      version: 1,
      clearsByNode: Object.fromEntries(
        route.nodes.map((node) => [node.id, 1]),
      ),
      finalRewardClaimed: true,
    };

    expect(syncWeeklyRouteProgress(mondayCycleProgress, route)).toEqual(
      createWeeklyRouteProgress(route),
    );
  });

  it("migrates old replay counters to one completed and locked route", () => {
    const route = createWeeklyRoute("2026-W36");
    const legacyReplayProgress = {
      ...createWeeklyRouteProgress(route),
      clearsByNode: Object.fromEntries(
        route.nodes.map((node) => [node.id, 3.9]),
      ),
      finalRewardClaimed: true,
    };

    const migrated = syncWeeklyRouteProgress(legacyReplayProgress, route);
    expect(Object.values(migrated.clearsByNode)).toEqual([1, 1, 1, 1, 1]);
    expect(migrated.finalRewardClaimed).toBe(true);
    expect(getWeeklyRouteStatus(migrated, route)).toMatchObject({
      completedFirstLap: true,
      completedLaps: 1,
      canPlay: false,
      canClaimFinalReward: false,
    });
  });
});
