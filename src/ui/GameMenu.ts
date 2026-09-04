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
  getWorkshopFrameArtFileName,
  getWorkshopCollectionSummary,
  getWorkshopCollectible,
  getWorkshopOrnamentArtFileName,
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

export type UpgradePage = "permanent" | "active" | "passive";
export type QuestPage = "daily" | "weekly" | "chronicle";
export type WorkshopPage = "profile" | "needle" | "room";

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

const UPGRADE_NAMES: Readonly<Record<UpgradeId, { name: string; iconFileName: string }>> = {
  power: { name: "Двойная нить", iconFileName: "upgrade-power.webp" },
  precision: { name: "Точный напёрсток", iconFileName: "upgrade-precision.webp" },
  speed: { name: "Быстрый челнок", iconFileName: "upgrade-speed.webp" },
  ward: { name: "Оберег лоскутницы", iconFileName: "upgrade-ward.webp" },
};

const SKILL_ICON_FILES: Readonly<Record<SkillId, string>> = {
  "steady-hand": "skill-steady-hand.webp",
  "time-seam": "skill-time-seam.webp",
  "guardian-knot": "skill-guardian-knot.webp",
};

export const UPGRADE_PAGE_LABELS: Readonly<Record<UpgradePage, string>> = {
  permanent: "Постоянные",
  active: "Приёмы",
  passive: "Таланты",
};

export const QUEST_PAGE_LABELS: Readonly<Record<QuestPage, string>> = {
  daily: "Сегодня",
  weekly: "Неделя",
  chronicle: "Летопись",
};

export const WORKSHOP_PAGE_LABELS: Readonly<Record<WorkshopPage, string>> = {
  profile: "Профиль",
  needle: "Игла",
  room: "Комната",
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

export const WORKSHOP_PAGE_KINDS: Readonly<
  Record<WorkshopPage, readonly WorkshopCollectibleKind[]>
> = {
  profile: PROFILE_COLLECTIBLE_KINDS,
  needle: NEEDLE_COLLECTIBLE_KINDS,
  room: ["workshop-ornament"],
};

const WARDROBE_TAB_LABELS: Readonly<Record<WorkshopCollectibleKind, string>> = {
  title: "Титулы",
  patch: "Нашивки",
  "portrait-frame": "Рамки",
  "name-glow": "Свечение",
  "name-font": "Почерк",
  "needle-trail": "След",
  "needle-impact": "Попадание",
  "needle-aura": "Сияние",
  "workshop-ornament": "Комната",
};

function collectibleVariant(id: string): number {
  const exactProfileVariants: Readonly<Record<string, number>> = {
    "workshop-glow-warm-thread": 2,
    "workshop-glow-moon-silk": 1,
    "workshop-glow-living-thread": 0,
    "workshop-font-hand-stitch": 2,
    "workshop-font-storybook": 0,
  };
  if (id in exactProfileVariants) return exactProfileVariants[id];
  return Array.from(id).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 5;
}

interface NeedlePreviewPresentation {
  readonly primary: string;
  readonly secondary: string;
  readonly impactMotif: "stitches" | "stars" | "shards" | "lightning" | "petals" | "crown";
  readonly trailMotif: "plain" | "spark" | "lightning";
}

const NEEDLE_PREVIEW_PALETTES: readonly (readonly [string, string])[] = [
  ["#f8f1d9", "#bad9ff"],
  ["#e8b44d", "#ffefad"],
  ["#c768aa", "#f4a7d8"],
  ["#50d7cf", "#a8fff5"],
  ["#a78bfa", "#e4d8ff"],
  ["#ff8d58", "#ffd46c"],
];

function getNeedlePreviewPresentation(id: string): NeedlePreviewPresentation {
  let palette: readonly [string, string];
  if (id.includes("silver") || id.endsWith("free-7")) {
    palette = ["#f8f1d9", "#bad9ff"];
  } else if (id.includes("bone")) {
    palette = ["#d9a968", "#ffe0a3"];
  } else if (id.includes("storm") || id.endsWith("premium-14")) {
    palette = ["#50d7cf", "#a78bfa"];
  } else if (id.includes("sunrise") || id.endsWith("free-17")) {
    palette = ["#ffb83d", "#ffef9a"];
  } else if (id.endsWith("free-14")) {
    palette = ["#9b62c7", "#e09be2"];
  } else if (id.endsWith("premium-8")) {
    palette = ["#e34f91", "#ff9dc5"];
  } else {
    let hash = 0;
    for (let index = 0; index < id.length; index += 1) {
      hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
    }
    palette = NEEDLE_PREVIEW_PALETTES[hash % NEEDLE_PREVIEW_PALETTES.length];
  }

  const impactMotif = id.includes("storm")
    ? "lightning"
    : id.includes("sunrise")
      ? "petals"
      : id.includes("bone")
        ? "shards"
        : id.endsWith("premium-16")
          ? "crown"
          : id.endsWith("premium-4") || id.endsWith("free-17")
            ? "stars"
            : id.endsWith("premium-10")
              ? "shards"
              : "stitches";
  const trailMotif = id.includes("storm") || id.endsWith("premium-14")
    ? "lightning"
    : id.endsWith("premium-2") || id.includes("sunrise")
      ? "spark"
      : "plain";

  return {
    primary: palette[0],
    secondary: palette[1],
    impactMotif,
    trailMotif,
  };
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
  private workshopOpen = false;
  private workshopPage: WorkshopPage = "profile";
  private wardrobeKind: WorkshopCollectibleKind = "patch";
  private upgradePage: UpgradePage = "permanent";
  private questPage: QuestPage = "daily";
  private needlePreviewId: NeedleSkinId;
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
    this.needlePreviewId = initialState.equippedNeedle;
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
    this.workshopOpen = false;
    this.needlePreviewId = state.equippedNeedle;
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
    this.workshopOpen = false;
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
      this.workshopOpen = false;
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
    if (action === "wardrobe-kind") {
      const kind = target.dataset.kind as WorkshopCollectibleKind;
      if (WORKSHOP_COLLECTIBLE_KINDS.includes(kind)) {
        this.wardrobeKind = kind;
        this.render();
        this.root
          .querySelector<HTMLButtonElement>(`[data-action="wardrobe-kind"][data-kind="${kind}"]`)
          ?.focus({ preventScroll: true });
      }
      return;
    }
    if (action === "workshop-open") {
      this.guidePage = null;
      this.leaderboardOpen = false;
      this.profileOpen = false;
      this.wardrobeOpen = false;
      this.workshopOpen = true;
      this.render();
      this.focusWorkshopDialog();
      return;
    }
    if (action === "workshop-close") {
      this.closeWorkshop();
      return;
    }
    if (action === "workshop-page") {
      const page = target.dataset.page as WorkshopPage;
      if (page in WORKSHOP_PAGE_LABELS) {
        this.workshopPage = page;
        this.render();
        this.root
          .querySelector<HTMLButtonElement>(`[data-action="workshop-page"][data-page="${page}"]`)
          ?.focus({ preventScroll: true });
      }
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

    if (action === "upgrade-page") {
      const page = target.dataset.page as UpgradePage;
      if (page in UPGRADE_PAGE_LABELS) {
        this.upgradePage = page;
        this.notice = "";
        this.render();
      }
      return;
    }
    if (action === "quest-page") {
      const page = target.dataset.page as QuestPage;
      if (page in QUEST_PAGE_LABELS) {
        this.questPage = page;
        this.notice = "";
        this.render();
      }
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
      this.needlePreviewId = id;
      this.commit(equipNeedle(this.state, id));
      return;
    }
    if (action === "needle-preview") {
      const id = target.dataset.id as NeedleSkinId;
      if (NEEDLE_SKINS.some((skin) => skin.id === id)) {
        this.needlePreviewId = id;
        this.render();
      }
      return;
    }
    if (action === "random-needle") {
      const previousIds = new Set(this.state.ownedNeedles);
      const next = unlockRandomNeedle(this.state);
      const unlockedId = next.ownedNeedles.find((id) => !previousIds.has(id));
      const unlocked = NEEDLE_SKINS.find((skin) => skin.id === unlockedId);
      if (unlockedId) this.needlePreviewId = unlockedId;
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
    if (action === "workshop-clear") {
      const kind = target.dataset.kind as WorkshopCollectibleKind;
      if (!WORKSHOP_COLLECTIBLE_KINDS.includes(kind)) return;
      const collection = this.getWorkshopCollection();
      this.commit(
        {
          ...this.state,
          workshopCollection: equipWorkshopCollectible(collection, kind, null),
        },
        `${WORKSHOP_KIND_LABELS[kind]}: снято`,
      );
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
    if (
      this.guidePage === null &&
      !this.leaderboardOpen &&
      !this.profileOpen &&
      !this.workshopOpen
    ) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (this.leaderboardOpen) this.closeLeaderboard();
      else if (this.workshopOpen) this.closeWorkshop();
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
        : this.workshopOpen
          ? ".workshop-dialog"
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

  private focusWorkshopDialog(): void {
    this.root
      .querySelector<HTMLElement>(".workshop-dialog")
      ?.focus({ preventScroll: true });
  }

  private closeWorkshop(): void {
    this.workshopOpen = false;
    this.render();
    this.root
      .querySelector<HTMLButtonElement>('[data-action="workshop-open"]')
      ?.focus({ preventScroll: true });
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

  private getPanelKey(): string {
    if (this.tab === "upgrades") return `upgrades:${this.upgradePage}`;
    if (this.tab === "quests") return `quests:${this.questPage}`;
    if (this.tab === "needles") return `needles:${this.needlePreviewId}`;
    return this.tab;
  }

  private render(): void {
    const activeButton = this.root.contains(document.activeElement) && document.activeElement instanceof HTMLButtonElement
      ? document.activeElement
      : null;
    const renderedPanel = this.root.querySelector<HTMLElement>(".menu-panel");
    const previousScrollTop =
      renderedPanel?.dataset.panelKey === this.getPanelKey()
        ? renderedPanel.querySelector<HTMLElement>(".panel-scroll")?.scrollTop
        : undefined;
    const previousProfileDialog = this.root.querySelector<HTMLElement>(
      ".profile-dialog",
    );
    const previousProfileScrollTop =
      previousProfileDialog &&
      previousProfileDialog.classList.contains("is-wardrobe") === this.wardrobeOpen &&
      (!this.wardrobeOpen || previousProfileDialog.dataset.wardrobeKind === this.wardrobeKind)
        ? previousProfileDialog.querySelector<HTMLElement>(".profile-scroll")
            ?.scrollTop
        : undefined;
    const previousWorkshopDialog = this.root.querySelector<HTMLElement>(
      ".workshop-dialog",
    );
    const previousWorkshopScrollTop =
      previousWorkshopDialog?.dataset.workshopPage === this.workshopPage
        ? previousWorkshopDialog.querySelector<HTMLElement>(".workshop-scroll")
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
          kind: activeButton.dataset.kind,
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
    if (previousWorkshopScrollTop !== undefined) {
      const workshopScroll = this.root.querySelector<HTMLElement>(".workshop-scroll");
      if (workshopScroll) workshopScroll.scrollTop = previousWorkshopScrollTop;
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
          button.dataset.page === focusKey.page &&
          button.dataset.kind === focusKey.kind,
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
    const modalIsOpen = guideIsOpen || this.leaderboardOpen || this.profileOpen || this.workshopOpen;
    return `
      <div class="menu-home" ${modalIsOpen ? 'aria-hidden="true" inert' : ""}>
        ${this.renderWorld()}
        <div class="menu-vignette" aria-hidden="true"></div>
        <header class="menu-topbar">
          <button class="round-tool" data-action="fullscreen" aria-label="На весь экран">⛶</button>
          <div class="currency-chip"><img src="${asset("currency-thread-spool.webp")}" alt="" aria-hidden="true" /><strong>${this.state.thread}</strong><small>нити</small></div>
          <div class="currency-chip premium"><img src="${asset("currency-moon-button.webp")}" alt="" aria-hidden="true" /><strong>${this.state.premium}</strong><small>пуговицы</small></div>
          <button class="round-tool" data-action="sound" aria-label="${this.state.muted ? "Включить звук и музыку" : "Выключить звук и музыку"}">${this.state.muted ? "🔇" : "♪"}</button>
        </header>
        <button class="menu-guide-trigger" data-action="guide-open" aria-haspopup="dialog" aria-label="Открыть мини-гайд «Как играть»">
          <span aria-hidden="true">?</span><strong>Как играть</strong>
        </button>
        <button class="menu-leaderboard-trigger" data-action="leaderboard-open" aria-haspopup="dialog" aria-label="Открыть таблицу лидеров">
          <span aria-hidden="true">♛</span><strong>Рейтинг</strong>
        </button>
        <button class="menu-workshop-trigger" data-action="workshop-open" aria-haspopup="dialog" aria-label="Открыть Книгу мастерской">
          <img src="${asset("ui-workshop-book.webp")}" alt="" aria-hidden="true" draggable="false" /><strong>Награды</strong>
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
      ${this.workshopOpen ? this.renderWorkshopDialog() : ""}
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
    const profileFrameFile = profileFrame
      ? getWorkshopFrameArtFileName(profileFrame.id)
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
            ${row.isCurrentUser && profileFrameFile ? `<img class="leaderboard-profile-frame" src="${asset(profileFrameFile)}" alt="" aria-hidden="true" />` : ""}
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
    const frameFile = frame ? getWorkshopFrameArtFileName(frame.id) : null;
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

    const wardrobeItems = WORKSHOP_COLLECTIBLES.filter(
      (item) => item.kind === this.wardrobeKind,
    );
    const wardrobeOwnedCount = wardrobeItems.filter((item) =>
      collection.ownedCollectibleIds.includes(item.id),
    ).length;
    const wardrobeTabs = WORKSHOP_COLLECTIBLE_KINDS.map((kind) => {
      const items = WORKSHOP_COLLECTIBLES.filter((item) => item.kind === kind);
      const ownedCount = items.filter((item) =>
        collection.ownedCollectibleIds.includes(item.id),
      ).length;
      return `<button role="tab" data-action="wardrobe-kind" data-kind="${kind}" class="${this.wardrobeKind === kind ? "is-active" : ""}" aria-selected="${this.wardrobeKind === kind}"><span>${WARDROBE_TAB_LABELS[kind]}</span><small>${ownedCount}/${items.length}</small></button>`;
    }).join("");
    const wardrobeCards = wardrobeItems.map((item) => {
      const owned = collection.ownedCollectibleIds.includes(item.id);
      const equipped = collection.equipped[item.kind] === item.id;
      return `
        <article class="wardrobe-tile rarity-${item.rarity} ${owned ? "" : "is-locked"} ${equipped ? "is-equipped" : ""}">
          ${this.renderCollectiblePreview(item, !owned)}
          <div class="wardrobe-tile-copy">
            <small>${owned ? WORKSHOP_KIND_LABELS[item.kind] : "ЗАКРЫТО"}</small>
            <strong>${escapeHtml(collectibleDisplayName(item.name))}</strong>
            <p>${escapeHtml(item.description)}</p>
            <em>${escapeHtml(this.getCollectibleAcquisition(item))}</em>
          </div>
          ${owned
            ? this.renderWorkshopToggle(item, collection)
            : `<button class="collectible-toggle is-locked" disabled>ПОКА ЗАКРЫТО</button>`}
          ${equipped ? `<span class="wardrobe-equipped">НАДЕТО</span>` : ""}
        </article>`;
    }).join("");
    const livePreview = `
      <article class="wardrobe-live-preview workshop-profile ${profileClass}">
        <div class="workshop-avatar">${avatar}${patchFile ? `<img class="profile-patch" src="${asset(patchFile)}" alt="" />` : ""}${frameFile ? `<img class="profile-frame-art" src="${asset(frameFile)}" alt="" />` : ""}</div>
        <div class="workshop-profile-name"><small>ТАК БУДЕТ В ИГРЕ</small><strong>${escapeHtml(fullName)}</strong><span>${title ? escapeHtml(collectibleDisplayName(title.name)) : "Без титула"}</span></div>
        <p>Выбранный эффект показан прямо на портрете. Нажми карточку ниже, чтобы сразу сравнить результат.</p>
      </article>`;

    return `
      <div class="guide-layer profile-layer">
        <div class="guide-scrim" aria-hidden="true"></div>
        <section class="profile-dialog ${this.wardrobeOpen ? "is-wardrobe" : ""}" data-wardrobe-kind="${this.wardrobeKind}" role="dialog" aria-modal="true" aria-labelledby="profile-title" tabindex="-1">
          <button class="guide-close" data-action="profile-close" aria-label="Закрыть профиль">×</button>
          <header class="profile-heading">
            <span>${this.wardrobeOpen ? "КОЛЛЕКЦИЯ ОБРАЗОВ" : "КАРТОЧКА МАСТЕРА"}</span>
            <h2 id="profile-title">${this.wardrobeOpen ? "Гардероб" : "Профиль"}</h2>
            <p>${this.wardrobeOpen ? "Все награды видны заранее — вместе с путём получения." : "Личный образ пока хранится на этом устройстве."}</p>
          </header>
          ${this.wardrobeOpen ? `<nav class="wardrobe-tabs" role="tablist" aria-label="Категории гардероба">${wardrobeTabs}</nav>` : ""}
          <div class="profile-scroll">
            ${this.wardrobeOpen
              ? `${livePreview}
                <section class="wardrobe-current-group" aria-labelledby="wardrobe-current-title">
                  <header><div><span>КАТЕГОРИЯ</span><h3 id="wardrobe-current-title">${WARDROBE_TAB_LABELS[this.wardrobeKind]}</h3></div><strong>${wardrobeOwnedCount}/${wardrobeItems.length}</strong></header>
                  <div class="wardrobe-grid">
                    <article class="wardrobe-tile is-empty ${collection.equipped[this.wardrobeKind] === null ? "is-equipped" : ""}">
                      <span class="collectible-preview is-empty" aria-hidden="true">×</span>
                      <div class="wardrobe-tile-copy"><small>БЕЗ ЭФФЕКТА</small><strong>Обычный вид</strong><p>Снять выбранную награду этой категории.</p></div>
                      <button class="collectible-toggle" data-action="workshop-clear" data-kind="${this.wardrobeKind}" ${collection.equipped[this.wardrobeKind] === null ? "disabled" : ""}>${collection.equipped[this.wardrobeKind] === null ? "ВЫБРАНО" : "СНЯТЬ"}</button>
                    </article>
                    ${wardrobeCards}
                  </div>
                </section>`
              : `<article class="profile-showcase workshop-profile ${profileClass}">
                  <div class="workshop-avatar">${avatar}${patchFile ? `<img class="profile-patch" src="${asset(patchFile)}" alt="" />` : ""}${frameFile ? `<img class="profile-frame-art" src="${asset(frameFile)}" alt="" />` : ""}</div>
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

  private renderWorkshopDialog(): string {
    const collection = this.getWorkshopCollection();
    const summary = getWorkshopCollectionSummary(collection);
    const pageKinds = WORKSHOP_PAGE_KINDS[this.workshopPage];
    const pageItems = WORKSHOP_COLLECTIBLES.filter((item) =>
      pageKinds.includes(item.kind),
    );
    const ownedCount = pageItems.filter((item) =>
      collection.ownedCollectibleIds.includes(item.id),
    ).length;
    const ornament = getEquippedWorkshopCollectible(
      collection,
      "workshop-ornament",
    );
    const ornamentFile = ornament
      ? getWorkshopOrnamentArtFileName(ornament.id)
      : null;
    const next = summary.nextLevel;
    const progress = next
      ? Math.min(
          100,
          (summary.collectedTowardNextLevel /
            Math.max(
              1,
              next.requiredCollectionCount -
                summary.currentLevel.requiredCollectionCount,
            )) *
            100,
        )
      : 100;
    const tabs = (Object.keys(WORKSHOP_PAGE_LABELS) as WorkshopPage[])
      .map((page) => {
        const kinds = WORKSHOP_PAGE_KINDS[page];
        const all = WORKSHOP_COLLECTIBLES.filter((item) =>
          kinds.includes(item.kind),
        );
        const owned = all.filter((item) =>
          collection.ownedCollectibleIds.includes(item.id),
        ).length;
        return `<button role="tab" data-action="workshop-page" data-page="${page}" class="${this.workshopPage === page ? "is-active" : ""}" aria-selected="${this.workshopPage === page}"><span>${WORKSHOP_PAGE_LABELS[page]}</span><small>${owned}/${all.length}</small></button>`;
      })
      .join("");
    const cards = pageItems
      .map((item) => {
        const owned = collection.ownedCollectibleIds.includes(item.id);
        const equipped = collection.equipped[item.kind] === item.id;
        return `
          <article class="workshop-reward-card rarity-${item.rarity} ${owned ? "" : "is-locked"} ${equipped ? "is-equipped" : ""}">
            ${this.renderCollectiblePreview(item, !owned)}
            <div><small>${owned ? WORKSHOP_KIND_LABELS[item.kind] : "ГДЕ НАЙТИ"}</small><strong>${escapeHtml(collectibleDisplayName(item.name))}</strong><p>${owned ? escapeHtml(item.description) : escapeHtml(this.getCollectibleAcquisition(item))}</p></div>
            ${owned
              ? this.renderWorkshopToggle(item, collection)
              : `<button class="collectible-toggle is-locked" disabled>ЗАКРЫТО</button>`}
            ${equipped ? `<span class="workshop-reward-equipped">ИСПОЛЬЗУЕТСЯ</span>` : ""}
          </article>`;
      })
      .join("");

    return `
      <div class="guide-layer workshop-layer">
        <div class="guide-scrim" aria-hidden="true"></div>
        <section class="workshop-dialog" data-workshop-page="${this.workshopPage}" role="dialog" aria-modal="true" aria-labelledby="workshop-dialog-title" tabindex="-1">
          <button class="guide-close" data-action="workshop-close" aria-label="Закрыть Книгу мастерской">×</button>
          <header class="workshop-dialog-heading">
            <div><span>КОЛЛЕКЦИЯ НАГРАД</span><h2 id="workshop-dialog-title">Книга мастерской</h2><p>Открой страницу и выбери награду — результат сразу появится в игре.</p></div>
            <b>УР. ${summary.workshopLevel}</b>
          </header>
          <nav class="workshop-page-tabs" role="tablist" aria-label="Страницы Книги мастерской">${tabs}</nav>
          <div class="workshop-scroll">
            <section class="workshop-book-overview">
              <div class="workshop-book-visual">
                <img src="${asset("ui-workshop-book.webp")}" alt="Открытая Книга мастерской" draggable="false" />
                ${ornamentFile ? `<img class="workshop-selected-ornament" src="${asset(ornamentFile)}" alt="${escapeHtml(ornament?.name ?? "")}" />` : ""}
                <strong>${escapeHtml(summary.currentLevel.name)}</strong>
              </div>
              <div class="workshop-book-status">
                <span>${summary.collectedCount}/${summary.totalCollectibleCount} наград собрано</span>
                <strong>${next ? `До «${escapeHtml(next.name)}»: ${summary.neededForNextLevel}` : "Книга заполнена"}</strong>
                <div class="workshop-progress" role="progressbar" aria-label="Развитие мастерской" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><span style="width:${progress}%"></span></div>
                <p>${escapeHtml(summary.currentLevel.description)}</p>
              </div>
            </section>
            <header class="workshop-page-copy"><div><span>СТРАНИЦА</span><h3>${WORKSHOP_PAGE_LABELS[this.workshopPage]}</h3></div><strong>${ownedCount}/${pageItems.length}</strong></header>
            <div class="workshop-reward-grid">${cards}</div>
          </div>
          <footer class="workshop-dialog-footer"><span>Открытые награды сохраняются автоматически.</span><button data-action="workshop-close">ГОТОВО</button></footer>
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
        <div class="currency-chip"><img src="${asset("currency-thread-spool.webp")}" alt="" aria-hidden="true" /><strong>${this.state.thread}</strong><small>нити</small></div>
        <div class="currency-chip premium"><img src="${asset("currency-moon-button.webp")}" alt="" aria-hidden="true" /><strong>${this.state.premium}</strong><small>пуговицы</small></div>
      </header>
      <section class="menu-panel" data-menu-tab="${tab}" data-panel-key="${this.getPanelKey()}" aria-label="${TAB_LABELS[tab].label}">
        <header class="panel-heading">
          <img class="panel-tab-icon" src="${asset(TAB_LABELS[tab].iconFileName)}" width="38" height="38" alt="" aria-hidden="true" draggable="false" />
          <h2>${TAB_LABELS[tab].label}</h2>
          <button data-action="home" aria-label="Закрыть">×</button>
      </header>
      ${this.notice ? `<div class="panel-notice" role="status" aria-live="polite">${this.notice}</div>` : ""}
        ${this.renderPanelTabs(tab)}
        <div class="panel-scroll">${this.renderTabContent(tab)}</div>
      </section>
      ${this.renderNav()}
    `;
  }

  private renderPanelTabs(tab: Exclude<MenuTab, "home">): string {
    if (tab === "upgrades") {
      return `<nav class="panel-tabs" role="tablist" aria-label="Виды усилений">${(
        Object.keys(UPGRADE_PAGE_LABELS) as UpgradePage[]
      ).map((page) => `<button role="tab" data-action="upgrade-page" data-page="${page}" class="${this.upgradePage === page ? "is-active" : ""}" aria-selected="${this.upgradePage === page}">${UPGRADE_PAGE_LABELS[page]}</button>`).join("")}</nav>`;
    }
    if (tab === "quests") {
      return `<nav class="panel-tabs" role="tablist" aria-label="Виды поручений">${(
        Object.keys(QUEST_PAGE_LABELS) as QuestPage[]
      ).map((page) => `<button role="tab" data-action="quest-page" data-page="${page}" class="${this.questPage === page ? "is-active" : ""}" aria-selected="${this.questPage === page}">${QUEST_PAGE_LABELS[page]}</button>`).join("")}</nav>`;
    }
    return "";
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
          <div class="item-symbol upgrade-emblem has-icon" aria-hidden="true"><img src="${asset(UPGRADE_NAMES[id].iconFileName)}" alt="" draggable="false" /></div>
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
          <div class="item-symbol ability-emblem has-icon" aria-hidden="true"><img src="${asset(ability.iconFileName)}" alt="" draggable="false" /></div>
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
          <div class="item-symbol skill-emblem has-icon" aria-hidden="true"><img src="${asset(SKILL_ICON_FILES[skill.id])}" alt="" draggable="false" /></div>
          <div class="item-copy">
            <div class="card-kicker"><span>Боевой навык</span><strong>${equipped ? "активен" : unlocked ? "открыт" : `этап ${skill.unlockStage}`}</strong></div>
            <h3>${skill.name}</h3><p>${skill.description}</p>
          </div>
          <button class="select-button card-action" data-action="skill" data-id="${skill.id}" aria-pressed="${equipped}" ${!unlocked || equipped ? "disabled" : ""}>
            <span>${equipped ? "ВЫБРАН" : unlocked ? "ВЫБРАТЬ" : `ЭТАП ${skill.unlockStage}`}</span><small>${equipped ? "АКТИВЕН" : unlocked ? "НАВЫК" : "ЗАКРЫТО"}</small>
          </button>
        </article>`;
    }).join("");

    const pageCopy: Readonly<Record<UpgradePage, readonly [string, string]>> = {
      permanent: ["Постоянные усиления", "Вкладывай нити в силу, точность, скорость и защиту."],
      active: ["Боевые приёмы", "Выбери один круглый приём для рейда: одно видео — одно применение за поход."],
      passive: ["Пассивные таланты", "Одновременно действует один талант, открытый этапами пути."],
    };
    const pageContent: Readonly<Record<UpgradePage, string>> = {
      permanent: `<div class="compact-card-grid upgrade-stack">${upgrades}</div>`,
      active: `<div class="compact-card-grid ability-stack">${activeAbilities}</div>`,
      passive: `<div class="compact-card-grid skill-stack">${skills}</div>`,
    };
    return `
      <div class="panel-intro panel-intro-upgrades is-compact">
        <img class="panel-intro-icon" src="${asset(this.upgradePage === "permanent" ? "upgrade-power.webp" : this.upgradePage === "active" ? "ability-time-loop.webp" : "skill-steady-hand.webp")}" alt="" aria-hidden="true" />
        <div><strong>${pageCopy[this.upgradePage][0]}</strong><p>${pageCopy[this.upgradePage][1]}</p></div>
      </div>
      ${pageContent[this.upgradePage]}`;
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

    const dailyContent = `
      <section class="daily-board" aria-labelledby="daily-board-title">
        <header class="meta-section-heading">
          <div><span>ОБНОВЛЯЕТСЯ ЕЖЕДНЕВНО</span><h3 id="daily-board-title">Сегодняшние поручения</h3></div>
          <button class="reroll-button" data-action="daily-refresh" ${!canRefreshDaily ? "disabled" : ""} aria-label="${canRefreshDaily ? "Заменить все ежедневные поручения один раз за день" : "Замена ежедневных поручений сегодня недоступна"}"><span>${canRefreshDaily ? "↻" : "✓"}</span> ${canRefreshDaily ? "ЗАМЕНИТЬ" : "ИСПОЛЬЗОВАНО"}</button>
        </header>
        <div class="daily-summary"><span>${dailyClaimed}/3 получено</span><strong>${dailyReady ? `${dailyReady} ${dailyReady === 1 ? "награда ждёт" : "награды ждут"}` : "Продолжай рейд"}</strong></div>
        <div class="card-stack daily-stack">${dailyQuests}</div>
      </section>
      <section class="streak-card ${streak.pendingChests.length ? "has-reward" : ""}" aria-labelledby="streak-title">
        <div class="streak-chest-visual ${streak.pendingChests.length ? "is-ready" : ""}" role="img" aria-label="${streak.pendingChests.length ? "Открывающийся сундук с наградой" : "Закрытый сундук серии побед"}">
          ${[1, 2, 3].map((frame) => `<img class="streak-chest-frame frame-${frame}" src="${asset(`ui-streak-chest-frame-${frame}.webp`)}" alt="" aria-hidden="true" draggable="false" />`).join("")}
        </div>
        <div class="streak-copy">
          <span>КАК РАБОТАЕТ СУНДУК</span><h3 id="streak-title">${streak.current} побед подряд · рекорд ${streak.best}</h3>
          <p>${streak.pendingChests.length ? "Награда уже заработана и не пропадёт: нажми кнопку сундука ниже." : `Побеждай без поражений. Каждая 5-я победа даёт сундук, каждая 10-я — большой. До следующего осталось ${nextMilestone - streak.current}.`}</p>
          <ol class="streak-steps" aria-label="Пять шагов до сундука">${Array.from({ length: 5 }, (_, index) => `<li class="${index < streakStep ? "is-done" : index === streakStep ? "is-next" : ""}">${index + 1}</li>`).join("")}</ol>
          <div class="streak-rules"><span>✓ Уже заработанный сундук остаётся</span><span>× Поражение сбрасывает только текущую серию</span></div>
          ${pendingChests ? `<div class="streak-actions">${pendingChests}</div>` : `<small class="streak-next">Следующая награда на отметке ${nextMilestone}</small>`}
        </div>
      </section>`;

    const weeklyContent = `
      <section class="weekly-route-card" aria-labelledby="weekly-route-title">
        <div class="weekly-art"><img src="${asset("ui-weekly-route-map.webp")}" alt="" aria-hidden="true" draggable="false" /></div>
        <div class="weekly-copy"><span>МАРШРУТ НЕДЕЛИ · ${route.weekId}</span><h3 id="weekly-route-title">${routeStatus.nextNode.name}</h3><p><strong>${currentModifier.name}:</strong> ${currentModifier.description}</p></div>
        <ol class="weekly-nodes" aria-label="Пять узлов недельного маршрута">${routeNodes}</ol>
        <div class="weekly-reward"><span>Финальная награда</span><strong>${route.finalReward.name}</strong></div>
        <div class="weekly-actions">
          <button class="route-button" data-action="weekly-start" ${routeStatus.canClaimFinalReward ? "disabled" : ""}><span>${routeStatus.canClaimFinalReward ? "МАРШРУТ ЗАВЕРШЁН" : routeStatus.completedNodesThisLap === 0 ? "НАЧАТЬ ПУТЬ" : "ИГРАТЬ СЛЕДУЮЩИЙ УЗЕЛ"}</span><small>${routeStatus.canClaimFinalReward ? "ЗАБЕРИ ЭМБЛЕМУ" : `${routeStatus.nextNode.order}/5 · ${currentModifier.name}`}</small></button>
          <button class="route-claim-button" data-action="weekly-claim" ${!routeStatus.canClaimFinalReward ? "disabled" : ""}><span>${routeProgress.finalRewardClaimed ? "ПОЛУЧЕНО" : "ЗАБРАТЬ ФИНАЛ"}</span><small>${routeProgress.finalRewardClaimed ? "ЭМБЛЕМА В КОЛЛЕКЦИИ" : "ПОСЛЕ 5 УЗЛОВ"}</small></button>
        </div>
      </section>`;

    const chronicleContent = `
      <div class="permanent-summary"><span>Получено наград</span><strong>${claimedCount}/${QUESTS.length}</strong></div>
      <div class="card-stack quest-stack permanent-quest-stack">${quests}</div>`;
    const pageContent: Readonly<Record<QuestPage, string>> = {
      daily: dailyContent,
      weekly: weeklyContent,
      chronicle: chronicleContent,
    };
    const pageCopy: Readonly<Record<QuestPage, readonly [string, string]>> = {
      daily: ["Сегодня и серия", "Три поручения на день и понятный путь к сундуку за победы подряд."],
      weekly: ["Маршрут недели", "Пять узлов с особым правилом и финальной эмблемой."],
      chronicle: ["Летопись мастерской", "Постоянные достижения не исчезают и не сбрасываются."],
    };
    return `
      <div class="panel-intro panel-intro-quests is-compact">
        <span class="panel-intro-emblem" aria-hidden="true">${this.questPage === "weekly" ? "⌁" : this.questPage === "chronicle" ? "♛" : "✓"}</span>
        <div><strong>${pageCopy[this.questPage][0]}</strong><p>${pageCopy[this.questPage][1]}</p></div>
        <b>◈ ${this.state.cosmeticFragments}</b>
      </div>
      ${pageContent[this.questPage]}`;
  }

  private renderNeedles(): string {
    const unlockCost = getRandomNeedleUnlockCost(this.state);
    const canUnlock = unlockCost !== null && this.state.thread >= unlockCost;
    const ownedCount = this.state.ownedNeedles.length;
    const selected =
      NEEDLE_SKINS.find((skin) => skin.id === this.needlePreviewId) ??
      NEEDLE_SKINS[0];
    const selectedOwned = this.state.ownedNeedles.includes(selected.id);
    const selectedEquipped = this.state.equippedNeedle === selected.id;
    const selectedMastery = getNeedleMasterySummary(
      this.state.needleMastery,
      selected.id,
    );
    const selectedRewards = NEEDLE_MASTERY_REWARDS.filter(
      (reward) => reward.needleId === selected.id,
    );
    const nextReward = selectedRewards.find(
      (reward) => reward.requiredLevel > selectedMastery.level,
    );
    const masteryPercent = selectedMastery.nextLevelXp === null
      ? 100
      : Math.min(
          100,
          (selectedMastery.currentLevelXp / selectedMastery.nextLevelXp) * 100,
        );
    const draw = `
      <article class="needle-draw is-compact">
        <div class="draw-emblem" aria-hidden="true"><span>?</span></div>
        <div class="draw-copy"><span>Тайный футляр</span><h3>${unlockCost === null ? "Коллекция собрана" : "Случайная новая игла"}</h3><p>${unlockCost === null ? "Все иглы уже открыты." : "Какая именно выпадет — станет известно после открытия."}</p></div>
        <button class="buy-button card-action" data-action="random-needle" ${!canUnlock ? "disabled" : ""} aria-label="${unlockCost === null ? "Все иглы уже открыты" : `Открыть случайную иглу за ${unlockCost} нитей`}">
          <span>${unlockCost === null ? "ГОТОВО" : "ОТКРЫТЬ"}</span><small>${unlockCost === null ? "СОБРАНО" : `✦ ${unlockCost}`}</small>
        </button>
      </article>`;

    const tiles = NEEDLE_SKINS.map((skin) => {
      const owned = this.state.ownedNeedles.includes(skin.id);
      const equipped = this.state.equippedNeedle === skin.id;
      const selectedTile = selected.id === skin.id;
      const mastery = getNeedleMasterySummary(this.state.needleMastery, skin.id);
      return `
        <button class="needle-tile ${owned ? "" : "is-locked"} ${equipped ? "is-equipped" : ""} ${selectedTile ? "is-selected" : ""}" data-action="needle-preview" data-id="${skin.id}" aria-pressed="${selectedTile}" aria-label="${owned ? `Показать ${skin.name}, мастерство ${mastery.level}` : "Показать закрытую иглу"}">
          <span class="needle-tile-art"><img src="${asset(skin.iconFileName)}" alt="" aria-hidden="true" draggable="false" />${owned ? "" : `<i aria-hidden="true">?</i>`}</span>
          <span class="needle-tile-copy"><strong>${owned ? skin.name : "Неизвестная игла"}</strong><small>${equipped ? "В КОЛЧАНЕ" : owned ? `МАСТЕРСТВО ${mastery.level}` : "ЗАКРЫТА"}</small></span>
        </button>`;
    }).join("");

    return `
      <div class="panel-intro panel-intro-needles is-compact">
        <img class="panel-intro-icon" src="${asset(selected.iconFileName)}" alt="" aria-hidden="true" />
        <div><strong>Иглы в футляре</strong><p>Квадратные карточки показывают коллекцию. Нажми иглу, чтобы увидеть свойство и награды мастерства.</p></div>
        <b>${ownedCount}/${NEEDLE_SKINS.length}</b>
      </div>
      ${draw}
      <div class="needle-grid" aria-label="Коллекция игл">${tiles}</div>
      <article class="needle-feature ${selectedOwned ? "" : "is-locked"} ${selectedEquipped ? "is-equipped" : ""}">
        <div class="needle-feature-art"><img src="${asset(selected.iconFileName)}" alt="" aria-hidden="true" draggable="false" />${selectedOwned ? "" : `<span aria-hidden="true">?</span>`}</div>
        <div class="needle-feature-copy">
          <div class="card-kicker"><span>${selectedEquipped ? "В колчане" : selectedOwned ? "Открыта" : "Закрыта"}</span><strong>${selectedOwned ? `ур. ${selectedMastery.level}/${MAX_NEEDLE_MASTERY_LEVEL}` : "???"}</strong></div>
          <h3>${selectedOwned ? selected.name : "Неизвестная игла"}</h3>
          <strong>${selectedOwned ? selected.subtitle : "Скрыта в тайном футляре"}</strong>
          <p>${selectedOwned ? selected.description : "Открой футляр — облик и боевое свойство станут видны."}</p>
          ${selectedOwned ? `<div class="mastery-line"><span>Опыт мастерства <b>${selectedMastery.nextLevelXp === null ? "МАКС" : `${selectedMastery.currentLevelXp}/${selectedMastery.nextLevelXp}`}</b></span><div role="progressbar" aria-label="Мастерство иглы ${selected.name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(masteryPercent)}"><i style="width:${masteryPercent}%"></i></div></div>
          <div class="mastery-rewards is-detailed" aria-label="Косметические награды мастерства">${selectedRewards.map((reward) => `<span class="${reward.requiredLevel <= selectedMastery.level ? "is-unlocked" : ""}" title="Уровень ${reward.requiredLevel}: ${reward.name}">${MASTERY_REWARD_SYMBOLS[reward.kind]}<small>${reward.requiredLevel}</small></span>`).join("")}</div>
          <small class="mastery-next">${nextReward ? `Следующая награда: ${nextReward.name} · уровень ${nextReward.requiredLevel}` : "Все эффекты мастерства открыты"}</small>` : ""}
        </div>
        <button class="select-button needle-feature-action" data-action="needle" data-id="${selected.id}" aria-pressed="${selectedEquipped}" ${!selectedOwned || selectedEquipped ? "disabled" : ""}><span>${selectedEquipped ? "В КОЛЧАНЕ" : selectedOwned ? "ВЫБРАТЬ" : "ЗАКРЫТО"}</span><small>${selectedEquipped ? "АКТИВНА" : selectedOwned ? "СМЕНИТЬ" : "НУЖЕН ФУТЛЯР"}</small></button>
      </article>`;
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
    const frameFile = getWorkshopFrameArtFileName(collectible.id);
    const ornamentFile = getWorkshopOrnamentArtFileName(collectible.id);
    const variant = collectibleVariant(collectible.id);
    const stateClass = locked ? " is-locked" : "";
    if (patchFile) {
      return `<span class="collectible-preview is-patch v-${variant}${stateClass}"><img src="${asset(patchFile)}" alt="" aria-hidden="true" draggable="false" /></span>`;
    }
    if (frameFile) {
      return `<span class="collectible-preview is-portrait-frame v-${variant}${stateClass}" aria-hidden="true"><span class="preview-avatar"><img src="${asset("hero-elya.webp")}" alt="" draggable="false" /><img class="preview-frame-art" src="${asset(frameFile)}" alt="" draggable="false" /></span></span>`;
    }
    if (ornamentFile) {
      return `<span class="collectible-preview is-workshop-ornament v-${variant}${stateClass}" aria-hidden="true"><img src="${asset(ornamentFile)}" alt="" draggable="false" /></span>`;
    }

    const previewNeedle = NEEDLE_SKINS.find((needle) =>
      collectible.id.startsWith(`${needle.id}-`),
    ) ?? NEEDLE_SKINS.find((needle) => needle.id === this.state.equippedNeedle) ?? NEEDLE_SKINS[0];
    const needlePresentation = collectible.kind.startsWith("needle-")
      ? getNeedlePreviewPresentation(collectible.id)
      : null;
    const previewStyle = needlePresentation
      ? ` style="--preview-primary:${needlePresentation.primary};--preview-secondary:${needlePresentation.secondary}"`
      : "";
    const needlePreviewClass = needlePresentation
      ? ` has-cosmetic-palette motif-${collectible.kind === "needle-impact" ? needlePresentation.impactMotif : needlePresentation.trailMotif}`
      : "";
    const impactSymbols: Readonly<Record<NeedlePreviewPresentation["impactMotif"], string>> = {
      stitches: "×",
      stars: "✦",
      shards: "◆",
      lightning: "ϟ",
      petals: "✤",
      crown: "♛",
    };

    const contents: Readonly<Record<WorkshopCollectibleKind, string>> = {
      title: `<b class="preview-title">${escapeHtml(collectibleDisplayName(collectible.name))}</b><i>✦</i>`,
      patch: `<b>◆</b>`,
      "portrait-frame": `<i class="portrait-dot">✦</i>`,
      "name-glow": `<b class="preview-name">Эля</b><i>✧</i>`,
      "name-font": `<b class="preview-name">Эля</b>`,
      "needle-trail": `<img class="preview-needle-art" src="${asset(previewNeedle.iconFileName)}" alt="" /><i class="preview-thread"></i><i class="preview-trail-accent">${needlePresentation?.trailMotif === "lightning" ? "ϟ" : needlePresentation?.trailMotif === "spark" ? "✦" : "·"}</i>`,
      "needle-impact": `<b class="preview-impact-motif">${impactSymbols[needlePresentation?.impactMotif ?? "stitches"]}</b><i>·</i><i>✧</i>`,
      "needle-aura": `<img class="preview-needle-art" src="${asset(previewNeedle.iconFileName)}" alt="" /><i class="preview-aura"></i><i class="preview-aura-orbit"></i>`,
      "workshop-ornament": `<b>${this.getOrnamentSymbol(collectible.name)}</b>`,
    };
    return `<span class="collectible-preview is-${collectible.kind} v-${variant}${needlePreviewClass}${stateClass}"${previewStyle} aria-hidden="true">${contents[collectible.kind]}</span>`;
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
