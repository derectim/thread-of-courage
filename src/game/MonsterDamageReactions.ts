import type { MonsterDamageReaction } from "./content";

export type MonsterDamageMotif =
  | "tape"
  | "velvet"
  | "metal"
  | "wax"
  | "lace"
  | "blade"
  | "web"
  | "needle"
  | "royal"
  | "clockwork";

export interface MonsterDamageReactionProfile {
  readonly id: MonsterDamageReaction;
  readonly motif: MonsterDamageMotif;
  readonly primary: number;
  readonly secondary: number;
  readonly accent: number;
  readonly particleCount: number;
  readonly durationMs: number;
  readonly shake: number;
}

export const MONSTER_DAMAGE_REACTIONS: Readonly<
  Record<MonsterDamageReaction, MonsterDamageReactionProfile>
> = {
  "tape-ripple": {
    id: "tape-ripple",
    motif: "tape",
    primary: 0xf2c65b,
    secondary: 0xffefad,
    accent: 0x4a716d,
    particleCount: 7,
    durationMs: 430,
    shake: 0.0023,
  },
  "velvet-dust": {
    id: "velvet-dust",
    motif: "velvet",
    primary: 0x7f3e78,
    secondary: 0xbc77ad,
    accent: 0xe8b44d,
    particleCount: 10,
    durationMs: 620,
    shake: 0.0018,
  },
  "metal-sparks": {
    id: "metal-sparks",
    motif: "metal",
    primary: 0x64d9d0,
    secondary: 0xffdf75,
    accent: 0xf5f1dc,
    particleCount: 9,
    durationMs: 390,
    shake: 0.003,
  },
  "wax-crack": {
    id: "wax-crack",
    motif: "wax",
    primary: 0xf0c9a7,
    secondary: 0xffe8c8,
    accent: 0xa75b77,
    particleCount: 7,
    durationMs: 560,
    shake: 0.002,
  },
  "lace-unravel": {
    id: "lace-unravel",
    motif: "lace",
    primary: 0xf8f0dc,
    secondary: 0xc8e8e1,
    accent: 0x8d65a3,
    particleCount: 8,
    durationMs: 680,
    shake: 0.0017,
  },
  "blade-sparks": {
    id: "blade-sparks",
    motif: "blade",
    primary: 0xe9edf0,
    secondary: 0xffb84d,
    accent: 0x7aa59e,
    particleCount: 11,
    durationMs: 440,
    shake: 0.0038,
  },
  "web-unwind": {
    id: "web-unwind",
    motif: "web",
    primary: 0xd6c5e8,
    secondary: 0x8e5aa2,
    accent: 0xe0b25a,
    particleCount: 9,
    durationMs: 720,
    shake: 0.0027,
  },
  "needle-burst": {
    id: "needle-burst",
    motif: "needle",
    primary: 0xe9eef0,
    secondary: 0xf4c557,
    accent: 0xb34f63,
    particleCount: 12,
    durationMs: 520,
    shake: 0.0035,
  },
  "royal-unravel": {
    id: "royal-unravel",
    motif: "royal",
    primary: 0x9f4f91,
    secondary: 0xe8b44d,
    accent: 0xf4dfbe,
    particleCount: 13,
    durationMs: 820,
    shake: 0.0042,
  },
  "clockwork-break": {
    id: "clockwork-break",
    motif: "clockwork",
    primary: 0x4bb9b0,
    secondary: 0xd69a3b,
    accent: 0xe9edf0,
    particleCount: 14,
    durationMs: 760,
    shake: 0.0045,
  },
};

export function getMonsterDamageReactionProfile(
  id: MonsterDamageReaction,
): MonsterDamageReactionProfile {
  return MONSTER_DAMAGE_REACTIONS[id];
}
