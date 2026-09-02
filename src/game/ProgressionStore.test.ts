import { describe, expect, it } from "vitest";

import {
  LEGACY_SAVE_KEY,
  MAX_UPGRADE_LEVEL,
  PROGRESSION_SAVE_KEY,
  PROGRESSION_SAVE_VERSION,
  UPGRADE_IDS,
  getUpgradeCost,
  load,
  purchaseUpgrade,
  save,
  type ProgressionState,
  type ProgressionStorage,
} from "./ProgressionStore";

class MemoryStorage implements ProgressionStorage {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function createState(overrides: Partial<ProgressionState> = {}): ProgressionState {
  return {
    version: PROGRESSION_SAVE_VERSION,
    bestStage: 1,
    thread: 0,
    muted: false,
    upgrades: {
      power: 0,
      precision: 0,
      speed: 0,
      ward: 0,
    },
    ...overrides,
  };
}

describe("ProgressionStore", () => {
  it("returns fresh defaults when storage is unavailable", () => {
    const first = load(null);
    const second = load(null);

    expect(first).toEqual(createState());
    expect(first).not.toBe(second);
    expect(first.upgrades).not.toBe(second.upgrades);
    expect(save(first, null)).toBe(false);
  });

  it("round-trips a v2 save", () => {
    const storage = new MemoryStorage();
    const state = createState({
      bestStage: 12,
      thread: 275,
      muted: true,
      upgrades: { power: 2, precision: 1, speed: 3, ward: 1 },
    });

    expect(save(state, storage)).toBe(true);
    expect(load(storage)).toEqual(state);
  });

  it("migrates v1 progress and initializes every upgrade at level zero", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LEGACY_SAVE_KEY,
      JSON.stringify({ bestStage: 9, thread: 123, muted: true }),
    );

    const migrated = load(storage);

    expect(migrated).toEqual(
      createState({ bestStage: 9, thread: 123, muted: true }),
    );
    expect(JSON.parse(storage.getItem(PROGRESSION_SAVE_KEY) ?? "null")).toEqual(
      migrated,
    );
  });

  it("prefers a valid v2 save over the legacy key", () => {
    const storage = new MemoryStorage();
    const current = createState({ bestStage: 14, thread: 200 });
    storage.setItem(PROGRESSION_SAVE_KEY, JSON.stringify(current));
    storage.setItem(
      LEGACY_SAVE_KEY,
      JSON.stringify({ bestStage: 3, thread: 10, muted: true }),
    );

    expect(load(storage)).toEqual(current);
  });

  it("sanitizes invalid persisted values", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PROGRESSION_SAVE_KEY,
      JSON.stringify({
        version: 2,
        bestStage: -4,
        thread: "18.9",
        muted: "yes",
        upgrades: { power: 99, precision: -2, speed: 2.8, ward: "4" },
      }),
    );

    expect(load(storage)).toEqual(
      createState({
        thread: 18,
        upgrades: { power: 5, precision: 0, speed: 2, ward: 4 },
      }),
    );
  });

  it("falls back safely when storage access throws", () => {
    const brokenStorage: ProgressionStorage = {
      getItem: () => {
        throw new Error("unavailable");
      },
      setItem: () => {
        throw new Error("unavailable");
      },
    };

    const state = createState();
    expect(load(brokenStorage)).toEqual(state);
    expect(save(state, brokenStorage)).toBe(false);
  });
});

describe("upgrade costs", () => {
  it("keeps the first workshop choices attainable with the slower economy", () => {
    expect(getUpgradeCost("speed", 0)).toBe(8);
    expect(getUpgradeCost("precision", 0)).toBe(10);
    expect(getUpgradeCost("power", 0)).toBe(12);
    expect(getUpgradeCost("ward", 0)).toBe(15);
  });

  it.each(UPGRADE_IDS)("increases the %s price at every level", (upgrade) => {
    const costs = [0, 1, 2, 3, 4].map((level) =>
      getUpgradeCost(upgrade, level as 0 | 1 | 2 | 3 | 4),
    );

    expect(costs.every((cost) => typeof cost === "number")).toBe(true);
    for (let index = 1; index < costs.length; index += 1) {
      expect(costs[index]).toBeGreaterThan(costs[index - 1] ?? 0);
    }
    expect(getUpgradeCost(upgrade, MAX_UPGRADE_LEVEL)).toBeNull();
  });
});

describe("purchaseUpgrade", () => {
  it("deducts thread and raises only the purchased level", () => {
    const state = createState({ thread: 100 });
    const cost = getUpgradeCost("power", 0);

    expect(cost).not.toBeNull();
    const purchased = purchaseUpgrade(state, "power");

    expect(purchased).not.toBe(state);
    expect(purchased.upgrades).not.toBe(state.upgrades);
    expect(purchased.thread).toBe(100 - (cost ?? 0));
    expect(purchased.upgrades).toEqual({
      power: 1,
      precision: 0,
      speed: 0,
      ward: 0,
    });
    expect(state).toEqual(createState({ thread: 100 }));
  });

  it("returns the original state when thread is insufficient", () => {
    const state = createState({ thread: 1 });
    expect(purchaseUpgrade(state, "precision")).toBe(state);
  });

  it("returns the original state at maximum level", () => {
    const state = createState({
      thread: 10_000,
      upgrades: { power: 0, precision: 0, speed: 0, ward: 5 },
    });

    expect(purchaseUpgrade(state, "ward")).toBe(state);
  });
});
