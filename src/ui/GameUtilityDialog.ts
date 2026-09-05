import type { AudioSettings } from "../audio/AudioSettings";

export type CurrencyKind = "thread" | "premium";
const art = (file: string) => new URL(`${import.meta.env.BASE_URL}assets/art/${file}`, document.baseURI).href;

/** Native modality keeps menu controls and combat keys behind the dialog inert. */
export default class GameUtilityDialog {
  private readonly dialog: HTMLDialogElement;
  private settings: AudioSettings | null = null;
  private onChange: ((settings: AudioSettings) => void) | null = null;
  private onClosed: (() => void) | null = null;

  constructor(parent: HTMLElement, private readonly previewEffect: () => void) {
    this.dialog = document.createElement("dialog");
    this.dialog.className = "game-utility-dialog";
    this.dialog.setAttribute("aria-labelledby", "utility-title");
    this.dialog.addEventListener("click", this.handleClick);
    this.dialog.addEventListener("input", this.handleInput);
    this.dialog.addEventListener("change", this.handleChange);
    this.dialog.addEventListener("keydown", this.handleKeyDown);
    this.dialog.addEventListener("cancel", this.handleCancel);
    parent.append(this.dialog);
  }

  get isOpen(): boolean { return this.dialog.open; }

  showCurrency(kind: CurrencyKind): void {
    const thread = kind === "thread";
    this.settings = null;
    this.onChange = null;
    this.show(`<header><span class="utility-kicker">ВАЛЮТЫ МАСТЕРСКОЙ</span><button data-utility="close" class="utility-close" aria-label="Закрыть подсказку">×</button></header>
      <div class="utility-scroll currency-explanation"><div class="utility-medallion"><img src="${art(thread ? "currency-thread-spool.webp" : "currency-moon-button.webp")}" alt="" /></div>
      <h2 id="utility-title">${thread ? "Нити" : "Пуговицы"}</h2>
      <p>${thread ? "Нити — обычная игровая валюта. Получай их за победы над существами." : "Пуговицы — платная валюта. Возможность покупать пуговицы появится позже."}</p>
      ${thread ? "<small>Трать нити на усиления, иглы и украшения.</small>" : '<span class="utility-coming-soon">Покупка пока недоступна</span>'}</div>
      <footer><button data-utility="close" class="utility-primary">Понятно</button></footer>`);
  }

  showAudio(settings: AudioSettings, onChange: (settings: AudioSettings) => void, onClosed: () => void): void {
    this.settings = { ...settings };
    this.onChange = onChange;
    this.onClosed = onClosed;
    const row = (key: "musicVolume" | "effectsVolume", title: string, detail: string, symbol: string) => {
      const percent = Math.round(settings[key] * 100);
      return `<div class="audio-setting"><label for="audio-${key}"><span class="audio-setting-symbol" aria-hidden="true">${symbol}</span><span><strong>${title}</strong><small>${detail}</small></span><output for="audio-${key}">${percent}%</output></label><input id="audio-${key}" data-volume="${key}" type="range" min="0" max="100" step="1" value="${percent}" aria-valuetext="${percent}%" style="--level:${percent}%" /></div>`;
    };
    this.show(`<header><span class="utility-kicker">ЗВУКИ МАСТЕРСКОЙ</span><button data-utility="close" class="utility-close" aria-label="Закрыть настройки звука">×</button></header>
      <div class="utility-scroll"><h2 id="utility-title">Настрой свой звук</h2><p class="audio-intro">Музыка и эффекты — на твою громкость.</p>
      ${row("musicVolume", "Музыка", "Мелодии меню и боёв", "♪")}${row("effectsVolume", "Игровые эффекты", "Выстрелы, попадания и кнопки", "✦")}
      <button class="audio-mute" data-utility="mute" aria-pressed="${settings.muted}"></button><small class="audio-save-note">Настройки сохраняются автоматически. Во время настройки бой приостановлен.</small></div>
      <footer><button class="utility-primary" data-utility="close">Готово</button></footer>`);
    this.updateMuteButton();
  }

  private show(html: string): void {
    this.dialog.innerHTML = html;
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.querySelector<HTMLButtonElement>('button[data-utility="close"]')?.focus({ preventScroll: true });
  }

  private updateMuteButton(): void {
    const button = this.dialog.querySelector<HTMLButtonElement>(".audio-mute");
    if (!button || !this.settings) return;
    button.setAttribute("aria-pressed", String(this.settings.muted));
    button.textContent = this.settings.muted ? "Включить звук и музыку" : "Выключить весь звук";
  }

  private readonly handleClick = (event: Event): void => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-utility]") : null;
    if (button?.dataset.utility === "close") this.hide();
    if (button?.dataset.utility === "mute" && this.settings) {
      this.settings = { ...this.settings, muted: !this.settings.muted };
      this.onChange?.(this.settings);
      this.updateMuteButton();
    }
  };

  private readonly handleInput = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !this.settings) return;
    const key = input.dataset.volume;
    if (key !== "musicVolume" && key !== "effectsVolume") return;
    const percent = input.valueAsNumber;
    input.style.setProperty("--level", `${percent}%`);
    input.setAttribute("aria-valuetext", `${percent}%`);
    const output = input.closest(".audio-setting")?.querySelector("output");
    if (output) output.textContent = `${percent}%`;
    this.settings = { ...this.settings, [key]: percent / 100 };
    this.onChange?.(this.settings);
  };
  private readonly handleChange = (event: Event): void => {
    if (event.target instanceof HTMLInputElement && event.target.dataset.volume === "effectsVolume") this.previewEffect();
  };
  private readonly handleKeyDown = (event: KeyboardEvent): void => { event.stopPropagation(); };
  private readonly handleCancel = (event: Event): void => { event.preventDefault(); this.hide(); };

  hide(): void {
    const onClosed = this.onClosed;
    this.onClosed = null;
    this.onChange = null;
    this.settings = null;
    this.dialog.close();
    onClosed?.();
  }

  destroy(): void {
    this.onClosed = null;
    this.hide();
    this.dialog.removeEventListener("click", this.handleClick);
    this.dialog.removeEventListener("input", this.handleInput);
    this.dialog.removeEventListener("change", this.handleChange);
    this.dialog.removeEventListener("keydown", this.handleKeyDown);
    this.dialog.removeEventListener("cancel", this.handleCancel);
    this.dialog.remove();
  }
}
