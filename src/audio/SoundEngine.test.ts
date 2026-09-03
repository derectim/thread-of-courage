import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SoundEngine,
  type MusicTheme,
  type SoundName,
} from './SoundEngine';

const SOUND_NAMES: readonly SoundName[] = [
  'shoot',
  'hit',
  'fail',
  'win',
  'ui',
  'upgrade',
  'boss',
];

const MUSIC_THEMES: readonly MusicTheme[] = ['menu', 'raid', 'boss'];

class FakeDocument extends EventTarget {
  public visibilityState: DocumentVisibilityState = 'visible';
}

class FakeAudioParam {
  public value = 0;
  public readonly cancelScheduledValues = vi.fn(() => this);
  public readonly setTargetAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });
  public readonly setValueAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });
  public readonly exponentialRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });
}

class FakeGainNode {
  public readonly gain = new FakeAudioParam();
  public readonly connect = vi.fn();
  public readonly disconnect = vi.fn();
}

class FakeAudioBuffer {
  public readonly duration: number;
  private readonly samples: Float32Array;

  public constructor(
    public readonly length: number,
    public readonly sampleRate: number,
  ) {
    this.duration = length / sampleRate;
    this.samples = new Float32Array(length);
  }

  public getChannelData(): Float32Array {
    return this.samples;
  }
}

class FakeBufferSourceNode {
  public buffer: AudioBuffer | null = null;
  public loop = false;
  public loopStart = 0;
  public loopEnd = 0;
  public onended: ((this: AudioScheduledSourceNode, event: Event) => void) | null = null;
  public readonly connect = vi.fn();
  public readonly disconnect = vi.fn();
  public readonly start = vi.fn();
  public readonly stop = vi.fn(() => {
    this.onended?.call(
      this as unknown as AudioScheduledSourceNode,
      new Event('ended'),
    );
  });
}

class FakeAudioContext {
  public static instances: FakeAudioContext[] = [];

  public state: AudioContextState = 'suspended';
  public readonly currentTime = 1;
  public readonly sampleRate = 2_000;
  public readonly destination = {} as AudioDestinationNode;
  public readonly gains: FakeGainNode[] = [];
  public readonly sources: FakeBufferSourceNode[] = [];
  public readonly buffers: FakeAudioBuffer[] = [];
  public readonly resume = vi.fn(async () => {
    this.state = 'running';
  });
  public readonly suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
  public readonly close = vi.fn(async () => {
    this.state = 'closed';
  });

  public constructor(_options?: AudioContextOptions) {
    FakeAudioContext.instances.push(this);
  }

  public createGain(): GainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  public createBuffer(
    _numberOfChannels: number,
    length: number,
    sampleRate: number,
  ): AudioBuffer {
    const buffer = new FakeAudioBuffer(length, sampleRate);
    this.buffers.push(buffer);
    return buffer as unknown as AudioBuffer;
  }

  public createBufferSource(): AudioBufferSourceNode {
    const source = new FakeBufferSourceNode();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }
}

function installFakeBrowserAudio(): FakeDocument {
  const fakeDocument = new FakeDocument();
  FakeAudioContext.instances = [];
  vi.stubGlobal('document', fakeDocument as unknown as Document);
  vi.stubGlobal(
    'AudioContext',
    FakeAudioContext as unknown as typeof AudioContext,
  );
  return fakeDocument;
}

async function settleAudioPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('SoundEngine without browser audio APIs', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    vi.stubGlobal('document', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('can be created and reports that audio cannot be unlocked', async () => {
    expect(() => new SoundEngine()).not.toThrow();

    const engine = new SoundEngine();
    await expect(engine.unlock()).resolves.toBe(false);
    engine.destroy();
  });

  it.each(SOUND_NAMES)('safely ignores play(%s)', async (sound) => {
    const engine = new SoundEngine();

    expect(() => engine.play(sound)).not.toThrow();
    await expect(engine.unlock()).resolves.toBe(false);

    engine.destroy();
  });

  it('supports mute and setMuted without an audio context', () => {
    const engine = new SoundEngine();

    expect(engine.isMuted()).toBe(false);
    expect(() => engine.mute()).not.toThrow();
    expect(engine.isMuted()).toBe(true);
    expect(() => engine.setMuted(false)).not.toThrow();
    expect(engine.isMuted()).toBe(false);

    engine.destroy();
  });

  it('safely accepts and stops music without browser audio APIs', async () => {
    const engine = new SoundEngine();

    expect(() => engine.setMusicTheme('menu')).not.toThrow();
    expect(() => engine.setMusicTheme('raid')).not.toThrow();
    expect(() => engine.setMusicTheme('boss')).not.toThrow();
    expect(() => engine.stopMusic()).not.toThrow();
    await expect(engine.unlock()).resolves.toBe(false);

    engine.destroy();
  });

  it.each(MUSIC_THEMES)(
    'defers the %s loop until the first user gesture',
    async (theme) => {
      const fakeDocument = installFakeBrowserAudio();
      const engine = new SoundEngine();

      engine.setMusicTheme(theme);
      expect(FakeAudioContext.instances).toHaveLength(0);

      fakeDocument.dispatchEvent(new Event('pointerdown'));
      await settleAudioPromises();

      const context = FakeAudioContext.instances[0];
      expect(context.state).toBe('running');
      expect(context.sources).toHaveLength(1);
      expect(context.sources[0].loop).toBe(true);
      expect(context.sources[0].loopEnd).toBeGreaterThan(10);
      expect(context.sources[0].start).toHaveBeenCalledOnce();
      expect(context.buffers).toHaveLength(1);

      engine.destroy();
    },
  );

  it('switches themes once and restarts the requested loop after mute', async () => {
    const fakeDocument = installFakeBrowserAudio();
    const engine = new SoundEngine();
    engine.setMusicTheme('menu');
    fakeDocument.dispatchEvent(new Event('pointerdown'));
    await settleAudioPromises();

    const context = FakeAudioContext.instances[0];
    const menuSource = context.sources[0];
    engine.setMusicTheme('boss');
    expect(context.sources).toHaveLength(2);
    expect(menuSource.stop).toHaveBeenCalledOnce();

    engine.setMusicTheme('boss');
    expect(context.sources).toHaveLength(2);

    const bossSource = context.sources[1];
    engine.setMuted(true);
    expect(bossSource.stop).toHaveBeenCalledOnce();
    engine.setMuted(false);
    expect(context.sources).toHaveLength(3);

    engine.destroy();
  });

  it('waits for a new gesture after returning from a hidden document', async () => {
    const fakeDocument = installFakeBrowserAudio();
    const engine = new SoundEngine();
    engine.setMusicTheme('raid');
    fakeDocument.dispatchEvent(new Event('pointerdown'));
    await settleAudioPromises();

    const context = FakeAudioContext.instances[0];
    const firstSource = context.sources[0];
    fakeDocument.visibilityState = 'hidden';
    fakeDocument.dispatchEvent(new Event('visibilitychange'));
    await settleAudioPromises();

    expect(firstSource.stop).toHaveBeenCalledOnce();
    expect(context.suspend).toHaveBeenCalledOnce();
    expect(context.state).toBe('suspended');

    fakeDocument.visibilityState = 'visible';
    fakeDocument.dispatchEvent(new Event('visibilitychange'));
    await settleAudioPromises();
    expect(context.sources).toHaveLength(1);

    fakeDocument.dispatchEvent(new Event('pointerdown'));
    await settleAudioPromises();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(context.sources).toHaveLength(2);

    engine.destroy();
  });

  it('stops procedural music and closes its context exactly once', async () => {
    const fakeDocument = installFakeBrowserAudio();
    const engine = new SoundEngine();
    engine.setMusicTheme('menu');
    fakeDocument.dispatchEvent(new Event('pointerdown'));
    await settleAudioPromises();

    const context = FakeAudioContext.instances[0];
    const source = context.sources[0];
    engine.destroy();
    engine.destroy();

    expect(source.stop).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it('safely exposes the upgrade and boss convenience methods', async () => {
    const engine = new SoundEngine();

    expect(() => engine.upgrade()).not.toThrow();
    expect(() => engine.boss()).not.toThrow();
    await expect(engine.unlock()).resolves.toBe(false);

    engine.destroy();
  });

  it('can be destroyed repeatedly without throwing', () => {
    const engine = new SoundEngine();

    expect(() => {
      engine.destroy();
      engine.destroy();
    }).not.toThrow();
  });
});
