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
  WORKSHOP_COLLECTIBLE_KINDS,
  WORKSHOP_COLLECTIBLES,
  equipWorkshopCollectible,
  getEquippedWorkshopCollectible,
  getWorkshopCollectionSummary,
  getWorkshopCollectible,
  getWorkshopPatchArtFileName,
  grantWorkshopCollectible,
  normalizeWorkshopCollectionState,
  type WorkshopCollectionState,
  type WorkshopCollectible,
  type WorkshopCollectibleKind,
} from "../game/WorkshopCollection";
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
import {
  createLeaderboardViewModel,
  type LeaderboardViewModel,
} from "../game/Leaderboard";
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
import type { PlatformUserProfile } from "../platform/PlatformAdapter";

export type MenuTab = "home" | "upgrades" | "quests" | "needles" | "bestiary" | "shop";

interface HiddenPanelView {
  readonly tab: Exclude<MenuTab, "home">;
  readonly scrollTop: number;
}

export function resolvePanelScrollRestoration(
  storedTab: MenuTab | null | undefined,
  nextTab: MenuTab,
  scrollTop: number | undefined,
): number | undefined {
  return storedTab === nextTab && nextTab !== "home" ? scrollTop : undefined;
}

export interface GameMenuCallbacks {
  readonly onStart: () => void;
  readonly onStartWeekly: () => void;
  readonly onStateChange: (state: ProgressionState) => void;
  readonly onToggleSound: (muted: boolean) => void;
  readonly onFullscreen: () => void;
  readonly onLoadLeaderboard: () => Promise<LeaderboardViewModel>;
  readonly onLoadProfile?: () => Promise<PlatformUserProfile | null>;
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

const SEASON_PREMIUM_COST = 60;

const WORKSHOP_KIND_LABELS: Readonly<Record<WorkshopCollectibleKind, string>> = {
  title: "Титул",
  patch: "Нашивка",
  "portrait-frame": "Рамка",
  "name-glow": "Свечение имени",
  "name-font": "Почерк имени",
  "needle-trail": "След иглы",
  "needle-impact": "Попадание",
  "needle-aura": "Сияние иглы",
  "workshop-ornament": "Предмет мастерской",
};

const PROFILE_COLLECTIBLE_KINDS: readonly WorkshopCollectibleKind[] = [
  "title",
  "patch",
  "portrait-frame",
  "name-glow",
  "name-font",
];

const NEEDLE_COLLECTIBLE_KINDS: readonly WorkshopCollectibleKind[] = [
  "needle-trail",
  "needle-impact",
  "needle-aura",
];

function collectibleVariant(id: string): number {
  return Array.from(id).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 5;
}

function collectibleDisplayName(name: string): string {
  return name.replace(/^Титул «|»$/g, "");
}

interface GuidePoint {
  readonly title: string;
  readonly copy: string;
  readonly symbol?: string;
  readonly iconFileName?: string;
}

interface GuidePage {
  readonly eyebrow: string;
  readonly title: string;
  readonly summary: string;
  readonly artFileName: string;
  readonly artAlt: string;
  readonly backdropFileName?: string;
  readonly visualSymbol: string;
  readonly points: readonly GuidePoint[];
}

const GUIDE_PAGES: readonly GuidePage[] = [
  {
    eyebrow: "ПЕРВЫЙ СТЕЖОК",
    title: "Метко шей — и освобождай путь",
    summary: "Зашей кошмар точными попаданиями и проходи этап за этапом.",
    artFileName: "hero-shot-3.webp",
    artAlt: "Эля выпускает светящуюся иглу",
    visualSymbol: "➶",
    points: [
      {
        symbol: "◎",
        title: "Сделай выстрел",
        copy: "Коснись игрового поля, щёлкни мышью или нажми Пробел.",
      },
      {
        symbol: "⌁",
        title: "Ищи свободный край",
        copy: "Новая игла должна войти в кошмар и не коснуться уже закреплённых игл.",
      },
      {
        symbol: "◇",
        title: "Береги оберег",
        copy: "Столкновение расходует защиту. Если оберега не осталось — рейд окончен.",
      },
    ],
  },
  {
    eyebrow: "КОШМАРЫ И КОМНАТЫ",
    title: "Лица подскажут, что происходит",
    summary: "Внешность врага меняется вместе с его состоянием, а каждая комната задаёт свой ритм.",
    artFileName: "boss-madam-marionette-2.webp",
    artAlt: "Повреждённая Мадам Марионетка",
    backdropFileName: "room-puppet-theatre.webp",
    visualSymbol: "♜",
    points: [
      {
        symbol: "◉",
        title: "Следи за лицом",
        copy: "У врагов четыре вида повреждений: чем сильнее потрёпан кошмар, тем ближе победа.",
      },
      {
        symbol: "♛",
        title: "Особые этапы",
        copy: "Мини-боссы ждут на этапах 3, 8, 13 и 18 каждого цикла, главные боссы — на каждом пятом.",
      },
      {
        symbol: "⚠",
        title: "Читай предупреждения",
        copy: "Чердак ускоряет вращение, театр меняет направление, а машина пульсом меняет скорость.",
      },
      {
        symbol: "↗",
        title: "Учитывай броню",
        copy: "Металлический шлем Напёрсточного Стража отражает иглу — целься в тканевый корпус.",
      },
    ],
  },
  {
    eyebrow: "БОЕВЫЕ ПРИЁМЫ",
    title: "Активное нажимай, пассивное работает само",
    summary: "Собери свой набор в разделе «Усиления» до начала рейда.",
    artFileName: "menu-icon-upgrades.webp",
    artAlt: "Тканевая эмблема усилений",
    visualSymbol: "◷",
    points: [
      {
        symbol: "E",
        title: "Большая кнопка в рейде",
        copy: "Нажми её или клавишу E, посмотри короткое видео и примени выбранный приём один раз за поход.",
      },
      {
        symbol: "✦",
        title: "Выбери заранее",
        copy: "Одновременно можно взять один активный приём и один пассивный талант.",
      },
      {
        symbol: "∞",
        title: "Пассивное — постоянно",
        copy: "Талант действует без нажатия, а купленные за нити уровни сохраняются между рейдами.",
      },
    ],
  },
  {
    eyebrow: "НИЖНЯЯ ЛЕНТА",
    title: "Пять разделов мастерской",
    summary: "Вот что находится за каждой тканевой иконкой внизу главного экрана.",
    artFileName: "menu-icon-quests.webp",
    artAlt: "Тканевая эмблема поручений",
    visualSymbol: "⌂",
    points: [
      {
        iconFileName: "menu-icon-upgrades.webp",
        title: "Усиления",
        copy: "Постоянные уровни, активные приёмы и пассивные таланты.",
      },
      {
        iconFileName: "menu-icon-quests.webp",
        title: "Поручения",
        copy: "Задания дня, серия побед, недельный путь и постоянные достижения.",
      },
      {
        iconFileName: "menu-icon-needles.webp",
        title: "Иглы",
        copy: "Открытие, выбор, боевые свойства и косметическое мастерство игл.",
      },
      {
        iconFileName: "menu-icon-bestiary.webp",
        title: "Бестиарий",
        copy: "Встреченные враги и отметки мини-боссов и главных боссов.",
      },
      {
        iconFileName: "menu-icon-shop.webp",
        title: "Лавка",
        copy: "Книга мастерской, экипировка коллекции и длинный сезонный альбом.",
      },
    ],
  },
  {
    eyebrow: "ПРОГРЕСС И НАГРАДЫ",
    title: "Возвращайся за новым узором",
    summary: "Короткие и длинные цели дополняют обычное прохождение, но не мешают играть в своём темпе.",
    artFileName: "ui-season-album.webp",
    artAlt: "Тканевый сезонный альбом",
    visualSymbol: "✦",
    points: [
      {
        symbol: "☀",
        title: "Каждый день",
        copy: "Три поручения обновляются ежедневно; весь набор можно бесплатно заменить один раз за день.",
      },
      {
        symbol: "⌁",
        title: "Серия и неделя",
        copy: "Сундук даётся за каждые 5 побед, большой — за каждые 10. Поражение сбрасывает серию и новый поход начинает с этапа 1; недельный путь состоит из 5 узлов.",
      },
      {
        symbol: "♛",
        title: "Сезон",
        copy: "Задания дают опыт для 20 длинных косметических ступеней. Награды можно надевать в Книге мастерской.",
      },
      {
        symbol: "◆",
        title: "Три игровых ресурса",
        copy: "✦ нити идут на усиления и иглы, ◆ пуговицы — на фоны и Золотую дорожку, ◈ осколки приходят из поручений и сундуков. Реальной оплаты здесь нет.",
      },
      {
        symbol: "✓",
        title: "Сохранение автоматическое",
        copy: "После победы можно выйти и позже продолжить со следующего этапа. Прогресс хранится локально, а внутри VK синхронизируется между устройствами.",
      },
    ],
  },
] as const;

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
  private guidePage: number | null = null;
  private leaderboardOpen = false;
  private leaderboardRequest = 0;
  private leaderboard = createLeaderboardViewModel("idle");
  private profileOpen = false;
  private wardrobeOpen = false;
  private profileRequest = 0;
  private profile: PlatformUserProfile | null = null;
  private hiddenPanelView: HiddenPanelView | null = null;
  private destroyed = false;
  private readonly frame: HTMLElement | null;

  public constructor(
    private readonly root: HTMLElement,
    initialState: ProgressionState,
    private readonly callbacks: GameMenuCallbacks,
  ) {
    this.state = initialState;
    this.frame = this.root.closest<HTMLElement>(".game-frame");
    this.root.addEventListener("click", this.handleClick);
    this.root.addEventListener("keydown", this.handleKeyDown);
  }

  public show(state: ProgressionState, tab: MenuTab = "home", notice = ""): void {
    if (this.destroyed) return;
    const hiddenScrollTop = resolvePanelScrollRestoration(
      this.hiddenPanelView?.tab,
      tab,
      this.hiddenPanelView?.scrollTop,
    );
    this.hiddenPanelView = null;
    this.state = state;
    this.tab = tab;
    this.notice = notice;
    this.guidePage = null;
    this.leaderboardOpen = false;
    this.profileOpen = false;
    this.wardrobeOpen = false;
    this.frame?.classList.add("menu-active");
    this.root.classList.remove("is-hidden");
    this.render();
    if (hiddenScrollTop !== undefined) {
      const panelScroll = this.root.querySelector<HTMLElement>(".panel-scroll");
      if (panelScroll) panelScroll.scrollTop = hiddenScrollTop;
    }
    if (!this.profile) void this.loadProfile();
  }

  public hide(): void {
    const panelScroll = this.root.querySelector<HTMLElement>(".panel-scroll");
    this.hiddenPanelView =
      this.tab !== "home" && panelScroll
        ? { tab: this.tab, scrollTop: panelScroll.scrollTop }
        : null;
    this.profileRequest += 1;
    this.guidePage = null;
    this.leaderboardOpen = false;
    this.profileOpen = false;
    this.wardrobeOpen = false;
    this.frame?.classList.remove("menu-active");
    this.root.classList.add("is-hidden");
  }

  public destroy(): void {
    this.destroyed = true;
    this.profileRequest += 1;
    this.frame?.classList.remove("menu-active");
    this.root.removeEventListener("click", this.handleClick);
    this.root.removeEventListener("keydown", this.handleKeyDown);
    this.root.replaceChildren();
  }

  private readonly handleClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
    if (!target || target.disabled) return;

    const action = target.dataset.action;
    if (action === "profile-open") {
      this.guidePage = null;
      this.leaderboardOpen = false;
      this.profileOpen = true;
      this.wardrobeOpen = false;
      this.render();
      this.focusProfileDialog();
      return;
    }
    if (action === "profile-close") {
      this.closeProfile();
      return;
    }
    if (action === "wardrobe-open") {
      this.wardrobeOpen = true;
      this.render();
      this.focusProfileDialog();
      return;
    }
    if (action === "wardrobe-back") {
      this.wardrobeOpen = false;
      this.render();
      this.focusProfileDialog();
      return;
    }
    if (action === "guide-open") {
      this.guidePage = 0;
      this.render();
      this.focusGuideDialog();
      return;
    }
    if (action === "leaderboard-open" || action === "leaderboard-retry") {
      void this.openLeaderboard();
      return;
    }
    if (action === "leaderboard-close") {
      this.closeLeaderboard();
      return;
    }
    if (action === "guide-close" || action === "guide-done") {
      this.closeGuide();
      return;
    }
    if (action === "guide-back") {
      this.moveGuide(-1);
      return;
    }
    if (action === "guide-next") {
      this.moveGuide(1);
      return;
    }
    if (action === "guide-page") {
      const page = Number.parseInt(target.dataset.page ?? "", 10);
      if (Number.isInteger(page) && page >= 0 && page < GUIDE_PAGES.length) {
        this.guidePage = page;
        this.render();
        this.root.querySelector<HTMLButtonElement>(`[data-action="guide-page"][data-page="${page}"]`)?.focus({ preventScroll: true });
      }
      return;
    }
    if (this.guidePage !== null || this.leaderboardOpen) return;

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
    if (action === "workshop-toggle") {
      const id = target.dataset.id ?? "";
      const collectible = getWorkshopCollectible(id);
      if (!collectible) {
        this.showNotice("Украшение не найдено");
        return;
      }
      const collection = this.getWorkshopCollection();
      if (!collection.ownedCollectibleIds.includes(id)) {
        this.showNotice("Сначала открой это украшение");
        return;
      }
      const isEquipped = collection.equipped[collectible.kind] === id;
      const workshopCollection = equipWorkshopCollectible(
        collection,
        collectible.kind,
        isEquipped ? null : id,
      );
      this.commit(
        { ...this.state, workshopCollection },
        isEquipped ? `${collectible.name}: снято` : `${collectible.name}: выбрано`,
      );
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
          premium: this.state.premium + result.reward.buttonReward,
          weeklyRoute: result.progress,
          ownedSeasonCosmetics: Array.from(
            new Set([...this.state.ownedSeasonCosmetics, result.reward.id]),
          ),
        },
        `Получено: ${result.reward.name} · ◆ ${result.reward.buttonReward}`,
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
          workshopCollection: grantWorkshopCollectible(
            this.getWorkshopCollection(),
            result.reward.id,
          ),
        },
        `В альбоме: ${result.reward.name}`,
      );
      return;
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.guidePage === null && !this.leaderboardOpen && !this.profileOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (this.leaderboardOpen) this.closeLeaderboard();
      else if (this.profileOpen) {
        if (this.wardrobeOpen) {
          this.wardrobeOpen = false;
          this.render();
          this.focusProfileDialog();
        } else this.closeProfile();
      }
      else this.closeGuide();
      return;
    }
    if (event.key !== "Tab") return;

    const dialog = this.root.querySelector<HTMLElement>(
      this.leaderboardOpen
        ? ".leaderboard-dialog"
        : this.profileOpen
          ? ".profile-dialog"
          : ".guide-dialog",
    );
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute("hidden"));
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && (active === last || active === dialog || !dialog.contains(active))) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  private focusGuideDialog(): void {
    this.root.querySelector<HTMLElement>(".guide-dialog")?.focus({ preventScroll: true });
  }

  private closeGuide(): void {
    this.guidePage = null;
    this.render();
    this.root.querySelector<HTMLButtonElement>('[data-action="guide-open"]')?.focus({ preventScroll: true });
  }

  private focusProfileDialog(): void {
    this.root.querySelector<HTMLElement>(".profile-dialog")?.focus({ preventScroll: true });
  }

  private closeProfile(): void {
    this.profileOpen = false;
    this.wardrobeOpen = false;
    this.render();
    this.root.querySelector<HTMLButtonElement>('[data-action="profile-open"]')?.focus({ preventScroll: true });
  }

  private async loadProfile(): Promise<void> {
    const loader = this.callbacks.onLoadProfile;
    if (!loader || this.destroyed) return;
    const request = ++this.profileRequest;
    try {
      const profile = await loader();
      if (this.destroyed || request !== this.profileRequest || !profile) return;
      this.profile = profile;
      this.render();
      if (this.profileOpen && !this.root.contains(document.activeElement)) {
        this.focusProfileDialog();
      }
    } catch {
      // The local profile remains fully usable when VK identity is unavailable.
    }
  }

  private async openLeaderboard(): Promise<void> {
    const request = ++this.leaderboardRequest;
    this.guidePage = null;
    this.leaderboardOpen = true;
    this.leaderboard = createLeaderboardViewModel("loading");
    this.render();
    this.focusLeaderboardDialog();

    try {
      const leaderboard = await this.callbacks.onLoadLeaderboard();
      if (request !== this.leaderboardRequest || !this.leaderboardOpen) return;
      this.leaderboard = leaderboard;
    } catch {
      if (request !== this.leaderboardRequest || !this.leaderboardOpen) return;
      this.leaderboard = createLeaderboardViewModel("error");
    }
    this.render();
    this.focusLeaderboardDialog();
  }

  private closeLeaderboard(): void {
    this.leaderboardRequest += 1;
    this.leaderboardOpen = false;
    this.render();
    this.root
      .querySelector<HTMLButtonElement>('[data-action="leaderboard-open"]')
      ?.focus({ preventScroll: true });
  }

  private focusLeaderboardDialog(): void {
    this.root
      .querySelector<HTMLElement>(".leaderboard-dialog")
      ?.focus({ preventScroll: true });
  }

  private moveGuide(offset: number): void {
    if (this.guidePage === null) return;
    this.guidePage = Math.max(0, Math.min(GUIDE_PAGES.length - 1, this.guidePage + offset));
    const focusAction = this.guidePage === GUIDE_PAGES.length - 1 && offset > 0
      ? "guide-done"
      : offset > 0
        ? "guide-next"
        : "guide-back";
    this.render();
    this.root.querySelector<HTMLButtonElement>(`[data-action="${focusAction}"]`)?.focus({ preventScroll: true });
  }

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
    const renderedPanel = this.root.querySelector<HTMLElement>(".menu-panel");
    const previousScrollTop = resolvePanelScrollRestoration(
      renderedPanel?.dataset.menuTab as MenuTab | undefined,
      this.tab,
      renderedPanel?.querySelector<HTMLElement>(".panel-scroll")?.scrollTop,
    );
    const previousProfileDialog = this.root.querySelector<HTMLElement>(
      ".profile-dialog",
    );
    const previousProfileScrollTop =
      previousProfileDialog &&
      previousProfileDialog.classList.contains("is-wardrobe") === this.wardrobeOpen
        ? previousProfileDialog.querySelector<HTMLElement>(".profile-scroll")
            ?.scrollTop
        : undefined;
    const focusKey = activeButton
      ? {
          tab: activeButton.dataset.tab,
          action: activeButton.dataset.action,
          id: activeButton.dataset.id,
          chestId: activeButton.dataset.chestId,
          tier: activeButton.dataset.tier,
          track: activeButton.dataset.track,
          page: activeButton.dataset.page,
        }
      : null;
    this.root.innerHTML = this.tab === "home" ? this.renderHome() : this.renderPanel();
    if (previousScrollTop !== undefined) {
      const panelScroll = this.root.querySelector<HTMLElement>(".panel-scroll");
      if (panelScroll) panelScroll.scrollTop = previousScrollTop;
    }
    if (previousProfileScrollTop !== undefined) {
      const profileScroll = this.root.querySelector<HTMLElement>(".profile-scroll");
      if (profileScroll) profileScroll.scrollTop = previousProfileScrollTop;
    }
    if (focusKey) {
      const matchingButton = Array.from(this.root.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) =>
          button.dataset.tab === focusKey.tab &&
          button.dataset.action === focusKey.action &&
          button.dataset.id === focusKey.id &&
          button.dataset.chestId === focusKey.chestId &&
          button.dataset.tier === focusKey.tier &&
          button.dataset.track === focusKey.track &&
          button.dataset.page === focusKey.page,
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
    const campaignStage = this.state.campaignResumeStage;
    const guideIsOpen = this.guidePage !== null;
    const modalIsOpen = guideIsOpen || this.leaderboardOpen || this.profileOpen;
    return `
      <div class="menu-home" ${modalIsOpen ? 'aria-hidden="true" inert' : ""}>
        ${this.renderWorld()}
        <div class="menu-vignette" aria-hidden="true"></div>
        <header class="menu-topbar">
          <button class="round-tool" data-action="fullscreen" aria-label="На весь экран">⛶</button>
          <div class="currency-chip"><span>✦</span><strong>${this.state.thread}</strong><small>нити</small></div>
          <div class="currency-chip premium"><span>◆</span><strong>${this.state.premium}</strong><small>пуговицы</small></div>
          <button class="round-tool" data-action="sound" aria-label="${this.state.muted ? "Включить звук и музыку" : "Выключить звук и музыку"}">${this.state.muted ? "🔇" : "♪"}</button>
        </header>
        <button class="menu-guide-trigger" data-action="guide-open" aria-haspopup="dialog" aria-label="Открыть мини-гайд «Как играть»">
          <span aria-hidden="true">?</span><strong>Как играть</strong>
        </button>
        <button class="menu-leaderboard-trigger" data-action="leaderboard-open" aria-haspopup="dialog" aria-label="Открыть таблицу лидеров">
          <span aria-hidden="true">♛</span><strong>Рейтинг</strong>
        </button>
        <button class="menu-profile-trigger" data-action="profile-open" aria-haspopup="dialog" aria-label="Открыть профиль и гардероб">
          ${this.profile?.photoUrl
            ? `<img class="is-vk-photo" src="${escapeHtml(this.profile.photoUrl)}" alt="" referrerpolicy="no-referrer" />`
            : `<img class="is-hero-fallback" src="${asset("hero-elya.webp")}" alt="" />`}
          <strong>Профиль</strong>
        </button>
        <section class="menu-hero-copy">
          <span class="menu-kicker">ТКАНЕВЫЙ РЕЙД</span>
          <h1>Нитка<br />храбрости</h1>
          <p>Зашивай кошмары и не дай иглам столкнуться.</p>
        </section>
        ${this.renderAnimatedHero()}
        <div class="menu-record ${this.notice ? "has-notice" : ""}">
          ${this.notice ? `<span>${this.notice}</span><small>Лучший результат: <strong>${record || "—"}</strong></small>` : `Лучший результат: <strong>${record || "—"}</strong>`}
        </div>
        <button class="raid-button" data-action="start"><span>${campaignStage === 1 ? "В РЕЙД!" : "ПРОДОЛЖИТЬ ПУТЬ"}</span><small>${campaignStage === 1 ? "Новый поход · этап 1" : `Следующий этап: ${campaignStage}`}</small></button>
        ${this.renderNav()}
      </div>
      ${guideIsOpen ? this.renderGuide(this.guidePage!) : ""}
      ${this.leaderboardOpen ? this.renderLeaderboard() : ""}
      ${this.profileOpen ? this.renderProfileDialog() : ""}
    `;
  }

  private renderLeaderboard(): string {
    const collection = this.getWorkshopCollection();
    const profileTitle = getEquippedWorkshopCollectible(collection, "title");
    const profilePatch = getEquippedWorkshopCollectible(collection, "patch");
    const profileFrame = getEquippedWorkshopCollectible(collection, "portrait-frame");
    const profileGlow = getEquippedWorkshopCollectible(collection, "name-glow");
    const profileFont = getEquippedWorkshopCollectible(collection, "name-font");
    const profilePatchFile = profilePatch
      ? getWorkshopPatchArtFileName(profilePatch.id)
      : null;
    let rankedPosition = 0;
    const rows = this.leaderboard.rows.map((row) => {
      const fullName = `${row.firstName} ${row.lastName}`.trim() || `Игрок ${row.id}`;
      const initials = `${row.firstName.charAt(0)}${row.lastName.charAt(0)}`.trim() || "✦";
      const position = row.isLocalOnly ? null : ++rankedPosition;
      const profileClasses = row.isCurrentUser
        ? [
            profileFrame ? `has-profile-frame profile-frame-v-${collectibleVariant(profileFrame.id)}` : "",
            profileGlow ? `has-profile-glow profile-glow-v-${collectibleVariant(profileGlow.id)}` : "",
            profileFont ? `has-profile-font profile-font-v-${collectibleVariant(profileFont.id)}` : "",
          ].filter(Boolean).join(" ")
        : "";
      return `
        <li class="leaderboard-row ${row.isCurrentUser ? "is-current" : ""} ${row.isLocalOnly ? "is-local-only" : ""} ${profileClasses}">
          <span class="leaderboard-place ${position !== null && position <= 3 ? `is-top-${position}` : ""}">${position ?? "—"}</span>
          <span class="leaderboard-avatar-shell">
            ${row.photoUrl
              ? `<img class="leaderboard-avatar" src="${escapeHtml(row.photoUrl)}" alt="" referrerpolicy="no-referrer" />`
              : `<span class="leaderboard-avatar is-placeholder" aria-hidden="true">${escapeHtml(initials)}</span>`}
            ${row.isCurrentUser && profilePatchFile ? `<img class="leaderboard-profile-patch" src="${asset(profilePatchFile)}" alt="" aria-hidden="true" />` : ""}
          </span>
          <span class="leaderboard-name"><span><strong>${escapeHtml(fullName)}</strong>${row.isLocalOnly ? "<small>ЛОКАЛЬНО</small>" : row.isCurrentUser ? "<small>ВЫ</small>" : ""}</span>${row.isCurrentUser && profileTitle ? `<em>${escapeHtml(collectibleDisplayName(profileTitle.name))}</em>` : ""}</span>
          <span class="leaderboard-level"><small>ЭТАП</small><strong>${row.level}</strong></span>
        </li>`;
    }).join("");
    const isLoading = this.leaderboard.status === "loading";
    const canRetry = this.leaderboard.status === "error" || this.leaderboard.status === "empty";

    return `
      <div class="guide-layer leaderboard-layer">
        <div class="guide-scrim" aria-hidden="true"></div>
        <section class="leaderboard-dialog" role="dialog" aria-modal="true" aria-labelledby="leaderboard-title" tabindex="-1">
          <button class="guide-close" data-action="leaderboard-close" aria-label="Закрыть таблицу лидеров">×</button>
          <header class="leaderboard-heading">
            <span aria-hidden="true">♛</span>
            <div><small>ЛУЧШИЕ ШВЕИ VK</small><h2 id="leaderboard-title">Рейтинг мастеров</h2><p>Кто прошёл дальше всех</p></div>
          </header>
          <div class="leaderboard-scroll" aria-live="polite" aria-busy="${isLoading}">
            ${isLoading ? `<div class="leaderboard-state"><i aria-hidden="true"></i><strong>Собираем лучший отряд…</strong><span>${this.leaderboard.message ?? "Загружаем рейтинг…"}</span></div>` : ""}
            ${!isLoading && rows ? `<ol class="leaderboard-list">${rows}</ol>` : ""}
            ${!isLoading && this.leaderboard.message ? `<div class="leaderboard-note" role="status">${escapeHtml(this.leaderboard.message)}</div>` : ""}
            ${!isLoading && !rows ? `<div class="leaderboard-empty" aria-hidden="true"><span>♛</span><i>✦</i></div>` : ""}
          </div>
          <footer class="leaderboard-footer">
            <span>Профили не открываются · ваш выбранный образ показан прямо в строке</span>
            ${canRetry ? `<button data-action="leaderboard-retry">Обновить</button>` : ""}
          </footer>
        </section>
      </div>`;
  }

  private getCollectibleAcquisition(collectible: WorkshopCollectible): string {
    if (collectible.source === "season") {
      const [track, tier = "?"] = collectible.sourceId.split("-");
      return track === "premium"
        ? `Золотая дорожка · ступень ${tier}`
        : `Сезонный альбом · ступень ${tier}`;
    }
    if (collectible.source === "needle-mastery") {
      const separator = collectible.sourceId.lastIndexOf("-");
      const needleId = separator >= 0 ? collectible.sourceId.slice(0, separator) : "";
      const level = separator >= 0 ? collectible.sourceId.slice(separator + 1) : "?";
      const needle = NEEDLE_SKINS.find((candidate) => candidate.id === needleId);
      return `Мастерство ${needle?.name ?? "иглы"} · уровень ${level}`;
    }
    if (collectible.source === "weekly-route") {
      return "Финал недельного маршрута";
    }
    const level = collectible.sourceId.match(/\d+/)?.[0] ?? "?";
    return `Развитие мастерской · уровень ${level}`;
  }

  private renderProfileDialog(): string {
    const collection = this.getWorkshopCollection();
    const collectionSummary = getWorkshopCollectionSummary(collection);
    const title = getEquippedWorkshopCollectible(collection, "title");
    const patch = getEquippedWorkshopCollectible(collection, "patch");
    const frame = getEquippedWorkshopCollectible(collection, "portrait-frame");
    const glow = getEquippedWorkshopCollectible(collection, "name-glow");
    const font = getEquippedWorkshopCollectible(collection, "name-font");
    const patchFile = patch ? getWorkshopPatchArtFileName(patch.id) : null;
    const profileClass = [
      frame ? `has-frame frame-v-${collectibleVariant(frame.id)}` : "",
      glow ? `has-glow glow-v-${collectibleVariant(glow.id)}` : "",
      font ? `has-font font-v-${collectibleVariant(font.id)}` : "",
    ].filter(Boolean).join(" ");
    const fullName = this.profile
      ? `${this.profile.firstName} ${this.profile.lastName}`.trim()
      : "Мастер Живой нити";
    const avatar = this.profile?.photoUrl
      ? `<img class="profile-avatar-photo" src="${escapeHtml(this.profile.photoUrl)}" alt="" referrerpolicy="no-referrer" />`
      : `<img class="profile-avatar-hero" src="${asset("hero-elya.webp")}" alt="" />`;

    const kinds = this.wardrobeOpen
      ? WORKSHOP_COLLECTIBLE_KINDS.map((kind) => {
          const items = WORKSHOP_COLLECTIBLES.filter((item) => item.kind === kind);
          const ownedCount = items.filter((item) => collection.ownedCollectibleIds.includes(item.id)).length;
          return `
            <section class="wardrobe-group" aria-labelledby="wardrobe-${kind}">
              <header><div><h3 id="wardrobe-${kind}">${WORKSHOP_KIND_LABELS[kind]}</h3><small>${ownedCount}/${items.length}</small></div></header>
              <div class="wardrobe-list">${items.map((item) => {
                const owned = collection.ownedCollectibleIds.includes(item.id);
                const equipped = collection.equipped[item.kind] === item.id;
                return `
                  <article class="wardrobe-item rarity-${item.rarity} ${owned ? "" : "is-locked"}">
                    ${this.renderCollectiblePreview(item, !owned)}
                    <div class="wardrobe-copy">
                      <small>${owned ? WORKSHOP_KIND_LABELS[item.kind] : "ЗАКРЫТО"}</small>
                      <strong>${escapeHtml(collectibleDisplayName(item.name))}</strong>
                      <p>${escapeHtml(item.description)}</p>
                      <em>${escapeHtml(this.getCollectibleAcquisition(item))}</em>
                    </div>
                    ${owned
                      ? this.renderWorkshopToggle(item, collection)
                      : `<button class="collectible-toggle is-locked" disabled>ПОКА ЗАКРЫТО</button>`}
                    ${equipped ? `<span class="wardrobe-equipped">В образе</span>` : ""}
                  </article>`;
              }).join("")}</div>
            </section>`;
        }).join("")
      : "";

    return `
      <div class="guide-layer profile-layer">
        <div class="guide-scrim" aria-hidden="true"></div>
        <section class="profile-dialog ${this.wardrobeOpen ? "is-wardrobe" : ""}" role="dialog" aria-modal="true" aria-labelledby="profile-title" tabindex="-1">
          <button class="guide-close" data-action="profile-close" aria-label="Закрыть профиль">×</button>
          <header class="profile-heading">
            <span>${this.wardrobeOpen ? "КОЛЛЕКЦИЯ ОБРАЗОВ" : "КАРТОЧКА МАСТЕРА"}</span>
            <h2 id="profile-title">${this.wardrobeOpen ? "Гардероб" : "Профиль"}</h2>
            <p>${this.wardrobeOpen ? "Все награды видны заранее — вместе с путём получения." : "Личный образ пока хранится на этом устройстве."}</p>
          </header>
          <div class="profile-scroll">
            ${this.wardrobeOpen
              ? kinds
              : `<article class="profile-showcase workshop-profile ${profileClass}">
                  <div class="workshop-avatar">${avatar}${patchFile ? `<img class="profile-patch" src="${asset(patchFile)}" alt="" />` : ""}</div>
                  <div class="workshop-profile-name"><small>${this.profile ? "ПРОФИЛЬ VK" : "ЛОКАЛЬНЫЙ ПРОФИЛЬ"}</small><strong>${escapeHtml(fullName)}</strong><span>${title ? escapeHtml(collectibleDisplayName(title.name)) : "Без титула"}</span></div>
                  <div class="profile-record"><span>Лучший этап</span><strong>${this.state.highestStageCleared || "—"}</strong></div>
                </article>
                <div class="profile-stat-row" aria-label="Прогресс профиля">
                  <div><small>Коллекция</small><strong>${collectionSummary.collectedCount}/${collectionSummary.totalCollectibleCount}</strong></div>
                  <div><small>Мастерская</small><strong>${collectionSummary.workshopLevel} уровень</strong></div>
                  <div><small>Пуговицы</small><strong>◆ ${this.state.premium}</strong></div>
                </div>
                <div class="profile-slot-grid">
                  ${[
                    ["Нашивка", patch?.name],
                    ["Рамка", frame?.name],
                    ["Свечение", glow?.name],
                    ["Почерк", font?.name],
                    ["Титул", title?.name],
                  ].map(([label, value]) => `<div><small>${label}</small><strong>${value ? escapeHtml(collectibleDisplayName(value)) : "Не выбрано"}</strong></div>`).join("")}
                </div>
                <p class="profile-local-note">После появления сервера этот же гардероб станет публичным. Тестовые и неподтверждённые награды можно будет сбросить отдельно, не затрагивая этапы.</p>`}
          </div>
          <footer class="profile-footer">
            ${this.wardrobeOpen
              ? `<button data-action="wardrobe-back">← К ПРОФИЛЮ</button>`
              : `<button data-action="wardrobe-open">ИЗМЕНИТЬ ОБРАЗ</button>`}
          </footer>
        </section>
      </div>`;
  }

  private renderGuide(pageIndex: number): string {
    const page = GUIDE_PAGES[pageIndex];
    const isFirst = pageIndex === 0;
    const isLast = pageIndex === GUIDE_PAGES.length - 1;
    const points = page.points.map((point) => `
      <li class="guide-point">
        ${point.iconFileName
          ? `<img src="${asset(point.iconFileName)}" alt="" aria-hidden="true" draggable="false" />`
          : `<span aria-hidden="true">${point.symbol ?? "✦"}</span>`}
        <div><strong>${point.title}</strong><p>${point.copy}</p></div>
      </li>`).join("");
    const dots = GUIDE_PAGES.map((guidePage, index) => `
      <button
        type="button"
        class="${index === pageIndex ? "is-active" : ""}"
        data-action="guide-page"
        data-page="${index}"
        aria-label="${guidePage.title}, страница ${index + 1} из ${GUIDE_PAGES.length}"
        ${index === pageIndex ? 'aria-current="step"' : ""}
      ><span></span></button>`).join("");

    return `
      <div class="guide-layer">
        <div class="guide-scrim" aria-hidden="true"></div>
        <section
          class="guide-dialog ${page.points.length > 3 ? "is-dense" : ""}"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-title"
          aria-describedby="guide-summary"
          tabindex="-1"
        >
          <button class="guide-close" data-action="guide-close" aria-label="Закрыть мини-гайд">×</button>
          <header class="guide-heading">
            <span>${page.eyebrow}</span>
            <small>Страница ${pageIndex + 1} из ${GUIDE_PAGES.length}</small>
            <h2 id="guide-title">${page.title}</h2>
          </header>
          <div class="guide-scroll" aria-live="polite">
            <div class="guide-page">
              <figure class="guide-visual ${page.backdropFileName ? "has-backdrop" : ""}" aria-label="${page.artAlt}">
                ${page.backdropFileName ? `<img class="guide-visual-backdrop" src="${asset(page.backdropFileName)}" alt="" aria-hidden="true" draggable="false" />` : ""}
                <img class="guide-visual-art" src="${asset(page.artFileName)}" alt="" aria-hidden="true" draggable="false" />
                <span aria-hidden="true">${page.visualSymbol}</span>
              </figure>
              <div class="guide-copy">
                <p id="guide-summary">${page.summary}</p>
                <ul class="guide-points">${points}</ul>
              </div>
            </div>
          </div>
          <div class="guide-dots" role="navigation" aria-label="Страницы мини-гайда">${dots}</div>
          <footer class="guide-actions">
            <button class="guide-back" data-action="guide-back" ${isFirst ? "disabled" : ""}>← <span>Назад</span></button>
            ${isLast
              ? `<button class="guide-primary" data-action="guide-done"><span>Всё понятно</span> ✓</button>`
              : `<button class="guide-primary" data-action="guide-next"><span>Далее</span> →</button>`}
          </footer>
        </section>
      </div>`;
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
      <section class="menu-panel" data-menu-tab="${tab}" aria-label="${TAB_LABELS[tab].label}">
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
            <div class="card-kicker"><span>Активный приём</span><strong>${equipped ? "выбран" : unlocked ? "1 видео" : `этап ${ability.unlockStage}`}</strong></div>
            <h3>${ability.name}</h3>
            <p>${ability.description}</p>
            <small>Один просмотр · одно применение за весь поход</small>
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
      <div class="section-divider"><span>Активные приёмы</span><small>После видео · один раз за поход</small></div>
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
        <div
          class="streak-chest-visual ${streak.pendingChests.length ? "is-ready" : ""}"
          role="img"
          aria-label="${streak.pendingChests.length ? "Открывающийся сундук с наградой" : "Закрытый сундук серии побед"}"
        >
          ${[1, 2, 3].map((frame) => `<img class="streak-chest-frame frame-${frame}" src="${asset(`ui-streak-chest-frame-${frame}.webp`)}" alt="" aria-hidden="true" draggable="false" />`).join("")}
        </div>
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

  private getWorkshopCollection(): WorkshopCollectionState {
    return normalizeWorkshopCollectionState(this.state.workshopCollection, {
      ownedSeasonCosmeticIds: this.state.ownedSeasonCosmetics,
      needleMastery: this.state.needleMastery,
    });
  }

  private renderCollectiblePreview(
    collectible: WorkshopCollectible,
    locked = false,
  ): string {
    const patchFile = getWorkshopPatchArtFileName(collectible.id);
    const variant = collectibleVariant(collectible.id);
    const stateClass = locked ? " is-locked" : "";
    if (patchFile) {
      return `<span class="collectible-preview is-patch v-${variant}${stateClass}"><img src="${asset(patchFile)}" alt="" aria-hidden="true" draggable="false" /></span>`;
    }

    const contents: Readonly<Record<WorkshopCollectibleKind, string>> = {
      title: `<b>Аа</b><i>✦</i>`,
      patch: `<b>◆</b>`,
      "portrait-frame": `<i class="portrait-dot">✦</i>`,
      "name-glow": `<b>Аа</b><i>✧</i>`,
      "name-font": `<b>Аб</b>`,
      "needle-trail": `<i class="preview-needle">➶</i><i class="preview-thread"></i>`,
      "needle-impact": `<b>✦</b><i>·</i><i>✧</i>`,
      "needle-aura": `<b>⌁</b><i class="preview-aura"></i>`,
      "workshop-ornament": `<b>${this.getOrnamentSymbol(collectible.name)}</b>`,
    };
    return `<span class="collectible-preview is-${collectible.kind} v-${variant}${stateClass}" aria-hidden="true">${contents[collectible.kind]}</span>`;
  }

  private getOrnamentSymbol(name: string): string {
    if (/ножниц/i.test(name)) return "✂";
    if (/час/i.test(name)) return "◷";
    if (/сердц/i.test(name)) return "♥";
    if (/лун/i.test(name)) return "☾";
    if (/челнок/i.test(name)) return "➶";
    return "⌂";
  }

  private renderWorkshopToggle(
    collectible: WorkshopCollectible,
    collection: WorkshopCollectionState,
  ): string {
    const equipped = collection.equipped[collectible.kind] === collectible.id;
    const verb = collectible.kind === "workshop-ornament"
      ? "ПОСТАВИТЬ"
      : collectible.kind.startsWith("needle-")
        ? "ВКЛЮЧИТЬ"
        : "НАДЕТЬ";
    return `<button class="collectible-toggle ${equipped ? "is-equipped" : ""}" data-action="workshop-toggle" data-id="${collectible.id}" aria-pressed="${equipped}">${equipped ? "СНЯТЬ" : verb}</button>`;
  }

  private renderCollectionShelf(
    collection: WorkshopCollectionState,
    kinds: readonly WorkshopCollectibleKind[],
    title: string,
    summary: string,
    open = false,
  ): string {
    const owned = WORKSHOP_COLLECTIBLES.filter(
      (collectible) =>
        kinds.includes(collectible.kind) &&
        collection.ownedCollectibleIds.includes(collectible.id),
    );
    return `
      <details class="collection-shelf" ${open ? "open" : ""}>
        <summary><span>${title}</span><small>${summary}</small><b>${owned.length}</b></summary>
        ${owned.length > 0
          ? `<div class="collection-grid">${owned.map((collectible) => `
              <article class="collection-item rarity-${collectible.rarity}">
                ${this.renderCollectiblePreview(collectible)}
                <div><small>${WORKSHOP_KIND_LABELS[collectible.kind]}</small><strong>${escapeHtml(collectibleDisplayName(collectible.name))}</strong></div>
                ${this.renderWorkshopToggle(collectible, collection)}
              </article>`).join("")}</div>`
          : `<p class="collection-empty">Здесь появятся открытые награды. Первые предметы лежат в сезонном альбоме ниже.</p>`}
      </details>`;
  }

  private renderWorkshopBook(collection: WorkshopCollectionState): string {
    const summary = getWorkshopCollectionSummary(collection);
    const title = getEquippedWorkshopCollectible(collection, "title");
    const patch = getEquippedWorkshopCollectible(collection, "patch");
    const portraitFrame = getEquippedWorkshopCollectible(collection, "portrait-frame");
    const nameGlow = getEquippedWorkshopCollectible(collection, "name-glow");
    const nameFont = getEquippedWorkshopCollectible(collection, "name-font");
    const ornament = getEquippedWorkshopCollectible(collection, "workshop-ornament");
    const next = summary.nextLevel;
    const progress = next
      ? Math.min(100, (summary.collectedTowardNextLevel / Math.max(1, next.requiredCollectionCount - summary.currentLevel.requiredCollectionCount)) * 100)
      : 100;
    const patchFile = patch ? getWorkshopPatchArtFileName(patch.id) : null;
    const profileClass = [
      portraitFrame ? `has-frame frame-v-${collectibleVariant(portraitFrame.id)}` : "",
      nameGlow ? `has-glow glow-v-${collectibleVariant(nameGlow.id)}` : "",
      nameFont ? `has-font font-v-${collectibleVariant(nameFont.id)}` : "",
    ].filter(Boolean).join(" ");

    return `
      <section class="workshop-book" aria-labelledby="workshop-book-title">
        <header class="workshop-book-heading">
          <div><span>КОЛЛЕКЦИЯ И ПРОФИЛЬ</span><h3 id="workshop-book-title">Книга мастерской</h3><p>Награды теперь можно надевать, включать и ставить в комнате.</p></div>
          <b>ур. ${summary.workshopLevel}</b>
        </header>
        <div class="workshop-room is-level-${summary.workshopLevel}">
          <img class="workshop-book-art" src="${asset("ui-workshop-book.webp")}" alt="Открытая книга с коллекцией нашивок и рамок" />
          ${summary.workshopLevel >= 2 ? `<i class="workshop-addition addition-lamp" title="Тёплая лампа">✦</i>` : ""}
          ${summary.workshopLevel >= 3 ? `<span class="workshop-addition addition-patch">${patchFile ? `<img src="${asset(patchFile)}" alt="" />` : "◆"}</span>` : ""}
          ${summary.workshopLevel >= 4 ? `<img class="workshop-addition addition-album" src="${asset("ui-season-album.webp")}" alt="" />` : ""}
          ${summary.workshopLevel >= 5 ? `<span class="workshop-addition addition-frame">✦</span>` : ""}
          ${summary.workshopLevel >= 6 ? `<img class="workshop-addition addition-chest" src="${asset("ui-streak-chest.webp")}" alt="" />` : ""}
          ${ornament ? `<span class="workshop-addition addition-equipped-ornament" title="${escapeHtml(ornament.name)}"><b>${this.getOrnamentSymbol(ornament.name)}</b><small>${escapeHtml(collectibleDisplayName(ornament.name))}</small></span>` : ""}
          <strong>${escapeHtml(summary.currentLevel.name)}</strong>
        </div>
        <div class="workshop-progress-copy"><span>${summary.collectedCount}/${summary.totalCollectibleCount} предметов</span><strong>${next ? `До «${next.name}»: ${summary.neededForNextLevel}` : "Мастерская завершена"}</strong></div>
        <div class="workshop-progress" role="progressbar" aria-label="Развитие мастерской" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><span style="width:${progress}%"></span></div>
        <p class="workshop-level-copy">${escapeHtml(summary.currentLevel.description)}</p>

        <article class="workshop-profile ${profileClass}" aria-label="Предпросмотр профиля">
          <div class="workshop-avatar"><img src="${asset("hero-menu-v2.webp")}" alt="" />${patchFile ? `<img class="profile-patch" src="${asset(patchFile)}" alt="" />` : ""}</div>
          <div class="workshop-profile-name"><small>ВАШ ПРОФИЛЬ</small><strong>Мастер Живой нити</strong><span>${title ? escapeHtml(collectibleDisplayName(title.name)) : "Выберите титул в книге"}</span></div>
          <div class="profile-loadout"><span>${portraitFrame ? "Рамка надета" : "Без рамки"}</span><span>${nameGlow ? "Имя светится" : "Без свечения"}</span><span>${nameFont ? "Особый почерк" : "Обычный почерк"}</span></div>
        </article>

        ${this.renderCollectionShelf(collection, PROFILE_COLLECTIBLE_KINDS, "Профиль", "титулы, нашивки, рамки и имя", true)}
        ${this.renderCollectionShelf(collection, NEEDLE_COLLECTIBLE_KINDS, "Игла", "следы, попадания и сияния")}
        ${this.renderCollectionShelf(collection, ["workshop-ornament"], "Комната", "предметы, которые появляются в мастерской")}
      </section>`;
  }

  private renderShop(): string {
    const workshopCollection = this.getWorkshopCollection();
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

    const renderSeasonTrack = (
      tier: (typeof SEASON_PASS_TIERS)[number],
      track: SeasonPassTrack,
      claimed: boolean,
      unlocked: boolean,
      premiumEnabled: boolean,
    ): string => {
      const reward = track === "free" ? tier.freeReward : tier.premiumReward;
      const collectible = getWorkshopCollectible(reward.id);
      if (!collectible) return "";
      const available = unlocked && (track === "free" || premiumEnabled);
      const equipped = workshopCollection.equipped[collectible.kind] === collectible.id;
      const action = claimed
        ? `<button class="${equipped ? "is-equipped" : ""}" data-action="workshop-toggle" data-id="${collectible.id}" aria-pressed="${equipped}">${equipped ? "СНЯТЬ" : collectible.kind === "workshop-ornament" ? "ПОСТАВИТЬ" : collectible.kind.startsWith("needle-") ? "ВКЛЮЧИТЬ" : "НАДЕТЬ"}</button>`
        : `<button data-action="season-claim" data-tier="${tier.tier}" data-track="${track}" ${available ? "" : "disabled"} aria-label="Забрать награду ${reward.name}">${available ? "ЗАБРАТЬ" : track === "premium" && !premiumEnabled ? "ЗАКРЫТО" : `НУЖЕН ${tier.tier} УР.`}</button>`;
      return `
        <div class="season-track ${track === "free" ? "free-track" : "premium-track"} ${premiumEnabled ? "is-enabled" : ""}">
          <span>${track === "free" ? "БЕСПЛАТНО" : "ЗОЛОТАЯ ДОРОЖКА"}</span>
          <div class="season-reward-copy">
            ${this.renderCollectiblePreview(collectible, !available && !claimed)}
            <div><small>${WORKSHOP_KIND_LABELS[collectible.kind]}</small><strong>${reward.name}</strong></div>
          </div>
          <small class="season-reward-description">${reward.description}</small>
          ${action}
        </div>`;
    };

    const seasonTiers = SEASON_PASS_TIERS.map((tier) => {
      const unlocked = tier.tier <= passStatus.unlockedTier;
      const freeClaimed = this.state.seasonPass.claimedFreeTiers.includes(tier.tier);
      const premiumClaimed = this.state.seasonPass.claimedPremiumTiers.includes(tier.tier);
      const premiumEnabled = this.state.seasonPass.prototypePremiumEnabled;
      return `
        <article class="season-tier ${unlocked ? "is-unlocked" : "is-locked"} ${freeClaimed && (premiumClaimed || !premiumEnabled) ? "is-complete" : ""}">
          <div class="season-tier-number"><span>${tier.tier}</span><small>${tier.requiredXp} XP</small></div>
          ${renderSeasonTrack(tier, "free", freeClaimed, unlocked, premiumEnabled)}
          ${renderSeasonTrack(tier, "premium", premiumClaimed, unlocked, premiumEnabled)}
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
      ${this.renderWorkshopBook(workshopCollection)}

      <div class="section-divider shop-divider"><span>Сезонный путь</span><small>долгая коллекция</small></div>
      <section class="season-album" aria-labelledby="season-album-title">
        <header class="season-hero">
          <img src="${asset("ui-season-album.webp")}" alt="" aria-hidden="true" draggable="false" />
          <div><span>СЕЗОН 1 · ЖИВАЯ НИТЬ</span><h3 id="season-album-title">Сезонный альбом</h3><p>20 долгих уровней. Каждую награду видно заранее, а открытую можно сразу использовать.</p></div>
          <b>${passStatus.unlockedTier}/20</b>
        </header>
        <div class="season-xp-copy"><span>Опыт альбома · ${passStatus.xp} XP</span><strong>${passStatus.xpForNextTier === null ? "Альбом завершён" : `До уровня ${passStatus.unlockedTier + 1}: ${passStatus.xpForNextTier - passStatus.xpIntoTier} XP`}</strong></div>
        <div class="season-xp-bar" role="progressbar" aria-label="Опыт сезонного альбома" aria-valuemin="0" aria-valuemax="${passStatus.xpForNextTier ?? 100}" aria-valuenow="${passStatus.xpForNextTier === null ? 100 : passStatus.xpIntoTier}"><span style="width:${passProgress}%"></span></div>
        <div class="season-premium-box ${this.state.seasonPass.prototypePremiumEnabled ? "is-enabled" : ""}">
          <div><span>${this.state.seasonPass.prototypePremiumEnabled ? "ЗОЛОТАЯ ДОРОЖКА ОТКРЫТА" : "ЗОЛОТАЯ ДОРОЖКА"}</span><p>${this.state.seasonPass.prototypePremiumEnabled ? "Все достигнутые премиальные награды можно забирать." : "Редкая долгосрочная цель: 60 игровых пуговиц. Реальных покупок здесь нет."}</p></div>
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
