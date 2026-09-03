import {
  MAX_UPGRADE_LEVEL,
  UPGRADE_DEFINITIONS,
  UPGRADE_IDS,
  claimQuest,
  equipNeedle,
  equipSkill,
  getQuestProgress,
  getRandomNeedleUnlockCost,
  getUpgradeCost,
  purchaseUpgrade,
  unlockRandomNeedle,
  unlockBackground,
  type ProgressionState,
  type UpgradeId,
} from "../game/ProgressionStore";
import { MONSTERS, getMonsterForStage } from "../game/content";
import { HERO_CROSSBOW_FRAMES } from "../game/heroAnimation";
import { NEEDLE_ART_TIP_Y, getNeedleArtSize } from "../game/needleVisual";
import {
  BACKGROUNDS,
  NEEDLE_SKINS,
  QUESTS,
  SKILLS,
  type BackgroundId,
  type NeedleSkinId,
  type QuestId,
  type SkillId,
} from "../game/meta";

export type MenuTab = "home" | "upgrades" | "quests" | "needles" | "bestiary" | "shop";

interface GameMenuCallbacks {
  readonly onStart: () => void;
  readonly onStateChange: (state: ProgressionState) => void;
  readonly onToggleSound: (muted: boolean) => void;
  readonly onFullscreen: () => void;
}

const UPGRADE_NAMES: Readonly<Record<UpgradeId, { name: string; symbol: string }>> = {
  power: { name: "Двойная нить", symbol: "✦" },
  precision: { name: "Точный напёрсток", symbol: "◎" },
  speed: { name: "Быстрый челнок", symbol: "➶" },
  ward: { name: "Оберег лоскутницы", symbol: "◇" },
};

const QUEST_EMBLEMS: Readonly<Record<QuestId, string>> = {
  "first-fifty": "✦",
  "nightmare-hunter": "◉",
  "boss-breaker": "♜",
  "tenth-stitch": "Ⅹ",
  "needle-collector": "⌁",
};

export const TAB_LABELS: Readonly<Record<Exclude<MenuTab, "home">, { label: string; iconFileName: string }>> = {
  upgrades: { label: "Усиления", iconFileName: "menu-icon-upgrades.webp" },
  quests: { label: "Поручения", iconFileName: "menu-icon-quests.webp" },
  needles: { label: "Иглы", iconFileName: "menu-icon-needles.webp" },
  bestiary: { label: "Бестиарий", iconFileName: "menu-icon-bestiary.webp" },
  shop: { label: "Лавка", iconFileName: "menu-icon-shop.webp" },
};

function asset(path: string): string {
  return new URL(
    `${import.meta.env.BASE_URL}assets/art/${path}`,
    document.baseURI,
  ).href;
}

function firstStageForMonster(monsterId: string): number {
  for (let stage = 1; stage <= 20; stage += 1) {
    if (getMonsterForStage(stage).id === monsterId) return stage;
  }
  return 1;
}

export default class GameMenu {
  private state: ProgressionState;
  private tab: MenuTab = "home";
  private notice = "";
  private readonly frame: HTMLElement | null;

  public constructor(
    private readonly root: HTMLElement,
    initialState: ProgressionState,
    private readonly callbacks: GameMenuCallbacks,
  ) {
    this.state = initialState;
    this.frame = this.root.closest<HTMLElement>(".game-frame");
    this.root.addEventListener("click", this.handleClick);
  }

  public show(state: ProgressionState, tab: MenuTab = "home", notice = ""): void {
    this.state = state;
    this.tab = tab;
    this.notice = notice;
    this.frame?.classList.add("menu-active");
    this.root.classList.remove("is-hidden");
    this.render();
  }

  public hide(): void {
    this.frame?.classList.remove("menu-active");
    this.root.classList.add("is-hidden");
  }

  public destroy(): void {
    this.frame?.classList.remove("menu-active");
    this.root.removeEventListener("click", this.handleClick);
    this.root.replaceChildren();
  }

  private readonly handleClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
    if (!target || target.disabled) return;

    const action = target.dataset.action;
    if (action === "start") {
      this.callbacks.onStart();
      return;
    }
    if (action === "fullscreen") {
      this.callbacks.onFullscreen();
      return;
    }
    if (action === "sound") {
      this.commit({ ...this.state, muted: !this.state.muted });
      this.callbacks.onToggleSound(this.state.muted);
      return;
    }
    if (action === "home") {
      this.tab = "home";
      this.notice = "";
      this.render();
      return;
    }

    const nextTab = target.dataset.tab as MenuTab | undefined;
    if (nextTab) {
      this.tab = nextTab;
      this.notice = "";
      this.render();
      return;
    }

    if (action === "upgrade") {
      const id = target.dataset.id as UpgradeId;
      this.commit(purchaseUpgrade(this.state, id));
      return;
    }
    if (action === "needle") {
      const id = target.dataset.id as NeedleSkinId;
      this.commit(equipNeedle(this.state, id));
      return;
    }
    if (action === "random-needle") {
      const previousIds = new Set(this.state.ownedNeedles);
      const next = unlockRandomNeedle(this.state);
      const unlockedId = next.ownedNeedles.find((id) => !previousIds.has(id));
      const unlocked = NEEDLE_SKINS.find((skin) => skin.id === unlockedId);
      this.commit(next, unlocked ? `Открыто: ${unlocked.name}` : "Сохранено");
      return;
    }
    if (action === "skill") {
      const id = target.dataset.id as SkillId;
      this.commit(equipSkill(this.state, id));
      return;
    }
    if (action === "background") {
      const id = target.dataset.id as BackgroundId;
      this.commit(unlockBackground(this.state, id));
      return;
    }
    if (action === "quest") {
      const id = target.dataset.id as QuestId;
      const quest = QUESTS.find((item) => item.id === id);
      if (quest) this.commit(claimQuest(this.state, quest));
    }
  };

  private commit(next: ProgressionState, successNotice = "Сохранено"): void {
    if (next === this.state) {
      this.notice = "Пока не хватает ресурсов или условий";
    } else {
      this.state = next;
      this.notice = successNotice;
      this.callbacks.onStateChange(next);
    }
    this.render();
  }

  private render(): void {
    const activeButton = this.root.contains(document.activeElement) && document.activeElement instanceof HTMLButtonElement
      ? document.activeElement
      : null;
    const previousScrollTop = activeButton?.dataset.action && activeButton.dataset.action !== "home"
      ? this.root.querySelector<HTMLElement>(".panel-scroll")?.scrollTop
      : undefined;
    const focusKey = activeButton
      ? {
          tab: activeButton.dataset.tab,
          action: activeButton.dataset.action,
          id: activeButton.dataset.id,
        }
      : null;
    this.root.innerHTML = this.tab === "home" ? this.renderHome() : this.renderPanel();
    if (previousScrollTop !== undefined) {
      const panelScroll = this.root.querySelector<HTMLElement>(".panel-scroll");
      if (panelScroll) panelScroll.scrollTop = previousScrollTop;
    }
    if (focusKey) {
      const matchingButton = Array.from(this.root.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) =>
          button.dataset.tab === focusKey.tab &&
          button.dataset.action === focusKey.action &&
          button.dataset.id === focusKey.id,
      );
      matchingButton?.focus({ preventScroll: true });
    }
  }

  private renderWorld(blurred = false): string {
    return `
      <div class="menu-world ${blurred ? "is-blurred" : ""}" aria-hidden="true">
        <picture>
          <source media="(orientation: portrait)" srcset="${asset("menu-hub-portrait.webp")}" />
          <img src="${asset("menu-hub-landscape.webp")}" alt="" fetchpriority="high" />
        </picture>
      </div>`;
  }

  private renderHeroNeedle(frameIndex: number): string {
    const skin =
      NEEDLE_SKINS.find((candidate) => candidate.id === this.state.equippedNeedle) ??
      NEEDLE_SKINS[0];
    const anchor = HERO_CROSSBOW_FRAMES[frameIndex].needle;
    const needleLength = anchor.tailY - anchor.tipY;
    const displayHeight = getNeedleArtSize(needleLength).height;
    const top = anchor.tipY - displayHeight * NEEDLE_ART_TIP_Y;

    return `
      <img
        class="menu-hero-needle-art"
        src="${asset(skin.iconFileName)}"
        style="left:${anchor.x * 100}%;top:${top * 100}%;height:${displayHeight * 100}%"
        alt=""
        aria-hidden="true"
        draggable="false"
      />`;
  }

  private renderAnimatedHero(): string {
    return `
      <div class="menu-hero" role="img" aria-label="Эля Штопка с пружинным луком и выбранной иглой">
        ${HERO_CROSSBOW_FRAMES.map((frame, index) => `
          <div class="menu-hero-frame frame-${index + 1}">
            <img class="menu-hero-character" src="${asset(frame.fileName)}" alt="" draggable="false" />
            ${this.renderHeroNeedle(index)}
          </div>`).join("")}
      </div>`;
  }

  private renderHome(): string {
    const record = this.state.highestStageCleared;
    return `
      ${this.renderWorld()}
      <div class="menu-vignette" aria-hidden="true"></div>
      <header class="menu-topbar">
        <button class="round-tool" data-action="fullscreen" aria-label="На весь экран">⛶</button>
        <div class="currency-chip"><span>✦</span><strong>${this.state.thread}</strong><small>нити</small></div>
        <div class="currency-chip premium"><span>◆</span><strong>${this.state.premium}</strong><small>пуговицы</small></div>
        <button class="round-tool" data-action="sound" aria-label="${this.state.muted ? "Включить звук и музыку" : "Выключить звук и музыку"}">${this.state.muted ? "🔇" : "♪"}</button>
      </header>
      <section class="menu-hero-copy">
        <span class="menu-kicker">ТКАНЕВЫЙ РЕЙД</span>
        <h1>Нитка<br />храбрости</h1>
        <p>Зашивай кошмары и не дай иглам столкнуться.</p>
      </section>
      ${this.renderAnimatedHero()}
      <div class="menu-record ${this.notice ? "has-notice" : ""}">
        ${this.notice ? `<span>${this.notice}</span><small>Лучший результат: <strong>${record || "—"}</strong></small>` : `Лучший результат: <strong>${record || "—"}</strong>`}
      </div>
      <button class="raid-button" data-action="start"><span>В РЕЙД!</span><small>Босс каждые 5 этапов</small></button>
      ${this.renderNav()}
    `;
  }

  private renderPanel(): string {
    const tab = this.tab as Exclude<MenuTab, "home">;
    return `
      ${this.renderWorld(true)}
      <div class="menu-vignette is-heavy" aria-hidden="true"></div>
      <header class="menu-topbar panel-wallet">
        <div class="currency-chip"><span>✦</span><strong>${this.state.thread}</strong><small>нити</small></div>
        <div class="currency-chip premium"><span>◆</span><strong>${this.state.premium}</strong><small>пуговицы</small></div>
      </header>
      <section class="menu-panel" aria-label="${TAB_LABELS[tab].label}">
        <header class="panel-heading">
          <img class="panel-tab-icon" src="${asset(TAB_LABELS[tab].iconFileName)}" width="38" height="38" alt="" aria-hidden="true" draggable="false" />
          <h2>${TAB_LABELS[tab].label}</h2>
          <button data-action="home" aria-label="Закрыть">×</button>
        </header>
      ${this.notice ? `<div class="panel-notice" role="status" aria-live="polite">${this.notice}</div>` : ""}
        <div class="panel-scroll">${this.renderTabContent(tab)}</div>
      </section>
      ${this.renderNav()}
    `;
  }

  private renderTabContent(tab: Exclude<MenuTab, "home">): string {
    switch (tab) {
      case "upgrades":
        return this.renderUpgrades();
      case "quests":
        return this.renderQuests();
      case "needles":
        return this.renderNeedles();
      case "bestiary":
        return this.renderBestiary();
      case "shop":
        return this.renderShop();
    }
  }

  private renderUpgrades(): string {
    const upgrades = UPGRADE_IDS.map((id) => {
      const level = this.state.upgrades[id];
      const cost = getUpgradeCost(id, level);
      const affordable = cost !== null && this.state.thread >= cost;
      const maxed = cost === null;
      return `
        <article class="meta-card upgrade-card ${affordable ? "is-affordable" : ""} ${maxed ? "is-maxed" : ""}">
          <div class="item-symbol upgrade-emblem" aria-hidden="true"><span>${UPGRADE_NAMES[id].symbol}</span></div>
          <div class="item-copy">
            <div class="card-kicker"><span>Усиление</span><strong>ур. ${level}/${MAX_UPGRADE_LEVEL}</strong></div>
            <h3>${UPGRADE_NAMES[id].name}</h3>
            <p>${UPGRADE_DEFINITIONS[id].description}</p>
            <div class="level-pips" aria-label="Уровень ${level} из ${MAX_UPGRADE_LEVEL}">
              ${Array.from({ length: MAX_UPGRADE_LEVEL }, (_, index) => `<i class="${index < level ? "filled" : ""}"></i>`).join("")}
            </div>
          </div>
          <button class="buy-button card-action" data-action="upgrade" data-id="${id}" ${maxed || !affordable ? "disabled" : ""} aria-label="${maxed ? `${UPGRADE_NAMES[id].name}: максимальный уровень` : `Улучшить ${UPGRADE_NAMES[id].name} за ${cost} нитей`}">
            <span>${maxed ? "МАКС" : `✦ ${cost}`}</span><small>${maxed ? "ГОТОВО" : "УСИЛИТЬ"}</small>
          </button>
        </article>`;
    }).join("");

    const skills = SKILLS.map((skill) => {
      const unlocked = this.state.unlockedSkills.includes(skill.id);
      const equipped = this.state.equippedSkill === skill.id;
      return `
        <article class="meta-card skill-card ${equipped ? "is-equipped" : ""} ${unlocked ? "" : "is-locked"}">
          <div class="item-symbol skill-emblem" aria-hidden="true"><span>${skill.symbol}</span></div>
          <div class="item-copy">
            <div class="card-kicker"><span>Боевой навык</span><strong>${equipped ? "активен" : unlocked ? "открыт" : `этап ${skill.unlockStage}`}</strong></div>
            <h3>${skill.name}</h3><p>${skill.description}</p>
          </div>
          <button class="select-button card-action" data-action="skill" data-id="${skill.id}" aria-pressed="${equipped}" ${!unlocked || equipped ? "disabled" : ""}>
            <span>${equipped ? "ВЫБРАН" : unlocked ? "ВЫБРАТЬ" : `ЭТАП ${skill.unlockStage}`}</span><small>${equipped ? "АКТИВЕН" : unlocked ? "НАВЫК" : "ЗАКРЫТО"}</small>
          </button>
        </article>`;
    }).join("");

    return `
      <div class="panel-intro panel-intro-upgrades">
        <span class="panel-intro-emblem" aria-hidden="true">✦</span>
        <div><strong>Мастерская усилений</strong><p>Вкладывай нити в постоянную силу. Чем выше уровень, тем дороже следующий стежок.</p></div>
      </div>
      <div class="card-stack upgrade-stack">${upgrades}</div>
      <div class="section-divider"><span>Боевые навыки</span><small>Одновременно действует один навык</small></div>
      <div class="card-stack skill-stack">${skills}</div>`;
  }

  private renderQuests(): string {
    const claimedCount = QUESTS.filter((quest) => this.state.claimedQuestIds.includes(quest.id)).length;
    const quests = QUESTS.map((quest) => {
      const progress = Math.min(getQuestProgress(this.state, quest.id), quest.target);
      const claimed = this.state.claimedQuestIds.includes(quest.id);
      const complete = progress >= quest.target;
      const status = claimed ? "Награда получена" : complete ? "Можно забрать" : "В работе";
      const reward = [
        quest.rewardThread ? `✦ ${quest.rewardThread}` : "",
        quest.rewardPremium ? `◆ ${quest.rewardPremium}` : "",
      ].filter(Boolean).join(" · ");
      return `
        <article class="meta-card quest-card ${complete ? "is-complete" : ""} ${claimed ? "is-claimed" : ""}">
          <div class="quest-emblem" aria-hidden="true"><span>${QUEST_EMBLEMS[quest.id]}</span></div>
          <div class="item-copy">
            <div class="card-kicker"><span>${status}</span><strong>${progress}/${quest.target}</strong></div>
            <h3>${quest.name}</h3>
            <p>${quest.description}</p>
            <div class="quest-progress" role="progressbar" aria-label="Прогресс поручения ${quest.name}" aria-valuemin="0" aria-valuemax="${quest.target}" aria-valuenow="${progress}"><span style="width:${(progress / quest.target) * 100}%"></span></div>
            <div class="quest-reward"><span>Награда</span><strong>${reward}</strong></div>
          </div>
          <button class="buy-button card-action" data-action="quest" data-id="${quest.id}" ${!complete || claimed ? "disabled" : ""} aria-label="${claimed ? `${quest.name}: награда получена` : complete ? `Забрать награду за поручение ${quest.name}` : `${quest.name}: выполнено ${progress} из ${quest.target}`}">
            <span>${claimed ? "ГОТОВО" : complete ? "ЗАБРАТЬ" : "В ПУТИ"}</span><small>${claimed ? "ПОЛУЧЕНО" : complete ? reward : `${progress}/${quest.target}`}</small>
          </button>
        </article>`;
    }).join("");

    return `
      <div class="panel-intro panel-intro-quests">
        <span class="panel-intro-emblem" aria-hidden="true">✓</span>
        <div><strong>Книга поручений</strong><p>Выполняй цели в рейдах и забирай редкие нити и пуговицы.</p></div>
        <b>${claimedCount}/${QUESTS.length}</b>
      </div>
      <div class="card-stack quest-stack">${quests}</div>`;
  }

  private renderNeedles(): string {
    const unlockCost = getRandomNeedleUnlockCost(this.state);
    const canUnlock = unlockCost !== null && this.state.thread >= unlockCost;
    const ownedCount = this.state.ownedNeedles.length;
    const draw = `
      <article class="needle-draw">
        <div class="draw-emblem" aria-hidden="true"><span>?</span></div>
        <div class="draw-copy"><span>Тайный футляр</span><h3>${unlockCost === null ? "Коллекция собрана" : "Случайная новая игла"}</h3><p>${unlockCost === null ? "Все иглы уже открыты." : "Какая именно выпадет — станет известно после открытия."}</p></div>
        <button class="buy-button card-action" data-action="random-needle" ${!canUnlock ? "disabled" : ""} aria-label="${unlockCost === null ? "Все иглы уже открыты" : `Открыть случайную иглу за ${unlockCost} нитей`}">
          <span>${unlockCost === null ? "ГОТОВО" : "ОТКРЫТЬ"}</span><small>${unlockCost === null ? "СОБРАНО" : `✦ ${unlockCost}`}</small>
        </button>
      </article>`;

    return `
      <div class="panel-intro panel-intro-needles">
        <span class="panel-intro-emblem" aria-hidden="true">➶</span>
        <div><strong>Коллекция игл</strong><p>Каждый облик меняет не только цвет, но и стиль следующего рейда.</p></div>
        <b>${ownedCount}/${NEEDLE_SKINS.length}</b>
      </div>
      ${draw}
      <div class="card-stack needle-stack">${NEEDLE_SKINS.map((skin) => {
      const owned = this.state.ownedNeedles.includes(skin.id);
      const equipped = this.state.equippedNeedle === skin.id;
      return `
        <article class="meta-card needle-card ${equipped ? "is-equipped" : ""} ${owned ? "" : "is-locked"}">
          <div class="needle-showcase has-art">
            <img class="needle-art" src="${asset(skin.iconFileName)}" alt="" aria-hidden="true" draggable="false" />
            ${owned ? "" : `<span class="needle-lock" aria-hidden="true">?</span>`}
          </div>
          <div class="item-copy">
            <div class="card-kicker"><span>${equipped ? "В колчане" : owned ? "Открыта" : "Неизвестна"}</span><strong>${owned ? `✦ ${skin.threadCost}` : "???"}</strong></div>
            <h3>${owned ? skin.name : "Неизвестная игла"}</h3><strong>${owned ? skin.subtitle : "Скрыта в футляре"}</strong><p>${owned ? skin.description : "Облик и свойство откроются случайно."}</p>
          </div>
          <button class="select-button card-action" data-action="needle" data-id="${skin.id}" aria-pressed="${equipped}" ${!owned || equipped ? "disabled" : ""}>
            <span>${equipped ? "В КОЛЧАНЕ" : owned ? "ВЫБРАТЬ" : "???"}</span><small>${equipped ? "АКТИВНА" : owned ? "СМЕНИТЬ" : "ЗАКРЫТО"}</small>
          </button>
        </article>`;
      }).join("")}</div>`;
  }

  private renderBestiary(): string {
    return MONSTERS.map((monster) => {
      const firstStage = firstStageForMonster(monster.id);
      const discovered = this.state.highestStageCleared >= firstStage;
      const imageKey = monster.textureKeys?.[0];
      return `
        <article class="meta-card beast-card ${discovered ? "" : "is-locked"}">
          <div class="beast-portrait">${discovered && imageKey ? `<img src="${asset(`${imageKey}.webp`)}" alt="" />` : "?"}</div>
          <div class="item-copy">
            <h3>${discovered ? monster.name : "Неизвестный кошмар"}${monster.isBoss && discovered ? " · БОСС" : ""}</h3>
            <p>${discovered ? monster.epithet : `Встречается не раньше этапа ${firstStage}`}</p>
          </div>
        </article>`;
    }).join("");
  }

  private renderShop(): string {
    const backgrounds = BACKGROUNDS.map((background) => {
      const owned = this.state.ownedBackgrounds.includes(background.id);
      const equipped = this.state.equippedBackground === background.id;
      const canEarn = this.state.highestStageCleared >= background.unlockStage;
      const canBuy = this.state.premium >= background.premiumCost;
      const image = background.fileName ?? "attic-workshop.webp";
      return `
        <article class="background-card ${equipped ? "is-equipped" : ""}">
          <img src="${asset(image)}" alt="" />
          <div><h3>${background.name}</h3><p>${background.description}</p></div>
          <button class="select-button" data-action="background" data-id="${background.id}" ${equipped || (!owned && !canEarn && !canBuy) ? "disabled" : ""}>
            ${equipped ? "ВЫБРАН" : owned ? "ВЫБРАТЬ" : canEarn ? "ОТКРЫТЬ" : `◆ ${background.premiumCost} · ЭТАП ${background.unlockStage}`}
          </button>
        </article>`;
    }).join("");

    return `
      <p class="section-lead">Редкие фоны можно открыть выдающимся результатом или лунными пуговицами.</p>
      ${backgrounds}
      <article class="battlepass-teaser"><span>СЕЗОННЫЙ АЛЬБОМ</span><h3>Боевой пропуск появится позже</h3><p>Система заданий уже считает прогресс и готова к будущим сезонам.</p></article>
    `;
  }

  private renderNav(): string {
    return `<nav class="menu-nav" aria-label="Разделы">${Object.entries(TAB_LABELS).map(([id, item]) => `
      <button type="button" data-tab="${id}" class="${this.tab === id ? "is-active" : ""}" ${this.tab === id ? 'aria-current="page"' : ""}>
        <img class="menu-nav-icon" src="${asset(item.iconFileName)}" width="44" height="44" alt="" aria-hidden="true" draggable="false" />
        <small>${item.label}</small>
      </button>
    `).join("")}</nav>`;
  }
}
