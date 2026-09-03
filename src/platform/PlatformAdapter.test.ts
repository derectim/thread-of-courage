import { describe, expect, it, vi } from "vitest";

import {
  HIT_FEEDBACK_DURATION_MS,
  VK_APP_ID,
  VK_CLOUD_CHUNK_SIZE,
  VK_CLOUD_PROGRESS_KEY,
  createPlatformAdapter,
  detectVkLaunchContext,
  type PlatformDocument,
  type PlatformNavigator,
  type PlatformWindow,
  type VkBridgeLike,
  type VkBridgeListener,
} from "./PlatformAdapter";

type BridgeMethod = Parameters<VkBridgeLike["send"]>[0];
type BridgeParams = Parameters<VkBridgeLike["send"]>[1];
type SupportedBridgeMethod = Parameters<
  NonNullable<VkBridgeLike["supportsAsync"]>
>[0];

class FakeDocument extends EventTarget implements PlatformDocument {
  public visibilityState: DocumentVisibilityState = "visible";

  public setVisibility(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

class FakeBridge implements VkBridgeLike {
  private readonly listeners = new Set<VkBridgeListener>();
  public sendResult: unknown = Promise.resolve({ result: true });
  public tapticSupported = true;
  public nativeAdsSupported = true;
  public leaderboardApiSupported = true;
  public readonly send = vi.fn(
    (
      _method: BridgeMethod,
      _params?: BridgeParams,
    ) => this.sendResult,
  );
  public readonly supportsAsync = vi.fn(
    async (method: SupportedBridgeMethod) =>
      method === "VKWebAppTapticImpactOccurred"
        ? this.tapticSupported
        : method === "VKWebAppGetAuthToken" ||
            method === "VKWebAppCallAPIMethod"
          ? this.leaderboardApiSupported
          : this.nativeAdsSupported,
  );
  public readonly subscribe = vi.fn((listener: VkBridgeListener) => {
    this.listeners.add(listener);
  });
  public readonly unsubscribe = vi.fn((listener: VkBridgeListener) => {
    this.listeners.delete(listener);
  });

  public emit(type: string): void {
    for (const listener of [...this.listeners]) {
      listener({ detail: { type, data: {} } });
    }
  }
}

function fakeWindow(search: string): PlatformWindow {
  return { location: { search } };
}

function fakeNavigator(): PlatformNavigator & {
  vibrate: ReturnType<typeof vi.fn>;
} {
  return { vibrate: vi.fn(() => true) };
}

function vkSearch(extra = ""): string {
  return `?vk_app_id=${VK_APP_ID}&vk_platform=android&vk_user_id=123&sign=test${extra}`;
}

describe("detectVkLaunchContext", () => {
  it("recognizes only the configured VK application in an embedded runtime", () => {
    expect(detectVkLaunchContext(vkSearch(), VK_APP_ID, true)).toEqual({
      appId: VK_APP_ID,
      platform: "android",
      userId: 123,
      hasLaunchSignature: true,
    });
    expect(
      detectVkLaunchContext("?vk_app_id=1&vk_platform=android", VK_APP_ID, true),
    ).toBeNull();
    expect(detectVkLaunchContext(vkSearch(), VK_APP_ID, false)).toBeNull();
  });

  it("keeps a missing signature as metadata instead of blocking initialization", () => {
    expect(
      detectVkLaunchContext(`?vk_app_id=${VK_APP_ID}`, VK_APP_ID, true),
    ).toEqual({
      appId: VK_APP_ID,
      platform: null,
      userId: null,
      hasLaunchSignature: false,
    });
  });
});

describe("platform adapter", () => {
  it("uses a no-op standalone fallback on a normal GitHub Pages visit", async () => {
    const bridge = new FakeBridge();
    const adapter = createPlatformAdapter({
      window: fakeWindow(""),
      document: new FakeDocument(),
      bridge,
    });

    expect(adapter.kind).toBe("standalone");
    expect(adapter.launchContext).toBeNull();
    await expect(adapter.initialize()).resolves.toBe(false);
    await expect(adapter.loadCloudProgress()).resolves.toBeNull();
    await expect(adapter.saveCloudProgress("save")).resolves.toBe(false);
    await expect(adapter.showRewardedAd()).resolves.toBe("unsupported");
    await expect(adapter.showInterstitialAd()).resolves.toBe("unsupported");
    await expect(adapter.showLeaderboard(12)).resolves.toBe("unsupported");
    await expect(adapter.loadLeaderboard()).resolves.toEqual({
      status: "unsupported",
    });
    await expect(adapter.showOrder("season_pass")).resolves.toEqual({
      status: "unsupported",
    });
    expect(bridge.send).not.toHaveBeenCalled();

    adapter.destroy();
  });

  it("checks and shows a rewarded VK ad before confirming its reward", async () => {
    const bridge = new FakeBridge();
    bridge.send.mockImplementation((method) => {
      if (method === "VKWebAppCheckNativeAds") {
        return Promise.resolve({ result: true });
      }
      if (method === "VKWebAppShowNativeAds") {
        return Promise.resolve({ result: true });
      }
      return Promise.resolve({ result: true });
    });
    const adapter = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge,
    });
    const onPause = vi.fn();
    const onResume = vi.fn();
    adapter.subscribeLifecycle({ onPause, onResume });

    await expect(adapter.showRewardedAd()).resolves.toBe("rewarded");
    expect(onPause).toHaveBeenCalledOnce();
    expect(onResume).toHaveBeenCalledOnce();
    expect(bridge.supportsAsync).toHaveBeenCalledWith("VKWebAppCheckNativeAds");
    expect(bridge.send).toHaveBeenCalledWith("VKWebAppCheckNativeAds", {
      ad_format: "reward",
      use_waterfall: false,
    });
    expect(bridge.send).toHaveBeenCalledWith("VKWebAppShowNativeAds", {
      ad_format: "reward",
      use_waterfall: false,
    });
    adapter.destroy();
  });

  it("shows an interstitial through the same typed native-ad contract", async () => {
    const bridge = new FakeBridge();
    bridge.send.mockImplementation((method) =>
      Promise.resolve({ result: method !== "VKWebAppStorageGet" }),
    );
    const adapter = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge,
    });

    await expect(adapter.showInterstitialAd()).resolves.toBe("shown");
    expect(bridge.send).toHaveBeenCalledWith("VKWebAppCheckNativeAds", {
      ad_format: "interstitial",
    });
    expect(bridge.send).toHaveBeenCalledWith("VKWebAppShowNativeAds", {
      ad_format: "interstitial",
    });
    adapter.destroy();
  });

  it("does not show or fake a reward when native ads are unsupported or empty", async () => {
    const unsupportedBridge = new FakeBridge();
    unsupportedBridge.nativeAdsSupported = false;
    const unsupported = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge: unsupportedBridge,
    });
    await expect(unsupported.showRewardedAd()).resolves.toBe("unsupported");
    expect(unsupportedBridge.send).not.toHaveBeenCalledWith(
      "VKWebAppShowNativeAds",
      expect.anything(),
    );
    unsupported.destroy();

    const emptyBridge = new FakeBridge();
    emptyBridge.send.mockImplementation((method) =>
      Promise.resolve({ result: method !== "VKWebAppCheckNativeAds" }),
    );
    const empty = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge: emptyBridge,
    });
    await expect(empty.showRewardedAd()).resolves.toBe("unavailable");
    expect(emptyBridge.send).not.toHaveBeenCalledWith(
      "VKWebAppShowNativeAds",
      expect.anything(),
    );
    empty.destroy();
  });

  it("treats a cancelled or failed rewarded video as no reward", async () => {
    const cancelledBridge = new FakeBridge();
    cancelledBridge.send.mockImplementation((method) =>
      Promise.resolve({ result: method !== "VKWebAppShowNativeAds" }),
    );
    const cancelled = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge: cancelledBridge,
    });
    await expect(cancelled.showRewardedAd()).resolves.toBe("cancelled");
    cancelled.destroy();

    const deniedBridge = new FakeBridge();
    deniedBridge.send.mockImplementation((method) => {
      if (method === "VKWebAppShowNativeAds") {
        return Promise.reject({
          error_type: "client_error",
          error_data: { error_code: 4 },
        });
      }
      return Promise.resolve({ result: true });
    });
    const denied = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge: deniedBridge,
    });
    await expect(denied.showRewardedAd()).resolves.toBe("cancelled");
    denied.destroy();

    const failingBridge = new FakeBridge();
    failingBridge.send.mockImplementation((method) => {
      if (method === "VKWebAppShowNativeAds") {
        return Promise.reject({ error_type: "api_error", error_data: {} });
      }
      return Promise.resolve({ result: true });
    });
    const failing = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge: failingBridge,
    });
    await expect(failing.showRewardedAd()).resolves.toBe("error");
    failing.destroy();
  });

  it("normalizes a score and trusts only an explicit leaderboard success", async () => {
    const bridge = new FakeBridge();
    bridge.send.mockImplementation((method) =>
      Promise.resolve(
        method === "VKWebAppShowLeaderBoardBox"
          ? { success: true }
          : { result: true },
      ),
    );
    const adapter = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge,
    });

    await expect(adapter.showLeaderboard(12.9)).resolves.toBe("shown");
    expect(bridge.send).toHaveBeenCalledWith("VKWebAppShowLeaderBoardBox", {
      user_result: 12,
      global: 1,
    });

    bridge.send.mockImplementation((method) =>
      Promise.resolve(
        method === "VKWebAppShowLeaderBoardBox"
          ? { success: false }
          : { result: true },
      ),
    );
    await expect(adapter.showLeaderboard(-50)).resolves.toBe("error");
    expect(bridge.send).toHaveBeenCalledWith("VKWebAppShowLeaderBoardBox", {
      user_result: 0,
      global: 1,
    });
    adapter.destroy();
  });

  it("reads the global VK level leaderboard through an auth token", async () => {
    const bridge = new FakeBridge();
    const leaderboardPayload = {
      count: 1,
      items: [{ user_id: 123, level: 17, points: 0 }],
      profiles: [{ id: 123, first_name: "Ива", last_name: "Ниткина" }],
    };
    bridge.send.mockImplementation((method) => {
      if (method === "VKWebAppGetAuthToken") {
        return Promise.resolve({ access_token: " leaderboard-token " });
      }
      if (method === "VKWebAppCallAPIMethod") {
        return Promise.resolve({ response: leaderboardPayload });
      }
      return Promise.resolve({ result: true });
    });
    const adapter = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge,
    });

    await expect(adapter.loadLeaderboard()).resolves.toEqual({
      status: "ready",
      payload: leaderboardPayload,
    });
    expect(bridge.send).toHaveBeenCalledWith("VKWebAppGetAuthToken", {
      app_id: VK_APP_ID,
      scope: "",
    });
    expect(bridge.send).toHaveBeenCalledWith("VKWebAppCallAPIMethod", {
      method: "apps.getLeaderboard",
      params: {
        type: "level",
        global: 1,
        extended: 1,
        v: "5.199",
        access_token: "leaderboard-token",
      },
    });
    adapter.destroy();
  });

  it("keeps unsupported and failed VK leaderboard reads safe", async () => {
    const unsupportedBridge = new FakeBridge();
    unsupportedBridge.leaderboardApiSupported = false;
    const unsupported = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge: unsupportedBridge,
    });
    await expect(unsupported.loadLeaderboard()).resolves.toEqual({
      status: "unsupported",
    });
    expect(unsupportedBridge.send).not.toHaveBeenCalledWith(
      "VKWebAppGetAuthToken",
      expect.anything(),
    );
    unsupported.destroy();

    const failingBridge = new FakeBridge();
    failingBridge.send.mockImplementation((method) => {
      if (method === "VKWebAppGetAuthToken") {
        return Promise.reject(new Error("auth unavailable"));
      }
      return Promise.resolve({ result: true });
    });
    const failing = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge: failingBridge,
    });
    await expect(failing.loadLeaderboard()).resolves.toEqual({
      status: "error",
    });
    failing.destroy();

    const malformedBridge = new FakeBridge();
    malformedBridge.send.mockImplementation((method) => {
      if (method === "VKWebAppGetAuthToken") {
        return Promise.resolve({ access_token: "token" });
      }
      if (method === "VKWebAppCallAPIMethod") {
        return Promise.resolve({ not_response: true });
      }
      return Promise.resolve({ result: true });
    });
    const malformed = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge: malformedBridge,
    });
    await expect(malformed.loadLeaderboard()).resolves.toEqual({
      status: "error",
    });
    malformed.destroy();
  });

  it("returns native order status without granting any entitlement", async () => {
    const bridge = new FakeBridge();
    bridge.send.mockImplementation((method) =>
      Promise.resolve(
        method === "VKWebAppShowOrderBox"
          ? { status: "success", order_id: "order-42" }
          : { result: true },
      ),
    );
    const adapter = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge,
    });

    await expect(adapter.showOrder("  season_pass  ")).resolves.toEqual({
      status: "success",
      orderId: "order-42",
    });
    expect(bridge.send).toHaveBeenCalledWith("VKWebAppShowOrderBox", {
      type: "item",
      item: "season_pass",
    });
    await expect(adapter.showOrder("   ")).resolves.toEqual({ status: "fail" });

    bridge.send.mockImplementation((method) =>
      Promise.resolve(
        method === "VKWebAppShowOrderBox"
          ? { status: "cancel" }
          : { result: true },
      ),
    );
    await expect(adapter.showOrder("season_pass")).resolves.toEqual({
      status: "cancel",
    });

    bridge.send.mockImplementation((method) =>
      Promise.resolve(
        method === "VKWebAppShowOrderBox"
          ? { success: true, order_id: 731 }
          : { result: true },
      ),
    );
    await expect(adapter.showOrder("cosmetic_bundle")).resolves.toEqual({
      status: "success",
      orderId: "731",
    });
    adapter.destroy();
  });

  it("loads and saves VK cloud progress after one initialization", async () => {
    const bridge = new FakeBridge();
    bridge.send.mockImplementation((method) => {
      if (method === "VKWebAppStorageGet") {
        return Promise.resolve({
          keys: [{ key: VK_CLOUD_PROGRESS_KEY, value: "cloud-save" }],
        });
      }
      return Promise.resolve({ result: true });
    });
    const adapter = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge,
    });

    await expect(adapter.loadCloudProgress()).resolves.toBe("cloud-save");
    await expect(adapter.saveCloudProgress("next-save")).resolves.toBe(true);
    expect(bridge.send).toHaveBeenCalledWith("VKWebAppStorageGet", {
      keys: [VK_CLOUD_PROGRESS_KEY],
    });
    expect(bridge.send).toHaveBeenCalledWith("VKWebAppStorageSet", {
      key: VK_CLOUD_PROGRESS_KEY,
      value: "next-save",
    });
    expect(
      bridge.send.mock.calls.filter(([method]) => method === "VKWebAppInit"),
    ).toHaveLength(1);

    adapter.destroy();
  });

  it("splits a large VK save into safe chunks and joins it on load", async () => {
    const bridge = new FakeBridge();
    const storage = new Map<string, string>();
    bridge.send.mockImplementation((method, params) => {
      if (method === "VKWebAppStorageSet" && params && "key" in params) {
        storage.set(params.key, params.value);
        return Promise.resolve({ result: true });
      }
      if (method === "VKWebAppStorageGet" && params && "keys" in params) {
        return Promise.resolve({
          keys: params.keys.map((key) => ({ key, value: storage.get(key) ?? "" })),
        });
      }
      return Promise.resolve({ result: true });
    });
    const adapter = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge,
    });
    const progress = "п".repeat(VK_CLOUD_CHUNK_SIZE + 731);

    await expect(adapter.saveCloudProgress(progress)).resolves.toBe(true);
    await expect(adapter.loadCloudProgress()).resolves.toBe(progress);
    expect(storage.get(VK_CLOUD_PROGRESS_KEY)).toContain("thread-chunks-v1");

    adapter.destroy();
  });

  it("keeps cloud failures out of gameplay", async () => {
    const bridge = new FakeBridge();
    bridge.send.mockImplementation((method) => {
      if (method === "VKWebAppInit") return Promise.resolve({ result: true });
      return Promise.reject(new Error("storage unavailable"));
    });
    const adapter = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge,
    });

    await expect(adapter.loadCloudProgress()).resolves.toBeNull();
    await expect(adapter.saveCloudProgress("save")).resolves.toBe(false);

    adapter.destroy();
  });

  it("initializes VK Bridge once for app 54751080", async () => {
    const bridge = new FakeBridge();
    const adapter = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge,
    });

    expect(adapter.kind).toBe("vk");
    await expect(adapter.initialize()).resolves.toBe(true);
    await expect(adapter.initialize()).resolves.toBe(true);
    expect(bridge.subscribe).toHaveBeenCalledOnce();
    expect(bridge.send).toHaveBeenCalledOnce();
    expect(bridge.send).toHaveBeenCalledWith("VKWebAppInit");

    adapter.destroy();
  });

  it("uses VK taptic impact for a confirmed hit when supported", async () => {
    const bridge = new FakeBridge();
    const browserNavigator = fakeNavigator();
    const adapter = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      navigator: browserNavigator,
      bridge,
    });

    adapter.hitFeedback();

    await vi.waitFor(() => {
      expect(bridge.send).toHaveBeenCalledWith(
        "VKWebAppTapticImpactOccurred",
        { style: "medium" },
      );
    });
    expect(bridge.supportsAsync).toHaveBeenCalledOnce();
    expect(bridge.supportsAsync).toHaveBeenCalledWith(
      "VKWebAppTapticImpactOccurred",
    );
    expect(browserNavigator.vibrate).not.toHaveBeenCalled();

    adapter.destroy();
  });

  it("does nothing in VK when taptic impact is unsupported", async () => {
    const bridge = new FakeBridge();
    bridge.tapticSupported = false;
    const browserNavigator = fakeNavigator();
    const adapter = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      navigator: browserNavigator,
      bridge,
    });

    adapter.hitFeedback();

    await vi.waitFor(() => {
      expect(bridge.supportsAsync).toHaveBeenCalledOnce();
    });
    expect(bridge.send).not.toHaveBeenCalledWith(
      "VKWebAppTapticImpactOccurred",
      { style: "medium" },
    );
    expect(browserNavigator.vibrate).not.toHaveBeenCalled();

    adapter.destroy();
  });

  it("uses a short browser vibration outside VK", () => {
    const browserNavigator = fakeNavigator();
    const adapter = createPlatformAdapter({
      window: fakeWindow(""),
      document: new FakeDocument(),
      navigator: browserNavigator,
      bridge: new FakeBridge(),
    });

    adapter.hitFeedback();

    expect(browserNavigator.vibrate).toHaveBeenCalledOnce();
    expect(browserNavigator.vibrate).toHaveBeenCalledWith(
      HIT_FEEDBACK_DURATION_MS,
    );
    adapter.destroy();
  });

  it("keeps unsupported or failing browser vibration as a safe no-op", () => {
    const unsupported = createPlatformAdapter({
      window: fakeWindow(""),
      document: new FakeDocument(),
      navigator: {},
      bridge: new FakeBridge(),
    });
    expect(() => unsupported.hitFeedback()).not.toThrow();
    unsupported.destroy();

    const failingNavigator: PlatformNavigator = {
      vibrate: vi.fn(() => {
        throw new Error("vibration unavailable");
      }),
    };
    const failing = createPlatformAdapter({
      window: fakeWindow(""),
      document: new FakeDocument(),
      navigator: failingNavigator,
      bridge: new FakeBridge(),
    });
    expect(() => failing.hitFeedback()).not.toThrow();
    failing.destroy();
    expect(() => failing.hitFeedback()).not.toThrow();
    expect(failingNavigator.vibrate).toHaveBeenCalledOnce();
  });

  it("pauses and restores once across overlapping VK and page visibility", async () => {
    const bridge = new FakeBridge();
    const document = new FakeDocument();
    const adapter = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document,
      bridge,
    });
    const onPause = vi.fn();
    const onResume = vi.fn();
    adapter.subscribeLifecycle({ onPause, onResume });
    await adapter.initialize();

    bridge.emit("VKWebAppViewHide");
    bridge.emit("VKWebAppViewHide");
    document.setVisibility("hidden");
    bridge.emit("VKWebAppViewRestore");
    expect(onPause).toHaveBeenCalledOnce();
    expect(onResume).not.toHaveBeenCalled();

    document.setVisibility("visible");
    expect(onResume).toHaveBeenCalledOnce();

    adapter.destroy();
  });

  it("uses visibility lifecycle in standalone mode and detaches on destroy", () => {
    const bridge = new FakeBridge();
    const document = new FakeDocument();
    const adapter = createPlatformAdapter({
      window: fakeWindow(""),
      document,
      bridge,
    });
    const onPause = vi.fn();
    const onResume = vi.fn();
    adapter.subscribeLifecycle({ onPause, onResume });

    document.setVisibility("hidden");
    document.setVisibility("visible");
    expect(onPause).toHaveBeenCalledOnce();
    expect(onResume).toHaveBeenCalledOnce();

    adapter.destroy();
    document.setVisibility("hidden");
    expect(onPause).toHaveBeenCalledOnce();
  });

  it("fails open when VKWebAppInit is rejected", async () => {
    const bridge = new FakeBridge();
    bridge.sendResult = Promise.reject(new Error("bridge unavailable"));
    const adapter = createPlatformAdapter({
      window: fakeWindow(vkSearch()),
      document: new FakeDocument(),
      bridge,
    });

    await expect(adapter.initialize()).resolves.toBe(false);
    adapter.destroy();
    expect(bridge.unsubscribe).toHaveBeenCalledOnce();
  });

  it("immediately pauses a subscriber when the page starts hidden", () => {
    const document = new FakeDocument();
    document.visibilityState = "hidden";
    const adapter = createPlatformAdapter({
      window: fakeWindow(""),
      document,
      bridge: new FakeBridge(),
    });
    const onPause = vi.fn();
    adapter.subscribeLifecycle({ onPause, onResume: vi.fn() });

    expect(onPause).toHaveBeenCalledOnce();
    adapter.destroy();
  });
});
