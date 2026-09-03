export const LEADERBOARD_MAX_ROWS = 20 as const;

export interface LeaderboardRow {
  readonly id: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly photoUrl: string;
  readonly level: number;
  readonly isCurrentUser: boolean;
  /** True only for the player's local fallback, which is not an official rank. */
  readonly isLocalOnly?: boolean;
}

export interface LocalLeaderboardUser {
  readonly id: number;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly photoUrl?: string;
  readonly highestStageCleared: number;
}

export interface LeaderboardNormalizeOptions {
  readonly currentUserId?: number | null;
  readonly localCurrentUser?: LocalLeaderboardUser | null;
  readonly limit?: number;
}

export type LeaderboardRequestStatus =
  | "idle"
  | "loading"
  | "success"
  | "error";

export interface LeaderboardViewModel {
  readonly status: "idle" | "loading" | "ready" | "empty" | "error";
  readonly rows: readonly LeaderboardRow[];
  readonly message: string | null;
}

type UnknownRecord = Record<string, unknown>;

interface ProfileFields {
  readonly firstName: string;
  readonly lastName: string;
  readonly photoUrl: string;
}

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string" || value.trim() === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toNonNegativeInt(value: unknown): number {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(numeric)));
}

function toPositiveId(value: unknown): number | null {
  const id = toNonNegativeInt(value);
  return id > 0 ? id : null;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 100) : "";
}

function firstText(...values: readonly unknown[]): string {
  for (const value of values) {
    const text = normalizeText(value);
    if (text !== "") return text;
  }
  return "";
}

function normalizePhotoUrl(value: unknown): string {
  const text = typeof value === "string" ? value.trim().slice(0, 2_048) : "";
  if (text === "") return "";
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? text : "";
  } catch {
    return "";
  }
}

function firstPhotoUrl(...values: readonly unknown[]): string {
  for (const value of values) {
    const photoUrl = normalizePhotoUrl(value);
    if (photoUrl !== "") return photoUrl;
  }
  return "";
}

function readProfile(value: unknown): ProfileFields {
  const profile = asRecord(value) ?? {};
  return {
    firstName: firstText(profile.first_name, profile.firstName),
    lastName: firstText(profile.last_name, profile.lastName),
    photoUrl: firstPhotoUrl(
      profile.photo_200,
      profile.photo_100,
      profile.photo_50,
      profile.photo,
      profile.photo_url,
      profile.photoUrl,
    ),
  };
}

function mergeProfileFields(
  ...profiles: readonly ProfileFields[]
): ProfileFields {
  return {
    firstName: firstText(...profiles.map((profile) => profile.firstName)),
    lastName: firstText(...profiles.map((profile) => profile.lastName)),
    photoUrl: firstPhotoUrl(...profiles.map((profile) => profile.photoUrl)),
  };
}

/** Finds either the full VK API envelope or its already-unwrapped response. */
function findLeaderboardPayload(value: unknown): UnknownRecord {
  let current = asRecord(value);
  for (let depth = 0; current !== null && depth < 4; depth += 1) {
    if (Array.isArray(current.items) || Array.isArray(current.profiles)) {
      return current;
    }
    current = asRecord(current.response);
  }
  return {};
}

function readItemId(item: UnknownRecord): number | null {
  const embedded = asRecord(item.profile) ?? asRecord(item.user);
  return (
    toPositiveId(item.user_id) ??
    toPositiveId(item.userId) ??
    toPositiveId(embedded?.id) ??
    toPositiveId(embedded?.user_id) ??
    toPositiveId(item.id)
  );
}

function readItemLevel(item: UnknownRecord): number {
  for (const value of [item.level, item.points, item.score]) {
    if (toFiniteNumber(value) !== null) return toNonNegativeInt(value);
  }
  return 0;
}

function getProfileId(value: unknown): number | null {
  const profile = asRecord(value);
  if (profile === null) return null;
  return toPositiveId(profile.id) ?? toPositiveId(profile.user_id);
}

function normalizeLimit(value: unknown): number {
  if (value === undefined) return LEADERBOARD_MAX_ROWS;
  return Math.min(LEADERBOARD_MAX_ROWS, toNonNegativeInt(value));
}

/**
 * Converts the extended `apps.getLeaderboard` response into safe UI rows.
 * Only the current player's local progress may be added; no result is invented
 * for another VK user when their API row or profile is absent.
 */
export function normalizeLeaderboardResponse(
  input: unknown,
  options: LeaderboardNormalizeOptions = {},
): LeaderboardRow[] {
  const payload = findLeaderboardPayload(input);
  const rawProfiles = Array.isArray(payload.profiles) ? payload.profiles : [];
  const profiles = new Map<number, ProfileFields>();

  for (const rawProfile of rawProfiles) {
    const id = getProfileId(rawProfile);
    if (id === null) continue;
    profiles.set(
      id,
      mergeProfileFields(
        readProfile(rawProfile),
        profiles.get(id) ?? readProfile(null),
      ),
    );
  }

  const local = options.localCurrentUser ?? null;
  const localId = local === null ? null : toPositiveId(local.id);
  const currentUserId = localId ?? toPositiveId(options.currentUserId);
  const rowsById = new Map<number, LeaderboardRow>();
  const rawItems = Array.isArray(payload.items) ? payload.items : [];

  for (const rawItem of rawItems) {
    const item = asRecord(rawItem);
    if (item === null) continue;
    const id = readItemId(item);
    if (id === null) continue;

    const embeddedProfile = asRecord(item.profile) ?? asRecord(item.user);
    const profile = mergeProfileFields(
      readProfile(embeddedProfile),
      readProfile(item),
      profiles.get(id) ?? readProfile(null),
    );
    const candidate: LeaderboardRow = {
      id,
      ...profile,
      level: readItemLevel(item),
      isCurrentUser: currentUserId === id,
    };
    const previous = rowsById.get(id);
    if (previous === undefined) {
      rowsById.set(id, candidate);
      continue;
    }
    const mergedProfile = mergeProfileFields(previous, candidate);
    rowsById.set(id, {
      id,
      ...mergedProfile,
      level: Math.max(previous.level, candidate.level),
      isCurrentUser: previous.isCurrentUser || candidate.isCurrentUser,
    });
  }

  if (local !== null && localId !== null) {
    const previous = rowsById.get(localId);
    const localProfile = readProfile(local);
    if (previous === undefined) {
      rowsById.set(localId, {
        id: localId,
        ...localProfile,
        level: toNonNegativeInt(local.highestStageCleared),
        isCurrentUser: true,
        isLocalOnly: true,
      });
    } else {
      rowsById.set(localId, {
        ...previous,
        ...mergeProfileFields(previous, localProfile),
        isCurrentUser: currentUserId === localId,
      });
    }
  }

  return [...rowsById.values()]
    .sort((left, right) => right.level - left.level || left.id - right.id)
    .slice(0, normalizeLimit(options.limit));
}

export function createLeaderboardViewModel(
  requestStatus: LeaderboardRequestStatus,
  input: unknown = null,
  options: LeaderboardNormalizeOptions = {},
): LeaderboardViewModel {
  if (requestStatus === "idle") {
    return { status: "idle", rows: [], message: null };
  }
  if (requestStatus === "loading") {
    return { status: "loading", rows: [], message: "Загружаем рейтинг…" };
  }
  if (requestStatus === "error") {
    return {
      status: "error",
      rows: [],
      message: "Не удалось загрузить рейтинг. Попробуйте ещё раз.",
    };
  }

  const rows = normalizeLeaderboardResponse(input, options);
  return rows.length > 0
    ? { status: "ready", rows, message: null }
    : { status: "empty", rows, message: "В рейтинге пока никого нет." };
}
