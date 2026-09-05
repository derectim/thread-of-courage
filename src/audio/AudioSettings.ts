export const DEFAULT_MUSIC_VOLUME = 0.7;
export const DEFAULT_EFFECTS_VOLUME = 0.8;

export interface AudioSettings {
  readonly muted: boolean;
  readonly musicVolume: number;
  readonly effectsVolume: number;
}

export function normalizeVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(Math.max(0, Math.min(1, value)) * 100) / 100
    : fallback;
}
