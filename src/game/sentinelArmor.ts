import { angularDistance, normalizeAngle } from "./geometry";

export const SENTINEL_ID = "thimble-sentinel";
/** Local-space angle pointing through the top of the rotating artwork. */
export const SENTINEL_HELMET_CENTER_ANGLE = (Math.PI * 3) / 2;
/** The helmet and its rim occupy a 60-degree arc around the top of the head. */
export const SENTINEL_HELMET_HALF_ARC = Math.PI / 6;

export function isSentinelHelmetHit(
  monsterId: string,
  localHitAngle: number,
): boolean {
  if (monsterId !== SENTINEL_ID || !Number.isFinite(localHitAngle)) {
    return false;
  }

  return (
    angularDistance(
      normalizeAngle(localHitAngle),
      SENTINEL_HELMET_CENTER_ANGLE,
    ) <= SENTINEL_HELMET_HALF_ARC + Number.EPSILON * 4
  );
}
