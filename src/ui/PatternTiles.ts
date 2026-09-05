export type PatternTileKind = "straight" | "corner" | "source" | "end";
export const PATTERN_ROPE_WIDTH = 0.18;
export function patternTileVisual(mask: number, endpoint?: "source" | "end"): { kind: PatternTileKind; rotation: number } {
  if (endpoint) return { kind: endpoint, rotation: [1, 2, 4, 8].indexOf(mask) * 90 };
  if (mask === 5 || mask === 10) return { kind: "straight", rotation: mask === 5 ? 90 : 0 };
  return { kind: "corner", rotation: [3, 6, 12, 9].indexOf(mask) * 90 };
}

let tilesPromise: Promise<Record<PatternTileKind, string>> | null = null;
const asset = (file: string) => new URL(`${import.meta.env.BASE_URL}assets/art/${file}`, document.baseURI).href;
const loadImage = (file: string) => new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = asset(file); });
const canvas = (width: number, height = width) => { const image = document.createElement("canvas"); image.width = width; image.height = height; return image; };

/** Four bases share one generated braid. Geometry, edge centers and width never depend on image generation. */
export function generatePatternTiles(): Promise<Record<PatternTileKind, string>> {
  return tilesPromise ??= Promise.all([loadImage("activity-tile-horizontal-v2.webp"), loadImage("currency-thread-spool.webp"), loadImage("needle-silver-v2.webp")]).then(([texture, spool, needle]) => {
    const size = 256, strip = canvas(512, 112), stripContext = strip.getContext("2d", { willReadFrequently: true })!;
    stripContext.drawImage(texture, 0, texture.height * .39, texture.width, texture.height * .22, 0, 0, strip.width, strip.height);
    const pixels = stripContext.getImageData(0, 0, strip.width, strip.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const [r, g, b] = pixels.data.subarray(i, i + 3);
      // Isolate the gold material from the teal cloth in the shared game texture.
      if (!(r > b * 1.3 && g > b * 1.2 && r > g * .88 && r > 60)) pixels.data[i + 3] = 0;
    }
    stripContext.putImageData(pixels, 0, 0);
    const braid = canvas(strip.width, 96), braidContext = braid.getContext("2d")!;
    // Every cross-section has the same center and width, including both edges of a bend.
    for (let x = 0; x < strip.width; x++) {
      let first = strip.height, last = 0;
      for (let y = 0; y < strip.height; y++) if (pixels.data[(y * strip.width + x) * 4 + 3]) { first = Math.min(first, y); last = y; }
      if (last >= first) braidContext.drawImage(strip, x, first, 1, last - first + 1, x, 0, 1, braid.height);
    }
    const ropeWidth = size * PATTERN_ROPE_WIDTH;
    const create = (kind: PatternTileKind) => {
      const tile = canvas(size), context = tile.getContext("2d")!;
      context.drawImage(texture, texture.width * .08, texture.height * .06, texture.width * .84, texture.height * .27, 0, 0, size, size);
      // Sample the same strip along the centerline; a bend is a warped straight braid.
      const radius = size * .25, arcLength = Math.PI * radius / 2;
      const length = kind === "corner" ? size * .5 + arcLength : kind === "straight" ? size : size * .5;
      for (let distance = -1; distance <= length + 1; distance += .5) {
        let x: number, y: number, angle: number;
        if (kind === "straight") { x = distance; y = size / 2; angle = 0; }
        else if (kind !== "corner") { x = size / 2; y = distance; angle = Math.PI / 2; }
        else if (distance <= radius) { x = size / 2; y = distance; angle = Math.PI / 2; }
        else if (distance < radius + arcLength) { const theta = Math.PI - (distance - radius) / radius; x = size * .75 + radius * Math.cos(theta); y = radius + radius * Math.sin(theta); angle = theta - Math.PI / 2; }
        else { x = size * .75 + distance - radius - arcLength; y = size / 2; angle = 0; }
        context.save(); context.translate(x, y); context.rotate(angle);
        const sample = Math.max(0, Math.min(distance, length - distance) * 2) % (braid.width - 4);
        context.drawImage(braid, sample, 0, 3, braid.height, -1, -ropeWidth / 2, 2, ropeWidth);
        context.restore();
      }
      if (kind === "source" || kind === "end") {
        const icon = kind === "source" ? spool : needle, extent = size * (kind === "source" ? .48 : .58);
        context.save(); context.shadowColor = "#091c21"; context.shadowBlur = 10;
        context.drawImage(icon, size / 2 - extent / 2, size / 2 - extent / 2, extent, extent); context.restore();
      }
      return tile.toDataURL("image/png");
    };
    return { straight: create("straight"), corner: create("corner"), source: create("source"), end: create("end") };
  }).catch(error => { tilesPromise = null; throw error; });
}

export async function loadPatternTiles(): Promise<Record<PatternTileKind, string>> {
  const kinds: PatternTileKind[] = ["straight", "corner", "source", "end"];
  const loaded = await Promise.all(kinds.map(kind => loadImage(`activity-pattern-${kind}-v2.webp`)));
  return Object.fromEntries(kinds.map((kind, index) => [kind, loaded[index].src])) as Record<PatternTileKind, string>;
}
