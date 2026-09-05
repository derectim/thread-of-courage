import Phaser from "phaser";

import RaidScene, {
  CONFIRMED_HIT_EVENT,
  PROGRESSION_SAVED_EVENT,
} from "./game/RaidScene";
import type { ProgressionState } from "./game/ProgressionStore";
import {
  createPlatformAdapter,
  pushProgressToCloud,
  synchronizeProgressOnStartup,
} from "./platform";
import "./style.css";
import "./ui/menu-polish.css";
import "./ui/progression-menu.css";
import "./ui/reward-feedback.css";
import "./ui/home-shortcuts.css";
import "./ui/campaign-events.css";

const loading = document.querySelector<HTMLElement>("#loading");

function showStartupError(reason: unknown): void {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (loading) {
    loading.textContent = `Не удалось запустить игру: ${message}`;
    loading.classList.remove("is-hidden");
  }
}

window.addEventListener("error", (event) => showStartupError(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => showStartupError(event.reason));

const platform = createPlatformAdapter();
let game: Phaser.Game | null = null;
let cloudSaveTimer: number | null = null;
let pendingCloudState: ProgressionState | null = null;
let cloudWriteChain: Promise<unknown> = Promise.resolve();

const flushCloudProgress = (): void => {
  if (cloudSaveTimer !== null) {
    window.clearTimeout(cloudSaveTimer);
    cloudSaveTimer = null;
  }
  const state = pendingCloudState;
  pendingCloudState = null;
  if (state) {
    cloudWriteChain = cloudWriteChain.then(() => pushProgressToCloud(platform, state));
  }
};

const queueCloudProgress = (state: ProgressionState): void => {
  pendingCloudState = state;
  if (cloudSaveTimer !== null) window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(flushCloudProgress, 700);
};

async function startGame(): Promise<void> {
  await platform.initialize();
  await synchronizeProgressOnStartup(platform);

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: 432,
    height: 768,
    backgroundColor: "#25324a",
    transparent: false,
    antialias: true,
    pixelArt: false,
    scene: [new RaidScene(platform)],
    scale: {
      mode: Phaser.Scale.EXPAND,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      autoRound: true,
      resizeInterval: 100,
      fullscreenTarget: "game-frame",
    },
    input: {
      activePointers: 3,
    },
    render: {
      antialias: true,
      roundPixels: true,
    },
  });

  const handleConfirmedHit = (): void => platform.hitFeedback();
  game.events.on(CONFIRMED_HIT_EVENT, handleConfirmedHit);
  game.events.on(PROGRESSION_SAVED_EVENT, queueCloudProgress);
  const unsubscribeLifecycle = platform.subscribeLifecycle({
    onPause: () => {
      flushCloudProgress();
      if (!game) return;
      const raidScene = game.scene.getScene("raid");
      if (raidScene instanceof RaidScene) raidScene.pauseForPlatform();
      game.loop.sleep();
    },
    onResume: () => {
      if (!game) return;
      const raidScene = game.scene.getScene("raid");
      if (raidScene instanceof RaidScene) raidScene.resumeForPlatform();
      game.loop.wake();
    },
  });

  window.addEventListener("beforeunload", () => {
    flushCloudProgress();
    if (!game) return;
    game.events.off(CONFIRMED_HIT_EVENT, handleConfirmedHit);
    game.events.off(PROGRESSION_SAVED_EVENT, queueCloudProgress);
    unsubscribeLifecycle();
    platform.destroy();
    game.destroy(true);
    game = null;
  });
}

void startGame().catch((error) => {
  showStartupError(error);
  platform.destroy();
});
