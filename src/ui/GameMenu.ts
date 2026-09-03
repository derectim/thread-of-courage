import {
  MAX_UPGRADE_LEVEL,
  UPGRADE_DEFINITIONS,
  UPGRADE_IDS,
  buyNeedle,
  claimQuest,
  equipSkill,
  getQuestProgress,
  getUpgradeCost,
  purchaseUpgrade,
  unlockBackground,
  type ProgressionState,
  type UpgradeId,
} from "../game/ProgressionStore";
import { MONSTERS, getMonsterForStage } from "../game/content";
import {
  BACKGROUNDS,
  NEEDLE_SKINS,
  QUESTS,
  SKILLS,
  getBackground,
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

const TAB_LABELS: Readonly<Record<Exclude<MenuTab, "home">, { label: string; symbol: string }>> = {
  upgrades: { label: "Усиления", symbol: "↗" },
  quests: { label: "Поручения", symbol: "▤" },
  needles: { label: "Иглы", symbol: "➶" },
  bestiary: { label: "Бестиарий", symbol: "◉" },
  shop: { label: "Лавка", symbol: "▰" },
};

function asset(path: string): string {
  return `${import.meta.env.BASE_URL}assets/art/${path}`;
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

  public constructor(
    private readonly root: HTMLElement,
    initialState: ProgressionState,
    private readonly callbacks: GameMenuCallbacks,
  ) {
    this.state = initialState;
    this.root.addEventListener("click", this.handleClick);
  }

  public show(state: ProgressionState, tab: MenuTab = "home", notice = ""): void {
    this.state = state;
    this.tab = tab;
    this.notice = notice;
    this.root.classList.remove("is-hidden");
    this.render();
  }

  public hide(): void {
    this.root.classList.add("is-hidden");
  }

  public destroy(): void {
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
      this.commit(buyNeedle(this.state, id));
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

  private commit(next: ProgressionState): void {
    if (next === this.state) {
      this.notice = "Пока не хватает ресурсов или условий";
    } else {
      this.state = next;
      this.notice = "Сохранено";
      this.callbacks.onStateChange(next);
    }
    this.render();
  }

  private render(): void {
    const selectedBackground = getBackground(this.state.equippedBackground);
    const backdrop = selectedBackground.fileName ?? "attic-workshop.webp";
    this.root.style.setProperty("--menu-background", `url("${asset(backdrop)}")`);
    this.root.innerHTML = this.tab === "home" ? this.renderHome() : this.renderPanel();
  }

  private renderHome(): string {
    const record = this.state.highestStageCleared;
    return `
      <div class="menu-world" aria-hidden="true"></div>
      <div class="menu-vignette" aria-hidden="true"></div>
      <header class="menu-topbar">
        <button class="round-tool" data-action="fullscreen" aria-label="На весь экран">⛶</button>
        <div class="currency-chip"><span>✦</span><strong>${this.state.thread}</strong><small>нити</small></div>
        <div class="currency-chip premium"><span>◆</span><strong>${this.state.premium}</strong><small>пуговицы</small></div>
        <button class="round-tool" data-action="sound" aria-label="Звук">${this.state.muted ? "○" : "♪"}</button>
      </header>
      <section class="menu-hero-copy">
        <span class="menu-kicker">ТКАНЕВЫЙ РЕЙД</span>
        <h1>Нитка<br />храбрости</h1>
        <p>Зашивай кошмары и не дай иглам столкнуться.</p>
      </section>
      <img class="menu-hero" src="${asset("hero-menu-v2.webp")}" alt="Эля Штопка с пружинным луком" />
      <div class="menu-record">Лучший результат: <strong>${record || "—"}</strong></div>
      ${this.notice ? `<div class="menu-toast">${this.notice}</div>` : ""}
      <button class="raid-button" data-action="start"><span>В РЕЙД!</span><small>Босс каждые 5 этапов</small></button>
      ${this.renderNav()}
    `;
  }

  private renderPanel(): string {
    const tab = this.tab as Exclude<MenuTab, "home">;
    return `
      <div class="menu-world is-blurred" aria-hidden="true"></div>
      <div class="menu-vignette is-heavy" aria-hidden="true"></div>
      <header class="menu-topbar panel-wallet">
        <div class="currency-chip"><span>✦</span><strong>${this.state.thread}</strong><small>нити</small></div>
        <div class="currency-chip premium"><span>◆</span><strong>${this.state.premium}</strong><small>пуговицы</small></div>
      </header>
      <section class="menu-panel" aria-label="${TAB_LABELS[tab].label}">
        <header class="panel-heading">
          <span>${TAB_LABELS[tab].symbol}</span>
          <h2>${TAB_LABELS[tab].label}</h2>
          <button data-action="home" aria-label="Закрыть">×</button>
        </header>
        ${this.notice ? `<div class="panel-notice">${this.notice}</div>` : ""}
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
      return `
        <article class="meta-card upgrade-card">
          <div class="item-symbol">${UPGRADE_NAMES[id].symbol}</div>
          <div class="item-copy">
            <h3>${UPGRADE_NAMES[id].name}</h3>
            <p>${UPGRADE_DEFINITIONS[id].description}</p>
            <div class="level-pips" aria-label="Уровень ${level} из ${MAX_UPGRADE_LEVEL}">
              ${Array.from({ length: MAX_UPGRADE_LEVEL }, (_, index) => `<i class="${index < level ? "filled" : ""}"></i>`).join("")}
            </div>
          </div>
          <button class="buy-button" data-action="upgrade" data-id="${id}" ${cost === null || !affordable ? "disabled" : ""}>
            ${cost === null ? "МАКС" : `✦ ${cost}`}
          </button>
        </article>`;
    }).join("");

    const skills = SKILLS.map((skill) => {
      const unlocked = this.state.unlockedSkills.includes(skill.id);
      const equipped = this.state.equippedSkill === skill.id;
      return `
        <article class="meta-card skill-card ${equipped ? "is-equipped" : ""}">
          <div class="item-symbol">${skill.symbol}</div>
          <div class="item-copy"><h3>${skill.name}</h3><p>${skill.description}</p></div>
          <button class="select-button" data-action="skill" data-id="${skill.id}" ${!unlocked || equipped ? "disabled" : ""}>
            ${equipped ? "ВЫБРАНО" : unlocked ? "ВЫБРАТЬ" : `ЭТАП ${skill.unlockStage}`}
          </button>
        </article>`;
    }).join("");

    return `<p class="section-lead">Цены выросли: каждое решение теперь важно.</p>${upgrades}<h3 class="section-title">Боевые навыки</h3>${skills}`;
  }

  private renderQuests(): string {
    return QUESTS.map((quest) => {
      const progress = Math.min(getQuestProgress(this.state, quest.id), quest.target);
      const claimed = this.state.claimedQuestIds.includes(quest.id);
      const complete = progress >= quest.target;
      const reward = [
        quest.rewardThread ? `✦ ${quest.rewardThread}` : "",
        quest.rewardPremium ? `◆ ${quest.rewardPremium}` : "",
      ].filter(Boolean).join(" · ");
      return `
        <article class="meta-card quest-card ${complete ? "is-complete" : ""}">
          <div class="item-copy">
            <h3>${quest.name}</h3>
            <p>${quest.description}</p>
            <div class="quest-progress"><span style="width:${(progress / quest.target) * 100}%"></span></div>
            <small>${progress}/${quest.target} · награда ${reward}</small>
          </div>
          <button class="buy-button" data-action="quest" data-id="${quest.id}" ${!complete || claimed ? "disabled" : ""}>
            ${claimed ? "ГОТОВО" : complete ? "ЗАБРАТЬ" : "В ПУТИ"}
          </button>
        </article>`;
    }).join("");
  }

  private renderNeedles(): string {
    return `<p class="section-lead">Это не просто облики: у каждой иглы свой характер.</p>${NEEDLE_SKINS.map((skin) => {
      const owned = this.state.ownedNeedles.includes(skin.id);
      const equipped = this.state.equippedNeedle === skin.id;
      return `
        <article class="meta-card needle-card ${equipped ? "is-equipped" : ""}">
          <div class="needle-preview" style="--shaft:#${skin.shaftColor.toString(16).padStart(6, "0")};--tip:#${skin.headColor.toString(16).padStart(6, "0")};--tail:#${skin.tailColor.toString(16).padStart(6, "0")}"><i></i></div>
          <div class="item-copy"><h3>${skin.name}</h3><strong>${skin.subtitle}</strong><p>${skin.description}</p></div>
          <button class="select-button" data-action="needle" data-id="${skin.id}" ${equipped || (!owned && this.state.thread < skin.threadCost) ? "disabled" : ""}>
            ${equipped ? "В КОЛЧАНЕ" : owned ? "ВЫБРАТЬ" : `✦ ${skin.threadCost}`}
          </button>
        </article>`;
    }).join("")}`;
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
      <button data-tab="${id}" class="${this.tab === id ? "is-active" : ""}"><span>${item.symbol}</span><small>${item.label}</small></button>
    `).join("")}</nav>`;
  }
}
