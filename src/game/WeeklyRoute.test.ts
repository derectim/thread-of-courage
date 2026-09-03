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

  it("creates five deterministic, fully known nodes for an ISO week", () => {
    const first = createWeeklyRoute("2026-W36");
    const again = createWeeklyRoute(new Date("2026-09-03T23:59:00Z"));

    expect(again).toEqual(first);
    expect(first.nodes).toHaveLength(5);
    expect(new Set(first.nodes.map((node) => node.id)).size).toBe(5);
    expect(new Set(first.nodes.map((node) => node.modifierId)).size).toBe(5);
    for (const node of first.nodes) {
      expect(getWeeklyModifier(node.modifierId)).toBeDefined();
    }
    expect(WEEKLY_MODIFIERS).toHaveLength(8);
    expect(WEEKLY_ROUTE_BUTTON_REWARD).toBe(4);
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
      canClaimFinalReward: true,
    });
  });

  it("allows replaying the route but grants its emblem and four buttons only once", () => {
    const route = createWeeklyRoute("2026-W36");
    let progress = createWeeklyRouteProgress(route);
    for (const node of route.nodes) {
      progress = completeWeeklyRouteNode(progress, route, node.id);
    }

    const firstClaim = claimWeeklyRouteReward(progress, route);
    expect(firstClaim.reward).toEqual(route.finalReward);
    expect(firstClaim.reward?.cosmeticOnly).toBe(true);
    expect(firstClaim.reward?.buttonReward).toBe(4);

    progress = firstClaim.progress;
    for (const node of route.nodes) {
      progress = completeWeeklyRouteNode(progress, route, node.id);
    }
    expect(getWeeklyRouteStatus(progress, route).completedLaps).toBe(2);
    const repeatedClaim = claimWeeklyRouteReward(progress, route);
    expect(repeatedClaim.reward).toBeNull();
    expect(repeatedClaim.progress).toEqual(progress);
  });

  it("grants four buttons again in a new week even when the emblem variant repeats", () => {
    const firstRoute = createWeeklyRoute("2026-W19");
    const nextRoute = createWeeklyRoute("2026-W20");
    expect(nextRoute.finalReward.id).toBe(firstRoute.finalReward.id);

    let progress = createWeeklyRouteProgress(firstRoute);
    for (const node of firstRoute.nodes) {
      progress = completeWeeklyRouteNode(progress, firstRoute, node.id);
    }
    const firstClaim = claimWeeklyRouteReward(progress, firstRoute);
    expect(firstClaim.reward?.buttonReward).toBe(4);

    progress = syncWeeklyRouteProgress(firstClaim.progress, nextRoute);
    for (const node of nextRoute.nodes) {
      progress = completeWeeklyRouteNode(progress, nextRoute, node.id);
    }
    const nextClaim = claimWeeklyRouteReward(progress, nextRoute);
    expect(nextClaim.reward?.id).toBe(firstClaim.reward?.id);
    expect(nextClaim.reward?.buttonReward).toBe(4);
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

  it("resets progress for a new week and sanitizes current-week values", () => {
    const oldRoute = createWeeklyRoute("2026-W36");
    const nextRoute = createWeeklyRoute("2026-W37");
    const oldProgress = {
      ...createWeeklyRouteProgress(oldRoute),
      clearsByNode: { [oldRoute.nodes[0].id]: 2.8 },
      finalRewardClaimed: true,
    };

    expect(syncWeeklyRouteProgress(oldProgress, oldRoute).clearsByNode).toMatchObject({
      [oldRoute.nodes[0].id]: 2,
    });
    expect(syncWeeklyRouteProgress(oldProgress, nextRoute)).toEqual(
      createWeeklyRouteProgress(nextRoute),
    );
  });
});
