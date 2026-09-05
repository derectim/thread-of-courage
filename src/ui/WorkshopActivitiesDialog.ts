import { makeWorkshopMove, startWorkshopActivity, type ProgressionState } from "../game/ProgressionStore";
import { ACTIVITY_LEVELS, ACTIVITY_NAMES, FABRICS, STITCHES, CHARMS, ORDER_NAMES, MEMORY_VARIETY_ART, MEMORY_NAMES, activityCount, activityDay, activityKey, activityReward, isActivityUnlocked, memoryDeck, memoryLimit, memoryPairs, orderRecipe, patternConnections, patternDefinition, resumeActivity, type ActivityKind, type ActivityMove, type ActivitySlot } from "../game/WorkshopActivities";
import { ACTIVITY_COLLECTIBLES, ACTIVITY_FINDS, earnedActivityCollectibles } from "../game/ActivityRewards";
import { equipWorkshopCollectible } from "../game/WorkshopCollection";

import { loadPatternTiles, patternTileVisual, type PatternTileKind } from "./PatternTiles";
import { attachWorkshopAnimation } from "./WorkshopAnimation";
import { orderSeamPoints } from "./WorkshopMotion";

const art = (file: string) => new URL(`${import.meta.env.BASE_URL}assets/art/${file}`, document.baseURI).href;
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const GAME_ART: Record<ActivityKind, string> = { patterns: "activity-patch-golden-weave.svg", drawers: "activity-ornament-keepsake.svg", orders: "activity-ornament-quilt.svg" };
const GAME_COPY: Record<ActivityKind, string> = { patterns: "Поверни лоскуты и восстанови живую нить.", drawers: "Запомни предметы и найди все пары.", orders: "Собери вещь по образцу и прошей её." };
const FABRIC_COLORS = ["#b86086", "#5c9e92", "#dfb65b"];
type View = "hub" | ActivityKind | "play" | "finds";

/** Free, saved side activities. All rewards are decided by the progression reducer. */
export default class WorkshopActivitiesDialog {
  private readonly dialog: HTMLDialogElement;
  private state!: ProgressionState;
  private view: View = "hub";
  private flipTimer: ReturnType<typeof setTimeout> | null = null;
  private selectedFind: string | null = null;
  private orderStep: number | null = null;
  private orderNotice = "";
  private tiles: Record<PatternTileKind, string> | null = null;
  private stopMotion: (() => void) | null = null;

  constructor(parent: HTMLElement, private readonly callbacks: { onChange: (state: ProgressionState) => void; onClose: () => void; onSound: (sound: "ui" | "win" | "fail") => void }) {
    this.dialog = document.createElement("dialog");
    this.dialog.className = "activities-dialog";
    this.dialog.setAttribute("aria-labelledby", "activities-title");
    this.dialog.addEventListener("click", this.handleClick);
    this.dialog.addEventListener("cancel", this.handleCancel);
    this.dialog.addEventListener("keydown", this.handleKeyDown);
    parent.append(this.dialog);
    void loadPatternTiles().then(tiles => { this.tiles = tiles; if (this.dialog.open && this.view === "play" && this.state.activityProgress.run?.kind === "patterns") this.render(); }).catch(() => {});
  }

  show(state: ProgressionState): void { this.state = state; this.view = "hub"; this.selectedFind = null; this.render(); this.dialog.showModal(); }
  private commit(state: ProgressionState): void {
    const previous = this.state.activityProgress.run;
    this.state = state;
    this.callbacks.onChange(state);
    const run = state.activityProgress.run;
    this.callbacks.onSound(run?.status === "won" && previous?.status !== "won" ? "win" : run?.status === "lost" && previous?.status !== "lost" ? "fail" : "ui");
    const selectedDetails = previous?.kind === "orders" && run?.kind === "orders" && (previous.fabric === null || previous.stitch === null || previous.charm === null) && run.fabric !== null && run.stitch !== null && run.charm !== null;
    this.render(selectedDetails);
    if (previous?.kind === "drawers" && run?.kind === "drawers" && previous.seed === run.seed && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const changed = [...new Set([...previous.open, ...run.open, ...run.matched])].filter(index => previous.open.includes(index) !== run.open.includes(index) || previous.matched.includes(index) !== run.matched.includes(index));
      for (const index of changed) this.dialog.querySelector<HTMLElement>(`.drawer-tile[data-index="${index}"]`)?.animate([{ transform: "rotateY(-75deg) translateY(4px)", opacity: .5 }, { transform: "rotateY(0) translateY(0)", opacity: 1 }], { duration: 220, easing: "ease-out" });
    }
    if (previous?.kind === "orders" && run?.kind === "orders" && run.mistakes > previous.mistakes && !matchMedia("(prefers-reduced-motion: reduce)").matches) this.dialog.querySelector<HTMLElement>(".order-stage")?.animate([{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }], { duration: 220 });
    if (run?.status !== "playing" && previous?.status === "playing") {
      const result = this.dialog.querySelector<HTMLElement>(".activity-result");
      result?.scrollIntoView({ block: "nearest" });
      result?.focus({ preventScroll: true });
    }
  }

  private readonly handleClick = (event: Event): void => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-activity]") : null;
    if (!button || button.disabled) return;
    const action = button.dataset.activity;
    if (action === "close") { this.close(); return; }
    if (action === "page") { this.view = button.dataset.page as View; this.selectedFind = null; this.render(true); return; }
    if (action === "back") { this.view = this.view === "play" ? this.state.activityProgress.run?.kind ?? "hub" : "hub"; this.render(true); return; }
    if (action === "find") { this.selectedFind = button.dataset.id ?? null; this.view = "finds"; this.render(true); return; }
    if (action === "order-edit") { this.orderStep = 0; this.orderNotice = ""; this.render(true); return; }
    if (action === "resume") {
      this.orderStep = null; this.orderNotice = "";
      const activityProgress = resumeActivity(this.state.activityProgress, button.dataset.slot as ActivitySlot);
      this.view = "play"; this.commit({ ...this.state, activityProgress }); return;
    }
    if (action === "start") {
      this.orderStep = null; this.orderNotice = "";
      this.view = "play";
      this.commit(startWorkshopActivity(this.state, button.dataset.kind as ActivityKind, Number(button.dataset.level), button.dataset.daily === "true")); return;
    }
    if (action === "equip") {
      const id = button.dataset.id ?? "";
      const collectible = ACTIVITY_COLLECTIBLES.find(item => item.id === id);
      if (collectible) this.commit({ ...this.state, workshopCollection: equipWorkshopCollectible(this.state.workshopCollection, collectible.kind, id) }); return;
    }
    if (action === "order-step") { this.orderStep = Number(button.dataset.step); this.orderNotice = ""; this.render(true); return; }
    let move: ActivityMove | null = null;
    if (action === "rotate" || action === "flip" || action === "sew") move = { type: action, index: Number(button.dataset.index) };
    if (action === "choose") move = { type: "choose", field: button.dataset.field as "fabric" | "stitch" | "charm", value: Number(button.dataset.value) };
    if (move) {
      const previous = this.state.activityProgress.run;
      if (move.type === "choose" && previous?.kind === "orders") {
        const recipe = orderRecipe(previous.level), step = ["fabric", "stitch", "charm"].indexOf(move.field);
        this.orderStep = move.value === recipe[move.field] ? step + 1 : step;
        this.orderNotice = move.value === recipe[move.field] ? "" : `Сверь с образцом: ${move.field === "fabric" ? FABRICS[recipe.fabric] : move.field === "stitch" ? STITCHES[recipe.stitch] : CHARMS[recipe.charm]}.`;
      }
      this.commit(makeWorkshopMove(this.state, move));
      if (move.type === "rotate" && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const tile = this.dialog.querySelector<HTMLElement>(`[data-index="${move.index}"] .pattern-tile-art`);
        if (tile) { const rotation = Number(tile.dataset.rotation); tile.animate([{ transform: `rotate(${rotation - 90}deg)` }, { transform: `rotate(${rotation}deg)` }], { duration: 180, easing: "ease-out" }); }
      }
    }
  };
  private readonly handleCancel = (event: Event): void => { event.preventDefault(); this.close(); };
  private readonly handleKeyDown = (event: KeyboardEvent): void => { event.stopPropagation(); };
  private clearFlipTimer(): void { if (this.flipTimer !== null) clearTimeout(this.flipTimer); this.flipTimer = null; }

  private render(resetScroll = false): void {
    this.clearFlipTimer(); this.stopMotion?.(); this.stopMotion = null;
    const scroll = resetScroll ? 0 : this.dialog.querySelector(".activities-scroll")?.scrollTop ?? 0;
    const focus = document.activeElement instanceof HTMLElement && this.dialog.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const content = this.view === "hub" ? this.renderHub() : this.view === "finds" ? this.renderFinds() : this.view === "play" ? `<section class="activities-play">${this.renderGame()}</section>` : this.renderSeries(this.view);
    this.dialog.innerHTML = `<header class="activities-header"><div><small>ИГРАЙ · НАХОДИ · ВОССТАНАВЛИВАЙ</small><h2 id="activities-title">Уголок мастерской</h2></div><span class="activities-wallet"><img src="${art("currency-thread-spool.webp")}" alt="" />${this.state.thread}</span><button data-activity="close" class="utility-close" aria-label="Закрыть уголок мастерской">×</button></header>
      <nav class="activities-nav" aria-label="Занятия мастерской">${(["hub", "patterns", "drawers", "orders", "finds"] as const).map(page => `<button data-activity="page" data-page="${page}" aria-pressed="${this.view === page || this.view === "play" && this.state.activityProgress.run?.kind === page}">${page === "hub" ? "Уголок" : page === "finds" ? "Находки" : page === "patterns" ? "Узоры" : page === "drawers" ? "Комод" : "Заказы"}</button>`).join("")}</nav>
      <div class="activities-scroll">${content}</div><footer class="activities-footer"><span>${this.view === "play" ? "Партия сохраняется после каждого хода" : "Вход бесплатный · награды за первое прохождение"}</span><button data-activity="${this.view === "hub" ? "close" : "back"}">${this.view === "hub" ? "К Эле" : "← Назад"}</button></footer>`;
    const scroller = this.dialog.querySelector<HTMLElement>(".activities-scroll");
    if (scroller) scroller.scrollTop = scroll;
    if (focus) this.dialog.querySelector<HTMLButtonElement>(`[data-key="${CSS.escape(focus)}"]:not(:disabled)`)?.focus({ preventScroll: true });
    const run = this.state.activityProgress.run;
    const motion = this.dialog.querySelector<HTMLElement>(".order-lottie");
    if (motion && run?.kind === "orders") this.stopMotion = attachWorkshopAnimation(motion, art(`activity-order-${run.level}-v2.webp`), orderSeamPoints(orderRecipe(run.level).shape, orderRecipe(run.level).stitches), run.sewn, run.status === "won");
    if (this.view === "play" && run?.kind === "drawers" && run.status === "playing" && run.open.length === 2) {
      this.flipTimer = setTimeout(() => { this.flipTimer = null; this.commit(makeWorkshopMove(this.state, { type: "hide-cards" })); }, 850);
    }
  }

  private renderHub(): string {
    const progress = this.state.activityProgress, found = ACTIVITY_FINDS.filter(item => activityCount(progress, item.kind) >= item.after);
    const earned = ACTIVITY_COLLECTIBLES.filter(item => this.state.workshopCollection.ownedCollectibleIds.includes(item.id) || earnedActivityCollectibles(progress).includes(item.id)).map(item => item.id);
    return `<section class="activities-welcome"><div><small>ЗДЕСЬ КАЖДАЯ ВЕЩЬ ХРАНИТ ИСТОРИЮ</small><h3>У мастерской снова есть хозяйка</h3><p>Почини узоры, загляни в старый комод и помоги Эле с заказами. На полке будут появляться твои находки.</p></div><img src="${art("ui-workshop-book.webp")}" alt="Книга мастерской" /></section>
      ${earned.includes("activity-title-restorer") ? `<section class="activity-result is-won"><small>МАСТЕРСКАЯ ВОССТАНОВЛЕНА</small><h3>Все вещи обрели свой дом</h3><p>Тебе присвоен титул «Хранительница мастерской».</p><button class="activity-primary" data-activity="equip" data-id="activity-title-restorer">${this.state.workshopCollection.equipped.title === "activity-title-restorer" ? "Титул применён ✓" : "Применить титул"}</button></section>` : ""}
      <div class="activity-game-cards">${(Object.keys(ACTIVITY_NAMES) as ActivityKind[]).map(kind => { const count = activityCount(progress, kind), saved = progress.stored[kind]; return `<article><button class="activity-card-entry" data-activity="page" data-page="${kind}"><img src="${art(kind === "orders" ? "activity-order-1-v2.webp" : GAME_ART[kind])}" alt="" /><small>${count} / ${ACTIVITY_LEVELS[kind]} завершено</small><h3>${ACTIVITY_NAMES[kind]}</h3><p>${GAME_COPY[kind]}</p><strong>${count === ACTIVITY_LEVELS[kind] ? "Все награды собраны →" : "Открыть →"}</strong></button>${saved?.status === "playing" ? `<button class="activity-resume" data-activity="resume" data-slot="${kind}">Продолжить · ${saved.level}</button>` : ""}</article>`; }).join("")}</div>
      <section class="activity-daily"><div><small>ОДИН ОСОБЫЙ УЗОР НА ДЕНЬ</small><h3>Сегодняшняя живая нить</h3><p>${activityReward(progress, "patterns", 5, activityDay()) ? "Восстанови узор и получи 5 нитей." : "Сегодняшняя награда получена. Можно повторить бесплатно."}</p></div><button data-activity="${progress.stored.daily?.kind === "patterns" && progress.stored.daily.day === activityDay() && progress.stored.daily.status === "playing" ? "resume" : "start"}" data-slot="daily" data-kind="patterns" data-level="5" data-daily="true">К узору дня →</button></section>
      <section class="activity-shelf"><div class="activity-section-title"><h3>Полка восстановленных вещей</h3><button data-activity="page" data-page="finds">Находки ${found.length} / ${ACTIVITY_FINDS.length} →</button></div><div class="activity-shelf-items">${ACTIVITY_COLLECTIBLES.slice(0, 3).map(item => { const owned = earned.includes(item.id); return `<button class="${owned ? "" : "is-unrestored"}" data-activity="page" data-page="${item.sourceId}"><img src="${art(item.artKey + ".svg")}" alt="" /><strong>${item.sourceId === "patterns" ? "Золотой цветок" : item.sourceId === "drawers" ? "Шкатулка" : "Знамя Эли"}</strong><small>${owned ? "В коллекции ✓" : item.sourceId === "patterns" ? "12 узоров" : item.sourceId === "drawers" ? "12 уровней комода" : "6 заказов"}</small></button>`; }).join("")}</div></section>`;
  }

  private renderSeries(kind: ActivityKind): string {
    const progress = this.state.activityProgress, count = activityCount(progress, kind), saved = progress.stored[kind];
    const reward = ACTIVITY_COLLECTIBLES.find(item => item.sourceId === kind)!;
    return `<section class="activity-series-heading"><img src="${art(kind === "orders" ? "activity-order-1-v2.webp" : GAME_ART[kind])}" alt="" /><div><small>${count} / ${ACTIVITY_LEVELS[kind]} ЗАВЕРШЕНО</small><h3>${ACTIVITY_NAMES[kind]}</h3><p>${GAME_COPY[kind]} ${kind === "patterns" ? "В конце серии тебя ждёт особая нашивка." : "Заверши серию, чтобы восстановить предмет для комнаты."}</p></div></section>
      ${saved?.status === "playing" ? `<button class="activity-primary activity-saved" data-activity="resume" data-slot="${kind}">Продолжить сохранённую партию · ${saved.level}</button>` : ""}
      <div class="activity-level-map">${Array.from({ length: ACTIVITY_LEVELS[kind] }, (_, i) => { const level = i + 1, cleared = progress.best[activityKey(kind, level)] !== undefined, unlocked = isActivityUnlocked(progress, kind, level); return `<button data-activity="start" data-kind="${kind}" data-level="${level}" ${unlocked ? "" : "disabled"} class="${cleared ? "is-cleared" : ""}" aria-label="${ACTIVITY_NAMES[kind]}, уровень ${level}. ${cleared ? "Пройден, повторить без награды" : unlocked ? `Награда ${activityReward(progress, kind, level)} нитей` : "Пройди предыдущий уровень"}"><b>${level}</b><span>${cleared ? `✓ · ${progress.best[activityKey(kind, level)]} ход.` : unlocked ? `+${activityReward(progress, kind, level)} нитей` : "Закрыто"}</span></button>`; }).join("")}</div>
      <div class="activity-series-reward"><img src="${art(GAME_ART[kind])}" alt="" /><div><small>НАГРАДА ЗА ВСЮ СЕРИЮ</small><strong>${escape(reward.name)}</strong><p>${escape(reward.description)}</p></div></div><p class="activity-note">Повторяй уровни бесплатно и улучшай свой результат. Новая партия этого занятия заменяет предыдущую; партии других мини-игр сохраняются.</p>`;
  }

  private renderGame(): string {
    const run = this.state.activityProgress.run;
    if (!run) return this.renderHub();
    const day = run.kind === "patterns" ? run.day : null;
    const reward = day && day !== activityDay() ? 0 : activityReward(this.state.activityProgress, run.kind, run.level, day);
    const result = run.status !== "playing" ? this.renderResult() : "";
    const heading = `<div class="activity-play-heading"><div><small>${day ? "УЗОР ДНЯ · " + day : "УРОВЕНЬ " + run.level}</small><h3>${run.kind === "orders" ? ORDER_NAMES[run.level - 1] : ACTIVITY_NAMES[run.kind]}</h3></div><span>${run.status === "playing" ? reward ? `Награда: ${reward} нитей` : "Повторение без награды" : run.status === "won" ? "Завершено ✓" : "Можно попробовать ещё"}</span></div>`;
    if (run.kind === "patterns") {
      const definition = patternDefinition(run.level, run.seed), connection = patternConnections(run);
      return heading + `<p class="activity-instructions">Нажимай на лоскуты, чтобы поворачивать их. Соедини катушку с иглой через <strong>все клетки</strong>, без оборванных концов.</p><div class="pattern-board ${run.status === "won" ? "is-solved" : ""}" style="--size:${definition.size}" role="group" aria-label="Узор из ${definition.size} на ${definition.size} лоскутов">${connection.masks.map((mask, index) => {
        const directions = ["сверху", "справа", "снизу", "слева"].filter((_, i) => mask & (1 << i)).join(", ");
        const endpoint = index === definition.start ? "source" : index === definition.end ? "end" : undefined;
        const visual = patternTileVisual(mask, endpoint);
        const fallback = ["50 0", "100 50", "50 100", "0 50"].map((point, i) => mask & (1 << i) ? `M50 50L${point}` : "").join("");
        return `<button class="pattern-tile ${connection.connected.has(index) ? "is-connected" : ""} ${endpoint ? "is-" + endpoint : ""}" data-activity="rotate" data-index="${index}" data-key="tile-${index}" style="--wave:${[...connection.connected].indexOf(index) * 55}ms" ${run.status === "playing" ? "" : "disabled"} aria-label="${endpoint === "source" ? "Катушка" : endpoint === "end" ? "Игла" : "Лоскут " + (index + 1)}. Нить ${directions}. Повернуть">${this.tiles ? `<img class="pattern-tile-art" src="${this.tiles[visual.kind]}" data-rotation="${visual.rotation}" style="transform:rotate(${visual.rotation}deg)" alt="" draggable="false"/>` : `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${fallback}" fill="none" stroke="#e8b958" stroke-width="18"/></svg>`}${endpoint ? `<span class="pattern-endpoint-label">${endpoint === "source" ? "Старт" : "Финиш"}</span>` : ""}</button>`;
      }).join("")}</div><div class="activity-game-stats"><span>Ходы: <strong>${run.moves}</strong></span><span>Соединено: <strong>${connection.connected.size} / ${connection.masks.length}</strong></span></div>${result}`;
    }
    if (run.kind === "drawers") {
      const deck = memoryDeck(run), pairs = memoryPairs(run.level, run.layoutVersion ?? 1), limit = memoryLimit(run.level, run.layoutVersion ?? 1);
      const columns = pairs === 3 ? 3 : pairs === 5 || pairs === 10 ? 5 : pairs >= 9 ? 6 : 4;
      return heading + `<p class="activity-instructions">Открывай по два ящичка и запоминай предметы. Найди ${pairs} пар за ${limit} попыток. Повторная игра бесплатна.</p><div class="drawer-board ${pairs >= 9 ? "is-large" : ""}" style="--columns:${columns}">${deck.map((item, index) => { const matched = run.matched.includes(index), visible = matched || run.open.includes(index) || run.status !== "playing"; return `<button class="drawer-tile ${visible ? "is-open" : ""} ${matched ? "is-matched" : ""}" data-activity="flip" data-index="${index}" data-key="drawer-${index}" ${matched || run.status !== "playing" ? "disabled" : ""} aria-label="Ящичек ${index + 1}${matched ? ", пара найдена: " + MEMORY_NAMES[item] : visible ? ", " + MEMORY_NAMES[item] : ", открыть"}">${visible ? `<img src="${art(MEMORY_VARIETY_ART[item])}" alt="${MEMORY_NAMES[item]}" />${matched ? '<span aria-hidden="true">✓</span>' : ""}` : `<span class="drawer-knob" aria-hidden="true"></span><small>${index + 1}</small>`}</button>`; }).join("")}</div><div class="activity-game-stats"><span>Пары: <strong>${run.matched.length / 2} / ${pairs}</strong></span><span>Попытки: <strong>${run.moves} / ${limit}</strong></span></div>${result}`;
    }
    const recipe = orderRecipe(run.level), fields = ["fabric", "stitch", "charm"] as const;
    const missing = fields.findIndex(field => run[field] !== recipe[field]);
    const ready = missing === -1, step = run.status === "playing" ? Math.min(this.orderStep ?? (ready ? 3 : missing), ready ? 3 : missing) : 3;
    const steps = ["Ткань", "Строчка", "Украшение", "Шьём"];
    const request = `<div class="order-request"><img src="${art(`activity-order-${run.level}-v2.webp`)}" alt="Образец: ${ORDER_NAMES[run.level - 1]}"/><div><small>ЭЛЯ ПРОСИТ СШИТЬ</small><h4>${ORDER_NAMES[run.level - 1]}</h4><p>${FABRICS[recipe.fabric]} · ${STITCHES[recipe.stitch]} · ${CHARMS[recipe.charm]}</p></div></div>`;
    const progress = `<nav class="order-steps" aria-label="Шаги заказа">${steps.map((label, i) => `<button data-activity="order-step" data-step="${i}" ${i > (ready ? 3 : missing) || run.status !== "playing" ? "disabled" : ""} aria-current="${i === step ? "step" : "false"}" class="${i < 3 && run[fields[i]] === recipe[fields[i]] ? "is-done" : ""}"><b>${i < 3 && run[fields[i]] === recipe[fields[i]] ? "✓" : i + 1}</b><span>${label}</span></button>`).join("")}</nav>`;
    if (step < 3) {
      const field = fields[step], values = field === "fabric" ? FABRICS : field === "stitch" ? STITCHES : CHARMS;
      return heading + `<div class="order-craft-layout">${request}<section class="order-choice-step">${progress}<small>ШАГ ${step + 1} ИЗ 4</small><h3>${step === 0 ? "Выбери ткань" : step === 1 ? "Выбери строчку" : "Добавь украшение"}</h3><p>Найди такую же деталь, как на образце Эли.</p><div class="order-choice-cards">${values.map((label, value) => `<button data-activity="choose" data-field="${field}" data-value="${value}" data-key="${field}-${value}" aria-pressed="${run[field] === value}">${this.orderChoiceArt(field, value)}<strong>${label}</strong></button>`).join("")}</div><p class="order-choice-notice" role="status">${this.orderNotice || "Правильная деталь откроет следующий шаг."}</p></section></div>`;
    }
    const points = orderSeamPoints(recipe.shape, recipe.stitches);
    return heading + progress + `<p class="activity-instructions">${run.status === "playing" ? `Нажимай точки <strong>по порядку</strong>. Сейчас — ${Math.min(run.sewn + 1, recipe.stitches)}. Допускается две ошибки.` : run.status === "won" ? "Работа завершена — все стежки на своих местах." : "Шов сбился. Можно бесплатно начать новую попытку."}</p><div class="order-stage"><div class="order-lottie" aria-hidden="true"></div><img class="order-piece-fallback" src="${art(`activity-order-${run.level}-v2.webp`)}" alt="${ORDER_NAMES[run.level - 1]}"/>${points.map(([x, y], index) => `<button data-activity="sew" data-index="${index}" data-key="seam-${index}" style="left:${x}%;top:${y}%" class="order-seam ${index < run.sewn ? "is-sewn" : index === run.sewn ? "is-next" : ""}" ${index < run.sewn || run.status !== "playing" ? "disabled" : ""} aria-label="Стежок ${index + 1}">${index < run.sewn ? "✓" : index + 1}</button>`).join("")}</div><div class="activity-game-stats"><span>Стежки: ${run.sewn} / ${recipe.stitches}</span><span>Ошибки: ${run.mistakes} / 3</span></div>${run.status === "playing" ? '<button class="order-edit" data-activity="order-edit">Изменить детали · начать шов заново</button>' : ""}${result}`;
  }

  private orderChoiceArt(field: "fabric" | "stitch" | "charm", value: number): string {
    if (field === "fabric") return `<span class="order-fabric-swatch" style="--fabric:${FABRIC_COLORS[value]}"></span>`;
    if (field === "stitch") return `<svg viewBox="0 0 100 70" class="order-part-icon" aria-hidden="true"><rect x="7" y="10" width="86" height="50" rx="10" fill="#436b66"/><path d="${value === 0 ? "M16 35h68" : value === 1 ? "m16 43 11-16 11 16 11-16 11 16 11-16 11 16" : "m17 26 15 18m0-18L17 44m25-18 15 18m0-18L42 44m25-18 15 18m0-18L67 44"}" fill="none" stroke="#ffe397" stroke-width="4" stroke-linecap="round" ${value === 0 ? 'stroke-dasharray="9 7"' : ""}/></svg>`;
    return `<svg viewBox="0 0 100 70" class="order-part-icon" aria-hidden="true"><g fill="#f4ca70" stroke="#a87943" stroke-width="2">${value === 0 ? '<path d="m50 8 9 17 20 3-15 14 4 20-18-10-18 10 4-20-15-14 20-3Z"/>' : value === 1 ? '<path d="M50 61C-7 27 30-1 50 20 70-1 107 27 50 61Z" fill="#c54e79"/>' : '<circle cx="50" cy="16" r="13"/><circle cx="70" cy="30" r="13"/><circle cx="62" cy="53" r="13"/><circle cx="37" cy="53" r="13"/><circle cx="29" cy="30" r="13"/><circle cx="50" cy="36" r="11" fill="#fff0c9"/>'}</g></svg>`;
  }

  private renderResult(): string {
    const run = this.state.activityProgress.run!;
    const daily = run.kind === "patterns" && !!run.day;
    const next = !daily && run.status === "won" && run.level < ACTIVITY_LEVELS[run.kind];
    const reward = ACTIVITY_COLLECTIBLES.find(item => item.sourceId === run.kind && this.state.workshopCollection.ownedCollectibleIds.includes(item.id));
    const find = ACTIVITY_FINDS.find(item => item.kind === run.kind && item.after === run.level);
    return `<section class="activity-result ${run.status === "won" ? "is-won" : "is-lost"}" role="status" tabindex="-1"><h3>${run.status === "won" ? "Вещи снова оживают!" : run.kind === "drawers" ? "Попытки закончились" : "Давай поправим работу"}</h3><p>${run.status === "won" ? run.awarded ? `+${run.awarded} нитей уже в кошельке.` : "Новая награда не начислена. Можно играть снова бесплатно." : run.kind === "drawers" ? "Запомни расположение пар и попробуй новую партию. Ты ничего не теряешь." : "Сверь детали с образцом и прошивай точки по порядку. Новая попытка бесплатна."}</p>
      ${reward ? `<div class="activity-earned"><img src="${art(GAME_ART[run.kind])}" alt="" /><strong>${escape(reward.name)}</strong><button data-activity="equip" data-id="${reward.id}">${this.state.workshopCollection.equipped[reward.kind] === reward.id ? "Применено ✓" : reward.kind === "patch" ? "Надеть нашивку" : "Поставить в комнату"}</button></div>` : ""}
      <div class="activity-result-actions">${next ? `<button class="activity-primary" data-activity="start" data-kind="${run.kind}" data-level="${run.level + 1}">Следующий уровень →</button>` : ""}<button data-activity="start" data-kind="${run.kind}" data-level="${run.level}" data-daily="${daily}">${run.status === "won" ? "Повторить бесплатно" : "Попробовать снова"}</button>${run.status === "won" && find ? `<button data-activity="find" data-id="${find.id}">Прочитать находку →</button>` : ""}</div></section>`;
  }

  private renderFinds(): string {
    return `<div class="activity-section-title"><div><small>МАЛЕНЬКИЕ ИСТОРИИ БОЛЬШОЙ МАСТЕРСКОЙ</small><h3>У каждой вещи — свой голос</h3></div></div><div class="activity-find-grid">${ACTIVITY_FINDS.map(item => { const unlocked = activityCount(this.state.activityProgress, item.kind) >= item.after; return `<article class="${unlocked ? "is-found" : ""} ${this.selectedFind === item.id ? "is-selected" : ""}"><img src="${art(item.art)}" alt="" /><div><h4>${unlocked ? item.title : "Нераскрытая история"}</h4><p>${unlocked ? item.text : `Откроется после ${item.after}-го уровня: «${ACTIVITY_NAMES[item.kind]}».`}</p>${!unlocked ? `<button data-activity="page" data-page="${item.kind}">К занятию →</button>` : '<small>Найдено ✓</small>'}</div></article>`; }).join("")}</div><p class="activity-note">Восстановленные награды серий появляются на полке уголка. Их также можно применить в профиле и Книге мастерской.</p>`;
  }

  private close(): void { this.clearFlipTimer(); this.stopMotion?.(); this.stopMotion = null; this.dialog.close(); this.callbacks.onClose(); }
  destroy(): void {
    this.clearFlipTimer(); this.stopMotion?.(); this.stopMotion = null; this.dialog.close();
    this.dialog.removeEventListener("click", this.handleClick); this.dialog.removeEventListener("cancel", this.handleCancel); this.dialog.removeEventListener("keydown", this.handleKeyDown); this.dialog.remove();
  }
}
