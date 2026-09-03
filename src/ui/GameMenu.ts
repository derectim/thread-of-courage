import {
  MAX_UPGRADE_LEVEL,
  UPGRADE_DEFINITIONS,
  UPGRADE_IDS,
  claimQuest,
  equipActiveAbility,
  equipNeedle,
  equipSkill,
  getDailySelectionContext,
  getQuestProgress,
  getRandomNeedleUnlockCost,
  getUpgradeCost,
  purchaseUpgrade,
  unlockRandomNeedle,
  unlockBackground,
  type ProgressionState,
  type UpgradeId,
} from "../game/ProgressionStore";
import {
  ACTIVE_ABILITIES,
  type ActiveAbilityId,
} from "../game/ActiveAbilities";
import {
  canRefreshDailyQuests,
  claimDailyQuest,
  claimStreakChest,
  getDailyQuestDefinition,
  normalizeDailySystemsState,
  refreshDailyQuests,
  type DailyQuestGroup,
  type DailyQuestId,
} from "../game/DailySystems";
import {
  MAX_NEEDLE_MASTERY_LEVEL,
  NEEDLE_MASTERY_REWARDS,
  getNeedleMasterySummary,
  type NeedleMasteryRewardKind,
} from "../game/NeedleMastery";
import {
  SEASON_PASS_TIERS,
  SEASON_TASKS,
  claimSeasonPassReward,
  getSeasonPassStatus,
  recordSeasonPassEvent,
  setPrototypePremiumAccess,
  type SeasonPassTrack,
} from "../game/SeasonPass";
import {
  claimWeeklyRouteReward,
  createWeeklyRoute,
  getWeeklyModifier,
  getWeeklyRouteStatus,
  syncWeeklyRouteProgress,
} from "../game/WeeklyRoute";
import {
  MONSTERS,
  getMonsterForStage,
  type MonsterDefinition,
} from "../game/content";
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

export interface GameMenuCallbacks {
  readonly onStart: () => void;
  readonly onStartWeekly: () => void;
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

const DAILY_GROUP_SYMBOLS: Readonly<Record<DailyQuestGroup, string>> = {
  journey: "➶",
  accuracy: "◎",
  needle: "⌁",
  room: "⌂",
  boss: "♜",
};

const MASTERY_REWARD_SYMBOLS: Readonly<Record<NeedleMasteryRewardKind, string>> = {
  trail: "〰",
  impact: "✦",
  badge: "◆",
  aura: "◉",
  title: "♛",
};

const SEASON_PREMIUM_COST = 25;

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

export function getBestiaryThreatLabel(
  monster: Pick<MonsterDefinition, "isBoss" | "isMiniBoss">,
): string {
  if (monster.isBoss) return "БОСС";
  if (monster.isMiniBoss) return "МИНИ-БОСС";
  return "";
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
    if (action === "active-ability") {
      const id = target.dataset.id as ActiveAbilityId;
      const ability = ACTIVE_ABILITIES.find((candidate) => candidate.id === id);
      if (!ability || ability.unlockStage > Math.max(1, this.state.highestStageCleared)) {
        this.showNotice(ability ? `Приём откроется на этапе ${ability.unlockStage}` : "Приём не найден");
        return;
      }
      this.commit(equipActiveAbility(this.state, id), ability.name);
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
      return;
    }
    if (action === "daily-refresh") {
      const context = this.getDailyContext();
      const dailySystems = normalizeDailySystemsState(this.state.dailySystems, new Date(), context);
      if (!canRefreshDailyQuests(dailySystems)) {
        this.showNotice("Сегодняшняя замена уже использована или награда уже получена");
        return;
      }
      this.commit(
        {
          ...this.state,
          dailySystems: refreshDailyQuests(dailySystems, new Date(), context),
        },
        "Поручения на сегодня заменены",
      );
      return;
    }
    if (action === "daily-claim") {
      const id = target.dataset.id as DailyQuestId;
      const context = this.getDailyContext();
      const result = claimDailyQuest(this.state.dailySystems, id, new Date(), context);
      if (!result.reward) {
        this.showNotice("Поручение ещё не выполнено или награда уже получена");
        return;
      }
      this.commit(
        {
          ...this.state,
          thread: this.state.thread + result.reward.thread,
          cosmeticFragments: this.state.cosmeticFragments + result.reward.cosmeticFragments,
          dailySystems: result.state,
          seasonPass: recordSeasonPassEvent(this.state.seasonPass, "daily-task-completed"),
        },
        `Награда: ✦ ${result.reward.thread} · осколки ${result.reward.cosmeticFragments}`,
      );
      return;
    }
    if (action === "streak-claim") {
      const chestId = target.dataset.chestId ?? "";
      const result = claimStreakChest(
        this.state.dailySystems,
        chestId,
        new Date(),
        this.getDailyContext(),
      );
      if (!result.reward) {
        this.showNotice("Сундук уже забран или пока недоступен");
        return;
      }
      this.commit(
        {
          ...this.state,
          thread: this.state.thread + result.reward.thread,
          cosmeticFragments: this.state.cosmeticFragments + result.reward.cosmeticFragments,
          dailySystems: result.state,
        },
        `Сундук открыт: ✦ ${result.reward.thread} · осколки ${result.reward.cosmeticFragments}`,
      );
      return;
    }
    if (action === "weekly-start") {
      this.callbacks.onStartWeekly();
      return;
    }
    if (action === "weekly-claim") {
      const route = createWeeklyRoute(new Date());
      const result = claimWeeklyRouteReward(this.state.weeklyRoute, route);
      if (!result.reward) {
        this.showNotice("Сначала заверши все пять узлов недельного пути");
        return;
      }
      this.commit(
        {
          ...this.state,
          weeklyRoute: result.progress,
          ownedSeasonCosmetics: Array.from(
            new Set([...this.state.ownedSeasonCosmetics, result.reward.id]),
          ),
        },
        `Получено: ${result.reward.name}`,
      );
      return;
    }
    if (action === "season-premium") {
      if (this.state.seasonPass.prototypePremiumEnabled) {
        this.showNotice("Премиальная дорожка уже открыта");
        return;
      }
      if (this.state.premium < SEASON_PREMIUM_COST) {
        this.showNotice(`Нужно ${SEASON_PREMIUM_COST} игровых пуговиц`);
        return;
      }
      this.commit(
        {
          ...this.state,
          premium: this.state.premium - SEASON_PREMIUM_COST,
          seasonPass: setPrototypePremiumAccess(this.state.seasonPass, true),
        },
        "Премиальная дорожка сезона открыта",
      );
      return;
    }
    if (action === "season-claim") {
      const tier = Number.parseInt(target.dataset.tier ?? "", 10);
      const track = target.dataset.track as SeasonPassTrack;
      const result = claimSeasonPassReward(this.state.seasonPass, tier, track);
      if (!result.reward) {
        this.showNotice(track === "premium" && !this.state.seasonPass.prototypePremiumEnabled
          ? "Сначала открой премиальную дорожку"
          : "Эта награда ещё закрыта или уже получена");
        return;
      }
      this.commit(
        {
          ...this.state,
          seasonPass: result.state,
          ownedSeasonCosmetics: Array.from(
            new Set([...this.state.ownedSeasonCosmetics, result.reward.id]),
          ),
        },
        `В альбоме: ${result.reward.name}`,
      );
    }
  };

  private getDailyContext(): ReturnType<typeof getDailySelectionContext> {
    return getDailySelectionContext(
      this.state.highestStageCleared,
      this.state.ownedNeedles,
    );
  }

  private showNotice(message: string): void {
    this.notice = message;
    this.render();
  }

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
          chestId: activeButton.dataset.chestId,
          tier: activeButton.dataset.tier,
          track: activeButton.dataset.track,
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
          button.dataset.id === focusKey.id &&
          button.dataset.chestId === focusKey.chestId &&
          button.dataset.tier === focusKey.tier &&
          button.dataset.track === focusKey.track,
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
      <button class="raid-button" data-action="start"><span>В РЕЙД!</span><small>Мини-боссы между главными</small></button>
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

    const activeAbilities = ACTIVE_ABILITIES.map((ability) => {
      const unlocked = ability.id === "time-loop" || this.state.highestStageCleared >= ability.unlockStage;
      const equipped = this.state.equippedActiveAbility === ability.id;
      return `
        <article class="meta-card ability-card ${equipped ? "is-equipped" : ""} ${unlocked ? "" : "is-locked"}">
          <div class="item-symbol ability-emblem" aria-hidden="true"><span>${ability.symbol}</span></div>
          <div class="item-copy">
            <div class="card-kicker"><span>Активный приём</span><strong>${equipped ? "выбран" : unlocked ? `${ability.chargesPerStage} зар.` : `этап ${ability.unlockStage}`}</strong></div>
            <h3>${ability.name}</h3>
            <p>${ability.description}</p>
            <small>${ability.chargesPerStage} ${ability.chargesPerStage === 1 ? "заряд" : "заряда"} на комнату${ability.cooldownMs ? ` · перезарядка ${Math.round(ability.cooldownMs / 1000)} сек.` : ""}</small>
          </div>
          <button class="select-button card-action" data-action="active-ability" data-id="${ability.id}" aria-pressed="${equipped}" ${!unlocked || equipped ? "disabled" : ""}>
            <span>${equipped ? "ВЫБРАН" : unlocked ? "ВЫБРАТЬ" : `ЭТАП ${ability.unlockStage}`}</span><small>${equipped ? "В РЕЙДЕ" : unlocked ? "ПРИЁМ" : "ЗАКРЫТО"}</small>
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
      <div class="section-divider"><span>Активные приёмы</span><small>Кнопка выбранного приёма появится прямо в рейде</small></div>
      <div class="card-stack ability-stack">${activeAbilities}</div>
      <div class="section-divider"><span>Пассивные таланты</span><small>Одновременно действует один талант</small></div>
      <div class="card-stack skill-stack">${skills}</div>`;
  }

  private renderQuests(): string {
    const context = this.getDailyContext();
    const dailySystems = normalizeDailySystemsState(this.state.dailySystems, new Date(), context);
    const canRefreshDaily = canRefreshDailyQuests(dailySystems);
    const dailyReady = dailySystems.daily.quests.filter((quest) => {
      const definition = getDailyQuestDefinition(quest.id);
      return !quest.claimed && quest.progress >= definition.criteria.target;
    }).length;
    const dailyClaimed = dailySystems.daily.quests.filter((quest) => quest.claimed).length;
    const dailyQuests = dailySystems.daily.quests.map((quest) => {
      const definition = getDailyQuestDefinition(quest.id);
      const target = definition.criteria.target;
      const progress = Math.min(quest.progress, target);
      const complete = progress >= target;
      const status = quest.claimed ? "Получено" : complete ? "Готово" : "Сегодня";
      return `
        <article class="meta-card daily-quest-card ${complete ? "is-complete" : ""} ${quest.claimed ? "is-claimed" : ""}">
          <div class="quest-emblem daily-emblem" aria-hidden="true"><span>${DAILY_GROUP_SYMBOLS[definition.group]}</span></div>
          <div class="item-copy">
            <div class="card-kicker"><span>${status}</span><strong>${progress}/${target}</strong></div>
            <h3>${definition.name}</h3>
            <p>${definition.description}</p>
            <div class="quest-progress" role="progressbar" aria-label="Прогресс ежедневного поручения ${definition.name}" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${progress}"><span style="width:${(progress / target) * 100}%"></span></div>
            <div class="quest-reward"><span>Награда</span><strong>✦ ${definition.reward.thread} · ◈ ${definition.reward.cosmeticFragments}</strong></div>
          </div>
          <button class="buy-button card-action" data-action="daily-claim" data-id="${quest.id}" ${!complete || quest.claimed ? "disabled" : ""} aria-label="${quest.claimed ? `${definition.name}: награда получена` : complete ? `Забрать награду за ${definition.name}` : `${definition.name}: выполнено ${progress} из ${target}`}">
            <span>${quest.claimed ? "ГОТОВО" : complete ? "ЗАБРАТЬ" : "В ПУТИ"}</span><small>${quest.claimed ? "ПОЛУЧЕНО" : complete ? "НАГРАДА" : `${progress}/${target}`}</small>
          </button>
        </article>`;
    }).join("");

    const streak = dailySystems.streak;
    const nextMilestone = Math.max(5, Math.ceil((streak.current + 1) / 5) * 5);
    const streakStep = streak.current % 5;
    const pendingChests = streak.pendingChests.map((chest) => `
      <button class="streak-claim-button ${chest.tier === "grand" ? "is-grand" : ""}" data-action="streak-claim" data-chest-id="${chest.id}" aria-label="Открыть сундук за серию ${chest.milestone}">
        <span>${chest.tier === "grand" ? "БОЛЬШОЙ СУНДУК" : `СУНДУК · ${chest.milestone}`}</span>
        <small>✦ ${chest.reward.thread} · ◈ ${chest.reward.cosmeticFragments}</small>
      </button>`).join("");

    const route = createWeeklyRoute(new Date());
    const routeProgress = syncWeeklyRouteProgress(this.state.weeklyRoute, route);
    const routeStatus = getWeeklyRouteStatus(routeProgress, route);
    const currentModifier = getWeeklyModifier(routeStatus.nextNode.modifierId);
    const routeNodes = route.nodes.map((node) => {
      const clearCount = routeProgress.clearsByNode[node.id] ?? 0;
      const completedThisLap = routeStatus.canClaimFinalReward || clearCount > routeStatus.completedLaps;
      const active = !routeStatus.canClaimFinalReward && node.id === routeStatus.nextNode.id;
      return `
        <li class="weekly-node ${completedThisLap ? "is-done" : ""} ${active ? "is-active" : ""} ${!completedThisLap && !active ? "is-locked" : ""}" title="${node.name}">
          <span>${completedThisLap ? "✓" : node.order}</span><small>${node.order === 5 ? "ФИНАЛ" : `УЗЕЛ ${node.order}`}</small>
        </li>`;
    }).join("");

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
        <div><strong>Книга живых поручений</strong><p>Три новых задания каждый день, недельный путь и награды за победную серию.</p></div>
        <b>◈ ${this.state.cosmeticFragments}</b>
      </div>
      <section class="daily-board" aria-labelledby="daily-board-title">
        <header class="meta-section-heading">
          <div><span>ОБНОВЛЯЕТСЯ ЕЖЕДНЕВНО</span><h3 id="daily-board-title">Сегодняшние поручения</h3></div>
          <button class="reroll-button" data-action="daily-refresh" ${!canRefreshDaily ? "disabled" : ""} aria-label="${canRefreshDaily ? "Заменить все ежедневные поручения один раз за день" : "Замена ежедневных поручений сегодня недоступна"}"><span>${canRefreshDaily ? "↻" : "✓"}</span> ${canRefreshDaily ? "ЗАМЕНИТЬ" : "ИСПОЛЬЗОВАНО"}</button>
        </header>
        <div class="daily-summary"><span>${dailyClaimed}/3 получено</span><strong>${dailyReady ? `${dailyReady} ${dailyReady === 1 ? "награда ждёт" : "награды ждут"}` : "Продолжай рейд"}</strong></div>
        <div class="card-stack daily-stack">${dailyQuests}</div>
      </section>

      <section class="streak-card ${streak.pendingChests.length ? "has-reward" : ""}" aria-labelledby="streak-title">
        <img src="${asset("ui-streak-chest.webp")}" alt="" aria-hidden="true" draggable="false" />
        <div class="streak-copy">
          <span>СЕРИЯ ПОБЕД</span><h3 id="streak-title">${streak.current} подряд · рекорд ${streak.best}</h3>
          <p>${streak.pendingChests.length ? "Сундук уже ждёт — забери награду." : `До сундука осталось ${nextMilestone - streak.current}. Поражение обнулит текущую серию.`}</p>
          <div class="streak-meter" role="progressbar" aria-label="Прогресс до следующего сундука" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${streakStep}"><span style="width:${(streakStep / 5) * 100}%"></span></div>
          ${pendingChests ? `<div class="streak-actions">${pendingChests}</div>` : `<small class="streak-next">Следующая отметка: ${nextMilestone}</small>`}
        </div>
      </section>

      <section class="weekly-route-card" aria-labelledby="weekly-route-title">
        <div class="weekly-art"><img src="${asset("ui-weekly-route-map.webp")}" alt="" aria-hidden="true" draggable="false" /></div>
        <div class="weekly-copy">
          <span>МАРШРУТ НЕДЕЛИ · ${route.weekId}</span>
          <h3 id="weekly-route-title">${routeStatus.nextNode.name}</h3>
          <p><strong>${currentModifier.name}:</strong> ${currentModifier.description}</p>
        </div>
        <ol class="weekly-nodes" aria-label="Пять узлов недельного маршрута">${routeNodes}</ol>
        <div class="weekly-reward"><span>Финальная награда</span><strong>${route.finalReward.name}</strong></div>
        <div class="weekly-actions">
          <button class="route-button" data-action="weekly-start" ${routeStatus.canClaimFinalReward ? "disabled" : ""}><span>${routeStatus.canClaimFinalReward ? "МАРШРУТ ЗАВЕРШЁН" : routeStatus.completedNodesThisLap === 0 ? "НАЧАТЬ ПУТЬ" : "ИГРАТЬ СЛЕДУЮЩИЙ УЗЕЛ"}</span><small>${routeStatus.canClaimFinalReward ? "ЗАБЕРИ ЭМБЛЕМУ" : `${routeStatus.nextNode.order}/5 · ${currentModifier.name}`}</small></button>
          <button class="route-claim-button" data-action="weekly-claim" ${!routeStatus.canClaimFinalReward ? "disabled" : ""}><span>${routeProgress.finalRewardClaimed ? "ПОЛУЧЕНО" : "ЗАБРАТЬ ФИНАЛ"}</span><small>${routeProgress.finalRewardClaimed ? "ЭМБЛЕМА В КОЛЛЕКЦИИ" : "ПОСЛЕ 5 УЗЛОВ"}</small></button>
        </div>
      </section>

      <div class="section-divider"><span>Летопись мастерской</span><small>Постоянные достижения не исчезают</small></div>
      <div class="permanent-summary"><span>Получено наград</span><strong>${claimedCount}/${QUESTS.length}</strong></div>
      <div class="card-stack quest-stack permanent-quest-stack">${quests}</div>`;
  }

  private renderNeedles(): string {
    const unlockCost = getRandomNeedleUnlockCost(this.state);
    const canUnlock = unlockCost !== null && this.state.thread >= unlockCost;
    const ownedCount = this.state.ownedNeedles.length;
    const equippedMastery = getNeedleMasterySummary(
      this.state.needleMastery,
      this.state.equippedNeedle,
    );
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
        <div><strong>Коллекция и мастерство</strong><p>Играй любимой иглой, поднимай её до 10 уровня и открывай только косметические эффекты.</p></div>
        <b>${ownedCount}/${NEEDLE_SKINS.length}</b>
      </div>
      <div class="mastery-overview">
        <span>ИГЛА В КОЛЧАНЕ</span><strong>Мастерство ${equippedMastery.level}/${MAX_NEEDLE_MASTERY_LEVEL}</strong><small>${equippedMastery.nextLevelXp === null ? "Максимальный уровень достигнут" : `${equippedMastery.currentLevelXp}/${equippedMastery.nextLevelXp} опыта до нового уровня`}</small>
      </div>
      ${draw}
      <div class="card-stack needle-stack">${NEEDLE_SKINS.map((skin) => {
      const owned = this.state.ownedNeedles.includes(skin.id);
      const equipped = this.state.equippedNeedle === skin.id;
      const mastery = getNeedleMasterySummary(this.state.needleMastery, skin.id);
      const rewards = NEEDLE_MASTERY_REWARDS.filter((reward) => reward.needleId === skin.id);
      const nextReward = rewards.find((reward) => reward.requiredLevel > mastery.level);
      const masteryPercent = mastery.nextLevelXp === null
        ? 100
        : Math.min(100, (mastery.currentLevelXp / mastery.nextLevelXp) * 100);
      return `
        <article class="meta-card needle-card ${equipped ? "is-equipped" : ""} ${owned ? "" : "is-locked"}">
          <div class="needle-showcase has-art">
            <img class="needle-art" src="${asset(skin.iconFileName)}" alt="" aria-hidden="true" draggable="false" />
            ${owned ? "" : `<span class="needle-lock" aria-hidden="true">?</span>`}
          </div>
          <div class="item-copy">
            <div class="card-kicker"><span>${equipped ? "В колчане" : owned ? "Открыта" : "Неизвестна"}</span><strong>${owned ? `✦ ${skin.threadCost}` : "???"}</strong></div>
            <h3>${owned ? skin.name : "Неизвестная игла"}</h3><strong>${owned ? skin.subtitle : "Скрыта в футляре"}</strong><p>${owned ? skin.description : "Облик и свойство откроются случайно."}</p>
            ${owned ? `
              <div class="mastery-line">
                <span>Мастерство <b>${mastery.level}/${MAX_NEEDLE_MASTERY_LEVEL}</b></span>
                <div role="progressbar" aria-label="Мастерство иглы ${skin.name}" aria-valuemin="1" aria-valuemax="${MAX_NEEDLE_MASTERY_LEVEL}" aria-valuenow="${mastery.level}"><i style="width:${masteryPercent}%"></i></div>
              </div>
              <div class="mastery-rewards" aria-label="Косметические награды мастерства">
                ${rewards.map((reward) => `<span class="${reward.requiredLevel <= mastery.level ? "is-unlocked" : ""}" title="Уровень ${reward.requiredLevel}: ${reward.name}" aria-label="${reward.requiredLevel <= mastery.level ? "Открыто" : "Закрыто"}, уровень ${reward.requiredLevel}: ${reward.name}">${MASTERY_REWARD_SYMBOLS[reward.kind]}<small>${reward.requiredLevel}</small></span>`).join("")}
              </div>
              <small class="mastery-next">${nextReward ? `Следом: ${nextReward.name} · ур. ${nextReward.requiredLevel}` : "Все эффекты мастерства открыты"}</small>`
              : ""}
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
      const threatLabel = getBestiaryThreatLabel(monster);
      return `
        <article class="meta-card beast-card ${discovered ? "" : "is-locked"}">
          <div class="beast-portrait">${discovered && imageKey ? `<img src="${asset(`${imageKey}.webp`)}" alt="" />` : "?"}</div>
          <div class="item-copy">
            <h3>${discovered ? monster.name : "Неизвестный кошмар"}${threatLabel && discovered ? ` · ${threatLabel}` : ""}</h3>
            <p>${discovered ? monster.epithet : `Встречается не раньше этапа ${firstStage}`}</p>
          </div>
        </article>`;
    }).join("");
  }

  private renderShop(): string {
    const passStatus = getSeasonPassStatus(this.state.seasonPass);
    const passProgress = passStatus.xpForNextTier === null
      ? 100
      : (passStatus.xpIntoTier / passStatus.xpForNextTier) * 100;
    const seasonTasks = SEASON_TASKS.map((task) => {
      const progress = Math.min(this.state.seasonPass.taskProgress[task.id] ?? 0, task.target);
      const complete = this.state.seasonPass.completedTaskIds.includes(task.id);
      return `
        <li class="season-task ${complete ? "is-complete" : ""}">
          <span>${complete ? "✓" : "✦"}</span>
          <div><strong>${task.name}</strong><small>${task.description}</small></div>
          <b>${progress}/${task.target}</b>
        </li>`;
    }).join("");

    const seasonTiers = SEASON_PASS_TIERS.map((tier) => {
      const unlocked = tier.tier <= passStatus.unlockedTier;
      const freeClaimed = this.state.seasonPass.claimedFreeTiers.includes(tier.tier);
      const premiumClaimed = this.state.seasonPass.claimedPremiumTiers.includes(tier.tier);
      const premiumEnabled = this.state.seasonPass.prototypePremiumEnabled;
      return `
        <article class="season-tier ${unlocked ? "is-unlocked" : "is-locked"} ${freeClaimed && (premiumClaimed || !premiumEnabled) ? "is-complete" : ""}">
          <div class="season-tier-number"><span>${tier.tier}</span><small>${tier.requiredXp} XP</small></div>
          <div class="season-track free-track">
            <span>БЕСПЛАТНО</span><strong>${tier.freeReward.name}</strong><small>${tier.freeReward.description}</small>
            <button data-action="season-claim" data-tier="${tier.tier}" data-track="free" ${!unlocked || freeClaimed ? "disabled" : ""} aria-label="${freeClaimed ? `${tier.freeReward.name}: получено` : `Забрать бесплатную награду ${tier.freeReward.name}`}">${freeClaimed ? "✓ ПОЛУЧЕНО" : unlocked ? "ЗАБРАТЬ" : `НУЖЕН ${tier.tier} УР.`}</button>
          </div>
          <div class="season-track premium-track ${premiumEnabled ? "is-enabled" : ""}">
            <span>ЗОЛОТАЯ ДОРОЖКА</span><strong>${tier.premiumReward.name}</strong><small>${tier.premiumReward.description}</small>
            <button data-action="season-claim" data-tier="${tier.tier}" data-track="premium" ${!unlocked || premiumClaimed || !premiumEnabled ? "disabled" : ""} aria-label="${premiumClaimed ? `${tier.premiumReward.name}: получено` : `Забрать премиальную награду ${tier.premiumReward.name}`}">${premiumClaimed ? "✓ ПОЛУЧЕНО" : !premiumEnabled ? "ЗАКРЫТО" : unlocked ? "ЗАБРАТЬ" : `НУЖЕН ${tier.tier} УР.`}</button>
          </div>
        </article>`;
    }).join("");

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
      <section class="season-album" aria-labelledby="season-album-title">
        <header class="season-hero">
          <img src="${asset("ui-season-album.webp")}" alt="" aria-hidden="true" draggable="false" />
          <div><span>СЕЗОН 1 · ЖИВАЯ НИТЬ</span><h3 id="season-album-title">Сезонный альбом</h3><p>20 уровней украшений. Все награды косметические и не усиливают героя.</p></div>
          <b>${passStatus.unlockedTier}/20</b>
        </header>
        <div class="season-xp-copy"><span>Опыт альбома · ${passStatus.xp} XP</span><strong>${passStatus.xpForNextTier === null ? "Альбом завершён" : `До уровня ${passStatus.unlockedTier + 1}: ${passStatus.xpForNextTier - passStatus.xpIntoTier} XP`}</strong></div>
        <div class="season-xp-bar" role="progressbar" aria-label="Опыт сезонного альбома" aria-valuemin="0" aria-valuemax="${passStatus.xpForNextTier ?? 100}" aria-valuenow="${passStatus.xpForNextTier === null ? 100 : passStatus.xpIntoTier}"><span style="width:${passProgress}%"></span></div>
        <div class="season-premium-box ${this.state.seasonPass.prototypePremiumEnabled ? "is-enabled" : ""}">
          <div><span>${this.state.seasonPass.prototypePremiumEnabled ? "ЗОЛОТАЯ ДОРОЖКА ОТКРЫТА" : "ПРОТОТИП ЗОЛОТОЙ ДОРОЖКИ"}</span><p>${this.state.seasonPass.prototypePremiumEnabled ? "Все достигнутые премиальные награды можно забирать." : "Открывается только за игровые пуговицы. Реальных покупок и оплаты здесь нет."}</p></div>
          <button data-action="season-premium" ${this.state.seasonPass.prototypePremiumEnabled ? "disabled" : ""}><span>${this.state.seasonPass.prototypePremiumEnabled ? "ОТКРЫТО" : `◆ ${SEASON_PREMIUM_COST}`}</span><small>${this.state.seasonPass.prototypePremiumEnabled ? "АКТИВНО" : "ИГРОВЫЕ ПУГОВИЦЫ"}</small></button>
        </div>
        <details class="season-tasks" open>
          <summary><span>Задания сезона</span><small>${passStatus.completedTasks}/${SEASON_TASKS.length} завершено</small></summary>
          <ul>${seasonTasks}</ul>
        </details>
        <div class="season-tier-heading"><span>Бесплатно</span><strong>20 ступеней</strong><span>Золотая дорожка</span></div>
        <div class="season-tier-list">${seasonTiers}</div>
      </section>

      <div class="section-divider shop-divider"><span>Редкие декорации</span><small>Фоны мастерской</small></div>
      <p class="section-lead">Редкие фоны можно открыть выдающимся результатом или лунными пуговицами.</p>
      <div class="background-stack">${backgrounds}</div>
    `;
  }

  private renderNav(): string {
    const dailySystems = normalizeDailySystemsState(
      this.state.dailySystems,
      new Date(),
      this.getDailyContext(),
    );
    const dailyRewards = dailySystems.daily.quests.filter((quest) => {
      const definition = getDailyQuestDefinition(quest.id);
      return !quest.claimed && quest.progress >= definition.criteria.target;
    }).length;
    const route = createWeeklyRoute(new Date());
    const weeklyStatus = getWeeklyRouteStatus(
      syncWeeklyRouteProgress(this.state.weeklyRoute, route),
      route,
    );
    const questRewardCount = dailyRewards + dailySystems.streak.pendingChests.length + (weeklyStatus.canClaimFinalReward ? 1 : 0);
    return `<nav class="menu-nav" aria-label="Разделы">${Object.entries(TAB_LABELS).map(([id, item]) => `
      <button type="button" data-tab="${id}" class="${this.tab === id ? "is-active" : ""}" ${this.tab === id ? 'aria-current="page"' : ""}>
        <img class="menu-nav-icon" src="${asset(item.iconFileName)}" width="44" height="44" alt="" aria-hidden="true" draggable="false" />
        ${id === "quests" && dailySystems.streak.current > 0 ? `<span class="nav-streak-badge" aria-label="Серия из ${dailySystems.streak.current} побед">⌁${dailySystems.streak.current > 99 ? "99+" : dailySystems.streak.current}</span>` : ""}
        ${id === "quests" && questRewardCount > 0 ? `<span class="nav-reward-badge" aria-label="${questRewardCount} наград ждут">${questRewardCount > 9 ? "9+" : questRewardCount}</span>` : ""}
        <small>${item.label}</small>
      </button>
    `).join("")}</nav>`;
  }
}
