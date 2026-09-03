import { describe, expect, it } from "vitest";

import {
  WEEKLY_MODIFIERS,
  claimWeeklyRouteReward,
  completeWeeklyRouteNode,
  createWeeklyRoute,
  createWeeklyRouteProgress,
  getIsoWeekId,
  getWeeklyModifier,
  getWeeklyRouteStatus,
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

  it("allows replaying the route but grants its cosmetic only once", () => {
    const route = createWeeklyRoute("2026-W36");
    let progress = createWeeklyRouteProgress(route);
    for (const node of route.nodes) {
      progress = completeWeeklyRouteNode(progress, route, node.id);
    }

    const firstClaim = claimWeeklyRouteReward(progress, route);
    expect(firstClaim.reward).toEqual(route.finalReward);
    expect(firstClaim.reward?.cosmeticOnly).toBe(true);

    progress = firstClaim.progress;
    for (const node of route.nodes) {
      progress = completeWeeklyRouteNode(progress, route, node.id);
    }
    expect(getWeeklyRouteStatus(progress, route).completedLaps).toBe(2);
    expect(claimWeeklyRouteReward(progress, route).reward).toBeNull();
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
