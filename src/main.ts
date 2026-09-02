import Phaser from "phaser";

import RaidScene from "./game/RaidScene";
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
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
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

window.addEventListener("beforeunload", () => game.destroy(true));
