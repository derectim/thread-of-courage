import { describe, expect, it } from "vitest";

import {
  SENTINEL_HELMET_CENTER_ANGLE,
  SENTINEL_HELMET_HALF_ARC,
  isSentinelHelmetHit,
} from "./sentinelArmor";

describe("thimble sentinel helmet", () => {
  it("blocks the rotating silhouette's local top arc", () => {
    expect(
      isSentinelHelmetHit("thimble-sentinel", SENTINEL_HELMET_CENTER_ANGLE),
    ).toBe(true);
    expect(
      isSentinelHelmetHit(
        "thimble-sentinel",
        SENTINEL_HELMET_CENTER_ANGLE + Math.PI * 2,
      ),
    ).toBe(true);
    expect(
      isSentinelHelmetHit(
        "thimble-sentinel",
        SENTINEL_HELMET_CENTER_ANGLE - SENTINEL_HELMET_HALF_ARC,
      ),
    ).toBe(true);
    expect(
      isSentinelHelmetHit(
        "thimble-sentinel",
        SENTINEL_HELMET_CENTER_ANGLE + SENTINEL_HELMET_HALF_ARC,
      ),
    ).toBe(true);
  });

  it("allows the body and arms outside the helmet arc", () => {
    expect(isSentinelHelmetHit("thimble-sentinel", Math.PI / 2)).toBe(false);
    expect(
      isSentinelHelmetHit(
        "thimble-sentinel",
        SENTINEL_HELMET_CENTER_ANGLE + SENTINEL_HELMET_HALF_ARC + 0.01,
      ),
    ).toBe(false);
  });

  it("does not give any other encounter an armored wall", () => {
    expect(
      isSentinelHelmetHit("sewing-storm", SENTINEL_HELMET_CENTER_ANGLE),
    ).toBe(false);
    expect(isSentinelHelmetHit("ripper", Number.NaN)).toBe(false);
  });
});
