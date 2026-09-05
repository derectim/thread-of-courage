import { CAMPAIGN_BOONS, MAX_CAMPAIGN_BOON_LEVEL, getCampaignBoonLevel, type CampaignBoonId, type CampaignBoonsState } from "../game/CampaignBoons";

/** DOM overlay keeps the three choices readable in small and rotated viewports. */
export default class BossBoonDialog {
  private readonly root: HTMLDivElement;
  private state: CampaignBoonsState | null = null;
  private selected: CampaignBoonId | null = null;
  private resolved = false;

  public constructor(parent: HTMLElement, private readonly onResolve: (id: CampaignBoonId | null, destination: "continue" | "menu") => void) {
    this.root = document.createElement("div");
    this.root.className = "boss-boon-layer";
    this.root.hidden = true;
    this.root.addEventListener("click", this.handleClick);
    this.root.addEventListener("keydown", this.handleKeyDown);
    parent.append(this.root);
  }

  public show(state: CampaignBoonsState): void {
    this.state = state;
    this.selected = null;
    this.resolved = false;
    this.root.hidden = false;
    this.render();
    this.root.querySelector<HTMLElement>(".boss-boon-dialog")?.focus({ preventScroll: true });
  }

  public hide(): void { this.root.hidden = true; this.root.replaceChildren(); }
  public destroy(): void {
    this.root.removeEventListener("click", this.handleClick);
    this.root.removeEventListener("keydown", this.handleKeyDown);
    this.root.remove();
  }

  private readonly handleClick = (event: Event): void => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
    if (!button || button.disabled || this.resolved || !this.state) return;
    const id = button.dataset.boon as CampaignBoonId | undefined;
    if (id && CAMPAIGN_BOONS.some((boon) => boon.id === id) && getCampaignBoonLevel(this.state, id) < MAX_CAMPAIGN_BOON_LEVEL) {
      this.selected = id;
      this.render();
      this.root.querySelector<HTMLButtonElement>(`[data-boon="${id}"]`)?.focus({ preventScroll: true });
      return;
    }
    const destination = button.dataset.destination;
    if (destination !== "menu" && destination !== "continue") return;
    if (destination === "continue" && !this.selected) return;
    this.resolved = true;
    this.onResolve(this.selected, destination);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      this.root.querySelector<HTMLButtonElement>('[data-destination="menu"]')?.click();
    }
    if (event.key !== "Tab") return;
    const buttons = [...this.root.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === this.root.querySelector(".boss-boon-dialog"))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  private render(): void {
    if (!this.state) return;
    const scroll = this.root.querySelector(".boss-boon-scroll")?.scrollTop ?? 0;
    this.root.innerHTML = `<section class="boss-boon-dialog" role="dialog" aria-modal="true" aria-labelledby="boss-boon-title" aria-describedby="boss-boon-summary" tabindex="-1">
      <header><span>БОСС ЭТАПА ${this.state.pendingBossStage} ПОБЕЖДЁН</span><h2 id="boss-boon-title">Вплети новый узор</h2><p id="boss-boon-summary">Выбери один бонус до конца похода. Нити и пройденный этап уже сохранены.</p></header>
      <div class="boss-boon-scroll"><div class="boss-boon-options" role="group" aria-label="Один из трёх узоров">${CAMPAIGN_BOONS.map((boon) => {
        const level = getCampaignBoonLevel(this.state!, boon.id);
        const maxed = level >= MAX_CAMPAIGN_BOON_LEVEL;
        const art = new URL(`${import.meta.env.BASE_URL}assets/art/${boon.iconFileName}`, document.baseURI).href;
        return `<button class="boss-boon-card ${this.selected === boon.id ? "is-selected" : ""}" data-boon="${boon.id}" aria-pressed="${this.selected === boon.id}" ${maxed ? "disabled" : ""}>
          <img src="${art}" alt="" /><span class="boon-card-copy"><small>${maxed ? "УЗОР ЗАВЕРШЁН" : `УРОВЕНЬ ${level + 1} / ${MAX_CAMPAIGN_BOON_LEVEL}`}</small><strong>${boon.name}</strong><span>${boon.description}</span><b>${maxed ? "Максимум" : this.selected === boon.id ? "✓ Выбран" : boon.effect}</b></span>
        </button>`;
      }).join("")}</div><p class="boss-boon-note">Узоры складываются до 3 уровней каждый. Выход в меню сохраняет их; поражение в основном походе распускает узор. На недельный маршрут они не влияют.</p></div>
      <footer><span role="status">${this.selected ? `Выбран: ${CAMPAIGN_BOONS.find((boon) => boon.id === this.selected)!.name}` : "Коснись понравившегося узора"}</span><div><button data-destination="menu">${this.selected ? "Взять и в меню" : "Решить позже"}</button><button data-destination="continue" ${this.selected ? "" : "disabled"}>Взять и продолжить</button></div></footer>
    </section>`;
    const nextScroll = this.root.querySelector(".boss-boon-scroll");
    if (nextScroll) nextScroll.scrollTop = scroll;
  }
}
