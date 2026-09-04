export type StoryIntroMode = "first-run" | "replay";
export type StoryIntroResult = "completed" | "skipped" | "closed";

export interface StoryIntroCallbacks {
  /** Reports whether the cinematic owns foreground playback, not pause state. */
  readonly onPlaybackChange?: (active: boolean) => void;
  /** Reports mute changes made with the cinematic's own button. */
  readonly onMutedChange?: (muted: boolean) => void;
}

export interface StoryIntroPlayOptions {
  readonly mode: StoryIntroMode;
  readonly muted: boolean;
}

export interface StoryIntroChapter {
  readonly id: string;
  readonly cue: number;
  readonly title: string;
  readonly subtitle: string;
  readonly artFileName: string;
  readonly artAlt: string;
}

export interface StoryIntroChapterResolution {
  readonly index: number;
  readonly chapter: StoryIntroChapter;
  readonly start: number;
  readonly end: number;
  readonly progress: number;
}

export const STORY_INTRO_DURATION_SECONDS = 59.851;

// Starts measured against the supplied narration WAV. Its recording ends
// after Elya enters the Workshop, so the unvoiced final card opens at EOF.
export const STORY_INTRO_CHAPTER_CUES = [
  0,
  15.52,
  25.52,
  41.32,
  49.6,
  STORY_INTRO_DURATION_SECONDS,
] as const;

export const STORY_INTRO_CHAPTERS: readonly StoryIntroChapter[] = [
  {
    id: "threads-of-memory",
    cue: STORY_INTRO_CHAPTER_CUES[0],
    title: "Нити памяти",
    subtitle:
      "Когда-то каждая вещь хранила частицу своего создателя. Тёплые воспоминания вплетались в ткань, добрые слова становились узорами, а смелые поступки превращались в золотые нити. Все эти нити сходились в старой Мастерской — месте, где хранилось Сердце Великого Узора.",
    artFileName: "prologue-01-threads-of-memory.webp",
    artAlt: "Старая Мастерская и сияющие нити памяти, сходящиеся к Сердцу Великого Узора",
  },
  {
    id: "the-break",
    cue: STORY_INTRO_CHAPTER_CUES[1],
    title: "Ночь Разрыва",
    subtitle:
      "Но однажды ночью что-то пошло не так. Главная нить оборвалась. По залам прокатился Разрыв, и забытые обиды, страхи и незаконченные узоры обрели собственную жизнь.",
    artFileName: "prologue-02-the-break.webp",
    artAlt: "Главная нить рвётся, а по залам Мастерской расходится тёмная волна Разрыва",
  },
  {
    id: "nightmares-awake",
    cue: STORY_INTRO_CHAPTER_CUES[2],
    title: "Ожившие кошмары",
    subtitle:
      "Клубки превратились в прожорливых чудовищ. Пуговицы обзавелись глазами. Старые куклы сорвались со своих нитей. А ножницы начали охотиться на тех, кто когда-то держал их в руках. Чудовища захватили Мастерскую и унесли обрывки Великого Узора в самые тёмные её уголки.",
    artFileName: "prologue-03-nightmares-awake.webp",
    artAlt: "Ожившие клубки, пуговицы, куклы и ножницы захватывают Мастерскую",
  },
  {
    id: "last-thread",
    cue: STORY_INTRO_CHAPTER_CUES[3],
    title: "Последняя нить",
    subtitle:
      "Без него ткань мира начала расползаться. Но среди оборванных нитей осталась одна, которую Разрыв не смог уничтожить. Нить храбрости.",
    artFileName: "prologue-04-last-thread.webp",
    artAlt: "Единственная золотая нить светится среди разрушенной и погружённой во тьму Мастерской",
  },
  {
    id: "elya-chosen",
    cue: STORY_INTRO_CHAPTER_CUES[4],
    title: "Выбор Эли",
    subtitle:
      "Она выбрала Элю — юную собирательницу узоров, способную услышать тихий голос старых вещей. Взяв последнюю живую иглу, Эля отправилась в глубины Мастерской. Теперь ей предстоит пройти через забытые залы, победить созданий Разрыва и вернуть похищенные части Великого Узора. Каждое точное попадание станет новым стежком.",
    artFileName: "prologue-05-elya-chosen.webp",
    artAlt: "Нить храбрости выбирает Элю, которая берёт живую иглу и отправляется в путь",
  },
  {
    id: "first-stitch",
    cue: STORY_INTRO_CHAPTER_CUES[5],
    title: "Первый стежок",
    subtitle:
      "Каждая победа поможет зашить ещё одну рану этого мира. И, возможно, когда последний обрывок вернётся на своё место, Мастерская снова наполнится светом. Возьми иглу. Натяни нить. И помни… Даже самый большой разрыв можно исправить, если не бояться сделать первый стежок.",
    artFileName: "prologue-06-first-stitch-crossbow-v2.webp",
    artAlt:
      "Эля целится из швейного арбалета светящейся иглой и готовится сделать первый стежок",
  },
] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeTime(timeSeconds: number): number {
  return clamp(
    Number.isFinite(timeSeconds) ? timeSeconds : 0,
    0,
    STORY_INTRO_DURATION_SECONDS,
  );
}

export interface StoryTimelineFrame {
  readonly currentTime: number;
  readonly elapsedSeconds: number;
  readonly canAdvance: boolean;
  readonly audioUsable: boolean;
  readonly audioPaused: boolean;
  readonly audioCurrentTime: number;
  readonly fallbackClockActive: boolean;
}

export function resolveStoryTimelineTime(frame: StoryTimelineFrame): number {
  if (!frame.canAdvance) return normalizeTime(frame.currentTime);
  if (
    frame.audioUsable &&
    !frame.audioPaused &&
    Number.isFinite(frame.audioCurrentTime)
  ) {
    return normalizeTime(frame.audioCurrentTime);
  }
  if (frame.fallbackClockActive) {
    return normalizeTime(frame.currentTime + Math.max(0, frame.elapsedSeconds));
  }
  return normalizeTime(frame.currentTime);
}

export function resolveStoryIntroChapterIndex(timeSeconds: number): number {
  const time = normalizeTime(timeSeconds);
  for (let index = STORY_INTRO_CHAPTER_CUES.length - 1; index > 0; index -= 1) {
    if (time >= STORY_INTRO_CHAPTER_CUES[index]) return index;
  }
  return 0;
}

export function resolveStoryIntroChapter(
  timeSeconds: number,
): StoryIntroChapterResolution {
  const time = normalizeTime(timeSeconds);
  const index = resolveStoryIntroChapterIndex(time);
  const chapter = STORY_INTRO_CHAPTERS[index];
  const start = chapter.cue;
  const end =
    STORY_INTRO_CHAPTER_CUES[index + 1] ?? STORY_INTRO_DURATION_SECONDS;
  return {
    index,
    chapter,
    start,
    end,
    progress: end <= start ? 1 : clamp((time - start) / (end - start), 0, 1),
  };
}

function assetUrl(folder: "art/prologue" | "audio", fileName: string): string {
  return new URL(
    `${import.meta.env.BASE_URL}assets/${folder}/${fileName}`,
    document.baseURI,
  ).href;
}

function formatTime(timeSeconds: number): string {
  const seconds = Math.max(0, Math.floor(timeSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function createButton(className: string, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  return button;
}

export class StoryIntro {
  private readonly audio: HTMLAudioElement;
  private overlay: HTMLDivElement | null = null;
  private dialog: HTMLElement | null = null;
  private visual: HTMLElement | null = null;
  private backdropImages: HTMLImageElement[] = [];
  private artImages: HTMLImageElement[] = [];
  private titleElement: HTMLElement | null = null;
  private subtitleElement: HTMLElement | null = null;
  private counterElement: HTMLElement | null = null;
  private timeElement: HTMLElement | null = null;
  private progressFill: HTMLElement | null = null;
  private pauseButton: HTMLButtonElement | null = null;
  private muteButton: HTMLButtonElement | null = null;
  private finishButton: HTMLButtonElement | null = null;
  private dotButtons: HTMLButtonElement[] = [];
  private preloadedImages: HTMLImageElement[] = [];
  private mode: StoryIntroMode = "first-run";
  private muted = false;
  private userPaused = false;
  private platformPaused = false;
  private visibilityPaused = false;
  private ended = false;
  private audioUsable = false;
  private audioNeedsGesture = false;
  private currentTime = 0;
  private renderedChapter = -1;
  private lastFrameTime = 0;
  private animationFrame: number | null = null;
  private playbackAttempt = 0;
  private fallbackClockActive = false;
  private activeVisualLayer = 0;
  private visualTransitionTimer: number | null = null;
  private resultResolver: ((result: StoryIntroResult) => void) | null = null;
  private previousFocus: HTMLElement | null = null;
  private destroyed = false;

  public constructor(
    private readonly host: HTMLElement,
    private readonly callbacks: StoryIntroCallbacks = {},
  ) {
    this.audio = document.createElement("audio");
    this.audio.className = "story-intro-audio";
    this.audio.preload = "auto";
    this.audio.src = assetUrl("audio", "prologue-narration.wav");
    this.audio.setAttribute("playsinline", "");
    this.audio.setAttribute("aria-hidden", "true");
    this.audio.addEventListener("ended", this.handleAudioEnded);
    this.audio.addEventListener("error", this.handleAudioError);
    this.audio.load();
  }

  public play(options: StoryIntroPlayOptions): Promise<StoryIntroResult> {
    if (this.destroyed) return Promise.resolve("closed");
    if (this.resultResolver) this.finish("closed");

    const result = new Promise<StoryIntroResult>((resolve) => {
      this.resultResolver = resolve;
    });

    this.mode = options.mode;
    this.muted = options.muted;
    this.userPaused = false;
    this.visibilityPaused = document.visibilityState === "hidden";
    this.ended = false;
    this.audioUsable = false;
    this.audioNeedsGesture = false;
    this.fallbackClockActive = this.muted;
    this.currentTime = 0;
    this.renderedChapter = -1;
    this.activeVisualLayer = 0;
    this.lastFrameTime = performance.now();
    this.playbackAttempt += 1;
    this.previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    this.resetAudio();
    this.preloadArtwork();
    this.buildOverlay();
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.notifyPlaybackChange(true);
    this.updatePresentation(true);
    this.dialog?.focus({ preventScroll: true });
    this.startMediaOrFallback();

    return result;
  }

  public setMuted(muted: boolean): void {
    if (this.destroyed || this.muted === muted) return;
    this.snapshotTimeline();
    this.muted = muted;
    this.audio.muted = muted;
    this.audioUsable = false;
    this.playbackAttempt += 1;
    this.audio.pause();
    this.updateControls();
    this.startMediaOrFallback();
  }

  public pauseForPlatform(): void {
    if (this.destroyed || this.platformPaused) return;
    this.snapshotTimeline();
    this.platformPaused = true;
    this.playbackAttempt += 1;
    this.audioUsable = false;
    this.audio.pause();
    this.updateControls();
  }

  public resumeForPlatform(): void {
    if (this.destroyed || !this.platformPaused) return;
    this.platformPaused = false;
    this.lastFrameTime = performance.now();
    this.updateControls();
    this.startMediaOrFallback();
  }

  public destroy(): void {
    if (this.destroyed) return;
    if (this.resultResolver) this.finish("closed");
    this.destroyed = true;
    this.cancelAnimationFrame();
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.audio.removeEventListener("ended", this.handleAudioEnded);
    this.audio.removeEventListener("error", this.handleAudioError);
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.clearVisualTransitionTimer();
    this.overlay?.remove();
    this.overlay = null;
    this.preloadedImages.splice(0);
  }

  private buildOverlay(): void {
    const layer = document.createElement("div");
    layer.className = "story-intro-layer";
    layer.dataset.mode = this.mode;

    const scrim = document.createElement("div");
    scrim.className = "story-intro-scrim";
    scrim.setAttribute("aria-hidden", "true");
    layer.append(scrim);

    const dialog = document.createElement("section");
    dialog.className = "story-intro-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "story-intro-title");
    dialog.setAttribute("aria-describedby", "story-intro-subtitle");
    dialog.setAttribute("aria-live", "off");
    dialog.tabIndex = -1;

    const visual = document.createElement("figure");
    visual.className = "story-intro-visual";
    visual.setAttribute("role", "img");
    const backdrops = [0, 1].map(() => {
      const backdrop = document.createElement("img");
      backdrop.className = "story-intro-backdrop";
      backdrop.alt = "";
      backdrop.setAttribute("aria-hidden", "true");
      backdrop.draggable = false;
      return backdrop;
    });
    const arts = [0, 1].map(() => {
      const art = document.createElement("img");
      art.className = "story-intro-art";
      art.alt = "";
      art.setAttribute("aria-hidden", "true");
      art.draggable = false;
      return art;
    });
    visual.append(...backdrops, ...arts);

    const shade = document.createElement("div");
    shade.className = "story-intro-shade";
    shade.setAttribute("aria-hidden", "true");

    const header = document.createElement("header");
    header.className = "story-intro-header";
    const brand = document.createElement("span");
    brand.className = "story-intro-brand";
    brand.textContent = "НИТКА ХРАБРОСТИ";
    const controls = document.createElement("div");
    controls.className = "story-intro-controls";
    const muteButton = createButton("story-intro-mute", "");
    muteButton.dataset.action = "mute";
    const pauseButton = createButton("story-intro-pause", "");
    pauseButton.dataset.action = "pause";
    const exitButton = createButton(
      "story-intro-exit",
      this.mode === "first-run" ? "ПРОПУСТИТЬ" : "ЗАКРЫТЬ",
    );
    exitButton.dataset.action = "exit";
    exitButton.setAttribute(
      "aria-label",
      this.mode === "first-run"
        ? "Пропустить вступление и начать рейд"
        : "Закрыть повторный просмотр истории",
    );
    controls.append(muteButton, pauseButton, exitButton);
    header.append(brand, controls);

    const copy = document.createElement("article");
    copy.className = "story-intro-copy";
    const counter = document.createElement("span");
    counter.className = "story-intro-counter";
    counter.setAttribute("aria-live", "polite");
    counter.setAttribute("aria-atomic", "true");
    const title = document.createElement("h2");
    title.id = "story-intro-title";
    title.className = "story-intro-title";
    const subtitle = document.createElement("p");
    subtitle.id = "story-intro-subtitle";
    subtitle.className = "story-intro-subtitle";
    copy.append(counter, title, subtitle);

    const timeline = document.createElement("footer");
    timeline.className = "story-intro-timeline";
    const dots = document.createElement("nav");
    dots.className = "story-intro-dots";
    dots.setAttribute("aria-label", "Сцены вступления");
    this.dotButtons = STORY_INTRO_CHAPTERS.map((chapter, index) => {
      const dot = createButton("story-intro-dot", "");
      dot.dataset.action = "chapter";
      dot.dataset.chapter = String(index);
      dot.setAttribute(
        "aria-label",
        `${chapter.title}, сцена ${index + 1} из ${STORY_INTRO_CHAPTERS.length}`,
      );
      const marker = document.createElement("span");
      marker.className = "story-intro-dot-marker";
      marker.setAttribute("aria-hidden", "true");
      dot.append(marker);
      dots.append(dot);
      return dot;
    });
    const progress = document.createElement("div");
    progress.className = "story-intro-progress";
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", "Ход вступления");
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    const fill = document.createElement("span");
    fill.className = "story-intro-progress-fill";
    progress.append(fill);
    const time = document.createElement("span");
    time.className = "story-intro-time";
    const finishButton = createButton(
      "story-intro-finish",
      this.mode === "first-run" ? "НАЧАТЬ РЕЙД" : "ВЕРНУТЬСЯ В МАСТЕРСКУЮ",
    );
    finishButton.dataset.action = "finish";
    finishButton.hidden = true;
    timeline.append(dots, progress, time, finishButton);

    dialog.append(visual, shade, header, copy, timeline);
    layer.append(dialog);
    layer.addEventListener("click", this.handleClick);
    layer.addEventListener("keydown", this.handleKeyDown);
    this.host.append(layer);

    this.overlay = layer;
    this.dialog = dialog;
    this.visual = visual;
    this.backdropImages = backdrops;
    this.artImages = arts;
    this.titleElement = title;
    this.subtitleElement = subtitle;
    this.counterElement = counter;
    this.timeElement = time;
    this.progressFill = fill;
    this.pauseButton = pauseButton;
    this.muteButton = muteButton;
    this.finishButton = finishButton;
  }

  private preloadArtwork(): void {
    this.preloadedImages = STORY_INTRO_CHAPTERS.map((chapter) => {
      const image = new Image();
      image.src = assetUrl("art/prologue", chapter.artFileName);
      return image;
    });
  }

  private resetAudio(): void {
    this.audio.pause();
    this.audio.muted = this.muted;
    this.seekAudio(0);
  }

  private startMediaOrFallback(): void {
    if (!this.resultResolver && !this.overlay) return;
    this.lastFrameTime = performance.now();
    this.scheduleAnimationFrame();
    if (!this.canAdvance()) {
      this.audioUsable = false;
      this.audio.pause();
      return;
    }
    if (this.muted) {
      this.audioUsable = false;
      this.fallbackClockActive = true;
      this.audioNeedsGesture = false;
      this.audio.pause();
      this.updateControls();
      return;
    }

    // Wait for the narration to actually start before advancing the slides.
    // This keeps slow network/media startup from putting the voice behind.
    this.fallbackClockActive = false;
    this.audioNeedsGesture = false;
    this.updateControls();
    const attempt = ++this.playbackAttempt;
    this.seekAudio(this.currentTime);
    let playback: Promise<void>;
    try {
      playback = this.audio.play();
    } catch {
      this.audioUsable = false;
      this.fallbackClockActive = false;
      this.audioNeedsGesture = true;
      this.lastFrameTime = performance.now();
      this.updateControls();
      return;
    }
    void playback.then(() => {
      // A superseded play() promise shares the same HTMLAudioElement with the
      // new chapter. It must not pause the newer attempt when it settles.
      if (attempt !== this.playbackAttempt) return;
      if (!this.overlay || !this.canAdvance() || this.muted) {
        this.audio.pause();
        return;
      }
      this.seekAudio(this.currentTime);
      this.audioUsable = true;
      this.fallbackClockActive = false;
      this.audioNeedsGesture = false;
      this.lastFrameTime = performance.now();
      this.updateControls();
    }).catch(() => {
      if (attempt === this.playbackAttempt) {
        this.audioUsable = false;
        this.fallbackClockActive = false;
        this.audioNeedsGesture = true;
        this.lastFrameTime = performance.now();
        this.updateControls();
      }
    });
  }

  private canAdvance(): boolean {
    return Boolean(
      this.overlay &&
      !this.userPaused &&
      !this.platformPaused &&
      !this.visibilityPaused &&
      !this.ended,
    );
  }

  private snapshotTimeline(now = performance.now()): void {
    if (!this.overlay) return;
    const elapsed = Math.max(0, now - this.lastFrameTime) / 1000;
    // The recorded narration is the master clock: every slide cue is a
    // timestamp in this exact WAV, so buffering pauses picture and voice
    // together instead of letting them drift apart. Only mute or a terminal
    // media error enables the visual-only clock.
    this.currentTime = resolveStoryTimelineTime({
      currentTime: this.currentTime,
      elapsedSeconds: elapsed,
      canAdvance: this.canAdvance(),
      audioUsable: this.audioUsable,
      audioPaused: this.audio.paused,
      audioCurrentTime: this.audio.currentTime,
      fallbackClockActive: this.fallbackClockActive,
    });
    this.lastFrameTime = now;
    if (this.currentTime >= STORY_INTRO_DURATION_SECONDS) this.reachEnd();
  }

  private readonly tick = (now: number): void => {
    this.animationFrame = null;
    if (!this.overlay) return;
    this.snapshotTimeline(now);
    this.updatePresentation();
    this.scheduleAnimationFrame();
  };

  private scheduleAnimationFrame(): void {
    if (this.animationFrame !== null || !this.overlay) return;
    this.animationFrame = window.requestAnimationFrame(this.tick);
  }

  private cancelAnimationFrame(): void {
    if (this.animationFrame === null) return;
    window.cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  private updatePresentation(force = false): void {
    const resolution = resolveStoryIntroChapter(this.currentTime);
    const chapterChanged = resolution.index !== this.renderedChapter;
    if (force || chapterChanged) {
      const animateSlide = this.renderedChapter >= 0 && chapterChanged;
      this.renderedChapter = resolution.index;
      const imageUrl = assetUrl("art/prologue", resolution.chapter.artFileName);
      this.showArtworkSlide(imageUrl, animateSlide);
      this.visual?.setAttribute("aria-label", resolution.chapter.artAlt);
      if (this.visual) this.visual.dataset.chapter = resolution.chapter.id;
      if (this.titleElement) this.titleElement.textContent = resolution.chapter.title;
      if (this.subtitleElement) {
        this.subtitleElement.textContent = resolution.chapter.subtitle;
      }
      if (this.counterElement) {
        this.counterElement.textContent = `СЦЕНА ${resolution.index + 1} ИЗ ${STORY_INTRO_CHAPTERS.length}`;
      }
    }

    const totalProgress = clamp(
      this.currentTime / STORY_INTRO_DURATION_SECONDS,
      0,
      1,
    );
    if (this.progressFill) this.progressFill.style.width = `${totalProgress * 100}%`;
    const progress = this.progressFill?.parentElement;
    progress?.setAttribute("aria-valuenow", String(Math.round(totalProgress * 100)));
    if (this.timeElement) {
      this.timeElement.textContent = `${formatTime(this.currentTime)} / ${formatTime(STORY_INTRO_DURATION_SECONDS)}`;
    }
    this.dotButtons.forEach((button, index) => {
      const active = index === resolution.index;
      button.classList.toggle("story-intro-dot-active", active);
      if (active) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    if (this.finishButton) this.finishButton.hidden = !this.ended;
    this.overlay?.classList.toggle("story-intro-ended", this.ended);
    this.updateControls();
  }

  private showArtworkSlide(imageUrl: string, animate: boolean): void {
    if (this.artImages.length < 2 || this.backdropImages.length < 2) return;
    this.clearVisualTransitionTimer();

    const previousLayer = this.activeVisualLayer;
    const nextLayer = animate ? 1 - previousLayer : previousLayer;
    this.artImages.forEach((image, index) => {
      image.classList.remove("story-intro-art-enter", "story-intro-art-leave");
      image.classList.toggle("story-intro-art-active", index === previousLayer);
    });
    this.backdropImages.forEach((image, index) => {
      image.classList.toggle("story-intro-backdrop-active", index === previousLayer);
    });

    const nextArt = this.artImages[nextLayer];
    const nextBackdrop = this.backdropImages[nextLayer];
    nextArt.src = imageUrl;
    nextBackdrop.src = imageUrl;

    if (!animate) {
      nextArt.classList.add("story-intro-art-active");
      nextBackdrop.classList.add("story-intro-backdrop-active");
      this.activeVisualLayer = nextLayer;
      return;
    }

    const previousArt = this.artImages[previousLayer];
    const previousBackdrop = this.backdropImages[previousLayer];
    nextArt.classList.add("story-intro-art-active");
    nextBackdrop.classList.add("story-intro-backdrop-active");
    void nextArt.offsetWidth;
    previousArt.classList.add("story-intro-art-leave");
    previousBackdrop.classList.remove("story-intro-backdrop-active");
    nextArt.classList.add("story-intro-art-enter");
    this.activeVisualLayer = nextLayer;

    this.visualTransitionTimer = window.setTimeout(() => {
      previousArt.classList.remove("story-intro-art-active", "story-intro-art-leave");
      nextArt.classList.remove("story-intro-art-enter");
      this.visualTransitionTimer = null;
    }, 220);
  }

  private clearVisualTransitionTimer(): void {
    if (this.visualTransitionTimer === null) return;
    window.clearTimeout(this.visualTransitionTimer);
    this.visualTransitionTimer = null;
  }

  private updateControls(): void {
    const paused = this.userPaused || this.platformPaused || this.visibilityPaused;
    if (this.pauseButton) {
      this.pauseButton.textContent = this.userPaused ? "▶" : "Ⅱ";
      this.pauseButton.setAttribute("aria-pressed", String(this.userPaused));
      this.pauseButton.setAttribute(
        "aria-label",
        this.userPaused ? "Продолжить вступление" : "Поставить вступление на паузу",
      );
      this.pauseButton.disabled = this.ended || (paused && !this.userPaused);
    }
    if (this.muteButton) {
      this.muteButton.textContent = this.muted ? "🔇" : "♪";
      this.muteButton.setAttribute("aria-pressed", String(this.muted));
      this.muteButton.setAttribute(
        "aria-label",
        this.muted ? "Включить озвучку" : "Выключить озвучку",
      );
    }
    this.overlay?.classList.toggle(
      "story-intro-audio-blocked",
      this.audioNeedsGesture && !this.muted,
    );
  }

  private togglePause(): void {
    if (!this.overlay || this.ended || this.platformPaused || this.visibilityPaused) return;
    this.snapshotTimeline();
    this.userPaused = !this.userPaused;
    this.playbackAttempt += 1;
    this.audioUsable = false;
    this.audio.pause();
    this.updateControls();
    this.startMediaOrFallback();
  }

  private seekToChapter(index: number): void {
    if (!this.overlay) return;
    const safeIndex = clamp(Math.floor(index), 0, STORY_INTRO_CHAPTERS.length - 1);
    this.seekTo(STORY_INTRO_CHAPTER_CUES[safeIndex]);
  }

  private seekTo(timeSeconds: number): void {
    const targetTime = normalizeTime(timeSeconds);

    // Invalidate the currently playing attempt before changing currentTime.
    // Some mobile browsers expose the old audio position until their async
    // seek completes; an animation frame could otherwise copy that stale
    // position back into the story clock and resume the previous chapter.
    this.playbackAttempt += 1;
    this.audioUsable = false;
    this.audio.pause();
    this.currentTime = targetTime;
    this.ended = this.currentTime >= STORY_INTRO_DURATION_SECONDS;
    this.lastFrameTime = performance.now();
    this.seekAudio(targetTime);
    this.updatePresentation(true);
    if (this.ended) {
      this.fallbackClockActive = false;
    } else if (this.canAdvance()) {
      this.startMediaOrFallback();
    }
  }

  private seekAudio(timeSeconds: number): void {
    try {
      this.audio.currentTime = normalizeTime(timeSeconds);
    } catch {
      // Metadata may not be ready yet; the fallback clock remains authoritative.
    }
  }

  private reachEnd(): void {
    if (this.ended) return;
    this.ended = true;
    this.currentTime = STORY_INTRO_DURATION_SECONDS;
    this.playbackAttempt += 1;
    this.audioUsable = false;
    this.audio.pause();
    this.updatePresentation(true);
    this.finishButton?.focus({ preventScroll: true });
  }

  private readonly handleAudioEnded = (): void => {
    if (!this.overlay) return;
    this.reachEnd();
  };

  private readonly handleAudioError = (): void => {
    this.playbackAttempt += 1;
    this.audioUsable = false;
    this.fallbackClockActive = true;
    this.audioNeedsGesture = false;
    this.audio.pause();
    this.lastFrameTime = performance.now();
    this.updateControls();
    this.scheduleAnimationFrame();
  };

  private readonly handleVisibilityChange = (): void => {
    if (!this.overlay) return;
    if (document.visibilityState === "hidden") {
      this.snapshotTimeline();
      this.visibilityPaused = true;
      this.playbackAttempt += 1;
      this.audioUsable = false;
      this.audio.pause();
      this.updateControls();
      return;
    }
    this.visibilityPaused = false;
    this.lastFrameTime = performance.now();
    this.updateControls();
    this.startMediaOrFallback();
  };

  private readonly handleClick = (event: MouseEvent): void => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("button[data-action]")
        : null;
    if (!button) {
      // Safari can revoke media playback after the app returns from the
      // background. A tap on the cinematic is a fresh user gesture, so use it
      // to restore narration while the visual fallback keeps its place.
      if (!this.muted && !this.audioUsable && this.canAdvance()) {
        this.startMediaOrFallback();
      }
      return;
    }
    if (button.disabled) return;
    switch (button.dataset.action) {
      case "exit":
        this.finish(this.mode === "first-run" ? "skipped" : "closed");
        break;
      case "pause":
        this.togglePause();
        break;
      case "mute":
        this.setMuted(!this.muted);
        this.notifyMutedChange(this.muted);
        break;
      case "chapter":
        this.seekToChapter(Number(button.dataset.chapter));
        break;
      case "finish":
        if (this.ended) this.finish("completed");
        break;
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.overlay) return;
    if (event.key === "Escape") {
      event.preventDefault();
      this.finish(this.mode === "first-run" ? "skipped" : "closed");
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const index = resolveStoryIntroChapterIndex(this.currentTime);
      if (event.key === "ArrowLeft") this.seekToChapter(index - 1);
      else if (index < STORY_INTRO_CHAPTERS.length - 1) this.seekToChapter(index + 1);
      else this.seekTo(STORY_INTRO_DURATION_SECONDS);
      return;
    }
    if (
      (event.key === " " || event.code === "Space") &&
      !(event.target instanceof HTMLButtonElement)
    ) {
      event.preventDefault();
      this.togglePause();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      this.dialog?.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([hidden]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => !element.hasAttribute("hidden"));
    if (focusable.length === 0) {
      event.preventDefault();
      this.dialog?.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !this.dialog?.contains(active))) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && (active === last || !this.dialog?.contains(active))) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  private finish(result: StoryIntroResult): void {
    const resolve = this.resultResolver;
    if (!resolve) return;
    this.resultResolver = null;
    this.snapshotTimeline();
    this.playbackAttempt += 1;
    this.audioUsable = false;
    this.audio.pause();
    this.seekAudio(0);
    this.cancelAnimationFrame();
    this.clearVisualTransitionTimer();
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.overlay?.removeEventListener("click", this.handleClick);
    this.overlay?.removeEventListener("keydown", this.handleKeyDown);
    this.overlay?.remove();
    this.overlay = null;
    this.dialog = null;
    this.visual = null;
    this.backdropImages = [];
    this.artImages = [];
    this.titleElement = null;
    this.subtitleElement = null;
    this.counterElement = null;
    this.timeElement = null;
    this.progressFill = null;
    this.pauseButton = null;
    this.muteButton = null;
    this.finishButton = null;
    this.dotButtons = [];
    this.preloadedImages.splice(0);
    this.notifyPlaybackChange(false);

    const previousFocus = this.previousFocus;
    this.previousFocus = null;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    resolve(result);
  }

  private notifyPlaybackChange(active: boolean): void {
    try {
      this.callbacks.onPlaybackChange?.(active);
    } catch {
      // Host integration must not prevent the cinematic from cleaning itself up.
    }
  }

  private notifyMutedChange(muted: boolean): void {
    try {
      this.callbacks.onMutedChange?.(muted);
    } catch {
      // Saving a preference must not interrupt the cinematic controls.
    }
  }
}

export default StoryIntro;
