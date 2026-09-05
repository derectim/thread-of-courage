export type ActivityKind = "patterns" | "drawers" | "orders";
export const ACTIVITY_NAMES: Record<ActivityKind, string> = { patterns: "Почини узор", drawers: "Бабушкин комод", orders: "Заказы Эли" };
export const ACTIVITY_LEVELS: Record<ActivityKind, number> = { patterns: 12, drawers: 12, orders: 6 };
export const FABRICS = ["Малина", "Мята", "Мёд"] as const;
export const STITCHES = ["Прямая строчка", "Зигзаг", "Крестики"] as const;
export const CHARMS = ["Звезда", "Сердце", "Цветок"] as const;
export const ORDER_NAMES = ["Мешочек для катушки", "Подушка для совёнка", "Флажок над дверью", "Мешочек воспоминаний", "Подушка лунного сада", "Праздничное знамя"] as const;
export const MEMORY_ART = ["currency-thread-spool.webp", "currency-moon-button.webp", "upgrade-power.webp", "upgrade-precision.webp", "needle-silver-v2.webp", "menu-icon-shop.webp", "patch-first-stitch.webp", "patch-tailor-owl.webp"] as const;

interface BaseRun { readonly kind: ActivityKind; readonly level: number; readonly seed: number; readonly moves: number; readonly status: "playing" | "won" | "lost"; readonly awarded: number; }
export interface PatternRun extends BaseRun { readonly kind: "patterns"; readonly turns: readonly number[]; readonly day: string | null; }
export interface DrawerRun extends BaseRun { readonly kind: "drawers"; readonly layoutVersion?: 1 | 2; readonly open: readonly number[]; readonly matched: readonly number[]; }
export interface OrderRun extends BaseRun { readonly kind: "orders"; readonly fabric: number | null; readonly stitch: number | null; readonly charm: number | null; readonly sewn: number; readonly mistakes: number; }
export type ActivityRun = PatternRun | DrawerRun | OrderRun;
export type ActivitySlot = ActivityKind | "daily";
export interface ActivityProgress { readonly best: Readonly<Record<string, number>>; readonly dailyRewardDay: string | null; readonly run: ActivityRun | null; readonly stored: Readonly<Partial<Record<ActivitySlot, ActivityRun>>>; }
export type ActivityMove = { readonly type: "rotate"; readonly index: number } | { readonly type: "flip"; readonly index: number } | { readonly type: "hide-cards" } | { readonly type: "choose"; readonly field: "fabric" | "stitch" | "charm"; readonly value: number } | { readonly type: "sew"; readonly index: number };
export const createActivityProgress = (): ActivityProgress => ({ best: {}, dailyRewardDay: null, run: null, stored: {} });
export const activitySlot = (run: ActivityRun): ActivitySlot => run.kind === "patterns" && run.day ? "daily" : run.kind;
const withRun = (progress: ActivityProgress, run: ActivityRun): ActivityProgress => ({ ...progress, run, stored: { ...progress.stored, [activitySlot(run)]: run } });
export function resumeActivity(progress: ActivityProgress, slot: ActivitySlot): ActivityProgress {
  const run = progress.stored[slot];
  return run ? withRun(progress, run) : progress;
}
export const activityKey = (kind: ActivityKind, level: number): string => `${kind}:${level}`;
export const activityDay = (date = new Date()): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const isDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const integer = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

export function activityCount(progress: ActivityProgress, kind: ActivityKind): number {
  return Array.from({ length: ACTIVITY_LEVELS[kind] }, (_, i) => activityKey(kind, i + 1)).filter(key => progress.best[key] !== undefined).length;
}
export function isActivityUnlocked(progress: ActivityProgress, kind: ActivityKind, level: number): boolean {
  return integer(level, 1, ACTIVITY_LEVELS[kind]) && (level === 1 || progress.best[activityKey(kind, level - 1)] !== undefined);
}
export function activityReward(progress: ActivityProgress, kind: ActivityKind, level: number, day: string | null = null): number {
  if (day) return !progress.dailyRewardDay || day > progress.dailyRewardDay ? 5 : 0;
  return progress.best[activityKey(kind, level)] !== undefined ? 0 : kind === "patterns" ? 8 + 2 * Math.floor((level - 1) / 4) : 8;
}
function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
function shuffle<T>(values: T[], seed: number): T[] {
  const next = random(seed);
  for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [values[i], values[j]] = [values[j], values[i]]; }
  return values;
}
const hash = (text: string): number => [...text].reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 7);
export const patternSize = (level: number): number => level <= 4 ? 3 : level <= 8 ? 4 : 5;
const rotateMask = (mask: number, turns: number): number => ((mask << turns) | (mask >> (4 - turns))) & 15;

/** Every puzzle begins as a complete Hamiltonian thread before its tiles turn. */
export function patternDefinition(level: number, seed: number): { size: number; masks: number[]; start: number; end: number } {
  const size = patternSize(level), path: number[] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) path.push(y * size + (y % 2 ? size - 1 - x : x));
  // Reconnect an endpoint to an earlier neighbour and reverse that tail. This
  // varies the route while preserving adjacency and exactly one visit per tile.
  const next = random(seed + level * 97);
  for (let step = 0; step < size * size * 3; step++) {
    if (next() < 0.5) path.reverse();
    const end = path[path.length - 1];
    const candidates = path.slice(0, -2).map((index, position) => ({ index, position })).filter(({ index }) => Math.abs(index % size - end % size) + Math.abs(Math.floor(index / size) - Math.floor(end / size)) === 1);
    if (!candidates.length) continue;
    const position = candidates[Math.floor(next() * candidates.length)].position;
    path.splice(position + 1, path.length, ...path.slice(position + 1).reverse());
  }
  const rotation = seed % 4, mirror = seed % 3 === 0;
  const transformed = path.map(index => {
    let x = index % size, y = Math.floor(index / size);
    if (mirror) x = size - 1 - x;
    for (let i = 0; i < rotation; i++) [x, y] = [size - 1 - y, x];
    return y * size + x;
  });
  const masks = Array<number>(size * size).fill(0);
  for (let i = 1; i < transformed.length; i++) {
    const a = transformed[i - 1], b = transformed[i], dx = b % size - a % size, dy = Math.floor(b / size) - Math.floor(a / size);
    const direction = dy === -1 ? 0 : dx === 1 ? 1 : dy === 1 ? 2 : 3;
    masks[a] |= 1 << direction; masks[b] |= 1 << ((direction + 2) % 4);
  }
  return { size, masks, start: transformed[0], end: transformed[transformed.length - 1] };
}
export function patternConnections(run: PatternRun): { masks: number[]; connected: Set<number>; solved: boolean } {
  const definition = patternDefinition(run.level, run.seed);
  const masks = definition.masks.map((mask, i) => rotateMask(mask, run.turns[i]));
  const connected = new Set<number>([definition.start]), queue = [definition.start];
  let leaks = false;
  while (queue.length) {
    const index = queue.shift()!;
    for (let direction = 0; direction < 4; direction++) if (masks[index] & (1 << direction)) {
      const x = index % definition.size + [0, 1, 0, -1][direction], y = Math.floor(index / definition.size) + [-1, 0, 1, 0][direction];
      const next = y * definition.size + x;
      if (x < 0 || y < 0 || x >= definition.size || y >= definition.size || !(masks[next] & (1 << ((direction + 2) % 4)))) { leaks = true; continue; }
      if (!connected.has(next)) { connected.add(next); queue.push(next); }
    }
  }
  return { masks, connected, solved: !leaks && connected.size === masks.length && connected.has(definition.end) };
}
export const MEMORY_VARIETY_ART = [...MEMORY_ART, "ornament-small-spool.webp", "ornament-apprentice-scissors.webp", "patch-weekly-pattern-heart.webp", "patch-weekly-owl-eye.webp", "patch-weekly-moon-thimble.webp", "patch-copper-button.webp", "activity-order-1-v2.webp", "activity-order-2-v2.webp", "activity-order-3-v2.webp", "patch-first-ray.webp", "patch-night-workshop.webp", "ornament-moon-pattern.webp"] as const;
export const MEMORY_NAMES = ["Катушка", "Лунная пуговица", "Сила стежка", "Напёрсток", "Серебряная игла", "Сумочка", "Первая строчка", "Совёнок", "Подвеска-катушка", "Ножницы", "Сердце узора", "Глаз совы", "Лунный напёрсток", "Медная пуговица", "Малиновый мешочек", "Мятная подушка", "Золотой флажок", "Первый луч", "Ночная мастерская", "Лунный узор"] as const;
export const memoryPairs = (level: number, version: 1 | 2 = 2): number => version === 1 ? level <= 2 ? 4 : level <= 4 ? 6 : 8 : [3, 4, 5, 6, 7, 8, 9, 10, 10, 12, 12, 12][level - 1] ?? 12;
export const memoryLimit = (level: number, version: 1 | 2 = 2): number => memoryPairs(level, version) * 3 + (level % 2 ? 2 : 0);
export function memoryDeck(run: Pick<DrawerRun, "level" | "seed" | "layoutVersion">): number[] {
  const version = run.layoutVersion ?? 1, pairs = memoryPairs(run.level, version);
  const items = version === 1 ? Array.from({ length: pairs }, (_, i) => i) : shuffle(Array.from({ length: MEMORY_VARIETY_ART.length }, (_, i) => i), run.seed ^ 0x71ba96).slice(0, pairs);
  return shuffle(items.flatMap(item => [item, item]), run.seed);
}
export function orderRecipe(level: number): { fabric: number; stitch: number; charm: number; stitches: number; shape: number } {
  return { fabric: (level - 1) % 3, stitch: Math.floor((level + 1) / 2) % 3, charm: (level + 1) % 3, stitches: level <= 3 ? 6 : 8, shape: (level - 1) % 3 };
}

export function startActivity(progress: ActivityProgress, kind: ActivityKind, level: number, daily = false, date = new Date(), seed = Date.now() >>> 0): ActivityProgress {
  if (!Object.hasOwn(ACTIVITY_LEVELS, kind) || (daily ? kind !== "patterns" : !isActivityUnlocked(progress, kind, level))) return progress;
  const day = daily ? activityDay(date) : null;
  if (daily) { level = 5; seed = hash(day!); }
  seed = seed >>> 0;
  const base = { level, seed, moves: 0, status: "playing" as const, awarded: 0 };
  let run: ActivityRun;
  if (kind === "patterns") {
    const next = random(seed);
    const turns = Array.from({ length: patternSize(level) ** 2 }, () => Math.floor(next() * 4));
    run = { ...base, kind, turns, day };
    if (patternConnections(run).solved) { turns[patternDefinition(level, seed).start] = (turns[patternDefinition(level, seed).start] + 1) % 4; }
  } else if (kind === "drawers") run = { ...base, kind, layoutVersion: 2, open: [], matched: [] };
  else run = { ...base, kind, fabric: null, stitch: null, charm: null, sewn: 0, mistakes: 0 };
  return withRun(progress, run);
}

export function moveActivity(progress: ActivityProgress, action: ActivityMove, date = new Date()): { progress: ActivityProgress; reward: number } {
  const before = progress.run;
  if (!before || before.status !== "playing") return { progress, reward: 0 };
  let run: ActivityRun = before;
  let won = false;
  if (before.kind === "patterns" && action.type === "rotate" && integer(action.index, 0, before.turns.length - 1)) {
    const turns = [...before.turns]; turns[action.index] = (turns[action.index] + 1) % 4;
    run = { ...before, turns, moves: before.moves + 1 }; won = patternConnections(run).solved;
  } else if (before.kind === "drawers") {
    if (action.type === "hide-cards" && before.open.length === 2) run = { ...before, open: [] };
    else if (action.type === "flip" && integer(action.index, 0, memoryPairs(before.level, before.layoutVersion ?? 1) * 2 - 1) && before.open.length < 2 && !before.open.includes(action.index) && !before.matched.includes(action.index)) {
      const open = [...before.open, action.index], moves = before.moves + (open.length === 2 ? 1 : 0);
      const deck = memoryDeck(before), match = open.length === 2 && deck[open[0]] === deck[open[1]];
      const matched = match ? [...before.matched, ...open] : before.matched;
      won = matched.length === deck.length;
      run = { ...before, moves, matched, open: match ? [] : open, status: !won && moves >= memoryLimit(before.level, before.layoutVersion ?? 1) ? "lost" : "playing" };
    }
  } else if (before.kind === "orders") {
    if (action.type === "choose" && ["fabric", "stitch", "charm"].includes(action.field) && integer(action.value, 0, 2)) run = { ...before, [action.field]: action.value, sewn: 0 };
    else if (action.type === "sew" && integer(action.index, 0, orderRecipe(before.level).stitches - 1) && before.fabric !== null && before.stitch !== null && before.charm !== null) {
      const recipe = orderRecipe(before.level), correct = action.index === before.sewn;
      const sewn = before.sewn + (correct ? 1 : 0), mistakes = before.mistakes + (correct ? 0 : 1);
      won = sewn === recipe.stitches && before.fabric === recipe.fabric && before.stitch === recipe.stitch && before.charm === recipe.charm;
      run = { ...before, sewn, mistakes, moves: before.moves + 1, status: !won && (mistakes >= 3 || sewn === recipe.stitches) ? "lost" : "playing" };
    }
  }
  if (run === before) return { progress, reward: 0 };
  if (!won) return { progress: withRun(progress, run), reward: 0 };
  const day = run.kind === "patterns" ? run.day : null;
  const reward = day && day !== activityDay(date) ? 0 : activityReward(progress, run.kind, run.level, day);
  const key = activityKey(run.kind, run.level), previousBest = progress.best[key];
  return { progress: withRun({ ...progress, best: day ? progress.best : { ...progress.best, [key]: Math.min(previousBest ?? Infinity, run.moves) }, dailyRewardDay: day && reward ? day : progress.dailyRewardDay }, { ...run, status: "won", awarded: reward }), reward };
}

function normalizeActivityBase(value: unknown): ActivityProgress {
  if (!value || typeof value !== "object") return createActivityProgress();
  const raw = value as Partial<ActivityProgress>, best: Record<string, number> = {};
  for (const kind of Object.keys(ACTIVITY_LEVELS) as ActivityKind[]) for (let level = 1; level <= ACTIVITY_LEVELS[kind]; level++) {
    const key = activityKey(kind, level), moves = raw.best?.[key];
    if (!integer(moves, 1, 1_000_000)) break;
    best[key] = moves;
  }
  const progress: ActivityProgress = { best, dailyRewardDay: isDay(raw.dailyRewardDay) ? raw.dailyRewardDay : null, run: null, stored: {} };
  const run = raw.run;
  if (!run || typeof run !== "object" || !Object.hasOwn(ACTIVITY_LEVELS, run.kind) || !integer(run.level, 1, ACTIVITY_LEVELS[run.kind]) || !integer(run.seed, 0, 0xffffffff) || !integer(run.moves, 0, 1_000_000) || !["playing", "won", "lost"].includes(run.status) || !integer(run.awarded, 0, 12)) return progress;
  const daily = run.kind === "patterns" && run.day !== null;
  if (daily ? run.kind !== "patterns" || !isDay(run.day) || run.level !== 5 : !isActivityUnlocked(progress, run.kind, run.level)) return progress;
  let normalized: ActivityRun;
  const base = { level: run.level, seed: run.seed, moves: run.moves, status: run.status, awarded: run.status === "won" ? run.awarded : 0 };
  if (run.kind === "patterns") {
    if (!Array.isArray(run.turns) || run.turns.length !== patternSize(run.level) ** 2 || run.turns.some(turn => !integer(turn, 0, 3))) return progress;
    normalized = { ...base, kind: run.kind, day: run.day, turns: [...run.turns] };
    if (run.status === "lost" || (run.status === "won") !== patternConnections(normalized).solved) return progress;
  } else if (run.kind === "drawers") {
    if (run.layoutVersion !== undefined && run.layoutVersion !== 1 && run.layoutVersion !== 2) return progress;
    const version = run.layoutVersion ?? 1;
    const validIndices = (value: unknown): value is number[] => Array.isArray(value) && new Set(value).size === value.length && value.every(index => integer(index, 0, memoryPairs(run.level, version) * 2 - 1));
    if (!validIndices(run.open) || run.open.length > 2 || !validIndices(run.matched) || run.open.some(index => run.matched.includes(index)) || run.moves > memoryLimit(run.level, version)) return progress;
    const deck = memoryDeck(run), counts = new Map<number, number>();
    for (const index of run.matched) counts.set(deck[index], (counts.get(deck[index]) ?? 0) + 1);
    if ([...counts.values()].some(count => count !== 2) || (run.status === "won") !== (run.matched.length === deck.length)) return progress;
    normalized = { ...base, kind: run.kind, ...(run.layoutVersion ? { layoutVersion: run.layoutVersion } : {}), open: [...run.open], matched: [...run.matched] };
  } else {
    if ([run.fabric, run.stitch, run.charm].some(value => value !== null && !integer(value, 0, 2)) || !integer(run.sewn, 0, orderRecipe(run.level).stitches) || !integer(run.mistakes, 0, 3)) return progress;
    const recipe = orderRecipe(run.level);
    if ((run.status === "won") !== (run.sewn === recipe.stitches && run.fabric === recipe.fabric && run.stitch === recipe.stitch && run.charm === recipe.charm && run.mistakes < 3)) return progress;
    normalized = { ...base, kind: run.kind, fabric: run.fabric, stitch: run.stitch, charm: run.charm, sewn: run.sewn, mistakes: run.mistakes };
  }
  return withRun(progress, normalized);
}

export function normalizeActivityProgress(value: unknown): ActivityProgress {
  let progress = normalizeActivityBase(value);
  const stored = value && typeof value === "object" ? (value as Partial<ActivityProgress>).stored : null;
  for (const slot of ["patterns", "drawers", "orders", "daily"] as const) {
    const run = normalizeActivityBase({ ...progress, run: stored?.[slot] }).run;
    if (run && activitySlot(run) === slot) progress = { ...progress, stored: { ...progress.stored, [slot]: run } };
  }
  // The visible run is the newest version of its slot.
  return progress.run ? withRun(progress, progress.run) : progress;
}
