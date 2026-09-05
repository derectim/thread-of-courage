import type { CampaignChapter } from "../game/CampaignStory";
import { getDetourReward, type CampaignDetour } from "../game/CampaignDetour";
import { getMonsterForStage } from "../game/content";

type Decision = "continue" | "accept" | "skip" | "menu";
const art = (file: string) => new URL(`${import.meta.env.BASE_URL}assets/art/${file}`, document.baseURI).href;

/** A saved story beat or an optional risk choice, outside the combat canvas. */
export default class CampaignEventDialog {
  private readonly root: HTMLDivElement;
  private resolve: ((decision: Decision) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "campaign-event-layer";
    this.root.hidden = true;
    this.root.addEventListener("click", this.handleClick);
    this.root.addEventListener("keydown", this.handleKeyDown);
    parent.append(this.root);
  }

  showStory(chapter: CampaignChapter, onResolve: (decision: "continue" | "menu") => void): void {
    this.show(`<section class="campaign-event-dialog is-story" role="dialog" aria-modal="true" aria-labelledby="campaign-event-title" tabindex="-1">
      <div class="campaign-event-art"><img src="${art(`prologue/${chapter.artFileName}`)}" alt="Мир Мастерской после Разрыва" /></div>
      <div class="campaign-event-scroll"><span class="campaign-event-kicker">НОВАЯ СТРАНИЦА ИСТОРИИ</span><h2 id="campaign-event-title">${chapter.title}</h2>${chapter.lines.map(line => `<p>${line}</p>`).join("")}<small>Победа и награды уже сохранены.</small></div>
      <footer><button class="event-link" data-decision="menu">В меню</button><button class="event-link" data-decision="continue">Пропустить</button><button class="event-primary" data-decision="continue">Продолжить →</button></footer>
    </section>`, decision => { if (decision === "continue" || decision === "menu") onResolve(decision); });
  }

  showDetour(offer: CampaignDetour, onResolve: (decision: "accept" | "skip" | "menu") => void): void {
    const monster = getMonsterForStage(offer.stage);
    const monsterArt = `${monster.textureKeys?.[0] ?? "menu-icon-bestiary"}.webp`;
    this.show(`<section class="campaign-event-dialog is-detour" role="dialog" aria-modal="true" aria-labelledby="campaign-event-title" aria-describedby="detour-risk" tabindex="-1">
      <div class="campaign-event-scroll"><span class="campaign-event-kicker">ЭТАП ${offer.stage} ПРОЙДЕН · РАЗВИЛКА</span><h2 id="campaign-event-title">Тайник за потайной дверью</h2><p>За дверью — страж и катушка нитей. Основной путь ведёт к этапу ${offer.stage + 1}.</p>
      <div class="detour-enemy"><img src="${art(monsterArt)}" alt="" /><div><small>СТРАЖ ТАЙНИКА</small><strong>${monster.name}</strong><span>Вращение на 20% быстрее.<br />Нужно на 2 стежка больше.</span></div></div>
      <small>Один дополнительный бой. За проход мимо ничего не теряешь.</small></div>
      <p class="detour-risk" id="detour-risk"><strong>Победа: +${getDetourReward(offer.stage)} нитей.</strong><br />Поражение завершит поход: этап 1, временные узоры пропадут. Нити и пуговицы сохранятся.</p>
      <footer><button class="event-link" data-decision="menu">Решить позже</button><button class="event-secondary" data-decision="skip">Пройти мимо</button><button class="event-primary" data-decision="accept">Рискнуть · +${getDetourReward(offer.stage)} нитей</button></footer>
    </section>`, decision => { if (decision === "accept" || decision === "skip" || decision === "menu") onResolve(decision); });
  }

  private show(html: string, onResolve: (decision: Decision) => void): void {
    this.resolve = onResolve;
    this.root.innerHTML = html;
    this.root.hidden = false;
    this.root.querySelector<HTMLElement>(".campaign-event-dialog")?.focus({ preventScroll: true });
  }

  hide(): void { this.resolve = null; this.root.hidden = true; this.root.replaceChildren(); }
  destroy(): void { this.hide(); this.root.removeEventListener("click", this.handleClick); this.root.removeEventListener("keydown", this.handleKeyDown); this.root.remove(); }

  private readonly handleClick = (event: Event): void => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-decision]") : null;
    const decision = button?.dataset.decision as Decision | undefined;
    if (!decision || !this.resolve || button?.disabled) return;
    const resolve = this.resolve;
    this.hide();
    resolve(decision);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); this.root.querySelector<HTMLButtonElement>('[data-decision="menu"]')?.click(); }
    if (event.key !== "Tab") return;
    const buttons = [...this.root.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === this.root.querySelector(".campaign-event-dialog"))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
}
