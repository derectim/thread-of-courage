import { describe, expect, it } from "vitest";
import { ACTIVITY_LEVELS, activityCount, activityKey, createActivityProgress, memoryDeck, memoryLimit, memoryPairs, moveActivity, normalizeActivityProgress, orderRecipe, patternConnections, patternDefinition, resumeActivity, startActivity, type ActivityProgress, type PatternRun, type ActivityKind } from "./WorkshopActivities";
import { createDefaultState, startWorkshopActivity, makeWorkshopMove, save, load } from "./ProgressionStore";
import { earnedActivityCollectibles } from "./ActivityRewards";

function solve(progress: ActivityProgress, date = new Date(2026, 8, 5)): { progress: ActivityProgress; reward: number } {
  let total = 0;
  const step = (action: Parameters<typeof moveActivity>[1]) => { const next = moveActivity(progress, action, date); total += next.reward; progress = next.progress; };
  const run = progress.run!;
  if (run.kind === "patterns") {
    for (let index = 0; index < run.turns.length; index++) for (let turn = 0; turn < (4 - run.turns[index]) % 4; turn++) step({ type: "rotate", index });
  } else if (run.kind === "drawers") {
    const deck = memoryDeck(run);
    for (const value of new Set(deck)) { const indices = deck.flatMap((item, index) => item === value ? [index] : []); for (const index of indices) step({ type: "flip", index }); }
  } else {
    const recipe = orderRecipe(run.level);
    for (const field of ["fabric", "stitch", "charm"] as const) step({ type: "choose", field, value: recipe[field] });
    for (let index = 0; index < recipe.stitches; index++) step({ type: "sew", index });
  }
  return { progress, reward: total };
}
function seeded(kind: ActivityKind, level: number): ActivityProgress {
  const best = Object.fromEntries(Array.from({ length: level - 1 }, (_, i) => [activityKey(kind, i + 1), 10]));
  return { ...createActivityProgress(), best };
}

describe("workshop activity puzzles", () => {
  it.each(Array.from({ length: 12 }, (_, i) => i + 1))("has a connected, solvable level %i with no initial free win", level => {
    for (const seed of [0, 1, 3, 79, 123456, 0xffffffff]) {
      const started = startActivity(seeded("patterns", level), "patterns", level, false, undefined, seed);
      expect(patternConnections(started.run as PatternRun).solved).toBe(false);
      const definition = patternDefinition(level, seed);
      expect(definition.masks.filter(mask => [1, 2, 4, 8].includes(mask))).toHaveLength(2);
      const won = solve(started);
      expect(won.progress.run?.status).toBe("won");
      expect(won.reward).toBe(8 + 2 * Math.floor((level - 1) / 4));
      expect(normalizeActivityProgress(won.progress)).toEqual(won.progress);
    }
  });

  it("does not allow skipping locked levels and rejects malformed moves", () => {
    const initial = createActivityProgress();
    expect(startActivity(initial, "patterns", 12)).toBe(initial);
    expect(startActivity(initial, "orders", -1)).toBe(initial);
    const started = startActivity(initial, "patterns", 1);
    expect(moveActivity(started, { type: "rotate", index: 999 }).progress).toBe(started);
    expect(moveActivity(started, { type: "flip", index: 0 }).progress).toBe(started);
  });

  it.each(["drawers", "orders"] as const)("allows all %s levels to be completed and repeated without duplicate rewards", kind => {
    let progress = createActivityProgress();
    for (let level = 1; level <= ACTIVITY_LEVELS[kind]; level++) {
      const won = solve(startActivity(progress, kind, level));
      expect(won.progress.run?.status).toBe("won"); expect(won.reward).toBe(8);
      expect(normalizeActivityProgress(won.progress)).toEqual(won.progress);
      expect(solve(startActivity(won.progress, kind, level)).reward).toBe(0);
      progress = won.progress;
    }
    expect(activityCount(progress, kind)).toBe(ACTIVITY_LEVELS[kind]);
  });

  it("grows the new memory boards from 3 to 12 pairs and varies the actual objects", () => {
    const counts = Array.from({ length: 12 }, (_, i) => memoryPairs(i + 1));
    expect(counts[0]).toBe(3); expect(counts[11]).toBe(12);
    expect(counts.every((count, i) => i === 0 || count >= counts[i - 1])).toBe(true);
    const sets = new Set(Array.from({ length: 12 }, (_, seed) => [...new Set(memoryDeck({ level: 1, seed, layoutVersion: 2 }))].sort().join(",")));
    expect(sets.size).toBeGreaterThan(6);
  });

  it("preserves old memory layouts, open cards, and previously earned keepsakes", () => {
    const legacy = { kind: "drawers" as const, level: 1, seed: 77, moves: 0, status: "playing" as const, awarded: 0, open: [0], matched: [] };
    const progress = normalizeActivityProgress({ ...createActivityProgress(), run: legacy });
    expect(progress.run).toEqual(legacy); expect(memoryDeck(legacy)).toHaveLength(8);
    expect([...new Set(memoryDeck(legacy))].sort()).toEqual([0, 1, 2, 3]);
    const entries = new Map<string, string>(), storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
    const base = createDefaultState();
    save({ ...base, activityProgress: progress, workshopCollection: { ...base.workshopCollection, ownedCollectibleIds: [...base.workshopCollection.ownedCollectibleIds, "activity-ornament-keepsake", "activity-title-restorer"] } }, storage);
    expect(load(storage).workshopCollection.ownedCollectibleIds).toEqual(expect.arrayContaining(["activity-ornament-keepsake", "activity-title-restorer"]));
  });

  it("limits unmatched memory attempts and blocks peeking at a third drawer", () => {
    let progress = startActivity(createActivityProgress(), "drawers", 1, false, undefined, 77);
    const run = progress.run!; if (run.kind !== "drawers") throw new Error();
    const deck = memoryDeck(run), a = 0, b = deck.findIndex(value => value !== deck[a]);
    for (let attempt = 0; attempt < memoryLimit(1); attempt++) {
      progress = moveActivity(progress, { type: "flip", index: a }).progress;
      progress = moveActivity(progress, { type: "flip", index: b }).progress;
      expect(moveActivity(progress, { type: "flip", index: deck.length - 1 }).progress).toBe(progress);
      if (progress.run?.status === "playing") progress = moveActivity(progress, { type: "hide-cards" }).progress;
    }
    expect(progress.run?.status).toBe("lost"); expect(progress.best).toEqual({});
    expect(moveActivity(progress, { type: "flip", index: 1 }).reward).toBe(0);
  });

  it("requires the actual order recipe and numbered stitches, with free retries", () => {
    let progress = startActivity(createActivityProgress(), "orders", 1);
    expect(moveActivity(progress, { type: "sew", index: 0 }).progress).toBe(progress);
    const recipe = orderRecipe(1);
    for (const field of ["fabric", "stitch", "charm"] as const) progress = moveActivity(progress, { type: "choose", field, value: field === "fabric" ? (recipe[field] + 1) % 3 : recipe[field] }).progress;
    for (let index = 0; index < recipe.stitches; index++) progress = moveActivity(progress, { type: "sew", index }).progress;
    expect(progress.run?.status).toBe("lost"); expect(progress.best).toEqual({});
    expect(solve(startActivity(progress, "orders", 1)).reward).toBe(8);
  });

  it("retains a separate unfinished game for every activity and the daily puzzle", () => {
    let progress = startActivity(createActivityProgress(), "patterns", 1);
    progress = moveActivity(progress, { type: "rotate", index: 0 }).progress;
    const pattern = progress.run;
    progress = startActivity(progress, "drawers", 1);
    progress = moveActivity(progress, { type: "flip", index: 0 }).progress;
    const drawers = progress.run;
    progress = startActivity(progress, "orders", 1);
    progress = startActivity(progress, "patterns", 5, true, new Date(2026, 8, 5));
    const restored = normalizeActivityProgress(JSON.parse(JSON.stringify(progress)));
    expect(resumeActivity(restored, "patterns").run).toEqual(pattern);
    expect(resumeActivity(restored, "drawers").run).toEqual(drawers);
    expect(Object.keys(restored.stored)).toHaveLength(4);
  });

  it("pays a deterministic daily puzzle once, does not spend tomorrow's claim across midnight, and blocks clock rollback payouts", () => {
    const today = new Date(2026, 8, 5), tomorrow = new Date(2026, 8, 6);
    const started = startActivity(createActivityProgress(), "patterns", 5, true, today);
    expect(startActivity(createActivityProgress(), "patterns", 5, true, today).run).toEqual(started.run);
    const won = solve(started, today); expect(won.reward).toBe(5); expect(won.progress.best).toEqual({});
    expect(solve(startActivity(won.progress, "patterns", 5, true, today), today).reward).toBe(0);
    expect(solve(started, tomorrow).reward).toBe(0);
    const nextDay = solve(startActivity(won.progress, "patterns", 5, true, tomorrow), tomorrow); expect(nextDay.reward).toBe(5);
    expect(solve(startActivity(nextDay.progress, "patterns", 5, true, today), today).reward).toBe(0);
  });

  it("restores saves without touching combat, premium currency or awarded items", () => {
    const initial = { ...createDefaultState(), thread: 270, premium: 9, campaignResumeStage: 7, highestStageCleared: 6 };
    let state = startWorkshopActivity(initial, "orders", 1);
    const recipe = orderRecipe(1);
    for (const field of ["fabric", "stitch", "charm"] as const) state = makeWorkshopMove(state, { type: "choose", field, value: recipe[field] });
    const entries = new Map<string, string>(), storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
    save(state, storage); state = load(storage);
    for (let index = 0; index < recipe.stitches; index++) state = makeWorkshopMove(state, { type: "sew", index });
    expect(state).toEqual({ ...initial, thread: 278, activityProgress: state.activityProgress });
    save(state, storage); const restored = load(storage);
    expect(makeWorkshopMove(restored, { type: "sew", index: 0 })).toBe(restored);
    expect(restored.thread).toBe(278);
  });

  it("grants all four permanent keepsakes after finishing the three series", () => {
    let progress = createActivityProgress();
    for (const kind of Object.keys(ACTIVITY_LEVELS) as ActivityKind[]) for (let level = 1; level <= ACTIVITY_LEVELS[kind]; level++) progress = solve(startActivity(progress, kind, level)).progress;
    expect(earnedActivityCollectibles(progress)).toHaveLength(4);
    const entries = new Map<string, string>(), storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
    save({ ...createDefaultState(), activityProgress: progress }, storage);
    expect(load(storage).workshopCollection.ownedCollectibleIds).toEqual(expect.arrayContaining(earnedActivityCollectibles(progress)));
  });

  it("discards invalid boards and nonsequential claims without creating rewards", () => {
    const progress = startActivity(createActivityProgress(), "patterns", 1);
    expect(normalizeActivityProgress({ ...progress, stored: {}, run: { ...progress.run, turns: [NaN] } }).run).toBeNull();
    expect(normalizeActivityProgress({ best: { "patterns:12": 1, arbitrary: 2 } }).best).toEqual({});
    expect(normalizeActivityProgress({ ...progress, run: { ...progress.run, status: "won", awarded: 10000 } }).run).toBeNull();
  });
});
