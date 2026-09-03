import { describe, expect, it, vi } from "vitest";

import { createDefaultState, type ProgressionStorage } from "../game/ProgressionStore";
import type { PlatformAdapter } from "./PlatformAdapter";
import {
  LOCAL_SYNC_ENVELOPE_KEY,
  chooseProgressEnvelope,
  createProgressSyncEnvelope,
  parseProgressSyncEnvelope,
  pushProgressToCloud,
  serializeProgressSyncEnvelope,
  synchronizeProgressOnStartup,
} from "./ProgressSync";

class MemoryStorage implements ProgressionStorage {
  public readonly values = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function fakePlatform(cloud: string | null): PlatformAdapter {
  return {
    kind: "vk",
    launchContext: null,
    initialize: vi.fn(async () => true),
    hitFeedback: vi.fn(),
    showRewardedAd: vi.fn(async () => "unsupported" as const),
    showInterstitialAd: vi.fn(async () => "unsupported" as const),
    showLeaderboard: vi.fn(async () => "unsupported" as const),
    loadLeaderboard: vi.fn(async () => ({ status: "unsupported" as const })),
    getUserInfo: vi.fn(async () => null),
    showOrder: vi.fn(async () => ({ status: "unsupported" as const })),
    loadCloudProgress: vi.fn(async () => cloud),
    saveCloudProgress: vi.fn(async () => true),
    subscribeLifecycle: vi.fn(() => () => undefined),
    destroy: vi.fn(),
  };
}

describe("progress synchronization", () => {
  it("round-trips envelopes and rejects broken data", () => {
    const envelope = createProgressSyncEnvelope('{"highestStageCleared":2}', 42);
    expect(parseProgressSyncEnvelope(serializeProgressSyncEnvelope(envelope))).toEqual(envelope);
    expect(parseProgressSyncEnvelope("broken")).toBeNull();
  });

  it("prefers furthest progress before timestamps", () => {
    const local = createProgressSyncEnvelope(
      JSON.stringify({ highestStageCleared: 7, stats: { monstersDefeated: 8 } }),
      10,
    );
    const newerButBehind = createProgressSyncEnvelope(
      JSON.stringify({ highestStageCleared: 4, stats: { monstersDefeated: 99 } }),
      100,
    );
    expect(chooseProgressEnvelope(local, newerButBehind).source).toBe("local");
  });

  it("uses the newer save when progress ranks tie", () => {
    const payload = JSON.stringify({ highestStageCleared: 7 });
    expect(
      chooseProgressEnvelope(
        createProgressSyncEnvelope(payload, 10),
        createProgressSyncEnvelope(payload, 11),
      ).source,
    ).toBe("cloud");
  });

  it("hydrates a stronger cloud save before gameplay and uploads a fresh envelope", async () => {
    const storage = new MemoryStorage();
    const cloudState = { ...createDefaultState(), highestStageCleared: 9, thread: 40 };
    const cloud = serializeProgressSyncEnvelope(
      createProgressSyncEnvelope(JSON.stringify(cloudState), 50),
    );
    const platform = fakePlatform(cloud);

    const result = await synchronizeProgressOnStartup(platform, storage, 100);

    expect(result.source).toBe("cloud");
    expect(result.state.highestStageCleared).toBe(9);
    expect(result.state.thread).toBe(40);
    expect(storage.getItem(LOCAL_SYNC_ENVELOPE_KEY)).not.toBeNull();
    expect(platform.saveCloudProgress).toHaveBeenCalledOnce();
  });

  it("updates local sync metadata even if cloud writing is unavailable", async () => {
    const storage = new MemoryStorage();
    const platform = fakePlatform(null);
    vi.mocked(platform.saveCloudProgress).mockResolvedValue(false);

    await expect(
      pushProgressToCloud(platform, createDefaultState(), storage, 200),
    ).resolves.toBe(false);
    expect(
      parseProgressSyncEnvelope(storage.getItem(LOCAL_SYNC_ENVELOPE_KEY))?.savedAt,
    ).toBe(200);
  });
});
