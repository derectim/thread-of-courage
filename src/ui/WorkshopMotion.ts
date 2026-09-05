export function orderSeamPoints(shape: number, count: number): number[][] {
  const outlines = [
    [[50, 24], [69, 36], [73, 56], [65, 74], [50, 79], [35, 74], [27, 56], [31, 36]],
    [[29, 27], [50, 25], [71, 27], [74, 50], [71, 73], [50, 75], [29, 73], [26, 50]],
    [[29, 26], [50, 26], [71, 26], [71, 49], [65, 65], [50, 78], [35, 65], [29, 49]],
  ];
  const points = outlines[shape] ?? outlines[0];
  return count === 8 ? points : [points[0], points[2], points[3], points[4], points[6], points[7]];
}
const fixed = (k: unknown) => ({ a: 0, k });
const animated = (values: { t: number; s: number[] }[]) => ({ a: 1, k: values.map((value, i) => ({ ...value, ...(i < values.length - 1 ? { e: values[i + 1].s, o: { x: .33, y: 0 }, i: { x: .67, y: 1 } } : {}) })) });
const transform = (position: unknown, scale = fixed([100, 100, 100])) => ({ o: fixed(100), r: fixed(0), p: position, a: fixed([0, 0, 0]), s: scale });
const path = (vertices: number[][], closed = false) => ({ ty: "sh", ks: fixed({ i: vertices.map(() => [0, 0]), o: vertices.map(() => [0, 0]), v: vertices, c: closed }) });
const stroke = (color: number[], width: number) => ({ ty: "st", c: fixed(color), o: fixed(100), w: fixed(width), lc: 2, lj: 2 });

/** Original Lottie composition: layered textile, moving needle, drawn seam and warm drifting motes. */
export function createWorkshopMotion(art: string, points: number[][], sewn: number, celebrate: boolean) {
  const vertices = points.map(([x, y]) => [x * 4, y * 4]);
  const current = vertices[Math.max(0, Math.min(sewn - 1, vertices.length - 1))], previous = vertices[Math.max(0, sewn - 2)];
  const lengths = [0];
  for (let i = 1; i < vertices.length; i++) lengths.push(lengths[i - 1] + Math.hypot(vertices[i][0] - vertices[i - 1][0], vertices[i][1] - vertices[i - 1][1]));
  const totalLength = lengths.at(-1)! + (celebrate ? Math.hypot(vertices[0][0] - vertices.at(-1)![0], vertices[0][1] - vertices.at(-1)![1]) : 0);
  const seamBefore = lengths[Math.max(0, sewn - 2)] / totalLength * 100;
  const seamAfter = celebrate ? 100 : lengths[Math.max(0, sewn - 1)] / totalLength * 100;
  const layer = (ind: number, nm: string, shapes: unknown[], ks = transform(fixed([0, 0, 0]))) => ({ ty: 4, ind, nm, ip: 0, op: 120, st: 0, sr: 1, ks, shapes });
  const needle = layer(1, "Игла оставляет стежок", [path([[0, -35], [-4, 13], [0, 23], [4, 13]], true), { ty: "fl", c: fixed([.84, .9, .91, 1]), o: fixed(100) }, path([[0, -25], [0, -10]]), stroke([.24, .39, .4, 1], 2)], {
    ...transform(animated([{ t: 0, s: [...previous, 0] }, { t: 12, s: [...current, 0] }, { t: 22, s: [current[0], current[1] + 5, 0] }, { t: 32, s: [...current, 0] }, { t: 120, s: [...current, 0] }])),
    r: animated([{ t: 0, s: [35] }, { t: 18, s: [10] }, { t: 32, s: [35] }, { t: 120, s: [35] }]),
    o: animated([{ t: 0, s: [100] }, { t: 40, s: [100] }, { t: 60, s: [sewn ? 0 : 100] }, { t: 120, s: [sewn ? 0 : 100] }]),
  });
  const seam = layer(2, "Золотой шов", [path(vertices, celebrate), stroke([1, .87, .49, 1], 3), { ty: "tm", s: fixed(0), e: animated([{ t: 0, s: [seamBefore] }, { t: 24, s: [seamAfter] }, { t: 120, s: [seamAfter] }]), o: fixed(0), m: 1 }]);
  const motes = Array.from({ length: 7 }, (_, i) => layer(3 + i, "Пылинка света", [{ ty: "el", p: fixed([0, 0]), s: fixed([3 + i % 3, 3 + i % 3]) }, { ty: "fl", c: fixed([1, .82, .37, 1]), o: fixed(70) }], { ...transform(animated([{ t: 0, s: [35 + i * 52, 335 - i % 3 * 50, 0] }, { t: 120, s: [48 + i * 46, 40 + i % 3 * 35, 0] }])), o: animated([{ t: 0, s: [0] }, { t: 20 + i * 3, s: [celebrate ? 85 : 45] }, { t: 105, s: [60] }, { t: 120, s: [0] }]) }));
  const piece = { ty: 2, ind: 11, refId: "piece", nm: "Тканевая вещь", ip: 0, op: 120, st: 0, sr: 1, ks: { ...transform(fixed([200, 200, 0]), animated([{ t: 0, s: [47.5, 47.5, 100] }, { t: 60, s: [48.5, 48.5, 100] }, { t: 120, s: [47.5, 47.5, 100] }])), a: fixed([320, 320, 0]), r: animated([{ t: 0, s: [-.7] }, { t: 60, s: [.7] }, { t: 120, s: [-.7] }]) } };
  return { v: "5.13.0", fr: 30, ip: 0, op: 120, w: 400, h: 400, nm: "Живая мастерская Эли", ddd: 0, assets: [{ id: "piece", w: 640, h: 640, u: "", p: art, e: 0 }], layers: [needle, seam, ...motes, piece], markers: [] };
}
