const FULL_CIRCLE = Math.PI * 2;

/** Normalizes an angle in radians to the half-open interval [0, 2π). */
export function normalizeAngle(angle: number): number {
  const normalized = angle % FULL_CIRCLE;

  if (normalized === 0) {
    return 0;
  }

  return normalized < 0 ? normalized + FULL_CIRCLE : normalized;
}

/** Returns the shortest distance between two angles, in the interval [0, π]. */
export function angularDistance(firstAngle: number, secondAngle: number): number {
  const distance = Math.abs(
    normalizeAngle(firstAngle) - normalizeAngle(secondAngle),
  );

  return Math.min(distance, FULL_CIRCLE - distance);
}

/**
 * Reports whether a hit is too close to an existing angle.
 * A distance exactly equal to minGap is allowed.
 */
export function isAngleBlocked(
  hitAngle: number,
  existingAngles: readonly number[],
  minGap: number,
): boolean {
  return existingAngles.some(
    (existingAngle) => angularDistance(hitAngle, existingAngle) < minGap,
  );
}
