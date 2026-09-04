import type { RoomId } from "./content";
import { angularDistance, isAngleBlocked, normalizeAngle } from "./geometry";

export const ACTIVE_ABILITY_IDS = [
  "time-loop",
  "magnetic-stitch",
  "spare-knot",
] as const;

export type ActiveAbilityId = (typeof ACTIVE_ABILITY_IDS)[number];

export interface ActiveAbilityDefinition {
  readonly id: ActiveAbilityId;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  readonly symbol: string;
  readonly iconFileName: string;
  readonly unlockStage: number;
  readonly chargesPerStage: number;
  readonly cooldownMs: number;
  readonly durationMs?: number;
}

export const ACTIVE_ABILITIES: readonly ActiveAbilityDefinition[] = [
  {
    id: "time-loop",
    name: "Петля времени",
    shortName: "Петля",
    description: "Один раз за поход после видео сильно замедляет узор противника.",
    symbol: "◷",
    iconFileName: "ability-time-loop.webp",
    unlockStage: 1,
    chargesPerStage: 1,
    cooldownMs: 0,
    durationMs: 2_600,
  },
  {
    id: "magnetic-stitch",
    name: "Магнитный стежок",
    shortName: "Магнит",
    description: "Один раз за поход после видео следующая игла найдёт свободное место.",
    symbol: "⌁",
    iconFileName: "ability-magnetic-stitch.webp",
    unlockStage: 6,
    chargesPerStage: 1,
    cooldownMs: 0,
  },
  {
    id: "spare-knot",
    name: "Запасной узел",
    shortName: "Узел",
    description: "Один раз за поход после видео возвращает щит или спасает от столкновения.",
    symbol: "◇",
    iconFileName: "ability-spare-knot.webp",
    unlockStage: 12,
    chargesPerStage: 1,
    cooldownMs: 0,
  },
] as const;

export const DEFAULT_ACTIVE_ABILITY_ID: ActiveAbilityId = "time-loop";

export function isActiveAbilityId(value: unknown): value is ActiveAbilityId {
  return ACTIVE_ABILITY_IDS.includes(value as ActiveAbilityId);
}

export function normalizeActiveAbilityId(value: unknown): ActiveAbilityId {
  return isActiveAbilityId(value) ? value : DEFAULT_ACTIVE_ABILITY_ID;
}

export function getActiveAbility(id: unknown): ActiveAbilityDefinition {
  const normalizedId = normalizeActiveAbilityId(id);
  return (
    ACTIVE_ABILITIES.find((ability) => ability.id === normalizedId) ??
    ACTIVE_ABILITIES[0]
  );
}

export interface ActiveAbilityRuntime {
  readonly id: ActiveAbilityId;
  readonly charges: number;
  readonly cooldownUntil: number;
  readonly effectUntil: number;
  readonly magneticArmed: boolean;
  readonly spareKnotArmed: boolean;
}

export function createActiveAbilityRuntime(
  id: unknown,
): ActiveAbilityRuntime {
  const ability = getActiveAbility(id);
  return {
    id: ability.id,
    charges: ability.chargesPerStage,
    cooldownUntil: 0,
    effectUntil: 0,
    magneticArmed: false,
    spareKnotArmed: false,
  };
}

export function getCooldownRemaining(
  runtime: ActiveAbilityRuntime,
  now: number,
): number {
  return Math.max(0, runtime.cooldownUntil - now);
}

export function canActivateAbility(
  runtime: ActiveAbilityRuntime,
  now: number,
): boolean {
  if (runtime.charges <= 0 || getCooldownRemaining(runtime, now) > 0) {
    return false;
  }

  if (runtime.id === "time-loop" && runtime.effectUntil > now) return false;
  if (runtime.id === "magnetic-stitch" && runtime.magneticArmed) return false;
  if (runtime.id === "spare-knot" && runtime.spareKnotArmed) return false;
  return true;
}

export interface AbilityActivationResult {
  readonly runtime: ActiveAbilityRuntime;
  readonly wardCharges: number;
  readonly effect: "time-loop" | "magnetic-armed" | "ward-restored" | "knot-armed";
}

export function activateAbility(
  runtime: ActiveAbilityRuntime,
  now: number,
  wardCharges: number,
  startingWardCharges: number,
): AbilityActivationResult | null {
  if (!canActivateAbility(runtime, now)) return null;

  const ability = getActiveAbility(runtime.id);
  const baseRuntime: ActiveAbilityRuntime = {
    ...runtime,
    charges: runtime.charges - 1,
    cooldownUntil:
      runtime.charges > 1 ? now + ability.cooldownMs : runtime.cooldownUntil,
  };

  switch (runtime.id) {
    case "time-loop":
      return {
        runtime: {
          ...baseRuntime,
          effectUntil: now + (ability.durationMs ?? 0),
        },
        wardCharges,
        effect: "time-loop",
      };
    case "magnetic-stitch":
      return {
        runtime: { ...baseRuntime, magneticArmed: true },
        wardCharges,
        effect: "magnetic-armed",
      };
    case "spare-knot":
      if (wardCharges < startingWardCharges) {
        return {
          runtime: baseRuntime,
          wardCharges: wardCharges + 1,
          effect: "ward-restored",
        };
      }
      return {
        runtime: { ...baseRuntime, spareKnotArmed: true },
        wardCharges,
        effect: "knot-armed",
      };
  }
}

export function consumeMagneticStitch(
  runtime: ActiveAbilityRuntime,
): ActiveAbilityRuntime {
  return runtime.magneticArmed
    ? { ...runtime, magneticArmed: false }
    : runtime;
}

export function consumeSpareKnot(
  runtime: ActiveAbilityRuntime,
): ActiveAbilityRuntime {
  return runtime.spareKnotArmed
    ? { ...runtime, spareKnotArmed: false }
    : runtime;
}

export const TIME_LOOP_SPEED_MULTIPLIER = 0.38;
export const MAGNETIC_MAX_CORRECTION = 0.17;

export interface MagneticHitResult {
  readonly angle: number;
  readonly corrected: boolean;
}

/**
 * Finds the nearest legal angle around the intended impact. Candidate points
 * sit just outside each occupied gap, so the correction stays small and the
 * newly attached needle still visibly lands where the player aimed.
 */
export function findMagneticHitAngle(
  intendedAngle: number,
  existingAngles: readonly number[],
  minimumGap: number,
  maximumCorrection = MAGNETIC_MAX_CORRECTION,
): MagneticHitResult | null {
  const intended = normalizeAngle(intendedAngle);
  if (!isAngleBlocked(intended, existingAngles, minimumGap)) {
    return { angle: intended, corrected: false };
  }

  const clearance = minimumGap + 0.001;
  const candidates = existingAngles
    .flatMap((angle) => [
      normalizeAngle(angle - clearance),
      normalizeAngle(angle + clearance),
    ])
    .filter(
      (angle) => angularDistance(intended, angle) <= maximumCorrection,
    )
    .sort(
      (left, right) =>
        angularDistance(intended, left) - angularDistance(intended, right),
    );

  const corrected = candidates.find(
    (angle) => !isAngleBlocked(angle, existingAngles, minimumGap),
  );
  return corrected === undefined
    ? null
    : { angle: corrected, corrected: true };
}

export type RoomEffectPhase = "calm" | "warning" | "active";

export interface RoomEffectState {
  readonly phase: RoomEffectPhase;
  readonly eventIndex: number;
  readonly speedMultiplier: number;
  readonly shouldReverse: boolean;
  readonly warningText: string;
}

interface RoomEffectTiming {
  readonly initialDelay: number;
  readonly cycleDuration: number;
  readonly warningDuration: number;
  readonly activeDuration: number;
}

const ROOM_EFFECT_TIMINGS: Readonly<Record<RoomId, RoomEffectTiming>> = {
  attic: {
    initialDelay: 4.6,
    cycleDuration: 8.6,
    warningDuration: 0.8,
    activeDuration: 0.9,
  },
  theatre: {
    initialDelay: 4.1,
    cycleDuration: 7.4,
    warningDuration: 0.9,
    activeDuration: 0.35,
  },
  machine: {
    initialDelay: 3.4,
    cycleDuration: 4.8,
    warningDuration: 0.65,
    activeDuration: 0.9,
  },
};

const CALM_ROOM_EFFECT: RoomEffectState = {
  phase: "calm",
  eventIndex: -1,
  speedMultiplier: 1,
  shouldReverse: false,
  warningText: "",
};

/** Returns a deterministic, real-time room beat suitable for every pattern. */
export function getRoomEffectState(
  roomId: RoomId,
  elapsedSeconds: number,
): RoomEffectState {
  const timing = ROOM_EFFECT_TIMINGS[roomId];
  const elapsed = Math.max(0, elapsedSeconds);
  if (elapsed < timing.initialDelay) return CALM_ROOM_EFFECT;

  const sinceFirstEvent = elapsed - timing.initialDelay;
  const eventIndex = Math.floor(sinceFirstEvent / timing.cycleDuration);
  const cycleElapsed = sinceFirstEvent % timing.cycleDuration;

  if (cycleElapsed < timing.warningDuration) {
    return {
      phase: "warning",
      eventIndex,
      speedMultiplier: 1,
      shouldReverse: false,
      warningText:
        roomId === "attic"
          ? "⚠ Сквозняк набирает силу"
          : roomId === "theatre"
            ? "⚠ Нити готовятся сменить ход"
            : "⚠ Механизм набирает такт",
    };
  }

  const activeElapsed = cycleElapsed - timing.warningDuration;
  if (activeElapsed >= timing.activeDuration) return CALM_ROOM_EFFECT;

  if (roomId === "theatre") {
    return {
      phase: "active",
      eventIndex,
      speedMultiplier: 1,
      shouldReverse: true,
      warningText: "↺ СМЕНА ХОДА!",
    };
  }

  if (roomId === "machine") {
    const progress = activeElapsed / timing.activeDuration;
    return {
      phase: "active",
      eventIndex,
      speedMultiplier: 1 + Math.sin(progress * Math.PI) * 0.34,
      shouldReverse: false,
      warningText: "◆ ПУЛЬС МЕХАНИЗМА",
    };
  }

  return {
    phase: "active",
    eventIndex,
    speedMultiplier: 1.32,
    shouldReverse: false,
    warningText: "↯ ПОРЫВ СКВОЗНЯКА!",
  };
}
