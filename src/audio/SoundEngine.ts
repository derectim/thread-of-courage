import { DEFAULT_MUSIC_VOLUME, DEFAULT_EFFECTS_VOLUME, normalizeVolume } from "./AudioSettings";

export type SoundName =
  | "shoot"
  | "hit"
  | "ricochet"
  | "fail"
  | "win"
  | "ui"
  | "upgrade"
  | "boss";

export type MusicTheme = "menu" | "story" | "raid" | "boss";

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
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private musicVolume = DEFAULT_MUSIC_VOLUME;
  private effectsVolume = DEFAULT_EFFECTS_VOLUME;
  private musicDucking = 1;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicVoiceGain: GainNode | null = null;
  private requestedMusicTheme: MusicTheme | null = null;
  private activeMusicTheme: MusicTheme | null = null;
  private readonly musicBuffers = new Map<MusicTheme, AudioBuffer>();
  private unlockPromise: Promise<boolean> | null = null;
  private needsAudioPrime = true;
  private muted = false;
  private readonly volume: number;
  private listeningForGesture = false;
  private gestureCompletionConfirmed = false;
  private listeningForVisibility = false;
  private platformPaused = false;
  private waitingForPlatformGesture = false;
  private destroyed = false;

  public constructor(volume = 0.22) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.listenForFirstGesture();
    this.listenForVisibilityChanges();
  }

  /** Attempts to create/resume audio. Safe to call repeatedly. */
  public unlock(): Promise<boolean> {
    return this.unlockInternal(false);
  }

  private unlockInternal(fromTrustedGesture: boolean): Promise<boolean> {
    if (this.destroyed || this.platformPaused || !this.isDocumentVisible()) {
      this.listenForFirstGesture();
      return Promise.resolve(false);
    }
    if (this.waitingForPlatformGesture && !fromTrustedGesture) {
      this.listenForFirstGesture();
      return Promise.resolve(false);
    }

    const context = this.getOrCreateAudioContext();
    if (!context) {
      this.listenForFirstGesture();
      return Promise.resolve(false);
    }

    if (fromTrustedGesture || this.needsAudioPrime) {
      this.primeAudioOutput(context);
    }

    if (context.state === "running") {
      this.needsAudioPrime = false;
      this.waitingForPlatformGesture = false;
      this.restoreMasterGain();
      this.stopListeningAfterConfirmedGesture();
      this.ensureRequestedMusic();
      return Promise.resolve(true);
    }

    let resumeAttempt: Promise<void>;
    try {
      // Calling resume() in this synchronous stack is important on WebKit:
      // awaiting anything before it can consume the transient user activation.
      resumeAttempt = Promise.resolve(context.resume());
    } catch {
      this.listenForFirstGesture();
      return Promise.resolve(false);
    }

    if (!fromTrustedGesture && this.unlockPromise) {
      void resumeAttempt.catch(() => undefined);
      return this.unlockPromise;
    }

    return this.trackUnlock(this.finishUnlock(context, resumeAttempt));
  }

  public play(sound: SoundName): void {
    if (
      this.destroyed ||
      this.platformPaused ||
      this.muted ||
      !this.isDocumentVisible()
    ) {
      return;
    }

    void this.unlock().then((ready) => {
      if (
        !ready ||
        this.platformPaused ||
        this.muted ||
        !this.isDocumentVisible() ||
        !this.context ||
        !this.masterGain
      ) {
        return;
      }

      try {
        const now = this.context.currentTime + 0.005;

        switch (sound) {
          case "shoot":
            this.playShoot(now);
            break;
          case "hit":
            this.playHit(now);
            break;
          case "ricochet":
            this.playRicochet(now);
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

  public ricochet(): void {
    this.play("ricochet");
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

  /**
   * Selects an asset-free background loop. Calling this before the first user
   * gesture only records the desired theme; AudioContext creation remains
   * deferred until unlock().
   */
  public setMusicTheme(theme: MusicTheme): void {
    if (this.destroyed) return;

    this.requestedMusicTheme = theme;
    if (this.muted || this.platformPaused || !this.isDocumentVisible()) return;

    if (this.context?.state === "running") {
      this.ensureRequestedMusic();
    } else {
      this.listenForFirstGesture();
    }
  }

  public stopMusic(): void {
    this.requestedMusicTheme = null;
    this.stopMusicSource();
  }

  /**
   * Smoothly lowers or restores music without affecting effects or mute state.
   * The value is retained even when audio has not been unlocked yet.
   */
  public setMusicDucking(multiplier: number, transitionSeconds = 0.18): void {
    if (this.destroyed) return;

    const ducking = Number.isFinite(multiplier)
      ? Math.max(0.05, Math.min(1, multiplier))
      : 1;
    const transition = Number.isFinite(transitionSeconds)
      ? Math.max(0, Math.min(10, transitionSeconds))
      : 0.18;
    this.musicDucking = ducking;
    const target = ducking * (this.musicVolume / DEFAULT_MUSIC_VOLUME);

    const context = this.context;
    const gain = this.musicBus?.gain;
    if (!context || !gain) return;

    const now = context.currentTime;
    const currentValue = Math.max(0, gain.value);
    gain.cancelScheduledValues(now);
    if (
      transition <= 0 ||
      this.muted ||
      this.platformPaused ||
      context.state !== "running" ||
      !this.isDocumentVisible()
    ) {
      gain.setValueAtTime(target, now);
      return;
    }

    gain.setValueAtTime(currentValue, now);
    gain.linearRampToValueAtTime(target, now + transition);
  }

  /** Defaults preserve the original mix, with room to increase either channel. */
  public setMusicVolume(value: number): void {
    if (this.destroyed) return;
    this.musicVolume = normalizeVolume(value, DEFAULT_MUSIC_VOLUME);
    this.setMusicDucking(this.musicDucking, 0.08);
  }

  public setEffectsVolume(value: number): void {
    if (this.destroyed) return;
    this.effectsVolume = normalizeVolume(value, DEFAULT_EFFECTS_VOLUME);
    if (!this.context || !this.effectsBus) return;
    const gain = this.effectsBus.gain, now = this.context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(this.effectsVolume / DEFAULT_EFFECTS_VOLUME, now, 0.015);
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;

    if (!this.context || !this.masterGain) {
      if (!muted) this.listenForFirstGesture();
      return;
    }

    const gain = this.masterGain.gain;
    const now = this.context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(muted || this.platformPaused ? 0 : this.volume, now, 0.015);

    if (muted) {
      this.needsAudioPrime = true;
      this.stopMusicSource();
      this.listenForFirstGesture();
    } else if (!this.platformPaused && this.isDocumentVisible()) {
      // setMuted(false) is normally called by the sound button. Going through
      // unlock() keeps that click in the same synchronous WebKit activation.
      this.needsAudioPrime = true;
      void this.unlock();
    } else {
      this.listenForFirstGesture();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /** Immediately silences audio without changing the player's mute setting. */
  public pauseForPlatform(): void {
    if (this.destroyed || this.platformPaused) return;
    this.platformPaused = true;
    this.waitingForPlatformGesture = true;
    this.needsAudioPrime = true;
    this.stopMusicSource(true);

    const context = this.context;
    const gain = this.masterGain?.gain;
    if (context && gain) {
      const now = context.currentTime;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(0, now);
    }
    this.listenForFirstGesture();
  }

  /**
   * Allows audio again, but deliberately waits for a new trusted gesture so
   * iOS/WKWebView can unlock the output after VK restores the view.
   */
  public resumeForPlatform(): void {
    if (this.destroyed || !this.platformPaused) return;
    this.platformPaused = false;
    this.needsAudioPrime = true;
    this.listenForFirstGesture();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopListeningForGesture();
    this.stopListeningForVisibilityChanges();
    this.stopMusicSource(true);
    this.musicBuffers.clear();

    const context = this.context;
    if (context) context.onstatechange = null;
    this.context = null;
    this.masterGain = null;
    this.musicBus = null;
    this.effectsBus = null;

    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  private getOrCreateAudioContext(): AudioContext | null {
    try {
      if (!this.context || this.context.state === "closed") {
        const Context = this.getAudioContextConstructor();
        if (!Context) return null;

        // Construction happens synchronously while unlock() is called from the
        // gesture, which is required by stricter mobile browsers.
        let context: AudioContext;
        try {
          context = new Context({ latencyHint: "interactive" });
        } catch {
          // Older webkitAudioContext constructors reject the options object.
          context = new Context();
        }
        const masterGain = context.createGain();
        masterGain.gain.value = this.muted || this.platformPaused ? 0 : this.volume;
        masterGain.connect(context.destination);
        const musicBus = context.createGain();
        musicBus.gain.value = this.musicDucking * (this.musicVolume / DEFAULT_MUSIC_VOLUME);
        musicBus.connect(masterGain);
        const effectsBus = context.createGain();
        effectsBus.gain.value = this.effectsVolume / DEFAULT_EFFECTS_VOLUME;
        effectsBus.connect(masterGain);

        this.context = context;
        this.masterGain = masterGain;
        this.musicBus = musicBus;
        this.effectsBus = effectsBus;
        this.musicBuffers.clear();
        this.needsAudioPrime = true;
        context.onstatechange = this.handleAudioContextStateChange;
      }

      return this.context;
    } catch {
      return null;
    }
  }

  private trackUnlock(attempt: Promise<boolean>): Promise<boolean> {
    let tracked: Promise<boolean>;
    tracked = attempt.finally(() => {
      if (this.unlockPromise === tracked) this.unlockPromise = null;
    });
    this.unlockPromise = tracked;
    return tracked;
  }

  private async finishUnlock(
    context: AudioContext,
    resumeAttempt: Promise<void>,
  ): Promise<boolean> {
    try {
      // Some WebKit builds can leave resume() pending after returning from the
      // background. A bounded wait keeps a later trusted gesture able to retry.
      await this.waitForResumeAttempt(resumeAttempt);

      if (this.destroyed || this.platformPaused || context !== this.context) {
        return false;
      }
      if (!this.isDocumentVisible()) {
        this.needsAudioPrime = true;
        this.listenForFirstGesture();
        return false;
      }

      const ready = (context.state as AudioContextState) === "running";
      if (ready) {
        this.needsAudioPrime = false;
        this.waitingForPlatformGesture = false;
        this.restoreMasterGain();
        this.stopListeningAfterConfirmedGesture();
        this.ensureRequestedMusic();
      } else {
        this.needsAudioPrime = true;
        this.listenForFirstGesture();
      }
      return ready;
    } catch {
      this.needsAudioPrime = true;
      this.listenForFirstGesture();
      return false;
    }
  }

  private waitForResumeAttempt(attempt: Promise<void>): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timeoutId);
        resolve();
      };
      const timeoutId = globalThis.setTimeout(finish, 450);
      void attempt.then(finish, finish);
    });
  }

  /**
   * Starts one silent sample while the browser still sees the trusted event.
   * iOS Safari and WKWebView have historically needed this in addition to
   * AudioContext.resume() before later buffer sources become audible.
   */
  private primeAudioOutput(context: AudioContext): void {
    try {
      const buffer = context.createBuffer(1, 1, context.sampleRate);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        try {
          source.disconnect();
        } catch {
          // The context may have been replaced while the sample was queued.
        }
      };
      source.start(0);
    } catch {
      // A failed prime is retried on the next trusted gesture.
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
    if (
      this.destroyed ||
      typeof document === "undefined" ||
      this.listeningForGesture
    ) {
      return;
    }

    document.addEventListener("pointerdown", this.handleFirstGesture, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchend", this.handleFirstGesture, {
      capture: true,
      passive: true,
    });
    document.addEventListener("mousedown", this.handleFirstGesture, {
      capture: true,
      passive: true,
    });
    document.addEventListener("click", this.handleFirstGesture, {
      capture: true,
      passive: true,
    });
    document.addEventListener("keydown", this.handleFirstGesture, {
      capture: true,
    });
    this.gestureCompletionConfirmed = false;
    this.listeningForGesture = true;
  }

  private stopListeningForGesture(): void {
    if (typeof document === "undefined" || !this.listeningForGesture) return;

    document.removeEventListener("pointerdown", this.handleFirstGesture, true);
    document.removeEventListener("touchend", this.handleFirstGesture, true);
    document.removeEventListener("mousedown", this.handleFirstGesture, true);
    document.removeEventListener("click", this.handleFirstGesture, true);
    document.removeEventListener("keydown", this.handleFirstGesture, true);
    this.listeningForGesture = false;
  }

  private stopListeningAfterConfirmedGesture(): void {
    if (this.gestureCompletionConfirmed) this.stopListeningForGesture();
  }

  private readonly handleFirstGesture = (event: Event): void => {
    // Keep the touchend/click fallbacks alive after pointerdown. Some WebKit
    // versions report a running context for pointerdown but do not produce
    // audible output until the completed tap is delivered.
    if (
      event.type === "touchend" ||
      event.type === "mousedown" ||
      event.type === "click" ||
      event.type === "keydown"
    ) {
      this.gestureCompletionConfirmed = true;
    }
    void this.unlockInternal(true);
  };

  private readonly handleAudioContextStateChange = (): void => {
    const context = this.context;
    if (this.destroyed || !context) return;

    if (context.state === "running") {
      if (!this.needsAudioPrime && this.isDocumentVisible()) {
        this.stopListeningAfterConfirmedGesture();
        this.ensureRequestedMusic();
      }
      return;
    }

    // Safari may use a non-standard "interrupted" state for calls, route
    // changes, and backgrounding. Treat every non-running state as requiring
    // another trusted gesture and rebuild the looping source afterwards.
    this.needsAudioPrime = true;
    this.stopMusicSource(true);
    this.listenForFirstGesture();
  };

  private listenForVisibilityChanges(): void {
    if (
      typeof document === "undefined" ||
      this.listeningForVisibility
    ) {
      return;
    }

    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.listeningForVisibility = true;
  }

  private stopListeningForVisibilityChanges(): void {
    if (typeof document === "undefined" || !this.listeningForVisibility) return;

    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.listeningForVisibility = false;
  }

  private readonly handleVisibilityChange = (): void => {
    this.needsAudioPrime = true;
    if (!this.isDocumentVisible()) {
      this.stopMusicSource(true);
      this.listenForFirstGesture();
      return;
    }

    // Do not manually suspend/resume on visibility transitions. WebKit can
    // race a late suspend() against the first foreground tap and end up silent
    // while still reporting a healthy context. The next gesture re-primes it.
    this.listenForFirstGesture();
  };

  private isDocumentVisible(): boolean {
    return (
      typeof document === "undefined" || document.visibilityState !== "hidden"
    );
  }

  private restoreMasterGain(): void {
    const context = this.context;
    const gain = this.masterGain?.gain;
    if (!context || !gain || this.platformPaused) return;

    const now = context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(this.muted ? 0 : this.volume, now, 0.015);
  }

  private ensureRequestedMusic(): void {
    const theme = this.requestedMusicTheme;
    const context = this.context;
    const musicBus = this.musicBus;
    if (
      this.destroyed ||
      this.platformPaused ||
      this.muted ||
      this.needsAudioPrime ||
      !theme ||
      !context ||
      !musicBus ||
      context.state !== "running" ||
      !this.isDocumentVisible() ||
      this.activeMusicTheme === theme
    ) {
      return;
    }

    const buffer = this.getMusicBuffer(context, theme);
    this.stopMusicSource();

    const source = context.createBufferSource();
    const voiceGain = context.createGain();
    const now = context.currentTime;
    const level = this.getMusicLevel(theme);

    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = buffer.duration;
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.exponentialRampToValueAtTime(level, now + 0.16);
    source.connect(voiceGain);
    voiceGain.connect(musicBus);

    source.onended = () => {
      try {
        source.disconnect();
        voiceGain.disconnect();
      } catch {
        // Nodes may already be disconnected while tearing down the context.
      }
    };

    this.musicSource = source;
    this.musicVoiceGain = voiceGain;
    this.activeMusicTheme = theme;
    source.start(now + 0.015);
  }

  private stopMusicSource(immediate = false): void {
    const source = this.musicSource;
    const voiceGain = this.musicVoiceGain;
    const context = this.context;

    this.musicSource = null;
    this.musicVoiceGain = null;
    this.activeMusicTheme = null;
    if (!source) return;

    try {
      if (!immediate && context && voiceGain && context.state !== "closed") {
        const now = context.currentTime;
        voiceGain.gain.cancelScheduledValues(now);
        voiceGain.gain.setTargetAtTime(0.0001, now, 0.012);
        source.stop(now + 0.06);
      } else {
        source.stop();
      }
    } catch {
      // Stopping an already-ended source is harmless for this tiny engine.
    }
  }

  private getMusicLevel(theme: MusicTheme): number {
    switch (theme) {
      case "menu":
        return 0.56;
      case "story":
        return 1.1;
      case "raid":
        return 0.48;
      case "boss":
        return 0.58;
    }
  }

  private getMusicBuffer(context: AudioContext, theme: MusicTheme): AudioBuffer {
    const cached = this.musicBuffers.get(theme);
    if (cached) return cached;

    const bpm =
      theme === "story"
        ? 64
        : theme === "menu"
          ? 72
          : theme === "raid"
            ? 84
            : 78;
    const beatDuration = 60 / bpm;
    const beatCount = 16;
    const duration = beatDuration * beatCount;
    const sampleRate = context.sampleRate;
    const frameCount = Math.max(1, Math.ceil(duration * sampleRate));
    const buffer = context.createBuffer(1, frameCount, sampleRate);
    const samples = buffer.getChannelData(0);

    const progressions: Record<MusicTheme, readonly (readonly number[])[]> = {
      menu: [
        [50, 53, 57],
        [46, 50, 53],
        [53, 57, 60],
        [48, 52, 55],
      ],
      story: [
        [50, 53, 57],
        [45, 50, 53],
        [46, 50, 53],
        [48, 53, 55],
      ],
      raid: [
        [50, 53, 57],
        [50, 55, 58],
        [46, 50, 53],
        [48, 52, 55],
      ],
      boss: [
        [38, 41, 45],
        [39, 43, 46],
        [36, 39, 43],
        [37, 41, 44],
      ],
    };
    const motifs: Record<MusicTheme, readonly number[]> = {
      menu: [62, 65, 69, 65, 58, 62, 65, 62, 65, 69, 72, 69, 60, 64, 67, 64],
      story: [
        62, 65, 69, 65, 60, 64, 67, 64, 58, 62, 65, 69, 57, 60, 64, 62,
      ],
      raid: [62, 69, 65, 69, 62, 70, 67, 65, 58, 65, 62, 65, 60, 67, 64, 67],
      boss: [50, 57, 53, 57, 51, 58, 55, 51, 48, 55, 51, 55, 49, 56, 53, 49],
    };
    const chords = progressions[theme];
    const motif = motifs[theme];

    chords.forEach((chord, chordIndex) => {
      const chordStart = chordIndex * 4 * beatDuration;
      chord.forEach((midi, noteIndex) => {
        this.addMusicTone(
          samples,
          sampleRate,
          chordStart,
          beatDuration * 3.9,
          this.midiToFrequency(midi),
          theme === "boss" ? 0.055 : theme === "story" ? 0.04 : 0.045,
          "pad",
          noteIndex * 0.012,
        );
      });

      this.addMusicTone(
        samples,
        sampleRate,
        chordStart,
        beatDuration * 1.7,
        this.midiToFrequency(chord[0] - 12),
        theme === "boss" ? 0.105 : theme === "story" ? 0.06 : 0.075,
        "bass",
      );
      this.addMusicTone(
        samples,
        sampleRate,
        chordStart + beatDuration * 2,
        beatDuration * 1.7,
        this.midiToFrequency(chord[0] - 12),
        theme === "boss" ? 0.09 : theme === "story" ? 0.052 : 0.06,
        "bass",
      );
    });

    motif.forEach((midi, beatIndex) => {
      const subdivision = theme === "raid" ? 0.5 : 1;
      const start = beatIndex * beatDuration;
      this.addMusicTone(
        samples,
        sampleRate,
        start,
        beatDuration * (theme === "story" ? 0.82 : theme === "menu" ? 0.72 : 0.52),
        this.midiToFrequency(midi),
        theme === "boss" ? 0.055 : theme === "story" ? 0.052 : 0.065,
        "pluck",
      );

      if (subdivision < 1 && beatIndex % 2 === 1) {
        this.addMusicTone(
          samples,
          sampleRate,
          start + beatDuration * subdivision,
          beatDuration * 0.34,
          this.midiToFrequency(midi - 12),
          0.032,
          "pluck",
        );
      }
    });

    const edgeFrames = Math.min(
      Math.floor(sampleRate * 0.05),
      Math.floor(samples.length / 2),
    );
    let peak = 0;
    for (let index = 0; index < samples.length; index += 1) {
      if (edgeFrames > 0) {
        const edge = Math.min(index, samples.length - 1 - index);
        if (edge < edgeFrames) samples[index] *= edge / edgeFrames;
      }
      peak = Math.max(peak, Math.abs(samples[index]));
    }

    if (peak > 0.78) {
      const normalization = 0.78 / peak;
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] *= normalization;
      }
    }

    this.musicBuffers.set(theme, buffer);
    return buffer;
  }

  private addMusicTone(
    samples: Float32Array,
    sampleRate: number,
    start: number,
    duration: number,
    frequency: number,
    gain: number,
    voice: "pad" | "bass" | "pluck",
    phaseOffset = 0,
  ): void {
    const startFrame = Math.max(0, Math.floor(start * sampleRate));
    const frameCount = Math.max(1, Math.floor(duration * sampleRate));
    const endFrame = Math.min(samples.length, startFrame + frameCount);
    const attack = voice === "pad" ? 0.18 : voice === "bass" ? 0.025 : 0.008;
    const release = voice === "pad" ? 0.36 : voice === "bass" ? 0.22 : 0.14;

    for (let frame = startFrame; frame < endFrame; frame += 1) {
      const time = (frame - startFrame) / sampleRate;
      const remaining = duration - time;
      const attackEnvelope = Math.min(1, time / attack);
      const releaseEnvelope = Math.min(1, remaining / release);
      const envelope =
        Math.sin((Math.min(1, attackEnvelope) * Math.PI) / 2) *
        Math.sin((Math.min(1, releaseEnvelope) * Math.PI) / 2);
      const angular = Math.PI * 2 * frequency * time + phaseOffset;
      const fundamental = Math.sin(angular);
      const second = Math.sin(angular * 2 + 0.17);
      const third = Math.sin(angular * 3 + 0.31);
      const color =
        voice === "pad"
          ? fundamental * 0.86 + second * 0.1 + third * 0.04
          : voice === "bass"
            ? fundamental * 0.9 + second * 0.1
            : fundamental * 0.75 + second * 0.18 + third * 0.07;
      const decay = voice === "pluck" ? Math.exp(-time * 3.2) : 1;
      samples[frame] += color * envelope * decay * gain;
    }
  }

  private midiToFrequency(midi: number): number {
    return 440 * 2 ** ((midi - 69) / 12);
  }

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

  private playRicochet(at: number): void {
    this.tone({
      at,
      duration: 0.085,
      frequency: 1860,
      endFrequency: 980,
      gain: 0.2,
      type: "square",
    });
    this.tone({
      at: at + 0.018,
      duration: 0.12,
      frequency: 2637,
      endFrequency: 1760,
      gain: 0.1,
      type: "triangle",
    });
    this.noise(at, 0.055, 0.075, 2400, "highpass");
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
    const output = this.effectsBus;
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
    const output = this.effectsBus;
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
