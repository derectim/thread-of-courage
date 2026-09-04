export interface AlphaMask {
  readonly width: number;
  readonly height: number;
  /** One alpha byte per pixel; RGB channels are deliberately discarded. */
  readonly data: Uint8ClampedArray;
}

function hasOpaqueNeighbour(
  mask: AlphaMask,
  centerX: number,
  centerY: number,
  alphaThreshold: number,
): boolean {
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    const y = centerY + offsetY;
    if (y < 0 || y >= mask.height) continue;
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const x = centerX + offsetX;
      if (x < 0 || x >= mask.width) continue;
      if (mask.data[y * mask.width + x] >= alphaThreshold) return true;
    }
  }
  return false;
}

/**
 * Finds the outermost visible pixel along a ray from the centre of an alpha mask.
 * A small neighbourhood prevents thin felt threads and antialiased ears from being missed.
 */
export function getAlphaSurfaceRadius(
  mask: AlphaMask,
  angle: number,
  alphaThreshold = 26,
): number | null {
  if (mask.width < 1 || mask.height < 1 || mask.data.length < mask.width * mask.height) {
    return null;
  }

  const centerX = (mask.width - 1) / 2;
  const centerY = (mask.height - 1) / 2;
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const maxRadius = Math.ceil(Math.hypot(mask.width, mask.height) / 2);

  for (let radius = maxRadius; radius >= 0; radius -= 1) {
    const x = Math.round(centerX + directionX * radius);
    const y = Math.round(centerY + directionY * radius);
    if (hasOpaqueNeighbour(mask, x, y, alphaThreshold)) return radius;
  }

  return null;
}
