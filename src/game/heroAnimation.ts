export interface HeroNeedleAnchor {
  readonly x: number;
  readonly tipY: number;
  readonly tailY: number;
}

export interface HeroCrossbowFrame {
  readonly textureKey: string;
  readonly fileName: string;
  /** Coordinates normalized against the shared square source canvas. */
  readonly needle: HeroNeedleAnchor;
}

export const HERO_CROSSBOW_FRAMES: readonly HeroCrossbowFrame[] = [
  {
    textureKey: "hero-crossbow-frame-1",
    fileName: "hero-crossbow-frame-1.webp",
    needle: { x: 0.5239, tipY: 0.0351, tailY: 0.2536 },
  },
  {
    textureKey: "hero-crossbow-frame-2",
    fileName: "hero-crossbow-frame-2.webp",
    needle: { x: 0.5295, tipY: 0.126, tailY: 0.3437 },
  },
  {
    textureKey: "hero-crossbow-frame-3",
    fileName: "hero-crossbow-frame-3.webp",
    needle: { x: 0.5343, tipY: 0.1722, tailY: 0.3947 },
  },
] as const;

export interface HeroNeedleLayout {
  readonly x: number;
  readonly tipY: number;
  readonly tailY: number;
}

export function getHeroNeedleLayout(
  frameIndex: number,
  displayWidth: number,
  displayHeight: number,
): HeroNeedleLayout {
  const frame =
    HERO_CROSSBOW_FRAMES[Math.max(0, Math.min(HERO_CROSSBOW_FRAMES.length - 1, frameIndex))] ??
    HERO_CROSSBOW_FRAMES[0];

  return {
    x: (frame.needle.x - 0.5) * displayWidth,
    tipY: (frame.needle.tipY - 0.5) * displayHeight,
    tailY: (frame.needle.tailY - 0.5) * displayHeight,
  };
}
