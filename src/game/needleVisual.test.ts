import { describe, expect, it } from "vitest";

import { NEEDLE_SKINS } from "./meta";
import {
  NEEDLE_ART_TAIL_Y,
  NEEDLE_ART_TIP_Y,
  getAttachedNeedleRotation,
  getNeedleArtSize,
} from "./needleVisual";

describe("generated needle artwork", () => {
  it("publishes one unique transparent-ready texture for every skin", () => {
    expect(NEEDLE_SKINS).toHaveLength(8);
    expect(new Set(NEEDLE_SKINS.map((skin) => skin.textureKey))).toHaveLength(8);
    expect(new Set(NEEDLE_SKINS.map((skin) => skin.iconFileName))).toHaveLength(8);
    expect(NEEDLE_SKINS.every((skin) => skin.iconFileName.endsWith(".webp"))).toBe(true);
  });

  it("fits the shared transparent canvas without stretching the art", () => {
    const visibleLength = 64;
    const size = getNeedleArtSize(visibleLength);

    expect(size.width / size.height).toBeCloseTo(0.5, 6);
    expect(size.height * (NEEDLE_ART_TAIL_Y - NEEDLE_ART_TIP_Y)).toBeCloseTo(
      visibleLength,
      6,
    );
  });

  it("points the embedded tip inward and the threaded tail outward", () => {
    expect(getAttachedNeedleRotation(Math.PI / 2)).toBeCloseTo(0, 6);
    expect(getAttachedNeedleRotation(0)).toBeCloseTo(-Math.PI / 2, 6);
  });
});
