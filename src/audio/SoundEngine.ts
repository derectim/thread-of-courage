export type SoundName =
  | "shoot"
  | "hit"
  | "fail"
  | "win"
  | "ui"
  | "upgrade"
  | "boss";

type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext;

/**
 * Tiny, asset-free sound engine for browser games.
 *
 * Browsers only allow audio to start after a user gesture. The engine installs
 * lightweight listeners for the first pointer/keyboard action, while unlock()
 * can also be called explicitly from a button handler.
 */
export class SoundEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private unlockPromise: Promise<boolean> | null = null;
  private muted = false;
  private readonly volume: number;
  private listeningForGesture = false;

  public constructor(volume = 0.22) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.listenForFirstGesture();
  }

  /** Attempts to create/resume audio. Safe to call repeatedly. */
  public unlock(): Promise<boolean> {
    if (this.context?.state === "running") {
      this.stopListeningForGesture();
      return Promise.resolve(true);
    }

    if (!this.unlockPromise) {
      this.unlockPromise = this.doUnlock().finally(() => {
        this.unlockPromise = null;
      });
    }

    return this.unlockPromise;
  }

  public play(sound: SoundName): void {
    if (this.muted) return;

    void this.unlock().then((ready) => {
      if (!ready || this.muted || !this.context || !this.masterGain) return;

      try {
        const now = this.context.currentTime + 0.005;

        switch (sound) {
          case "shoot":
            this.playShoot(now);
            break;
          case "hit":
            this.playHit(now);
            break;
          case "fail":
            this.playFail(now);
            break;
          case "win":
            this.playWin(now);
            break;
          case "ui":
            this.playUi(now);
            break;
          case "upgrade":
            this.playUpgrade(now);
            break;
          case "boss":
            this.playBoss(now);
            break;
        }
      } catch {
        // Audio may disappear while the page is being suspended or closed.
      }
    });
  }

  public shoot(): void {
    this.play("shoot");
  }

  public hit(): void {
    this.play("hit");
  }

  public fail(): void {
    this.play("fail");
  }

  public win(): void {
    this.play("win");
  }

  public ui(): void {
    this.play("ui");
  }

  public upgrade(): void {
    this.play("upgrade");
  }

  public boss(): void {
    this.play("boss");
  }

  public mute(): void {
    this.setMuted(true);
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;

    if (!this.context || !this.masterGain) return;

    const gain = this.masterGain.gain;
    const now = this.context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(muted ? 0 : this.volume, now, 0.015);
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public destroy(): void {
    this.stopListeningForGesture();

    const context = this.context;
    this.context = null;
    this.masterGain = null;

    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  private async doUnlock(): Promise<boolean> {
    try {
      if (!this.context || this.context.state === "closed") {
        const Context = this.getAudioContextConstructor();
        if (!Context) return false;

        // Construction happens synchronously while unlock() is called from the
        // gesture, which is required by stricter mobile browsers.
        const context = new Context({ latencyHint: "interactive" });
        const masterGain = context.createGain();
        masterGain.gain.value = this.muted ? 0 : this.volume;
        masterGain.connect(context.destination);

        this.context = context;
        this.masterGain = masterGain;
      }

      const context = this.context;
      if (context.state !== "running") {
        await context.resume();
      }

      const ready = (context.state as AudioContextState) === "running";
      if (ready) this.stopListeningForGesture();
      return ready;
    } catch {
      return false;
    }
  }

  private getAudioContextConstructor(): AudioContextConstructor | null {
    const audioGlobal = globalThis as typeof globalThis & {
      AudioContext?: AudioContextConstructor;
      webkitAudioContext?: AudioContextConstructor;
    };

    return audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext ?? null;
  }

  private listenForFirstGesture(): void {
    if (typeof document === "undefined" || this.listeningForGesture) return;

    document.addEventListener("pointerdown", this.handleFirstGesture, {
      capture: true,
      passive: true,
    });
    document.addEventListener("keydown", this.handleFirstGesture, {
      capture: true,
    });
    this.listeningForGesture = true;
  }

  private stopListeningForGesture(): void {
    if (typeof document === "undefined" || !this.listeningForGesture) return;

    document.removeEventListener("pointerdown", this.handleFirstGesture, true);
    document.removeEventListener("keydown", this.handleFirstGesture, true);
    this.listeningForGesture = false;
  }

  private readonly handleFirstGesture = (): void => {
    void this.unlock();
  };

  private playShoot(at: number): void {
    this.tone({
      at,
      duration: 0.13,
      frequency: 960,
      endFrequency: 210,
      gain: 0.32,
      type: "sawtooth",
    });
    this.noise(at, 0.075, 0.12, 2400, "highpass");
  }

  private playHit(at: number): void {
    this.tone({
      at,
      duration: 0.1,
      frequency: 190,
      endFrequency: 65,
      gain: 0.42,
      type: "square",
    });
    this.noise(at, 0.11, 0.3, 720, "lowpass");
  }

  private playFail(at: number): void {
    this.tone({
      at,
      duration: 0.24,
      frequency: 330,
      endFrequency: 245,
      gain: 0.24,
      type: "triangle",
    });
    this.tone({
      at: at + 0.2,
      duration: 0.38,
      frequency: 220,
      endFrequency: 110,
      gain: 0.28,
      type: "triangle",
    });
  }

  private playWin(at: number): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, index) => {
      this.tone({
        at: at + index * 0.09,
        duration: index === notes.length - 1 ? 0.34 : 0.16,
        frequency,
        gain: index === notes.length - 1 ? 0.24 : 0.18,
        type: "triangle",
      });
    });
  }

  private playUi(at: number): void {
    this.tone({
      at,
      duration: 0.055,
      frequency: 620,
      endFrequency: 880,
      gain: 0.16,
      type: "sine",
    });
  }

  private playUpgrade(at: number): void {
    const chime = [659.25, 880, 1318.51];
    chime.forEach((frequency, index) => {
      this.tone({
        at: at + index * 0.065,
        duration: index === chime.length - 1 ? 0.3 : 0.16,
        frequency,
        endFrequency: frequency * 1.015,
        gain: index === chime.length - 1 ? 0.2 : 0.15,
        type: "sine",
      });
    });

    // A quiet upper partial gives the purchase chime a small metallic sparkle.
    this.tone({
      at: at + 0.13,
      duration: 0.22,
      frequency: 2637.02,
      endFrequency: 2670,
      gain: 0.055,
      type: "triangle",
    });
  }

  private playBoss(at: number): void {
    this.tone({
      at,
      duration: 0.52,
      frequency: 112,
      endFrequency: 62,
      gain: 0.34,
      type: "sawtooth",
    });
    this.tone({
      at: at + 0.055,
      duration: 0.42,
      frequency: 196,
      endFrequency: 104,
      gain: 0.12,
      type: "square",
    });
    this.noise(at, 0.28, 0.1, 340, "lowpass");
  }

  private tone(options: {
    at: number;
    duration: number;
    frequency: number;
    endFrequency?: number;
    gain: number;
    type: OscillatorType;
  }): void {
    const context = this.context;
    const output = this.masterGain;
    if (!context || !output) return;

    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const end = options.at + options.duration;

    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.frequency, options.at);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        options.endFrequency,
        end,
      );
    }

    envelope.gain.setValueAtTime(0.0001, options.at);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, options.gain),
      options.at + Math.min(0.008, options.duration * 0.2),
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(envelope);
    envelope.connect(output);
    oscillator.start(options.at);
    oscillator.stop(end + 0.02);
  }

  private noise(
    at: number,
    duration: number,
    gainAmount: number,
    cutoff: number,
    filterType: BiquadFilterType,
  ): void {
    const context = this.context;
    const output = this.masterGain;
    if (!context || !output) return;

    const sampleCount = Math.max(1, Math.ceil(context.sampleRate * duration));
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const samples = buffer.getChannelData(0);

    for (let index = 0; index < samples.length; index += 1) {
      const fade = 1 - index / samples.length;
      samples[index] = (Math.random() * 2 - 1) * fade;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const end = at + duration;

    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(cutoff, at);
    filter.Q.value = 0.8;
    envelope.gain.setValueAtTime(Math.max(0.0001, gainAmount), at);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(output);
    source.start(at);
    source.stop(end + 0.01);
  }
}

export default SoundEngine;
