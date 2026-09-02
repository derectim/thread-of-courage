import Phaser from "phaser";

import SoundEngine from "../audio/SoundEngine";
import { getStageReward } from "./Economy";
import {
  MAX_UPGRADE_LEVEL,
  UPGRADE_DEFINITIONS,
  UPGRADE_IDS,
  getUpgradeCost,
  load as loadProgression,
  purchaseUpgrade,
  save as saveProgression,
  type ProgressionState,
  type UpgradeId,
  type UpgradeLevel,
} from "./ProgressionStore";
import {
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

const WIDTH = 432;
const HEIGHT = 768;
const MONSTER_X = WIDTH / 2;
const MONSTER_Y = 290;
const MONSTER_RADIUS = 78;
const WORLD_HIT_ANGLE = Math.PI / 2;
const BASE_NEEDLE_GAP = 0.085;
const BASE_PROJECTILE_DURATION = 175;

type RaidState =
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
  private backgroundShade!: Phaser.GameObjects.Rectangle;
  private monster!: Phaser.GameObjects.Container;
  private monsterBody!: Phaser.GameObjects.Container;
  private monsterArtwork: Phaser.GameObjects.Image | null = null;
  private monsterDamageOverlay!: Phaser.GameObjects.Graphics;
  private monsterShadow!: Phaser.GameObjects.Ellipse;
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
  private readonly sfx = new SoundEngine();

  public constructor() {
    super("raid");
  }

  public preload(): void {
    const art = import.meta.env.BASE_URL + "assets/art/";

    this.load.image("room-attic", art + "attic-workshop.webp");
    this.load.image("room-theatre", art + "room-puppet-theatre.webp");
    this.load.image("room-machine", art + "room-sewing-machine-heart.webp");
    this.load.image("hero-elya", art + "hero-elya.webp");
    for (let damage = 0; damage < 4; damage += 1) {
      this.load.image(
        "grumble-yarn-" + damage,
        art + "grumble-yarn-" + damage + ".webp",
      );
    }

    for (const boss of [
      "boss-sewing-storm",
      "boss-madam-marionette",
      "boss-ripper",
    ]) {
      for (let damage = 0; damage < 4; damage += 1) {
        this.load.image(
          boss + "-" + damage,
          art + boss + "-" + damage + ".webp",
        );
      }
    }
  }

  public create(): void {
    this.state = "ready";
    this.stage = 1;
    this.hits = 0;
    this.shotInFlight = false;
    this.hitAngles = [];
    this.overlay = null;
    this.inputCooldownUntil = 0;
    this.upgradePurchaseLockedUntil = 0;
    this.progression = loadProgression();
    this.shieldCharges = getWardCharges(this.progression.upgrades.ward);
    this.sfx.setMuted(this.progression.muted);

    this.currentRoom = getRoomForStage(this.stage);
    this.createBackground();
    this.createHud();
    this.createHero();
    this.createMonster();
    this.createIntroOverlay();

    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.keyboard?.on("keydown-SPACE", this.handleKeyboardShot, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.sfx.destroy());

    document.querySelector("#loading")?.classList.add("is-hidden");
  }

  public update(_time: number, delta: number): void {
    if (!this.monster) return;
    if (
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

  private createBackground(): void {
    if (this.textures.exists(this.currentRoom.backgroundKey)) {
      this.backgroundImage = this.add
        .image(WIDTH / 2, HEIGHT / 2, this.currentRoom.backgroundKey)
        .setDisplaySize(WIDTH, HEIGHT)
        .setDepth(0)
        .setAlpha(0.9);
    } else {
      this.add
        .rectangle(0, 0, WIDTH, HEIGHT, 0x25324a)
        .setOrigin(0)
        .setDepth(0);
    }

    this.backgroundShade = this.add
      .rectangle(0, 0, WIDTH, HEIGHT, 0x101a28, 0.28)
      .setOrigin(0)
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
  }

  private updateRoomBackground(room: RoomDefinition): void {
    if (this.backgroundImage && this.textures.exists(room.backgroundKey)) {
      this.backgroundImage.setTexture(room.backgroundKey).setAlpha(0.2);
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
      .text(372, 57, this.sfx.isMuted() ? "○" : "♪", {
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
        this.soundButton.setText(this.sfx.isMuted() ? "○" : "♪");
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
    const hero = this.add.container(WIDTH / 2, 638).setDepth(8);
    const shadow = this.add.ellipse(0, 111, 118, 18, 0x091316, 0.2);

    if (this.textures.exists("hero-elya")) {
      const artwork = this.add
        .image(0, 0, "hero-elya")
        .setDisplaySize(191, 256);
      hero.add([shadow, artwork]);
    } else {
      const fallback = this.add.graphics();
      fallback.fillStyle(0x5b8c85, 1);
      fallback.fillTriangle(-42, 15, 36, 8, 26, 82);
      fallback.fillStyle(0xe56b6f, 1);
      fallback.fillRoundedRect(-26, -5, 52, 69, 16);
      fallback.fillStyle(0xf2e3c6, 1);
      fallback.fillCircle(0, -23, 21);
      fallback.fillStyle(0x6b4a6f, 1);
      fallback.fillCircle(0, -31, 22);
      hero.add([shadow, fallback]);
    }

    this.tweens.add({
      targets: hero,
      y: hero.y - 4,
      duration: 1450,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  private createMonster(): void {
    if (this.monster?.active) this.monster.destroy(true);
    if (this.monsterShadow?.active) this.monsterShadow.destroy();

    this.currentMonster = getMonsterForStage(this.stage);
    this.currentRoom = getRoomForStage(this.stage);
    this.updateRoomBackground(this.currentRoom);
    this.requiredHits = getRequiredHits(this.currentMonster, this.stage);
    this.hits = 0;
    this.hitAngles = [];
    this.shotInFlight = false;
    this.patternElapsed = 0;
    this.patternDirection = Math.random() > 0.5 ? 1 : -1;
    this.rotationSpeed = Math.min(1.58, 0.76 + this.stage * 0.065);
    this.baseRotation = 0;
    this.currentDamageStage = 0;
    this.monsterArtwork = null;

    this.monsterShadow = this.add
      .ellipse(MONSTER_X, MONSTER_Y + 90, 112, 15, 0x08151a, 0.16)
      .setDepth(3);
    this.monster = this.add.container(MONSTER_X, MONSTER_Y).setDepth(6);
    this.monsterBody = this.buildMonsterBody(this.currentMonster, this.stage);
    this.monsterDamageOverlay = this.add.graphics();
    this.monster.add([this.monsterBody, this.monsterDamageOverlay]);

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
    const aura = this.add.graphics();
    aura.fillStyle(monster.accentColor, monster.isBoss ? 0.13 : 0.08);
    aura.fillCircle(0, 0, MONSTER_RADIUS + 15);
    aura.lineStyle(monster.isBoss ? 3 : 2, monster.accentColor, 0.3);
    aura.strokeCircle(0, 0, MONSTER_RADIUS + 8);
    body.add(aura);

    const textureKey = monster.textureKeys?.find((key) =>
      this.textures.exists(key),
    );
    if (textureKey) {
      const core = this.add
        .circle(0, 0, MONSTER_RADIUS - 11, monster.bodyColor, 0.98);
      this.monsterArtwork = this.add
        .image(0, 0, textureKey)
        .setDisplaySize(
          monster.isBoss ? MONSTER_RADIUS * 2.32 : MONSTER_RADIUS * 2.12,
          monster.isBoss ? MONSTER_RADIUS * 2.32 : MONSTER_RADIUS * 2.12,
        );
      body.add([core, this.monsterArtwork]);
      return body;
    }

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
      case "pendulum":
        this.monster.rotation =
          this.baseRotation +
          Math.sin(this.patternElapsed * (1.25 + this.stage * 0.025)) * 1.55;
        break;
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
    if (pointer.y < 115) return;
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
    void this.sfx.unlock();
    this.sfx.shoot();

    const projectile = this.add.container(WIDTH / 2, 585).setDepth(7);
    const glow = this.add.rectangle(0, 17, 8, 59, 0xe8b44d, 0.2);
    const needle = this.add.graphics();
    needle.lineStyle(3, 0xf2e3c6, 1);
    needle.lineBetween(0, 46, 0, -5);
    needle.fillStyle(0xe8b44d, 1);
    needle.fillTriangle(-4, 2, 4, 2, 0, -10);
    needle.fillStyle(0xe56b6f, 1);
    needle.fillCircle(0, 48, 5);
    projectile.add([glow, needle]);

    const speedLevel = this.progression.upgrades.speed;
    const duration = Math.max(
      105,
      BASE_PROJECTILE_DURATION - speedLevel * 12,
    );
    this.tweens.add({
      targets: projectile,
      y: MONSTER_Y + MONSTER_RADIUS - 2,
      duration,
      ease: "Quad.In",
      onComplete: () => {
        projectile.destroy(true);
        this.resolveHit();
      },
    });
  }

  private resolveHit(): void {
    const localAngle = normalizeAngle(WORLD_HIT_ANGLE - this.monster.rotation);
    const precisionLevel = this.progression.upgrades.precision;
    const needleGap = Math.max(
      0.06,
      BASE_NEEDLE_GAP - precisionLevel * 0.005,
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

    const doubleChance = this.progression.upgrades.power * 0.1;
    const isDouble =
      this.progression.upgrades.power > 0 && Math.random() < doubleChance;
    const stitchPower = isDouble ? 2 : 1;

    this.hitAngles.push(localAngle);
    this.attachNeedle(localAngle);
    this.hits = Math.min(this.requiredHits, this.hits + stitchPower);
    this.shotInFlight = false;
    this.sfx.hit();
    this.cameras.main.shake(isDouble ? 100 : 65, isDouble ? 0.004 : 0.0025);

    if (this.getActivePattern() === "recoil") {
      this.patternDirection *= -1;
      this.rotationSpeed = Math.min(1.85, this.rotationSpeed + 0.08);
    }

    this.flashMonster(isDouble ? 0xe8b44d : 0xf2e3c6);
    this.spawnHitText(isDouble);
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

  private attachNeedle(angle: number): void {
    const attached = this.add.graphics();
    const inner = MONSTER_RADIUS - 24;
    const outer = MONSTER_RADIUS + 43;
    const handle = MONSTER_RADIUS + 46;
    attached.lineStyle(3, 0xf2e3c6, 1);
    attached.lineBetween(
      Math.cos(angle) * inner,
      Math.sin(angle) * inner,
      Math.cos(angle) * outer,
      Math.sin(angle) * outer,
    );
    attached.fillStyle(0xe56b6f, 1);
    attached.fillCircle(Math.cos(angle) * handle, Math.sin(angle) * handle, 5);
    this.monster.add(attached);
    this.monster.sendToBack(attached);
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

  private spawnHitText(isDouble: boolean): void {
    const text = this.add
      .text(
        MONSTER_X + Phaser.Math.Between(-35, 35),
        MONSTER_Y - 15,
        isDouble ? "★ ДВОЙНОЙ СТЕЖОК" : "+СТЕЖОК",
        {
          fontFamily: "Inter, Segoe UI, sans-serif",
          fontSize: isDouble ? "14px" : "13px",
          fontStyle: "bold",
          color: isDouble ? "#e8b44d" : "#f2e3c6",
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
    this.progression = {
      ...this.progression,
      thread: this.progression.thread + reward,
      bestStage: Math.max(this.progression.bestStage, this.stage + 1),
    };
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
        "В мастерскую",
        () => this.showWorkshop(() => this.advanceStage(), "Продолжить путь"),
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
          this.progression.bestStage,
      );
      this.showWorkshop(
        () => this.restartRun(),
        "Новый рейд",
        "Нить оборвалась",
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

  private restartRun(): void {
    this.closeOverlay();
    this.state = "transition";
    this.inputCooldownUntil = this.time.now + 240;
    this.stage = 1;
    this.shieldCharges = getWardCharges(this.progression.upgrades.ward);
    this.createMonster();
    this.beginPlaying("Обереги восстановлены. Начинаем заново");
  }

  private beginPlaying(tip: string): void {
    this.closeOverlay();
    this.inputCooldownUntil = this.time.now + 240;
    this.state = "playing";
    this.tipText.setText(tip);
    this.sfx.ui();
  }

  private createIntroOverlay(): void {
    this.showResultOverlay(
      "Нитка храбрости",
      "Эля Штопка идёт через три комнаты.\nЗашивай кошмары, побеждай боссов и улучшай оружие между боями.",
      "Начать рейд",
      () => this.beginPlaying("Не дай иглам столкнуться"),
      0xe8b44d,
      "3 КОМНАТЫ · 9 ВРАГОВ · 4 УЛУЧШЕНИЯ",
    );
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
      .rectangle(0, 0, WIDTH, HEIGHT, 0x091316, 0.82)
      .setOrigin(0)
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
      .rectangle(0, 0, WIDTH, HEIGHT, 0x091316, 0.68)
      .setOrigin(0)
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
