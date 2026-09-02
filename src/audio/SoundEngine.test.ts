import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SoundEngine, type SoundName } from './SoundEngine';

const SOUND_NAMES: readonly SoundName[] = [
  'shoot',
  'hit',
  'fail',
  'win',
  'ui',
  'upgrade',
  'boss',
];

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
