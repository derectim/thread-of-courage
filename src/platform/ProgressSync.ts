import {
  PROGRESSION_SAVE_KEY,
  load as loadProgression,
  save as saveProgression,
  type ProgressionState,
  type ProgressionStorage,
} from "../game/ProgressionStore";
import type { PlatformAdapter } from "./PlatformAdapter";

export const LOCAL_SYNC_ENVELOPE_KEY = "thread-of-courage-cloud-sync-v1";
export const PROGRESS_SYNC_VERSION = 1 as const;

export interface ProgressSyncEnvelope {
  readonly version: typeof PROGRESS_SYNC_VERSION;
  readonly savedAt: number;
  readonly payload: string;
}

export interface ProgressSyncResult {
  readonly source: "local" | "cloud";
  readonly state: ProgressionState;
  readonly cloudAvailable: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeInteger(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function readStorage(storage: ProgressionStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: ProgressionStorage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function createProgressSyncEnvelope(
  payload: string,
  savedAt = Date.now(),
): ProgressSyncEnvelope {
  return {
    version: PROGRESS_SYNC_VERSION,
    savedAt: safeInteger(savedAt),
    payload,
  };
}

export function serializeProgressSyncEnvelope(envelope: ProgressSyncEnvelope): string {
  return JSON.stringify(envelope);
}

/** Accepts the current envelope and bare v3 progress from early VK builds. */
export function parseProgressSyncEnvelope(raw: string | null): ProgressSyncEnvelope | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      isRecord(parsed) &&
      parsed.version === PROGRESS_SYNC_VERSION &&
      typeof parsed.payload === "string"
    ) {
      JSON.parse(parsed.payload);
      return createProgressSyncEnvelope(parsed.payload, safeInteger(parsed.savedAt));
    }
    if (isRecord(parsed) && typeof parsed.highestStageCleared !== "undefined") {
      return createProgressSyncEnvelope(raw, 0);
    }
  } catch {
    return null;
  }
  return null;
}

interface ProgressRank {
  readonly stage: number;
  readonly victories: number;
  readonly shots: number;
  readonly collection: number;
}

function getProgressRank(payload: string): ProgressRank {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!isRecord(parsed)) throw new Error("invalid progress");
    const stats = isRecord(parsed.stats) ? parsed.stats : {};
    return {
      stage: safeInteger(parsed.highestStageCleared),
      victories: safeInteger(stats.monstersDefeated),
      shots: safeInteger(stats.needlesThrown),
      collection:
        (Array.isArray(parsed.ownedNeedles) ? parsed.ownedNeedles.length : 0) +
        (Array.isArray(parsed.ownedBackgrounds) ? parsed.ownedBackgrounds.length : 0) +
        (Array.isArray(parsed.ownedSeasonCosmetics)
          ? parsed.ownedSeasonCosmetics.length
          : 0),
    };
  } catch {
    return { stage: 0, victories: 0, shots: 0, collection: 0 };
  }
}

function compareRank(left: ProgressRank, right: ProgressRank): number {
  for (const key of ["stage", "victories", "shots", "collection"] as const) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  return 0;
}

/** Picks the furthest save first and uses time only when progression is tied. */
export function chooseProgressEnvelope(
  local: ProgressSyncEnvelope,
  cloud: ProgressSyncEnvelope | null,
): { readonly source: "local" | "cloud"; readonly envelope: ProgressSyncEnvelope } {
  if (!cloud) return { source: "local", envelope: local };
  const rankComparison = compareRank(
    getProgressRank(local.payload),
    getProgressRank(cloud.payload),
  );
  if (rankComparison > 0) return { source: "local", envelope: local };
  if (rankComparison < 0) return { source: "cloud", envelope: cloud };
  return cloud.savedAt > local.savedAt
    ? { source: "cloud", envelope: cloud }
    : { source: "local", envelope: local };
}

function resolveBrowserStorage(): ProgressionStorage | null {
  try {
    return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

/** Hydrates localStorage before Phaser creates the scene, then mirrors the winner to VK. */
export async function synchronizeProgressOnStartup(
  platform: PlatformAdapter,
  storage: ProgressionStorage | null = resolveBrowserStorage(),
  now = Date.now(),
): Promise<ProgressSyncResult> {
  const localState = loadProgression(storage);
  const localPayload = JSON.stringify(localState);
  const localSavedEnvelope = storage
    ? parseProgressSyncEnvelope(readStorage(storage, LOCAL_SYNC_ENVELOPE_KEY))
    : null;
  const localEnvelope = createProgressSyncEnvelope(
    localPayload,
    localSavedEnvelope?.savedAt ?? 0,
  );
  const cloudRaw = await platform.loadCloudProgress();
  const cloudEnvelope = parseProgressSyncEnvelope(cloudRaw);
  const selected = chooseProgressEnvelope(localEnvelope, cloudEnvelope);

  if (storage && selected.source === "cloud") {
    writeStorage(storage, PROGRESSION_SAVE_KEY, selected.envelope.payload);
  }
  const normalizedState = loadProgression(storage);
  saveProgression(normalizedState, storage);

  const freshEnvelope = createProgressSyncEnvelope(JSON.stringify(normalizedState), now);
  const serializedEnvelope = serializeProgressSyncEnvelope(freshEnvelope);
  if (storage) writeStorage(storage, LOCAL_SYNC_ENVELOPE_KEY, serializedEnvelope);
  const cloudAvailable = await platform.saveCloudProgress(serializedEnvelope);

  return { source: selected.source, state: normalizedState, cloudAvailable };
}

/** Records the latest local envelope immediately and mirrors it to VK when available. */
export async function pushProgressToCloud(
  platform: PlatformAdapter,
  state: ProgressionState,
  storage: ProgressionStorage | null = resolveBrowserStorage(),
  now = Date.now(),
): Promise<boolean> {
  const envelope = createProgressSyncEnvelope(JSON.stringify(state), now);
  const serialized = serializeProgressSyncEnvelope(envelope);
  if (storage) writeStorage(storage, LOCAL_SYNC_ENVELOPE_KEY, serialized);
  return platform.saveCloudProgress(serialized);
}
