export const NEEDLE_ART_TIP_Y = 28.5 / 512;
export const NEEDLE_ART_TAIL_Y = 483.5 / 512;

const NEEDLE_ART_ASPECT_RATIO = 256 / 512;
const NEEDLE_ART_VISIBLE_FRACTION = NEEDLE_ART_TAIL_Y - NEEDLE_ART_TIP_Y;

export interface NeedleArtSize {
  readonly width: number;
  readonly height: number;
}

/** Keeps every generated needle proportional while fitting its visible tip-to-tail length. */
export function getNeedleArtSize(visibleLength: number): NeedleArtSize {
  const height = Math.max(0, visibleLength) / NEEDLE_ART_VISIBLE_FRACTION;
  return { width: height * NEEDLE_ART_ASPECT_RATIO, height };
}

/** Generated sprites point downward from tip to tail; rotate that axis onto a radial hit angle. */
export function getAttachedNeedleRotation(angle: number): number {
  return angle - Math.PI / 2;
}
