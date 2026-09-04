import { describe, expect, it } from "vitest";

import { getAlphaSurfaceRadius, type AlphaMask } from "./silhouette";

function circularMask(size: number, radius: number): AlphaMask {
  const data = new Uint8ClampedArray(size * size);
  const center = (size - 1) / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (Math.hypot(x - center, y - center) <= radius) {
        data[y * size + x] = 255;
      }
    }
  }
  return { width: size, height: size, data };
}

describe("getAlphaSurfaceRadius", () => {
  it("follows the visible alpha silhouette instead of a fixed circle", () => {
    const mask = circularMask(21, 6);
    expect(getAlphaSurfaceRadius(mask, 0)).toBeGreaterThanOrEqual(6);
    expect(getAlphaSurfaceRadius(mask, Math.PI / 2)).toBeGreaterThanOrEqual(6);
  });

  it("reaches a narrow ear-like protrusion only along its own angle", () => {
    const mask = circularMask(21, 4);
    mask.data[10 * 21 + 18] = 255;

    const towardEar = getAlphaSurfaceRadius(mask, 0);
    const awayFromEar = getAlphaSurfaceRadius(mask, Math.PI / 2);
    expect(towardEar).not.toBeNull();
    expect(awayFromEar).not.toBeNull();
    expect(towardEar!).toBeGreaterThan(awayFromEar! + 2);
  });

  it("ignores nearly transparent image-generation halos", () => {
    const mask = circularMask(21, 4);
    mask.data[10 * 21 + 19] = 4;
    expect(getAlphaSurfaceRadius(mask, 0, 26)).toBeLessThan(8);
  });

  it("returns null for an empty or malformed mask", () => {
    expect(
      getAlphaSurfaceRadius({ width: 2, height: 2, data: new Uint8ClampedArray() }, 0),
    ).toBeNull();
  });
});
