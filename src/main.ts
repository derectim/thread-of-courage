import Phaser from "phaser";

import RaidScene from "./game/RaidScene";
import { createPlatformAdapter } from "./platform";
import "./style.css";

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

let game: Phaser.Game;

try {
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: 432,
    height: 768,
    backgroundColor: "#25324a",
    transparent: false,
    antialias: true,
    pixelArt: false,
    scene: [RaidScene],
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
} catch (error) {
  showStartupError(error);
  throw error;
}

const platform = createPlatformAdapter();
const unsubscribeLifecycle = platform.subscribeLifecycle({
  onPause: () => {
    const raidScene = game.scene.getScene("raid");
    if (raidScene instanceof RaidScene) raidScene.pauseForPlatform();
    game.loop.sleep();
  },
  onResume: () => {
    const raidScene = game.scene.getScene("raid");
    if (raidScene instanceof RaidScene) raidScene.resumeForPlatform();
    game.loop.wake();
  },
});
void platform.initialize();

window.addEventListener("beforeunload", () => {
  unsubscribeLifecycle();
  platform.destroy();
  game.destroy(true);
});
