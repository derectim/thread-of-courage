import type { VictoryChoice } from "../game/raidFlow";

interface VictoryPresentation {
  readonly title: string;
  readonly body: string;
  readonly eyebrow: string;
  readonly monsterArt: string;
  readonly monsterName: string;
  readonly reward: number | null;
  readonly continueLabel: string;
  readonly nextStep: string;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const art = (file: string) => new URL(`${import.meta.env.BASE_URL}assets/art/${file}`, document.baseURI).href;

export default class VictoryDialog {
  private readonly dialog: HTMLDialogElement;
  private onChoice: ((choice: VictoryChoice) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.dialog = document.createElement("dialog");
    this.dialog.className = "victory-dialog";
    this.dialog.setAttribute("aria-labelledby", "victory-title");
    this.dialog.addEventListener("click", this.handleClick);
    this.dialog.addEventListener("cancel", this.handleCancel);
    this.dialog.addEventListener("keydown", this.handleKeyDown);
    parent.append(this.dialog);
  }

  show(view: VictoryPresentation, onChoice: (choice: VictoryChoice) => void): void {
    this.onChoice = onChoice;
    this.dialog.innerHTML = `<div class="victory-scroll"><div class="victory-ribbon"><span aria-hidden="true">✦</span> ${escapeHtml(view.eyebrow)} <span aria-hidden="true">✦</span></div>
      <div class="victory-portrait"><img src="${art(view.monsterArt)}" alt="${escapeHtml(view.monsterName)}" /><span class="victory-seal" aria-label="Побеждён">✓</span></div>
      <h2 id="victory-title">${escapeHtml(view.title)}</h2><p class="victory-story">${escapeHtml(view.body).replaceAll("\n", "<br />")}</p>
      ${view.reward !== null ? `<div class="victory-reward"><img src="${art("currency-thread-spool.webp")}" alt="" /><span><small>${view.reward > 0 ? "ТВОЯ НАГРАДА" : "УЗЕЛ УЖЕ ПРОЙДЕН"}</small><strong>${view.reward > 0 ? `+${view.reward} нитей` : "Без новых нитей"}</strong><em>${view.reward > 0 ? "Уже добавлены в кошелёк" : "Первая награда уже получена"}</em></span></div>` : '<div class="victory-practice-note">Узор освоен · без наград</div>'}
      </div><footer><small>${escapeHtml(view.nextStep)}</small><button class="victory-continue" data-victory="continue">${escapeHtml(view.continueLabel)} <span aria-hidden="true">→</span></button><button class="victory-menu" data-victory="menu">В меню</button></footer>`;
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.querySelector<HTMLButtonElement>('[data-victory="continue"]')?.focus({ preventScroll: true });
  }

  private choose(choice: VictoryChoice): void {
    const callback = this.onChoice;
    if (!callback) return;
    this.hide();
    callback(choice);
  }
  private readonly handleClick = (event: Event): void => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-victory]") : null;
    if (button?.dataset.victory === "continue" || button?.dataset.victory === "menu") this.choose(button.dataset.victory);
  };
  private readonly handleCancel = (event: Event): void => { event.preventDefault(); this.choose("menu"); };
  private readonly handleKeyDown = (event: KeyboardEvent): void => { event.stopPropagation(); };

  hide(): void { this.onChoice = null; this.dialog.close(); }
  destroy(): void {
    this.hide();
    this.dialog.removeEventListener("click", this.handleClick);
    this.dialog.removeEventListener("cancel", this.handleCancel);
    this.dialog.removeEventListener("keydown", this.handleKeyDown);
    this.dialog.remove();
  }
}
