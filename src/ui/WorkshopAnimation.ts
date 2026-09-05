import type { AnimationItem } from "lottie-web";
import { createWorkshopMotion } from "./WorkshopMotion";
let player: Promise<typeof import("lottie-web/build/player/lottie_light")> | null = null;

export function attachWorkshopAnimation(element: HTMLElement, art: string, points: number[][], sewn: number, celebrate: boolean): () => void {
  let disposed = false, animation: AnimationItem | null = null;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const updatePlayback = () => { if (document.hidden || motion.matches) animation?.pause(); else animation?.play(); };
  document.addEventListener("visibilitychange", updatePlayback);
  motion.addEventListener("change", updatePlayback);
  if (!motion.matches) {
    player ??= import("lottie-web/build/player/lottie_light");
    void player.then(({ default: lottie }) => {
      if (disposed || !element.isConnected) return;
      animation = lottie.loadAnimation({ container: element, renderer: "svg", loop: true, autoplay: !document.hidden, animationData: createWorkshopMotion(art, points, sewn, celebrate), rendererSettings: { progressiveLoad: true, preserveAspectRatio: "xMidYMid meet" } });
      animation.addEventListener("DOMLoaded", () => { if (!disposed) element.parentElement?.classList.add("motion-ready"); });
      animation.addEventListener("data_failed", () => element.parentElement?.classList.remove("motion-ready"));
    }).catch(() => { player = null; });
  }
  return () => { disposed = true; document.removeEventListener("visibilitychange", updatePlayback); motion.removeEventListener("change", updatePlayback); animation?.destroy(); };
}
