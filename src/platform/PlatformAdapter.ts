import vkBridge from "@vkontakte/vk-bridge";

export const VK_APP_ID = 54_751_080;
export const VK_APP_URL = `https://vk.com/app${VK_APP_ID}`;
export const HIT_FEEDBACK_DURATION_MS = 25;
export const VK_CLOUD_PROGRESS_KEY = "thread_of_courage_progress_v1";
export const VK_CLOUD_CHUNK_SIZE = 3_000;
export const VK_CLOUD_MAX_CHUNKS = 12;

const VK_TAPTIC_IMPACT_METHOD = "VKWebAppTapticImpactOccurred";
const VK_CHECK_NATIVE_ADS_METHOD = "VKWebAppCheckNativeAds";
const VK_SHOW_NATIVE_ADS_METHOD = "VKWebAppShowNativeAds";
const VK_GET_AUTH_TOKEN_METHOD = "VKWebAppGetAuthToken";
const VK_CALL_API_METHOD = "VKWebAppCallAPIMethod";
const VK_GET_USER_INFO_METHOD = "VKWebAppGetUserInfo";

type VkBridgeMethod =
  | "VKWebAppInit"
  | "VKWebAppStorageGet"
  | "VKWebAppStorageSet"
  | "VKWebAppTapticImpactOccurred"
  | "VKWebAppCheckNativeAds"
  | "VKWebAppShowNativeAds"
  | "VKWebAppGetAuthToken"
  | "VKWebAppGetUserInfo"
  | "VKWebAppCallAPIMethod"
  | "VKWebAppShowLeaderBoardBox"
  | "VKWebAppShowOrderBox";

type VkBridgeParams =
  | { readonly style: "medium" }
  | { readonly keys: readonly string[] }
  | { readonly key: string; readonly value: string }
  | {
      readonly ad_format: "reward" | "interstitial";
      readonly use_waterfall?: boolean;
    }
  | { readonly app_id: number; readonly scope: string }
  | {
      readonly method: "apps.getLeaderboard";
      readonly params: {
        readonly type: "level";
        readonly global: 1;
        readonly extended: 1;
        readonly v: "5.199";
        readonly access_token: string;
      };
    }
  | { readonly user_result: number; readonly global: 1 }
  | { readonly type: "item"; readonly item: string };

interface VkCloudChunkManifest {
  readonly format: "thread-chunks-v1";
  readonly count: number;
}

export type PlatformKind = "standalone" | "vk";
export type RewardedAdResult =
  | "rewarded"
  | "unsupported"
  | "unavailable"
  | "cancelled"
  | "error";
export type InterstitialAdResult =
  | "shown"
  | "unsupported"
  | "unavailable"
  | "cancelled"
  | "error";
export type LeaderboardResult = "shown" | "unsupported" | "error";
export type VkLeaderboardLoadResult =
  | { readonly status: "ready"; readonly payload: unknown }
  | { readonly status: "unsupported" | "error" };
export interface OrderResult {
  readonly status: "success" | "cancel" | "fail" | "unsupported" | "error";
  readonly orderId?: string;
}

export interface PlatformUserProfile {
  readonly id: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly photoUrl: string | null;
}

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
  /** Voluntary video; only `rewarded` is permission to grant the ability. */
  showRewardedAd(): Promise<RewardedAdResult>;
  /** Best-effort between-attempt ad that never blocks continued play on failure. */
  showInterstitialAd(): Promise<InterstitialAdResult>;
  /** Opens the native VK leaderboard without storing or trusting the score. */
  showLeaderboard(userResult: number): Promise<LeaderboardResult>;
  /** Reads the VK level leaderboard; this never writes or submits a score. */
  loadLeaderboard(): Promise<VkLeaderboardLoadResult>;
  /** Reads the current player's public VK identity for local profile rendering. */
  getUserInfo(): Promise<PlatformUserProfile | null>;
  /** Opens a native order dialog; callers must verify purchases server-side. */
  showOrder(itemName: string): Promise<OrderResult>;
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
    method:
      | "VKWebAppTapticImpactOccurred"
      | "VKWebAppCheckNativeAds"
      | "VKWebAppShowNativeAds"
      | "VKWebAppGetAuthToken"
      | "VKWebAppGetUserInfo"
      | "VKWebAppCallAPIMethod"
      | "VKWebAppShowLeaderBoardBox"
      | "VKWebAppShowOrderBox",
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

type SuspensionSource = "document" | "vk" | "native-ad";

class BrowserPlatformAdapter implements PlatformAdapter {
  public readonly kind: PlatformKind;
  public readonly launchContext: VkLaunchContext | null;

  private readonly subscribers = new Set<PlatformLifecycleHandlers>();
  private readonly suspensionSources = new Set<SuspensionSource>();
  private readonly bridge: VkBridgeLike | null;
  private initPromise: Promise<boolean> | null = null;
  private tapticSupportPromise: Promise<boolean> | null = null;
  private nativeAdsSupportPromise: Promise<boolean> | null = null;
  private nativeAdInFlight = false;
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

  public async showRewardedAd(): Promise<RewardedAdResult> {
    const result = await this.showNativeAd("reward");
    return result === "shown" ? "rewarded" : result;
  }

  public showInterstitialAd(): Promise<InterstitialAdResult> {
    return this.showNativeAd("interstitial");
  }

  public async showLeaderboard(userResult: number): Promise<LeaderboardResult> {
    if (!(await this.canUseVkMethod("VKWebAppShowLeaderBoardBox"))) {
      return "unsupported";
    }
    const normalizedResult = Number.isFinite(userResult)
      ? Math.max(0, Math.floor(userResult))
      : 0;
    try {
      const response = await Promise.resolve(
        this.bridge!.send("VKWebAppShowLeaderBoardBox", {
          user_result: normalizedResult,
          global: 1,
        }),
      );
      return isRecord(response) && response.success === true ? "shown" : "error";
    } catch {
      return "error";
    }
  }

  public async loadLeaderboard(): Promise<VkLeaderboardLoadResult> {
    if (this.destroyed || this.kind !== "vk" || !this.bridge) {
      return { status: "unsupported" };
    }

    if (!(await this.initialize()) || this.destroyed) {
      return { status: "error" };
    }
    if (!(await this.canReadVkLeaderboard())) {
      return { status: "unsupported" };
    }

    try {
      const authResponse = await Promise.resolve(
        this.bridge.send(VK_GET_AUTH_TOKEN_METHOD, {
          app_id: this.launchContext?.appId ?? VK_APP_ID,
          scope: "",
        }),
      );
      const accessToken =
        isRecord(authResponse) && typeof authResponse.access_token === "string"
          ? authResponse.access_token.trim()
          : "";
      if (!accessToken) return { status: "error" };

      const apiResponse = await Promise.resolve(
        this.bridge.send(VK_CALL_API_METHOD, {
          method: "apps.getLeaderboard",
          params: {
            type: "level",
            global: 1,
            extended: 1,
            v: "5.199",
            access_token: accessToken,
          },
        }),
      );
      if (!isRecord(apiResponse) || !("response" in apiResponse)) {
        return { status: "error" };
      }
      return { status: "ready", payload: apiResponse.response };
    } catch (error) {
      return isUnsupportedBridgeFailure(error)
        ? { status: "unsupported" }
        : { status: "error" };
    }
  }

  public async getUserInfo(): Promise<PlatformUserProfile | null> {
    if (this.destroyed || this.kind !== "vk" || !this.bridge) return null;
    if (!(await this.initialize()) || this.destroyed) return null;

    if (this.bridge.supportsAsync) {
      try {
        if (!(await this.bridge.supportsAsync(VK_GET_USER_INFO_METHOD))) {
          return null;
        }
      } catch {
        return null;
      }
    }

    try {
      const response = await Promise.resolve(
        this.bridge.send(VK_GET_USER_INFO_METHOD),
      );
      if (this.destroyed || !isRecord(response)) return null;
      const id = Number(response.id);
      const firstName =
        typeof response.first_name === "string" ? response.first_name.trim() : "";
      const lastName =
        typeof response.last_name === "string" ? response.last_name.trim() : "";
      if (!Number.isSafeInteger(id) || id <= 0 || (!firstName && !lastName)) {
        return null;
      }
      const photoUrl =
        normalizeProfilePhotoUrl(response.photo_200) ??
        normalizeProfilePhotoUrl(response.photo_100);
      return { id, firstName, lastName, photoUrl };
    } catch {
      return null;
    }
  }

  public async showOrder(itemName: string): Promise<OrderResult> {
    const item = itemName.trim();
    if (!item) return { status: "fail" };
    if (!(await this.canUseVkMethod("VKWebAppShowOrderBox"))) {
      return { status: "unsupported" };
    }
    try {
      const response = await Promise.resolve(
        this.bridge!.send("VKWebAppShowOrderBox", { type: "item", item }),
      );
      if (!isRecord(response)) return { status: "error" };
      const bridgeStatus = response.status;
      const status =
        bridgeStatus === "success" ||
        bridgeStatus === "cancel" ||
        bridgeStatus === "fail"
          ? bridgeStatus
          : response.success === true
            ? "success"
            : null;
      if (!status) {
        return { status: "error" };
      }
      const orderId = normalizeOrderId(response.order_id);
      return orderId ? { status, orderId } : { status };
    } catch {
      return { status: "error" };
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

  private async showNativeAd(
    format: "reward" | "interstitial",
  ): Promise<InterstitialAdResult> {
    if (this.destroyed || this.kind !== "vk" || !this.bridge) {
      return "unsupported";
    }
    if (this.nativeAdInFlight) return "unavailable";
    this.nativeAdInFlight = true;
    let nativeViewOpened = false;

    try {
      if (!(await this.initialize()) || this.destroyed) return "unsupported";
      if (!(await this.getNativeAdsSupport()) || this.destroyed) {
        return "unsupported";
      }

      // Reward fallback can silently substitute an interstitial, so it is
      // explicitly disabled: only an actual rewarded placement may grant use.
      const params =
        format === "reward"
          ? ({ ad_format: format, use_waterfall: false } as const)
          : ({ ad_format: format } as const);
      const availability = await Promise.resolve(
        this.bridge.send(VK_CHECK_NATIVE_ADS_METHOD, params),
      );
      if (!isRecord(availability)) return "error";
      if (availability.result !== true) return "unavailable";

      nativeViewOpened = true;
      this.setSuspended("native-ad", true);
      const shown = await Promise.resolve(
        this.bridge.send(VK_SHOW_NATIVE_ADS_METHOD, params),
      );
      if (!isRecord(shown)) return "error";
      return shown.result === true ? "shown" : "cancelled";
    } catch (error) {
      return classifyNativeAdFailure(error);
    } finally {
      if (nativeViewOpened) this.setSuspended("native-ad", false);
      this.nativeAdInFlight = false;
    }
  }

  private async canUseVkStorage(): Promise<boolean> {
    if (this.destroyed || this.kind !== "vk" || !this.bridge) return false;
    return this.initialize();
  }

  private async canUseVkMethod(
    method: "VKWebAppShowLeaderBoardBox" | "VKWebAppShowOrderBox",
  ): Promise<boolean> {
    if (this.destroyed || this.kind !== "vk" || !this.bridge) return false;
    if (!(await this.initialize()) || !this.bridge.supportsAsync) return false;
    try {
      return (await this.bridge.supportsAsync(method)) === true;
    } catch {
      return false;
    }
  }

  private async canReadVkLeaderboard(): Promise<boolean> {
    if (!this.bridge?.supportsAsync) return true;
    try {
      const [authSupported, apiSupported] = await Promise.all([
        this.bridge.supportsAsync(VK_GET_AUTH_TOKEN_METHOD),
        this.bridge.supportsAsync(VK_CALL_API_METHOD),
      ]);
      return authSupported === true && apiSupported === true;
    } catch {
      return false;
    }
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

  private getNativeAdsSupport(): Promise<boolean> {
    if (this.nativeAdsSupportPromise) return this.nativeAdsSupportPromise;
    if (!this.bridge?.supportsAsync) return Promise.resolve(false);

    try {
      this.nativeAdsSupportPromise = Promise.all([
        this.bridge.supportsAsync(VK_CHECK_NATIVE_ADS_METHOD),
        this.bridge.supportsAsync(VK_SHOW_NATIVE_ADS_METHOD),
      ]).then(
        ([checkSupported, showSupported]) =>
          checkSupported === true && showSupported === true,
        () => false,
      );
    } catch {
      this.nativeAdsSupportPromise = Promise.resolve(false);
    }
    return this.nativeAdsSupportPromise;
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

function normalizeProfilePhotoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" || url.protocol === "http:"
      ? normalized
      : null;
  } catch {
    return null;
  }
}

function normalizeOrderId(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || undefined;
  }
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? String(value)
    : undefined;
}

function isUnsupportedBridgeFailure(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const errorData = isRecord(value.error_data) ? value.error_data : {};
  return Number(errorData.error_code) === 6;
}

function classifyNativeAdFailure(
  value: unknown,
): "unsupported" | "unavailable" | "cancelled" | "error" {
  if (!isRecord(value)) return "error";
  const errorData = isRecord(value.error_data) ? value.error_data : {};
  const code = Number(errorData.error_code);
  if (code === 4) return "cancelled";
  if (code === 6) return "unsupported";
  if (code === 10 || code === 20) return "unavailable";
  return "error";
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
