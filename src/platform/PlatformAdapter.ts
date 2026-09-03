import vkBridge from "@vkontakte/vk-bridge";

export const VK_APP_ID = 54_751_080;
export const VK_APP_URL = `https://vk.com/app${VK_APP_ID}`;
export const HIT_FEEDBACK_DURATION_MS = 25;
export const VK_CLOUD_PROGRESS_KEY = "thread_of_courage_progress_v1";
export const VK_CLOUD_CHUNK_SIZE = 3_000;
export const VK_CLOUD_MAX_CHUNKS = 12;

const VK_TAPTIC_IMPACT_METHOD = "VKWebAppTapticImpactOccurred";

type VkBridgeMethod =
  | "VKWebAppInit"
  | "VKWebAppStorageGet"
  | "VKWebAppStorageSet"
  | "VKWebAppTapticImpactOccurred";

type VkBridgeParams =
  | { readonly style: "medium" }
  | { readonly keys: readonly string[] }
  | { readonly key: string; readonly value: string };

interface VkCloudChunkManifest {
  readonly format: "thread-chunks-v1";
  readonly count: number;
}

export type PlatformKind = "standalone" | "vk";

export interface PlatformLifecycleHandlers {
  readonly onPause: () => void;
  readonly onResume: () => void;
}

export interface VkLaunchContext {
  readonly appId: number;
  readonly platform: string | null;
  readonly userId: number | null;
  /**
   * Only reports that VK supplied a signature. Authentication must still be
   * verified on a trusted backend with the protected application key.
   */
  readonly hasLaunchSignature: boolean;
}

export interface PlatformAdapter {
  readonly kind: PlatformKind;
  readonly launchContext: VkLaunchContext | null;
  initialize(): Promise<boolean>;
  /** Provides one short tactile response for a confirmed successful hit. */
  hitFeedback(): void;
  /** Loads the latest serialized cross-device progress for this VK player. */
  loadCloudProgress(): Promise<string | null>;
  /** Stores serialized progress for this VK player. */
  saveCloudProgress(value: string): Promise<boolean>;
  subscribeLifecycle(handlers: PlatformLifecycleHandlers): () => void;
  destroy(): void;
}

export interface VkBridgeEvent {
  readonly detail?: {
    readonly type?: unknown;
    readonly data?: unknown;
  };
}

export type VkBridgeListener = (event: VkBridgeEvent) => void;

/** Narrow seam used by tests and compatible VK Bridge implementations. */
export interface VkBridgeLike {
  send(method: VkBridgeMethod, params?: VkBridgeParams): unknown;
  supportsAsync?(
    method: "VKWebAppTapticImpactOccurred",
  ): Promise<boolean>;
  subscribe(listener: VkBridgeListener): void;
  unsubscribe(listener: VkBridgeListener): void;
}

export interface PlatformWindow {
  readonly location: Pick<Location, "search">;
}

export interface PlatformDocument extends EventTarget {
  readonly visibilityState: DocumentVisibilityState;
}

export interface PlatformNavigator {
  vibrate?(pattern: number | number[]): boolean;
}

export interface PlatformAdapterOptions {
  readonly appId?: number;
  readonly window?: PlatformWindow;
  readonly document?: PlatformDocument;
  /** Browser vibration seam. Pass null to explicitly disable it. */
  readonly navigator?: PlatformNavigator | null;
  /** Test seam or a separately configured VK Bridge instance. */
  readonly bridge?: VkBridgeLike;
}

type SuspensionSource = "document" | "vk";

class BrowserPlatformAdapter implements PlatformAdapter {
  public readonly kind: PlatformKind;
  public readonly launchContext: VkLaunchContext | null;

  private readonly subscribers = new Set<PlatformLifecycleHandlers>();
  private readonly suspensionSources = new Set<SuspensionSource>();
  private readonly bridge: VkBridgeLike | null;
  private initPromise: Promise<boolean> | null = null;
  private tapticSupportPromise: Promise<boolean> | null = null;
  private listeningToBridge = false;
  private destroyed = false;

  public constructor(
    private readonly environmentDocument: PlatformDocument,
    private readonly environmentNavigator: PlatformNavigator | null,
    search: string,
    appId: number,
    suppliedBridge?: VkBridgeLike,
  ) {
    const activeBridge = suppliedBridge ?? (vkBridge as unknown as VkBridgeLike);
    const hasBridgeRuntime = suppliedBridge ? true : vkBridge.isEmbedded();
    const launchContext = detectVkLaunchContext(
      search,
      appId,
      hasBridgeRuntime,
    );

    this.kind = launchContext ? "vk" : "standalone";
    this.launchContext = launchContext;
    this.bridge = launchContext ? activeBridge : null;

    environmentDocument.addEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    this.setSuspended(
      "document",
      environmentDocument.visibilityState === "hidden",
    );
  }

  public initialize(): Promise<boolean> {
    if (this.destroyed || this.kind !== "vk" || !this.bridge) {
      return Promise.resolve(false);
    }
    if (this.initPromise) return this.initPromise;

    if (!this.listeningToBridge) {
      this.bridge.subscribe(this.handleBridgeEvent);
      this.listeningToBridge = true;
    }

    try {
      this.initPromise = Promise.resolve(
        this.bridge.send("VKWebAppInit"),
      ).then(
        () => !this.destroyed,
        () => false,
      );
    } catch {
      this.initPromise = Promise.resolve(false);
    }

    return this.initPromise;
  }

  public hitFeedback(): void {
    if (this.destroyed) return;

    if (this.kind === "vk") {
      void this.sendVkHitFeedback();
      return;
    }

    try {
      this.environmentNavigator?.vibrate?.call(
        this.environmentNavigator,
        HIT_FEEDBACK_DURATION_MS,
      );
    } catch {
      // Vibration is optional and must never interrupt gameplay.
    }
  }

  public async loadCloudProgress(): Promise<string | null> {
    if (!(await this.canUseVkStorage())) return null;

    try {
      const first = await this.readVkStorageValues([VK_CLOUD_PROGRESS_KEY]);
      const value = first.get(VK_CLOUD_PROGRESS_KEY) || null;
      const manifest = parseChunkManifest(value);
      if (!manifest) return value;

      const chunkKeys = Array.from(
        { length: manifest.count },
        (_, index) => getCloudChunkKey(index),
      );
      const chunks = await this.readVkStorageValues(chunkKeys);
      const ordered = chunkKeys.map((key) => chunks.get(key));
      return ordered.every((chunk): chunk is string => typeof chunk === "string")
        ? ordered.join("")
        : null;
    } catch {
      return null;
    }
  }

  public async saveCloudProgress(value: string): Promise<boolean> {
    if (!(await this.canUseVkStorage())) return false;

    try {
      const chunks = splitCloudValue(value);
      if (chunks.length > 1) {
        if (chunks.length > VK_CLOUD_MAX_CHUNKS) return false;
        for (const [index, chunk] of chunks.entries()) {
          const response = await Promise.resolve(
            this.bridge!.send("VKWebAppStorageSet", {
              key: getCloudChunkKey(index),
              value: chunk,
            }),
          );
          if (!isRecord(response) || response.result !== true) return false;
        }
        const manifest: VkCloudChunkManifest = {
          format: "thread-chunks-v1",
          count: chunks.length,
        };
        const response = await Promise.resolve(
          this.bridge!.send("VKWebAppStorageSet", {
            key: VK_CLOUD_PROGRESS_KEY,
            value: JSON.stringify(manifest),
          }),
        );
        return isRecord(response) && response.result === true;
      }

      const response = await Promise.resolve(
        this.bridge!.send("VKWebAppStorageSet", {
          key: VK_CLOUD_PROGRESS_KEY,
          value,
        }),
      );
      return isRecord(response) && response.result === true;
    } catch {
      return false;
    }
  }

  public subscribeLifecycle(handlers: PlatformLifecycleHandlers): () => void {
    if (this.destroyed) return () => undefined;

    this.subscribers.add(handlers);
    if (this.suspensionSources.size > 0) handlers.onPause();

    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.subscribers.delete(handlers);
    };
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.environmentDocument.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    if (this.listeningToBridge) {
      this.bridge?.unsubscribe(this.handleBridgeEvent);
      this.listeningToBridge = false;
    }
    this.subscribers.clear();
    this.suspensionSources.clear();
  }

  private readonly handleVisibilityChange = (): void => {
    this.setSuspended(
      "document",
      this.environmentDocument.visibilityState === "hidden",
    );
  };

  private readonly handleBridgeEvent = (event: VkBridgeEvent): void => {
    const type = event.detail?.type;
    if (type === "VKWebAppViewHide") {
      this.setSuspended("vk", true);
    } else if (type === "VKWebAppViewRestore") {
      this.setSuspended("vk", false);
    }
  };

  private async sendVkHitFeedback(): Promise<void> {
    try {
      const initialized = await this.initialize();
      if (!initialized || this.destroyed || !this.bridge) return;

      const supported = await this.getTapticSupport();
      if (!supported || this.destroyed) return;

      await Promise.resolve(
        this.bridge.send(VK_TAPTIC_IMPACT_METHOD, { style: "medium" }),
      );
    } catch {
      // Taptic feedback is a best-effort enhancement.
    }
  }

  private async canUseVkStorage(): Promise<boolean> {
    if (this.destroyed || this.kind !== "vk" || !this.bridge) return false;
    return this.initialize();
  }

  private async readVkStorageValues(keys: readonly string[]): Promise<Map<string, string>> {
    const response = await Promise.resolve(
      this.bridge!.send("VKWebAppStorageGet", { keys }),
    );
    const values = new Map<string, string>();
    if (!isRecord(response) || !Array.isArray(response.keys)) return values;
    for (const candidate of response.keys) {
      if (
        isRecord(candidate) &&
        typeof candidate.key === "string" &&
        typeof candidate.value === "string"
      ) {
        values.set(candidate.key, candidate.value);
      }
    }
    return values;
  }

  private getTapticSupport(): Promise<boolean> {
    if (this.tapticSupportPromise) return this.tapticSupportPromise;
    if (!this.bridge?.supportsAsync) return Promise.resolve(false);

    try {
      this.tapticSupportPromise = Promise.resolve(
        this.bridge.supportsAsync(VK_TAPTIC_IMPACT_METHOD),
      ).then(
        (supported) => supported === true,
        () => false,
      );
    } catch {
      this.tapticSupportPromise = Promise.resolve(false);
    }

    return this.tapticSupportPromise;
  }

  private setSuspended(source: SuspensionSource, suspended: boolean): void {
    if (this.destroyed) return;

    const wasSuspended = this.suspensionSources.size > 0;
    if (suspended) {
      this.suspensionSources.add(source);
    } else {
      this.suspensionSources.delete(source);
    }
    const isSuspended = this.suspensionSources.size > 0;
    if (wasSuspended === isSuspended) return;

    for (const handlers of [...this.subscribers]) {
      if (isSuspended) handlers.onPause();
      else handlers.onResume();
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCloudChunkKey(index: number): string {
  return `${VK_CLOUD_PROGRESS_KEY}_${index}`;
}

function splitCloudValue(value: string): string[] {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let chunk = "";
  let byteLength = 0;
  for (const character of value) {
    const characterBytes = encoder.encode(character).length;
    if (byteLength + characterBytes > VK_CLOUD_CHUNK_SIZE && chunk) {
      chunks.push(chunk);
      chunk = "";
      byteLength = 0;
    }
    chunk += character;
    byteLength += characterBytes;
  }
  chunks.push(chunk);
  return chunks;
}

function parseChunkManifest(value: string | null): VkCloudChunkManifest | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !isRecord(parsed) ||
      parsed.format !== "thread-chunks-v1" ||
      !Number.isInteger(parsed.count) ||
      Number(parsed.count) < 1 ||
      Number(parsed.count) > VK_CLOUD_MAX_CHUNKS
    ) {
      return null;
    }
    return { format: "thread-chunks-v1", count: Number(parsed.count) };
  } catch {
    return null;
  }
}

export function detectVkLaunchContext(
  search: string,
  expectedAppId = VK_APP_ID,
  hasBridgeRuntime = true,
): VkLaunchContext | null {
  if (!hasBridgeRuntime) return null;

  const params = new URLSearchParams(search);
  const appId = Number(params.get("vk_app_id"));
  const platform = params.get("vk_platform")?.trim() ?? "";
  const sign = params.get("sign")?.trim() ?? "";
  if (!Number.isInteger(appId) || appId !== expectedAppId) {
    return null;
  }

  const parsedUserId = Number(params.get("vk_user_id"));
  return {
    appId,
    platform: platform || null,
    userId:
      Number.isSafeInteger(parsedUserId) && parsedUserId > 0
        ? parsedUserId
        : null,
    hasLaunchSignature: sign.length > 0,
  };
}

export function createPlatformAdapter(
  options: PlatformAdapterOptions = {},
): PlatformAdapter {
  const environmentWindow = options.window ?? window;
  const environmentDocument = options.document ?? document;
  const environmentNavigator =
    options.navigator === undefined
      ? typeof navigator === "undefined"
        ? null
        : navigator
      : options.navigator;

  return new BrowserPlatformAdapter(
    environmentDocument,
    environmentNavigator,
    environmentWindow.location.search,
    options.appId ?? VK_APP_ID,
    options.bridge,
  );
}
