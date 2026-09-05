import { makeWorkshopMove, startWorkshopActivity, type ProgressionState } from "../game/ProgressionStore";
import { ACTIVITY_LEVELS, ACTIVITY_NAMES, FABRICS, STITCHES, CHARMS, ORDER_NAMES, MEMORY_ART, activityCount, activityDay, activityKey, activityReward, isActivityUnlocked, memoryDeck, memoryLimit, memoryPairs, orderRecipe, patternConnections, patternDefinition, resumeActivity, type ActivityKind, type ActivityMove, type ActivitySlot, type OrderRun } from "../game/WorkshopActivities";
import { ACTIVITY_COLLECTIBLES, ACTIVITY_FINDS, earnedActivityCollectibles } from "../game/ActivityRewards";
import { equipWorkshopCollectible } from "../game/WorkshopCollection";

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
  private orderEditing = false;

  constructor(parent: HTMLElement, private readonly callbacks: { onChange: (state: ProgressionState) => void; onClose: () => void; onSound: (sound: "ui" | "win" | "fail") => void }) {
    this.dialog = document.createElement("dialog");
    this.dialog.className = "activities-dialog";
    this.dialog.setAttribute("aria-labelledby", "activities-title");
    this.dialog.addEventListener("click", this.handleClick);
    this.dialog.addEventListener("cancel", this.handleCancel);
    this.dialog.addEventListener("keydown", this.handleKeyDown);
    parent.append(this.dialog);
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
    if (action === "order-edit") { this.orderEditing = !this.orderEditing; this.render(true); return; }
    if (action === "resume") {
      this.orderEditing = false;
      const activityProgress = resumeActivity(this.state.activityProgress, button.dataset.slot as ActivitySlot);
      this.view = "play"; this.commit({ ...this.state, activityProgress }); return;
    }
    if (action === "start") {
      this.orderEditing = false;
      this.view = "play";
      this.commit(startWorkshopActivity(this.state, button.dataset.kind as ActivityKind, Number(button.dataset.level), button.dataset.daily === "true")); return;
    }
    if (action === "equip") {
      const id = button.dataset.id ?? "";
      const collectible = ACTIVITY_COLLECTIBLES.find(item => item.id === id);
      if (collectible) this.commit({ ...this.state, workshopCollection: equipWorkshopCollectible(this.state.workshopCollection, collectible.kind, id) }); return;
    }
    let move: ActivityMove | null = null;
    if (action === "rotate" || action === "flip" || action === "sew") move = { type: action, index: Number(button.dataset.index) };
    if (action === "choose") move = { type: "choose", field: button.dataset.field as "fabric" | "stitch" | "charm", value: Number(button.dataset.value) };
    if (move) this.commit(makeWorkshopMove(this.state, move));
  };
  private readonly handleCancel = (event: Event): void => { event.preventDefault(); this.close(); };
  private readonly handleKeyDown = (event: KeyboardEvent): void => { event.stopPropagation(); };
  private clearFlipTimer(): void { if (this.flipTimer !== null) clearTimeout(this.flipTimer); this.flipTimer = null; }

  private render(resetScroll = false): void {
    this.clearFlipTimer();
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
    if (this.view === "play" && run?.kind === "drawers" && run.status === "playing" && run.open.length === 2) {
      this.flipTimer = setTimeout(() => { this.flipTimer = null; this.commit(makeWorkshopMove(this.state, { type: "hide-cards" })); }, 850);
    }
  }

  private renderHub(): string {
    const progress = this.state.activityProgress, found = ACTIVITY_FINDS.filter(item => activityCount(progress, item.kind) >= item.after);
    const earned = earnedActivityCollectibles(progress);
    return `<section class="activities-welcome"><div><small>ЗДЕСЬ КАЖДАЯ ВЕЩЬ ХРАНИТ ИСТОРИЮ</small><h3>У мастерской снова есть хозяйка</h3><p>Почини узоры, загляни в старый комод и помоги Эле с заказами. На полке будут появляться твои находки.</p></div><img src="${art("ui-workshop-book.webp")}" alt="Книга мастерской" /></section>
      ${earned.includes("activity-title-restorer") ? `<section class="activity-result is-won"><small>МАСТЕРСКАЯ ВОССТАНОВЛЕНА</small><h3>Все вещи обрели свой дом</h3><p>Тебе присвоен титул «Хранительница мастерской».</p><button class="activity-primary" data-activity="equip" data-id="activity-title-restorer">${this.state.workshopCollection.equipped.title === "activity-title-restorer" ? "Титул применён ✓" : "Применить титул"}</button></section>` : ""}
      <div class="activity-game-cards">${(Object.keys(ACTIVITY_NAMES) as ActivityKind[]).map(kind => { const count = activityCount(progress, kind), saved = progress.stored[kind]; return `<article><button class="activity-card-entry" data-activity="page" data-page="${kind}"><img src="${art(GAME_ART[kind])}" alt="" /><small>${count} / ${ACTIVITY_LEVELS[kind]} завершено</small><h3>${ACTIVITY_NAMES[kind]}</h3><p>${GAME_COPY[kind]}</p><strong>${count === ACTIVITY_LEVELS[kind] ? "Все награды собраны →" : "Открыть →"}</strong></button>${saved?.status === "playing" ? `<button class="activity-resume" data-activity="resume" data-slot="${kind}">Продолжить · ${saved.level}</button>` : ""}</article>`; }).join("")}</div>
      <section class="activity-daily"><div><small>ОДИН ОСОБЫЙ УЗОР НА ДЕНЬ</small><h3>Сегодняшняя живая нить</h3><p>${activityReward(progress, "patterns", 5, activityDay()) ? "Восстанови узор и получи 5 нитей." : "Сегодняшняя награда получена. Можно повторить бесплатно."}</p></div><button data-activity="${progress.stored.daily?.kind === "patterns" && progress.stored.daily.day === activityDay() && progress.stored.daily.status === "playing" ? "resume" : "start"}" data-slot="daily" data-kind="patterns" data-level="5" data-daily="true">К узору дня →</button></section>
      <section class="activity-shelf"><div class="activity-section-title"><h3>Полка восстановленных вещей</h3><button data-activity="page" data-page="finds">Находки ${found.length} / ${ACTIVITY_FINDS.length} →</button></div><div class="activity-shelf-items">${ACTIVITY_COLLECTIBLES.slice(0, 3).map(item => { const owned = earned.includes(item.id); return `<button class="${owned ? "" : "is-unrestored"}" data-activity="page" data-page="${item.sourceId}"><img src="${art(item.artKey + ".svg")}" alt="" /><strong>${item.sourceId === "patterns" ? "Золотой цветок" : item.sourceId === "drawers" ? "Шкатулка" : "Знамя Эли"}</strong><small>${owned ? "В коллекции ✓" : item.sourceId === "patterns" ? "12 узоров" : item.sourceId === "drawers" ? "6 уровней комода" : "6 заказов"}</small></button>`; }).join("")}</div></section>`;
  }

  private renderSeries(kind: ActivityKind): string {
    const progress = this.state.activityProgress, count = activityCount(progress, kind), saved = progress.stored[kind];
    const reward = ACTIVITY_COLLECTIBLES.find(item => item.sourceId === kind)!;
    return `<section class="activity-series-heading"><img src="${art(GAME_ART[kind])}" alt="" /><div><small>${count} / ${ACTIVITY_LEVELS[kind]} ЗАВЕРШЕНО</small><h3>${ACTIVITY_NAMES[kind]}</h3><p>${GAME_COPY[kind]} ${kind === "patterns" ? "В конце серии тебя ждёт особая нашивка." : "Заверши серию, чтобы восстановить предмет для комнаты."}</p></div></section>
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
      return heading + `<p class="activity-instructions">Нажимай на лоскуты, чтобы поворачивать их. Соедини катушку с иглой через <strong>все клетки</strong>, без оборванных концов.</p><div class="pattern-board" style="--size:${definition.size}" role="group" aria-label="Узор из ${definition.size} на ${definition.size} лоскутов">${connection.masks.map((mask, index) => {
        const endpoints = ["50 0", "100 50", "50 100", "0 50"], directions = ["сверху", "справа", "снизу", "слева"].filter((_, i) => mask & (1 << i)).join(", ");
        const path = endpoints.map((point, i) => mask & (1 << i) ? `M50 50L${point}` : "").join("");
        return `<button class="pattern-tile ${connection.connected.has(index) ? "is-connected" : ""}" data-activity="rotate" data-index="${index}" data-key="tile-${index}" ${run.status === "playing" ? "" : "disabled"} aria-label="Лоскут ${index + 1}. Нить ${directions}. Повернуть"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="${path}" fill="none" stroke="#473d39" stroke-width="17"/><path d="${path}" fill="none" stroke="${connection.connected.has(index) ? "#f5d783" : "#a8b5a4"}" stroke-width="10"/><path d="${path}" fill="none" stroke="#fff2c578" stroke-width="2" stroke-dasharray="4 4"/><circle cx="50" cy="50" r="6" fill="#f0d493"/>${index === definition.start ? '<rect x="32" y="31" width="36" height="38" rx="6" fill="#b87c3d" stroke="#ffe7a0" stroke-width="3"/><path d="M32 42h36M32 50h36M32 58h36" stroke="#ffe4a0" stroke-width="3"/>' : index === definition.end ? '<path d="m36 67 25-35q9-6 5 5L39 69Z" fill="#f5f0df" stroke="#638183" stroke-width="2"/>' : ""}</svg></button>`;
      }).join("")}</div><div class="activity-game-stats"><span>Ходы: <strong>${run.moves}</strong></span><span>Соединено: <strong>${connection.connected.size} / ${connection.masks.length}</strong></span></div>${result}`;
    }
    if (run.kind === "drawers") {
      const deck = memoryDeck(run);
      return heading + `<p class="activity-instructions">Открывай по два ящичка и запоминай предметы. Найди ${memoryPairs(run.level)} пары за ${memoryLimit(run.level)} попыток. Повторная игра бесплатна.</p><div class="drawer-board" style="--columns:4">${deck.map((item, index) => { const matched = run.matched.includes(index), visible = matched || run.open.includes(index) || run.status !== "playing"; return `<button class="drawer-tile ${visible ? "is-open" : ""} ${matched ? "is-matched" : ""}" data-activity="flip" data-index="${index}" data-key="drawer-${index}" ${matched || run.status !== "playing" ? "disabled" : ""} aria-label="Ящичек ${index + 1}${matched ? ", пара найдена" : visible ? ", открыт" : ", открыть"}">${visible ? `<img src="${art(MEMORY_ART[item])}" alt="Предмет ${item + 1}" />${matched ? '<span aria-hidden="true">✓</span>' : ""}` : `<span class="drawer-knob" aria-hidden="true"></span><small>${index + 1}</small>`}</button>`; }).join("")}</div><div class="activity-game-stats"><span>Пары: <strong>${run.matched.length / 2} / ${memoryPairs(run.level)}</strong></span><span>Попытки: <strong>${run.moves} / ${memoryLimit(run.level)}</strong></span></div>${result}`;
    }
    const recipe = orderRecipe(run.level), selectionsReady = run.fabric !== null && run.stitch !== null && run.charm !== null;
    const choices = ([ ["fabric", "Ткань", FABRICS], ["stitch", "Строчка", STITCHES], ["charm", "Украшение", CHARMS] ] as const).map(([field, title, values]) => `<fieldset class="order-options"><legend>${title}</legend>${values.map((label, value) => `<button data-activity="choose" data-field="${field}" data-value="${value}" data-key="${field}-${value}" aria-pressed="${run[field] === value}" ${run.status === "playing" ? "" : "disabled"}>${field === "fabric" ? `<i style="background:${FABRIC_COLORS[value]}"></i>` : ""}${label}</button>`).join("")}</fieldset>`).join("");
    return heading + `<p class="activity-instructions">${selectionsReady && !this.orderEditing ? "Прошей точки <strong>по порядку: 1, 2, 3…</strong> Допускается две ошибки." : "Подбери ткань, строчку и украшение по образцу. Затем перейдём к стежкам."}</p><div class="order-layout ${!selectionsReady || this.orderEditing ? "is-editing" : "is-sewing"}"><div><div class="order-target"><span>ОБРАЗЕЦ</span>${this.orderArt(recipe, "target")}<small>${FABRICS[recipe.fabric]} · ${STITCHES[recipe.stitch]} · ${CHARMS[recipe.charm]}</small></div><div class="order-work"><span>ТВОЯ РАБОТА</span><div class="order-sewing">${this.orderArt({ fabric: run.fabric, stitch: run.stitch, charm: run.charm, shape: recipe.shape }, "work")}${Array.from({ length: recipe.stitches }, (_, index) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / recipe.stitches, x = 50 + Math.cos(angle) * 39, y = 50 + Math.sin(angle) * 39; return `<button data-activity="sew" data-index="${index}" data-key="seam-${index}" style="left:${x}%;top:${y}%" class="${index < run.sewn ? "is-sewn" : ""}" ${!selectionsReady || index < run.sewn || run.status !== "playing" ? "disabled" : ""} aria-label="Стежок ${index + 1}">${index < run.sewn ? "✓" : index + 1}</button>`; }).join("")}</div><small>${selectionsReady ? `Следующая точка: ${Math.min(run.sewn + 1, recipe.stitches)}` : "Сначала выбери все три детали"}</small></div></div><div>${choices}${selectionsReady && run.status === "playing" ? `<button class="order-edit" data-activity="order-edit">${this.orderEditing ? "К стежкам →" : "Изменить детали"}</button>` : ""}<div class="activity-game-stats"><span>Стежки: ${run.sewn} / ${recipe.stitches}</span><span>Ошибки: ${run.mistakes} / 3</span></div></div></div>${result}`;
  }

  private orderArt(item: Pick<OrderRun, "fabric" | "stitch" | "charm"> & { shape: number }, key: string): string {
    const shape = item.shape === 0 ? "M50 58Q100 43 150 58L166 162Q100 187 34 162Z" : item.shape === 1 ? "M43 45Q100 55 157 45Q147 100 157 155Q100 146 43 155Q53 100 43 45Z" : "M46 35H154V144L100 174 46 144Z";
    const charm = item.charm === 0 ? '<path d="m100 75 8 17 19 3-14 13 3 19-16-9-17 9 4-19-14-13 19-3Z"/>' : item.charm === 1 ? '<path d="M100 125C44 96 80 65 100 87c20-22 56 9 0 38Z"/>' : item.charm === 2 ? '<circle cx="100" cy="84" r="13"/><circle cx="117" cy="99" r="13"/><circle cx="110" cy="120" r="13"/><circle cx="88" cy="120" r="13"/><circle cx="81" cy="99" r="13"/><circle cx="100" cy="102" r="10" fill="#688a80"/>' : "";
    return `<svg class="order-art" viewBox="0 0 200 200" aria-hidden="true"><defs><pattern id="order-${key}" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M0 2h16M2 0v16" stroke="#fff5d313" stroke-width="2"/></pattern></defs><path d="${shape}" fill="${item.fabric === null ? "#a19b8d" : FABRIC_COLORS[item.fabric]}" stroke="#51444a" stroke-width="5"/><path d="${shape}" fill="url(#order-${key})"/><path d="${shape}" transform="translate(12 12) scale(.88)" fill="none" stroke="#fff0b1" stroke-width="${item.stitch === 2 ? 5 : 3}" stroke-dasharray="${item.stitch === 0 ? "6 4" : item.stitch === 1 ? "2 5 9 5" : "2 9"}"/><g fill="#ffe3a0" stroke="#755446" stroke-width="2">${charm}</g></svg>`;
  }

  private renderResult(): string {
    const run = this.state.activityProgress.run!;
    const daily = run.kind === "patterns" && !!run.day;
    const next = !daily && run.status === "won" && run.level < ACTIVITY_LEVELS[run.kind];
    const reward = ACTIVITY_COLLECTIBLES.find(item => item.sourceId === run.kind && earnedActivityCollectibles(this.state.activityProgress).includes(item.id));
    const find = ACTIVITY_FINDS.find(item => item.kind === run.kind && item.after === run.level);
    return `<section class="activity-result ${run.status === "won" ? "is-won" : "is-lost"}" role="status" tabindex="-1"><h3>${run.status === "won" ? "Вещи снова оживают!" : run.kind === "drawers" ? "Попытки закончились" : "Давай поправим работу"}</h3><p>${run.status === "won" ? run.awarded ? `+${run.awarded} нитей уже в кошельке.` : "Новая награда не начислена. Можно играть снова бесплатно." : run.kind === "drawers" ? "Запомни расположение пар и попробуй новую партию. Ты ничего не теряешь." : "Сверь детали с образцом и прошивай точки по порядку. Новая попытка бесплатна."}</p>
      ${reward ? `<div class="activity-earned"><img src="${art(GAME_ART[run.kind])}" alt="" /><strong>${escape(reward.name)}</strong><button data-activity="equip" data-id="${reward.id}">${this.state.workshopCollection.equipped[reward.kind] === reward.id ? "Применено ✓" : reward.kind === "patch" ? "Надеть нашивку" : "Поставить в комнату"}</button></div>` : ""}
      <div class="activity-result-actions">${next ? `<button class="activity-primary" data-activity="start" data-kind="${run.kind}" data-level="${run.level + 1}">Следующий уровень →</button>` : ""}<button data-activity="start" data-kind="${run.kind}" data-level="${run.level}" data-daily="${daily}">${run.status === "won" ? "Повторить бесплатно" : "Попробовать снова"}</button>${run.status === "won" && find ? `<button data-activity="find" data-id="${find.id}">Прочитать находку →</button>` : ""}</div></section>`;
  }

  private renderFinds(): string {
    return `<div class="activity-section-title"><div><small>МАЛЕНЬКИЕ ИСТОРИИ БОЛЬШОЙ МАСТЕРСКОЙ</small><h3>У каждой вещи — свой голос</h3></div></div><div class="activity-find-grid">${ACTIVITY_FINDS.map(item => { const unlocked = activityCount(this.state.activityProgress, item.kind) >= item.after; return `<article class="${unlocked ? "is-found" : ""} ${this.selectedFind === item.id ? "is-selected" : ""}"><img src="${art(item.art)}" alt="" /><div><h4>${unlocked ? item.title : "Нераскрытая история"}</h4><p>${unlocked ? item.text : `Откроется после ${item.after}-го уровня: «${ACTIVITY_NAMES[item.kind]}».`}</p>${!unlocked ? `<button data-activity="page" data-page="${item.kind}">К занятию →</button>` : '<small>Найдено ✓</small>'}</div></article>`; }).join("")}</div><p class="activity-note">Восстановленные награды серий появляются на полке уголка. Их также можно применить в профиле и Книге мастерской.</p>`;
  }

  private close(): void { this.clearFlipTimer(); this.dialog.close(); this.callbacks.onClose(); }
  destroy(): void {
    this.clearFlipTimer(); this.dialog.close();
    this.dialog.removeEventListener("click", this.handleClick); this.dialog.removeEventListener("cancel", this.handleCancel); this.dialog.removeEventListener("keydown", this.handleKeyDown); this.dialog.remove();
  }
}
