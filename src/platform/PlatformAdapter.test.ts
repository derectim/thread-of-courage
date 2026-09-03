import { describe, expect, it, vi } from "vitest";

import {
  VK_APP_ID,
  createPlatformAdapter,
  detectVkLaunchContext,
  type PlatformDocument,
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
  public readonly send = vi.fn((_method: "VKWebAppInit") => this.sendResult);
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
    expect(bridge.send).not.toHaveBeenCalled();

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
