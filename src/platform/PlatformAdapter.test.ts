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
  public readonly send = vi.fn(
    (
      _method:
        | "VKWebAppInit"
        | "VKWebAppStorageGet"
        | "VKWebAppStorageSet"
        | "VKWebAppTapticImpactOccurred",
      _params?:
        | { readonly style: "medium" }
        | { readonly keys: readonly string[] }
        | { readonly key: string; readonly value: string },
    ) => this.sendResult,
  );
  public readonly supportsAsync = vi.fn(
    async (_method: "VKWebAppTapticImpactOccurred") => this.tapticSupported,
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
    expect(bridge.send).not.toHaveBeenCalled();

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
