import { describe, expect, it } from "vitest";

import {
  ACTIVE_ABILITIES,
  activateAbility,
  canActivateAbility,
  consumeMagneticStitch,
  consumeSpareKnot,
  createActiveAbilityRuntime,
  findMagneticHitAngle,
  getCooldownRemaining,
  getRoomEffectState,
  normalizeActiveAbilityId,
} from "./ActiveAbilities";
import { angularDistance, isAngleBlocked } from "./geometry";

describe("active abilities", () => {
  it("normalizes persisted ids and gives every ability a usable stage loadout", () => {
    expect(normalizeActiveAbilityId("magnetic-stitch")).toBe("magnetic-stitch");
    expect(normalizeActiveAbilityId("unknown")).toBe("time-loop");
    expect(ACTIVE_ABILITIES).toHaveLength(3);
    for (const ability of ACTIVE_ABILITIES) {
      expect(ability.chargesPerStage).toBeGreaterThan(0);
      expect(ability.unlockStage).toBeGreaterThan(0);
    }
  });

  it("starts a time loop, spends a charge, and enforces its cooldown", () => {
    const runtime = createActiveAbilityRuntime("time-loop");
    const activation = activateAbility(runtime, 1_000, 0, 0);
    expect(activation?.effect).toBe("time-loop");
    expect(activation?.runtime.charges).toBe(1);
    expect(activation?.runtime.effectUntil).toBe(3_600);
    expect(getCooldownRemaining(activation!.runtime, 2_000)).toBe(6_000);
    expect(canActivateAbility(activation!.runtime, 7_999)).toBe(false);
    expect(canActivateAbility(activation!.runtime, 8_000)).toBe(true);
  });

  it("arms and consumes a magnetic stitch", () => {
    const runtime = createActiveAbilityRuntime("magnetic-stitch");
    const activation = activateAbility(runtime, 500, 0, 0)!;
    expect(activation.effect).toBe("magnetic-armed");
    expect(activation.runtime.magneticArmed).toBe(true);
    expect(consumeMagneticStitch(activation.runtime).magneticArmed).toBe(false);
  });

  it("restores a missing ward, otherwise arms one emergency save", () => {
    const missingWard = activateAbility(
      createActiveAbilityRuntime("spare-knot"),
      0,
      0,
      2,
    )!;
    expect(missingWard.effect).toBe("ward-restored");
    expect(missingWard.wardCharges).toBe(1);

    const fullWard = activateAbility(
      createActiveAbilityRuntime("spare-knot"),
      0,
      2,
      2,
    )!;
    expect(fullWard.effect).toBe("knot-armed");
    expect(fullWard.runtime.spareKnotArmed).toBe(true);
    expect(consumeSpareKnot(fullWard.runtime).spareKnotArmed).toBe(false);
  });
});

describe("magnetic correction", () => {
  it("keeps an already legal hit unchanged", () => {
    expect(findMagneticHitAngle(1, [2], 0.1)).toEqual({
      angle: 1,
      corrected: false,
    });
  });

  it("moves a close hit to the nearest legal edge", () => {
    const result = findMagneticHitAngle(1.02, [1], 0.1);
    expect(result?.corrected).toBe(true);
    expect(angularDistance(result!.angle, 1.02)).toBeLessThanOrEqual(0.17);
    expect(isAngleBlocked(result!.angle, [1], 0.1)).toBe(false);
  });

  it("corrects across the circular boundary and refuses an impossible gap", () => {
    const wrapped = findMagneticHitAngle(0.01, [Math.PI * 2 - 0.01], 0.08);
    expect(wrapped?.corrected).toBe(true);

    const crowded = [0.94, 1.02, 1.1];
    expect(findMagneticHitAngle(1.02, crowded, 0.12, 0.08)).toBeNull();
  });
});

describe("room effects", () => {
  it("keeps an opening grace period in every room", () => {
    for (const room of ["attic", "theatre", "machine"] as const) {
      expect(getRoomEffectState(room, 2)).toMatchObject({
        phase: "calm",
        speedMultiplier: 1,
      });
    }
  });

  it("warns before the attic gust and then accelerates", () => {
    expect(getRoomEffectState("attic", 4.7).phase).toBe("warning");
    expect(getRoomEffectState("attic", 5.5)).toMatchObject({
      phase: "active",
      speedMultiplier: 1.32,
    });
  });

  it("warns before one theatre reversal per beat", () => {
    expect(getRoomEffectState("theatre", 4.2).phase).toBe("warning");
    expect(getRoomEffectState("theatre", 5.05)).toMatchObject({
      phase: "active",
      eventIndex: 0,
      shouldReverse: true,
    });
  });

  it("gives the machine a bounded pulsing acceleration", () => {
    const pulse = getRoomEffectState("machine", 4.5);
    expect(pulse.phase).toBe("active");
    expect(pulse.speedMultiplier).toBeGreaterThan(1);
    expect(pulse.speedMultiplier).toBeLessThanOrEqual(1.34);
  });
});
