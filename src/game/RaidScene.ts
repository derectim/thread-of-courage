import Phaser from "phaser";

import SoundEngine from "../audio/SoundEngine";
import type {
  PlatformAdapter,
  RewardedAdResult,
} from "../platform/PlatformAdapter";
import GameMenu from "../ui/GameMenu";
import StoryIntro, {
  type StoryIntroMode,
  type StoryIntroResult,
} from "../ui/StoryIntro";
import { getStageReward } from "./Economy";
import {
  MAX_UPGRADE_LEVEL,
  UPGRADE_DEFINITIONS,
  UPGRADE_IDS,
  getUpgradeCost,
  getDailySelectionContext,
  load as loadProgression,
  purchaseUpgrade,
  recordChallengeVictory,
  recordShot,
  recordVictory,
  resetCampaignAfterDefeat,
  save as saveProgression,
  type ProgressionState,
  type UpgradeId,
  type UpgradeLevel,
} from "./ProgressionStore";
import {
  MONSTERS,
  PATTERN_NAMES,
  ROOMS,
  getExpeditionNumber,
  getFirstCampaignStageForMonster,
  getMonsterForStage,
  getMovementPatternForProgress,
  getRequiredHits,
  getRoomForStage,
  type MonsterDefinition,
  type MovementPattern,
  type RoomDefinition,
} from "./content";
import {
  getMonsterDamageReactionProfile,
  type MonsterDamageReactionProfile,
} from "./MonsterDamageReactions";
import { recordDailyGameplayEvent } from "./DailySystems";
import { isAngleBlocked, normalizeAngle } from "./geometry";
import {
  HERO_CROSSBOW_FRAMES,
  getHeroNeedleLayout,
  getHeroXForVerticalLaunch,
} from "./heroAnimation";
import { getAlphaSurfaceRadius, type AlphaMask } from "./silhouette";
import { isSentinelHelmetHit } from "./sentinelArmor";
import {
  NEEDLE_ART_TIP_Y,
  getAttachedNeedleRotation,
  getNeedleArtSize,
} from "./needleVisual";
import {
  getNextStageTip,
  getRaidStartStage,
  resolveVictoryChoice,
  type VictoryChoice,
} from "./raidFlow";
import {
  ACTIVE_ABILITIES,
  TIME_LOOP_SPEED_MULTIPLIER,
  activateAbility,
  canActivateAbility,
  consumeMagneticStitch,
  consumeSpareKnot,
  createActiveAbilityRuntime,
  findMagneticHitAngle,
  getActiveAbility,
  getCooldownRemaining,
  getRoomEffectState,
  normalizeActiveAbilityId,
  type ActiveAbilityId,
  type ActiveAbilityRuntime,
  type RoomEffectState,
} from "./ActiveAbilities";
import {
  recordNeedleMasteryHit,
  recordNeedleMasteryVictory,
  type NeedleMasteryVictoryKind,
} from "./NeedleMastery";
import {
  getNeedleImpactVfxProfile,
  type NeedleImpactVfxProfile,
} from "./NeedleImpactEffects";
import {
  WORKSHOP_IMPACT_ART,
  getWorkshopCollectible,
  getWorkshopImpactArtFileName,
  type WorkshopCollectible,
  type WorkshopCollectibleKind,
} from "./WorkshopCollection";
import { recordSeasonPassEvent } from "./SeasonPass";
import { getStageRotationSpeed } from "./StagePacing";
import {
  createLeaderboardViewModel,
  type LeaderboardViewModel,
} from "./Leaderboard";
import {
  beginRewardedAbilityRequest,
  createRewardedAbilityRunState,
  finishRewardedAbilityRequest,
  recordLoss,
  type RewardedAbilityRunState,
} from "./AdRules";
import {
  completeWeeklyRouteNode,
  createWeeklyRoute,
  getWeeklyModifier,
  getWeeklyRouteStatus,
  syncWeeklyRouteProgress,
  type WeeklyModifierDefinition,
  type WeeklyRouteDefinition,
  type WeeklyRouteNode,
} from "./WeeklyRoute";
import {
  BACKGROUNDS,
  NEEDLE_SKINS,
  getBackground,
  getNeedleSkin,
  getSkill,
} from "./meta";

const WIDTH = 432;
const HEIGHT = 768;
const MONSTER_X = WIDTH / 2;
const MONSTER_Y = 290;
const MONSTER_RADIUS = 78;
const WORLD_HIT_ANGLE = Math.PI / 2;
const BASE_NEEDLE_GAP = 0.085;
const BASE_PROJECTILE_DURATION = 175;
const HERO_ART_SIZE = 278;
const HERO_RELEASE_FRAME_INDEX = 2;

type NeedleCosmeticKind = Extract<
  WorkshopCollectibleKind,
  "needle-trail" | "needle-impact" | "needle-aura"
>;

function getActiveAbilityTextureKey(id: ActiveAbilityId): string {
  return `ability-${id}`;
}

function getWorkshopImpactTextureKey(fileName: string): string {
  return `workshop-impact-${fileName}`;
}

interface NeedleCosmeticPalette {
  readonly primary: number;
  readonly secondary: number;
}

type NeedleImpactMotif =
  | "stitches"
  | "stars"
  | "shards"
  | "lightning"
  | "petals"
  | "crown";

const NEEDLE_COSMETIC_PALETTES: readonly NeedleCosmeticPalette[] = [
  { primary: 0xf8f1d9, secondary: 0xbad9ff },
  { primary: 0xe8b44d, secondary: 0xffefad },
  { primary: 0xc768aa, secondary: 0xf4a7d8 },
  { primary: 0x50d7cf, secondary: 0xa8fff5 },
  { primary: 0xa78bfa, secondary: 0xe4d8ff },
  { primary: 0xff8d58, secondary: 0xffd46c },
] as const;

function getNeedleCosmeticPalette(id: string): NeedleCosmeticPalette {
  if (id.includes("silver") || id.endsWith("free-7")) {
    return { primary: 0xf8f1d9, secondary: 0xbad9ff };
  }
  if (id.includes("bone")) {
    return { primary: 0xd9a968, secondary: 0xffe0a3 };
  }
  if (id.includes("storm") || id.endsWith("premium-14")) {
    return { primary: 0x50d7cf, secondary: 0xa78bfa };
  }
  if (id.includes("sunrise") || id.endsWith("free-17")) {
    return { primary: 0xffb83d, secondary: 0xffef9a };
  }
  if (id.includes("moonweave")) {
    return { primary: 0xdff7ff, secondary: 0x9ebcff };
  }
  if (id.includes("velvet-thorn")) {
    return { primary: 0xc02665, secondary: 0xf4c55c };
  }
  if (id.includes("clockwork")) {
    return { primary: 0x39d4d0, secondary: 0xf2bd4e };
  }
  if (id.includes("royal-seam")) {
    return { primary: 0x9d65e8, secondary: 0xf4c55c };
  }
  if (id.endsWith("free-14")) {
    return { primary: 0x9b62c7, secondary: 0xe09be2 };
  }
  if (id.endsWith("premium-8")) {
    return { primary: 0xe34f91, secondary: 0xff9dc5 };
  }

  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return NEEDLE_COSMETIC_PALETTES[hash % NEEDLE_COSMETIC_PALETTES.length];
}

function getNeedleImpactMotif(id: string): NeedleImpactMotif {
  if (id.includes("storm") || id.includes("clockwork")) return "lightning";
  if (id.includes("sunrise") || id.includes("velvet-thorn")) return "petals";
  if (id.includes("bone")) return "shards";
  if (id.includes("royal-seam")) return "crown";
  if (id.includes("moonweave")) return "stars";
  if (id.endsWith("premium-16")) return "crown";
  if (id.endsWith("premium-4") || id.endsWith("free-17")) return "stars";
  if (id.endsWith("premium-10")) return "shards";
  return "stitches";
}

export const CONFIRMED_HIT_EVENT = "raid:confirmed-hit";
export const PROGRESSION_SAVED_EVENT = "progression:saved";

const MONSTER_FALLBACK_SURFACE_RADIUS: Readonly<Record<string, number>> = {
  "grumble-yarn": 93,
  "button-bug": 96,
  "spool-spider": 112,
  "sewing-storm": 106,
  "moth-mask": 104,
  "spring-rabbit": 98,
  "patchwork-owl": 108,
  "madam-marionette": 104,
  "thimble-hedgehog": 95,
  "ink-shuttle": 100,
  "thimble-sentinel": 106,
  ripper: 105,
  "measuring-worm": 104,
  "velvet-bat": 108,
  "bobbin-crab": 105,
  "wax-doll": 98,
  "lace-wisp": 100,
  "scissor-mantis": 112,
  "loom-widow": 114,
  "pincushion-boar": 110,
  "queen-unraveling": 118,
  "clockwork-tailor": 118,
};

type RaidState =
  | "menu"
  | "ready"
  | "playing"
  | "won"
  | "failed"
  | "workshop"
  | "transition";

type RaidMode = "campaign" | "weekly";

interface UpgradePresentation {
  readonly name: string;
  readonly color: number;
}

const UPGRADE_PRESENTATION: Readonly<Record<UpgradeId, UpgradePresentation>> = {
  power: { name: "Двойная нить", color: 0xe56b6f },
  precision: { name: "Точный напёрсток", color: 0xe8b44d },
  speed: { name: "Быстрый челнок", color: 0x39b7a5 },
  ward: { name: "Оберег лоскутницы", color: 0x8a5578 },
};

function getWardCharges(level: UpgradeLevel): number {
  return level;
}

export class RaidScene extends Phaser.Scene {
  private state: RaidState = "ready";
  private stage = 1;
  private raidMode: RaidMode = "campaign";
  private weeklyRoute: WeeklyRouteDefinition = createWeeklyRoute(new Date());
  private weeklyNode: WeeklyRouteNode | null = null;
  private weeklyModifier: WeeklyModifierDefinition | null = null;
  private hits = 0;
  private requiredHits = 7;
  private shieldCharges = 0;
  private shotInFlight = false;
  private hitAngles: number[] = [];
  private progression!: ProgressionState;
  private currentMonster!: MonsterDefinition;
  private currentRoom!: RoomDefinition;
  private backgroundImage: Phaser.GameObjects.Image | null = null;
  private backgroundFallback!: Phaser.GameObjects.Rectangle;
  private backgroundShade!: Phaser.GameObjects.Rectangle;
  private monster!: Phaser.GameObjects.Container;
  private monsterBody!: Phaser.GameObjects.Container;
  private monsterArtwork: Phaser.GameObjects.Image | null = null;
  private monsterDamageOverlay!: Phaser.GameObjects.Graphics;
  private attachedNeedleBackLayer!: Phaser.GameObjects.Container;
  private attachedNeedleFrontLayer!: Phaser.GameObjects.Graphics;
  private monsterShadow!: Phaser.GameObjects.Ellipse;
  private hero!: Phaser.GameObjects.Container;
  private heroArtwork!: Phaser.GameObjects.Image;
  private heroLoadedNeedle!: Phaser.GameObjects.Image;
  private heroFrameTimers: Phaser.Time.TimerEvent[] = [];
  private activeImpactVfxGroups: Phaser.GameObjects.Container[][] = [];
  private healthBar!: Phaser.GameObjects.Rectangle;
  private healthText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private threadText!: Phaser.GameObjects.Text;
  private roomText!: Phaser.GameObjects.Text;
  private shieldText!: Phaser.GameObjects.Text;
  private monsterNameText!: Phaser.GameObjects.Text;
  private patternText!: Phaser.GameObjects.Text;
  private tipText!: Phaser.GameObjects.Text;
  private soundButton!: Phaser.GameObjects.Text;
  private abilityButton!: Phaser.GameObjects.Container;
  private abilityMedallion!: Phaser.GameObjects.Arc;
  private abilityMedallionInner!: Phaser.GameObjects.Arc;
  private abilityIcon!: Phaser.GameObjects.Image;
  private abilityNameText!: Phaser.GameObjects.Text;
  private abilityStateText!: Phaser.GameObjects.Text;
  private roomEffectText!: Phaser.GameObjects.Text;
  private overlay: Phaser.GameObjects.Container | null = null;
  private patternElapsed = 0;
  private roomElapsed = 0;
  private patternDirection = 1;
  private lastRoomReversalEvent = -1;
  private roomEffectVisualKey = "";
  private rotationSpeed = 0.88;
  private baseRotation = 0;
  private inputCooldownUntil = 0;
  private currentDamageStage = 0;
  private accurateStreak = 0;
  private maxAccurateStreak = 0;
  private stageHadCollision = false;
  private sentinelRicochetHintShown = false;
  private upgradePurchaseLockedUntil = 0;
  private menu!: GameMenu;
  private storyIntro!: StoryIntro;
  private storyIntroPromise: Promise<StoryIntroResult> | null = null;
  private readonly sfx = new SoundEngine();
  private readonly silhouetteMasks = new Map<string, AlphaMask | null>();
  private abilityRuntime: ActiveAbilityRuntime =
    createActiveAbilityRuntime("time-loop");
  private rewardedAbilityRun: RewardedAbilityRunState =
    createRewardedAbilityRunState();
  private activeRunSerial = 0;
  private lossInterstitialPending: Promise<void> | null = null;

  public constructor(private readonly platform: PlatformAdapter) {
    super("raid");
  }

  public preload(): void {
    const art = import.meta.env.BASE_URL + "assets/art/";

    this.load.image("room-attic", art + "attic-workshop.webp");
    this.load.image("room-theatre", art + "room-puppet-theatre.webp");
    this.load.image("room-machine", art + "room-sewing-machine-heart.webp");
    for (const frame of HERO_CROSSBOW_FRAMES) {
      this.load.image(frame.textureKey, `${art}${frame.fileName}`);
    }

    for (const monster of MONSTERS) {
      for (const textureKey of monster.textureKeys ?? []) {
        this.load.image(textureKey, `${art}${textureKey}.webp`);
      }
    }

    for (const background of BACKGROUNDS) {
      if (background.textureKey && background.fileName) {
        this.load.image(background.textureKey, art + background.fileName);
      }
    }

    for (const needle of NEEDLE_SKINS) {
      this.load.image(needle.textureKey, art + needle.iconFileName);
    }

    for (const ability of ACTIVE_ABILITIES) {
      this.load.image(
        getActiveAbilityTextureKey(ability.id),
        art + ability.iconFileName,
      );
    }

    for (const fileName of new Set(Object.values(WORKSHOP_IMPACT_ART))) {
      this.load.image(getWorkshopImpactTextureKey(fileName), art + fileName);
    }
  }

  public create(): void {
    this.state = "menu";
    this.stage = 1;
    this.hits = 0;
    this.shotInFlight = false;
    this.hitAngles = [];
    this.overlay = null;
    this.inputCooldownUntil = 0;
    this.upgradePurchaseLockedUntil = 0;
    this.progression = loadProgression();
    this.abilityRuntime = createActiveAbilityRuntime(
      this.getEquippedActiveAbilityId(),
    );
    this.shieldCharges = this.getStartingWardCharges();
    this.sfx.setMuted(this.progression.muted);
    this.sfx.setMusicTheme("menu");

    this.currentRoom = getRoomForStage(this.stage);
    this.createBackground();
    this.createHud();
    this.createHero();
    this.createMonster();

    const menuRoot = document.querySelector<HTMLElement>("#game-menu");
    if (!menuRoot) throw new Error("Не найден контейнер главного меню");
    const gameFrame = menuRoot.closest<HTMLElement>(".game-frame");
    if (!gameFrame) throw new Error("Не найдена рамка игры для вступления");
    this.storyIntro = new StoryIntro(gameFrame, {
      onPlaybackChange: (active) => {
        if (active) {
          this.sfx.setMusicTheme("story");
          // Narration plays outside the WebAudio bus; keep the dedicated
          // prologue score at full bus level so it remains clearly audible.
          this.sfx.setMusicDucking(1, 0.12);
        } else {
          this.sfx.setMusicDucking(1, 0.72);
        }
      },
      onMutedChange: (muted) => {
        this.progression = { ...this.progression, muted };
        this.sfx.setMuted(muted);
        this.soundButton.setText(muted ? "🔇" : "♪");
        this.persistProgress();
      },
    });
    this.menu = new GameMenu(menuRoot, this.progression, {
      onStart: () => void this.startRaidFromMenu(),
      onStartWeekly: () => void this.startWeeklyRouteFromMenu(),
      onShowStory: () => void this.replayStoryFromMenu(),
      onStateChange: (state) => this.applyMenuProgress(state),
      onToggleSound: (muted) => {
        this.sfx.setMuted(muted);
        this.soundButton.setText(muted ? "🔇" : "♪");
        this.sfx.ui();
      },
      onFullscreen: () => this.requestFullscreen(),
      onLoadLeaderboard: () => this.loadLeaderboardForMenu(),
      onLoadProfile: () => this.platform.getUserInfo(),
    });
    this.menu.show(this.progression);

    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.keyboard?.on("keydown-SPACE", this.handleKeyboardShot, this);
    this.input.keyboard?.on("keydown-E", this.handleKeyboardAbility, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutExpandedViewport, this);
    this.layoutExpandedViewport();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutExpandedViewport, this);
      this.heroFrameTimers.forEach((timer) => timer.remove(false));
      this.clearImpactVfxLayers();
      this.storyIntro.destroy();
      this.menu.destroy();
      this.sfx.destroy();
    });

    document.querySelector("#loading")?.classList.add("is-hidden");
  }

  public update(_time: number, delta: number): void {
    if (!this.monster) return;
    if (
      this.state === "menu" ||
      this.state === "won" ||
      this.state === "failed" ||
      this.state === "workshop" ||
      this.state === "transition"
    ) {
      return;
    }
    if (this.rewardedAbilityRun.requestInFlight) return;

    const deltaSeconds = Math.min(delta, 50) / 1000;
    this.roomElapsed += deltaSeconds;
    const roomEffect = getRoomEffectState(
      this.currentRoom.id,
      this.roomElapsed,
    );
    this.applyRoomEffect(roomEffect);

    const abilityTimeScale =
      this.abilityRuntime.id === "time-loop" &&
      this.abilityRuntime.effectUntil > this.time.now
        ? TIME_LOOP_SPEED_MULTIPLIER
        : 1;
    const patternDelta =
      deltaSeconds * roomEffect.speedMultiplier * abilityTimeScale;
    this.patternElapsed += patternDelta;
    this.updatePattern(this.getActivePattern(), patternDelta);
    this.refreshAbilityHud();
  }

  public pauseForPlatform(): void {
    this.storyIntro?.pauseForPlatform();
    this.sfx.pauseForPlatform();
  }

  public resumeForPlatform(): void {
    this.storyIntro?.resumeForPlatform();
    this.sfx.resumeForPlatform();
  }

  private playStoryIntro(mode: StoryIntroMode): Promise<StoryIntroResult> {
    if (this.storyIntroPromise) return this.storyIntroPromise;

    this.menu.hide();
    this.closeOverlay();
    this.clearImpactVfxLayers();
    void this.sfx.unlock();
    const playback = this.storyIntro.play({
      mode,
      muted: this.progression.muted,
    });
    let tracked!: Promise<StoryIntroResult>;
    tracked = playback
      .then((result) => {
        if (
          mode === "first-run" &&
          result !== "closed" &&
          !this.progression.introSeen
        ) {
          this.progression = { ...this.progression, introSeen: true };
          this.persistProgress();
        }
        return result;
      })
      .finally(() => {
        if (this.storyIntroPromise === tracked) this.storyIntroPromise = null;
      });
    this.storyIntroPromise = tracked;
    return tracked;
  }

  private async replayStoryFromMenu(): Promise<void> {
    if (this.state !== "menu") return;
    const result = await this.playStoryIntro("replay");
    if (result === "closed" && !this.scene.isActive()) return;
    if (this.state !== "menu") return;
    this.sfx.setMusicTheme("menu");
    this.menu.show(this.progression, "home");
    this.menu.focusStoryTrigger();
  }

  private async startRaidFromMenu(): Promise<void> {
    if (!this.progression.introSeen) {
      const result = await this.playStoryIntro("first-run");
      if (result === "closed" || this.state !== "menu") return;
    }
    await this.waitForLossInterstitial();
    if (this.state !== "menu") return;
    this.raidMode = "campaign";
    this.weeklyNode = null;
    this.weeklyModifier = null;
    this.sfx.setMusicTheme("raid");
    this.menu.hide();
    this.closeOverlay();
    this.state = "transition";
    this.resetRunAbility();
    this.stage = getRaidStartStage(this.progression.campaignResumeStage);
    this.shieldCharges = this.getStartingWardCharges();
    this.inputCooldownUntil = this.time.now + 260;
    this.createMonster();
    this.beginPlaying("Не дай иглам столкнуться");
  }

  private async startWeeklyRouteFromMenu(): Promise<void> {
    if (!this.progression.introSeen) {
      const result = await this.playStoryIntro("first-run");
      if (result === "closed" || this.state !== "menu") return;
    }
    await this.waitForLossInterstitial();
    if (this.state !== "menu") return;
    this.weeklyRoute = createWeeklyRoute(new Date());
    const weeklyRoute = syncWeeklyRouteProgress(
      this.progression.weeklyRoute,
      this.weeklyRoute,
    );
    this.progression = { ...this.progression, weeklyRoute };
    const weeklyStatus = getWeeklyRouteStatus(weeklyRoute, this.weeklyRoute);
    if (!weeklyStatus.canPlay) {
      this.persistProgress();
      this.menu.show(
        this.progression,
        "quests",
        "Маршрут этой недели уже пройден · новый откроется в пятницу, 03:00 МСК",
      );
      return;
    }
    this.raidMode = "weekly";
    this.weeklyNode = weeklyStatus.nextNode;
    this.weeklyModifier = getWeeklyModifier(this.weeklyNode.modifierId);
    this.stage = this.getWeeklyDifficultyStage(this.weeklyNode);
    this.sfx.setMusicTheme("raid");
    this.menu.hide();
    this.closeOverlay();
    this.state = "transition";
    this.resetRunAbility();
    this.shieldCharges = this.getStartingWardCharges();
    this.inputCooldownUntil = this.time.now + 260;
    this.createMonster();
    this.persistProgress();
    this.beginPlaying(
      `${this.weeklyRoute.name}: ${this.weeklyModifier.name}`,
    );
  }

  private getWeeklyDifficultyStage(node: WeeklyRouteNode): number {
    const campaignAnchor = Math.max(1, this.progression.highestStageCleared + 1);
    return Math.min(60, campaignAnchor + node.order - 1);
  }

  private applyMenuProgress(state: ProgressionState): void {
    this.progression = state;
    this.persistProgress();
    this.threadText?.setText("✦ " + this.progression.thread + " нитей");
    this.drawLoadedHeroNeedle(0, true);
    if (this.currentRoom) this.updateRoomBackground(this.currentRoom);
  }

  private async loadLeaderboardForMenu(): Promise<LeaderboardViewModel> {
    const userId = this.platform.launchContext?.userId ?? null;
    const localCurrentUser = userId
      ? {
          id: userId,
          firstName: "Ваш рекорд",
          highestStageCleared: this.progression.highestStageCleared,
        }
      : null;
    const result = await this.platform.loadLeaderboard();

    if (result.status === "ready") {
      const view = createLeaderboardViewModel("success", result.payload, {
        currentUserId: userId,
        localCurrentUser,
      });
      const hasLocalOnly = view.rows.some((row) => row.isLocalOnly);
      return hasLocalOnly
        ? {
            ...view,
            message:
              "Ваш локальный рекорд отмечен отдельно и не влияет на места. Общий результат появится после защищённой записи VK.",
          }
        : view;
    }

    if (localCurrentUser) {
      const fallback = createLeaderboardViewModel("success", null, {
        localCurrentUser,
      });
      return {
        ...fallback,
        message:
          result.status === "unsupported"
            ? "Показываем локальный рекорд. Общий рейтинг пока недоступен на этом устройстве."
            : "Не удалось обновить общий рейтинг. Локальный рекорд сохранён и показан отдельно.",
      };
    }

    return {
      ...createLeaderboardViewModel(
        result.status === "unsupported" ? "success" : "error",
      ),
      message:
        result.status === "unsupported"
          ? "Общий рейтинг доступен при запуске игры внутри VK."
          : "Не удалось загрузить рейтинг. Попробуйте ещё раз.",
    };
  }

  private getStartingWardCharges(): number {
    const skillBonus = getSkill(this.progression.equippedSkill).modifiers.startingWardBonus ?? 0;
    const needleBonus =
      getNeedleSkin(this.progression.equippedNeedle).modifiers.startingWardBonus ?? 0;
    return getWardCharges(this.progression.upgrades.ward) + skillBonus + needleBonus;
  }

  private getEquippedActiveAbilityId(): ActiveAbilityId {
    const progressionWithActiveAbility = this.progression as ProgressionState & {
      readonly equippedActiveAbility?: unknown;
    };
    return normalizeActiveAbilityId(
      progressionWithActiveAbility.equippedActiveAbility,
    );
  }

  private resetRunAbility(): void {
    this.activeRunSerial += 1;
    this.rewardedAbilityRun = createRewardedAbilityRunState();
    this.abilityRuntime = createActiveAbilityRuntime(
      this.getEquippedActiveAbilityId(),
    );
  }

  private async waitForLossInterstitial(): Promise<void> {
    await this.lossInterstitialPending;
  }

  private requestFullscreen(): void {
    void this.sfx.unlock();
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
      return;
    }

    if (document.fullscreenEnabled) {
      this.scale.startFullscreen({ navigationUI: "hide" });
    } else {
      this.scale.refresh();
    }
  }

  private layoutExpandedViewport(): void {
    if (!this.cameras?.main) return;
    const viewportWidth = this.scale.gameSize.width;
    const viewportHeight = this.scale.gameSize.height;
    const scrollX = (WIDTH - viewportWidth) / 2;
    const scrollY = (HEIGHT - viewportHeight) / 2;
    this.cameras.main.setSize(viewportWidth, viewportHeight).setScroll(scrollX, scrollY);

    this.backgroundFallback
      ?.setPosition(WIDTH / 2, HEIGHT / 2)
      .setSize(viewportWidth, viewportHeight);
    this.backgroundShade
      ?.setPosition(WIDTH / 2, HEIGHT / 2)
      .setSize(viewportWidth, viewportHeight);

    if (this.backgroundImage?.active) {
      const frame = this.backgroundImage.frame;
      const scale = Math.max(viewportWidth / frame.realWidth, viewportHeight / frame.realHeight);
      this.backgroundImage
        .setPosition(WIDTH / 2, HEIGHT / 2)
        .setDisplaySize(frame.realWidth * scale, frame.realHeight * scale);
    }

    const overlayShade = this.overlay?.getByName(
      "viewport-shade",
    ) as Phaser.GameObjects.Rectangle | null;
    overlayShade
      ?.setPosition(WIDTH / 2, HEIGHT / 2)
      .setSize(viewportWidth, viewportHeight);
  }

  private createBackground(): void {
    this.backgroundFallback = this.add
      .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x080d17)
      .setDepth(-1);

    const selectedBackground = getBackground(this.progression.equippedBackground);
    const initialTexture =
      selectedBackground.textureKey && this.textures.exists(selectedBackground.textureKey)
        ? selectedBackground.textureKey
        : this.currentRoom.backgroundKey;

    if (this.textures.exists(initialTexture)) {
      this.backgroundImage = this.add
        .image(WIDTH / 2, HEIGHT / 2, initialTexture)
        .setDepth(0)
        .setAlpha(0.9);
    }

    this.backgroundShade = this.add
      .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x101a28, 0.28)
      .setDepth(0);

    this.add
      .particles(0, 0, "__DEFAULT", {
        x: { min: 20, max: WIDTH - 20 },
        y: { min: 85, max: 585 },
        lifespan: { min: 4200, max: 7600 },
        speedX: { min: -3, max: 7 },
        speedY: { min: -10, max: -3 },
        scale: { start: 0.045, end: 0 },
        alpha: { start: 0.2, end: 0 },
        tint: 0xf2e3c6,
        frequency: 280,
        quantity: 1,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(1);

    this.layoutExpandedViewport();
  }

  private updateRoomBackground(room: RoomDefinition): void {
    const selected = getBackground(this.progression.equippedBackground);
    const textureKey =
      selected.textureKey && this.textures.exists(selected.textureKey)
        ? selected.textureKey
        : room.backgroundKey;

    if (this.backgroundImage && this.textures.exists(textureKey)) {
      this.backgroundImage.setTexture(textureKey).setAlpha(0.2);
      this.layoutExpandedViewport();
      this.tweens.add({
        targets: this.backgroundImage,
        alpha: 0.9,
        duration: 420,
        ease: "Sine.Out",
      });
    }

    const weeklyContrast = this.weeklyModifier?.effects.sceneContrastMultiplier ?? 1;
    const shadeAlpha =
      (room.id === "machine" ? 0.38 : 0.28) +
      Math.max(0, 1 - weeklyContrast) * 0.5;
    this.backgroundShade.setFillStyle(0x101a28, shadeAlpha);
  }

  private createHud(): void {
    const hudPlate = this.add.graphics().setDepth(20);
    hudPlate.fillStyle(0x162637, 0.82);
    hudPlate.fillRoundedRect(18, 18, WIDTH - 36, 94, 18);
    hudPlate.lineStyle(2, 0xf2e3c6, 0.14);
    hudPlate.strokeRoundedRect(18, 18, WIDTH - 36, 94, 18);

    this.stageText = this.add
      .text(36, 34, "", {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#f2e3c6",
        letterSpacing: 0.8,
      })
      .setDepth(21);

    this.roomText = this.add
      .text(270, 35, "", {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#c8d7ca",
      })
      .setOrigin(0.5, 0)
      .setDepth(21);

    this.threadText = this.add
      .text(36, 61, "", {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "17px",
        fontStyle: "bold",
        color: "#e8b44d",
      })
      .setDepth(21);

    this.shieldText = this.add
      .text(268, 64, "", {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#9edfd7",
      })
      .setOrigin(0.5, 0)
      .setDepth(21);

    this.soundButton = this.add
      .text(372, 57, this.sfx.isMuted() ? "🔇" : "♪", {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#f2e3c6",
        backgroundColor: "#25324a",
        padding: { x: 11, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setInteractive({ useHandCursor: true });

    this.soundButton.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        this.sfx.setMuted(!this.sfx.isMuted());
        this.soundButton.setText(this.sfx.isMuted() ? "🔇" : "♪");
        this.sfx.ui();
        this.progression = {
          ...this.progression,
          muted: this.sfx.isMuted(),
        };
        this.persistProgress();
      },
    );

    this.add
      .rectangle(48, 101, 290, 9, 0x111d2a, 0.9)
      .setOrigin(0, 0.5)
      .setDepth(21);
    this.healthBar = this.add
      .rectangle(48, 101, 290, 7, 0xe56b6f, 1)
      .setOrigin(0, 0.5)
      .setDepth(22);
    this.healthText = this.add
      .text(193, 100, "", {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "10px",
        fontStyle: "bold",
        color: "#fff6db",
      })
      .setOrigin(0.5)
      .setDepth(23);

    this.monsterNameText = this.add
      .text(WIDTH / 2, 127, "", {
        fontFamily: "Georgia, serif",
        fontSize: "23px",
        fontStyle: "bold",
        color: "#fff6db",
        stroke: "#182033",
        strokeThickness: 5,
        align: "center",
        wordWrap: { width: 385 },
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.patternText = this.add
      .text(WIDTH / 2, 158, "", {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "12px",
        color: "#c8d7ca",
        backgroundColor: "#25324acc",
        padding: { x: 9, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.tipText = this.add
      .text(WIDTH / 2, 735, "Не дай иглам столкнуться", {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#f2e3c6",
      })
      .setOrigin(0.5)
      .setAlpha(0.82)
      .setDepth(20);

    this.roomEffectText = this.add
      .text(WIDTH / 2, 190, "", {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#fff6db",
        backgroundColor: "#182033dd",
        padding: { x: 11, y: 6 },
        align: "center",
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(24);

    const ability = getActiveAbility(this.abilityRuntime.id);
    const abilityShadow = this.add.circle(-38, 3, 29, 0x101522, 0.68);
    this.abilityMedallion = this.add
      .circle(-38, 0, 28, 0x29485a, 0.98)
      .setStrokeStyle(3, 0x9edfd7, 0.9);
    this.abilityMedallionInner = this.add
      .circle(-38, 0, 23, 0x17283b, 0.94)
      .setStrokeStyle(1, 0xfff0bd, 0.28);
    this.abilityIcon = this.add
      .image(-38, 0, getActiveAbilityTextureKey(ability.id))
      .setDisplaySize(43, 43);
    this.abilityNameText = this.add
      .text(-3, -11, ability.shortName, {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#fff6db",
        stroke: "#182033",
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5);
    this.abilityStateText = this.add
      .text(-3, 11, "×1 · E", {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "10px",
        fontStyle: "bold",
        color: "#c8d7ca",
        stroke: "#182033",
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5);
    this.abilityButton = this.add
      .container(356, 680, [
        abilityShadow,
        this.abilityMedallion,
        this.abilityMedallionInner,
        this.abilityIcon,
        this.abilityNameText,
        this.abilityStateText,
      ])
      .setSize(136, 64)
      .setDepth(27)
      .setInteractive({ useHandCursor: true });

    this.abilityButton.on("pointerover", () => {
      if (canActivateAbility(this.abilityRuntime, this.time.now)) {
        this.abilityButton.setScale(1.025);
      }
    });
    this.abilityButton.on("pointerout", () => this.abilityButton.setScale(1));
    this.abilityButton.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        this.abilityButton.setScale(0.97);
        void this.activateSelectedAbility();
        this.time.delayedCall(90, () => this.abilityButton?.setScale(1));
      },
    );
    this.setCombatHudVisible(false);
  }

  private createHero(): void {
    this.hero = this.add
      .container(
        getHeroXForVerticalLaunch(
          MONSTER_X,
          HERO_RELEASE_FRAME_INDEX,
          HERO_ART_SIZE,
        ),
        627,
      )
      .setDepth(8);
    const shadow = this.add.ellipse(0, 116, 142, 19, 0x091316, 0.18);
    this.heroArtwork = this.add
      .image(0, 0, HERO_CROSSBOW_FRAMES[0].textureKey)
      .setDisplaySize(HERO_ART_SIZE, HERO_ART_SIZE);
    const needleSkin = getNeedleSkin(this.progression.equippedNeedle);
    this.heroLoadedNeedle = this.add
      .image(0, 0, needleSkin.textureKey)
      .setOrigin(0.5, NEEDLE_ART_TIP_Y);
    this.hero.add([shadow, this.heroArtwork, this.heroLoadedNeedle]);
    this.drawLoadedHeroNeedle(0, true);

    this.tweens.add({
      targets: this.hero,
      y: this.hero.y - 3,
      duration: 1650,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  private drawLoadedHeroNeedle(frameIndex: number, visible: boolean): void {
    if (!this.heroLoadedNeedle?.active) return;
    this.heroLoadedNeedle.setVisible(visible);
    if (!visible) return;

    const skin = getNeedleSkin(this.progression.equippedNeedle);
    const anchor = getHeroNeedleLayout(
      frameIndex,
      this.heroArtwork.displayWidth,
      this.heroArtwork.displayHeight,
    );
    const visibleLength = Math.max(52, Math.abs(anchor.tailY - anchor.tipY));
    const needleSize = getNeedleArtSize(visibleLength);
    this.heroLoadedNeedle
      .setTexture(skin.textureKey)
      .setPosition(anchor.x, anchor.tipY)
      .setDisplaySize(needleSize.width, needleSize.height)
      .setRotation(0);
  }

  private setHeroFrame(frameIndex: number, loaded: boolean): void {
    const frame = HERO_CROSSBOW_FRAMES[frameIndex] ?? HERO_CROSSBOW_FRAMES[0];
    if (this.heroArtwork?.active) this.heroArtwork.setTexture(frame.textureKey);
    this.drawLoadedHeroNeedle(frameIndex, loaded);
  }

  private playHeroShotAnimation(onRelease: () => void): void {
    this.heroFrameTimers.forEach((timer) => timer.remove(false));
    this.heroFrameTimers = [];
    const sequence = [
      { frame: 1, delay: 0, loaded: true, release: false },
      { frame: 2, delay: 85, loaded: false, release: true },
      { frame: 1, delay: 155, loaded: false, release: false },
      { frame: 0, delay: 225, loaded: false, release: false },
      { frame: 0, delay: 275, loaded: true, release: false },
    ];

    this.heroFrameTimers = sequence.map(({ frame, delay, loaded, release }) =>
      this.time.delayedCall(delay, () => {
        this.setHeroFrame(frame, loaded);
        if (release) onRelease();
      }),
    );
  }

  private getWeeklyMonster(node: WeeklyRouteNode): MonsterDefinition {
    const encounterKind = node.order === 5 ? "boss" : node.order === 3 ? "mini" : "regular";
    const matchesKind = (monster: MonsterDefinition): boolean =>
      encounterKind === "boss"
        ? monster.isBoss === true
        : encounterKind === "mini"
          ? monster.isMiniBoss === true
          : !monster.isBoss && !monster.isMiniBoss;
    const highestAvailableStage = Math.max(
      20,
      this.progression.highestStageCleared + 1,
    );
    const availableMonsters = MONSTERS.filter((monster) => {
      const firstStage = getFirstCampaignStageForMonster(monster.id);
      return firstStage !== null && firstStage <= highestAvailableStage;
    });
    const roomPool = availableMonsters.filter(
      (monster) => monster.roomId === node.roomId && matchesKind(monster),
    );
    const fallbackPool = availableMonsters.filter(matchesKind);
    const pool = roomPool.length > 0 ? roomPool : fallbackPool;
    const seed = Array.from(node.id).reduce(
      (total, character) => total + character.charCodeAt(0),
      0,
    );
    return pool[seed % pool.length] ?? getMonsterForStage(this.stage);
  }

  private createMonster(): void {
    this.clearImpactVfxLayers();
    if (this.monster?.active) this.monster.destroy(true);
    if (this.monsterShadow?.active) this.monsterShadow.destroy();

    if (this.raidMode === "weekly" && this.weeklyNode) {
      this.currentMonster = this.getWeeklyMonster(this.weeklyNode);
      this.currentRoom =
        ROOMS.find((room) => room.id === this.weeklyNode?.roomId) ??
        getRoomForStage(this.stage);
      this.weeklyModifier = getWeeklyModifier(this.weeklyNode.modifierId);
    } else {
      this.currentMonster = getMonsterForStage(this.stage);
      this.currentRoom = getRoomForStage(this.stage);
      this.weeklyModifier = null;
    }
    if (this.state !== "menu") {
      this.sfx.setMusicTheme(
        this.currentMonster.isBoss || this.currentMonster.isMiniBoss
          ? "boss"
          : "raid",
      );
    }
    this.updateRoomBackground(this.currentRoom);
    this.requiredHits = Math.max(
      4,
      getRequiredHits(this.currentMonster, this.stage) +
        (this.weeklyModifier?.effects.requiredHitsDelta ?? 0),
    );
    this.hits = 0;
    this.hitAngles = [];
    this.shotInFlight = false;
    this.patternElapsed = 0;
    this.roomElapsed = 0;
    this.patternDirection = Math.random() > 0.5 ? 1 : -1;
    this.lastRoomReversalEvent = -1;
    this.roomEffectVisualKey = "";
    this.roomEffectText?.setText("").setAlpha(0);
    const skillSpeed = getSkill(
      this.progression.equippedSkill,
    ).modifiers.rotationSpeedMultiplier ?? 1;
    const needleSpeed =
      getNeedleSkin(this.progression.equippedNeedle).modifiers
        .rotationSpeedMultiplier ?? 1;
    const bossSpeedMultiplier =
      this.currentMonster.bossTuning?.speedMultiplier ?? 1;
    this.rotationSpeed =
      getStageRotationSpeed(this.stage) *
      skillSpeed *
      needleSpeed *
      bossSpeedMultiplier *
      (this.weeklyModifier?.effects.rotationSpeedMultiplier ?? 1);
    if (this.weeklyModifier?.effects.reverseRotation) this.patternDirection *= -1;
    this.baseRotation = 0;
    this.currentDamageStage = 0;
    this.accurateStreak = 0;
    this.maxAccurateStreak = 0;
    this.stageHadCollision = false;
    this.sentinelRicochetHintShown = false;
    this.monsterArtwork = null;

    this.monsterShadow = this.add
      .ellipse(MONSTER_X, MONSTER_Y + 90, 112, 15, 0x08151a, 0.16)
      .setDepth(3);
    this.monster = this.add.container(MONSTER_X, MONSTER_Y).setDepth(6);
    this.attachedNeedleBackLayer = this.add.container(0, 0);
    this.monsterBody = this.buildMonsterBody(this.currentMonster, this.stage);
    this.monsterDamageOverlay = this.add.graphics();
    this.attachedNeedleFrontLayer = this.add.graphics();
    this.monster.add([
      this.attachedNeedleBackLayer,
      this.monsterBody,
      this.monsterDamageOverlay,
      this.attachedNeedleFrontLayer,
    ]);
    this.warmMonsterSilhouetteMasks();

    this.stageText.setText(
      this.raidMode === "weekly" && this.weeklyNode
        ? `НЕДЕЛЯ · УЗЕЛ ${this.weeklyNode.order}/5`
        : "СТЕЖОК " +
            this.stage +
            " · ПОХОД " +
            getExpeditionNumber(this.stage),
    );
    this.threadText.setText("✦ " + this.progression.thread + " нитей");
    this.roomText.setText(this.currentRoom.name);
    this.monsterNameText.setText(
      (this.currentMonster.isBoss
        ? "★ "
        : this.currentMonster.isMiniBoss
          ? "◆ "
          : "") + this.currentMonster.name,
    );
    this.refreshPatternLabel();
    this.refreshShieldText();
    this.refreshAbilityHud();
    this.updateHealth();

    if (this.currentMonster.isBoss || this.currentMonster.isMiniBoss) {
      this.sfx.boss();
      this.cameras.main.shake(
        this.currentMonster.isBoss ? 180 : 120,
        this.currentMonster.isBoss ? 0.003 : 0.002,
      );
    }
  }

  private buildMonsterBody(
    monster: MonsterDefinition,
    stage: number,
  ): Phaser.GameObjects.Container {
    const body = this.add.container(0, 0);
    const textureKey = monster.textureKeys?.find((key) =>
      this.textures.exists(key),
    );
    if (textureKey) {
      const artworkScale = monster.isBoss
        ? 2.82
        : monster.isMiniBoss
          ? 2.74
          : 2.68;
      this.monsterArtwork = this.add
        .image(0, 0, textureKey)
        .setDisplaySize(
          MONSTER_RADIUS * artworkScale,
          MONSTER_RADIUS * artworkScale,
        );
      body.add(this.monsterArtwork);
      return body;
    }

    const aura = this.add.graphics();
    aura.fillStyle(monster.accentColor, monster.isBoss ? 0.13 : 0.08);
    aura.fillCircle(0, 0, MONSTER_RADIUS + 15);
    aura.lineStyle(monster.isBoss ? 3 : 2, monster.accentColor, 0.3);
    aura.strokeCircle(0, 0, MONSTER_RADIUS + 8);
    body.add(aura);

    const shape = this.add.graphics();
    shape.fillStyle(monster.shadowColor, 1);
    shape.fillCircle(5, 8, MONSTER_RADIUS + 2);
    shape.fillStyle(monster.bodyColor, 1);
    shape.fillCircle(0, 0, MONSTER_RADIUS);
    shape.lineStyle(5, monster.accentColor, 0.45);
    shape.strokeCircle(0, 0, MONSTER_RADIUS - 3);
    shape.lineStyle(3, monster.accentColor, 0.34);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 5) {
      const inner = MONSTER_RADIUS * 0.44;
      const outer = MONSTER_RADIUS * 0.78;
      shape.lineBetween(
        Math.cos(angle) * inner,
        Math.sin(angle) * inner,
        Math.cos(angle + 0.32) * outer,
        Math.sin(angle + 0.32) * outer,
      );
    }

    const face = this.add.graphics();
    face.fillStyle(0xf2e3c6, 0.94);
    face.fillCircle(0, 0, 33);
    face.lineStyle(3, monster.shadowColor, 0.7);
    face.strokeCircle(0, 0, 33);
    face.fillStyle(0x25324a, 1);
    face.fillCircle(-11, -5, 5);
    face.fillCircle(11, -5, 5);
    face.lineStyle(3, 0x25324a, 1);
    face.beginPath();
    face.arc(0, 7, 12, Math.PI + 0.25, Math.PI * 2 - 0.25);
    face.strokePath();

    const stitch = this.add
      .text(0, 52, String(stage), {
        fontFamily: "Georgia, serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#f2e3c6",
      })
      .setOrigin(0.5);

    body.add([shape, face, stitch]);
    return body;
  }

  private getActivePattern(): MovementPattern {
    return getMovementPatternForProgress(
      this.currentMonster,
      this.hits,
      this.requiredHits,
    );
  }

  private refreshPatternLabel(): void {
    const bossPhase =
      this.currentMonster.bossTuning &&
      this.hits >=
        this.requiredHits * this.currentMonster.bossTuning.phaseTwoAt
        ? " · ФАЗА II"
        : "";
    this.patternText.setText(
      "Узор: " +
        PATTERN_NAMES[this.getActivePattern()] +
        bossPhase +
        (this.weeklyModifier ? ` · ${this.weeklyModifier.name}` : ""),
    );
  }

  private updatePattern(pattern: MovementPattern, deltaSeconds: number): void {
    switch (pattern) {
      case "carousel":
        this.monster.rotation +=
          this.patternDirection * this.rotationSpeed * deltaSeconds;
        break;
      case "pendulum": {
        const stageSpeed = getStageRotationSpeed(this.stage);
        // rotationSpeed already contains skill, needle, boss and weekly
        // modifiers, plus any acceleration earned during the encounter.
        const pendulumSpeed = stageSpeed > 0 ? this.rotationSpeed / stageSpeed : 1;
        this.monster.rotation =
          this.baseRotation +
          Math.sin(
            this.patternElapsed *
              (1.25 + this.stage * 0.025) *
              pendulumSpeed,
          ) *
            1.55 *
            this.patternDirection;
        break;
      }
      case "stitches": {
        const cycle = this.patternElapsed % 1.7;
        const cycleIndex = Math.floor(this.patternElapsed / 1.7);
        const motion = cycle < 0.42 || (cycle > 0.78 && cycle < 1.12);
        if (motion) {
          const cycleDirection = cycleIndex % 2 === 0 ? 1 : -1;
          this.monster.rotation +=
            this.patternDirection *
            cycleDirection *
            this.rotationSpeed *
            2.05 *
            deltaSeconds;
        }
        break;
      }
      case "recoil":
        this.monster.rotation +=
          this.patternDirection * this.rotationSpeed * deltaSeconds;
        break;
    }
  }

  private applyRoomEffect(effect: RoomEffectState): void {
    if (
      effect.shouldReverse &&
      effect.eventIndex !== this.lastRoomReversalEvent
    ) {
      this.lastRoomReversalEvent = effect.eventIndex;
      if (this.getActivePattern() === "pendulum") {
        this.baseRotation = this.monster.rotation;
        this.patternElapsed = 0;
      }
      this.patternDirection *= -1;
      this.sfx.ui();
      this.cameras.main.shake(90, 0.0018);
    }

    const visualKey = `${effect.phase}:${effect.eventIndex}`;
    if (visualKey === this.roomEffectVisualKey) return;
    this.roomEffectVisualKey = visualKey;

    this.tweens.killTweensOf(this.roomEffectText);
    if (effect.phase === "calm") {
      this.tweens.add({
        targets: this.roomEffectText,
        alpha: 0,
        duration: 180,
      });
      return;
    }

    const active = effect.phase === "active";
    const color = active
      ? this.currentRoom.id === "machine"
        ? "#9edfd7"
        : "#ffd777"
      : "#fff6db";
    this.roomEffectText
      .setText(effect.warningText)
      .setColor(color)
      .setAlpha(active ? 1 : 0.88)
      .setScale(active ? 1.06 : 1);
    this.tweens.add({
      targets: this.roomEffectText,
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: "Back.Out",
    });
    if (active && this.currentRoom.id !== "theatre") {
      this.sfx.ui();
      this.cameras.main.shake(80, 0.0012);
    }
  }

  private handleKeyboardAbility(event: KeyboardEvent): void {
    if (event.repeat) return;
    void this.activateSelectedAbility();
  }

  private async activateSelectedAbility(): Promise<void> {
    if (
      this.state !== "playing" ||
      this.shotInFlight ||
      this.rewardedAbilityRun.consumed ||
      this.rewardedAbilityRun.requestInFlight ||
      !canActivateAbility(this.abilityRuntime, this.time.now)
    ) {
      return;
    }

    const pending = beginRewardedAbilityRequest(this.rewardedAbilityRun);
    if (!pending) return;
    this.rewardedAbilityRun = pending;
    const requestedRunSerial = this.activeRunSerial;
    const ability = getActiveAbility(this.abilityRuntime.id);
    this.tipText.setText(`Видео откроет приём «${ability.shortName}» один раз за поход`);
    this.refreshAbilityHud();

    let adResult: RewardedAdResult;
    try {
      adResult = await this.platform.showRewardedAd();
    } catch {
      adResult = "error";
    }

    if (requestedRunSerial !== this.activeRunSerial) return;
    if (this.state !== "playing") {
      this.rewardedAbilityRun = finishRewardedAbilityRequest(
        this.rewardedAbilityRun,
        false,
      );
      return;
    }

    if (adResult !== "rewarded") {
      this.rewardedAbilityRun = finishRewardedAbilityRequest(
        this.rewardedAbilityRun,
        false,
      );
      this.tipText.setText(
        adResult === "unsupported"
          ? "Видео недоступно: открой игру внутри приложения VK"
          : adResult === "unavailable"
            ? "Видео сейчас недоступно — способность сохранена"
            : adResult === "cancelled"
              ? "Видео не завершено — способность сохранена"
              : "Не удалось открыть видео — способность сохранена",
      );
      this.refreshAbilityHud();
      return;
    }

    const result = activateAbility(
      this.abilityRuntime,
      this.time.now,
      this.shieldCharges,
      this.getStartingWardCharges(),
    );
    if (!result) {
      this.rewardedAbilityRun = finishRewardedAbilityRequest(
        this.rewardedAbilityRun,
        false,
      );
      this.refreshAbilityHud();
      return;
    }

    this.rewardedAbilityRun = finishRewardedAbilityRequest(
      this.rewardedAbilityRun,
      true,
    );
    this.abilityRuntime = result.runtime;
    this.shieldCharges = result.wardCharges;
    this.sfx.upgrade();

    switch (result.effect) {
      case "time-loop":
        this.tipText.setText("Петля времени: узор замедлен!");
        this.cameras.main.flash(150, 90, 170, 190, false);
        this.spawnAbilityGlyph("◷", 0x9edfd7);
        break;
      case "magnetic-armed":
        this.tipText.setText("Магнитный стежок готовит следующую иглу");
        this.spawnAbilityGlyph("⌁", 0xe8b44d);
        break;
      case "ward-restored":
        this.tipText.setText("Запасной узел восстановил один оберег");
        this.refreshShieldText();
        this.spawnAbilityGlyph("◇", 0x9edfd7);
        break;
      case "knot-armed":
        this.tipText.setText("Запасной узел завязан и спасёт при столкновении");
        this.spawnAbilityGlyph("◇", 0xf2e3c6);
        break;
    }

    this.refreshAbilityHud();
  }

  private spawnAbilityGlyph(symbol: string, color: number): void {
    const glyph = this.add
      .text(MONSTER_X, MONSTER_Y, symbol, {
        fontFamily: "Georgia, serif",
        fontSize: "52px",
        fontStyle: "bold",
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
        stroke: "#182033",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(14)
      .setAlpha(0.95);
    this.tweens.add({
      targets: glyph,
      y: glyph.y - 36,
      scale: 1.22,
      alpha: 0,
      duration: 620,
      ease: "Quad.Out",
      onComplete: () => glyph.destroy(),
    });
  }

  private setCombatHudVisible(visible: boolean): void {
    this.abilityButton?.setVisible(visible);
    if (!visible) this.roomEffectText?.setAlpha(0);
  }

  private refreshAbilityHud(): void {
    if (!this.abilityButton?.active) return;

    const visible = this.state === "playing";
    this.setCombatHudVisible(visible);
    if (!visible) return;

    const ability = getActiveAbility(this.abilityRuntime.id);
    const cooldown = getCooldownRemaining(this.abilityRuntime, this.time.now);
    const timeRemaining = Math.max(
      0,
      this.abilityRuntime.effectUntil - this.time.now,
    );
    const armed =
      this.abilityRuntime.magneticArmed || this.abilityRuntime.spareKnotArmed;
    const available =
      !this.rewardedAbilityRun.requestInFlight &&
      !this.rewardedAbilityRun.consumed &&
      canActivateAbility(this.abilityRuntime, this.time.now);

    let stateText = `×${this.abilityRuntime.charges} · E`;
    if (this.rewardedAbilityRun.requestInFlight) {
      stateText = "ВИДЕО…";
    } else if (timeRemaining > 0) {
      stateText = `АКТИВНО ${(timeRemaining / 1000).toFixed(1)}с`;
    } else if (armed) {
      stateText = "ЗАРЯЖЕНО";
    } else if (cooldown > 0) {
      stateText = `${Math.ceil(cooldown / 1000)}с · ×${this.abilityRuntime.charges}`;
    } else if (this.abilityRuntime.charges <= 0) {
      stateText = "ИСТРАЧЕНО";
    }

    this.abilityIcon.setTexture(getActiveAbilityTextureKey(ability.id));
    this.abilityNameText.setText(ability.shortName);
    this.abilityStateText.setText(stateText);
    const highlighted = available || armed || timeRemaining > 0;
    const rimColor = armed || timeRemaining > 0
      ? 0xe8b44d
      : available
        ? 0x9edfd7
        : 0x6d7885;
    this.abilityMedallion
      .setFillStyle(armed ? 0x554263 : available ? 0x29485a : 0x25324a, 0.98)
      .setStrokeStyle(3, rimColor, highlighted ? 0.96 : 0.72);
    this.abilityMedallionInner
      .setFillStyle(armed ? 0x35283f : available ? 0x172f40 : 0x202936, 0.96)
      .setStrokeStyle(1, rimColor, highlighted ? 0.42 : 0.24);
    if (highlighted) this.abilityIcon.clearTint();
    else this.abilityIcon.setTint(0x9aa4ad);
    this.abilityButton.setAlpha(highlighted ? 1 : 0.68);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.worldY < 115) return;
    this.fireNeedle();
  }

  private handleKeyboardShot(event: KeyboardEvent): void {
    if (event.repeat) return;
    this.fireNeedle();
  }

  private fireNeedle(): void {
    if (
      this.state !== "playing" ||
      this.shotInFlight ||
      this.rewardedAbilityRun.requestInFlight
    ) return;
    if (this.time.now < this.inputCooldownUntil) return;

    this.shotInFlight = true;
    this.progression = recordShot(this.progression);
    this.persistProgress();
    void this.sfx.unlock();
    this.playHeroShotAnimation(() => this.launchNeedleProjectile());
  }

  private launchNeedleProjectile(): void {
    if (this.state !== "playing") {
      this.shotInFlight = false;
      return;
    }

    this.sfx.shoot();
    const needleSkin = getNeedleSkin(this.progression.equippedNeedle);
    const releaseAnchor = getHeroNeedleLayout(
      HERO_RELEASE_FRAME_INDEX,
      this.heroArtwork.displayWidth,
      this.heroArtwork.displayHeight,
    );
    const projectile = this.add
      .container(this.hero.x + releaseAnchor.x, this.hero.y + releaseAnchor.tipY)
      .setDepth(7);
    const projectileSize = getNeedleArtSize(62);
    const equippedTrail = this.getEquippedNeedleCosmetic("needle-trail");
    const equippedAura = this.getEquippedNeedleCosmetic("needle-aura");
    if (equippedAura) {
      const palette = getNeedleCosmeticPalette(equippedAura.id);
      const aura = this.add
        .ellipse(0, 31, 22, 74, palette.primary, 0.12)
        .setStrokeStyle(1.5, palette.secondary, 0.72)
        .setBlendMode(Phaser.BlendModes.ADD);
      projectile.add(aura);
      this.tweens.add({
        targets: aura,
        alpha: { from: 0.42, to: 0.14 },
        scaleX: { from: 0.88, to: 1.18 },
        scaleY: { from: 0.94, to: 1.08 },
        duration: equippedAura.id.includes("storm") ? 90 : 180,
        yoyo: true,
        repeat: 1,
        ease: "Sine.InOut",
      });
    }
    const glow = this.add.rectangle(0, 31, 10, 62, needleSkin.headColor, 0.24);
    const needle = this.add
      .image(0, 0, needleSkin.textureKey)
      .setOrigin(0.5, NEEDLE_ART_TIP_Y)
      .setDisplaySize(projectileSize.width, projectileSize.height);
    projectile.add([glow, needle]);

    const startX = projectile.x;
    const startY = projectile.y;
    const flight = { progress: 0 };
    let previousTrailX = startX;
    let previousTrailY = startY + 28;
    let previousTrailProgress = 0;
    const speedLevel = this.progression.upgrades.speed;
    const skinSpeed = needleSkin.modifiers.projectileSpeedMultiplier ?? 1;
    const duration = Math.max(
      105,
      (BASE_PROJECTILE_DURATION - speedLevel * 12) /
        skinSpeed /
        (this.weeklyModifier?.effects.projectileSpeedMultiplier ?? 1),
    );
    this.tweens.add({
      targets: flight,
      progress: 1,
      duration,
      ease: "Quad.In",
      onUpdate: () => {
        if (!projectile.active || !this.monster?.active) return;
        const liveAngle = normalizeAngle(WORLD_HIT_ANGLE - this.monster.rotation);
        const liveSurface = this.getMonsterSurfaceRadius(liveAngle);
        projectile.x = Phaser.Math.Linear(startX, MONSTER_X, flight.progress);
        projectile.y = Phaser.Math.Linear(
          startY,
          MONSTER_Y + liveSurface + 1,
          flight.progress,
        );
        if (
          equippedTrail &&
          flight.progress - previousTrailProgress >= 0.075
        ) {
          const trailY = projectile.y + 28;
          this.spawnNeedleTrailSegment(
            previousTrailX,
            previousTrailY,
            projectile.x,
            trailY,
            equippedTrail,
          );
          previousTrailX = projectile.x;
          previousTrailY = trailY;
          previousTrailProgress = flight.progress;
        }
      },
      onComplete: () => {
        this.resolveProjectile(projectile);
      },
    });
  }

  private resolveProjectile(projectile: Phaser.GameObjects.Container): void {
    const localAngle = normalizeAngle(
      WORLD_HIT_ANGLE - this.monster.rotation,
    );
    if (isSentinelHelmetHit(this.currentMonster.id, localAngle)) {
      this.ricochetNeedle(projectile);
      return;
    }

    projectile.destroy(true);
    this.resolveHit(localAngle);
  }

  private ricochetNeedle(projectile: Phaser.GameObjects.Container): void {
    this.shotInFlight = false;
    this.stageHadCollision = true;
    this.accurateStreak = 0;
    this.sfx.ricochet();
    this.cameras.main.shake(90, 0.0024);
    this.cameras.main.flash(80, 242, 227, 198, false);

    if (!this.sentinelRicochetHintShown) {
      this.sentinelRicochetHintShown = true;
      this.tipText.setText(
        "Шлем Стража отбивает иглы — целься мимо брони!",
      );
    }

    const direction = this.patternDirection >= 0 ? 1 : -1;
    const spark = this.add
      .graphics()
      .setPosition(projectile.x, projectile.y)
      .setDepth(14);
    spark.lineStyle(3, 0xffedb0, 0.96);
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI * 2 * index) / 6;
      spark.lineBetween(
        Math.cos(angle) * 5,
        Math.sin(angle) * 5,
        Math.cos(angle) * 22,
        Math.sin(angle) * 22,
      );
    }
    spark.fillStyle(0xffffff, 1);
    spark.fillCircle(0, 0, 4);

    this.tweens.add({
      targets: spark,
      alpha: 0,
      scale: 1.45,
      duration: 170,
      ease: "Quad.Out",
      onComplete: () => spark.destroy(),
    });
    this.tweens.add({
      targets: projectile,
      x: projectile.x + direction * 96,
      y: projectile.y + 86,
      rotation: projectile.rotation + direction * 1.65,
      alpha: 0,
      duration: 270,
      ease: "Quad.Out",
      onComplete: () => projectile.destroy(true),
    });
  }

  private resolveHit(initialLocalAngle: number): void {
    let localAngle = initialLocalAngle;
    const precisionLevel = this.progression.upgrades.precision;
    const needleSkin = getNeedleSkin(this.progression.equippedNeedle);
    const needleModifiers = needleSkin.modifiers;
    const skillModifiers = getSkill(this.progression.equippedSkill).modifiers;
    const needleGap = Math.max(
      0.045,
      (BASE_NEEDLE_GAP -
          precisionLevel * 0.005 -
          (needleModifiers.needleGapReduction ?? 0) -
          (skillModifiers.needleGapReduction ?? 0) +
          (needleModifiers.needleGapPenalty ?? 0)) *
        (this.weeklyModifier?.effects.collisionToleranceMultiplier ?? 1),
    );

    let magneticCorrection = false;
    if (this.abilityRuntime.magneticArmed) {
      const magneticHit = findMagneticHitAngle(
        localAngle,
        this.hitAngles,
        needleGap,
      );
      this.abilityRuntime = consumeMagneticStitch(this.abilityRuntime);
      this.refreshAbilityHud();
      if (magneticHit) {
        localAngle = magneticHit.angle;
        magneticCorrection = magneticHit.corrected;
      }
    }

    if (isAngleBlocked(localAngle, this.hitAngles, needleGap)) {
      this.shotInFlight = false;
      this.stageHadCollision = true;
      this.accurateStreak = 0;
      if (this.abilityRuntime.spareKnotArmed) {
        this.absorbCollisionWithSpareKnot();
      } else if (this.shieldCharges > 0) {
        this.absorbCollision();
      } else {
        this.failRaid();
      }
      return;
    }

    const doubleChance = Math.min(
      0.75,
      this.progression.upgrades.power * 0.1 +
        (needleModifiers.doubleChanceBonus ?? 0) +
        (skillModifiers.doubleChanceBonus ?? 0),
    );
    const isDouble = doubleChance > 0 && Math.random() < doubleChance;
    const accurateHitNumber = this.hitAngles.length + 1;
    const rhythmBonus =
      needleModifiers.extraHitEvery &&
      accurateHitNumber % needleModifiers.extraHitEvery === 0
        ? 1
        : 0;
    const openingBonus = this.hits === 0 ? (needleModifiers.firstHitBonus ?? 0) : 0;
    const stitchPower = 1 + (isDouble ? 1 : 0) + rhythmBonus + openingBonus;
    const isEmpowered = stitchPower > 1;

    this.hitAngles.push(localAngle);
    this.accurateStreak += 1;
    this.maxAccurateStreak = Math.max(this.maxAccurateStreak, this.accurateStreak);
    this.attachNeedle(localAngle);
    this.hits = Math.min(this.requiredHits, this.hits + stitchPower);
    this.shotInFlight = false;
    this.sfx.hit();
    this.game.events.emit(CONFIRMED_HIT_EVENT);
    this.progression = {
      ...this.progression,
      dailySystems: recordDailyGameplayEvent(
        this.progression.dailySystems,
        { type: "accurate-streak", length: this.accurateStreak },
        new Date(),
        getDailySelectionContext(
          this.progression.highestStageCleared,
          this.progression.ownedNeedles,
        ),
      ),
      needleMastery: recordNeedleMasteryHit(
        this.progression.needleMastery,
        this.progression.equippedNeedle,
      ),
      seasonPass: recordSeasonPassEvent(
        this.progression.seasonPass,
        "successful-hit",
      ),
    };
    this.persistProgress();
    this.cameras.main.shake(isEmpowered ? 100 : 65, isEmpowered ? 0.004 : 0.0025);

    if (magneticCorrection) {
      this.tipText.setText("Магнит поправил иглу и нашёл свободный стежок!");
    }

    if (this.getActivePattern() === "recoil") {
      this.patternDirection *= -1;
      this.rotationSpeed = Math.min(2.65, this.rotationSpeed + 0.08);
    }

    const weeklyEffects = this.weeklyModifier?.effects;
    if (weeklyEffects?.rotationAcceleration) {
      this.rotationSpeed = Math.min(
        3,
        this.rotationSpeed + weeklyEffects.rotationAcceleration,
      );
    }
    if (
      weeklyEffects?.directionChangeEveryHits &&
      this.hitAngles.length % weeklyEffects.directionChangeEveryHits === 0
    ) {
      this.patternDirection *= -1;
      this.tipText.setText("Эхо пуговиц сменило направление!");
    }

    this.flashMonster(isEmpowered ? needleSkin.headColor : 0xf2e3c6);
    this.spawnEquippedNeedleImpact(localAngle, isEmpowered);
    this.spawnMonsterDamageReaction(localAngle, isEmpowered);
    this.spawnHitText(isEmpowered, stitchPower);
    this.updateMonsterDamageVisual();
    this.updateHealth();

    if (this.hits >= this.requiredHits) this.winStage();
  }

  private absorbCollision(): void {
    this.shieldCharges -= 1;
    this.refreshShieldText();
    this.sfx.upgrade();
    this.cameras.main.flash(180, 57, 183, 165, false);
    this.tipText.setText("Оберег спас иглу! Щитов: " + this.shieldCharges);

    const ring = this.add
      .circle(MONSTER_X, MONSTER_Y, MONSTER_RADIUS + 34, 0x39b7a5, 0.12)
      .setStrokeStyle(5, 0x9edfd7, 0.9)
      .setDepth(12);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.28,
      duration: 360,
      onComplete: () => ring.destroy(),
    });
  }

  private absorbCollisionWithSpareKnot(): void {
    this.abilityRuntime = consumeSpareKnot(this.abilityRuntime);
    this.refreshAbilityHud();
    this.sfx.upgrade();
    this.cameras.main.flash(170, 232, 180, 77, false);
    this.tipText.setText("Запасной узел удержал разорванную нить!");

    const stitch = this.add.graphics().setDepth(13);
    stitch.lineStyle(4, 0x182033, 0.86);
    stitch.strokePoints(
      [
        new Phaser.Math.Vector2(MONSTER_X, MONSTER_Y - 40),
        new Phaser.Math.Vector2(MONSTER_X + 40, MONSTER_Y),
        new Phaser.Math.Vector2(MONSTER_X, MONSTER_Y + 40),
        new Phaser.Math.Vector2(MONSTER_X - 40, MONSTER_Y),
      ],
      true,
    );
    stitch.lineStyle(2, 0xe8b44d, 1);
    stitch.strokePoints(
      [
        new Phaser.Math.Vector2(MONSTER_X, MONSTER_Y - 36),
        new Phaser.Math.Vector2(MONSTER_X + 36, MONSTER_Y),
        new Phaser.Math.Vector2(MONSTER_X, MONSTER_Y + 36),
        new Phaser.Math.Vector2(MONSTER_X - 36, MONSTER_Y),
      ],
      true,
    );
    this.tweens.add({
      targets: stitch,
      alpha: 0,
      scale: 1.24,
      duration: 380,
      onComplete: () => stitch.destroy(),
    });
  }

  private attachNeedle(_angle: number): void {
    this.redrawAttachedNeedles();
  }

  private getSilhouetteMask(textureKey: string): AlphaMask | null {
    if (this.silhouetteMasks.has(textureKey)) {
      return this.silhouetteMasks.get(textureKey) ?? null;
    }

    try {
      const texture = this.textures.get(textureKey);
      const source = texture.getSourceImage() as CanvasImageSource & {
        readonly width?: number;
        readonly height?: number;
        readonly naturalWidth?: number;
        readonly naturalHeight?: number;
      };
      const width = Math.floor(Number(source.naturalWidth || source.width || 0));
      const height = Math.floor(Number(source.naturalHeight || source.height || 0));
      if (width < 1 || height < 1) throw new Error("empty texture source");

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("canvas 2d is unavailable");
      context.clearRect(0, 0, width, height);
      context.drawImage(source, 0, 0, width, height);
      const image = context.getImageData(0, 0, width, height);
      const alpha = new Uint8ClampedArray(width * height);
      for (let index = 0; index < alpha.length; index += 1) {
        alpha[index] = image.data[index * 4 + 3];
      }
      const mask: AlphaMask = { width, height, data: alpha };
      this.silhouetteMasks.set(textureKey, mask);
      return mask;
    } catch {
      this.silhouetteMasks.set(textureKey, null);
      return null;
    }
  }

  private warmMonsterSilhouetteMasks(): void {
    // Only the current monster's four damage frames are needed. Keeping masks
    // from every prior encounter would steadily grow the mobile JS heap.
    this.silhouetteMasks.clear();
    for (const [index, textureKey] of (this.currentMonster.textureKeys ?? []).entries()) {
      this.time.delayedCall(index * 16, () => {
        if (this.textures.exists(textureKey)) this.getSilhouetteMask(textureKey);
      });
    }
  }

  private getMonsterSurfaceRadius(angle: number): number {
    const artwork = this.monsterArtwork;
    const fallback =
      MONSTER_FALLBACK_SURFACE_RADIUS[this.currentMonster.id] ?? MONSTER_RADIUS;
    if (!artwork?.active) return MONSTER_RADIUS;

    const mask = this.getSilhouetteMask(artwork.texture.key);
    if (!mask) return fallback;
    const sourceRadius = getAlphaSurfaceRadius(mask, angle);
    if (sourceRadius === null) return fallback;

    const scaleX = artwork.displayWidth / mask.width;
    const scaleY = artwork.displayHeight / mask.height;
    const scaledRadius =
      sourceRadius *
      Math.hypot(Math.cos(angle) * scaleX, Math.sin(angle) * scaleY);
    const maximumRadius = this.currentMonster.isBoss
      ? 154
      : this.currentMonster.isMiniBoss
        ? 150
        : 146;
    return Phaser.Math.Clamp(scaledRadius, 28, maximumRadius);
  }

  private redrawAttachedNeedles(): void {
    if (!this.attachedNeedleBackLayer?.active || !this.attachedNeedleFrontLayer?.active) {
      return;
    }

    const back = this.attachedNeedleBackLayer;
    const front = this.attachedNeedleFrontLayer;
    const needleSkin = getNeedleSkin(this.progression.equippedNeedle);
    const equippedAura = this.getEquippedNeedleCosmetic("needle-aura");
    const auraPalette = equippedAura
      ? getNeedleCosmeticPalette(equippedAura.id)
      : null;
    back.removeAll(true);
    front.clear();

    for (const angle of this.hitAngles) {
      const directionX = Math.cos(angle);
      const directionY = Math.sin(angle);
      const tangentX = -directionY;
      const tangentY = directionX;
      const surface = this.getMonsterSurfaceRadius(angle);
      const embedded = Math.max(8, surface - 18);
      const outsideLength = this.currentMonster.isBoss
        ? 46
        : this.currentMonster.isMiniBoss
          ? 43
          : 40;
      const needleSize = getNeedleArtSize(outsideLength + 18);
      const needle = this.add
        .image(
          directionX * embedded,
          directionY * embedded,
          needleSkin.textureKey,
        )
        .setOrigin(0.5, NEEDLE_ART_TIP_Y)
        .setDisplaySize(needleSize.width, needleSize.height)
        .setRotation(getAttachedNeedleRotation(angle));
      back.add(needle);

      const entry = Math.max(12, surface - 4);
      const entryX = directionX * entry;
      const entryY = directionY * entry;
      const visibleInner = Math.max(10, surface - 11);
      const visibleOuter = surface + 8;
      if (auraPalette) {
        front.lineStyle(9, auraPalette.primary, 0.16);
        front.lineBetween(
          directionX * visibleInner,
          directionY * visibleInner,
          directionX * visibleOuter,
          directionY * visibleOuter,
        );
      }
      front.lineStyle(6, 0x111827, 0.82);
      front.lineBetween(
        directionX * visibleInner,
        directionY * visibleInner,
        directionX * visibleOuter,
        directionY * visibleOuter,
      );
      front.lineStyle(2.5, needleSkin.shaftColor, 1);
      front.lineBetween(
        directionX * visibleInner,
        directionY * visibleInner,
        directionX * visibleOuter,
        directionY * visibleOuter,
      );
      // Mark the puncture with a tiny embroidered seam instead of a round
      // rivet. The dark under-stitch keeps it readable on every monster while
      // the narrow coloured thread makes the needle feel embedded in fabric.
      front.lineStyle(4, 0x111827, 0.72);
      front.lineBetween(
        entryX - tangentX * 5,
        entryY - tangentY * 5,
        entryX + tangentX * 5,
        entryY + tangentY * 5,
      );
      front.lineStyle(1.75, needleSkin.tailColor, 1);
      front.lineBetween(
        entryX - tangentX * 4.25,
        entryY - tangentY * 4.25,
        entryX + tangentX * 4.25,
        entryY + tangentY * 4.25,
      );
    }
  }

  private updateMonsterDamageVisual(): void {
    const damageStage = Math.min(
      3,
      Math.floor((this.hits / this.requiredHits) * 4),
    );
    if (damageStage === this.currentDamageStage) return;

    this.currentDamageStage = damageStage;
    const textureKey = this.currentMonster.textureKeys?.[damageStage];
    if (textureKey && this.textures.exists(textureKey) && this.monsterArtwork) {
      this.monsterArtwork.setTexture(textureKey);
      this.redrawAttachedNeedles();
    } else {
      this.drawProceduralDamage(damageStage);
    }

    this.tweens.add({
      targets: this.monster,
      scaleX: 1.035,
      scaleY: 1.035,
      duration: 60,
      yoyo: true,
      ease: "Quad.Out",
    });
    this.refreshPatternLabel();
  }

  private drawProceduralDamage(damageStage: number): void {
    const marks = this.monsterDamageOverlay;
    marks.clear();
    if (damageStage === 0) return;

    marks.lineStyle(5, 0x3a243d, 0.95);
    marks.lineBetween(-24, -24, -6, -16);
    marks.lineBetween(7, -16, 25, -24);
    marks.lineStyle(3, 0xe56b6f, 0.95);

    if (damageStage >= 2) {
      marks.lineBetween(-54, -4, -38, 10);
      marks.lineBetween(-46, -7, -36, 1);
      marks.lineBetween(-48, 6, -39, 14);
      marks.fillStyle(0x4a3652, 0.65);
      marks.fillCircle(31, 19, 13);
    }

    if (damageStage >= 3) {
      marks.lineBetween(9, 37, 26, 52);
      marks.lineBetween(12, 50, 26, 39);
      marks.lineStyle(2, 0xf2e3c6, 0.8);
      marks.lineBetween(-20, 29, -11, 43);
      marks.lineBetween(-11, 43, -2, 28);
    }
  }

  private flashMonster(color: number): void {
    const flash = this.add
      .circle(MONSTER_X, MONSTER_Y, MONSTER_RADIUS + 5, color, 0.34)
      .setDepth(9);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.14,
      duration: 150,
      onComplete: () => flash.destroy(),
    });
  }

  private createMonsterDamagePiece(
    profile: MonsterDamageReactionProfile,
    index: number,
  ): Phaser.GameObjects.Container {
    const piece = this.add.container(0, 0);
    const shape = this.add.graphics();
    const alternate = index % 2 === 0;
    const color = alternate ? profile.primary : profile.secondary;

    switch (profile.motif) {
      case "tape":
        shape.fillStyle(color, 0.96);
        shape.fillRoundedRect(-10, -3, 20, 6, 2);
        shape.lineStyle(1, profile.accent, 0.9);
        for (let mark = -7; mark <= 7; mark += 7) {
          shape.lineBetween(mark, -3, mark, alternate ? 1 : 3);
        }
        break;
      case "velvet":
        shape.fillStyle(color, 0.84);
        shape.fillEllipse(0, 0, alternate ? 9 : 5, alternate ? 5 : 10);
        shape.lineStyle(1, profile.accent, 0.55);
        shape.lineBetween(-4, 1, 4, -1);
        break;
      case "metal":
        shape.lineStyle(alternate ? 3 : 2, color, 1);
        shape.lineBetween(-2, 8, 2, -8);
        shape.fillStyle(profile.accent, 1);
        shape.fillCircle(0, -8, 2.3);
        break;
      case "wax":
        shape.fillStyle(color, 0.9);
        shape.fillCircle(0, -2, alternate ? 5 : 3.5);
        shape.fillTriangle(-4, 0, 4, 0, 0, 10);
        break;
      case "lace":
        shape.lineStyle(1.8, color, 0.92);
        shape.strokeCircle(-4, 0, 4);
        shape.strokeCircle(4, 0, 4);
        shape.lineStyle(1, profile.accent, 0.72);
        shape.lineBetween(-8, 0, 8, 0);
        break;
      case "blade":
        shape.fillStyle(color, 0.92);
        shape.fillTriangle(-2, -11, 3, 8, -5, 5);
        shape.lineStyle(1.5, profile.secondary, 0.92);
        shape.lineBetween(-2, -8, 1, 6);
        break;
      case "web":
        shape.lineStyle(1.35, color, 0.86);
        shape.strokeCircle(0, 0, alternate ? 8 : 6);
        for (let spoke = 0; spoke < 4; spoke += 1) {
          const angle = (Math.PI * spoke) / 2 + Math.PI / 4;
          shape.lineBetween(0, 0, Math.cos(angle) * 9, Math.sin(angle) * 9);
        }
        break;
      case "needle":
        shape.fillStyle(color, 0.96);
        shape.fillRoundedRect(-1.4, -12, 2.8, 24, 1);
        shape.fillStyle(profile.accent, 0.95);
        shape.fillCircle(0, 9, 2.2);
        break;
      case "royal":
        shape.fillStyle(color, 0.9);
        shape.fillTriangle(-7, 5, 0, -9, 7, 5);
        shape.lineStyle(2, profile.secondary, 0.95);
        shape.strokeTriangle(-7, 5, 0, -9, 7, 5);
        shape.fillStyle(profile.accent, 0.95);
        shape.fillCircle(0, 1, 2.2);
        break;
      case "clockwork":
        shape.lineStyle(2.2, color, 0.95);
        shape.strokeCircle(0, 0, alternate ? 8 : 6);
        shape.fillStyle(profile.accent, 0.9);
        shape.fillCircle(0, 0, 2.4);
        for (let tooth = 0; tooth < 6; tooth += 1) {
          const angle = (Math.PI * 2 * tooth) / 6;
          shape.lineBetween(
            Math.cos(angle) * 6,
            Math.sin(angle) * 6,
            Math.cos(angle) * 10,
            Math.sin(angle) * 10,
          );
        }
        break;
    }

    piece.add(shape);
    return piece;
  }

  private spawnMonsterDamageReaction(
    localAngle: number,
    isEmpowered: boolean,
  ): void {
    const reactionId = this.currentMonster.damageReaction;
    if (!reactionId) return;

    const profile = getMonsterDamageReactionProfile(reactionId);
    const count = profile.particleCount + (isEmpowered ? 3 : 0);
    const needsBackLayer =
      profile.motif === "velvet" ||
      profile.motif === "lace" ||
      profile.motif === "clockwork";
    const [front, back = null] = this.createImpactVfxGroup(
      needsBackLayer ? [15, 5] : [15],
      profile.durationMs + 260,
    );
    const worldAngle = normalizeAngle(localAngle + this.monster.rotation);
    const impactPoint = this.getImpactVfxSurfacePoint(worldAngle, 3);
    const pulse = this.add
      .circle(impactPoint.x, impactPoint.y, isEmpowered ? 18 : 13, profile.primary, 0.09)
      .setStrokeStyle(isEmpowered ? 3 : 2, profile.secondary, 0.86)
      .setBlendMode(Phaser.BlendModes.ADD);
    front.add(pulse);
    this.tweens.add({
      targets: pulse,
      alpha: 0,
      scale: isEmpowered ? 2.25 : 1.78,
      duration: Math.min(360, profile.durationMs),
      ease: "Cubic.Out",
    });

    if (this.monsterArtwork?.active) {
      this.monsterArtwork.setTint(profile.primary);
      this.time.delayedCall(isEmpowered ? 82 : 58, () => {
        if (this.monsterArtwork?.active) this.monsterArtwork.clearTint();
      });
    }

    const orbitingMotif =
      profile.motif === "velvet" ||
      profile.motif === "lace" ||
      profile.motif === "web" ||
      profile.motif === "needle" ||
      profile.motif === "royal" ||
      profile.motif === "clockwork";

    for (let index = 0; index < count; index += 1) {
      const angle = orbitingMotif
        ? (Math.PI * 2 * index) / count + Phaser.Math.FloatBetween(-0.12, 0.12)
        : worldAngle + Phaser.Math.FloatBetween(-1.05, 1.05);
      const start = orbitingMotif
        ? this.getImpactVfxSurfacePoint(angle, Phaser.Math.Between(-5, 5))
        : new Phaser.Math.Vector2(
            impactPoint.x + Phaser.Math.Between(-7, 7),
            impactPoint.y + Phaser.Math.Between(-7, 7),
          );
      const piece = this.createMonsterDamagePiece(profile, index)
        .setPosition(start.x, start.y)
        .setRotation(angle + Phaser.Math.FloatBetween(-0.35, 0.35))
        .setScale(isEmpowered ? 1.12 : 1);
      (needsBackLayer && index % 3 === 0 ? back ?? front : front).add(piece);

      const distance = Phaser.Math.Between(
        profile.motif === "royal" || profile.motif === "clockwork" ? 35 : 22,
        profile.motif === "needle" || profile.motif === "blade" ? 64 : 48,
      );
      const fall =
        profile.motif === "velvet" || profile.motif === "wax"
          ? Phaser.Math.Between(24, 48)
          : profile.motif === "clockwork"
            ? Phaser.Math.Between(6, 24)
            : 0;
      this.tweens.add({
        targets: piece,
        x: start.x + Math.cos(angle) * distance,
        y: start.y + Math.sin(angle) * distance + fall,
        rotation:
          piece.rotation + Phaser.Math.FloatBetween(-1.4, 1.4),
        alpha: 0,
        scale: profile.motif === "web" || profile.motif === "lace" ? 1.48 : 0.72,
        duration: Phaser.Math.Between(
          Math.max(260, profile.durationMs - 110),
          profile.durationMs + 80,
        ),
        delay: Phaser.Math.Between(0, 85),
        ease: profile.motif === "wax" ? "Quad.In" : "Sine.Out",
      });
    }

    if (profile.motif === "wax") {
      const crack = this.add.graphics();
      crack.lineStyle(2.4, profile.accent, 0.92);
      crack.beginPath();
      crack.moveTo(impactPoint.x - 2, impactPoint.y - 3);
      crack.lineTo(impactPoint.x + 7, impactPoint.y + 4);
      crack.lineTo(impactPoint.x + 2, impactPoint.y + 12);
      crack.moveTo(impactPoint.x + 7, impactPoint.y + 4);
      crack.lineTo(impactPoint.x + 15, impactPoint.y + 1);
      crack.strokePath();
      front.add(crack);
      this.tweens.add({
        targets: crack,
        alpha: 0,
        duration: profile.durationMs,
        ease: "Sine.In",
      });
    }

    if (profile.motif === "clockwork") {
      for (let index = 0; index < 4; index += 1) {
        const smoke = this.add
          .ellipse(
            Phaser.Math.Between(-32, 32),
            Phaser.Math.Between(-18, 24),
            Phaser.Math.Between(18, 30),
            Phaser.Math.Between(12, 22),
            0x33434a,
            0.24,
          )
          .setScale(0.7);
        (back ?? front).add(smoke);
        this.tweens.add({
          targets: smoke,
          y: smoke.y - Phaser.Math.Between(28, 48),
          x: smoke.x + Phaser.Math.Between(-12, 12),
          scale: 1.35,
          alpha: 0,
          duration: profile.durationMs,
          delay: index * 45,
          ease: "Sine.Out",
        });
      }
    }

    this.cameras.main.shake(
      isEmpowered ? 110 : 75,
      profile.shake * (isEmpowered ? 1.25 : 1),
    );
  }

  private getEquippedNeedleCosmetic(
    kind: NeedleCosmeticKind,
  ): WorkshopCollectible | null {
    const id = this.progression.workshopCollection?.equipped[kind] ?? null;
    if (!id) return null;
    const collectible = getWorkshopCollectible(id);
    return collectible?.kind === kind ? collectible : null;
  }

  private spawnNeedleTrailSegment(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    collectible: WorkshopCollectible,
  ): void {
    const palette = getNeedleCosmeticPalette(collectible.id);
    const stitch = this.add.graphics().setDepth(6);
    stitch.lineStyle(4.5, 0x101827, 0.28);
    stitch.lineBetween(fromX, fromY, toX, toY);
    stitch.lineStyle(2.25, palette.primary, 0.88);
    stitch.lineBetween(fromX, fromY, toX, toY);

    const midpointX = (fromX + toX) / 2;
    const midpointY = (fromY + toY) / 2;
    if (
      collectible.id.includes("storm") ||
      collectible.id.includes("clockwork") ||
      collectible.id.endsWith("premium-14")
    ) {
      stitch.lineStyle(1.4, palette.secondary, 0.9);
      stitch.beginPath();
      stitch.moveTo(midpointX - 4, midpointY - 3);
      stitch.lineTo(midpointX + 1, midpointY);
      stitch.lineTo(midpointX - 2, midpointY + 4);
      stitch.strokePath();
    } else if (
      collectible.id.endsWith("premium-2") ||
      collectible.id.includes("sunrise") ||
      collectible.id.includes("moonweave") ||
      collectible.id.includes("royal-seam")
    ) {
      stitch.fillStyle(palette.secondary, 0.9);
      stitch.fillPoints(
        [
          new Phaser.Math.Vector2(midpointX, midpointY - 3.5),
          new Phaser.Math.Vector2(midpointX + 2, midpointY),
          new Phaser.Math.Vector2(midpointX, midpointY + 3.5),
          new Phaser.Math.Vector2(midpointX - 2, midpointY),
        ],
        true,
      );
    }

    this.tweens.add({
      targets: stitch,
      alpha: 0,
      y: stitch.y + 3,
      duration: 250,
      ease: "Quad.Out",
      onComplete: () => stitch.destroy(),
    });
  }

  private clearImpactVfxLayers(): void {
    for (const group of this.activeImpactVfxGroups) {
      for (const layer of group) {
        if (layer.active) layer.destroy(true);
      }
    }
    this.activeImpactVfxGroups = [];
  }

  private createImpactVfxGroup(
    depths: readonly number[],
    lifetimeMs: number,
  ): Phaser.GameObjects.Container[] {
    const group = depths.map((depth) =>
      this.add.container(this.monster.x, this.monster.y).setDepth(depth),
    );
    this.activeImpactVfxGroups.push(group);
    while (this.activeImpactVfxGroups.length > 8) {
      const oldest = this.activeImpactVfxGroups.shift();
      for (const layer of oldest ?? []) {
        if (layer.active) layer.destroy(true);
      }
    }
    this.time.delayedCall(lifetimeMs, () => {
      this.activeImpactVfxGroups = this.activeImpactVfxGroups.filter(
        (candidate) => candidate !== group,
      );
      for (const layer of group) {
        if (layer.active) layer.destroy(true);
      }
    });
    return group;
  }

  private getImpactVfxSurfacePoint(
    worldAngle: number,
    offset = 0,
  ): Phaser.Math.Vector2 {
    const localAngle = normalizeAngle(worldAngle - this.monster.rotation);
    const surface = this.getMonsterSurfaceRadius(localAngle) + offset;
    return new Phaser.Math.Vector2(
      Math.cos(worldAngle) * surface,
      Math.sin(worldAngle) * surface,
    );
  }

  private spawnImpactVfxPulse(
    layer: Phaser.GameObjects.Container,
    radius: number,
    color: number,
    duration: number,
    delay = 0,
  ): void {
    const pulse = this.add
      .circle(0, 0, radius, color, 0.025)
      .setStrokeStyle(2, color, 0.66)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.82)
      .setAlpha(0.72);
    layer.add(pulse);
    this.tweens.add({
      targets: pulse,
      alpha: 0,
      scale: 1.18,
      duration,
      delay,
      ease: "Cubic.Out",
    });
  }

  private spawnMonsterImpactReaction(
    profile: NeedleImpactVfxProfile,
    isEmpowered: boolean,
  ): void {
    const duration = profile.durationMs;
    const count = profile.particleCount +
      (isEmpowered ? Math.max(2, Math.ceil(profile.particleCount * 0.38)) : 0);
    const sizeBoost = isEmpowered ? 1.12 : 1;
    const sampledRadius = Array.from({ length: 8 }, (_, index) => {
      const worldAngle = (Math.PI * 2 * index) / 8;
      return this.getMonsterSurfaceRadius(
        normalizeAngle(worldAngle - this.monster.rotation),
      );
    }).reduce((sum, radius) => sum + radius, 0) / 8;
    const radius = Phaser.Math.Clamp(sampledRadius, 72, 128) * sizeBoost;
    const needsBackLayer =
      profile.reaction === "wool-smoke" ||
      profile.reaction === "moon-mist" ||
      profile.reaction === "moon-tide";
    const groupLifetime = duration + count * 30 + 160;
    const [front, back = null] = this.createImpactVfxGroup(
      needsBackLayer ? [13, 5] : [13],
      groupLifetime,
    );

    this.spawnImpactVfxPulse(
      front,
      radius * 0.78,
      profile.secondary,
      Math.min(duration, 460),
    );
    if (isEmpowered) {
      this.spawnImpactVfxPulse(
        front,
        radius * 0.68,
        profile.accent,
        Math.min(duration, 520),
        55,
      );
    }

    if (profile.reaction === "wool-smoke") {
      const haze = this.add
        .ellipse(0, 2, radius * 1.72, radius * 1.38, profile.primary, 0.1)
        .setScale(0.82)
        .setAlpha(0.72);
      (back ?? front).add(haze);
      this.tweens.add({
        targets: haze,
        alpha: 0,
        scaleX: 1.18,
        scaleY: 1.28,
        y: haze.y - 12,
        duration,
        ease: "Sine.Out",
      });
      for (let index = 0; index < count; index += 1) {
        const angle =
          (Math.PI * 2 * index) / count + Phaser.Math.FloatBetween(-0.16, 0.16);
        const point = this.getImpactVfxSurfacePoint(angle, 3);
        const puffSize = Phaser.Math.Between(11, 17) * sizeBoost;
        const puff = this.add.container(point.x, point.y);
        puff.add([
          this.add.ellipse(0, 0, puffSize * 1.45, puffSize, profile.primary, 0.24),
          this.add.circle(
            puffSize * 0.32,
            -puffSize * 0.18,
            puffSize * 0.38,
            profile.secondary,
            0.18,
          ),
        ]);
        (index % 2 === 0 ? back ?? front : front).add(puff);
        const distance = Phaser.Math.Between(18, 29) * sizeBoost;
        this.tweens.add({
          targets: puff,
          x: puff.x + Math.cos(angle) * distance,
          y: puff.y + Math.sin(angle) * distance - Phaser.Math.Between(8, 16),
          alpha: 0,
          scale: Phaser.Math.FloatBetween(1.25, 1.65),
          rotation: Phaser.Math.FloatBetween(-0.35, 0.35),
          duration: Phaser.Math.Between(duration - 100, duration + 40),
          delay: Phaser.Math.Between(0, 70),
          ease: "Sine.Out",
        });
      }
      for (let index = 0; index < 4; index += 1) {
        const angle = (Math.PI * 2 * index) / 4 + Math.PI / 4;
        const point = this.getImpactVfxSurfacePoint(angle, 4);
        const fibre = this.add
          .rectangle(point.x, point.y, 2, 13, profile.accent, 0.78)
          .setRotation(angle + 0.35)
          .setBlendMode(Phaser.BlendModes.ADD);
        front.add(fibre);
        this.tweens.add({
          targets: fibre,
          x: fibre.x + Math.cos(angle) * 24,
          y: fibre.y + Math.sin(angle) * 24,
          alpha: 0,
          scaleY: 0.35,
          duration: 420,
          ease: "Cubic.Out",
        });
      }
      return;
    }

    if (profile.reaction === "button-sparks") {
      for (let index = 0; index < count; index += 1) {
        const angle =
          (Math.PI * 2 * index) / count + Phaser.Math.FloatBetween(-0.12, 0.12);
        const point = this.getImpactVfxSurfacePoint(angle, 1);
        const color = index % 4 === 0 ? profile.accent :
          index % 2 === 0 ? profile.secondary : profile.primary;
        const spark = this.add
          .star(point.x, point.y, 4, 1.3, Phaser.Math.Between(5, 8), color, 0.96)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setRotation(angle);
        front.add(spark);
        const distance = Phaser.Math.Between(23, 39) * sizeBoost;
        this.tweens.add({
          targets: spark,
          x: spark.x + Math.cos(angle) * distance,
          y: spark.y + Math.sin(angle) * distance,
          alpha: 0,
          scale: 0.18,
          rotation: spark.rotation + Phaser.Math.FloatBetween(0.6, 1.4),
          duration: Phaser.Math.Between(300, duration + 20),
          delay: Phaser.Math.Between(0, 90),
          ease: "Cubic.Out",
        });
      }
      return;
    }

    if (profile.reaction === "golden-thread") {
      for (let loopIndex = 0; loopIndex < 3; loopIndex += 1) {
        const loop = this.add.graphics();
        loop.lineStyle(
          loopIndex === 1 ? 2.2 : 1.5,
          loopIndex === 2 ? profile.accent : profile.primary,
          0.78,
        );
        loop.beginPath();
        loop.arc(
          0,
          0,
          radius * (0.82 + loopIndex * 0.1),
          -Math.PI * (0.82 - loopIndex * 0.1),
          Math.PI * (0.74 + loopIndex * 0.12),
        );
        loop.strokePath();
        loop.setRotation(loopIndex * 0.9 - 0.65).setScale(1.16);
        front.add(loop);
        this.tweens.add({
          targets: loop,
          alpha: 0,
          scale: 0.9,
          rotation: loop.rotation + (loopIndex % 2 === 0 ? 0.62 : -0.58),
          duration,
          ease: "Sine.InOut",
        });
      }
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
        const point = this.getImpactVfxSurfacePoint(angle, 5);
        const bead = this.add
          .circle(point.x, point.y, index % 2 === 0 ? 3.2 : 2.2, profile.secondary, 0.9)
          .setBlendMode(Phaser.BlendModes.ADD);
        front.add(bead);
        const tangentX = -Math.sin(angle) * 18;
        const tangentY = Math.cos(angle) * 18;
        this.tweens.add({
          targets: bead,
          x: bead.x + tangentX,
          y: bead.y + tangentY,
          alpha: 0,
          scale: 0.45,
          duration: duration - Phaser.Math.Between(20, 100),
          delay: index * 18,
          ease: "Sine.Out",
        });
      }
      return;
    }

    if (profile.reaction === "silk-stars") {
      for (let loopIndex = 0; loopIndex < 2; loopIndex += 1) {
        const ribbon = this.add.graphics();
        ribbon.lineStyle(1.5, loopIndex === 0 ? profile.primary : profile.secondary, 0.6);
        ribbon.beginPath();
        ribbon.arc(0, 0, radius * (0.82 + loopIndex * 0.13), -2.45, 1.65);
        ribbon.strokePath();
        ribbon.setRotation(loopIndex * 1.35).setScale(0.9, 0.78);
        front.add(ribbon);
        this.tweens.add({
          targets: ribbon,
          alpha: 0,
          rotation: ribbon.rotation + (loopIndex === 0 ? 0.52 : -0.46),
          scaleX: 1.12,
          scaleY: 0.94,
          duration,
          ease: "Sine.Out",
        });
      }
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count - Math.PI * 0.75;
        const point = this.getImpactVfxSurfacePoint(angle, 2);
        const star = this.add
          .star(point.x, point.y, 4, 1.4, Phaser.Math.Between(5, 9), index % 3 === 0 ? profile.accent : profile.primary, 0.92)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setScale(0.25);
        front.add(star);
        const tangent = Phaser.Math.Between(18, 30);
        this.tweens.add({
          targets: star,
          x: star.x - Math.sin(angle) * tangent,
          y: star.y + Math.cos(angle) * tangent - 9,
          alpha: 0,
          scale: Phaser.Math.FloatBetween(0.9, 1.3),
          rotation: Phaser.Math.FloatBetween(-0.8, 0.8),
          duration: duration - Phaser.Math.Between(0, 100),
          delay: index * 26,
          ease: "Sine.Out",
        });
      }
      return;
    }

    if (profile.reaction === "gem-shards") {
      const gemColors = [profile.primary, profile.secondary, profile.accent, 0xb388ff];
      for (let index = 0; index < count; index += 1) {
        const angle =
          (Math.PI * 2 * index) / count + Phaser.Math.FloatBetween(-0.1, 0.1);
        const point = this.getImpactVfxSurfacePoint(angle, 0);
        const gem = this.add
          .triangle(
            point.x,
            point.y,
            0,
            -Phaser.Math.Between(6, 10),
            Phaser.Math.Between(4, 7),
            5,
            -Phaser.Math.Between(3, 6),
            4,
            gemColors[index % gemColors.length],
            0.92,
          )
          .setStrokeStyle(1, profile.secondary, 0.62)
          .setRotation(angle + Math.PI / 2);
        front.add(gem);
        const distance = Phaser.Math.Between(27, 45) * sizeBoost;
        const tangent = Phaser.Math.Between(-10, 10);
        this.tweens.add({
          targets: gem,
          x: gem.x + Math.cos(angle) * distance - Math.sin(angle) * tangent,
          y: gem.y + Math.sin(angle) * distance + Math.cos(angle) * tangent,
          alpha: 0,
          scale: 0.3,
          rotation: gem.rotation + Phaser.Math.FloatBetween(-1.4, 1.4),
          duration: Phaser.Math.Between(360, duration),
          delay: Phaser.Math.Between(0, 65),
          ease: "Cubic.Out",
        });
      }
      return;
    }

    if (profile.reaction === "stitch-crown") {
      const crown = this.add.graphics();
      const crownY = -radius * 0.78;
      const crownWidth = Math.min(118, radius * 1.22);
      crown.lineStyle(3, profile.primary, 0.92);
      crown.beginPath();
      crown.moveTo(-crownWidth / 2, crownY + 18);
      for (let pointIndex = 0; pointIndex < 5; pointIndex += 1) {
        const x = -crownWidth / 2 + (crownWidth * pointIndex) / 4;
        crown.lineTo(x, crownY + (pointIndex % 2 === 0 ? 2 : 14));
      }
      crown.lineTo(crownWidth / 2, crownY + 18);
      crown.strokePath();
      crown.lineStyle(1.5, profile.secondary, 0.82);
      crown.lineBetween(-crownWidth / 2, crownY + 22, crownWidth / 2, crownY + 22);
      for (let pointIndex = 0; pointIndex < 5; pointIndex += 1) {
        const x = -crownWidth / 2 + (crownWidth * pointIndex) / 4;
        crown.fillStyle(profile.secondary, 0.9);
        crown.fillCircle(x, crownY + (pointIndex % 2 === 0 ? 2 : 14), 3);
      }
      front.add(crown);
      this.tweens.add({
        targets: crown,
        y: crown.y - 12,
        alpha: 0,
        scaleX: 1.08,
        scaleY: 1.08,
        duration,
        delay: 70,
        ease: "Sine.Out",
      });
      for (let index = 0; index < Math.max(4, Math.floor(count / 2)); index += 1) {
        const side = index % 2 === 0 ? -1 : 1;
        const scrap = this.add
          .rectangle(
            side * (radius * 0.72 + Phaser.Math.Between(0, 12)),
            -radius * 0.45 + Phaser.Math.Between(-8, 30),
            Phaser.Math.Between(4, 7),
            Phaser.Math.Between(9, 15),
            index % 3 === 0 ? profile.secondary : profile.accent,
            0.82,
          )
          .setRotation(Phaser.Math.FloatBetween(-0.7, 0.7));
        front.add(scrap);
        this.tweens.add({
          targets: scrap,
          y: scrap.y + Phaser.Math.Between(24, 42),
          x: scrap.x + side * Phaser.Math.Between(7, 16),
          alpha: 0,
          rotation: scrap.rotation + Phaser.Math.FloatBetween(-1.2, 1.2),
          duration: duration - Phaser.Math.Between(30, 120),
          ease: "Sine.In",
        });
      }
      return;
    }

    if (profile.reaction === "moon-mist") {
      const mistRibbon = this.add.graphics();
      mistRibbon.lineStyle(8, profile.primary, 0.12);
      mistRibbon.beginPath();
      mistRibbon.arc(0, 0, radius * 0.9, Math.PI * 0.38, Math.PI * 1.62);
      mistRibbon.strokePath();
      mistRibbon.lineStyle(3, profile.secondary, 0.36);
      mistRibbon.beginPath();
      mistRibbon.arc(0, 0, radius * 1.02, -Math.PI * 0.58, Math.PI * 0.48);
      mistRibbon.strokePath();
      (back ?? front).add(mistRibbon);
      this.tweens.add({
        targets: mistRibbon,
        alpha: 0,
        rotation: -0.38,
        scaleX: 1.13,
        scaleY: 1.06,
        y: -11,
        duration,
        ease: "Sine.Out",
      });
      for (let index = 0; index < count; index += 1) {
        const angle =
          Math.PI * 0.18 + (Math.PI * 1.64 * index) / Math.max(1, count - 1);
        const point = this.getImpactVfxSurfacePoint(angle, 1);
        if (index % 3 === 0) {
          const pearl = this.add
            .star(point.x, point.y, 4, 1.2, 5.5, profile.secondary, 0.86)
            .setBlendMode(Phaser.BlendModes.ADD);
          front.add(pearl);
          this.tweens.add({
            targets: pearl,
            x: pearl.x - Math.sin(angle) * 22,
            y: pearl.y + Math.cos(angle) * 22 - 12,
            alpha: 0,
            scale: 0.3,
            rotation: -0.7,
            duration: duration - Phaser.Math.Between(70, 160),
            delay: index * 18,
            ease: "Sine.Out",
          });
        } else {
          const mist = this.add
            .ellipse(0, 0, Phaser.Math.Between(15, 24), Phaser.Math.Between(8, 13), profile.primary, 0.16);
          const puff = this.add.container(point.x, point.y, mist);
          (index % 2 === 0 ? back ?? front : front).add(puff);
          this.tweens.add({
            targets: puff,
            x: puff.x - Math.sin(angle) * Phaser.Math.Between(13, 24),
            y: puff.y - Phaser.Math.Between(16, 30),
            alpha: 0,
            scale: Phaser.Math.FloatBetween(1.35, 1.75),
            rotation: Phaser.Math.FloatBetween(-0.32, 0.32),
            duration: duration - Phaser.Math.Between(0, 100),
            delay: index * 14,
            ease: "Sine.Out",
          });
        }
      }
      return;
    }

    if (profile.reaction === "runic-shards") {
      const runes = this.add.graphics();
      runes.lineStyle(2, profile.secondary, 0.8);
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count;
        const inner = radius * 0.82;
        const outer = radius * 0.97;
        const tangentX = -Math.sin(angle) * 4;
        const tangentY = Math.cos(angle) * 4;
        const x = Math.cos(angle) * inner;
        const y = Math.sin(angle) * inner;
        runes.lineBetween(x - tangentX, y - tangentY, x + tangentX, y + tangentY);
        runes.lineBetween(
          Math.cos(angle) * inner,
          Math.sin(angle) * inner,
          Math.cos(angle) * outer,
          Math.sin(angle) * outer,
        );
      }
      front.add(runes);
      this.tweens.add({
        targets: runes,
        alpha: 0,
        rotation: 0.5,
        scale: 1.12,
        duration,
        ease: "Cubic.Out",
      });
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count + 0.18;
        const point = this.getImpactVfxSurfacePoint(angle, 0);
        const shard = this.add
          .triangle(point.x, point.y, 0, -8, 5, 5, -4, 4, index % 2 === 0 ? profile.primary : profile.accent, 0.88)
          .setStrokeStyle(1, profile.secondary, 0.7)
          .setRotation(angle + Math.PI / 2);
        front.add(shard);
        const distance = Phaser.Math.Between(20, 34);
        this.tweens.add({
          targets: shard,
          x: shard.x + Math.cos(angle) * distance,
          y: shard.y + Math.sin(angle) * distance + Phaser.Math.Between(4, 14),
          alpha: 0,
          rotation: shard.rotation + Phaser.Math.FloatBetween(-1.1, 1.1),
          scale: 0.35,
          duration: duration - Phaser.Math.Between(50, 160),
          delay: index * 30,
          ease: "Cubic.Out",
        });
      }
      return;
    }

    if (profile.reaction === "lightning-wrap") {
      const lightning = this.add.graphics();
      lightning.lineStyle(isEmpowered ? 3.2 : 2.4, profile.primary, 0.96);
      lightning.beginPath();
      const nodes = 14;
      for (let index = 0; index <= nodes; index += 1) {
        const angle = (Math.PI * 2 * index) / nodes;
        const localRadius = radius * 0.9 + (index % 2 === 0 ? 8 : -5);
        const x = Math.cos(angle) * localRadius;
        const y = Math.sin(angle) * localRadius;
        if (index === 0) lightning.moveTo(x, y);
        else lightning.lineTo(x, y);
      }
      lightning.strokePath();
      lightning.lineStyle(1.4, profile.accent, 0.9);
      for (let boltIndex = 0; boltIndex < 3; boltIndex += 1) {
        const angle = -Math.PI * 0.7 + boltIndex * Math.PI * 0.7;
        const from = this.getImpactVfxSurfacePoint(angle, 4);
        const to = this.getImpactVfxSurfacePoint(angle + 0.72, 4);
        lightning.beginPath();
        lightning.moveTo(from.x, from.y);
        lightning.lineTo((from.x + to.x) / 2 + Phaser.Math.Between(-10, 10), (from.y + to.y) / 2 + Phaser.Math.Between(-10, 10));
        lightning.lineTo(to.x, to.y);
        lightning.strokePath();
      }
      lightning.setBlendMode(Phaser.BlendModes.ADD);
      front.add(lightning);
      this.tweens.add({
        targets: lightning,
        alpha: { from: 1, to: 0.22 },
        scaleX: { from: 0.94, to: 1.04 },
        scaleY: { from: 1.03, to: 0.96 },
        duration: 55,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          if (!lightning.active) return;
          this.tweens.add({
            targets: lightning,
            alpha: 0,
            scale: 1.08,
            duration: Math.max(100, duration - 220),
            ease: "Cubic.Out",
          });
        },
      });
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count;
        const point = this.getImpactVfxSurfacePoint(angle, 2);
        const spark = this.add
          .star(point.x, point.y, 4, 1, 5, index % 2 === 0 ? profile.secondary : profile.primary, 0.94)
          .setBlendMode(Phaser.BlendModes.ADD);
        front.add(spark);
        this.tweens.add({
          targets: spark,
          x: spark.x + Math.cos(angle) * Phaser.Math.Between(18, 31),
          y: spark.y + Math.sin(angle) * Phaser.Math.Between(18, 31),
          alpha: 0,
          scale: 0.15,
          duration: Phaser.Math.Between(210, duration),
          delay: Phaser.Math.Between(0, 55),
          ease: "Cubic.Out",
        });
      }
      return;
    }

    if (profile.reaction === "moon-tide") {
      const tide = this.add.graphics();
      tide.lineStyle(9, profile.primary, 0.12);
      tide.beginPath();
      tide.arc(-radius * 0.05, 0, radius * 0.95, -Math.PI * 0.74, Math.PI * 0.72);
      tide.strokePath();
      tide.lineStyle(2.5, profile.secondary, 0.72);
      tide.beginPath();
      tide.arc(radius * 0.08, 2, radius * 0.98, Math.PI * 0.3, Math.PI * 1.72);
      tide.strokePath();
      (back ?? front).add(tide);
      this.tweens.add({
        targets: tide,
        alpha: 0,
        rotation: 0.34,
        scaleX: 1.14,
        scaleY: 1.06,
        y: -8,
        duration,
        ease: "Sine.Out",
      });
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
        const point = this.getImpactVfxSurfacePoint(angle, 3);
        const mote = index % 3 === 0
          ? this.add.star(point.x, point.y, 4, 1.2, 5.5, profile.accent, 0.9)
          : this.add.ellipse(point.x, point.y, 4, 10, profile.primary, 0.66);
        mote.setBlendMode(Phaser.BlendModes.ADD).setRotation(angle);
        front.add(mote);
        const tangent = Phaser.Math.Between(18, 34);
        this.tweens.add({
          targets: mote,
          x: mote.x - Math.sin(angle) * tangent,
          y: mote.y + Math.cos(angle) * tangent - Phaser.Math.Between(8, 18),
          alpha: 0,
          scale: 0.24,
          rotation: mote.rotation + 0.8,
          duration: duration - Phaser.Math.Between(20, 130),
          delay: index * 18,
          ease: "Sine.Out",
        });
      }
      return;
    }

    if (profile.reaction === "velvet-bloom") {
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
        const point = this.getImpactVfxSurfacePoint(angle, 2);
        const petal = this.add
          .ellipse(
            point.x,
            point.y,
            Phaser.Math.Between(8, 13),
            Phaser.Math.Between(17, 25),
            index % 2 === 0 ? profile.primary : profile.secondary,
            0.9,
          )
          .setStrokeStyle(1, profile.accent, 0.52)
          .setRotation(angle + Math.PI / 2)
          .setScale(0.48);
        front.add(petal);
        const outward = Phaser.Math.Between(24, 41) * sizeBoost;
        const curl = Phaser.Math.Between(16, 31);
        this.tweens.add({
          targets: petal,
          x: petal.x + Math.cos(angle) * outward - Math.sin(angle) * curl,
          y: petal.y + Math.sin(angle) * outward + Math.cos(angle) * curl + 8,
          alpha: 0,
          scaleX: 0.22,
          scaleY: 1.08,
          rotation: petal.rotation + Phaser.Math.FloatBetween(0.9, 1.5),
          duration: duration - Phaser.Math.Between(0, 110),
          delay: index * 20,
          ease: "Sine.Out",
        });
        if (index % 3 === 0) {
          const thorn = this.add
            .triangle(point.x, point.y, 0, -8, 3.5, 5, -3.5, 5, profile.accent, 0.88)
            .setRotation(angle + Math.PI / 2);
          front.add(thorn);
          this.tweens.add({
            targets: thorn,
            x: thorn.x + Math.cos(angle) * 31,
            y: thorn.y + Math.sin(angle) * 31,
            alpha: 0,
            rotation: thorn.rotation + 0.55,
            duration: 430,
            ease: "Cubic.Out",
          });
        }
      }
      return;
    }

    if (profile.reaction === "clockwork-burst") {
      const gear = this.add
        .star(0, 0, 12, radius * 0.72, radius * 0.86, profile.secondary, 0.08)
        .setStrokeStyle(2.2, profile.secondary, 0.72);
      const innerGear = this.add
        .star(0, 0, 10, radius * 0.42, radius * 0.53, profile.primary, 0.05)
        .setStrokeStyle(1.5, profile.primary, 0.74);
      front.add([gear, innerGear]);
      this.tweens.add({
        targets: gear,
        alpha: 0,
        rotation: 0.58,
        scale: 1.08,
        duration,
        ease: "Cubic.Out",
      });
      this.tweens.add({
        targets: innerGear,
        alpha: 0,
        rotation: -0.9,
        scale: 0.88,
        duration: duration - 40,
        ease: "Cubic.Out",
      });
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count;
        const point = this.getImpactVfxSurfacePoint(angle, 3);
        const spark = index % 3 === 0
          ? this.add.star(point.x, point.y, 6, 3, 7, profile.secondary, 0.9)
          : this.add.rectangle(point.x, point.y, 3, 13, profile.primary, 0.94);
        spark.setRotation(angle + Math.PI / 2).setBlendMode(Phaser.BlendModes.ADD);
        front.add(spark);
        const distance = Phaser.Math.Between(24, 43) * sizeBoost;
        this.tweens.add({
          targets: spark,
          x: spark.x + Math.cos(angle) * distance,
          y: spark.y + Math.sin(angle) * distance,
          alpha: 0,
          scale: 0.18,
          rotation: spark.rotation + Phaser.Math.FloatBetween(-1, 1),
          duration: Phaser.Math.Between(330, duration),
          delay: Phaser.Math.Between(0, 70),
          ease: "Cubic.Out",
        });
      }
      return;
    }

    if (profile.reaction === "royal-seam") {
      const royal = this.add.graphics();
      royal.lineStyle(2.4, profile.secondary, 0.84);
      for (let index = 0; index < 12; index += 1) {
        const angle = (Math.PI * 2 * index) / 12;
        const tangentX = -Math.sin(angle) * 5;
        const tangentY = Math.cos(angle) * 5;
        const x = Math.cos(angle) * radius * 0.88;
        const y = Math.sin(angle) * radius * 0.88;
        royal.lineBetween(x - tangentX, y - tangentY, x + tangentX, y + tangentY);
      }
      const crownY = -radius * 0.82;
      royal.lineStyle(3, profile.accent, 0.94);
      royal.beginPath();
      royal.moveTo(-30, crownY + 18);
      royal.lineTo(-24, crownY - 2);
      royal.lineTo(-8, crownY + 10);
      royal.lineTo(0, crownY - 8);
      royal.lineTo(9, crownY + 10);
      royal.lineTo(25, crownY - 2);
      royal.lineTo(30, crownY + 18);
      royal.strokePath();
      front.add(royal);
      this.tweens.add({
        targets: royal,
        alpha: 0,
        y: -12,
        rotation: 0.18,
        scale: 1.1,
        duration,
        ease: "Sine.Out",
      });
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
        const point = this.getImpactVfxSurfacePoint(angle, 2);
        const jewel = this.add
          .star(point.x, point.y, 4, 1.5, index % 3 === 0 ? 8 : 5.5, index % 3 === 0 ? profile.accent : profile.primary, 0.94)
          .setBlendMode(Phaser.BlendModes.ADD);
        front.add(jewel);
        this.tweens.add({
          targets: jewel,
          x: jewel.x + Math.cos(angle) * Phaser.Math.Between(18, 34),
          y: jewel.y + Math.sin(angle) * Phaser.Math.Between(18, 34) - 10,
          alpha: 0,
          scale: 0.18,
          rotation: Phaser.Math.FloatBetween(-1.1, 1.1),
          duration: duration - Phaser.Math.Between(60, 150),
          delay: index * 22,
          ease: "Cubic.Out",
        });
      }
      return;
    }

    for (let index = 0; index < count; index += 1) {
      const angle =
        (Math.PI * 2 * index) / count - Math.PI / 2 + Phaser.Math.FloatBetween(-0.08, 0.08);
      const point = this.getImpactVfxSurfacePoint(angle, 1);
      const petal = this.add
        .ellipse(
          point.x,
          point.y,
          Phaser.Math.Between(7, 11),
          Phaser.Math.Between(15, 22),
          index % 2 === 0 ? profile.primary : profile.secondary,
          0.88,
        )
        .setRotation(angle + Math.PI / 2)
        .setScale(0.55);
      front.add(petal);
      const outward = Phaser.Math.Between(22, 38) * sizeBoost;
      const swirl = Phaser.Math.Between(15, 28);
      this.tweens.add({
        targets: petal,
        x: petal.x + Math.cos(angle) * outward - Math.sin(angle) * swirl,
        y: petal.y + Math.sin(angle) * outward + Math.cos(angle) * swirl - 11,
        alpha: 0,
        scaleX: 0.22,
        scaleY: 1.08,
        rotation: petal.rotation + Phaser.Math.FloatBetween(0.75, 1.35),
        duration: duration - Phaser.Math.Between(0, 120),
        delay: index * 24,
        ease: "Sine.Out",
      });
    }
  }

  private spawnEquippedNeedleImpact(
    localAngle: number,
    isEmpowered = false,
  ): void {
    const collectible = this.getEquippedNeedleCosmetic("needle-impact");
    if (!collectible) return;

    const artFileName = getWorkshopImpactArtFileName(collectible.id);
    if (artFileName) {
      this.spawnWorkshopImpactArt(
        localAngle,
        collectible,
        artFileName,
        isEmpowered,
      );
      return;
    }

    const palette = getNeedleCosmeticPalette(collectible.id);
    const motif = getNeedleImpactMotif(collectible.id);
    const worldAngle = localAngle + this.monster.rotation;
    const surface = this.getMonsterSurfaceRadius(localAngle);
    const impact = this.add
      .graphics()
      .setPosition(
        this.monster.x + Math.cos(worldAngle) * surface,
        this.monster.y + Math.sin(worldAngle) * surface,
      )
      .setDepth(14)
      .setRotation(worldAngle - Math.PI / 2);

    impact.lineStyle(2.2, palette.primary, 0.96);
    if (motif === "lightning") {
      for (const direction of [-1, 1]) {
        impact.beginPath();
        impact.moveTo(direction * 2, -2);
        impact.lineTo(direction * 11, -10);
        impact.lineTo(direction * 7, -13);
        impact.lineTo(direction * 18, -21);
        impact.strokePath();
      }
    } else if (motif === "crown") {
      impact.beginPath();
      impact.moveTo(-18, 2);
      impact.lineTo(-14, -15);
      impact.lineTo(-5, -7);
      impact.lineTo(0, -19);
      impact.lineTo(6, -7);
      impact.lineTo(15, -15);
      impact.lineTo(18, 2);
      impact.closePath();
      impact.strokePath();
      impact.lineBetween(-17, 3, 17, 3);
    } else if (motif === "petals") {
      impact.fillStyle(palette.primary, 0.82);
      for (let index = 0; index < 5; index += 1) {
        const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2;
        const tangentX = -Math.sin(angle);
        const tangentY = Math.cos(angle);
        const innerX = Math.cos(angle) * 5;
        const innerY = Math.sin(angle) * 5;
        const outerX = Math.cos(angle) * 19;
        const outerY = Math.sin(angle) * 19;
        impact.fillPoints(
          [
            new Phaser.Math.Vector2(innerX, innerY),
            new Phaser.Math.Vector2(
              (innerX + outerX) / 2 + tangentX * 3.5,
              (innerY + outerY) / 2 + tangentY * 3.5,
            ),
            new Phaser.Math.Vector2(outerX, outerY),
            new Phaser.Math.Vector2(
              (innerX + outerX) / 2 - tangentX * 3.5,
              (innerY + outerY) / 2 - tangentY * 3.5,
            ),
          ],
          true,
        );
      }
    } else if (motif === "shards") {
      impact.fillStyle(palette.primary, 0.88);
      for (let index = 0; index < 5; index += 1) {
        const angle = (Math.PI * 2 * index) / 5;
        const directionX = Math.cos(angle);
        const directionY = Math.sin(angle);
        const tangentX = -directionY;
        const tangentY = directionX;
        impact.fillPoints(
          [
            new Phaser.Math.Vector2(directionX * 7, directionY * 7),
            new Phaser.Math.Vector2(
              directionX * 13 + tangentX * 2.5,
              directionY * 13 + tangentY * 2.5,
            ),
            new Phaser.Math.Vector2(directionX * 23, directionY * 23),
            new Phaser.Math.Vector2(
              directionX * 13 - tangentX * 2.5,
              directionY * 13 - tangentY * 2.5,
            ),
          ],
          true,
        );
      }
    } else if (motif === "stars") {
      impact.fillStyle(palette.primary, 0.94);
      for (const [x, y, size] of [
        [-12, -9, 5],
        [12, -13, 4],
        [4, 11, 3],
      ] as const) {
        impact.fillPoints(
          [
            new Phaser.Math.Vector2(x, y - size),
            new Phaser.Math.Vector2(x + size * 0.45, y),
            new Phaser.Math.Vector2(x, y + size),
            new Phaser.Math.Vector2(x - size * 0.45, y),
          ],
          true,
        );
      }
    } else {
      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI * 2 * index) / 6;
        const tangentX = -Math.sin(angle);
        const tangentY = Math.cos(angle);
        const centerX = Math.cos(angle) * 13;
        const centerY = Math.sin(angle) * 13;
        impact.lineBetween(
          centerX - tangentX * 4,
          centerY - tangentY * 4,
          centerX + tangentX * 4,
          centerY + tangentY * 4,
        );
      }
    }

    impact.lineStyle(1.7, palette.secondary, 1);
    impact.lineBetween(-5, -5, 5, 5);
    impact.lineBetween(5, -5, -5, 5);
    this.tweens.add({
      targets: impact,
      alpha: 0,
      scaleX: 1.34,
      scaleY: 1.34,
      rotation: impact.rotation + (motif === "lightning" ? 0 : 0.14),
      duration: motif === "crown" ? 360 : 280,
      ease: "Quad.Out",
      onComplete: () => impact.destroy(),
    });
  }

  private spawnWorkshopImpactArt(
    localAngle: number,
    collectible: WorkshopCollectible,
    artFileName: string,
    isEmpowered: boolean,
  ): void {
    const vfxProfile = getNeedleImpactVfxProfile(collectible.id);
    const palette = vfxProfile ?? getNeedleCosmeticPalette(collectible.id);
    const motif = getNeedleImpactMotif(collectible.id);
    const worldAngle = localAngle + this.monster.rotation;
    const surface = this.getMonsterSurfaceRadius(localAngle);
    const impactX = this.monster.x + Math.cos(worldAngle) * surface;
    const impactY = this.monster.y + Math.sin(worldAngle) * surface;
    const baseDisplaySize =
      vfxProfile?.reaction === "stitch-crown" ||
      vfxProfile?.reaction === "royal-seam" ? 94 :
        vfxProfile?.reaction === "lightning-wrap" ? 92 :
          vfxProfile?.reaction === "dawn-petals" ||
          vfxProfile?.reaction === "moon-mist" ||
          vfxProfile?.reaction === "moon-tide" ||
          vfxProfile?.reaction === "clockwork-burst" ? 90 : 84;
    const displaySize = baseDisplaySize + (isEmpowered ? 10 : 0);
    const duration = vfxProfile
      ? Math.min(390, Math.round(vfxProfile.durationMs * 0.55))
      : motif === "lightning" ? 210 : motif === "crown" ? 330 : 270;
    const baseRotation =
      vfxProfile?.reaction === "stitch-crown" ||
      vfxProfile?.reaction === "royal-seam"
      ? 0
      : worldAngle - Math.PI / 2;
    const entryRotationOffset =
      vfxProfile?.reaction === "golden-thread" ? -0.34 :
        vfxProfile?.reaction === "dawn-petals" ? -0.28 :
          vfxProfile?.reaction === "moon-tide" ? -0.18 :
          vfxProfile?.reaction === "button-sparks" ? -0.2 :
            vfxProfile?.reaction === "silk-stars" ? 0.14 : 0;

    const artwork = this.add
      .image(
        impactX,
        impactY,
        getWorkshopImpactTextureKey(artFileName),
      )
      .setDepth(15)
      .setRotation(baseRotation + entryRotationOffset)
      .setDisplaySize(displaySize, displaySize)
      .setAlpha(0.34);
    const finalScaleX = artwork.scaleX;
    const finalScaleY = artwork.scaleY;
    artwork.setScale(
      finalScaleX * (vfxProfile?.reaction === "lightning-wrap" ? 0.18 : 0.28),
      finalScaleY * (vfxProfile?.reaction === "lightning-wrap" ? 0.58 : 0.28),
    );

    if (vfxProfile) {
      this.spawnMonsterImpactReaction(vfxProfile, isEmpowered);
    }

    const contact = this.add
      .circle(impactX, impactY, isEmpowered ? 7 : 5, palette.secondary, 0.96)
      .setDepth(16)
      .setBlendMode(Phaser.BlendModes.ADD);
    const ring = this.add
      .circle(impactX, impactY, 7, palette.primary, 0.08)
      .setStrokeStyle(isEmpowered ? 3 : 2, palette.secondary, 0.92)
      .setDepth(14)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: contact,
      alpha: 0,
      scale: isEmpowered ? 4.2 : 3.2,
      duration: 140,
      ease: "Quad.Out",
      onComplete: () => contact.destroy(),
    });
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: isEmpowered ? 3.4 : 2.7,
      duration: 210,
      ease: "Cubic.Out",
      onComplete: () => ring.destroy(),
    });
    this.tweens.add({
      targets: artwork,
      alpha: 1,
      scaleX: finalScaleX,
      scaleY: finalScaleY,
      duration: 78,
      ease: "Back.Out",
      onComplete: () => {
        const exitScale = vfxProfile?.reaction === "golden-thread"
          ? 0.88
          : isEmpowered ? 1.34 : 1.2;
        const exitRotation =
          vfxProfile?.reaction === "stitch-crown" ||
          vfxProfile?.reaction === "royal-seam" ? 0 :
            vfxProfile?.reaction === "lightning-wrap" ? baseRotation + 0.04 :
              baseRotation + 0.12;
        this.tweens.add({
          targets: artwork,
          alpha: 0,
          scaleX: finalScaleX * exitScale,
          scaleY: finalScaleY * exitScale,
          rotation: exitRotation,
          y:
            vfxProfile?.reaction === "stitch-crown" ||
            vfxProfile?.reaction === "royal-seam"
              ? impactY - 11
              : impactY,
          duration,
          ease: "Quad.Out",
          onComplete: () => artwork.destroy(),
        });
      },
    });

    const fragmentCount = vfxProfile ? 0 : isEmpowered ? 8 : 5;
    for (let index = 0; index < fragmentCount; index += 1) {
      const spread = index / (fragmentCount - 1) - 0.5;
      const fragmentAngle =
        worldAngle + spread * Math.PI * 1.45 + Phaser.Math.FloatBetween(-0.16, 0.16);
      const distance = Phaser.Math.Between(isEmpowered ? 26 : 20, isEmpowered ? 44 : 34);
      const fragment = this.add
        .ellipse(
          impactX,
          impactY,
          Phaser.Math.Between(2, 4),
          Phaser.Math.Between(5, 9),
          index % 2 === 0 ? palette.primary : palette.secondary,
          0.9,
        )
        .setDepth(14)
        .setRotation(fragmentAngle);
      this.tweens.add({
        targets: fragment,
        x: impactX + Math.cos(fragmentAngle) * distance,
        y: impactY + Math.sin(fragmentAngle) * distance,
        alpha: 0,
        scaleX: 0.35,
        scaleY: 0.35,
        rotation: fragment.rotation + Phaser.Math.FloatBetween(-0.7, 0.7),
        duration: Phaser.Math.Between(180, isEmpowered ? 300 : 250),
        ease: "Cubic.Out",
        onComplete: () => fragment.destroy(),
      });
    }
  }

  private spawnHitText(isEmpowered: boolean, stitchPower: number): void {
    const text = this.add
      .text(
        MONSTER_X + Phaser.Math.Between(-35, 35),
        MONSTER_Y - 15,
        isEmpowered ? `★ СТЕЖОК ×${stitchPower}` : "+СТЕЖОК",
        {
          fontFamily: "Inter, Segoe UI, sans-serif",
          fontSize: isEmpowered ? "14px" : "13px",
          fontStyle: "bold",
          color: isEmpowered ? "#e8b44d" : "#f2e3c6",
          stroke: "#25324a",
          strokeThickness: 4,
        },
      )
      .setOrigin(0.5)
      .setDepth(12);
    this.tweens.add({
      targets: text,
      y: text.y - 45,
      alpha: 0,
      duration: 560,
      ease: "Quad.Out",
      onComplete: () => text.destroy(),
    });
  }

  private updateHealth(): void {
    const remaining = Math.max(0, this.requiredHits - this.hits);
    this.healthBar.scaleX = remaining / this.requiredHits;
    this.healthText.setText(remaining + " стежков осталось");
  }

  private refreshShieldText(): void {
    this.shieldText.setText(
      this.shieldCharges > 0 ? "◆ Щит: " + this.shieldCharges : "",
    );
  }

  private winStage(): void {
    if (this.state !== "playing") return;

    this.state = "won";
    this.setCombatHudVisible(false);
    this.roomEffectText.setAlpha(0);
    const firstWeeklyClear =
      this.raidMode === "weekly" && this.weeklyNode
        ? (this.progression.weeklyRoute.clearsByNode[this.weeklyNode.id] ?? 0) === 0
        : false;
    const reward =
      this.raidMode === "campaign"
        ? getStageReward(this.stage)
        : firstWeeklyClear
          ? this.currentMonster.isBoss || this.currentMonster.isMiniBoss
            ? 3
            : 2
          : 0;
    let nextProgression =
      this.raidMode === "campaign"
        ? recordVictory(
            this.progression,
            this.stage,
            this.currentMonster.isBoss === true,
            reward,
          )
        : recordChallengeVictory(
            this.progression,
            this.currentMonster.isBoss === true,
            reward,
          );
    const victoryKind: NeedleMasteryVictoryKind = this.currentMonster.isBoss
      ? "boss"
      : this.currentMonster.isMiniBoss
        ? "mini-boss"
        : "regular";
    const dailyContext = getDailySelectionContext(
      nextProgression.highestStageCleared,
      nextProgression.ownedNeedles,
    );
    nextProgression = {
      ...nextProgression,
      needleMastery: recordNeedleMasteryVictory(
        nextProgression.needleMastery,
        nextProgression.equippedNeedle,
        victoryKind,
      ),
      dailySystems: recordDailyGameplayEvent(
        nextProgression.dailySystems,
        {
          type: "victory",
          needleId: nextProgression.equippedNeedle,
          roomId: this.currentRoom.id,
          monsterId: this.currentMonster.id,
          isBoss: this.currentMonster.isBoss,
          isMiniBoss: this.currentMonster.isMiniBoss,
          perfect: !this.stageHadCollision,
          maxAccurateStreak: this.maxAccurateStreak,
        },
        new Date(),
        dailyContext,
      ),
      seasonPass: recordSeasonPassEvent(
        nextProgression.seasonPass,
        "stage-victory",
      ),
    };
    if (this.currentMonster.isBoss) {
      nextProgression = {
        ...nextProgression,
        seasonPass: recordSeasonPassEvent(
          nextProgression.seasonPass,
          "boss-victory",
        ),
      };
    }
    if (this.raidMode === "weekly" && this.weeklyNode) {
      const weeklySeasonPass = firstWeeklyClear
        ? recordSeasonPassEvent(
            nextProgression.seasonPass,
            "weekly-node-completed",
          )
        : nextProgression.seasonPass;
      nextProgression = {
        ...nextProgression,
        weeklyRoute: completeWeeklyRouteNode(
          nextProgression.weeklyRoute,
          this.weeklyRoute,
          this.weeklyNode.id,
        ),
        seasonPass: weeklySeasonPass,
      };
    }
    this.progression = nextProgression;
    this.threadText.setText("✦ " + this.progression.thread + " нитей");
    this.persistProgress();
    this.sfx.win();

    this.cameras.main.flash(240, 232, 180, 77, false);
    this.time.delayedCall(420, () => {
      const weeklyProgress =
        this.raidMode === "weekly" && this.weeklyNode
          ? `\nУзел ${this.weeklyNode.order}/5 завершён.`
          : "";
      this.showVictoryOverlay(
        this.currentMonster.isBoss
          ? "Босс распорот!"
          : this.currentMonster.isMiniBoss
            ? "Мини-босс зашит!"
            : "Кошмар зашит!",
        this.currentMonster.name +
          " больше не тревожит комнату.\n" +
          (reward > 0
            ? `Награда: ${reward} нитей`
            : "Повторный узел: без дополнительных нитей") +
          weeklyProgress,
        this.currentRoom.accentColor,
        this.currentMonster.isBoss
          ? "КОМНАТА ОЧИЩЕНА"
          : this.currentMonster.isMiniBoss
            ? "ПРОМЕЖУТОЧНАЯ УГРОЗА СНЯТА"
            : "ПОБЕДА",
      );
    });
  }

  private failRaid(): void {
    if (this.state !== "playing") return;

    this.state = "failed";
    this.setCombatHudVisible(false);
    this.roomEffectText.setAlpha(0);
    const lossCadence = recordLoss(this.progression.adCadence);
    const defeatProgression = {
      ...this.progression,
      adCadence: lossCadence.state,
      dailySystems: recordDailyGameplayEvent(
        this.progression.dailySystems,
        { type: "defeat" },
        new Date(),
        getDailySelectionContext(
          this.progression.highestStageCleared,
          this.progression.ownedNeedles,
        ),
      ),
    };
    this.progression =
      this.raidMode === "campaign"
        ? resetCampaignAfterDefeat(defeatProgression)
        : defeatProgression;
    this.persistProgress();
    this.sfx.fail();
    this.cameras.main.shake(240, 0.009);
    this.flashMonster(0xe56b6f);

    this.time.delayedCall(300, () => {
      this.tipText.setText(
        this.raidMode === "weekly"
          ? `Недельный путь оборвался на узле ${this.weeklyNode?.order ?? 1}`
          : `Нить оборвалась на этапе ${this.stage} · рекорд ${this.progression.highestStageCleared}`,
      );
      this.closeOverlay();
      this.clearImpactVfxLayers();
      this.state = "menu";
      this.sfx.setMusicTheme("menu");
      this.menu.show(
        this.progression,
        this.raidMode === "weekly" ? "quests" : "home",
        this.raidMode === "weekly"
          ? `Недельный путь оборвался на узле ${this.weeklyNode?.order ?? 1}`
          : `Поход окончен на этапе ${this.stage} · новый рейд с этапа 1`,
      );
      if (lossCadence.shouldShowInterstitial) {
        this.queueLossInterstitial();
      }
    });
  }

  private queueLossInterstitial(): void {
    if (this.lossInterstitialPending) return;
    let tracked!: Promise<void>;
    tracked = this.platform
      .showInterstitialAd()
      .then(() => undefined, () => undefined)
      .finally(() => {
        if (this.lossInterstitialPending === tracked) {
          this.lossInterstitialPending = null;
        }
      });
    this.lossInterstitialPending = tracked;
  }

  private advanceStage(): void {
    const previousRoomId = this.currentRoom.id;
    this.closeOverlay();
    this.state = "transition";
    this.inputCooldownUntil = this.time.now + 240;
    if (this.raidMode === "weekly") {
      const status = getWeeklyRouteStatus(
        this.progression.weeklyRoute,
        this.weeklyRoute,
      );
      this.weeklyNode = status.nextNode;
      this.weeklyModifier = getWeeklyModifier(this.weeklyNode.modifierId);
      this.stage = this.getWeeklyDifficultyStage(this.weeklyNode);
    } else {
      this.stage += 1;
    }
    this.createMonster();
    this.beginPlaying(
      getNextStageTip(
        previousRoomId,
        this.currentRoom,
        this.currentMonster,
      ),
    );
  }

  private resolveVictory(choice: VictoryChoice): void {
    if (this.raidMode === "weekly") {
      const finishedFirstLap = this.weeklyNode?.order === 5;
      if (choice === "continue" && !finishedFirstLap) {
        this.advanceStage();
        return;
      }

      this.persistProgress();
      this.closeOverlay();
      this.clearImpactVfxLayers();
      this.state = "menu";
      this.setCombatHudVisible(false);
      this.sfx.ui();
      this.sfx.setMusicTheme("menu");
      this.menu.show(
        this.progression,
        "quests",
        finishedFirstLap
          ? "Недельный маршрут завершён — забери эмблему"
          : `Недельный путь сохранён · следующий узел ${getWeeklyRouteStatus(this.progression.weeklyRoute, this.weeklyRoute).nextNode.order}/5`,
      );
      return;
    }

    const destination = resolveVictoryChoice(choice);
    if (destination.kind === "next-stage") {
      this.advanceStage();
      return;
    }

    if (destination.persistProgress) this.persistProgress();
    this.closeOverlay();
    this.clearImpactVfxLayers();
    this.state = "menu";
    this.setCombatHudVisible(false);
    this.tipText.setText(`Путь сохранён после этапа ${this.stage}`);
    this.sfx.ui();
    this.sfx.setMusicTheme("menu");
    this.menu.show(
      this.progression,
      "home",
      `Прогресс сохранён · этап ${this.stage} пройден`,
    );
  }

  private beginPlaying(tip: string): void {
    this.closeOverlay();
    this.inputCooldownUntil = this.time.now + 240;
    this.state = "playing";
    this.setCombatHudVisible(true);
    this.refreshAbilityHud();
    this.tipText.setText(tip);
    this.sfx.ui();
  }

  private showWorkshop(
    continueAction: () => void,
    continueLabel: string,
    heading = "Мастерская Эли",
  ): void {
    this.closeOverlay();
    this.clearImpactVfxLayers();
    this.state = "workshop";
    this.setCombatHudVisible(false);

    const overlay = this.add.container(0, 0).setDepth(100);
    const shade = this.add
      .rectangle(
        WIDTH / 2,
        HEIGHT / 2,
        this.scale.gameSize.width,
        this.scale.gameSize.height,
        0x091316,
        0.82,
      )
      .setName("viewport-shade")
      .setInteractive();
    const card = this.add.graphics();
    card.fillStyle(0x1e3042, 0.99);
    card.fillRoundedRect(20, 38, WIDTH - 40, 690, 25);
    card.lineStyle(3, 0xe8b44d, 0.5);
    card.strokeRoundedRect(20, 38, WIDTH - 40, 690, 25);

    const title = this.add
      .text(WIDTH / 2, 72, heading, {
        fontFamily: "Georgia, serif",
        fontSize: "29px",
        fontStyle: "bold",
        color: "#fff6db",
      })
      .setOrigin(0.5);
    const wallet = this.add
      .text(WIDTH / 2, 111, "✦ " + this.progression.thread + " нитей", {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#e8b44d",
      })
      .setOrigin(0.5);

    overlay.add([shade, card, title, wallet]);

    UPGRADE_IDS.forEach((upgradeId, index) => {
      this.addUpgradeRow(
        overlay,
        upgradeId,
        146 + index * 112,
        continueAction,
        continueLabel,
      );
    });

    const continueButton = this.add
      .rectangle(WIDTH / 2, 685, 292, 54, 0xe8b44d, 1)
      .setStrokeStyle(2, 0xf2e3c6, 0.28)
      .setInteractive({ useHandCursor: true });
    const continueText = this.add
      .text(WIDTH / 2, 685, continueLabel, {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#182033",
      })
      .setOrigin(0.5);

    continueButton.on("pointerover", () => continueButton.setScale(1.02));
    continueButton.on("pointerout", () => continueButton.setScale(1));
    continueButton.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        continueButton.disableInteractive();
        this.sfx.ui();
        continueAction();
      },
    );
    overlay.add([continueButton, continueText]);
    this.overlay = overlay;
  }

  private addUpgradeRow(
    overlay: Phaser.GameObjects.Container,
    upgradeId: UpgradeId,
    y: number,
    continueAction: () => void,
    continueLabel: string,
  ): void {
    const presentation = UPGRADE_PRESENTATION[upgradeId];
    const level = this.progression.upgrades[upgradeId];
    const cost = getUpgradeCost(upgradeId, level);
    const affordable = cost !== null && this.progression.thread >= cost;

    const row = this.add.graphics();
    row.fillStyle(0x253d50, 0.92);
    row.fillRoundedRect(36, y, WIDTH - 72, 96, 16);
    row.lineStyle(2, presentation.color, 0.35);
    row.strokeRoundedRect(36, y, WIDTH - 72, 96, 16);

    const name = this.add.text(52, y + 13, presentation.name, {
      fontFamily: "Inter, Segoe UI, sans-serif",
      fontSize: "15px",
      fontStyle: "bold",
      color: "#fff6db",
    });
    const description = this.add.text(
      52,
      y + 39,
      UPGRADE_DEFINITIONS[upgradeId].description,
      {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "11px",
        color: "#c8d7ca",
        wordWrap: { width: 225 },
      },
    );
    const levelText = this.add.text(
      52,
      y + 72,
      "Ур. " +
        level +
        "/" +
        MAX_UPGRADE_LEVEL +
        "  " +
        "●".repeat(level) +
        "○".repeat(MAX_UPGRADE_LEVEL - level),
      {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: Phaser.Display.Color.IntegerToColor(presentation.color).rgba,
      },
    );

    const buttonColor = affordable ? presentation.color : 0x526270;
    const buyButton = this.add
      .rectangle(348, y + 48, 82, 52, buttonColor, affordable ? 1 : 0.72)
      .setStrokeStyle(2, 0xf2e3c6, 0.2);
    const buyText = this.add
      .text(
        348,
        y + 48,
        cost === null ? "МАКС" : "✦ " + cost,
        {
          fontFamily: "Inter, Segoe UI, sans-serif",
          fontSize: "13px",
          fontStyle: "bold",
          color: affordable ? "#182033" : "#d0d7d6",
        },
      )
      .setOrigin(0.5);

    if (affordable) {
      buyButton.setInteractive({ useHandCursor: true });
      buyButton.on("pointerover", () => buyButton.setScale(1.04));
      buyButton.on("pointerout", () => buyButton.setScale(1));
      buyButton.on(
        "pointerdown",
        (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          event.stopPropagation();
          this.buyUpgrade(upgradeId, continueAction, continueLabel);
        },
      );
    }

    overlay.add([row, name, description, levelText, buyButton, buyText]);
  }

  private buyUpgrade(
    upgradeId: UpgradeId,
    continueAction: () => void,
    continueLabel: string,
  ): void {
    if (this.time.now < this.upgradePurchaseLockedUntil) return;
    this.upgradePurchaseLockedUntil = this.time.now + 220;

    const previousWardCharges = getWardCharges(
      this.progression.upgrades.ward,
    );
    const purchased = purchaseUpgrade(this.progression, upgradeId);
    if (purchased === this.progression) return;

    this.progression = purchased;
    const nextWardCharges = getWardCharges(this.progression.upgrades.ward);
    this.shieldCharges += Math.max(0, nextWardCharges - previousWardCharges);
    this.persistProgress();
    this.threadText.setText("✦ " + this.progression.thread + " нитей");
    this.refreshShieldText();
    this.sfx.upgrade();
    this.cameras.main.flash(120, 232, 180, 77, false);
    this.showWorkshop(continueAction, continueLabel);
  }

  private showVictoryOverlay(
    title: string,
    body: string,
    accent: number,
    eyebrow?: string,
  ): void {
    this.closeOverlay();

    const overlay = this.add.container(0, 0).setDepth(100);
    const shade = this.add
      .rectangle(
        WIDTH / 2,
        HEIGHT / 2,
        this.scale.gameSize.width,
        this.scale.gameSize.height,
        0x091316,
        0.68,
      )
      .setName("viewport-shade")
      .setInteractive();
    const card = this.add.graphics();
    card.fillStyle(0x25324a, 0.98);
    card.fillRoundedRect(38, 174, WIDTH - 76, 420, 26);
    card.lineStyle(3, accent, 0.58);
    card.strokeRoundedRect(38, 174, WIDTH - 76, 420, 26);

    const eyebrowText = this.add
      .text(WIDTH / 2, 215, eyebrow ?? "РЕЙД ЗАВЕРШЁН", {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: Phaser.Display.Color.IntegerToColor(accent).rgba,
        letterSpacing: 1.2,
        align: "center",
        wordWrap: { width: 310 },
      })
      .setOrigin(0.5);
    const titleText = this.add
      .text(WIDTH / 2, 267, title, {
        fontFamily: "Georgia, serif",
        fontSize: "30px",
        fontStyle: "bold",
        color: "#fff6db",
        align: "center",
        wordWrap: { width: 310 },
      })
      .setOrigin(0.5);
    const bodyText = this.add
      .text(WIDTH / 2, 355, body, {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "14px",
        color: "#d9ddce",
        align: "center",
        lineSpacing: 7,
        wordWrap: { width: 294 },
      })
      .setOrigin(0.5);
    const continueButton = this.add
      .rectangle(WIDTH / 2, 469, 284, 58, accent, 1)
      .setStrokeStyle(2, 0xf2e3c6, 0.3)
      .setInteractive({ useHandCursor: true });
    const continueText = this.add
      .text(
        WIDTH / 2,
        469,
        this.raidMode === "weekly" && this.weeklyNode?.order === 5
          ? "Завершить маршрут"
          : "Продолжить путь",
        {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#182033",
        },
      )
      .setOrigin(0.5);
    const menuButton = this.add
      .rectangle(WIDTH / 2, 539, 284, 50, 0x182033, 0.92)
      .setStrokeStyle(2, accent, 0.72)
      .setInteractive({ useHandCursor: true });
    const menuText = this.add
      .text(WIDTH / 2, 539, "В меню", {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "15px",
        fontStyle: "bold",
        color: "#f2e3c6",
      })
      .setOrigin(0.5);

    continueButton.on("pointerover", () => continueButton.setScale(1.02));
    continueButton.on("pointerout", () => continueButton.setScale(1));
    menuButton.on("pointerover", () => menuButton.setScale(1.02));
    menuButton.on("pointerout", () => menuButton.setScale(1));

    let choiceResolved = false;
    const choose = (choice: VictoryChoice): void => {
      if (choiceResolved) return;
      choiceResolved = true;
      continueButton.disableInteractive();
      menuButton.disableInteractive();
      this.resolveVictory(choice);
    };

    continueButton.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        continueButton.setScale(0.98);
        choose("continue");
      },
    );
    menuButton.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        menuButton.setScale(0.98);
        choose("menu");
      },
    );

    overlay.add([
      shade,
      card,
      eyebrowText,
      titleText,
      bodyText,
      continueButton,
      continueText,
      menuButton,
      menuText,
    ]);
    this.overlay = overlay;
  }

  private closeOverlay(): void {
    this.overlay?.destroy(true);
    this.overlay = null;
  }

  private persistProgress(): void {
    saveProgression(this.progression);
    this.game.events.emit(PROGRESSION_SAVED_EVENT, this.progression);
  }
}

export default RaidScene;
