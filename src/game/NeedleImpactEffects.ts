export type NeedleImpactReactionKind =
  | "wool-smoke"
  | "button-sparks"
  | "golden-thread"
  | "silk-stars"
  | "gem-shards"
  | "stitch-crown"
  | "moon-mist"
  | "runic-shards"
  | "lightning-wrap"
  | "dawn-petals";

export interface NeedleImpactVfxProfile {
  readonly reaction: NeedleImpactReactionKind;
  readonly primary: number;
  readonly secondary: number;
  readonly accent: number;
  readonly particleCount: number;
  readonly durationMs: number;
}

/** Bespoke animated reaction for every published collectible hit artwork. */
export const NEEDLE_IMPACT_VFX_PROFILES: Readonly<
  Record<string, NeedleImpactVfxProfile>
> = {
  "living-thread-01-free-3": {
    reaction: "wool-smoke",
    primary: 0xf8f1d9,
    secondary: 0xd7e6f5,
    accent: 0xe2b15b,
    particleCount: 7,
    durationMs: 620,
  },
  "living-thread-01-free-11": {
    reaction: "button-sparks",
    primary: 0xffd75e,
    secondary: 0xfff2b3,
    accent: 0x56d4c9,
    particleCount: 12,
    durationMs: 420,
  },
  "living-thread-01-free-17": {
    reaction: "golden-thread",
    primary: 0xf2bd4e,
    secondary: 0xffed9b,
    accent: 0xa94f72,
    particleCount: 6,
    durationMs: 590,
  },
  "living-thread-01-premium-4": {
    reaction: "silk-stars",
    primary: 0xeee8ff,
    secondary: 0xb99cff,
    accent: 0xffffff,
    particleCount: 8,
    durationMs: 660,
  },
  "living-thread-01-premium-10": {
    reaction: "gem-shards",
    primary: 0xeb5d9d,
    secondary: 0x52ddd3,
    accent: 0xf6cf5c,
    particleCount: 10,
    durationMs: 510,
  },
  "living-thread-01-premium-16": {
    reaction: "stitch-crown",
    primary: 0xf4c55c,
    secondary: 0xffedb0,
    accent: 0x9a3f62,
    particleCount: 9,
    durationMs: 710,
  },
  "silver-mastery-4": {
    reaction: "moon-mist",
    primary: 0xf5fbff,
    secondary: 0xaed8ff,
    accent: 0xc5b2ff,
    particleCount: 10,
    durationMs: 740,
  },
  "bone-mastery-4": {
    reaction: "runic-shards",
    primary: 0xd9a968,
    secondary: 0xffe0a3,
    accent: 0x8d6b49,
    particleCount: 8,
    durationMs: 650,
  },
  "storm-mastery-4": {
    reaction: "lightning-wrap",
    primary: 0x50d7cf,
    secondary: 0xa78bfa,
    accent: 0xeafaff,
    particleCount: 9,
    durationMs: 350,
  },
  "sunrise-mastery-4": {
    reaction: "dawn-petals",
    primary: 0xff9f55,
    secondary: 0xffe38c,
    accent: 0xffd1af,
    particleCount: 8,
    durationMs: 760,
  },
};

export function getNeedleImpactVfxProfile(
  collectibleId: string,
): NeedleImpactVfxProfile | null {
  return NEEDLE_IMPACT_VFX_PROFILES[collectibleId] ?? null;
}
