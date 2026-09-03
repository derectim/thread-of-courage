import Phaser from "phaser";

import SoundEngine from "../audio/SoundEngine";
import GameMenu from "../ui/GameMenu";
import { getStageReward } from "./Economy";
import {
  MAX_UPGRADE_LEVEL,
  UPGRADE_DEFINITIONS,
  UPGRADE_IDS,
  getUpgradeCost,
  load as loadProgression,
  purchaseUpgrade,
  recordShot,
  recordVictory,
  save as saveProgression,
  type ProgressionState,
  type UpgradeId,
  type UpgradeLevel,
} from "./ProgressionStore";
import {
  MONSTERS,
  PATTERN_NAMES,
  getExpeditionNumber,
  getMonsterForStage,
  getRequiredHits,
  getRoomForStage,
  type MonsterDefinition,
  type MovementPattern,
  type RoomDefinition,
} from "./content";
import { isAngleBlocked, normalizeAngle } from "./geometry";
import {
  HERO_CROSSBOW_FRAMES,
  getHeroNeedleLayout,
} from "./heroAnimation";
import { getAlphaSurfaceRadius, type AlphaMask } from "./silhouette";
import {
  NEEDLE_ART_TIP_Y,
  getAttachedNeedleRotation,
  getNeedleArtSize,
} from "./needleVisual";
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

const MONSTER_FALLBACK_SURFACE_RADIUS: Readonly<Record<string, number>> = {
  "grumble-yarn": 93,
  "button-bug": 96,
  "sewing-storm": 106,
  "moth-mask": 104,
  "spring-rabbit": 98,
  "madam-marionette": 104,
  "thimble-hedgehog": 95,
  "ink-shuttle": 100,
  ripper: 105,
};

type RaidState =
  | "menu"
  | "ready"
  | "playing"
  | "won"
  | "failed"
  | "workshop"
  | "transition";

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
  private overlay: Phaser.GameObjects.Container | null = null;
  private patternElapsed = 0;
  private patternDirection = 1;
  private rotationSpeed = 0.88;
  private baseRotation = 0;
  private inputCooldownUntil = 0;
  private currentDamageStage = 0;
  private upgradePurchaseLockedUntil = 0;
  private menu!: GameMenu;
  private readonly sfx = new SoundEngine();
  private readonly silhouetteMasks = new Map<string, AlphaMask | null>();

  public constructor() {
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
    this.menu = new GameMenu(menuRoot, this.progression, {
      onStart: () => this.startRaidFromMenu(),
      onStateChange: (state) => this.applyMenuProgress(state),
      onToggleSound: (muted) => {
        this.sfx.setMuted(muted);
        this.soundButton.setText(muted ? "🔇" : "♪");
        this.sfx.ui();
      },
      onFullscreen: () => this.requestFullscreen(),
    });
    this.menu.show(this.progression);

    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.keyboard?.on("keydown-SPACE", this.handleKeyboardShot, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutExpandedViewport, this);
    this.layoutExpandedViewport();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutExpandedViewport, this);
      this.heroFrameTimers.forEach((timer) => timer.remove(false));
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

    const deltaSeconds = Math.min(delta, 50) / 1000;
    this.patternElapsed += deltaSeconds;
    this.updatePattern(this.getActivePattern(), deltaSeconds);
  }

  private startRaidFromMenu(): void {
    this.sfx.setMusicTheme("raid");
    this.menu.hide();
    this.closeOverlay();
    this.state = "transition";
    this.stage = 1;
    this.shieldCharges = this.getStartingWardCharges();
    this.inputCooldownUntil = this.time.now + 260;
    this.createMonster();
    this.beginPlaying("Не дай иглам столкнуться");
  }

  private applyMenuProgress(state: ProgressionState): void {
    this.progression = state;
    this.persistProgress();
    this.threadText?.setText("✦ " + this.progression.thread + " нитей");
    this.drawLoadedHeroNeedle(0, true);
    if (this.currentRoom) this.updateRoomBackground(this.currentRoom);
  }

  private getStartingWardCharges(): number {
    const skillBonus = getSkill(this.progression.equippedSkill).modifiers.startingWardBonus ?? 0;
    return getWardCharges(this.progression.upgrades.ward) + skillBonus;
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

    const shadeAlpha = room.id === "machine" ? 0.38 : 0.28;
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
  }

  private createHero(): void {
    this.hero = this.add.container(WIDTH / 2, 627).setDepth(8);
    const shadow = this.add.ellipse(0, 116, 142, 19, 0x091316, 0.18);
    this.heroArtwork = this.add
      .image(0, 0, HERO_CROSSBOW_FRAMES[0].textureKey)
      .setDisplaySize(278, 278);
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

  private createMonster(): void {
    if (this.monster?.active) this.monster.destroy(true);
    if (this.monsterShadow?.active) this.monsterShadow.destroy();

    this.currentMonster = getMonsterForStage(this.stage);
    this.currentRoom = getRoomForStage(this.stage);
    if (this.state !== "menu") {
      this.sfx.setMusicTheme(this.currentMonster.isBoss ? "boss" : "raid");
    }
    this.updateRoomBackground(this.currentRoom);
    this.requiredHits = getRequiredHits(this.currentMonster, this.stage);
    this.hits = 0;
    this.hitAngles = [];
    this.shotInFlight = false;
    this.patternElapsed = 0;
    this.patternDirection = Math.random() > 0.5 ? 1 : -1;
    const skillSpeed = getSkill(
      this.progression.equippedSkill,
    ).modifiers.rotationSpeedMultiplier ?? 1;
    const mothPressure = this.currentMonster.id === "moth-mask" ? 1.16 : 1;
    this.rotationSpeed =
      Math.min(
        2.35,
        0.72 + Math.log2(this.stage + 1) * 0.22 + Math.floor(this.stage / 5) * 0.025,
      ) *
      skillSpeed *
      mothPressure;
    this.baseRotation = 0;
    this.currentDamageStage = 0;
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
      "СТЕЖОК " +
        this.stage +
        " · ПОХОД " +
        getExpeditionNumber(this.stage),
    );
    this.threadText.setText("✦ " + this.progression.thread + " нитей");
    this.roomText.setText(this.currentRoom.name);
    this.monsterNameText.setText(
      (this.currentMonster.isBoss ? "★ " : "") + this.currentMonster.name,
    );
    this.refreshPatternLabel();
    this.refreshShieldText();
    this.updateHealth();

    if (this.currentMonster.isBoss) {
      this.sfx.boss();
      this.cameras.main.shake(180, 0.003);
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
      this.monsterArtwork = this.add
        .image(0, 0, textureKey)
        .setDisplaySize(
          monster.isBoss ? MONSTER_RADIUS * 2.82 : MONSTER_RADIUS * 2.68,
          monster.isBoss ? MONSTER_RADIUS * 2.82 : MONSTER_RADIUS * 2.68,
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
    if (!this.currentMonster.isBoss || this.hits < this.requiredHits / 2) {
      return this.currentMonster.pattern;
    }

    switch (this.currentMonster.id) {
      case "sewing-storm":
        return "carousel";
      case "madam-marionette":
        return "stitches";
      case "moth-mask":
        return "recoil";
      case "ripper":
        return "stitches";
      default:
        return this.currentMonster.pattern;
    }
  }

  private refreshPatternLabel(): void {
    const bossPhase =
      this.currentMonster.isBoss && this.hits >= this.requiredHits / 2
        ? " · ФАЗА II"
        : "";
    this.patternText.setText(
      "Узор: " + PATTERN_NAMES[this.getActivePattern()] + bossPhase,
    );
  }

  private updatePattern(pattern: MovementPattern, deltaSeconds: number): void {
    switch (pattern) {
      case "carousel":
        this.monster.rotation +=
          this.patternDirection * this.rotationSpeed * deltaSeconds;
        break;
      case "pendulum": {
        const pendulumSpeed =
          getSkill(this.progression.equippedSkill).modifiers
            .rotationSpeedMultiplier ?? 1;
        this.monster.rotation =
          this.baseRotation +
          Math.sin(
            this.patternElapsed *
              (1.25 + this.stage * 0.025) *
              pendulumSpeed,
          ) *
            1.55;
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

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.worldY < 115) return;
    this.fireNeedle();
  }

  private handleKeyboardShot(event: KeyboardEvent): void {
    if (event.repeat) return;
    this.fireNeedle();
  }

  private fireNeedle(): void {
    if (this.state !== "playing" || this.shotInFlight) return;
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
      2,
      this.heroArtwork.displayWidth,
      this.heroArtwork.displayHeight,
    );
    const projectile = this.add
      .container(this.hero.x + releaseAnchor.x, this.hero.y + releaseAnchor.tipY)
      .setDepth(7);
    const projectileSize = getNeedleArtSize(62);
    const glow = this.add.rectangle(0, 31, 10, 62, needleSkin.headColor, 0.24);
    const needle = this.add
      .image(0, 0, needleSkin.textureKey)
      .setOrigin(0.5, NEEDLE_ART_TIP_Y)
      .setDisplaySize(projectileSize.width, projectileSize.height);
    projectile.add([glow, needle]);

    const startX = projectile.x;
    const startY = projectile.y;
    const flight = { progress: 0 };
    const speedLevel = this.progression.upgrades.speed;
    const skinSpeed = needleSkin.modifiers.projectileSpeedMultiplier ?? 1;
    const duration = Math.max(
      105,
      (BASE_PROJECTILE_DURATION - speedLevel * 12) / skinSpeed,
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
      },
      onComplete: () => {
        projectile.destroy(true);
        this.resolveHit();
      },
    });
  }

  private resolveHit(): void {
    const localAngle = normalizeAngle(WORLD_HIT_ANGLE - this.monster.rotation);
    const precisionLevel = this.progression.upgrades.precision;
    const needleSkin = getNeedleSkin(this.progression.equippedNeedle);
    const needleModifiers = needleSkin.modifiers;
    const skillModifiers = getSkill(this.progression.equippedSkill).modifiers;
    const needleGap = Math.max(
      0.045,
      BASE_NEEDLE_GAP -
        precisionLevel * 0.005 -
        (needleModifiers.needleGapReduction ?? 0) -
        (skillModifiers.needleGapReduction ?? 0) +
        (needleModifiers.needleGapPenalty ?? 0),
    );

    if (isAngleBlocked(localAngle, this.hitAngles, needleGap)) {
      this.shotInFlight = false;
      if (this.shieldCharges > 0) {
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
    this.attachNeedle(localAngle);
    this.hits = Math.min(this.requiredHits, this.hits + stitchPower);
    this.shotInFlight = false;
    this.sfx.hit();
    this.cameras.main.shake(isEmpowered ? 100 : 65, isEmpowered ? 0.004 : 0.0025);

    if (this.getActivePattern() === "recoil") {
      this.patternDirection *= -1;
      this.rotationSpeed = Math.min(2.65, this.rotationSpeed + 0.08);
    }

    this.flashMonster(isEmpowered ? needleSkin.headColor : 0xf2e3c6);
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
      const mask: AlphaMask = { width, height, data: image.data };
      this.silhouetteMasks.set(textureKey, mask);
      return mask;
    } catch {
      this.silhouetteMasks.set(textureKey, null);
      return null;
    }
  }

  private warmMonsterSilhouetteMasks(): void {
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
    return Phaser.Math.Clamp(scaledRadius, 28, this.currentMonster.isBoss ? 154 : 146);
  }

  private redrawAttachedNeedles(): void {
    if (!this.attachedNeedleBackLayer?.active || !this.attachedNeedleFrontLayer?.active) {
      return;
    }

    const back = this.attachedNeedleBackLayer;
    const front = this.attachedNeedleFrontLayer;
    const needleSkin = getNeedleSkin(this.progression.equippedNeedle);
    back.removeAll(true);
    front.clear();

    for (const angle of this.hitAngles) {
      const directionX = Math.cos(angle);
      const directionY = Math.sin(angle);
      const tangentX = -directionY;
      const tangentY = directionX;
      const surface = this.getMonsterSurfaceRadius(angle);
      const embedded = Math.max(8, surface - 18);
      const outsideLength = this.currentMonster.isBoss ? 46 : 40;
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
    const reward = getStageReward(this.stage);
    this.progression = recordVictory(
      this.progression,
      this.stage,
      this.currentMonster.isBoss === true,
      reward,
    );
    this.threadText.setText("✦ " + this.progression.thread + " нитей");
    this.persistProgress();
    this.sfx.win();

    this.cameras.main.flash(240, 232, 180, 77, false);
    this.time.delayedCall(420, () => {
      this.showResultOverlay(
        this.currentMonster.isBoss ? "Босс распорот!" : "Кошмар зашит!",
        this.currentMonster.name +
          " больше не тревожит комнату.\nНаграда: " +
          reward +
          " нитей",
        "Продолжить путь",
        () => this.advanceStage(),
        this.currentRoom.accentColor,
        this.currentMonster.isBoss ? "КОМНАТА ОЧИЩЕНА" : "ПОБЕДА",
      );
    });
  }

  private failRaid(): void {
    if (this.state !== "playing") return;

    this.state = "failed";
    this.sfx.fail();
    this.cameras.main.shake(240, 0.009);
    this.flashMonster(0xe56b6f);

    this.time.delayedCall(300, () => {
      this.tipText.setText(
        "Нить оборвалась на " +
          this.stage +
          "-м стежке · рекорд " +
          this.progression.highestStageCleared,
      );
      this.closeOverlay();
      this.state = "menu";
      this.sfx.setMusicTheme("menu");
      this.menu.show(
        this.progression,
        "home",
        `Рейд окончен: этап ${this.stage}`,
      );
    });
  }

  private advanceStage(): void {
    const previousRoom = this.currentRoom.id;
    this.closeOverlay();
    this.state = "transition";
    this.inputCooldownUntil = this.time.now + 240;
    this.stage += 1;
    this.createMonster();

    if (this.currentMonster.isBoss) {
      this.showResultOverlay(
        "Босс комнаты",
        this.currentMonster.name +
          "\n" +
          this.currentMonster.epithet +
          ".\nНа половине здоровья он сменит узор.",
        "В бой",
        () => this.beginPlaying("Следи за лицом: повреждения меняют босса"),
        this.currentRoom.accentColor,
        this.currentRoom.name.toUpperCase(),
      );
      return;
    }

    if (this.currentRoom.id !== previousRoom) {
      this.showResultOverlay(
        this.currentRoom.name,
        this.currentRoom.subtitle +
          ".\nНовая комната — новые враги и новый ритм.",
        "Войти",
        () => this.beginPlaying("Осмотрись и поймай новый ритм"),
        this.currentRoom.accentColor,
        "НОВАЯ КОМНАТА",
      );
      return;
    }

    this.beginPlaying("Новый узор — следи за ритмом");
  }

  private beginPlaying(tip: string): void {
    this.closeOverlay();
    this.inputCooldownUntil = this.time.now + 240;
    this.state = "playing";
    this.tipText.setText(tip);
    this.sfx.ui();
  }

  private showWorkshop(
    continueAction: () => void,
    continueLabel: string,
    heading = "Мастерская Эли",
  ): void {
    this.closeOverlay();
    this.state = "workshop";

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

  private showResultOverlay(
    title: string,
    body: string,
    buttonLabel: string,
    action: () => void,
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
    card.fillRoundedRect(38, 198, WIDTH - 76, 344, 26);
    card.lineStyle(3, accent, 0.58);
    card.strokeRoundedRect(38, 198, WIDTH - 76, 344, 26);

    const eyebrowText = this.add
      .text(WIDTH / 2, 239, eyebrow ?? "РЕЙД ЗАВЕРШЁН", {
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
      .text(WIDTH / 2, 291, title, {
        fontFamily: "Georgia, serif",
        fontSize: "30px",
        fontStyle: "bold",
        color: "#fff6db",
        align: "center",
        wordWrap: { width: 310 },
      })
      .setOrigin(0.5);
    const bodyText = this.add
      .text(WIDTH / 2, 378, body, {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "14px",
        color: "#d9ddce",
        align: "center",
        lineSpacing: 7,
        wordWrap: { width: 294 },
      })
      .setOrigin(0.5);
    const button = this.add
      .rectangle(WIDTH / 2, 488, 270, 58, accent, 1)
      .setStrokeStyle(2, 0xf2e3c6, 0.3)
      .setInteractive({ useHandCursor: true });
    const buttonText = this.add
      .text(WIDTH / 2, 488, buttonLabel, {
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#182033",
      })
      .setOrigin(0.5);

    button.on("pointerover", () => button.setScale(1.02));
    button.on("pointerout", () => button.setScale(1));
    button.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        button.disableInteractive();
        button.setScale(0.98);
        this.sfx.ui();
        action();
      },
    );

    overlay.add([
      shade,
      card,
      eyebrowText,
      titleText,
      bodyText,
      button,
      buttonText,
    ]);
    this.overlay = overlay;
  }

  private closeOverlay(): void {
    this.overlay?.destroy(true);
    this.overlay = null;
  }

  private persistProgress(): void {
    saveProgression(this.progression);
  }
}

export default RaidScene;
