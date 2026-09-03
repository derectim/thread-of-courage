import vkBridge from "@vkontakte/vk-bridge";

export const VK_APP_ID = 54_751_080;
export const VK_APP_URL = `https://vk.com/app${VK_APP_ID}`;

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
  send(method: "VKWebAppInit"): unknown;
  subscribe(listener: VkBridgeListener): void;
  unsubscribe(listener: VkBridgeListener): void;
}

export interface PlatformWindow {
  readonly location: Pick<Location, "search">;
}

export interface PlatformDocument extends EventTarget {
  readonly visibilityState: DocumentVisibilityState;
}

export interface PlatformAdapterOptions {
  readonly appId?: number;
  readonly window?: PlatformWindow;
  readonly document?: PlatformDocument;
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
  private listeningToBridge = false;
  private destroyed = false;

  public constructor(
    private readonly environmentDocument: PlatformDocument,
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

  return new BrowserPlatformAdapter(
    environmentDocument,
    environmentWindow.location.search,
    options.appId ?? VK_APP_ID,
    options.bridge,
  );
}
